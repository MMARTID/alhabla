import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Prisma } from "@prisma/client";
import type {
  GrowthEstadoOportunidad as Estado,
  GrowthObjetivo as Objetivo,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { COMPETIDOR_CONFIRMADO } from "./competidores.js";
import type { Comprobacion } from "./cumplimiento.js";
import {
  DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO,
  esHostDeAlhabla,
  fallosDelTexto,
  normalizarDominio,
  sinPuntoFinal,
} from "./cumplimiento.js";
import {
  contactosDeLaSemana,
  dominiosEnEnfriamiento,
  evaluarBorradorConContexto,
  leerAjustesEfectivos,
  leerSnapshotDeConocimiento,
  type ClienteDeBd,
  type ResultadoDeEvaluacion,
} from "./contextoDeCumplimiento.js";
import {
  ESTADOS_DE_OPORTUNIDAD,
  type BorradorBody,
  type CalificacionBody,
  type CodigoDescarte,
  type DecisionBody,
  type EstadoBody,
  type InvestigacionBody,
  type ListadoDeOportunidadesQuery,
  type OportunidadBody,
  type OportunidadManualBody,
  type Pagina,
} from "./esquemas.js";
import {
  puedeTransicionar,
  transicionesPosibles,
  type Actor,
} from "./estados.js";
import { similitud } from "./similitud.js";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Cuánto se guarda el extracto de una página de terceros. */
export const DIAS_DE_RETENCION = 180;

/** Quién firma lo que hace el propio backend. */
export const POR_SISTEMA = "sistema";

/** Lo que anota `growth_decisiones.por` para un token de agente. */
export function porAgente(agente: { nombre: string }): string {
  return `agente:${agente.nombre}`;
}

/**
 * Error con el código HTTP que debe devolver la ruta. `codigo` es una cadena
 * estable para que el MCP y el dashboard decidan sin leer el mensaje
 * (`pausa`, `cumplimiento`, `dominio_ya_aprobado`, `tope_semanal`,
 * `caducada`, `fuente_inactiva`, `conflicto`…), y `extra` añade campos al
 * cuerpo (por ejemplo `comprobaciones`).
 */
export class ErrorDeGrowth extends Error {
  constructor(
    public readonly status: number,
    mensaje: string,
    public readonly codigo?: string,
    public readonly extra?: Record<string, unknown>
  ) {
    super(mensaje);
    this.name = "ErrorDeGrowth";
  }
}

function codigoDePrisma(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

// ── Texto que entra en la base de datos ──────────────────────────────────

const SUSTITUTO_SUELTO =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Postgres rechaza el carácter NUL en un `text` y en un `jsonb`, y el motor de
 * Prisma rechaza un sustituto UTF-16 suelto (la mitad de un emoji): las dos
 * cosas daban un 500 en vez de un 400. Se quita el NUL y se cambia el
 * sustituto suelto por U+FFFD.
 */
export function limpiarTextoParaBd(texto: string): string {
  return texto.replaceAll("\u0000", "").replace(SUSTITUTO_SUELTO, "\uFFFD");
}

/** `limpiarTextoParaBd` en cada cadena (y clave) de un valor JSON, sin tocar fechas ni números. */
export function limpiarJsonParaBd<T>(valor: T): T {
  if (typeof valor === "string") return limpiarTextoParaBd(valor) as T;
  if (Array.isArray(valor)) {
    return valor.map((elemento) => limpiarJsonParaBd(elemento)) as T;
  }
  if (
    valor !== null &&
    typeof valor === "object" &&
    Object.getPrototypeOf(valor) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(valor).map(([clave, elemento]) => [
        limpiarTextoParaBd(clave),
        limpiarJsonParaBd(elemento),
      ])
    ) as T;
  }
  return valor;
}

/**
 * Corta por puntos de código, no por unidades UTF-16: `slice(0, 500)` partía
 * por la mitad un emoji que cayera justo en el límite y dejaba un sustituto
 * suelto.
 */
export function recortarPorPuntosDeCodigo(
  texto: string,
  maximo: number
): string {
  const limpio = limpiarTextoParaBd(texto);
  const puntos = Array.from(limpio);
  return puntos.length <= maximo ? limpio : puntos.slice(0, maximo).join("");
}

// ── URL ──────────────────────────────────────────────────────────────────

const PARAMETROS_DE_SEGUIMIENTO = /^(utm_|gclid$|fbclid$|mc_|ref$)/i;

/** La misma página con distinto seguimiento, `www` o barra final es la misma. */
export function normalizarUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ErrorDeGrowth(400, "La URL no es válida.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ErrorDeGrowth(400, "La URL debe ser http o https.");
  }

  const parametros = [...parsed.searchParams.entries()]
    .filter(([clave]) => !PARAMETROS_DE_SEGUIMIENTO.test(clave))
    .sort(([a], [b]) => a.localeCompare(b));
  const consulta = new URLSearchParams(parametros).toString();
  // `//` repetidas, `/index.html` y la barra final son la misma página.
  const ruta = parsed.pathname
    .replace(/\/{2,}/g, "/")
    .replace(/\/index\.(?:html?|php)$/i, "/")
    .replace(/(.)\/+$/, "$1");
  // `URL.port` viene vacío en el puerto por defecto del esquema.
  const puerto = parsed.port ? `:${parsed.port}` : "";

  return `${parsed.protocol}//${dominioDeUrl(url)}${puerto}${ruta}${consulta ? `?${consulta}` : ""}`;
}

/**
 * La URL tal como la abre una persona: la misma que llegó (con su `www`, su
 * esquema y su barra final) pero sin seguimiento, sin fragmento, sin usuario
 * ni contraseña y sin el punto final del host. La clave de duplicados y el
 * dominio salen de `normalizarUrl`, no de esta.
 */
export function urlParaAbrir(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ErrorDeGrowth(400, "La URL debe ser http o https.");
  }
  for (const clave of [...parsed.searchParams.keys()]) {
    if (PARAMETROS_DE_SEGUIMIENTO.test(clave))
      parsed.searchParams.delete(clave);
  }
  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";
  parsed.hostname = sinPuntoFinal(parsed.hostname);
  return parsed.toString();
}

/** El host sin `www`, sin punto final y en minúsculas: la clave del enfriamiento. */
export function dominioDeUrl(url: string): string {
  return normalizarDominio(new URL(url).hostname);
}

export function claveDeUrl(url: string): string {
  return createHash("sha256").update(normalizarUrl(url)).digest("hex");
}

const SUFIJOS_DE_HOST_INTERNO = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".intranet",
  ".home.arpa",
];

/**
 * Growth busca páginas de terceros: ni la propia web, ni `localhost`, ni una
 * IP, ni un host interno. El backend no descarga nada (no hay SSRF), pero el
 * agente y el botón «Abrir página» sí abren estas URL.
 */
export function validarUrlExterna(url: string): void {
  let host: string;
  try {
    // `localhost.` y `metadata.google.internal.` son el mismo host que sin el
    // punto final del FQDN.
    host = sinPuntoFinal(new URL(url).hostname.toLowerCase());
  } catch {
    throw new ErrorDeGrowth(400, "La URL no es válida.");
  }
  if (esHostDeAlhabla(host)) {
    throw new ErrorDeGrowth(
      400,
      "Esa página es de Alhabla: Growth busca páginas de terceros.",
      "dominio_propio"
    );
  }
  const esIp = host.startsWith("[") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (
    esIp ||
    host === "localhost" ||
    !host.includes(".") ||
    SUFIJOS_DE_HOST_INTERNO.some((s) => host.endsWith(s))
  ) {
    throw new ErrorDeGrowth(
      400,
      "La URL apunta a un host interno o a una IP: indica la página pública."
    );
  }
}

// ── Piezas compartidas ───────────────────────────────────────────────────

const FUENTES_FIJAS = {
  manual: { id: "fuente_manual", nombre: "Entrada manual" },
  web: { id: "fuente_web", nombre: "Búsqueda en la web" },
  directorio: { id: "fuente_directorio", nombre: "Directorios" },
} as const;

export type TipoDeFuente = keyof typeof FUENTES_FIJAS;

/**
 * La fuente de un tipo, creada al vuelo con id fijo (`fuente_web`,
 * `fuente_directorio`, `fuente_manual`): ni seed ni migración, y dos
 * peticiones a la vez no duplican filas. Llamar FUERA de una transacción: un
 * P2002 dentro de una la aborta.
 */
export async function asegurarFuente(
  tipo: TipoDeFuente,
  cliente: ClienteDeBd = prisma
) {
  const fija = FUENTES_FIJAS[tipo];
  const seleccion = { id: true, tipo: true, nombre: true, activa: true };
  try {
    return await cliente.growthFuente.upsert({
      where: { id: fija.id },
      create: { id: fija.id, tipo, nombre: fija.nombre, activa: true },
      update: {},
      select: seleccion,
    });
  } catch (error) {
    // Otra petición la creó entre medias: gana la primera.
    if (codigoDePrisma(error) === "P2002") {
      return cliente.growthFuente.findUniqueOrThrow({
        where: { id: fija.id },
        select: seleccion,
      });
    }
    throw error;
  }
}

/**
 * Pausa de Growth: con el ajuste `pausa` activo, toda ESCRITURA del agente
 * responde 409 `pausa`. Cerrar una ejecución sigue permitido (no usa esto).
 */
export async function exigirGrowthActivo(
  cliente: ClienteDeBd = prisma
): Promise<void> {
  const fila = await cliente.growthAjuste.findUnique({
    where: { clave: "pausa" },
  });
  if (fila?.valor === true) {
    throw new ErrorDeGrowth(409, "Growth está en pausa.", "pausa");
  }
}

