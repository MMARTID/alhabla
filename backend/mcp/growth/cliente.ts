import { censurar, type Credenciales } from "./credenciales.js";

/**
 * Cliente HTTP del MCP `alhabla-growth`. Solo habla con `/growth/agente/*`:
 * la API de administración del panel no existe para este proceso, ni el token
 * que lleva la abre. La guarda está aquí (y no en cada herramienta) para que
 * ninguna herramienta nueva pueda saltársela por descuido.
 */

export const PREFIJO_DE_RUTAS = "/growth/agente/";

const METODOS_PERMITIDOS = ["GET", "POST", "PUT"] as const;
export type Metodo = (typeof METODOS_PERMITIDOS)[number];

const TIMEOUT_DE_LECTURA_MS = 30_000;
/** El primer POST a Cloud Run puede tardar por el arranque en frío. */
const TIMEOUT_DE_ESCRITURA_MS = 60_000;
const ESPERAS_DE_REINTENTO_MS = [1_000, 3_000];
const ESPERA_MAXIMA_POR_RETRY_AFTER_MS = 15_000;
const TAMANO_MAXIMO_DE_RESPUESTA = 2_000_000;

/**
 * Qué hacer ante un 409 con código. Se añade al mensaje del backend para que
 * el modelo no se quede con un «Conflicto» a secas ni insista: ninguno de estos
 * se arregla repitiendo la misma llamada.
 */
export const AYUDA_POR_CODIGO_409: Readonly<Record<string, string>> = {
  pausa:
    "No reintentes: mientras dure la pausa no se admite ninguna escritura hasta que el fundador la quite en el panel. Avisa y termina el run (cerrar_ejecucion sí se admite).",
  ya_calificada:
    "No sigas intentando recalificarla: mira cómo está ahora con ver_oportunidad y continúa con el siguiente paso (guardar_investigacion) o, si la calificación estaba mal, descártala con descartar_oportunidad.",
  cierres_masivos:
    "El servidor frenó la sincronización porque cerraría de golpe demasiadas afirmaciones vigentes (guarda de cierres masivos). Suele ser un repo atrasado o un extractor roto, no un cambio real. No la reintentes ni intentes forzarla (forzar es cosa de un administrador): avisa al fundador.",
  prohibida_debilitada:
    "El servidor rechazó la sincronización porque quitaría o debilitaría términos prohibidos de las reglas duras de cumplimiento: una sincronización no puede reducir las prohibiciones. No la reintentes: avisa al fundador para que revise growth/agentes/reglas/afirmaciones-prohibidas.md y el extractor.",
};

export type ValorDeConsulta =
  string | number | boolean | readonly string[] | undefined;

export type OpcionesDePeticion = {
  cuerpo?: unknown;
  consulta?: Record<string, ValorDeConsulta>;
  /**
   * `true` si repetir la petición no duplica nada (GET, crear por URL, cambiar
   * a un estado en el que ya está…). Solo entonces se reintenta ante un fallo
   * de red, un 429 o un 5xx. Por defecto, no.
   */
  idempotente?: boolean;
  timeoutMs?: number;
};

export type RespuestaDeGrowth<T = unknown> = { status: number; datos: T };

export type ClienteDeGrowth = {
  peticion<T = unknown>(
    metodo: Metodo,
    ruta: string,
    opciones?: OpcionesDePeticion
  ): Promise<RespuestaDeGrowth<T>>;
};

