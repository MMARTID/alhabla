import type { WhatsappNumeroNegocio } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { errorMessage } from "../../lib/logUtils.js";
import { whatsappAdapter } from "../../adapters/whatsapp/WhatsAppAdapter.js";

/**
 * «Conectar mi WhatsApp» (Beta, PLAN-WHATSAPP-COEXISTENCIA.md § 2): el
 * negocio conecta el número que ya usa en la app de WhatsApp Business y
 * Alhabla habla por la API en ese mismo número, con el dueño contestando a
 * la vez desde su app (coexistencia).
 *
 * Integración propia de Tech Provider, no la página alojada de Telnyx
 * (decisión del 2026-11-06): el panel abre `FB.login()` con la
 * configuración de coexistencia, Meta devuelve `waba_id` y
 * `phone_number_id` en el evento FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING, y
 * aquí se registran en Telnyx con `customer_id` = negocio. Telnyx da de alta
 * el WABA en segundo plano y luego el número pasa por la sincronización de
 * coexistencia hasta `active`.
 *
 * De momento solo se conecta y se sigue el estado: los mensajes a los
 * clientes siguen saliendo de «Alhabla Reservas» (fase 2 del plan).
 */

/** Estados en los que el negocio puede (o tiene que) repetir el alta. */
const ESTADOS_PARA_REPETIR = new Set([
  "fallido",
  "sync_deadline_expired",
  "offboarded",
  "disconnected",
]);
/** Mientras no esté conectado, el panel pregunta cada 10 s. */
const FRENO_DE_CONSULTA_MS = 8_000;
/** Ya conectado: basta con mirar de vez en cuando si se desconectó. */
const FRENO_DE_CONSULTA_ACTIVO_MS = 5 * 60_000;
/** El `solution_id` cambia solo si Telnyx rehace el enlace. */
const CACHE_DEL_ENLACE_MS = 10 * 60_000;

export interface DatosDelAlta {
  appId: string;
  configId: string;
  solutionId: string;
  graphVersion: string;
}

export type MotivoNoDisponible =
  "apagado" | "sin_configurar" | "sin_enlace_de_telnyx";

export interface ConexionWhatsappPropio {
  estado: string;
  phoneNumber: string | null;
  syncDeadline: string | null;
  errores: string[];
  conectadoAt: string | null;
  puedeRepetir: boolean;
}

export interface EstadoWhatsappPropio {
  disponible: boolean;
  motivo: MotivoNoDisponible | null;
  alta: DatosDelAlta | null;
  conexion: ConexionWhatsappPropio | null;
}

export type ResultadoDelRegistro =
  | { outcome: "no_disponible"; motivo: MotivoNoDisponible }
  | { outcome: "ya_conectado" }
  | { outcome: "numero_ocupado" }
  | { outcome: "error_de_telnyx"; mensaje: string }
  | { outcome: "registrado"; estado: EstadoWhatsappPropio };

export function whatsappPropioEncendido(): boolean {
  return process.env.WHATSAPP_PROPIO_ENABLED === "true";
}

let enlaceEnCache: {
  appId: string;
  solutionId: string | null;
  hasta: number;
} | null = null;

/** Solo para los tests. */
export function olvidarEnlaceEnCache() {
  enlaceEnCache = null;
}

/**
 * Lo que necesita el panel para abrir el alta de Meta, o por qué no se
 * puede. El `solution_id` se toma de `TELNYX_WA_SOLUTION_ID` o, si no está,
 * de Telnyx (`foreign_apps`), que es la fuente de verdad del enlace.
 */
export async function datosDelAlta(): Promise<
  { alta: DatosDelAlta } | { motivo: MotivoNoDisponible }
