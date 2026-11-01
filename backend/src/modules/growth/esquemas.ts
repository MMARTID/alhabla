import { z } from "zod";
import {
  NOMBRES_DE_REGLAS_BLANDAS,
  NOMBRES_DE_REGLAS_DURAS,
  TOPE_SEMANAL_POR_DEFECTO,
  UMBRAL_DE_SIMILITUD_POR_DEFECTO,
  contieneCorreo,
  contieneTelefono,
} from "./cumplimiento.js";

export type { Comprobacion, ResultadoDeCumplimiento } from "./cumplimiento.js";

/**
 * Todos los esquemas de entrada de Alhabla Growth, en un solo sitio. Los usan
 * el servidor (rutas), el MCP `alhabla-growth` (construye sus `inputSchema`
 * con `.shape`/`.omit()`) y el dashboard: una sola verdad para que ninguno se
 * desfase. Este módulo es PURO (sin Prisma ni Fastify) para que el MCP pueda
 * importarlo sin abrir una conexión.
 *
 * Convención: cada esquema `Xxx` exporta también el tipo `Xxx` (lo que
 * devuelve `z.infer`). Los que llevan validaciones cruzadas son un
 * `ZodEffects`: su versión sin ellas, para poder usar `.shape`, se llama
 * `XxxBase`.
 */

// ── Catálogos ────────────────────────────────────────────────────────────

export const OBJETIVOS = ["TRAFICO_MARCA", "LEADS", "BACKLINKS"] as const;
export type Objetivo = (typeof OBJETIVOS)[number];

export const ESTADOS_DE_OPORTUNIDAD = [
  "detectada",
  "calificada",
  "investigada",
  "con_borrador",
  "pendiente_aprobacion",
  "aprobada",
  "gestionada",
  "conseguida",
  "sin_respuesta",
  "devuelta",
  "bloqueada",
  "descartada",
  "caducada",
] as const;

export const ESTADOS_DE_BORRADOR = [
  "borrador",
  "bloqueado",
  "pendiente_aprobacion",
  "aprobado",
  "gestionado",
  "descartado",
] as const;

export const TIPOS_DE_BORRADOR = [
  "email",
  "formulario",
  "ficha_directorio",
  "texto_invitado",
] as const;

export const TIPOS_DE_AFIRMACION = [
  "precio",
  "funcion",
  "limite",
  "sector",
  "comparativa",
  "pagina",
  "prohibida",
] as const;
export type TipoDeAfirmacion = (typeof TIPOS_DE_AFIRMACION)[number];

/** Por qué se descarta una oportunidad; vive en `datos.codigoDescarte`. */
export const CODIGOS_DE_DESCARTE = [
  "no_viva",
  "idioma",
  "irrelevante",
  "competidor",
  "dominio_propio",
  "baja_calidad",
  "contenido_ilegal",
  "duplicada",
  "bajo_umbral",
  "dominio_en_enfriamiento",
  "manual",
  "otro",
] as const;
export const CodigoDescarte = z.enum(CODIGOS_DE_DESCARTE);
export type CodigoDescarte = z.infer<typeof CodigoDescarte>;

export const CANALES_DE_GESTION = [
  "email",
  "formulario",
  "alta_directorio",
  "otro",
] as const;

export const RESULTADOS_DE_GESTION = [
  "pendiente",
  "aceptado",
  "rechazado",
  "sin_respuesta",
] as const;

export const TIPOS_DE_DESTINO = [
  "comparativa",
  "directorio",
  "prensa",
  "asociacion",
  "mencion_sin_enlace",
  "otro",
] as const;
export const ENLACES_ESPERADOS = [
  "dofollow",
  "nofollow",
  "ugc",
  "sponsored",
  "desconocido",
] as const;
export const DIFICULTADES = ["baja", "media", "alta"] as const;

/** Cuántos competidores puede mencionar una misma oportunidad. */
export const MAXIMO_DE_COMPETIDORES_MENCIONADOS = 10;
export const VIAS_DE_CONTACTO = [
  "formulario",
  "email_editorial",
  "alta_directorio",
] as const;

/** Fuentes que el agente puede usar al crear; `manual` es solo del administrador. */
export const FUENTES_DEL_AGENTE = ["web", "directorio"] as const;
export const TIPOS_DE_FUENTE = ["web", "directorio", "manual"] as const;

export const DISPARADORES_DE_EJECUCION = ["programada", "manual"] as const;
export const ESTADOS_DE_CIERRE_DE_EJECUCION = [
  "ok",
  "parcial",
  "error",
] as const;
export const ESTADOS_DE_EJECUCION = [
  "en_curso",
  ...ESTADOS_DE_CIERRE_DE_EJECUCION,
] as const;

/** Resultado de la revisión que añade el modelo: solo consultiva. */
export const RESULTADOS_DE_REVISION_LLM = ["pasa", "aviso"] as const;

// ── Ajustes ──────────────────────────────────────────────────────────────

export const LIMITES_DE_AJUSTES = {
  topeSemanal: [0, 20],
  umbralDeSimilitud: [0.4, 0.9],
  umbralesPorObjetivo: [0, 100],
} as const;

/**
 * Valores iniciales de `growth_ajustes` (decisión 3 de la 1b). Los umbrales
 * por objetivo (60) no están medidos: se calibran con los descartes de las
 * primeras semanas.
 */
export const AJUSTES_POR_DEFECTO = {
  topeSemanal: TOPE_SEMANAL_POR_DEFECTO,
  umbralDeSimilitud: UMBRAL_DE_SIMILITUD_POR_DEFECTO,
  umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
  pausa: false,
} as const;

/** Las claves `sistema.*` las escribe el backend, no se editan por la API. */
export const PREFIJO_DE_CLAVES_DE_SISTEMA = "sistema.";
export function esClaveDeSistema(clave: string): boolean {
  return clave.startsWith(PREFIJO_DE_CLAVES_DE_SISTEMA);
}

// ── Piezas comunes ───────────────────────────────────────────────────────

/** Respuesta paginada de los listados (página + límite con total). */
export type Pagina<T> = {
  data: T[];
  total: number;
  pagina: number;
  limite: number;
};

/** Un sustituto UTF-16 alto sin bajo detrás, o un bajo sin alto delante. */
const SUSTITUTO_SUELTO =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * JSON admite `\u0000` y los sustitutos UTF-16 sueltos (un emoji partido);
 * Postgres no admite el NUL en ningún texto y Prisma rechaza el unicode roto.
 * Sin esta guarda llegan a la base y salen como un 500 en vez de un 400.
 */
export function esTextoBienFormado(valor: string): boolean {
  return !valor.includes("\u0000") && !SUSTITUTO_SUELTO.test(valor);
}

export const MENSAJE_DE_TEXTO_NO_VALIDO =
  "El texto contiene caracteres no válidos (el carácter nulo o unicode mal formado).";

/**
 * El refinamiento común de todo texto libre (título, extracto, motivo,
 * búsqueda, notas, resumen…): rechaza NUL y sustitutos sueltos con un 400.
 * Va AL FINAL de la cadena (`sano(z.string().trim().max(300))`) porque el
 * resultado es un `ZodEffects` y ya no admite `.min()` ni `.trim()`.
 */