/** Un fallo de la API o del camino hasta ella, con un mensaje listo para el modelo. */
export class ErrorDeGrowthApi extends Error {
  constructor(
    mensaje: string,
    readonly detalles: {
      /** `null` si ni siquiera hubo respuesta (red, tiempo agotado). */
      status: number | null;
      codigo?: string;
      /** El motivo que dio el backend, ya censurado y acotado (sin la ayuda del cliente). */
      detalle?: string;
      /** El cuerpo de la respuesta de error tal cual lo mandó el backend (para quien deba explicarlo). */
      cuerpo?: unknown;
      /**
       * `true` si la petición pudo llegar a aplicarse aunque falle (red caída
       * o 5xx en algo que no se reintenta): hay que mirar antes de repetir.
       */
      puedeHaberSeAplicado: boolean;
    }
  ) {
    super(mensaje);
    this.name = "ErrorDeGrowthApi";
  }
  get status(): number | null {
    return this.detalles.status;
  }
  get codigo(): string | undefined {
    return this.detalles.codigo;
  }
}

/** Rechaza todo lo que no sea una ruta de `/growth/agente/` sin trucos. */
export function validarRuta(ruta: string): void {
  const sospechosa =
    !ruta.startsWith(PREFIJO_DE_RUTAS) ||
    ruta.includes("..") ||
    ruta.includes("\\") ||
    ruta.includes("?") ||
    ruta.includes("#") ||
    ruta.includes("//") ||
    /%(2e|2f|5c|3f|23|00)/i.test(ruta) ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f\s]/.test(ruta);
  if (sospechosa) {
    throw new Error(
      `[MCP] Ruta no permitida: este MCP solo habla con ${PREFIJO_DE_RUTAS}*.`
    );
  }
}

function construirUrl(
  base: string,
  ruta: string,
  consulta: OpcionesDePeticion["consulta"]
): string {
  validarRuta(ruta);
  const url = new URL(base + ruta);
  // Segunda comprobación sobre la URL ya resuelta: el origen no cambia y la
  // ruta sigue bajo /growth/agente/.
  if (url.origin !== base || !url.pathname.startsWith(PREFIJO_DE_RUTAS)) {
    throw new Error(
      `[MCP] Ruta no permitida: este MCP solo habla con ${PREFIJO_DE_RUTAS}*.`
    );
  }
  for (const [nombre, valor] of Object.entries(consulta ?? {})) {
    if (valor === undefined) continue;
    url.searchParams.set(
      nombre,
      Array.isArray(valor) ? valor.join(",") : String(valor)
    );
  }
  return url.toString();
}

type CuerpoDeError = { error?: unknown; codigo?: unknown };

function leerJson(texto: string): unknown {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/** `{ error: ZodIssue[] }` → «campo: mensaje; …»; `{ error: string }` → el texto. */
function detalleDelCuerpo(cuerpo: unknown): string {
  if (!cuerpo || typeof cuerpo !== "object") return "";
  const { error, message } = cuerpo as CuerpoDeError & { message?: unknown };
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    return error
      .slice(0, 10)
      .map((issue) => {
        const i = issue as { path?: unknown; message?: unknown };
        const campo = Array.isArray(i.path) ? i.path.join(".") : "";
        return `${campo || "(cuerpo)"}: ${String(i.message ?? "no válido")}`;
      })
      .join("; ");
  }
  return typeof message === "string" ? message : "";
}

function recortar(texto: string, maximo: number): string {
  return texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto;
}