> {
  if (!whatsappPropioEncendido()) return { motivo: "apagado" };
  const appId = process.env.META_WHATSAPP_APP_ID?.trim();
  const configId = process.env.META_WHATSAPP_CONFIG_ID?.trim();
  const graphVersion = process.env.META_GRAPH_VERSION?.trim() || "v21.0";
  if (!appId || !configId) return { motivo: "sin_configurar" };

  let solutionId = process.env.TELNYX_WA_SOLUTION_ID?.trim() || null;
  if (!solutionId) {
    if (
      enlaceEnCache &&
      enlaceEnCache.appId === appId &&
      enlaceEnCache.hasta > Date.now()
    ) {
      solutionId = enlaceEnCache.solutionId;
    } else {
      try {
        const app = await whatsappAdapter.appEnlazada(appId);
        solutionId = app?.enabled ? app.solutionId : null;
        enlaceEnCache = {
          appId,
          solutionId,
          hasta: Date.now() + CACHE_DEL_ENLACE_MS,
        };
      } catch (error) {
        console.error(
          `[WhatsApp] No se pudo consultar en Telnyx el enlace de la app ${appId}: ${errorMessage(error)}`
        );
        solutionId = null;
      }
    }
  }
  if (!solutionId) return { motivo: "sin_enlace_de_telnyx" };
  return { alta: { appId, configId, solutionId, graphVersion } };
}

function aConexion(fila: WhatsappNumeroNegocio): ConexionWhatsappPropio {
  return {
    estado: fila.estado,
    phoneNumber: fila.phoneNumber,
    syncDeadline: fila.syncDeadline?.toISOString() ?? null,
    errores: fila.errores,
    conectadoAt: fila.conectadoAt?.toISOString() ?? null,
    puedeRepetir: ESTADOS_PARA_REPETIR.has(fila.estado),
  };
}

/**
 * Pone la fila al día contra Telnyx: primero la sesión de alta y, cuando
 * el número aparece en la cuenta, su `coexistence_state`. Con freno, para
 * que el sondeo del panel no se convierta en una petición a Telnyx cada vez.
 * Nunca lanza: si Telnyx falla, se queda lo guardado.
 */
export async function refrescarConexion(
  fila: WhatsappNumeroNegocio,
  ahora: Date = new Date()
): Promise<WhatsappNumeroNegocio> {
  const freno =
    fila.estado === "active"
      ? FRENO_DE_CONSULTA_ACTIVO_MS
      : FRENO_DE_CONSULTA_MS;
  if (
    fila.consultadoAt &&
    ahora.getTime() - fila.consultadoAt.getTime() < freno
  ) {
    return fila;
  }
  // Un alta que falló no cambia sola: el dueño tiene que repetirla.
  if (fila.estado === "fallido") return fila;

  const cambios: Partial<WhatsappNumeroNegocio> = { consultadoAt: ahora };
  try {
    if (fila.estado === "registrando" && fila.signupId) {
      const sesion = await whatsappAdapter.estadoDeAlta(fila.signupId);
      if (sesion.status === "FAILURE") {
        cambios.estado = "fallido";
        cambios.errores = sesion.errores;
        console.error(
          `[WhatsApp] Falló el alta en coexistencia del negocio ${fila.businessId} (sesión ${fila.signupId}, paso ${sesion.state ?? "?"}): ${sesion.errores.join("; ") || "sin motivo"}`
        );
      }
    }
    if (cambios.estado !== "fallido") {
      const numero = await whatsappAdapter.numeroPorIdDeMeta(
        fila.metaPhoneNumberId
      );
      if (numero) {
        const estado = numero.coexistenceState ?? "pending_onboarding";
        cambios.phoneNumber = numero.phoneNumber;
        cambios.syncDeadline = numero.syncDeadline;
        cambios.estado = estado;
        if (estado === "active" && !fila.conectadoAt) {
          cambios.conectadoAt = ahora;
        }
        if (estado !== fila.estado) {
          console.log(
            `[WhatsApp] El WhatsApp propio del negocio ${fila.businessId} pasa de ${fila.estado} a ${estado}`
          );
        }
      }
    }
  } catch (error) {
    console.error(
      `[WhatsApp] No se pudo refrescar el WhatsApp propio del negocio ${fila.businessId}: ${errorMessage(error)}`
    );
  }
  try {
    return await prisma.whatsappNumeroNegocio.update({
      where: { id: fila.id },
      data: cambios,
    });
  } catch (error) {
    // Otro negocio ya tiene ese E.164 (no debería: el `phone_number_id`
    // es único): se guarda el resto y se deja ruido en el log.
    console.error(
      `[WhatsApp] No se pudo guardar el estado del WhatsApp propio del negocio ${fila.businessId}: ${errorMessage(error)}`
    );
    return fila;
  }
}