function sano<T extends z.ZodTypeAny>(
  esquema: T
): z.ZodEffects<T, z.output<T>, z.input<T>> {
  return esquema.refine(
    (valor: unknown) => typeof valor !== "string" || esTextoBienFormado(valor),
    MENSAJE_DE_TEXTO_NO_VALIDO
  );
}
export { sano as textoSano };

/** ¿Alguna cadena (o clave) de este valor JSON está mal formada? Sin recursión: no revienta con anidamientos profundos. */
function contieneTextoMalFormado(valor: unknown): boolean {
  const pila: unknown[] = [valor];
  while (pila.length > 0) {
    const actual = pila.pop();
    if (typeof actual === "string") {
      if (!esTextoBienFormado(actual)) return true;
    } else if (Array.isArray(actual)) {
      pila.push(...actual);
    } else if (actual && typeof actual === "object") {
      for (const [clave, hijo] of Object.entries(actual)) {
        if (!esTextoBienFormado(clave)) return true;
        pila.push(hijo);
      }
    }
  }
  return false;
}

function esUrlHttp(valor: string): boolean {
  try {
    const url = new URL(valor);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      // `https://alhabla.ai@sitio-malo.com` parece de Alhabla y no lo es.
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

/**
 * Toda URL que entra en Growth. `z.string().url()` solo exige que `new URL()`
 * la entienda, y entiende `javascript:alert(1)` y `data:text/html,…`: una
 * `enlaceUrl` escrita por un agente que ha leído una página hostil acabaría
 * en un `<a href>` del dashboard. Solo http y https, sin credenciales.
 */
export const urlHttp = sano(z.string().trim().url().max(2000)).refine(
  esUrlHttp,
  "La URL debe ser http o https y sin usuario ni contraseña."
);

const HOST =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** `www.HeyDiga.AI ` → `heydiga.ai`: hostname en minúsculas, sin `www`. */
export const dominioNormalizado = z
  .string()
  .trim()
  .toLowerCase()
  .transform((d) => d.replace(/^www\./, ""))
  .pipe(
    z
      .string()
      .max(253)
      .regex(HOST, "Indica solo el dominio (por ejemplo, ejemplo.com).")
  );

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const slug = z
  .string()
  .min(1)
  .max(80)
  .regex(SLUG, "Slug en minúsculas.");

const idDe = sano(z.string().min(1).max(100));

const puntuacion = z.number().int().min(0).max(100);

const COMMIT_SHA = /^[0-9a-f]{7,40}$/;

const LIMITE_DE_JSON_EN_BYTES = 8 * 1024;

function bytesDe(valor: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(valor) ?? "", "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Un objeto JSON libre con tope de tamaño serializado y sin texto mal
 * formado en ninguna cadena ni clave (Postgres no guarda el NUL ni el unicode
 * roto en un `jsonb`).
 */
function objetoJson(maximoEnBytes = LIMITE_DE_JSON_EN_BYTES) {
  return z
    .record(z.unknown())
    .refine(
      (v) => bytesDe(v) <= maximoEnBytes,
      `El objeto ocupa más de ${Math.round(maximoEnBytes / 1024)} KB.`
    )
    .refine((v) => !contieneTextoMalFormado(v), MENSAJE_DE_TEXTO_NO_VALIDO);
}

// ── Fechas de vencimiento (`expiraEn`) ───────────────────────────────────

const ZONA_DE_NEGOCIO = "Europe/Madrid";
const FECHA_SOLA = /^(\d{4})-(\d{2})-(\d{2})$/;
const FECHA_CON_HORA_Y_ZONA =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const FORMATO_EN_MADRID = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_DE_NEGOCIO,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** Cuántos ms hay que sumar a un instante UTC para ver la hora de pared de Madrid. */
function desfaseDeMadrid(instanteEnMs: number): number {
  const partes = Object.fromEntries(
    FORMATO_EN_MADRID.formatToParts(new Date(instanteEnMs)).map((p) => [
      p.type,
      Number(p.value),
    ])
  ) as Record<string, number>;
  const comoSiFueraUtc = Date.UTC(
    partes.year ?? 0,
    (partes.month ?? 1) - 1,
    partes.day ?? 1,
    partes.hour ?? 0,
    partes.minute ?? 0,
    partes.second ?? 0
  );
  return comoSiFueraUtc - Math.floor(instanteEnMs / 1000) * 1000;
}

/** 23:59:59.999 del día pedido, hora de Madrid (con su horario de verano). */
export function finDelDiaEnMadrid(
  anio: number,
  mes: number,
  dia: number
): Date {
  const comoSiFueraUtc = Date.UTC(anio, mes - 1, dia, 23, 59, 59, 999);
  // Dos pasadas: el desfase de un día se conoce por el instante, que a su vez
  // depende del desfase. Los cambios de hora son de madrugada, así que a las
  // 23:59 converge a la segunda.
  const primera = comoSiFueraUtc - desfaseDeMadrid(comoSiFueraUtc);
  return new Date(comoSiFueraUtc - desfaseDeMadrid(primera));
}

/**
 * La fecha de vencimiento que significa un texto, o `null` si no es ISO 8601:
 *
 * - `2026-11-05` (fecha sola): el FINAL de ese día en Europe/Madrid
 *   (23:59:59.999 hora de Madrid). «Vence el 5» quiere decir que el 5 sigue
 *   valiendo; `new Date("2026-11-05")` sería el 5 a las 00:00 UTC y caducaría
 *   antes de empezar el día.
 * - `2026-11-05T10:00:00Z` o `…+01:00` (fecha y hora): exige la zona. Una hora
 *   sin zona dependería de la zona del servidor.
 * - Cualquier otra cosa (`5 nov`, `1762300800000`, `2026-11-05T10:00`): no.
 */
export function fechaDeVencimiento(texto: string): Date | null {
  const sola = FECHA_SOLA.exec(texto);
  if (sola) {
    const [anio, mes, dia] = [
      Number(sola[1]),
      Number(sola[2]),
      Number(sola[3]),
    ];
    const real = new Date(Date.UTC(anio, mes - 1, dia));
    // `2026-02-30` no existe: `Date.UTC` lo desborda a marzo.
    if (
      real.getUTCFullYear() !== anio ||
      real.getUTCMonth() !== mes - 1 ||
      real.getUTCDate() !== dia
    ) {
      return null;
    }
    return finDelDiaEnMadrid(anio, mes, dia);
  }
  if (!FECHA_CON_HORA_Y_ZONA.test(texto)) return null;
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Una fecha de vencimiento que aún no ha llegado (para `expiraEn`). Ver `fechaDeVencimiento`. */
const fechaFutura = z
  .string()
  .trim()
  .max(40)
  .transform((texto, ctx) => {
    const fecha = fechaDeVencimiento(texto);
    if (!fecha) {
      ctx.addIssue({
        code: "custom",
        message:
          "Usa una fecha ISO 8601: 2026-11-05 (vale hasta el final de ese día, hora de Madrid) o 2026-11-05T10:00:00Z (con zona).",
      });
      return z.NEVER;
    }
    if (fecha.getTime() <= Date.now()) {
      ctx.addIssue({ code: "custom", message: "La fecha debe ser futura." });
      return z.NEVER;
    }
    return fecha;
  });

/** `?x=true|false|1|0` → boolean (`z.coerce.boolean()` daría true a «false»). */
export const booleanoDeConsulta = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

/** `?estado=a,b` o `?estado=a&estado=b` → `["a", "b"]`, solo valores válidos. */
function listaDe<const T extends readonly [string, ...string[]]>(valores: T) {
  return z
    .union([z.string(), z.array(z.string())])
    .transform((v) => [
      ...new Set(
        (Array.isArray(v) ? v : [v])
          .flatMap((x) => x.split(","))
          .map((x) => x.trim())
          .filter(Boolean)
      ),
    ])
    .pipe(z.array(z.enum(valores)).min(1).max(valores.length));
}

export const IdParams = z.object({ id: idDe });
export type IdParams = z.infer<typeof IdParams>;

export const ClaveParams = z.object({
  clave: sano(z.string().min(1).max(120)),
});

/** `?pagina=2&limite=50`. */
export const Paginacion = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});
export type Paginacion = z.infer<typeof Paginacion>;

// ── Oportunidades ────────────────────────────────────────────────────────

/** Lo que pueden escribir agente y administrador en `datos` (el resto lo añade el backend). */
export const DatosDeOportunidad = z
  .object({
    tipoDestino: z.enum(TIPOS_DE_DESTINO).optional(),
    enlaceEsperado: z.enum(ENLACES_ESPERADOS).optional(),
    dificultad: z.enum(DIFICULTADES).optional(),
    nota: sano(z.string().trim().max(500)).optional(),
    /**
     * Dominios de los competidores que esa página menciona o lista (por
     * ejemplo, un «mejores recepcionistas de IA» que cita a HeyDiga). El
     * backend los normaliza y comprueba que existan (y no sean `propuesto`).
     */
    competidoresMencionados: z
      .array(dominioNormalizado)
      .max(MAXIMO_DE_COMPETIDORES_MENCIONADOS)
      .optional(),
  })
  .strict();
export type DatosDeOportunidad = z.infer<typeof DatosDeOportunidad>;

const PuntuacionesBody = {
  puntTrafico: puntuacion.optional(),
  puntLeads: puntuacion.optional(),
  puntBacklinks: puntuacion.optional(),
};

/** Crear una oportunidad (agente). */
export const OportunidadBaseBody = z.object({
  fuenteId: idDe.optional(),
  fuenteTipo: z.enum(FUENTES_DEL_AGENTE).optional(),
  nichoId: idDe.optional(),
  nichoSlug: slug.optional(),
  url: urlHttp,
  titulo: sano(z.string().trim().min(1).max(300)),
  extracto: sano(z.string().trim().min(1).max(2000)),
  idioma: sano(z.string().min(2).max(10)).optional(),
  objetivoPrincipal: z.enum(OBJETIVOS),
  ...PuntuacionesBody,
  datos: DatosDeOportunidad.optional(),
  expiraEn: fechaFutura.optional(),
  ejecucionId: idDe.optional(),
});
export const OportunidadBody = OportunidadBaseBody.superRefine((v, ctx) => {
  if (v.fuenteId && v.fuenteTipo) {
    ctx.addIssue({
      code: "custom",
      path: ["fuenteTipo"],
      message: "Indica fuenteId o fuenteTipo, no los dos.",
    });
  }
  if (v.nichoId && v.nichoSlug) {
    ctx.addIssue({
      code: "custom",
      path: ["nichoSlug"],
      message: "Indica nichoId o nichoSlug, no los dos.",
    });
  }
});
export type OportunidadBody = z.infer<typeof OportunidadBody>;

/** Añadir una URL a mano (administrador). */
export const OportunidadManualBody = z
  .object({
    url: urlHttp,
    objetivoPrincipal: z.enum(OBJETIVOS).default("BACKLINKS"),
    titulo: sano(z.string().trim().min(1).max(300)).optional(),
    nota: sano(z.string().trim().max(500)).optional(),
    nichoSlug: slug.optional(),
    expiraEn: fechaFutura.optional(),
  })
  .strict();
export type OportunidadManualBody = z.infer<typeof OportunidadManualBody>;

/** Lo que `Qualification` rellena al calificar o al investigar. */
export const CalificacionBody = z.object({
  objetivoPrincipal: z.enum(OBJETIVOS).optional(),
  ...PuntuacionesBody,
  nichoSlug: slug.optional(),
  idioma: sano(z.string().min(2).max(10)).optional(),
  titulo: sano(z.string().trim().min(1).max(300)).optional(),
  extracto: sano(z.string().trim().min(1).max(2000)).optional(),
  datos: DatosDeOportunidad.optional(),
  expiraEn: fechaFutura.optional(),
});
export type CalificacionBody = z.infer<typeof CalificacionBody>;

const CAMPOS_DE_CALIFICACION = Object.keys(CalificacionBody.shape);

/**
 * Cambio de estado del agente. Solo `calificada`, `investigada` y
 * `descartada`: el resto lo hace el backend o el administrador.
 */
export const EstadoBaseBody = z
  .object({
    a: z.enum(["calificada", "investigada", "descartada"]),
    motivo: sano(z.string().trim().min(1).max(500)).optional(),
    codigo: CodigoDescarte.optional(),
  })
  .merge(CalificacionBody);
export const EstadoBody = EstadoBaseBody.superRefine((v, ctx) => {
  if (v.a === "descartada" && !v.motivo) {
    ctx.addIssue({
      code: "custom",
      path: ["motivo"],
      message: "Descartar exige un motivo.",
    });
  }
  if (v.a !== "descartada" && v.codigo !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["codigo"],
      message: "El código de descarte solo se admite al descartar.",
    });
  }
  if (v.a === "descartada") {
    for (const campo of CAMPOS_DE_CALIFICACION) {
      if ((v as Record<string, unknown>)[campo] !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: [campo],
          message:
            "Las puntuaciones y los datos solo se admiten al calificar o investigar.",
        });
      }
    }
  }
});
export type EstadoBody = z.infer<typeof EstadoBody>;