export function errorDeRespuesta(
  status: number,
  cuerpo: unknown,
  opciones: { host: string; idempotente: boolean }
): ErrorDeGrowthApi {
  const detalle = censurar(recortar(detalleDelCuerpo(cuerpo), 600));
  const codigo =
    cuerpo &&
    typeof cuerpo === "object" &&
    typeof (cuerpo as CuerpoDeError).codigo === "string"
      ? ((cuerpo as { codigo: string }).codigo as string)
      : undefined;
  const conCodigo = codigo ? ` (código: ${codigo})` : "";

  let mensaje: string;
  if (status === 400) {
    mensaje = `La API rechazó los datos: ${detalle || "petición no válida"}.`;
  } else if (status === 401) {
    mensaje =
      "Token de agente no válido o revocado (HTTP 401). Crea otro con el script de tokens y guárdalo en el llavero (te pide el valor por terminal): " +
      `security add-generic-password -s alhabla-growth -a ${opciones.host} -U -w`;
  } else if (status === 403) {
    mensaje = `Sin permiso (HTTP 403): ${detalle || "el token no tiene el alcance necesario"}`;
  } else if (status === 404) {
    mensaje = `No existe (HTTP 404): ${detalle || "ruta o recurso"}`;
  } else if (status === 409) {
    const ayuda = codigo ? AYUDA_POR_CODIGO_409[codigo] : undefined;
    const motivo = detalle || "el estado actual no lo permite";
    mensaje = `Conflicto (HTTP 409)${conCodigo}: ${motivo}${/[.!?]$/.test(motivo) ? "" : "."}${ayuda ? ` ${ayuda}` : ""}`;
  } else if (status === 429) {
    mensaje =
      "La API limita las peticiones (HTTP 429): espera un minuto antes de seguir.";
  } else if (status >= 500) {
    mensaje = `La API de Growth falló (HTTP ${status})${detalle ? `: ${detalle}` : ""}.`;
  } else {
    mensaje = `Respuesta inesperada de la API (HTTP ${status})${detalle ? `: ${detalle}` : ""}.`;
  }

  // Un 5xx en algo que no se reintenta puede haberse aplicado igualmente.
  const puedeHaberSeAplicado = status >= 500 && !opciones.idempotente;
  if (puedeHaberSeAplicado) {
    mensaje +=
      " No se sabe si se llegó a aplicar: compruébalo (ver_oportunidad o listar_oportunidades) antes de repetirlo.";
  }
  return new ErrorDeGrowthApi(mensaje, {
    status,
    codigo,
    detalle: detalle || undefined,
    cuerpo,
    puedeHaberSeAplicado,
  });
}

export type OpcionesDeCliente = {
  credenciales: Credenciales;
  fetchFn?: typeof fetch;
  /** Para los tests: no esperar de verdad entre reintentos. */
  esperar?: (ms: number) => Promise<void>;
  esperasDeReintento?: readonly number[];
};

const esperarDeVerdad = (ms: number) =>
  new Promise<void>((resolver) => setTimeout(resolver, ms));

/** Suelta el cuerpo de una respuesta que no se va a leer (evita conexiones colgadas). */
async function descartarCuerpo(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    // Ya estaba consumido o cerrado.
  }
}

function esperaPorRetryAfter(res: Response): number {
  const valor = res.headers.get("retry-after");
  const segundos = valor ? Number(valor) : NaN;
  return Number.isFinite(segundos) && segundos > 0
    ? Math.min(segundos * 1000, ESPERA_MAXIMA_POR_RETRY_AFTER_MS)
    : 0;
}

