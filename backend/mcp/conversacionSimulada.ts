import { avisosDeCuerpo } from "./catalogoDeTools.js";
import { leerEnviosSimulados } from "./enviosSimulados.js";
import { crearLlamadaSimulada } from "./llamadasSimuladas.js";
import { ejecutarSoloLectura } from "./sqlDeSoloLectura.js";
import { enviarWebhookTelnyx } from "./webhooks.js";

/**
 * Una conversación de voz simulada de punta a punta en UNA llamada al MCP:
 * los pasos (get_catalog, check_availability, book_appointment…) van en
 * orden sobre la misma llamada simulada y cada uno puede usar lo que
 * devolvieron los anteriores con `{{nombre}}` (p. ej. «{{availabilityToken}}»
 * o «{{bookingId}}»). Al final, cómo quedó la llamada en la BD de dev (sus
 * citas y reservas pendientes) y lo que backend-sim no envió.
 *
 * Nace de la prueba E2E del 28-10: nueve llamadas a simular_webhook_telnyx
 * copiando a mano tokens e ids entre una y otra.
 */
export type PasoDeConversacion = {
  tool: string;
  cuerpo?: Record<string, unknown>;
};

const MARCADOR = /^\{\{(\w+)\}\}$/;

/**
 * Los valores con nombre de una respuesta (a cualquier profundidad): el
 * último que aparece con ese nombre gana. Solo cadenas y números.
 */
export function recogerValores(
  valor: unknown,
  memoria: Map<string, unknown> = new Map()
): Map<string, unknown> {
  if (Array.isArray(valor)) {
    for (const elemento of valor) recogerValores(elemento, memoria);
  } else if (valor && typeof valor === "object") {
    for (const [clave, v] of Object.entries(valor)) {
      if (typeof v === "string" || typeof v === "number") memoria.set(clave, v);
      else recogerValores(v, memoria);
    }
  }
  return memoria;
}

/** Cambia cada «{{nombre}}» por su valor de la memoria (lanza si falta). */
export function rellenarMarcadores(
  valor: unknown,
  memoria: Map<string, unknown>
): unknown {
  if (typeof valor === "string") {
    const marcador = MARCADOR.exec(valor);
    if (!marcador) return valor;
    if (!memoria.has(marcador[1])) {
      throw new Error(
        `[MCP] Ningún paso anterior devolvió «${marcador[1]}» (hay: ${[...memoria.keys()].join(", ") || "nada"})`
      );
    }
    return memoria.get(marcador[1]);
  }
  if (Array.isArray(valor)) return valor.map((v) => rellenarMarcadores(v, memoria));
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([clave, v]) => [clave, rellenarMarcadores(v, memoria)])
    );
  }
  return valor;
}

/**
 * book_appointment sin availabilityToken ni startDateTime toma el token del
 * último check_availability: es lo que haría el modelo.
 */
export function completarReserva(
  tool: string,
  cuerpo: Record<string, unknown>,
  memoria: Map<string, unknown>
): Record<string, unknown> {
  if (
    tool === "book_appointment" &&
    !("availabilityToken" in cuerpo) &&
    !("startDateTime" in cuerpo) &&
    memoria.has("availabilityToken")
  ) {
    return { ...cuerpo, availabilityToken: memoria.get("availabilityToken") };
  }
  return cuerpo;
}

/** Lo que un paso fallido tiene que cortar: HTTP de error o success:false. */
function pasoFallido(status: number, respuesta: unknown): boolean {
  if (status >= 400) return true;
  const resultado = (respuesta as { result?: { success?: unknown } })?.result;
  return (
    (respuesta as { success?: unknown })?.success === false ||
    resultado?.success === false
  );
}