// ── Investigación ────────────────────────────────────────────────────────

/** Todas las cadenas de un valor JSON (con tope de profundidad y de cantidad). */
function cadenasDe(valor: unknown, profundidad = 0, acumulado: string[] = []) {
  if (acumulado.length > 500 || profundidad > 6) return acumulado;
  if (typeof valor === "string") acumulado.push(valor);
  else if (Array.isArray(valor)) {
    for (const v of valor) cadenasDe(v, profundidad + 1, acumulado);
  } else if (valor && typeof valor === "object") {
    for (const v of Object.values(valor)) {
      cadenasDe(v, profundidad + 1, acumulado);
    }
  }
  return acumulado;
}

export const InvestigacionBaseBody = z.object({
  resumen: sano(z.string().trim().min(1).max(8000)),
  quienEdita: sano(z.string().trim().max(300)).optional(),
  viaDeContacto: z.enum(VIAS_DE_CONTACTO).optional(),
  /** Dónde contactar: un formulario o la página de altas. Va a `contexto.urlContacto`. */
  urlContacto: urlHttp.optional(),
  competidoresEnlazados: z
    .array(sano(z.string().max(200)))
    .max(50)
    .optional(),
  contexto: objetoJson().optional(),
});
export const InvestigacionBody = InvestigacionBaseBody.superRefine((v, ctx) => {
  if (v.contexto && "urlContacto" in v.contexto) {
    ctx.addIssue({
      code: "custom",
      path: ["contexto", "urlContacto"],
      message: "Usa el campo urlContacto, no contexto.urlContacto.",
    });
  }
  // Plan § 7: no se guardan nombres ni correos de personas. En la 1b no se
  // guarda ningún correo; el contacto es una URL.
  const textos = [
    v.resumen,
    v.quienEdita ?? "",
    ...(v.competidoresEnlazados ?? []),
    ...cadenasDe(v.contexto),
  ];
  if (textos.some(contieneCorreo)) {
    ctx.addIssue({
      code: "custom",
      path: ["resumen"],
      message:
        "La investigación no puede incluir correos: guarda la URL de contacto en urlContacto.",
    });
  }
  if (textos.some(contieneTelefono)) {
    ctx.addIssue({
      code: "custom",
      path: ["resumen"],
      message: "La investigación no puede incluir teléfonos.",
    });
  }
});
export type InvestigacionBody = z.infer<typeof InvestigacionBody>;