export function crearClienteDeGrowth(
  opciones: OpcionesDeCliente
): ClienteDeGrowth {
  const { credenciales } = opciones;
  const fetchFn = opciones.fetchFn ?? fetch;
  const esperar = opciones.esperar ?? esperarDeVerdad;
  const esperas = opciones.esperasDeReintento ?? ESPERAS_DE_REINTENTO_MS;

  // Las peticiones van de una en una: el presupuesto de conexiones de
  // Cloud SQL (maxScale 11, 4 por instancia) no admite ráfagas de un agente
  // que pregunta en paralelo, y el límite global es de 100 por minuto.
  let cola: Promise<unknown> = Promise.resolve();
  function enCola<T>(trabajo: () => Promise<T>): Promise<T> {
    const resultado = cola.then(trabajo, trabajo);
    cola = resultado.catch(() => undefined);
    return resultado;
  }

  async function enviar(
    metodo: Metodo,
    ruta: string,
    opcionesDePeticion: OpcionesDePeticion
  ): Promise<RespuestaDeGrowth> {
    if (!METODOS_PERMITIDOS.includes(metodo)) {
      throw new Error(`[MCP] Método no permitido: ${String(metodo)}.`);
    }
    const destino = credenciales.destino();
    const url = construirUrl(destino.base, ruta, opcionesDePeticion.consulta);
    const idempotente =
      metodo === "GET" || opcionesDePeticion.idempotente === true;
    const timeoutMs =
      opcionesDePeticion.timeoutMs ??
      (metodo === "GET" ? TIMEOUT_DE_LECTURA_MS : TIMEOUT_DE_ESCRITURA_MS);
    const cuerpo =
      metodo === "GET"
        ? undefined
        : // Fastify 5 devuelve 400 a un POST con content-type JSON y cuerpo vacío.
          JSON.stringify(opcionesDePeticion.cuerpo ?? {});

    let tokenUsado = (await credenciales.token()).valor;
    let reintentosDeToken = 0;
    const maximoDeIntentos = idempotente ? 1 + esperas.length : 1;

    for (let intento = 1; ; intento++) {
      let res: Response;
      try {
        res = await fetchFn(url, {
          method: metodo,
          headers: {
            Authorization: `Bearer ${tokenUsado}`,
            Accept: "application/json",
            "User-Agent": "alhabla-growth-mcp/1.0",
            ...(cuerpo !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
          },
          body: cuerpo,
          // Nunca se sigue una redirección: la cabecera con el token no sale
          // hacia donde no se ha comprobado.
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (intento < maximoDeIntentos) {
          await esperar(esperas[intento - 1] ?? 0);
          continue;
        }
        const agotado =
          error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError");
        throw new ErrorDeGrowthApi(
          `${agotado ? "La API no respondió a tiempo" : "No responde"} ${destino.base}.` +
            (idempotente
              ? ""
              : " No se sabe si se llegó a aplicar: compruébalo (ver_oportunidad o listar_oportunidades) antes de repetirlo."),
          { status: null, puedeHaberSeAplicado: !idempotente }
        );
      }

      // Un 401 no aplica nada: se relee el token (quizá se rotó) y, si es
      // otro distinto, se repite una vez aunque la petición no sea idempotente.
      if (res.status === 401 && reintentosDeToken === 0) {
        reintentosDeToken++;
        credenciales.invalidar();
        const nuevo = await credenciales
          .token()
          .then((t) => t.valor)
          .catch(() => tokenUsado);
        if (nuevo !== tokenUsado) {
          tokenUsado = nuevo;
          await descartarCuerpo(res);
          intento--;
          continue;
        }
      }

      const reintentable = res.status === 429 || res.status >= 500;
      if (reintentable && intento < maximoDeIntentos) {
        await descartarCuerpo(res);
        await esperar(
          Math.max(esperas[intento - 1] ?? 0, esperaPorRetryAfter(res))
        );
        continue;
      }

      if (res.status >= 200 && res.status < 300) {
        const texto = await res.text();
        if (texto.length > TAMANO_MAXIMO_DE_RESPUESTA) {
          throw new ErrorDeGrowthApi(
            "La respuesta de la API es demasiado grande.",
            { status: res.status, puedeHaberSeAplicado: false }
          );
        }
        return { status: res.status, datos: leerJson(texto) };
      }
      if (res.status >= 300 && res.status < 400) {
        throw new ErrorDeGrowthApi(
          `La API respondió con una redirección (HTTP ${res.status}) y no se sigue.`,
          { status: res.status, puedeHaberSeAplicado: false }
        );
      }
      const texto = await res.text().catch(() => "");
      throw errorDeRespuesta(res.status, leerJson(texto), {
        host: destino.host,
        idempotente,
      });
    }
  }

  return {
    async peticion<T>(
      metodo: Metodo,
      ruta: string,
      opcionesDePeticion: OpcionesDePeticion = {}
    ): Promise<RespuestaDeGrowth<T>> {
      // La guarda de la ruta falla ANTES de entrar en la cola y sin leer el token.
      validarRuta(ruta);
      return enCola(() => enviar(metodo, ruta, opcionesDePeticion)) as Promise<
        RespuestaDeGrowth<T>
      >;
    },
  };
}