/**
 * `preHandler` de Fastify para cada ruta de escritura del agente:
 * `{ onRequest: autenticarAgenteGrowth("escribir"), preHandler: guardiaDePausa }`.
 * Va después de la autenticación, así que quien no entra no averigua si hay
 * pausa.
 */
export async function guardiaDePausa(): Promise<void> {
  await exigirGrowthActivo();
}

/** Una fila en `growth_decisiones`: el registro que nunca se edita ni se borra. */
export async function registrarDecision(
  cliente: ClienteDeBd,
  decision: {
    oportunidadId?: string | null;
    borradorId?: string | null;
    accion: string;
    motivo?: string | null;
    por: string;
  }
): Promise<void> {
  await cliente.growthDecision.create({
    data: {
      oportunidadId: decision.oportunidadId ?? undefined,
      borradorId: decision.borradorId ?? undefined,
      accion: decision.accion,
      motivo: decision.motivo
        ? recortarPorPuntosDeCodigo(decision.motivo, 1000)
        : undefined,
      por: decision.por,
    },
  });
}

/**
 * Cambia el estado de una oportunidad solo si sigue como la leíste
 * (`updateMany` condicional): un doble clic o dos procesos a la vez no pasan
 * los dos. Comprueba también que `actor` pueda hacer ese cambio.
 */
export async function cambiarEstadoConGuardia(
  cliente: ClienteDeBd,
  opciones: {
    id: string;
    desde: Estado;
    hasta: Estado;
    actor: Actor;
    /** Campos que cambian a la vez. */
    datos?: Prisma.GrowthOportunidadUncheckedUpdateManyInput;
  }
): Promise<void> {
  if (!puedeTransicionar(opciones.desde, opciones.hasta, opciones.actor)) {
    throw new ErrorDeGrowth(
      409,
      `Una oportunidad ${opciones.desde} no puede pasar a ${opciones.hasta}.`
    );
  }
  const { count } = await cliente.growthOportunidad.updateMany({
    where: { id: opciones.id, estado: opciones.desde },
    data: { ...opciones.datos, estado: opciones.hasta },
  });
  if (count !== 1) {
    throw new ErrorDeGrowth(
      409,
      "La oportunidad ha cambiado mientras la procesabas. Vuelve a cargarla.",
      "conflicto"
    );
  }
}

function objetoJson(valor: Prisma.JsonValue | null | undefined) {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Prisma.JsonObject)
    : {};
}

/** `datos` con lo nuevo encima (fusión superficial); lo que no se toca se conserva. */
function fusionarDatos(
  actual: Prisma.JsonValue | null | undefined,
  nuevos: Record<string, unknown>
): Prisma.InputJsonObject {
  return { ...objetoJson(actual), ...nuevos } as Prisma.InputJsonObject;
}

function codigoDeDescarteDe(
  datos: Prisma.JsonValue | null | undefined
): CodigoDescarte | null {
  const codigo = objetoJson(datos).codigoDescarte;
  return typeof codigo === "string" ? (codigo as CodigoDescarte) : null;
}

/** `datos` tal como se enseña: sin el código de descarte, que va aparte. */
function datosVisibles(datos: Prisma.JsonValue | null | undefined) {
  if (datos === null || datos === undefined) return null;
  const resto = { ...objetoJson(datos) };
  delete resto.codigoDescarte;
  return resto;
}

type Puntuaciones = Record<Objetivo, number>;

function puntuacionesDe(fila: {
  puntTrafico: number;
  puntLeads: number;
  puntBacklinks: number;
}): Puntuaciones {
  return {
    TRAFICO_MARCA: fila.puntTrafico,
    LEADS: fila.puntLeads,
    BACKLINKS: fila.puntBacklinks,
  };
}

// ── Lo que lee el agente ─────────────────────────────────────────────────

export async function contextoParaElAgente(
  opciones: { sinAfirmaciones?: boolean } = {}
) {
  const ahora = new Date();
  const [
    ajustes,
    snapshot,
    contactos,
    enfriamiento,
    manualesPendientes,
    afirmaciones,
    competidores,
    nichos,
    fuentes,
  ] = await Promise.all([
    leerAjustesEfectivos(),
    leerSnapshotDeConocimiento(prisma, ahora),
    contactosDeLaSemana(prisma, { ahora }),
    dominiosEnEnfriamiento(prisma, ahora),
    prisma.growthOportunidad.count({
      where: { estado: "detectada", fuente: { tipo: "manual" } },
    }),
    opciones.sinAfirmaciones
      ? Promise.resolve(null)
      : prisma.growthAfirmacion.findMany({
          where: { vigenteHasta: null },
          orderBy: { clave: "asc" },
        }),
    // Solo los confirmados: un `propuesto` no aplica reglas y el agente lo
    // lee aparte (`GET /growth/agente/competidores`).
    prisma.growthCompetidor.findMany({
      where: COMPETIDOR_CONFIRMADO,
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, dominio: true },
    }),
    prisma.growthNicho.findMany({
      where: { estado: { in: ["activo", "candidato"] } },
      orderBy: { slug: "asc" },
      select: { id: true, slug: true, nombre: true, estado: true },
    }),
    prisma.growthFuente.findMany({
      where: { activa: true },
      select: { id: true, tipo: true, nombre: true },
    }),
  ]);

  return {
    ajustes: ajustes.valores,
    snapshot,
    contactos: {
      // Lo hecho más lo aprobado que aún no se ha gestionado.
      estaSemana: contactos.total,
      tope: ajustes.valores.topeSemanal,
    },
    dominiosEnEnfriamiento: enfriamiento.dominiosEnEnfriamiento,
    dominiosConAprobadaPendiente: enfriamiento.dominiosConAprobadaPendiente,
    manualesPendientes,
    ...(afirmaciones
      ? {
          afirmaciones: afirmaciones.map((a) => ({
            clave: a.clave,
            tipo: a.tipo,
            texto: a.texto,
            valor: a.valor,
            fuente: a.fuente,
            commitSha: a.commitSha,
          })),
        }
      : {}),
    competidores,
    nichos,
    fuentes,
  };
}

// ── Oportunidades (agente) ───────────────────────────────────────────────

type DatosParaCrear = {
  fuenteId: string;
  nichoId?: string;
  url: string;
  titulo: string;
  extracto: string;
  idioma?: string;
  objetivoPrincipal: Objetivo;
  puntTrafico?: number;
  puntLeads?: number;
  puntBacklinks?: number;
  datos?: Prisma.InputJsonObject;
  expiraEn?: Date;
  ejecucionId?: string;
};

/** Crea la oportunidad (o devuelve la que ya tiene esa URL) con el dedupe y la retención. */
async function insertarOportunidad(
  datos: DatosParaCrear,
  cliente: ClienteDeBd = prisma
) {
  const claveExterna = claveDeUrl(datos.url);
  const seleccion = { id: true, estado: true, motivoDescarte: true };

  const existente = await cliente.growthOportunidad.findUnique({
    where: { claveExterna },
    select: seleccion,
  });
  if (existente) return { creada: false as const, ...existente };

  try {
    const creada = await cliente.growthOportunidad.create({
      data: {
        ...datos,
        claveExterna,
        url: urlParaAbrir(datos.url),
        dominio: dominioDeUrl(datos.url),
        extracto: recortarPorPuntosDeCodigo(datos.extracto, 500),
        retencionHasta: new Date(Date.now() + DIAS_DE_RETENCION * MS_POR_DIA),
      },
      select: seleccion,
    });
    return { creada: true as const, id: creada.id, estado: creada.estado };
  } catch (error) {
    // Dos runs a la vez con la misma URL: gana el primero.
    if (codigoDePrisma(error) === "P2002") {
      const ganadora = await cliente.growthOportunidad.findUniqueOrThrow({
        where: { claveExterna },
        select: seleccion,
      });
      return { creada: false as const, ...ganadora };
    }
    // Una clave foránea que no existe (fuente, nicho o ejecución) es un
    // error de quien llama, no del servidor.
    if (codigoDePrisma(error) === "P2003") {
      throw new ErrorDeGrowth(
        400,
        "La fuente, el nicho o la ejecución indicados no existen."
      );
    }
    throw error;
  }
}

async function nichoPorSlug(slug: string, cliente: ClienteDeBd = prisma) {
  const nicho = await cliente.growthNicho.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!nicho) throw new ErrorDeGrowth(400, `El nicho «${slug}» no existe.`);
  return nicho.id;
}

/**
 * Los competidores que una página menciona (`datos.competidoresMencionados`):
 * cada dominio se normaliza, se deduplica y debe ser el de un competidor
 * CONFIRMADO (no `propuesto`) o un subdominio suyo, que se guarda como el
 * dominio canónico del competidor. Si alguno no lo es: 400
 * `competidor_desconocido` con la lista en `dominios`. Así lo que cuenta
 * `menciones` y filtra la Bandeja no depende de que el agente acierte con la
 * ortografía ni de que una página hostil le haga inventar competidores.
 */
export async function normalizarCompetidoresMencionados(
  dominios: readonly string[],
  cliente: ClienteDeBd = prisma
): Promise<string[]> {
  const pedidos = [...new Set(dominios.map((d) => normalizarDominio(d)))];
  if (pedidos.length === 0) return [];
  const confirmados = await cliente.growthCompetidor.findMany({
    where: COMPETIDOR_CONFIRMADO,
    select: { dominio: true },
  });
  // Del más largo al más corto: `app.heydiga.ai` (si existiera) gana a `heydiga.ai`.
  const conocidos = confirmados
    .map((c) => normalizarDominio(c.dominio))
    .sort((a, b) => b.length - a.length);

  const canonicos: string[] = [];
  const desconocidos: string[] = [];
  for (const pedido of pedidos) {
    const canonico = conocidos.find(
      (conocido) => pedido === conocido || pedido.endsWith(`.${conocido}`)
    );
    if (!canonico) desconocidos.push(pedido);
    else if (!canonicos.includes(canonico)) canonicos.push(canonico);
  }
  if (desconocidos.length > 0) {
    throw new ErrorDeGrowth(
      400,
      `No es un competidor confirmado: ${desconocidos.join(", ")}. Propónlo con proponer_competidor y espera a que el administrador lo acepte.`,
      "competidor_desconocido",
      { dominios: desconocidos }
    );
  }
  return canonicos;
}