// ── Borradores ───────────────────────────────────────────────────────────

export const BorradorBody = z.object({
  tipo: z.enum(TIPOS_DE_BORRADOR),
  asunto: sano(z.string().trim().max(300)).optional(),
  texto: sano(z.string().trim().min(1).max(10000)),
  enlaceUrl: urlHttp.optional(),
  utm: objetoJson(2048).optional(),
  afirmaciones: z
    .array(sano(z.string().trim().min(1).max(200)))
    .max(50)
    .default([])
    .transform((claves) => [...new Set(claves)]),
});
export type BorradorBody = z.infer<typeof BorradorBody>;

/** Evaluar un borrador sin guardarlo (`evaluar_borrador` del MCP). */
export const EvaluarBorradorBody = BorradorBody.extend({
  oportunidadId: idDe,
});
export type EvaluarBorradorBody = z.infer<typeof EvaluarBorradorBody>;

const CAMPOS_EDITABLES_DE_BORRADOR = [
  "asunto",
  "texto",
  "enlaceUrl",
  "afirmaciones",
] as const;

/** Editar a mano un borrador (administrador). */
export const PatchBorradorBody = z
  .object({
    asunto: sano(z.string().trim().max(300)).nullable().optional(),
    texto: sano(z.string().trim().min(1).max(10000)).optional(),
    enlaceUrl: urlHttp.nullable().optional(),
    afirmaciones: z
      .array(sano(z.string().trim().min(1).max(200)))
      .max(50)
      .transform((claves) => [...new Set(claves)])
      .optional(),
    nota: sano(z.string().trim().max(500)).optional(),
  })
  .strict()
  .refine(
    (v) => CAMPOS_EDITABLES_DE_BORRADOR.some((campo) => v[campo] !== undefined),
    "Indica al menos un campo que cambiar."
  );
export type PatchBorradorBody = z.infer<typeof PatchBorradorBody>;

const REGLAS_DEL_MOTOR = new Set<string>([
  ...NOMBRES_DE_REGLAS_DURAS,
  ...NOMBRES_DE_REGLAS_BLANDAS,
]);

/**
 * Revisión que añade el modelo. Es solo consultiva: el servidor fuerza
 * `dura = false`, `revisor = 'llm'` y calcula el resultado; no puede
 * desbloquear nada ni firmar con el nombre de una regla del motor.
 */
export const RevisionLlmBody = z
  .object({
    /** Informativo: el servidor lo recalcula con las comprobaciones. */
    resultado: z.enum(RESULTADOS_DE_REVISION_LLM).optional(),
    comprobaciones: z
      .array(
        z
          .object({
            regla: sano(z.string().trim().min(1).max(60)).refine(
              (r) => !REGLAS_DEL_MOTOR.has(r.toLowerCase()),
              "Ese nombre es de una regla del motor de cumplimiento."
            ),
            ok: z.boolean(),
            detalle: sano(z.string().trim().min(1).max(300)),
          })
          .strict()
      )
      .min(1)
      .max(30),
  })
  .strict();
export type RevisionLlmBody = z.infer<typeof RevisionLlmBody>;

// ── Ejecuciones ──────────────────────────────────────────────────────────

/** Cómo acabó un módulo del run (discovery, qualification…). */
export const ESTADOS_DE_MODULO_AL_CERRAR = [
  "ok",
  "parcial",
  "error",
  "omitido",
] as const;

const camposDeModulo = {
  inicio: z.string().datetime({ offset: true }).optional(),
  fin: z.string().datetime({ offset: true }).optional(),
  error: sano(z.string().trim().max(500)).optional(),
  notas: sano(z.string().trim().max(500)).optional(),
};

const nombreDeModulo = sano(z.string().min(1).max(60));

/** Un módulo al CERRAR: ya no puede estar en curso. Los campos que no conoce se descartan. */
const ModuloDeEjecucion = z.object({
  estado: z.enum(ESTADOS_DE_MODULO_AL_CERRAR),
  ...camposDeModulo,
});

/**
 * Un módulo al ABRIR: `{ estado, inicio?, fin?, error?, notas? }`, estricto
 * (un campo que no existe es un error, no se ignora). Puede estar `en_curso`.
 */
export const ModuloAlAbrir = z
  .object({
    estado: z.enum(["en_curso", ...ESTADOS_DE_MODULO_AL_CERRAR]),
    ...camposDeModulo,
  })
  .strict();

export const AbrirEjecucionBody = z
  .object({
    disparador: z.enum(DISPARADORES_DE_EJECUCION),
    /** `git rev-parse HEAD` de los prompts. */
    versionPrompts: z.string().regex(COMMIT_SHA).optional(),
    modulos: z
      .record(nombreDeModulo, ModuloAlAbrir)
      .refine(
        (v) => bytesDe(v) <= LIMITE_DE_JSON_EN_BYTES,
        "Los módulos ocupan más de 8 KB."
      )
      .optional(),
  })
  .strict();
export type AbrirEjecucionBody = z.infer<typeof AbrirEjecucionBody>;

const contador = z.number().int().min(0).max(1_000_000);

export const ResumenDeEjecucion = z
  .object({
    candidatas: contador.optional(),
    calificadas: contador.optional(),
    descartadas: contador.optional(),
    descartesPorMotivo: z.record(CodigoDescarte, contador).optional(),
    borradores: contador.optional(),
    bloqueadas: contador.optional(),
    notas: sano(z.string().trim().max(1000)).optional(),
  })
  .strict();

/**
 * Lo que el agente DECLARÓ en el cierre y el servidor guarda aparte en
 * `resumen.declaradoPorElAgente`: la forma de `ResumenDeEjecucion` sin
 * `notas` (que va en el primer nivel del resumen). Es informativo: lo medido
 * por el servidor es lo que manda. OJO: `descartesPorMotivo` es un objeto
 * anidado `{ [codigoDeDescarte]: n }`, no un número.
 */