export async function estadoWhatsappPropio(
  businessId: string
): Promise<EstadoWhatsappPropio> {
  const datos = await datosDelAlta();
  const fila = await prisma.whatsappNumeroNegocio.findUnique({
    where: { businessId },
  });
  // Con el interruptor apagado no se pregunta a Telnyx, pero si hubo una
  // conexión se sigue enseñando lo último que se supo.
  const actual =
    fila && whatsappPropioEncendido() ? await refrescarConexion(fila) : fila;
  return {
    disponible: "alta" in datos,
    motivo: "motivo" in datos ? datos.motivo : null,
    alta: "alta" in datos ? datos.alta : null,
    conexion: actual ? aConexion(actual) : null,
  };
}

/**
 * Registra en Telnyx lo que devolvió el alta de Meta. El negocio sale
 * siempre del JWT; `wabaId` y `phoneNumberId` vienen del navegador y solo
 * sirven para que Telnyx dé de alta ese WABA, que Meta ya ha puesto en
 * nuestra solución con el consentimiento del dueño.
 */
export async function registrarWhatsappPropio(
  businessId: string,
  input: { wabaId: string; phoneNumberId: string }
): Promise<ResultadoDelRegistro> {
  const datos = await datosDelAlta();
  if ("motivo" in datos) {
    return { outcome: "no_disponible", motivo: datos.motivo };
  }

  const [propia, delNumero, deAlhabla] = await Promise.all([
    prisma.whatsappNumeroNegocio.findUnique({ where: { businessId } }),
    prisma.whatsappNumeroNegocio.findUnique({
      where: { metaPhoneNumberId: input.phoneNumberId },
    }),
    prisma.whatsappSender.findFirst({
      where: { metaPhoneNumberId: input.phoneNumberId },
      select: { id: true },
    }),
  ]);
  if (deAlhabla || (delNumero && delNumero.businessId !== businessId)) {
    return { outcome: "numero_ocupado" };
  }
  if (propia?.estado === "active") return { outcome: "ya_conectado" };

  let sesion: { sessionId: string | null; status: string | null };
  try {
    sesion = await whatsappAdapter.registrarAltaEnCoexistencia({
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      appId: datos.alta.appId,
      customerId: businessId,
    });
  } catch (error) {
    const mensaje = errorMessage(error);
    console.error(
      `[WhatsApp] Telnyx no aceptó el alta en coexistencia del negocio ${businessId} (WABA ${input.wabaId}): ${mensaje}`
    );
    return { outcome: "error_de_telnyx", mensaje };
  }

  const datosDeLaFila = {
    metaPhoneNumberId: input.phoneNumberId,
    metaWabaId: input.wabaId,
    signupId: sesion.sessionId,
    estado: sesion.status === "FAILURE" ? "fallido" : "registrando",
    errores: [],
    phoneNumber: null,
    syncDeadline: null,
    consultadoAt: null,
    conectadoAt: null,
  };
  const fila = await prisma.whatsappNumeroNegocio.upsert({
    where: { businessId },
    create: { businessId, ...datosDeLaFila },
    update: datosDeLaFila,
  });
  console.log(
    `[WhatsApp] Alta en coexistencia registrada para el negocio ${businessId} (WABA ${input.wabaId}, sesión ${sesion.sessionId ?? "?"}, ${sesion.status ?? "sin estado"})`
  );

  return {
    outcome: "registrado",
    estado: {
      disponible: true,
      motivo: null,
      alta: datos.alta,
      conexion: aConexion(fila),
    },
  };
}