/** `datos` con `competidoresMencionados` verificado y canónico (si lo trae). */
async function datosConMencionesVerificadas<
  T extends { competidoresMencionados?: string[] },
>(datos: T | undefined): Promise<T | undefined> {
  if (!datos?.competidoresMencionados) return datos;
  return {
    ...datos,
    competidoresMencionados: await normalizarCompetidoresMencionados(
      datos.competidoresMencionados
    ),
  };
}

/** Crear una oportunidad como agente (`POST /growth/agente/oportunidades`). */
export async function crearOportunidad(entradaCruda: OportunidadBody) {
  const entrada = limpiarJsonParaBd(entradaCruda);
  validarUrlExterna(entrada.url);

  // Un duplicado devuelve la existente sin tocarla: no hace falta validar el resto.
  const existente = await prisma.growthOportunidad.findUnique({
    where: { claveExterna: claveDeUrl(entrada.url) },
    select: { id: true, estado: true, motivoDescarte: true },
  });
  if (existente) return { creada: false as const, ...existente };

  let fuente: { id: string; tipo: string; activa: boolean } | null;
  if (entrada.fuenteId) {
    fuente = await prisma.growthFuente.findUnique({
      where: { id: entrada.fuenteId },
      select: { id: true, tipo: true, activa: true },
    });
    if (!fuente) throw new ErrorDeGrowth(400, "La fuente no existe.");
    if (fuente.tipo === "manual") {
      throw new ErrorDeGrowth(
        400,
        "La fuente manual es solo del administrador."
      );
    }
  } else {
    fuente = await asegurarFuente(entrada.fuenteTipo ?? "web");
  }
  if (!fuente.activa) {
    throw new ErrorDeGrowth(
      409,
      "La fuente está desactivada.",
      "fuente_inactiva"
    );
  }

  let nichoId = entrada.nichoId;
  if (nichoId) {
    const nicho = await prisma.growthNicho.findUnique({
      where: { id: nichoId },
      select: { id: true },
    });
    if (!nicho) throw new ErrorDeGrowth(400, "El nicho no existe.");
  } else if (entrada.nichoSlug) {
    nichoId = await nichoPorSlug(entrada.nichoSlug);
  }

  if (entrada.ejecucionId) {
    const ejecucion = await prisma.growthEjecucion.findUnique({
      where: { id: entrada.ejecucionId },
      select: { estado: true },
    });
    if (!ejecucion) throw new ErrorDeGrowth(400, "La ejecución no existe.");
    if (ejecucion.estado !== "en_curso") {
      throw new ErrorDeGrowth(409, "La ejecución ya está cerrada.");
    }
  }

  const datos = await datosConMencionesVerificadas(entrada.datos);

  return insertarOportunidad({
    fuenteId: fuente.id,
    nichoId,
    url: entrada.url,
    titulo: entrada.titulo,
    extracto: entrada.extracto,
    idioma: entrada.idioma,
    objetivoPrincipal: entrada.objetivoPrincipal,
    puntTrafico: entrada.puntTrafico,
    puntLeads: entrada.puntLeads,
    puntBacklinks: entrada.puntBacklinks,
    datos: datos as Prisma.InputJsonObject | undefined,
    expiraEn: entrada.expiraEn,
    ejecucionId: entrada.ejecucionId,
  });
}

/**
 * Añadir una URL a mano (`POST /growth/admin/oportunidades`). Entra como
 * `detectada`, sin extracto (lo completa el Discovery al leerla) y con la
 * fuente manual. Una URL que ya existe, aunque esté descartada o caducada, no
 * se reabre: se devuelve tal cual con `creada: false`.
 */
export async function crearOportunidadManual(
  entradaCruda: OportunidadManualBody,
  por: string
) {
  const entrada = limpiarJsonParaBd(entradaCruda);
  validarUrlExterna(entrada.url);

  const fuente = await asegurarFuente("manual");
  const nichoId = entrada.nichoSlug
    ? await nichoPorSlug(entrada.nichoSlug)
    : undefined;
  const dominio = dominioDeUrl(entrada.url);

  const resultado = await insertarOportunidad({
    fuenteId: fuente.id,
    nichoId,
    url: entrada.url,
    titulo: entrada.titulo ?? dominio,
    extracto: "",
    idioma: "es",
    objetivoPrincipal: entrada.objetivoPrincipal,
    datos: entrada.nota ? { nota: entrada.nota } : undefined,
    expiraEn: entrada.expiraEn,
  });
  if (resultado.creada) {
    await registrarDecision(prisma, {
      oportunidadId: resultado.id,
      accion: "anadir_url",
      motivo: entrada.nota ?? dominio,
      por,
    });
  }
  return resultado;
}

type FalloDeCompuerta = { codigo: CodigoDescarte; motivo: string };

/**
 * Las puertas duras al calificar: las decide el backend, no el prompt de
 * ningún agente. Dominio propio y competidor valen siempre; el umbral de
 * puntuación no se aplica a lo que añadió el administrador a mano.
 */
function compuertaDeCalificacion(
  oportunidad: { dominio: string; fuenteTipo: string },
  objetivo: Objetivo,
  puntuaciones: Puntuaciones,
  umbrales: Record<Objetivo, number>,
  competidores: readonly { nombre: string; dominio: string }[]
): FalloDeCompuerta | null {
  const dominioDeLaPagina = normalizarDominio(oportunidad.dominio);
  if (esHostDeAlhabla(dominioDeLaPagina)) {
    return {
      codigo: "dominio_propio",
      motivo: "Es una página de Alhabla.",
    };
  }
  const competidor = competidores.find((c) => {
    const dominio = normalizarDominio(c.dominio);
    return (
      dominioDeLaPagina === dominio || dominioDeLaPagina.endsWith(`.${dominio}`)
    );
  });
  if (competidor) {
    return {
      codigo: "competidor",
      motivo: `Es una página de un competidor (${competidor.nombre}).`,
    };
  }
  if (
    oportunidad.fuenteTipo !== "manual" &&
    puntuaciones[objetivo] < umbrales[objetivo]
  ) {
    return {
      codigo: "bajo_umbral",
      motivo: `Puntuación de ${objetivo} ${puntuaciones[objetivo]} por debajo del umbral ${umbrales[objetivo]}.`,
    };
  }
  return null;
}

/**
 * Cambio de estado del agente (`calificada`, `investigada`, `descartada`).
 * Al calificar aplica las puertas duras y puede descartar sola. Pedir el
 * estado en que ya está responde 200 sin efectos (reintentos de red).
 */
export async function transicionarComoAgente(
  id: string,
  cuerpoCrudo: EstadoBody,
  agente: { nombre: string }
) {
  let cuerpo = limpiarJsonParaBd(cuerpoCrudo);
  const a: Estado = cuerpo.a;
  const oportunidad = await prisma.growthOportunidad.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      dominio: true,
      objetivoPrincipal: true,
      puntTrafico: true,
      puntLeads: true,
      puntBacklinks: true,
      datos: true,
      fuente: { select: { tipo: true } },
    },
  });
  if (!oportunidad) throw new ErrorDeGrowth(404, "La oportunidad no existe.");
  // Calificar o investigar también puede llevar `datos.competidoresMencionados`:
  // se verifica igual que al crear (y se canoniza ANTES de comparar con lo
  // guardado, para que un reintento idéntico siga siendo un 200).
  if (cuerpo.datos?.competidoresMencionados) {
    cuerpo = {
      ...cuerpo,
      datos: await datosConMencionesVerificadas(cuerpo.datos),
    };
  }
  if (oportunidad.estado === a) {
    // Reintento de red: mismo estado y mismos datos, 200 sin efectos. Pero si
    // lo que llega es DISTINTO, el modelo cree que ha corregido la
    // calificación y no se ha tocado nada: se le dice.
    if (a === "calificada") {
      const diferencias = camposQueDifierenDeLaCalificacion(
        oportunidad,
        cuerpo
      );
      if (diferencias.length > 0) {
        throw new ErrorDeGrowth(
          409,
          `Ya está calificada con otros datos (${diferencias.join(", ")}): una calificación no se reescribe. Si estaba mal, descártala indicando el motivo.`,
          "ya_calificada",
          { diferencias }
        );
      }
    }
    return { id, estado: a };
  }
  if (!puedeTransicionar(oportunidad.estado, a, "agente")) {
    throw new ErrorDeGrowth(
      409,
      `Una oportunidad ${oportunidad.estado} no puede pasar a ${a}.`
    );
  }
  if (a === "descartada" && !cuerpo.motivo) {
    throw new ErrorDeGrowth(400, "Descartar exige un motivo.");
  }

  const por = porAgente(agente);

  if (a === "descartada") {
    const codigo = cuerpo.codigo ?? "otro";
    await prisma.$transaction(async (tx) => {
      await cambiarEstadoConGuardia(tx, {
        id,
        desde: oportunidad.estado,
        hasta: "descartada",
        actor: "agente",
        datos: {
          motivoDescarte: cuerpo.motivo,
          datos: fusionarDatos(oportunidad.datos, { codigoDescarte: codigo }),
        },
      });
      await registrarDecision(tx, {
        oportunidadId: id,
        accion: "descartar",
        motivo: cuerpo.motivo,
        por,
      });
    });
    return { id, estado: "descartada" as const };
  }

  // Calificar o investigar: aplica lo que el agente ha averiguado.
  const nichoId = cuerpo.nichoSlug
    ? await nichoPorSlug(cuerpo.nichoSlug)
    : undefined;
  const cambios = camposDeCalificacion(cuerpo, oportunidad.datos, nichoId);

  if (a === "calificada") {
    const objetivo = cuerpo.objetivoPrincipal ?? oportunidad.objetivoPrincipal;
    const puntuaciones = puntuacionesDe({
      puntTrafico: cuerpo.puntTrafico ?? oportunidad.puntTrafico,
      puntLeads: cuerpo.puntLeads ?? oportunidad.puntLeads,
      puntBacklinks: cuerpo.puntBacklinks ?? oportunidad.puntBacklinks,
    });
    const [ajustes, competidores] = await Promise.all([
      leerAjustesEfectivos(),
      // La puerta dura solo la aplican los competidores confirmados.
      prisma.growthCompetidor.findMany({
        where: COMPETIDOR_CONFIRMADO,
        select: { nombre: true, dominio: true },
      }),
    ]);
    const fallo = compuertaDeCalificacion(
      { dominio: oportunidad.dominio, fuenteTipo: oportunidad.fuente.tipo },
      objetivo,
      puntuaciones,
      ajustes.valores.umbralesPorObjetivo,
      competidores
    );
    if (fallo) {
      await prisma.$transaction(async (tx) => {
        await cambiarEstadoConGuardia(tx, {
          id,
          desde: oportunidad.estado,
          hasta: "descartada",
          actor: "agente",
          datos: {
            ...cambios,
            motivoDescarte: fallo.motivo,
            datos: fusionarDatos(
              (cuerpo.datos
                ? fusionarDatos(oportunidad.datos, cuerpo.datos)
                : oportunidad.datos) as Prisma.JsonValue | null,
              { codigoDescarte: fallo.codigo }
            ),
          },
        });
        await registrarDecision(tx, {
          oportunidadId: id,
          accion: "descartar",
          motivo: `[${fallo.codigo}] ${fallo.motivo}`,
          por: POR_SISTEMA,
        });
      });
      return {
        id,
        estado: "descartada" as const,
        descartadaPorReglas: true as const,
        codigoDescarte: fallo.codigo,
        motivoDescarte: fallo.motivo,
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    await cambiarEstadoConGuardia(tx, {
      id,
      desde: oportunidad.estado,
      hasta: a,
      actor: "agente",
      datos: cambios,
    });
    await registrarDecision(tx, {
      oportunidadId: id,
      accion: a === "calificada" ? "calificar" : "investigar",
      motivo: cuerpo.motivo,
      por,
    });
  });
  return { id, estado: a };
}