export type DeclaradoPorElAgente = Omit<
  z.infer<typeof ResumenDeEjecucion>,
  "notas"
>;

export const CerrarEjecucionBody = z
  .object({
    estado: z.enum(ESTADOS_DE_CIERRE_DE_EJECUCION),
    resumen: ResumenDeEjecucion.optional(),
    modulos: z
      .record(nombreDeModulo, ModuloDeEjecucion)
      .refine(
        (v) => bytesDe(v) <= LIMITE_DE_JSON_EN_BYTES,
        "Los módulos ocupan más de 8 KB."
      )
      .optional(),
    error: sano(z.string().trim().min(1).max(1000)).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.estado === "error" && !v.error) {
      ctx.addIssue({
        code: "custom",
        path: ["error"],
        message: "Cerrar con error exige explicar el error.",
      });
    }
  });
export type CerrarEjecucionBody = z.infer<typeof CerrarEjecucionBody>;

// ── Sincronización del conocimiento ──────────────────────────────────────

const CLAVE_DE_AFIRMACION =
  /^(precio|funcion|limite|sector|comparativa|pagina|prohibida)([.][a-z0-9_-]+)+$/;
const FUENTE_DE_AFIRMACION = /^[A-Za-z0-9_./@-]+(#[A-Za-z0-9_.:@-]+)?$/;

/** Una prohibida sin lista de términos no bloquea nada: se exige completa. */
export const ValorDeProhibida = z
  .object({
    terminos: z
      .array(sano(z.string().trim().min(3).max(80)))
      .min(1)
      .max(50),
    /** `true`: solo como palabra entera («API» no casa con «fisioterapia»). */
    palabrasEnteras: z.boolean(),
  })
  .passthrough();

/** Sin el dominio del competidor, la regla 3 no puede dar por cubierta la comparativa. */
export const ValorDeComparativa = z
  .object({ competidorDominio: dominioNormalizado })
  .passthrough();

export const AfirmacionSincronizada = z
  .object({
    clave: z.string().max(120).regex(CLAVE_DE_AFIRMACION),
    tipo: z.enum(TIPOS_DE_AFIRMACION),
    texto: sano(z.string().trim().min(1).max(2000)),
    valor: z
      .unknown()
      .refine((v) => bytesDe(v) <= 4096, "El valor ocupa más de 4 KB.")
      .refine((v) => !contieneTextoMalFormado(v), MENSAJE_DE_TEXTO_NO_VALIDO)
      .optional(),
    fuente: z.string().max(300).regex(FUENTE_DE_AFIRMACION),
    nichoSlug: slug.optional(),
  })
  .strict()
  .superRefine((a, ctx) => {
    // El prefijo de la clave ES el tipo: cumplimiento.ts decide por prefijo.
    if (!a.clave.startsWith(`${a.tipo}.`)) {
      ctx.addIssue({
        code: "custom",
        path: ["clave"],
        message: `La clave de una afirmación de tipo ${a.tipo} debe empezar por «${a.tipo}.».`,
      });
    }
    const valorExigido =
      a.tipo === "prohibida"
        ? ValorDeProhibida
        : a.tipo === "comparativa"
          ? ValorDeComparativa
          : null;
    if (valorExigido) {
      const r = valorExigido.safeParse(a.valor);
      if (!r.success) {
        for (const issue of r.error.issues) {
          ctx.addIssue({
            code: "custom",
            path: ["valor", ...issue.path],
            message: issue.message,
          });
        }
      }
    }
  });
export type AfirmacionSincronizada = z.infer<typeof AfirmacionSincronizada>;

export const CompetidorSembrado = z
  .object({
    nombre: sano(z.string().trim().min(1).max(120)),
    dominio: dominioNormalizado,
  })
  .strict();

export const NichoSembrado = z
  .object({
    slug,
    nombre: sano(z.string().trim().min(1).max(120)),
  })
  .strict();

export const PaginaSembrada = z
  .object({
    ruta: z
      .string()
      .max(200)
      .regex(
        /^\/[A-Za-z0-9/_.-]*$/,
        "La ruta empieza por / y no lleva parámetros."
      ),
    nombre: sano(z.string().trim().min(1).max(200)),
    seccion: sano(z.string().trim().min(1).max(80)),
    nichoSlug: slug.optional(),
    actualizado: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const SincronizarBaseBody = z
  .object({
    commitSha: z.string().regex(COMMIT_SHA),
    /**
     * Tipos de los que la lista es COMPLETA: lo que esté vigente de esos tipos
     * y no venga en `afirmaciones` se cierra. Si falta, son los tipos que
     * aparecen en `afirmaciones`.
     */
    tipos: z.array(z.enum(TIPOS_DE_AFIRMACION)).min(1).optional(),
    afirmaciones: z.array(AfirmacionSincronizada).max(1000),
    competidores: z.array(CompetidorSembrado).max(100).optional(),
    nichos: z.array(NichoSembrado).max(50).optional(),
    paginas: z.array(PaginaSembrada).max(300).optional(),
  })
  .strict();

/** Los tipos sobre los que una sincronización puede abrir y cerrar afirmaciones. */
export function tiposCubiertosPorLaSincronizacion(body: {
  tipos?: readonly TipoDeAfirmacion[];
  afirmaciones: readonly { tipo: TipoDeAfirmacion }[];
}): TipoDeAfirmacion[] {
  return [
    ...new Set(body.tipos ?? body.afirmaciones.map((a) => a.tipo)),
  ] as TipoDeAfirmacion[];
}

function repetidos(valores: readonly string[]): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const v of valores) {
    if (vistos.has(v)) repetidos.add(v);
    vistos.add(v);
  }
  return [...repetidos];
}

export const SincronizarBody = SincronizarBaseBody.superRefine((body, ctx) => {
  const cubiertos = tiposCubiertosPorLaSincronizacion(body);
  if (cubiertos.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["afirmaciones"],
      message: "Sin afirmaciones ni tipos no hay nada que sincronizar.",
    });
  }
  for (const clave of repetidos(body.afirmaciones.map((a) => a.clave))) {
    ctx.addIssue({
      code: "custom",
      path: ["afirmaciones"],
      message: `La clave «${clave}» viene repetida.`,
    });
  }
  body.afirmaciones.forEach((a, i) => {
    if (!cubiertos.includes(a.tipo)) {
      ctx.addIssue({
        code: "custom",
        path: ["afirmaciones", i, "tipo"],
        message: `El tipo ${a.tipo} no está entre los tipos de la sincronización.`,
      });
    }
  });
  const duplicados: [string, string[]][] = [
    [
      "competidores",
      repetidos((body.competidores ?? []).map((c) => c.dominio)),
    ],
    ["nichos", repetidos((body.nichos ?? []).map((n) => n.slug))],
    ["paginas", repetidos((body.paginas ?? []).map((p) => p.ruta))],
  ];
  for (const [campo, lista] of duplicados) {
    for (const valor of lista) {
      ctx.addIssue({
        code: "custom",
        path: [campo],
        message: `«${valor}» viene repetido.`,
      });
    }
  }
});
export type SincronizarBody = z.infer<typeof SincronizarBody>;