export async function simularConversacion({
  urlDeBdDeDev,
  clavePrivada,
  canal = "voz",
  businessId,
  telefonoCliente,
  callControlId,
  pasos,
  pararSiFalla = false,
}: {
  urlDeBdDeDev: string;
  clavePrivada: string;
  /** voz: la recepcionista (una llamada simulada); gestor: el chat del
   * dueño (sin llamada, el negocio va en las cabeceras). */
  canal?: "voz" | "gestor";
  businessId?: string;
  telefonoCliente?: string;
  callControlId?: string;
  pasos: PasoDeConversacion[];
  pararSiFalla?: boolean;
}) {
  if (canal === "gestor" && !businessId) {
    throw new Error("[MCP] El Gestor necesita businessId");
  }
  if (!callControlId && !businessId) {
    throw new Error("[MCP] Indica businessId (llamada nueva) o callControlId (seguir una)");
  }
  const inicio = new Date();
  const memoria = new Map<string, unknown>();
  let llamada = callControlId ?? null;
  const resultados: unknown[] = [];

  for (const [indice, paso] of pasos.entries()) {
    const ruta =
      canal === "gestor"
        ? `/webhooks/telnyx/gestor/${paso.tool}`
        : `/webhooks/telnyx/tools/${paso.tool}`;
    const cuerpo = completarReserva(
      paso.tool,
      rellenarMarcadores(paso.cuerpo ?? {}, memoria) as Record<string, unknown>,
      memoria
    );
    const avisos = avisosDeCuerpo(ruta, cuerpo);
    const antes = Date.now();
    const { status, respuesta, llamada: usada } =
      canal === "gestor"
        ? await enviarWebhookTelnyx({
            ruta,
            cuerpo,
            clavePrivada,
            cabeceras: {
              "x-alhabla-business": businessId as string,
              "x-alhabla-role": "owner",
            },
          })
        : await enviarWebhookTelnyx({
            ruta,
            cuerpo,
            clavePrivada,
            callControlId: llamada ?? undefined,
            crearLlamada:
              businessId && !llamada
                ? () =>
                    crearLlamadaSimulada(urlDeBdDeDev, businessId, telefonoCliente)
                : undefined,
          });
    llamada = usada ?? llamada;
    recogerValores(respuesta, memoria);
    const fallido = pasoFallido(status, respuesta);
    resultados.push({
      paso: indice + 1,
      tool: paso.tool,
      cuerpo,
      status,
      ms: Date.now() - antes,
      ...(fallido ? { fallido: true } : {}),
      ...(avisos.length > 0 ? { avisos } : {}),
      respuesta,
    });
    if (fallido && pararSiFalla) break;
  }

  return {
    llamada,
    pasos: resultados,
    ...(llamada ? await comoQuedoLaLlamada(urlDeBdDeDev, llamada) : {}),
    enviosSimulados: await leerEnviosSimulados({ desde: inicio.toISOString() }).catch(
      (error) => `No se pudieron leer: ${(error as Error).message}`
    ),
    siguiente:
      canal === "gestor"
        ? "Las acciones del Gestor que piden confirmación quedan propuestas (no se ejecutan sin el botón del dueño)."
        : "Seguir la misma llamada: callControlId = llamada. Detalle: traza_llamada (entorno dev). Al acabar: borrar_llamadas_simuladas.",
  };
}

async function comoQuedoLaLlamada(urlDeBdDeDev: string, callId: string) {
  const [citas, pendientes] = await Promise.all([
    ejecutarSoloLectura(
      urlDeBdDeDev,
      `SELECT b.id, b."clientName", to_char(b."programedAt" AT TIME ZONE coalesce(n.timezone, 'Europe/Madrid'), 'YYYY-MM-DD HH24:MI') AS "horaLocal",
              b."durationMinutes", b."isCancelled", b."externalEventId" IS NOT NULL AS "enCalendario",
              b."createdVia"
         FROM bookings b
         JOIN calls c ON c.id = b."callId"
         JOIN businesses n ON n.id = c."businessId"
        WHERE c."callId" = $1`,
      { parametros: [callId] }
    ),
    // Las reservas que no salieron se guardan como leads (con su código).
    ejecutarSoloLectura(
      urlDeBdDeDev,
      `SELECT l.id, l.type AS tipo, l."createdAt", l."resolvedAt",
              l.data->>'failureCode' AS "codigoDeFallo",
              l.data->>'startDateTime' AS "horaPedida"
         FROM leads l
         JOIN calls c ON c.id = l."callId"
        WHERE c."callId" = $1
        ORDER BY l."createdAt"`,
      { parametros: [callId] }
    ),
  ]);
  return {
    citasDeLaLlamada: citas.filas,
    reservasPendientes: pendientes.filas,
  };
}