/**
 * Qué de lo que llega en una (re)calificación no coincide con lo ya guardado:
 * el objetivo, las puntuaciones y cada clave de `datos` que se envíe.
 */
function camposQueDifierenDeLaCalificacion(
  guardada: {
    objetivoPrincipal: Objetivo;
    puntTrafico: number;
    puntLeads: number;
    puntBacklinks: number;
    datos: Prisma.JsonValue | null;
  },
  cuerpo: CalificacionBody
): string[] {
  const diferencias: string[] = [];
  if (
    cuerpo.objetivoPrincipal !== undefined &&
    cuerpo.objetivoPrincipal !== guardada.objetivoPrincipal
  ) {
    diferencias.push("objetivoPrincipal");
  }
  for (const campo of ["puntTrafico", "puntLeads", "puntBacklinks"] as const) {
    if (cuerpo[campo] !== undefined && cuerpo[campo] !== guardada[campo]) {
      diferencias.push(campo);
    }
  }
  const datosGuardados = objetoJson(guardada.datos);
  for (const [clave, valor] of Object.entries(cuerpo.datos ?? {})) {
    if (!isDeepStrictEqual(datosGuardados[clave], valor)) {
      diferencias.push(`datos.${clave}`);
    }
  }
  return diferencias;
}

/** Lo que calificar o investigar escribe en la oportunidad. */
function camposDeCalificacion(
  cuerpo: CalificacionBody,
  datosActuales: Prisma.JsonValue | null,
  nichoId: string | undefined
): Prisma.GrowthOportunidadUncheckedUpdateManyInput {
  return {
    ...(cuerpo.objetivoPrincipal
      ? { objetivoPrincipal: cuerpo.objetivoPrincipal }
      : {}),
    ...(cuerpo.puntTrafico !== undefined
      ? { puntTrafico: cuerpo.puntTrafico }
      : {}),
    ...(cuerpo.puntLeads !== undefined ? { puntLeads: cuerpo.puntLeads } : {}),
    ...(cuerpo.puntBacklinks !== undefined
      ? { puntBacklinks: cuerpo.puntBacklinks }
      : {}),
    ...(cuerpo.idioma ? { idioma: cuerpo.idioma } : {}),
    ...(cuerpo.titulo ? { titulo: cuerpo.titulo } : {}),
    ...(cuerpo.extracto
      ? { extracto: recortarPorPuntosDeCodigo(cuerpo.extracto, 500) }
      : {}),
    ...(cuerpo.expiraEn ? { expiraEn: cuerpo.expiraEn } : {}),
    ...(nichoId ? { nichoId } : {}),
    ...(cuerpo.datos
      ? { datos: fusionarDatos(datosActuales, cuerpo.datos) }
      : {}),
  };
}

/** Las investigaciones solo se escriben mientras la oportunidad aún es del agente. */
const ESTADOS_QUE_ADMITEN_INVESTIGACION: readonly Estado[] = [
  "calificada",
  "investigada",
  "bloqueada",
  "devuelta",
];

export async function guardarInvestigacion(
  oportunidadId: string,
  datosCrudos: InvestigacionBody
) {
  const datos = limpiarJsonParaBd(datosCrudos);
  const oportunidad = await prisma.growthOportunidad.findUnique({
    where: { id: oportunidadId },
    select: { id: true, estado: true },
  });
  if (!oportunidad) throw new ErrorDeGrowth(404, "La oportunidad no existe.");
  if (!ESTADOS_QUE_ADMITEN_INVESTIGACION.includes(oportunidad.estado)) {
    throw new ErrorDeGrowth(
      409,
      `No se puede cambiar la investigación de una oportunidad ${oportunidad.estado}.`
    );
  }

  // La URL de contacto vive en `contexto`: el administrador sabe adónde
  // escribir sin que haga falta una columna ni se guarde ningún correo.
  const contexto = {
    ...(datos.contexto ?? {}),
    ...(datos.urlContacto ? { urlContacto: datos.urlContacto } : {}),
  } as Prisma.InputJsonObject;

  // PUT: lo que no viene se borra, no se conserva.
  const campos = {
    resumen: datos.resumen,
    quienEdita: datos.quienEdita ?? null,
    viaDeContacto: datos.viaDeContacto ?? null,
    competidoresEnlazados: datos.competidoresEnlazados ?? Prisma.DbNull,
    contexto: Object.keys(contexto).length > 0 ? contexto : Prisma.DbNull,
  };
  return prisma.growthInvestigacion.upsert({
    where: { oportunidadId },
    create: { oportunidadId, ...campos },
    update: campos,
    select: { oportunidadId: true },
  });
}

// ── Borradores (agente) ──────────────────────────────────────────────────

/**
 * Crea un borrador y lo somete a las reglas duras en la misma petición. Si
 * alguna falla, el borrador queda `bloqueado` (y la oportunidad `bloqueada`)
 * con el motivo; si no, pasa a `pendiente_aprobacion` para que lo revise el
 * fundador. El agente no puede saltarse esto: es el único camino.
 */
export async function crearBorrador(
  oportunidadId: string,
  datosCrudos: BorradorBody,
  agente: { nombre: string }
) {
  const datos = limpiarJsonParaBd(datosCrudos);
  const oportunidad = await prisma.growthOportunidad.findUnique({
    where: { id: oportunidadId },
    select: { id: true, estado: true, dominio: true, objetivoPrincipal: true },
  });
  if (!oportunidad) throw new ErrorDeGrowth(404, "La oportunidad no existe.");
  if (!puedeTransicionar(oportunidad.estado, "con_borrador", "agente")) {
    throw new ErrorDeGrowth(
      409,
      `No se puede redactar un borrador de una oportunidad ${oportunidad.estado}.`
    );
  }

  return prisma.$transaction(
    async (tx) => {
      // Mismo orden de bloqueo que aprobar y editar (ver arriba): sin esto,
      // crear un borrador a la vez que se edita el anterior se cruzaba.
      await adquirirCerrojosDeAprobacion(tx);
      // Primero se reclama la oportunidad: dos borradores a la vez sobre la
      // misma no pasan los dos, y solo quien la reclama numera la versión.
      await cambiarEstadoConGuardia(tx, {
        id: oportunidadId,
        desde: oportunidad.estado,
        hasta: "con_borrador",
        actor: "agente",
      });

      const evaluacion = await evaluarBorradorConContexto(
        {
          tipo: datos.tipo,
          objetivo: oportunidad.objetivoPrincipal,
          asunto: datos.asunto,
          texto: datos.texto,
          enlaceUrl: datos.enlaceUrl,
          utm: datos.utm,
          afirmaciones: datos.afirmaciones,
        },
        { dominio: oportunidad.dominio, oportunidadId, cliente: tx }
      );
      const { resultado, comprobaciones } = evaluacion;
      const bloquea = resultado === "bloquea";

      const version =
        (await tx.growthBorrador.count({ where: { oportunidadId } })) + 1;
      const borrador = await tx.growthBorrador.create({
        data: {
          oportunidadId,
          version,
          tipo: datos.tipo,
          objetivo: oportunidad.objetivoPrincipal,
          asunto: datos.asunto,
          texto: datos.texto,
          enlaceUrl: datos.enlaceUrl,
          utm: datos.utm as Prisma.InputJsonObject | undefined,
          afirmaciones: datos.afirmaciones,
          estado: bloquea ? "bloqueado" : "pendiente_aprobacion",
        },
        select: { id: true, version: true, estado: true },
      });
      // La versión nueva sustituye a las que quedaron bloqueadas o a medias.
      await tx.growthBorrador.updateMany({
        where: {
          oportunidadId,
          id: { not: borrador.id },
          estado: { in: ["bloqueado", "borrador"] },
        },
        data: { estado: "descartado" },
      });
      await tx.growthRevisionCumplimiento.create({
        data: {
          borradorId: borrador.id,
          resultado,
          comprobaciones: comprobaciones as unknown as Prisma.InputJsonValue,
          revisor: "reglas",
        },
      });
      const estadoFinal: Estado = bloquea
        ? "bloqueada"
        : "pendiente_aprobacion";
      await cambiarEstadoConGuardia(tx, {
        id: oportunidadId,
        desde: "con_borrador",
        hasta: estadoFinal,
        actor: "sistema",
      });

      await registrarDecision(tx, {
        oportunidadId,
        borradorId: borrador.id,
        accion: "redactar",
        motivo: `Versión ${version} (${datos.tipo})`,
        por: porAgente(agente),
      });
      if (bloquea) {
        await registrarDecision(tx, {
          oportunidadId,
          borradorId: borrador.id,
          accion: "bloquear_por_reglas",
          motivo: nombresDeReglasFallidas(comprobaciones),
          por: POR_SISTEMA,
        });
      }

      return {
        borrador,
        resultado,
        comprobaciones,
        oportunidad: { id: oportunidadId, estado: estadoFinal },
      };
    },
    { maxWait: 5000, timeout: 15000 }
  );
}