// ── Decisiones del administrador ─────────────────────────────────────────

const MS_POR_MINUTO = 60 * 1000;
const MS_POR_DIA = 24 * 60 * MS_POR_MINUTO;

/** Cuándo se hizo a mano: no en el futuro (con margen por el reloj del móvil) ni hace más de 30 días. */
const hechaEn = z.coerce
  .date()
  .refine(
    (d) => d.getTime() <= Date.now() + 5 * MS_POR_MINUTO,
    "La fecha no puede ser futura."
  )
  .refine(
    (d) => d.getTime() >= Date.now() - 30 * MS_POR_DIA,
    "La fecha no puede ser de hace más de 30 días."
  );

export const DecisionBody = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("aprobar"), borradorId: idDe }),
  z.object({
    accion: z.literal("devolver"),
    motivo: sano(z.string().trim().min(1).max(500)),
  }),
  z.object({
    accion: z.literal("descartar"),
    motivo: sano(z.string().trim().min(1).max(500)),
    codigo: CodigoDescarte.optional(),
  }),
  z.object({
    accion: z.literal("marcar_gestionado"),
    canal: z.enum(CANALES_DE_GESTION),
    hechaEn: hechaEn.optional(),
    notas: sano(z.string().trim().max(1000)).optional(),
    /** Lo que de verdad se envió, si no fue el texto aprobado. */
    textoFinal: sano(z.string().trim().min(1).max(10000)).optional(),
  }),
  z.object({ accion: z.literal("conseguido"), urlConseguida: urlHttp }),
  z.object({
    accion: z.literal("sin_respuesta"),
    notas: sano(z.string().trim().max(1000)).optional(),
  }),
  z.object({
    accion: z.literal("rechazado"),
    notas: sano(z.string().trim().max(1000)).optional(),
  }),
]);
export type DecisionBody = z.infer<typeof DecisionBody>;

// ── Ajustes (administrador) ──────────────────────────────────────────────

const CAMPOS_DE_AJUSTES = {
  topeSemanal: z
    .number()
    .int()
    .min(LIMITES_DE_AJUSTES.topeSemanal[0])
    .max(LIMITES_DE_AJUSTES.topeSemanal[1])
    .optional(),
  umbralDeSimilitud: z
    .number()
    .min(LIMITES_DE_AJUSTES.umbralDeSimilitud[0])
    .max(LIMITES_DE_AJUSTES.umbralDeSimilitud[1])
    .optional(),
  umbralesPorObjetivo: z
    .object({
      TRAFICO_MARCA: z.number().int().min(0).max(100),
      LEADS: z.number().int().min(0).max(100),
      BACKLINKS: z.number().int().min(0).max(100),
    })
    .strict()
    .optional(),
  pausa: z.boolean().optional(),
};
export const CLAVES_DE_AJUSTES_EDITABLES = Object.keys(
  CAMPOS_DE_AJUSTES
) as (keyof typeof CAMPOS_DE_AJUSTES)[];

export const AjustesPutBody = z
  .object(CAMPOS_DE_AJUSTES)
  .passthrough()
  .superRefine((valor, ctx) => {
    const conocidas = new Set<string>(CLAVES_DE_AJUSTES_EDITABLES);
    for (const clave of Object.keys(valor)) {
      if (conocidas.has(clave)) continue;
      ctx.addIssue({
        code: "custom",
        path: [clave],
        message: esClaveDeSistema(clave)
          ? `«${clave}» es una clave del sistema y no se edita.`
          : `«${clave}» no es un ajuste.`,
      });
    }
    if (
      !CLAVES_DE_AJUSTES_EDITABLES.some(
        (clave) => (valor as Record<string, unknown>)[clave] !== undefined
      )
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Indica al menos un ajuste.",
      });
    }
  })
  .transform((valor) => ({
    topeSemanal: valor.topeSemanal,
    umbralDeSimilitud: valor.umbralDeSimilitud,
    umbralesPorObjetivo: valor.umbralesPorObjetivo,
    pausa: valor.pausa,
  }));
export type AjustesPutBody = z.infer<typeof AjustesPutBody>;

// ── Consultas (query strings) ────────────────────────────────────────────

const textoDeBusqueda = sano(z.string().trim().min(1).max(100));

/** Un dominio escrito a mano en un filtro: minúsculas, sin texto roto. */
const dominioDeFiltro = sano(z.string().trim().toLowerCase().min(1).max(253));

/** `GET /growth/agente/contexto`. El MCP usa `sinAfirmaciones=true`. */
export const ContextoQuery = z.object({
  sinAfirmaciones: booleanoDeConsulta.optional(),
});

/** `GET /growth/admin/oportunidades`. */
export const ListadoDeOportunidadesQuery = Paginacion.extend({
  estado: listaDe(ESTADOS_DE_OPORTUNIDAD).optional(),
  objetivo: z.enum(OBJETIVOS).optional(),
  nicho: slug.optional(),
  tipoDestino: z.enum(TIPOS_DE_DESTINO).optional(),
  fuente: z.enum(TIPOS_DE_FUENTE).optional(),
  ejecucionId: idDe.optional(),
  dominio: dominioDeFiltro.optional(),
  /** Solo las que mencionan a ese competidor (`datos.competidoresMencionados`). */
  menciona: dominioDeFiltro.optional(),
  q: textoDeBusqueda.optional(),
  orden: z.enum(["puntuacion", "recientes", "caducan"]).default("recientes"),
});
export type ListadoDeOportunidadesQuery = z.infer<
  typeof ListadoDeOportunidadesQuery
>;

/** `GET /growth/agente/oportunidades`. */
export const ListadoDeOportunidadesDelAgenteQuery = Paginacion.extend({
  limite: z.coerce.number().int().min(1).max(100).default(50),
  estado: listaDe(ESTADOS_DE_OPORTUNIDAD).optional(),
  fuente: z.enum(TIPOS_DE_FUENTE).optional(),
  ejecucionId: idDe.optional(),
  dominio: dominioDeFiltro.optional(),
});

/** `GET /growth/admin/borradores`. */
export const GRUPOS_DE_BORRADORES = [
  "bloqueados",
  "pendientes",
  "aprobados",
  "gestionados",
  "caducados",
  "descartados",
] as const;
export const ListadoDeBorradoresQuery = Paginacion.extend({
  grupo: z.enum(GRUPOS_DE_BORRADORES).default("pendientes"),
  objetivo: z.enum(OBJETIVOS).optional(),
  tipo: z.enum(TIPOS_DE_BORRADOR).optional(),
  q: textoDeBusqueda.optional(),
  orden: z.enum(["recientes", "caducan"]).default("recientes"),
});

/** `GET /growth/admin/decisiones`. */
export const ListadoDeDecisionesQuery = Paginacion.extend({
  accion: sano(z.string().trim().min(1).max(60)).optional(),
  oportunidadId: idDe.optional(),
  borradorId: idDe.optional(),
  por: sano(z.string().trim().min(1).max(200)).optional(),
  soloSistema: booleanoDeConsulta.optional(),
  fechaDesde: z.coerce.date().optional(),
  fechaHasta: z.coerce.date().optional(),
});

/** `GET /growth/admin/gestiones`. */
export const ListadoDeGestionesQuery = Paginacion.extend({
  resultado: z.enum(RESULTADOS_DE_GESTION).optional(),
  canal: z.enum(CANALES_DE_GESTION).optional(),
  dominio: dominioDeFiltro.optional(),
  fechaDesde: z.coerce.date().optional(),
  fechaHasta: z.coerce.date().optional(),
});

/** `GET /growth/admin/ejecuciones`. */
export const ListadoDeEjecucionesQuery = Paginacion.extend({
  estado: z.enum(ESTADOS_DE_EJECUCION).optional(),
  disparador: z.enum(DISPARADORES_DE_EJECUCION).optional(),
});

/** `GET /growth/admin/conocimiento`. */
export const ConocimientoDelAdministradorQuery = z.object({
  tipo: z.enum(TIPOS_DE_AFIRMACION).optional(),
});

/** `GET /growth/agente/conocimiento`. */
export const ConocimientoDelAgenteQuery = z.object({
  tipo: z.enum(TIPOS_DE_AFIRMACION).optional(),
  clave: sano(z.string().trim().min(1).max(120)).optional(),
  q: textoDeBusqueda.optional(),
  limite: z.coerce.number().int().min(1).max(500).default(200),
});

// ── Competencia ──────────────────────────────────────────────────────────

/**
 * propuesto: lo sugiere el agente y NO aplica reglas duras hasta que lo aceptas;
 * por_analizar: confirmado, el agente aún no lo ha leído (o pediste volver a hacerlo);
 * analizado: hay un análisis pendiente de tu revisión;
 * revisado: lo diste por bueno.
 */
export const ESTADOS_DE_COMPETIDOR = [
  "propuesto",
  "por_analizar",
  "analizado",
  "revisado",
] as const;
export type EstadoDeCompetidor = (typeof ESTADOS_DE_COMPETIDOR)[number];

/** Quién lo dio de alta. Solo se quitan los que no son `repo`. */
export const ORIGENES_DE_COMPETIDOR = ["repo", "manual", "agente"] as const;
export type OrigenDeCompetidor = (typeof ORIGENES_DE_COMPETIDOR)[number];

export const TIPOS_DE_DATO_DE_COMPETIDOR = [
  "producto",
  "servicio",
  "precio",
  "plan",
  "integracion",
  "sector",
  "idioma",
  "canal",
  "limite",
  "diferencia",
  "otro",
] as const;
export type TipoDeDatoDeCompetidor =
  (typeof TIPOS_DE_DATO_DE_COMPETIDOR)[number];

export const MONEDAS_DE_PRECIO = ["EUR", "USD", "GBP"] as const;
export const PERIODOS_DE_PRECIO = ["mes", "anio", "uso", "unico"] as const;

/** Pasado este tiempo el análisis se considera caducado y el agente lo repite. */
export const DIAS_PARA_CADUCAR_UN_ANALISIS = 90;
/** Un análisis nuevo antes de este plazo (sin haber pedido volver a analizar) se rechaza. */
export const DIAS_MINIMOS_ENTRE_ANALISIS = 7;
export const MAXIMO_DE_DATOS_POR_ANALISIS = 60;
export const MAXIMO_DE_VERSIONES_POR_COMPETIDOR = 10;
export const MAXIMO_DE_PROPUESTAS_PENDIENTES = 20;
const LIMITE_DE_ANALISIS_EN_BYTES = 40 * 1024;

/** Cuánto puede adelantarse el reloj del agente a el del servidor al fechar una consulta. */
const MARGEN_DE_RELOJ_EN_MS = 5 * 60 * 1000;
const DIAS_MAXIMOS_DE_UNA_CONSULTA = 30;

/** Fecha en que el agente leyó la página: ni en el futuro ni de hace más de 30 días. */
const fechaDeConsulta = z
  .string()
  .datetime({ offset: true })
  .refine((valor) => {
    const instante = Date.parse(valor);
    const ahora = Date.now();
    return (
      instante <= ahora + MARGEN_DE_RELOJ_EN_MS &&
      instante >= ahora - DIAS_MAXIMOS_DE_UNA_CONSULTA * 24 * 60 * 60 * 1000
    );
  }, "La fecha de consulta no puede estar en el futuro ni ser de hace más de 30 días.");

/** Un precio estructurado; solo lo llevan los datos de tipo `precio` y `plan`. */
export const ValorDePrecioDeCompetidor = z
  .object({
    importe: z.number().min(0).max(1_000_000),
    moneda: z.enum(MONEDAS_DE_PRECIO),
    periodo: z.enum(PERIODOS_DE_PRECIO),
    ivaIncluido: z.boolean().optional(),
    /** «minuto», «usuario», «agente»… lo que se cobra por unidad. */
    unidad: sano(z.string().trim().min(1).max(40)).optional(),
  })
  .strict();

/**
 * Un hecho público sobre un competidor, con la página de la que sale y el día
 * que se leyó. Sin fuente y fecha no se guarda: es el mismo estándar que
 * `comparativas.ts` (art. 10 Ley 3/1991), aunque aquí no se publique.
 */
export const DatoDeCompetidor = z
  .object({
    tipo: z.enum(TIPOS_DE_DATO_DE_COMPETIDOR),
    /** «Plan Pro», «Integración con Google Calendar»… */
    etiqueta: sano(z.string().trim().min(1).max(120)),
    texto: sano(z.string().trim().min(1).max(600)),
    valor: ValorDePrecioDeCompetidor.optional(),
    urlFuente: urlHttp,
    consultadoEn: fechaDeConsulta,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.valor && v.tipo !== "precio" && v.tipo !== "plan") {
      ctx.addIssue({
        code: "custom",
        path: ["valor"],
        message: "Solo los datos de tipo precio o plan llevan valor.",
      });
    }
    if (v.tipo === "precio" && !v.valor) {
      ctx.addIssue({
        code: "custom",
        path: ["valor"],
        message:
          "Un precio lleva valor (importe, moneda y periodo). Si no lo publican, descríbelo con tipo «otro».",
      });
    }
    const textos = [v.etiqueta, v.texto, v.valor?.unidad ?? ""];
    if (textos.some(contieneCorreo) || textos.some(contieneTelefono)) {
      ctx.addIssue({
        code: "custom",
        path: ["texto"],
        message: "Un dato de competidor no puede incluir correos ni teléfonos.",
      });
    }
  });
export type DatoDeCompetidor = z.infer<typeof DatoDeCompetidor>;

/** `POST /growth/agente/competidores/:id/analisis`. */
export const AnalisisDeCompetidorBodyBase = z
  .object({
    resumen: sano(z.string().trim().min(1).max(2000)),
    datos: z.array(DatoDeCompetidor).min(1).max(MAXIMO_DE_DATOS_POR_ANALISIS),
    ejecucionId: idDe.optional(),
  })
  .strict();