function nombresDeReglasFallidas(comprobaciones: readonly Comprobacion[]) {
  return comprobaciones
    .filter((c) => c.dura && !c.ok)
    .map((c) => c.regla)
    .join(", ");
}

// ── Lo que ve el administrador ───────────────────────────────────────────

const TODOS_LOS_ESTADOS = ESTADOS_DE_OPORTUNIDAD;

/** `{ estado: n }` con todos los estados, también los que no tienen nada. */
function conteoPorEstado(
  grupos: readonly { estado: Estado; _count: { _all: number } }[]
): Record<Estado, number> {
  const conteo = Object.fromEntries(
    TODOS_LOS_ESTADOS.map((e) => [e, 0])
  ) as Record<Estado, number>;
  for (const g of grupos) conteo[g.estado] = g._count._all;
  return conteo;
}

function comprobacionesDe(json: Prisma.JsonValue | undefined): Comprobacion[] {
  return Array.isArray(json) ? (json as unknown as Comprobacion[]) : [];
}

function diasHasta(fecha: Date | null, ahora: Date): number | null {
  return fecha
    ? Math.ceil((fecha.getTime() - ahora.getTime()) / MS_POR_DIA)
    : null;
}

const INCLUDE_DE_RESUMEN = {
  fuente: { select: { id: true, tipo: true, nombre: true } },
  nicho: { select: { id: true, slug: true, nombre: true } },
  borradores: {
    orderBy: { version: "desc" },
    take: 1,
    include: {
      // La última revisión de las reglas: las del modelo son solo consultivas
      // y no deben tapar un bloqueo.
      revisiones: {
        where: { revisor: "reglas" },
        orderBy: { creadaEn: "desc" },
        take: 1,
      },
    },
  },
} satisfies Prisma.GrowthOportunidadInclude;

type FilaDeResumen = Prisma.GrowthOportunidadGetPayload<{
  include: typeof INCLUDE_DE_RESUMEN;
}>;

export type OportunidadResumen = ReturnType<typeof resumenDeOportunidad>;

/** La forma en que el dashboard ve una oportunidad en un listado. */
export function resumenDeOportunidad(fila: FilaDeResumen, ahora = new Date()) {
  const puntuaciones = puntuacionesDe(fila);
  const borrador = fila.borradores[0] ?? null;
  const revision = borrador?.revisiones[0] ?? null;
  return {
    id: fila.id,
    url: fila.url,
    dominio: fila.dominio,
    titulo: fila.titulo,
    extracto: fila.extracto,
    extractoPurgado: fila.extracto === "" && fila.retencionHasta < ahora,
    idioma: fila.idioma,
    objetivoPrincipal: fila.objetivoPrincipal,
    estado: fila.estado,
    puntuacion: puntuaciones[fila.objetivoPrincipal],
    puntuaciones,
    datos: datosVisibles(fila.datos),
    detectadaEn: fila.detectadaEn,
    expiraEn: fila.expiraEn,
    diasParaCaducar: diasHasta(fila.expiraEn, ahora),
    motivoDescarte: fila.motivoDescarte,
    codigoDescarte: codigoDeDescarteDe(fila.datos),
    ejecucionId: fila.ejecucionId,
    fuente: fila.fuente,
    nicho: fila.nicho,
    borradorActual: borrador
      ? {
          id: borrador.id,
          version: borrador.version,
          tipo: borrador.tipo,
          estado: borrador.estado,
          editadoPorHumano: borrador.editadoPorHumano,
          resultado: revision?.resultado ?? null,
          reglasFallidas: comprobacionesDe(revision?.comprobaciones).filter(
            (c) => !c.ok
          ),
        }
      : null,
  };
}

const MAXIMO_DE_COINCIDENCIAS_POR_PUNTUACION = 5000;

/**
 * Prisma pasa `contains` a un `ILIKE` sin escapar: un «50%» o un «_x» buscados
 * por una persona funcionaban como comodines. Se escapan con la barra
 * invertida, que es el escape de LIKE por defecto en Postgres.
 */
export function escaparComodinesDeLike(texto: string): string {
  return texto.replace(/[\\%_]/g, "\\$&");
}

function dondeDeOportunidades(
  filtros: Pick<
    ListadoDeOportunidadesQuery,
    | "objetivo"
    | "nicho"
    | "tipoDestino"
    | "fuente"
    | "ejecucionId"
    | "dominio"
    | "menciona"
    | "q"
  >
): Prisma.GrowthOportunidadWhereInput {
  const buscado = escaparComodinesDeLike;
  return {
    ...(filtros.objetivo ? { objetivoPrincipal: filtros.objetivo } : {}),
    ...(filtros.nicho ? { nicho: { slug: filtros.nicho } } : {}),
    ...(filtros.tipoDestino
      ? { datos: { path: ["tipoDestino"], equals: filtros.tipoDestino } }
      : {}),
    ...(filtros.fuente ? { fuente: { tipo: filtros.fuente } } : {}),
    ...(filtros.ejecucionId ? { ejecucionId: filtros.ejecucionId } : {}),
    ...(filtros.dominio ? { dominio: normalizarDominio(filtros.dominio) } : {}),
    // En `AND` para no pisar el `datos` del filtro de `tipoDestino`. En
    // Postgres `array_contains` exige un array, no una cadena.
    ...(filtros.menciona
      ? {
          AND: [
            {
              datos: {
                path: ["competidoresMencionados"],
                array_contains: [normalizarDominio(filtros.menciona)],
              },
            },
          ],
        }
      : {}),
    ...(filtros.q
      ? {
          OR: [
            { titulo: { contains: buscado(filtros.q), mode: "insensitive" } },
            { dominio: { contains: buscado(filtros.q), mode: "insensitive" } },
            { url: { contains: buscado(filtros.q), mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

/**
 * El listado de la Bandeja: paginado, con las pestañas por estado contadas
 * con los mismos filtros (menos el de estado) y la puntuación del objetivo
 * principal, que es la que se compara con su umbral.
 */
export async function listarOportunidades(
  filtrosCrudos: ListadoDeOportunidadesQuery
): Promise<
  Pagina<OportunidadResumen> & {
    conteos: { porEstado: Record<Estado, number> };
  }
> {
  const filtros = limpiarJsonParaBd(filtrosCrudos);
  const ahora = new Date();
  const dondeSinEstado = dondeDeOportunidades(filtros);
  const donde: Prisma.GrowthOportunidadWhereInput = {
    ...dondeSinEstado,
    ...(filtros.estado ? { estado: { in: filtros.estado } } : {}),
  };
  const salto = (filtros.pagina - 1) * filtros.limite;

  const grupos = prisma.growthOportunidad.groupBy({
    by: ["estado"],
    where: dondeSinEstado,
    _count: { _all: true },
  });

  let filas: FilaDeResumen[];
  let total: number;

  if (filtros.orden === "puntuacion") {
    // Prisma no ordena por una expresión (la nota del objetivo principal):
    // se ordena en memoria sobre una consulta estrecha y solo se cargan
    // completas las filas de la página.
    const candidatas = await prisma.growthOportunidad.findMany({
      where: donde,
      take: MAXIMO_DE_COINCIDENCIAS_POR_PUNTUACION + 1,
      select: {
        id: true,
        objetivoPrincipal: true,
        puntTrafico: true,
        puntLeads: true,
        puntBacklinks: true,
        detectadaEn: true,
      },
    });
    if (candidatas.length > MAXIMO_DE_COINCIDENCIAS_POR_PUNTUACION) {
      throw new ErrorDeGrowth(
        400,
        "Hay demasiadas coincidencias para ordenar por puntuación: afina el filtro."
      );
    }
    const ordenadas = candidatas
      .map((c) => ({
        id: c.id,
        detectadaEn: c.detectadaEn.getTime(),
        puntuacion: puntuacionesDe(c)[c.objetivoPrincipal],
      }))
      .sort(
        (a, b) =>
          b.puntuacion - a.puntuacion ||
          b.detectadaEn - a.detectadaEn ||
          (a.id < b.id ? 1 : -1)
      );
    total = ordenadas.length;
    const ids = ordenadas.slice(salto, salto + filtros.limite).map((o) => o.id);
    const completas = ids.length
      ? await prisma.growthOportunidad.findMany({
          where: { id: { in: ids } },
          include: INCLUDE_DE_RESUMEN,
        })
      : [];
    const porId = new Map(completas.map((f) => [f.id, f]));
    filas = ids.flatMap((id) => porId.get(id) ?? []);
  } else {
    const orden: Prisma.GrowthOportunidadOrderByWithRelationInput[] =
      filtros.orden === "caducan"
        ? [
            { expiraEn: { sort: "asc", nulls: "last" } },
            { detectadaEn: "desc" },
            { id: "desc" },
          ]
        : [{ detectadaEn: "desc" }, { id: "desc" }];
    [filas, total] = await Promise.all([
      prisma.growthOportunidad.findMany({
        where: donde,
        orderBy: orden,
        skip: salto,
        take: filtros.limite,
        include: INCLUDE_DE_RESUMEN,
      }),
      prisma.growthOportunidad.count({ where: donde }),
    ]);
  }

  return {
    data: filas.map((f) => resumenDeOportunidad(f, ahora)),
    total,
    pagina: filtros.pagina,
    limite: filtros.limite,
    conteos: { porEstado: conteoPorEstado(await grupos) },
  };
}

// ── Detalle de una oportunidad ───────────────────────────────────────────

const INCLUDE_DE_DETALLE = {
  fuente: { select: { id: true, tipo: true, nombre: true } },
  nicho: { select: { id: true, slug: true, nombre: true } },
  ejecucion: {
    select: { id: true, disparador: true, estado: true, inicio: true },
  },
  investigacion: true,
  borradores: {
    orderBy: { version: "desc" },
    include: {
      revisiones: { orderBy: { creadaEn: "desc" } },
      gestion: true,
    },
  },
  decisiones: {
    orderBy: { en: "desc" },
    select: {
      id: true,
      borradorId: true,
      accion: true,
      motivo: true,
      por: true,
      en: true,
    },
  },
} satisfies Prisma.GrowthOportunidadInclude;

type BorradorConRelaciones = Prisma.GrowthBorradorGetPayload<{
  include: { revisiones: true; gestion: true };
}>;

/**
 * Cada borrador con las afirmaciones que cita (y si siguen vigentes, con su
 * fuente y commit) y su parecido con la versión anterior. `borradores` han de
 * ser TODAS las versiones de una misma oportunidad, de la más nueva a la más
 * antigua.
 */
export async function detallarBorradores(
  cliente: ClienteDeBd,
  borradores: readonly BorradorConRelaciones[]
) {
  const claves = [...new Set(borradores.flatMap((b) => b.afirmaciones))];
  const filas = claves.length
    ? await cliente.growthAfirmacion.findMany({
        where: { clave: { in: claves } },
        orderBy: { vigenteDesde: "desc" },
      })
    : [];

  const detalleDe = (clave: string) => {
    const coincidentes = filas.filter((f) => f.clave === clave);
    // La vigente si la hay; si no, la más reciente ya cerrada.
    const fila =
      coincidentes.find((f) => f.vigenteHasta === null) ?? coincidentes[0];
    return fila
      ? {
          clave,
          existe: true,
          tipo: fila.tipo,
          texto: fila.texto,
          valor: fila.valor,
          fuente: fila.fuente,
          commitSha: fila.commitSha,
          vigente: fila.vigenteHasta === null,
          vigenteDesde: fila.vigenteDesde,
          vigenteHasta: fila.vigenteHasta,
        }
      : {
          clave,
          existe: false,
          tipo: null,
          texto: null,
          valor: null,
          fuente: null,
          commitSha: null,
          vigente: false,
          vigenteDesde: null,
          vigenteHasta: null,
        };
  };

  return borradores.map((b, i) => {
    const anterior = borradores[i + 1];
    return {
      ...b,
      afirmacionesDetalle: b.afirmaciones.map(detalleDe),
      similitudConVersionAnterior: anterior
        ? Math.round(similitud(b.texto, anterior.texto) * 100) / 100
        : null,
    };
  });
}

/** ¿Se puede editar a mano este borrador? Solo el último, mientras nadie lo ha aprobado. */
export function esBorradorEditable(
  borrador: { estado: string; version: number },
  oportunidad: { estado: Estado },
  versionMaxima: number
): boolean {
  return (
    (borrador.estado === "bloqueado" ||
      borrador.estado === "pendiente_aprobacion") &&
    borrador.version === versionMaxima &&
    (oportunidad.estado === "bloqueada" ||
      oportunidad.estado === "pendiente_aprobacion")
  );
}

export type AccionDelAdministrador = DecisionBody["accion"];

export const ACCIONES_DEL_ADMINISTRADOR: readonly AccionDelAdministrador[] = [
  "aprobar",
  "devolver",
  "descartar",
  "marcar_gestionado",
  "conseguido",
  "sin_respuesta",
  "rechazado",
];

const ESTADO_POR_ACCION: Record<AccionDelAdministrador, Estado> = {
  aprobar: "aprobada",
  devolver: "devuelta",
  descartar: "descartada",
  marcar_gestionado: "gestionada",
  conseguido: "conseguida",
  sin_respuesta: "sin_respuesta",
  // El destino dijo que no: no hay estado propio, se cierra sin éxito y la
  // gestión guarda el resultado `rechazado`.
  rechazado: "sin_respuesta",
};

/** Una acción que el administrador puede llevar a cabo, o que quiere y una regla se lo impide. */
export type AccionDisponible = {
  accion: AccionDelAdministrador;
  habilitada: boolean;
  /** En español, solo si `habilitada` es `false`: por qué no se puede ahora. */
  motivo?: string;
};

/** Lo de la agenda que decide si se puede aprobar ahora (opcional). */
export type AgendaParaLasAcciones = {
  /** Hasta cuándo no se puede volver a contactar con el dominio (90 días desde la última gestión). */
  dominioEnEnfriamientoHasta?: Date | null;
  /** ¿Hay otra oportunidad del mismo dominio aprobada y sin gestionar? */
  otraAprobadaDelDominio?: boolean;
  contactosEstaSemana?: number;
  topeSemanal?: number;
};

/**
 * Los botones de la ficha: SOLO las acciones que se pueden alcanzar desde el
 * estado actual (las transiciones del administrador en la máquina de estados:
 * una oportunidad `aprobada` ofrece «marcar gestionado» y «descartar», no
 * «aprobar»), cada una con `habilitada` y, si una regla de hoy lo impide
 * (borrador bloqueado, oportunidad caducada, dominio en enfriamiento, tope
 * semanal, nada que gestionar), un `motivo` en español. Una acción que el
 * estado no admite no sale: no hay botón que pintar.
 */
export function accionesDisponibles(
  oportunidad: { estado: Estado; expiraEn: Date | null },
  borradores: readonly {
    estado: string;
    version: number;
    revisiones: readonly {
      revisor: string;
      resultado: string;
      creadaEn: Date;
    }[];
  }[],
  ahora = new Date(),
  agenda: AgendaParaLasAcciones = {}
): AccionDisponible[] {
  const permitidas = new Set(transicionesPosibles(oportunidad.estado, "admin"));
  const versionMaxima = Math.max(0, ...borradores.map((b) => b.version));
  const pendiente = borradores.find(
    (b) => b.estado === "pendiente_aprobacion" && b.version === versionMaxima
  );
  const ultimaDeReglas = pendiente?.revisiones
    .filter((r) => r.revisor === "reglas")
    .sort((a, b) => b.creadaEn.getTime() - a.creadaEn.getTime())[0];
  const caducada =
    oportunidad.expiraEn !== null && oportunidad.expiraEn < ahora;

  return ACCIONES_DEL_ADMINISTRADOR.filter((accion) =>
    permitidas.has(ESTADO_POR_ACCION[accion])
  ).map((accion): AccionDisponible => {
    let motivo: string | undefined;
    if (accion === "aprobar") {
      if (!pendiente) {
        motivo = "No hay ningún borrador pendiente de aprobación.";
      } else if (ultimaDeReglas?.resultado === "bloquea") {
        motivo = "El borrador está bloqueado por las reglas.";
      } else if (caducada) {
        motivo = "La oportunidad ha caducado.";
      } else if (
        agenda.dominioEnEnfriamientoHasta &&
        agenda.dominioEnEnfriamientoHasta > ahora
      ) {
        motivo = `Ya se contactó con este dominio: no se puede volver a escribir hasta el ${agenda.dominioEnEnfriamientoHasta.toISOString().slice(0, 10)}.`;
      } else if (agenda.otraAprobadaDelDominio) {
        motivo =
          "Ya hay otra oportunidad aprobada de este dominio pendiente de gestionar.";
      } else if (
        agenda.contactosEstaSemana !== undefined &&
        agenda.topeSemanal !== undefined &&
        agenda.contactosEstaSemana >= agenda.topeSemanal
      ) {
        motivo = `Se ha llegado al tope de ${agenda.topeSemanal} contactos esta semana.`;
      }
    } else if (
      accion === "marcar_gestionado" &&
      !borradores.some((b) => b.estado === "aprobado")
    ) {
      motivo = "No hay ningún borrador aprobado.";
    }
    return motivo
      ? { accion, habilitada: false, motivo }
      : { accion, habilitada: true };
  });
}

export async function detalleDeOportunidad(id: string) {
  const ahora = new Date();
  const oportunidad = await prisma.growthOportunidad.findUnique({
    where: { id },
    include: INCLUDE_DE_DETALLE,
  });
  if (!oportunidad) throw new ErrorDeGrowth(404, "La oportunidad no existe.");

  const [
    borradores,
    contactos,
    ajustes,
    gestionesDelDominio,
    otrasAprobadasDelDominio,
  ] = await Promise.all([
    detallarBorradores(prisma, oportunidad.borradores),
    contactosDeLaSemana(prisma, { ahora }),
    leerAjustesEfectivos(),
    prisma.growthGestion.findMany({
      where: {
        dominio: oportunidad.dominio,
        hechaEn: {
          gte: new Date(
            ahora.getTime() - DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO * MS_POR_DIA
          ),
        },
      },
      orderBy: { hechaEn: "desc" },
      take: 1,
      select: { hechaEn: true },
    }),
    prisma.growthOportunidad.count({
      where: {
        estado: "aprobada",
        dominio: oportunidad.dominio,
        id: { not: oportunidad.id },
      },
    }),
  ]);

  const versionMaxima = Math.max(
    0,
    ...oportunidad.borradores.map((b) => b.version)
  );
  const editable = oportunidad.borradores.find((b) =>
    esBorradorEditable(b, oportunidad, versionMaxima)
  );
  const puntuaciones = puntuacionesDe(oportunidad);
  const ultimaGestion = gestionesDelDominio[0];

  return {
    ...oportunidad,
    datos: datosVisibles(oportunidad.datos),
    codigoDescarte: codigoDeDescarteDe(oportunidad.datos),
    puntuacion: puntuaciones[oportunidad.objetivoPrincipal],
    puntuaciones,
    extractoPurgado:
      oportunidad.extracto === "" && oportunidad.retencionHasta < ahora,
    diasParaCaducar: diasHasta(oportunidad.expiraEn, ahora),
    borradores,
    borradorEditableId: editable?.id ?? null,
    acciones: accionesDisponibles(oportunidad, oportunidad.borradores, ahora, {
      dominioEnEnfriamientoHasta: ultimaGestion
        ? new Date(
            ultimaGestion.hechaEn.getTime() +
              DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO * MS_POR_DIA
          )
        : null,
      otraAprobadaDelDominio: (otrasAprobadasDelDominio ?? 0) > 0,
      contactosEstaSemana: contactos.total,
      topeSemanal: ajustes.valores.topeSemanal,
    }),
    contacto: {
      dominioEnEnfriamientoHasta: ultimaGestion
        ? new Date(
            ultimaGestion.hechaEn.getTime() +
              DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO * MS_POR_DIA
          ).toISOString()
        : null,
      contactosEstaSemana: contactos.total,
      topeSemanal: ajustes.valores.topeSemanal,
    },
  };
}

// ── Decisiones del administrador ─────────────────────────────────────────

export type Decision = DecisionBody;

const BORRADORES_ABIERTOS = [
  "borrador",
  "bloqueado",
  "pendiente_aprobacion",
  "aprobado",
] as const;

/** Las decisiones que cambian a la vez la oportunidad y sus borradores. */
const ACCIONES_QUE_ESCRIBEN_BORRADOR_Y_OPORTUNIDAD: readonly AccionDelAdministrador[] =
  ["aprobar", "marcar_gestionado", "devolver", "descartar"];

type ResultadoDeDecidir =
  { id: string; estado: Estado } | { bloqueo: Comprobacion[] };

/**
 * ORDEN DE BLOQUEO de Growth. Hay tres niveles de bloqueo en Postgres (los dos
 * primeros son cerrojos advisory de transacción) y se toman SIEMPRE en este
 * orden, nunca al revés:
 *
 *   1. `growth_aprobar`      (exclusivo) Todo el que escribe a la vez en un
 *                            borrador y en su oportunidad: aprobar, marcar
 *                            como gestionado, devolver, descartar, crear un
 *                            borrador y EDITAR un borrador a mano. Serializa
 *                            lo que mira la agenda («un contacto por dominio»,
 *                            tope semanal): con READ COMMITTED dos aprobaciones
 *                            a la vez leían las mismas cuentas y pasaban las
 *                            dos. Y evita el deadlock (40P01) de quien toca la
 *                            oportunidad y luego el borrador contra quien toca
 *                            el borrador y luego la oportunidad.
 *   2. `growth_conocimiento` (compartido) Los mismos. El sincronizador de
 *                            conocimiento lo toma en EXCLUSIVO: no cierra una
 *                            afirmación mientras alguien aprueba o crea un
 *                            borrador que la cita (y al revés), y no se cruza
 *                            con ellos al bloquear borradores.
 *   3. Las filas (oportunidad, borrador…), con `updateMany` condicional.
 *
 * El sincronizador toma solo el 2 y NUNCA el 1. Los jobs que cierran
 * oportunidades (caducidad) no tocan borradores y oportunidades en distinto
 * orden que estos, así que no los toman.
 */
export const CERROJO_DE_APROBACION = "growth_aprobar";
export const CERROJO_DE_CONOCIMIENTO = "growth_conocimiento";

/**
 * Toma los cerrojos en el orden documentado arriba. Llamar al PRINCIPIO de la
 * transacción, antes de leer nada de lo que se va a decidir. Por defecto toma
 * los dos (`conocimiento: true`): es lo que deben hacer aprobar, editar,
 * crear un borrador, devolver, descartar y marcar como gestionado.
 * `conocimiento: false` toma solo `growth_aprobar` y queda para quien no toca
 * borradores ni cita afirmaciones.
 */
export async function adquirirCerrojosDeAprobacion(
  tx: ClienteDeBd,
  opciones: { conocimiento?: boolean } = {}
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${CERROJO_DE_APROBACION}))`;
  if (opciones.conocimiento ?? true) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${CERROJO_DE_CONOCIMIENTO}))`;
  }
}

/**
 * Lo que decide el fundador. Todo ocurre en una transacción y deja una fila
 * en `growth_decisiones`, que nunca se edita ni se borra. Cada cambio de
 * estado es condicional (`updateMany` sobre el estado que se leyó): un doble
 * toque en el móvil da 409, no un 500.
 *
 * Aprobar REEVALÚA las reglas con el contexto de ahora: entre redactar y
 * aprobar pueden pasar semanas y una afirmación puede haberse cerrado.
 */
/**
 * Suma una nota a las que la gestión ya tiene (la de «marcar gestionado», por
 * ejemplo) sin pisarlas. Sin nota nueva no se toca la columna.
 */
export function sumarNota(
  previa: string | null,
  nueva: string | undefined
): string | undefined {
  if (!nueva) return undefined;
  return (previa ? `${previa}\n${nueva}` : nueva).slice(0, 2000);
}

export async function decidir(
  id: string,
  decisionCruda: Decision,
  por: string
): Promise<{ id: string; estado: Estado }> {
  const decision = limpiarJsonParaBd(decisionCruda);
  const resultado = await prisma.$transaction(
    (tx) => decidirEnTransaccion(tx, id, decision, por),
    { maxWait: 5000, timeout: 15000 }
  );
  // El bloqueo se persiste (revisión, borrador, oportunidad y decisión) y SOLO
  // después se responde el 409: lanzarlo dentro habría deshecho el bloqueo.
  if ("bloqueo" in resultado) {
    throw new ErrorDeGrowth(
      409,
      "El borrador ya no cumple las reglas y ha quedado bloqueado.",
      "cumplimiento",
      { comprobaciones: resultado.bloqueo }
    );
  }
  return resultado;
}

async function decidirEnTransaccion(
  tx: ClienteDeBd,
  id: string,
  decision: Decision,
  por: string
): Promise<ResultadoDeDecidir> {
  // Antes de leer nada: lo que se lee después de tomar el cerrojo ya incluye
  // lo que acaba de confirmar quien lo tenía.
  if (ACCIONES_QUE_ESCRIBEN_BORRADOR_Y_OPORTUNIDAD.includes(decision.accion)) {
    await adquirirCerrojosDeAprobacion(tx);
  }

  const oportunidad = await tx.growthOportunidad.findUnique({
    where: { id },
    include: {
      borradores: {
        include: {
          gestion: true,
          revisiones: {
            where: { revisor: "reglas" },
            orderBy: { creadaEn: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!oportunidad) throw new ErrorDeGrowth(404, "La oportunidad no existe.");

  const destino = ESTADO_POR_ACCION[decision.accion];
  if (!puedeTransicionar(oportunidad.estado, destino, "admin")) {
    throw new ErrorDeGrowth(
      409,
      `Una oportunidad ${oportunidad.estado} no admite «${decision.accion}».`
    );
  }
  const desde = oportunidad.estado;

  if (decision.accion === "aprobar") {
    return aprobar(tx, oportunidad, decision.borradorId, por);
  }

  let borradorId: string | undefined;
  let motivo: string | undefined;

  switch (decision.accion) {
    case "devolver":
    case "descartar": {
      motivo = decision.motivo;
      await cambiarEstadoConGuardia(tx, {
        id,
        desde,
        hasta: destino,
        actor: "admin",
        datos:
          decision.accion === "descartar"
            ? {
                motivoDescarte: decision.motivo,
                datos: fusionarDatos(oportunidad.datos, {
                  codigoDescarte: decision.codigo ?? "otro",
                }),
              }
            : undefined,
      });
      await tx.growthBorrador.updateMany({
        where: {
          oportunidadId: id,
          estado: { in: [...BORRADORES_ABIERTOS] },
        },
        data: { estado: "descartado" },
      });
      break;
    }
    case "marcar_gestionado": {
      const aprobado = oportunidad.borradores.find(
        (b) => b.estado === "aprobado"
      );
      if (!aprobado) {
        throw new ErrorDeGrowth(409, "No hay ningún borrador aprobado.");
      }
      borradorId = aprobado.id;
      motivo = decision.notas ?? `Canal: ${decision.canal}`;
      await cambiarEstadoConGuardia(tx, {
        id,
        desde,
        hasta: destino,
        actor: "admin",
      });
      try {
        await tx.growthGestion.create({
          data: {
            borradorId: aprobado.id,
            canal: decision.canal,
            dominio: oportunidad.dominio,
            hechaEn: decision.hechaEn ?? new Date(),
            notas: decision.notas,
          },
        });
      } catch (error) {
        // `borradorId` es único: dos gestiones del mismo borrador (doble toque).
        if (codigoDePrisma(error) === "P2002") {
          throw new ErrorDeGrowth(
            409,
            "Ese borrador ya está marcado como gestionado.",
            "conflicto"
          );
        }
        throw error;
      }
      // Lo que de verdad se envió, si no fue el texto aprobado.
      const textoFinal =
        decision.textoFinal &&
        decision.textoFinal.trim() !== aprobado.texto.trim()
          ? decision.textoFinal
          : undefined;
      await tx.growthBorrador.update({
        where: { id: aprobado.id },
        data: {
          estado: "gestionado",
          ...(textoFinal ? { textoFinal, editadoPorHumano: true } : {}),
        },
      });
      break;
    }
    case "conseguido":
    case "sin_respuesta":
    case "rechazado": {
      const gestionado = oportunidad.borradores.find(
        (b) => b.estado === "gestionado" && b.gestion
      );
      if (!gestionado?.gestion) {
        throw new ErrorDeGrowth(409, "No hay ninguna gestión registrada.");
      }
      borradorId = gestionado.id;
      motivo = decision.accion === "conseguido" ? undefined : decision.notas;
      await cambiarEstadoConGuardia(tx, {
        id,
        desde,
        hasta: destino,
        actor: "admin",
      });
      await tx.growthGestion.update({
        where: { id: gestionado.gestion.id },
        data:
          decision.accion === "conseguido"
            ? {
                resultado: "aceptado",
                urlConseguida: decision.urlConseguida,
                respuestaEn: new Date(),
              }
            : decision.accion === "rechazado"
              ? {
                  resultado: "rechazado",
                  respuestaEn: new Date(),
                  notas: sumarNota(gestionado.gestion.notas, decision.notas),
                }
              : {
                  resultado: "sin_respuesta",
                  notas: sumarNota(gestionado.gestion.notas, decision.notas),
                },
      });
      break;
    }
  }

  await registrarDecision(tx, {
    oportunidadId: id,
    borradorId,
    accion: decision.accion,
    motivo,
    por,
  });

  return { id, estado: destino };
}

/**
 * Las reglas de agenda de una evaluación como el error que las cuenta, o
 * `null` si ninguna impide actuar. Cada una tiene su código, para que el
 * dashboard y el MCP decidan sin leer el mensaje: `dominio_en_enfriamiento`
 * (se contactó con el dominio en los últimos 90 días; trae `hasta`),
 * `dominio_ya_aprobado` (otra oportunidad del dominio espera su gestión) y
 * `tope_semanal` (lo hecho más lo aprobado llega al tope). La evaluación ha
 * de haberse hecho con `agendaComoAviso: true`, y quien lanza el error no ha
 * de haber cambiado nada antes: es un 409 que no deja rastro.
 */
export function errorDeAgenda(
  evaluacion: Pick<ResultadoDeEvaluacion, "agenda" | "ajustes">
): ErrorDeGrowth | null {
  const ultimaGestion = evaluacion.agenda.gestionesDelDominio.reduce<
    Date | undefined
  >((ultima, fecha) => (!ultima || fecha > ultima ? fecha : ultima), undefined);
  if (ultimaGestion) {
    const hasta = new Date(
      ultimaGestion.getTime() +
        DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO * MS_POR_DIA
    );
    return new ErrorDeGrowth(
      409,
      `Ya se contactó con este dominio el ${ultimaGestion.toISOString().slice(0, 10)}: no se puede volver a escribir hasta el ${hasta.toISOString().slice(0, 10)}.`,
      "dominio_en_enfriamiento",
      { hasta: hasta.toISOString() }
    );
  }
  if (evaluacion.agenda.aprobadasDelDominio > 0) {
    return new ErrorDeGrowth(
      409,
      "Ya hay otra oportunidad aprobada de este dominio pendiente de gestionar.",
      "dominio_ya_aprobado"
    );
  }
  if (evaluacion.agenda.contactos.total >= evaluacion.ajustes.topeSemanal) {
    return new ErrorDeGrowth(
      409,
      `Se ha llegado al tope de ${evaluacion.ajustes.topeSemanal} contactos esta semana (hechos o aprobados).`,
      "tope_semanal"
    );
  }
  return null;
}

type OportunidadParaAprobar = Prisma.GrowthOportunidadGetPayload<{
  include: {
    borradores: {
      include: {
        gestion: true;
        revisiones: true;
      };
    };
  };
}>;

async function aprobar(
  tx: ClienteDeBd,
  oportunidad: OportunidadParaAprobar,
  borradorId: string,
  por: string
): Promise<ResultadoDeDecidir> {
  const id = oportunidad.id;
  const borrador = oportunidad.borradores.find((b) => b.id === borradorId);
  if (!borrador || borrador.estado !== "pendiente_aprobacion") {
    throw new ErrorDeGrowth(
      409,
      "Ese borrador no está pendiente de aprobación."
    );
  }
  const versionMaxima = Math.max(
    ...oportunidad.borradores.map((b) => b.version)
  );
  if (borrador.version !== versionMaxima) {
    throw new ErrorDeGrowth(
      409,
      "Solo se puede aprobar la última versión del borrador."
    );
  }

  // Un borrador cuya última revisión de las reglas bloquea no se aprueba, sea
  // cual sea su estado: es la red de seguridad si algo lo dejó mal marcado.
  const ultimaRevision = borrador.revisiones
    .filter((r) => r.revisor === "reglas")
    .sort((a, b) => b.creadaEn.getTime() - a.creadaEn.getTime())[0];
  if (ultimaRevision?.resultado === "bloquea") {
    throw new ErrorDeGrowth(
      409,
      "El borrador está bloqueado por las reglas.",
      "cumplimiento",
      { comprobaciones: comprobacionesDe(ultimaRevision.comprobaciones) }
    );
  }

  const ahora = new Date();
  if (
    oportunidad.expiraEn &&
    oportunidad.expiraEn.getTime() < ahora.getTime()
  ) {
    throw new ErrorDeGrowth(409, "La oportunidad ha caducado.", "caducada");
  }

  // Reglas con el contexto de ahora. Las reglas de agenda («un contacto por
  // dominio» y el tope semanal) salen como avisos: dependen de cuándo se
  // aprueba, no de lo que dice el texto, y tienen abajo su propio 409 sin
  // tocar ningún estado. Solo lo que falla por el texto bloquea el borrador.
  const evaluacion = await evaluarBorradorConContexto(
    {
      tipo: borrador.tipo,
      objetivo: borrador.objetivo,
      asunto: borrador.asunto,
      texto: borrador.texto,
      enlaceUrl: borrador.enlaceUrl,
      utm: borrador.utm,
      afirmaciones: borrador.afirmaciones,
    },
    {
      dominio: oportunidad.dominio,
      oportunidadId: id,
      excluirBorradorId: borrador.id,
      creadoEn: borrador.creadoEn,
      agendaComoAviso: true,
      cliente: tx,
      ahora,
    }
  );
  const fallosDelTextoDelBorrador = fallosDelTexto(evaluacion.comprobaciones);
  if (fallosDelTextoDelBorrador.length > 0) {
    await cambiarEstadoConGuardia(tx, {
      id,
      desde: oportunidad.estado,
      hasta: "bloqueada",
      actor: "sistema",
    });
    await tx.growthBorrador.update({
      where: { id: borrador.id },
      data: { estado: "bloqueado" },
    });
    await tx.growthRevisionCumplimiento.create({
      data: {
        borradorId: borrador.id,
        resultado: "bloquea",
        comprobaciones:
          evaluacion.comprobaciones as unknown as Prisma.InputJsonValue,
        revisor: "reglas",
      },
    });
    await registrarDecision(tx, {
      oportunidadId: id,
      borradorId: borrador.id,
      accion: "bloquear_por_reglas",
      motivo: `Al aprobar: ${nombresDeReglasFallidas(fallosDelTextoDelBorrador)}`,
      por: POR_SISTEMA,
    });
    return { bloqueo: evaluacion.comprobaciones };
  }

  // La agenda: 409 con su código, sin mutar nada (el borrador sigue pendiente).
  const deAgenda = errorDeAgenda(evaluacion);
  if (deAgenda) throw deAgenda;

  await cambiarEstadoConGuardia(tx, {
    id,
    desde: oportunidad.estado,
    hasta: "aprobada",
    actor: "admin",
  });
  // Solo se aprueba lo que se evaluó: si alguien lo editó entre medias, 409.
  const { count } = await tx.growthBorrador.updateMany({
    where: {
      id: borrador.id,
      estado: "pendiente_aprobacion",
      texto: borrador.texto,
      asunto: borrador.asunto,
      enlaceUrl: borrador.enlaceUrl,
      afirmaciones: { equals: borrador.afirmaciones },
    },
    data: { estado: "aprobado" },
  });
  if (count !== 1) {
    throw new ErrorDeGrowth(
      409,
      "El borrador ha cambiado mientras lo aprobabas. Vuelve a revisarlo.",
      "conflicto"
    );
  }
  await registrarDecision(tx, {
    oportunidadId: id,
    borradorId: borrador.id,
    accion: "aprobar",
    por,
  });
  return { id, estado: "aprobada" };
}