export const AnalisisDeCompetidorBody =
  AnalisisDeCompetidorBodyBase.superRefine((v, ctx) => {
    if (contieneCorreo(v.resumen) || contieneTelefono(v.resumen)) {
      ctx.addIssue({
        code: "custom",
        path: ["resumen"],
        message: "El resumen no puede incluir correos ni teléfonos.",
      });
    }
    if (bytesDe(v.datos) > LIMITE_DE_ANALISIS_EN_BYTES) {
      ctx.addIssue({
        code: "custom",
        path: ["datos"],
        message: "El análisis es demasiado grande (máximo 40 KB).",
      });
    }
  });
export type AnalisisDeCompetidorBody = z.infer<typeof AnalisisDeCompetidorBody>;

/** `POST /growth/agente/competidores`: el agente sugiere uno; tú lo aceptas. */
export const PropuestaDeCompetidorBody = z
  .object({
    url: urlHttp,
    nombre: sano(z.string().trim().min(1).max(120)),
    /** Por qué parece un competidor (va a `notas`, marcado como del agente). */
    motivo: sano(z.string().trim().min(1).max(500)),
    /** Página donde lo has visto mencionado, si la hay. */
    fuenteUrl: urlHttp.optional(),
  })
  .strict();
export type PropuestaDeCompetidorBody = z.infer<
  typeof PropuestaDeCompetidorBody
>;

/** `POST /growth/admin/competidores`: pegas una URL y el agente la analiza en el siguiente run. */
export const AltaDeCompetidorBody = z
  .object({
    url: urlHttp,
    nombre: sano(z.string().trim().min(1).max(120)).optional(),
    notas: sano(z.string().trim().max(500)).optional(),
  })
  .strict();
export type AltaDeCompetidorBody = z.infer<typeof AltaDeCompetidorBody>;

/**
 * `PATCH /growth/admin/competidores/:id`. El dominio solo cambia si la URL es de
 * otro dominio y `cambiarDominio` es `true` (el dominio sale de la URL).
 */
export const CambioDeCompetidorBody = z
  .object({
    nombre: sano(z.string().trim().min(1).max(120)).optional(),
    notas: sano(z.string().trim().max(500)).nullable().optional(),
    url: urlHttp.nullable().optional(),
    cambiarDominio: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.nombre !== undefined || v.notas !== undefined || v.url !== undefined,
    { message: "Indica al menos un campo que cambiar." }
  );
export type CambioDeCompetidorBody = z.infer<typeof CambioDeCompetidorBody>;

/** Parámetros de `/growth/admin/competidores/:id/analisis/:analisisId`. */
export const AnalisisDeCompetidorParams = z.object({
  id: idDe,
  analisisId: idDe,
});
export type AnalisisDeCompetidorParams = z.infer<
  typeof AnalisisDeCompetidorParams
>;

/** `POST /growth/admin/competidores/:id/analisis/:analisisId/revisar`. */
export const RevisionDeAnalisisBody = z
  .object({ nota: sano(z.string().trim().max(500)).optional() })
  .strict();
export type RevisionDeAnalisisBody = z.infer<typeof RevisionDeAnalisisBody>;

// ── Tareas a mano ────────────────────────────────────────────────────────

/** A qué tipo de destino pertenece una tarea (solo ordena y etiqueta). */
export const CATEGORIAS_DE_TAREA = [
  "directorio_software",
  "directorio_ia",
  "sector",
  "asociacion",
  "otro",
] as const;
export type CategoriaDeTarea = (typeof CATEGORIAS_DE_TAREA)[number];

/** `repo`: la siembra el servidor y no se borra; `manual`: la añade el administrador. */
export const ORIGENES_DE_TAREA = ["repo", "manual"] as const;
export type OrigenDeTarea = (typeof ORIGENES_DE_TAREA)[number];

export const ESTADOS_DE_TAREA = ["pendiente", "hecha", "descartada"] as const;
export type EstadoDeTarea = (typeof ESTADOS_DE_TAREA)[number];

/** Cómo acabó una tarea que se dio por hecha. */
export const RESULTADOS_DE_TAREA = [
  "alta_creada",
  "en_revision",
  "rechazada",
  "sin_alta_gratuita",
  "otro",
] as const;
export type ResultadoDeTarea = (typeof RESULTADOS_DE_TAREA)[number];

export const MAXIMO_DE_PASOS_DE_UNA_TAREA = 12;
export const MAXIMO_DE_CARACTERES_DE_UN_PASO = 300;
export const MAXIMO_DE_CARACTERES_DE_LAS_NOTAS_DE_UNA_TAREA = 1000;
export const MAXIMO_DE_CARACTERES_DE_LA_NOTA_DE_RESULTADO = 500;

const tituloDeTarea = sano(z.string().trim().min(1).max(200));
const pasosDeTarea = z
  .array(sano(z.string().trim().min(1).max(MAXIMO_DE_CARACTERES_DE_UN_PASO)))
  .max(MAXIMO_DE_PASOS_DE_UNA_TAREA);
const notasDeTarea = sano(
  z.string().trim().max(MAXIMO_DE_CARACTERES_DE_LAS_NOTAS_DE_UNA_TAREA)
);
const notaDeResultadoDeTarea = sano(
  z.string().trim().max(MAXIMO_DE_CARACTERES_DE_LA_NOTA_DE_RESULTADO)
);
/** Un dominio sin `www.`; en blanco equivale a «el de la URL». */
const dominioDeTarea = z.union([
  z.literal("").transform(() => null),
  dominioNormalizado,
]);

/** `POST /growth/admin/tareas`: el dominio, si no se da, sale de la URL. */
export const AltaDeTareaBody = z
  .object({
    titulo: tituloDeTarea,
    url: urlHttp,
    categoria: z.enum(CATEGORIAS_DE_TAREA).optional(),
    dominio: dominioDeTarea.nullable().optional(),
    pasos: pasosDeTarea.optional(),
    notas: notasDeTarea.nullable().optional(),
  })
  .strict();
export type AltaDeTareaBody = z.infer<typeof AltaDeTareaBody>;

/**
 * `PATCH /growth/admin/tareas/:id`. Solo cambia lo que llega; `dominio: null`
 * lo quita. Si cambia la URL a otro sitio y no llega `dominio`, el dominio se
 * recalcula desde la URL nueva.
 */
export const CambioDeTareaBody = z
  .object({
    titulo: tituloDeTarea.optional(),
    url: urlHttp.optional(),
    categoria: z.enum(CATEGORIAS_DE_TAREA).optional(),
    dominio: dominioDeTarea.nullable().optional(),
    pasos: pasosDeTarea.optional(),
    notas: notasDeTarea.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((valor) => valor !== undefined), {
    message: "Indica al menos un campo que cambiar.",
  });
export type CambioDeTareaBody = z.infer<typeof CambioDeTareaBody>;

/** `POST /growth/admin/tareas/:id/hecha`. */
export const TareaHechaBody = z
  .object({
    resultado: z.enum(RESULTADOS_DE_TAREA).nullable().optional(),
    nota: notaDeResultadoDeTarea.nullable().optional(),
  })
  .strict();
export type TareaHechaBody = z.infer<typeof TareaHechaBody>;

/** `POST /growth/admin/tareas/:id/descartar`. */
export const TareaDescartadaBody = z
  .object({ nota: notaDeResultadoDeTarea.nullable().optional() })
  .strict();
export type TareaDescartadaBody = z.infer<typeof TareaDescartadaBody>;
