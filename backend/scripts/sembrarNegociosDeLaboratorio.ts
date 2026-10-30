/**
 * Siembra en la BD de dev los negocios de prueba del laboratorio de prompt
 * (laboratorioDePrompt.negocios.ts): uno por cada forma distinta de negocio y
 * de llamada antigua que piden los guiones de la batería
 * (laboratorioDePrompt.escenarios.ts, campo `requiere`).
 *
 * Qué crea por negocio (todo con ids fijos, así que volver a correrlo deja el
 * mismo estado):
 * - el Business (modoDeAgenda «alhabla»: las citas solo viven en la BD; sin
 *   Stripe, sin calendario externo y sin número de Telnyx), su horario, sus
 *   ajustes de recepcionista y su información;
 * - un User dueño `lab-<clave>@alhabla.local`, con contraseña aleatoria que no
 *   se guarda en ninguna parte (el laboratorio y llamar_api_dev entran con un
 *   JWT de dev, no con contraseña);
 * - servicios, profesionales (con su nivel por servicio si el guion lo pide)
 *   y un Agent con el prompt gestionado que genera buildManagedAgentPrompt;
 * - las llamadas antiguas `lab-<clave>-NNNN` (voz) y los chats
 *   `whatsapp:chat:lab-<clave>-NNNN` que reparte el laboratorio, con el
 *   permiso de grabación y el número que pide cada guion;
 * - las citas y los clientes que hacen falta: las citas futuras de los
 *   guiones de cambiar y anular, el viernes a las 10 ocupado de la lista de
 *   espera y el cliente conocido.
 *
 * Nada de lo sembrado puede escribir a una persona:
 * - los teléfonos de cliente son los de ficción +1 555 0100–0199 y ningún
 *   negocio (salvo los dos de transferencia, que no reservan) tiene número de
 *   Telnyx, que es lo que exigen la confirmación por WhatsApp y el SMS;
 * - los avisos por reserva al dueño están desactivados, el dueño no tiene
 *   alta de WhatsApp y su email es `@alhabla.local`;
 * - todos los teléfonos de ficción (también los dos que dictan los guiones)
 *   y los móviles de los dos dueños de transferencia quedan con una baja
 *   (STOP) vigente en whatsapp_opt_outs, por si algo llegara a intentarlo; la
 *   siembra falla si alguno no la tiene. Las que crea llevan la marca
 *   `inboundMessageId = "lab-siembra"` y `--borrar` quita solo esas (una baja
 *   que ya existía, de quien sea, se queda).
 *
 * Uso (desde backend/):
 *   npx tsx scripts/sembrarNegociosDeLaboratorio.ts [--dry-run] [--solo a,b]
 *   npx tsx scripts/sembrarNegociosDeLaboratorio.ts --restablecer [--solo a,b]
 *   npx tsx scripts/sembrarNegociosDeLaboratorio.ts --borrar [--dry-run]
 *
 * - sin opciones: crea o deja como nuevos los negocios (borra y vuelve a crear
 *   todo lo de dentro de cada uno, así que también deshace lo que dejaron las
 *   repeticiones del laboratorio) y re-ocupa los próximos viernes;
 * - `--restablecer`: solo deshace lo que dejó el laboratorio (citas, avisos,
 *   permisos de grabación y recados) y vuelve a poner las citas sembradas,
 *   sin tocar los negocios ni las llamadas. El laboratorio lo hace solo
 *   (restablecerPlan) antes y después de cada repetición que reserva o anula
 *   en un negocio de laboratorio; a mano, por si una tanda se cortó;
 * - `--borrar`: quita los negocios sembrados (por sus ids fijos) y las bajas
 *   que creó; nada más.
 *
 * Solo contra la BD de dev: lee la DATABASE_URL del .env del checkout
 * principal, como el MCP (nunca la de la shell, que puede ser la de un
 * proxy de producción), exige que sea local, que la base sea «botbook» y el
 * puerto el del Docker de dev, y antes de escribir comprueba con
 * `current_database()` dentro de cada transacción que sigue siendo esa.
 */
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Prisma, type PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cargarEnv, urlDeBdDeDev } from "../mcp/entorno.js";
import {
  BUSINESS_TYPE_LABELS,
  type BusinessType,
} from "../src/lib/businessType.js";
import {
  BusinessScheduleSchema,
  WEEK_DAYS,
  type BusinessSchedule,
} from "../src/lib/businessSchedule.js";
import {
  buildManagedAgentPrompt,
  parseAgentSettings,
  type AgentSettings,
} from "../src/lib/managedAgentPrompt.js";
import {
  resolverIdiomas,
  saludoDelNegocio,
} from "../src/lib/idiomas/resolver.js";
import { cooficialDeLaZona } from "../src/lib/idiomas/zona.js";
import { recordatorioIncluido } from "../src/lib/planFeatures.js";
import { resolverTransferenciaAlDueno } from "../src/lib/transferenciaAlDueno.js";
import type { ModoDeTransferencia } from "../src/lib/transferenciaAlDueno.js";
import {
  BASE_DE_DATOS_DE_DEV,
  MARCA_DE_LAS_BAJAS_DE_LABORATORIO,
  NEGOCIOS_DE_LABORATORIO,
  PREFIJO_DEL_NOMBRE_DE_LABORATORIO,
  TELEFONOS_DE_CLIENTE_DE_LABORATORIO,
  TELEFONOS_DE_TRANSFERENCIA_DE_LABORATORIO,
  esTelefonoDeFiccion,
  exigirBaseDeDatosDeDev,
  negocioDeLaboratorio,
  telefonoDeFiccion,
  telefonoDelNegocioDeLaboratorio,
} from "./laboratorioDePrompt.negocios.js";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ZONA_HORARIA = "Europe/Madrid";
const CLAVE_LISTA_DE_ESPERA = "hueco_libre";

/** Cuántos viernes a las 10 se dejan ocupados en el negocio de la lista de
 * espera: «el viernes» puede ser hoy (si aún no han dado las 10) o el
 * siguiente. */
const VIERNES_OCUPADOS = 2;

/** Un jueves cabe una cita cada 30 minutos de 9:00 a 19:30. */
const HUECOS_DEL_JUEVES = 22;

const NOMBRES_DE_CLIENTES = [
  "Lucía",
  "Pablo",
  "Carmen",
  "Javier",
  "Elena",
  "Andrés",
  "Sofía",
  "Raúl",
  "Irene",
  "Daniel",
];

// ---------------------------------------------------------------------------
// Especificación de cada negocio
// ---------------------------------------------------------------------------

export interface ServicioDeSiembra {
  nombre: string;
  minutos: number;
  /** Céntimos; null = sin precio. */
  precioCentimos: number | null;
}

export interface ProfesionalDeSiembra {
  nombre: string;
  /** Nivel por nombre de servicio; sin entrada es «lo hace». */
  niveles?: Record<string, "ESPECIALISTA" | "NO_SUGERIR">;
}

/**
 * Qué llamadas antiguas tiene el negocio, según lo que pida el guion:
 * - `aceptados`: cada llamada, de un teléfono distinto que ya aceptó que le
 *   graben (check_availability no pregunta);
 * - `sin_decidir`: teléfonos que aún no han decidido (la pregunta de
 *   grabación sale en check_availability);
 * - `ocultos`: sin número (book_appointment pide el teléfono);
 * - `con_cita_futura`: cada llamada libre es de un teléfono distinto que
 *   tiene una cita el próximo jueves, reservada en otra llamada;
 * - `cliente_conocido`: todas del mismo teléfono, que ya reservó un Corte
 *   (con nombre y servicio guardados).
 */
export type TipoDeLlamadas =
  | "aceptados"
  | "sin_decidir"
  | "ocultos"
  | "con_cita_futura"
  | "cliente_conocido";

export interface EspecificacionDeNegocio {
  clave: string;
  tipoDeNegocio: BusinessType;
  direccion: string;
  informacion: string | null;
  voiceLanguage: "es-ES" | "ca-ES";
  darPrecios: "siempre" | "si_preguntan" | "nunca";
  pasarLlamadas?: ModoDeTransferencia;
  ocultarNumero?: boolean;
  horario: "abierto" | "cerrado";
  servicios: ServicioDeSiembra[];
  profesionales: ProfesionalDeSiembra[];
  llamadas: { tipo: TipoDeLlamadas; cantidad: number; chats: number };
  /** Deja ocupados a todos los profesionales el viernes a las 10. */
  ocuparViernesALas10?: boolean;
}

const SERVICIOS_DE_PELUQUERIA: ServicioDeSiembra[] = [
  { nombre: "Corte", minutos: 30, precioCentimos: null },
  { nombre: "Tinte", minutos: 60, precioCentimos: null },
  { nombre: "Mechas", minutos: 90, precioCentimos: 5500 },
  { nombre: "Peinado", minutos: 30, precioCentimos: 1200 },
  { nombre: "Recogido", minutos: 45, precioCentimos: 3500 },
];

const EQUIPO_DE_PELUQUERIA: ProfesionalDeSiembra[] = [
  { nombre: "Laura" },
  { nombre: "Montse" },
  { nombre: "Núria" },
];

const DIRECCION_DE_MADRID = "Calle de Alcalá 120, 28009 Madrid";
const DIRECCION_DE_BARCELONA = "Carrer de Muntaner 100, 08036 Barcelona";
const INFORMACION_SIN_PRECIOS =
  "Peluquería de barrio con cinco años en el barrio. Hay aparcamiento en la calle. Se puede pagar con tarjeta o en efectivo.";

function peluqueria(
  clave: string,
  cambios: Partial<EspecificacionDeNegocio> = {}
): EspecificacionDeNegocio {
  return {
    clave,
    tipoDeNegocio: "peluqueria",
    direccion: DIRECCION_DE_MADRID,
    informacion: INFORMACION_SIN_PRECIOS,
    voiceLanguage: "es-ES",
    darPrecios: "si_preguntan",
    horario: "abierto",
    servicios: SERVICIOS_DE_PELUQUERIA,
    profesionales: EQUIPO_DE_PELUQUERIA,
    llamadas: { tipo: "aceptados", cantidad: 40, chats: 0 },
    ...cambios,
  };
}

/**
 * Los negocios, en el orden de NEGOCIOS_DE_LABORATORIO. Los tamaños de las
 * llamadas salen de los guiones: los que reservan gastan una llamada cada
 * uno (una Call solo admite una cita), y con n = 10 y dos variantes son 20
 * por guion.
 */
export function especificaciones(): EspecificacionDeNegocio[] {
  return [
    // E1 E2 E3 E5a E7 E9 E10 E11 E12 E13 E16 E17 E25 E26: 7 guiones de voz
    // que reservan (140 con n = 10 y dos variantes), 9 de solo lectura y los
    // chats E7b y E25.
    peluqueria("peluqueria", {
      llamadas: { tipo: "aceptados", cantidad: 240, chats: 100 },
    }),
    // E4
    peluqueria("peluqueria-ca", {
      direccion: DIRECCION_DE_BARCELONA,
      voiceLanguage: "ca-ES",
      profesionales: [{ nombre: "Montse" }, { nombre: "Jordi" }],
    }),
    // E20: Laura no se sugiere en Corte y Montse es la especialista.
    peluqueria("peluqueria-especialidad", {
      llamadas: { tipo: "aceptados", cantidad: 60, chats: 0 },
      profesionales: [
        { nombre: "Laura", niveles: { Corte: "NO_SUGERIR" } },
        { nombre: "Montse", niveles: { Corte: "ESPECIALISTA" } },
        { nombre: "Núria" },
      ],
    }),
    // E8
    peluqueria("peluqueria-grabacion", {
      llamadas: { tipo: "sin_decidir", cantidad: 80, chats: 0 },
    }),
    // E14 E15
    peluqueria("peluqueria-cambios", {
      llamadas: { tipo: "con_cita_futura", cantidad: 60, chats: 0 },
    }),
    // E21
    peluqueria("peluqueria-telefono-oculto", {
      llamadas: { tipo: "ocultos", cantidad: 60, chats: 0 },
    }),
    // Dar precios: siempre (sin guion propio, pero lo pidió el dueño del
    // producto junto a los otros dos).
    peluqueria("precios-siempre", {
      darPrecios: "siempre",
      servicios: [
        { nombre: "Corte", minutos: 30, precioCentimos: 1800 },
        { nombre: "Tinte", minutos: 60, precioCentimos: 3000 },
        { nombre: "Mechas", minutos: 90, precioCentimos: 5500 },
        { nombre: "Peinado", minutos: 30, precioCentimos: 1200 },
      ],
    }),
    // E5b
    peluqueria("precios-preguntan", {
      darPrecios: "si_preguntan",
      informacion:
        "Peluquería de barrio. Tintes desde 30 €. Hay aparcamiento en la calle.",
      servicios: [
        { nombre: "Corte", minutos: 30, precioCentimos: null },
        { nombre: "Tinte", minutos: 60, precioCentimos: null },
        { nombre: "Mechas", minutos: 90, precioCentimos: 5500 },
        { nombre: "Peinado", minutos: 30, precioCentimos: 1200 },
      ],
    }),
    // E6
    peluqueria("precios-nunca", {
      darPrecios: "nunca",
      informacion:
        "Corte de mujer 18 €, corte de hombre 12 €, tintes desde 30 €. Se puede pagar con tarjeta o en efectivo.",
      servicios: [
        { nombre: "Corte", minutos: 30, precioCentimos: 1800 },
        { nombre: "Tinte", minutos: 60, precioCentimos: null },
        { nombre: "Mechas", minutos: 90, precioCentimos: 5500 },
      ],
    }),
    // E18a E18b
    peluqueria("privacidad", {
      ocultarNumero: true,
      llamadas: { tipo: "aceptados", cantidad: 40, chats: 60 },
    }),
    // E19a
    peluqueria("transferencia-si-lo-piden", { pasarLlamadas: "si_lo_pide" }),
    // E19b: ningún día abre, así que a cualquier hora está fuera de horario.
    peluqueria("transferencia-siempre", {
      pasarLlamadas: "siempre",
      horario: "cerrado",
    }),
    // E22a (E22b no está disponible: ver ESCENARIOS_NO_DISPONIBLES)
    peluqueria("lista-de-espera", {
      profesionales: [{ nombre: "Laura" }, { nombre: "Montse" }],
      ocuparViernesALas10: true,
    }),
    // E23a E23b
    peluqueria("cliente-conocido", {
      llamadas: { tipo: "cliente_conocido", cantidad: 60, chats: 0 },
    }),
    // E24a E24b
    {
      clave: "fisioterapia",
      tipoDeNegocio: "fisioterapia",
      direccion: DIRECCION_DE_MADRID,
      informacion:
        "Clínica de fisioterapia con cita previa. La consulta es accesible y tiene ascensor.",
      voiceLanguage: "es-ES",
      darPrecios: "si_preguntan",
      horario: "abierto",
      servicios: [
        { nombre: "Primera visita", minutos: 60, precioCentimos: 4500 },
        { nombre: "Sesión de fisioterapia", minutos: 45, precioCentimos: 4000 },
        { nombre: "Masaje terapéutico", minutos: 30, precioCentimos: 3000 },
      ],
      profesionales: [{ nombre: "Carlos" }, { nombre: "Elena" }],
      llamadas: { tipo: "aceptados", cantidad: 40, chats: 0 },
    },
  ];
}

// ---------------------------------------------------------------------------
// Fechas en la zona del negocio
// ---------------------------------------------------------------------------

export interface FechaLocal {
  anio: number;
  mes: number;
  dia: number;
}

const DIA_DE_LA_SEMANA: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function partesLocales(instante: Date, zona: string) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: zona,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return {
    anio: Number(valor("year")),
    mes: Number(valor("month")),
    dia: Number(valor("day")),
    hora: Number(valor("hour")),
    minuto: Number(valor("minute")),
    segundo: Number(valor("second")),
    diaDeLaSemana: DIA_DE_LA_SEMANA[valor("weekday")] ?? 0,
  };
}

/** Cuánto se adelanta la hora de la zona al UTC en ese instante, en ms. */
function desfaseDeLaZona(instanteMs: number, zona: string): number {
  const p = partesLocales(new Date(instanteMs), zona);
  const comoUtc = Date.UTC(
    p.anio,
    p.mes - 1,
    p.dia,
    p.hora,
    p.minuto,
    p.segundo
  );
  return comoUtc - Math.floor(instanteMs / 1000) * 1000;
}

/** El instante UTC en que en `zona` son las `hora`:`minuto` de esa fecha. */
export function instanteDeHoraLocal(
  fecha: FechaLocal,
  hora: number,
  minuto: number,
  zona: string = ZONA_HORARIA
): Date {
  const aproximado = Date.UTC(
    fecha.anio,
    fecha.mes - 1,
    fecha.dia,
    hora,
    minuto
  );
  // Dos pasadas: el desfase puede ser otro (cambio de hora) en el resultado.
  const primero = aproximado - desfaseDeLaZona(aproximado, zona);
  return new Date(aproximado - desfaseDeLaZona(primero, zona));
}

export function fechaLocalDe(
  instante: Date,
  zona: string = ZONA_HORARIA
): FechaLocal {
  const { anio, mes, dia } = partesLocales(instante, zona);
  return { anio, mes, dia };
}

export function sumarDias(fecha: FechaLocal, dias: number): FechaLocal {
  const resultado = new Date(
    Date.UTC(fecha.anio, fecha.mes - 1, fecha.dia + dias)
  );
  return {
    anio: resultado.getUTCFullYear(),
    mes: resultado.getUTCMonth() + 1,
    dia: resultado.getUTCDate(),
  };
}

export function diaDeLaSemanaDe(fecha: FechaLocal): number {
  return new Date(Date.UTC(fecha.anio, fecha.mes - 1, fecha.dia)).getUTCDay();
}

/** El próximo día de esa semana (0 = domingo … 6 = sábado), estrictamente
 * posterior a hoy. */
export function proximoDiaDeLaSemana(
  ahora: Date,
  diaDeLaSemana: number,
  zona: string = ZONA_HORARIA
): FechaLocal {
  const hoy = fechaLocalDe(ahora, zona);
  for (let dias = 1; dias <= 7; dias++) {
    const fecha = sumarDias(hoy, dias);
    if (diaDeLaSemanaDe(fecha) === diaDeLaSemana) return fecha;
  }
  throw new Error("[Laboratorio] No se encontró el día de la semana");
}

/** Los próximos `cantidad` viernes a las 10 que aún no han pasado (el de hoy
 * cuenta si todavía no son las 10). */
export function proximosViernesALas10(
  ahora: Date,
  cantidad: number = VIERNES_OCUPADOS,
  zona: string = ZONA_HORARIA
): Date[] {
  const hoy = fechaLocalDe(ahora, zona);
  const viernes: Date[] = [];
  for (let dias = 0; viernes.length < cantidad && dias < 40; dias++) {
    const fecha = sumarDias(hoy, dias);
    if (diaDeLaSemanaDe(fecha) !== 5) continue;
    const instante = instanteDeHoraLocal(fecha, 10, 0, zona);
    if (instante.getTime() > ahora.getTime()) viernes.push(instante);
  }
  return viernes;
}

// ---------------------------------------------------------------------------
// Plan de lo que se crea (puro)
// ---------------------------------------------------------------------------

export interface LlamadaDeSiembra {
  /** Es también el `Call.id`: Booking.callId apunta a él. */
  callId: string;
  voiceProvider: "telnyx" | "whatsapp";
  fromNumber: string | null;
  startedAt: Date;
  /** null = sin decidir; el valor con que arranca y al que `--restablecer`
   * deja la llamada. */
  grabacionPermitida: boolean | null;
  /** Tiene una cita sembrada (historial, bloqueo): el laboratorio no la usa
   * (solo reparte llamadas sin cita). */
  conCita: boolean;
}

export interface CitaDeSiembra {
  id: string;
  callId: string;
  programedAt: Date;
  durationMinutes: number;
  clientName: string;
  servicio: string;
  profesional: string | null;
}

export interface PlanDeNegocio {
  clave: string;
  id: string;
  nombre: string;
  /** `Business` listo para guardar. */
  negocio: Prisma.BusinessUncheckedCreateInput;
  emailDelDueno: string;
  agente: {
    id: string;
    nombre: string;
    systemPrompt: string;
    firstMessage: string;
  };
  servicios: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    priceCents: number | null;
  }>;
  profesionales: Array<{ id: string; name: string }>;
  niveles: Array<{
    professionalId: string;
    serviceId: string;
    level: "ESPECIALISTA" | "NO_SUGERIR";
  }>;
  llamadas: LlamadaDeSiembra[];
  citas: CitaDeSiembra[];
  /** Teléfonos con el permiso de grabación dado (ClienteDelNegocio). */
  clientesQueAceptaron: string[];
  resumen: {
    llamadasLibres: number;
    chatsLibres: number;
    llamadasConCita: number;
    citas: number;
    telefonosDistintos: number;
  };
}

export interface OpcionesDeSiembra {
  ahora: Date;
  /** ¿Está aprobada la plantilla hueco_libre? Solo entra en el prompt. */
  listaDeEspera: boolean;
}

function horarioDe(tipo: "abierto" | "cerrado"): BusinessSchedule {
  const abierto = tipo === "abierto";
  return BusinessScheduleSchema.parse({
    version: 1,
    week: Object.fromEntries(
      WEEK_DAYS.map((dia) => [
        dia,
        {
          enabled: abierto,
          intervals: abierto ? [{ start: "09:00", end: "20:00" }] : [],
        },
      ])
    ),
    exceptions: [],
  });
}

function numero(indice: number, ancho = 4): string {
  return String(indice).padStart(ancho, "0");
}

function elementoDe<T>(lista: readonly T[], indice: number): T {
  return lista[indice % lista.length]!;
}

/** Qué teléfono tiene la llamada libre número `indice` (0, 1, 2…). */
function telefonoDeLaLlamada(
  tipo: TipoDeLlamadas,
  indice: number
): string | null {
  switch (tipo) {
    case "ocultos":
      return null;
    case "cliente_conocido":
      return telefonoDeFiccion(0);
    default:
      return telefonoDeFiccion(indice);
  }
}

function grabacionPermitidaDe(tipo: TipoDeLlamadas): boolean | null {
  return tipo === "sin_decidir" ? null : true;
}

const PRIMERA_CLAVE_DE_TRANSFERENCIA = Object.keys(
  TELEFONOS_DE_TRANSFERENCIA_DE_LABORATORIO
);

export function planificarSiembra(
  especificacion: EspecificacionDeNegocio,
  opciones: OpcionesDeSiembra
): PlanDeNegocio {
  const { clave } = especificacion;
  const contrato = negocioDeLaboratorio(clave);
  const posicion = NEGOCIOS_DE_LABORATORIO.findIndex((n) => n.clave === clave);
  const { ahora } = opciones;

  // --- Ajustes de la recepcionista, como los guarda PATCH /business/me ---
  const ajustes: AgentSettings = parseAgentSettings({
    version: 1,
    tone: "warm",
    primaryGoal: "bookings",
    responseStyle: "concise",
    escalation: "take_message",
    voiceGender: "femenina",
    voiceLanguage: especificacion.voiceLanguage,
    darPrecios: especificacion.darPrecios,
    versionDelPrompt: "v1",
    ...(especificacion.pasarLlamadas
      ? { pasarLlamadas: especificacion.pasarLlamadas }
      : {}),
  });

  // --- Dueño y teléfonos: nada que pueda recibir un mensaje ---
  const transferencia = PRIMERA_CLAVE_DE_TRANSFERENCIA.includes(clave)
    ? TELEFONOS_DE_TRANSFERENCIA_DE_LABORATORIO[
        clave as keyof typeof TELEFONOS_DE_TRANSFERENCIA_DE_LABORATORIO
      ]
    : null;
  const telefonoDelNegocio = telefonoDelNegocioDeLaboratorio(posicion);

  const negocio: Prisma.BusinessUncheckedCreateInput = {
    id: contrato.id,
    name: contrato.nombre,
    phone: telefonoDelNegocio,
    timezone: ZONA_HORARIA,
    schedule: horarioDe(
      especificacion.horario
    ) as unknown as Prisma.InputJsonValue,
    plan: "pro",
    active: true,
    businessDetails: especificacion.informacion,
    agentSettings: ajustes as unknown as Prisma.InputJsonValue,
    // Los profesionales son el límite real; la capacidad no estorba.
    bookingCapacity: especificacion.profesionales.length,
    businessType: especificacion.tipoDeNegocio,
    modoDeAgenda: "alhabla",
    address: especificacion.direccion,
    hideOwnerNumberFromClients: especificacion.ocultarNumero === true,
    // Ni aviso por reserva ni nada: el dueño no tiene alta de WhatsApp y su
    // email es @alhabla.local.
    notificationPrefs: { avisoPorReserva: false },
    ...(transferencia
      ? {
          customerLineType: "alhabla",
          telnyxPhoneNumber: transferencia.origen,
          ownerWhatsappNumber: transferencia.movilDelDueno,
        }
      : {}),
  };

  // --- Servicios y profesionales (ids fijos) ---
  const servicios = especificacion.servicios.map((servicio, i) => ({
    id: `lab-${clave}-servicio-${numero(i + 1, 2)}`,
    name: servicio.nombre,
    durationMinutes: servicio.minutos,
    priceCents: servicio.precioCentimos,
  }));
  const profesionales = especificacion.profesionales.map((profesional, i) => ({
    id: `lab-${clave}-profesional-${numero(i + 1, 2)}`,
    name: profesional.nombre,
  }));
  const idDelServicio = (nombre: string): string => {
    const encontrado = servicios.find((s) => s.name === nombre);
    if (!encontrado) {
      throw new Error(`[Laboratorio] ${clave}: no hay servicio «${nombre}»`);
    }
    return encontrado.id;
  };
  const niveles = especificacion.profesionales.flatMap((profesional, i) =>
    Object.entries(profesional.niveles ?? {}).map(([servicio, level]) => ({
      professionalId: profesionales[i]!.id,
      serviceId: idDelServicio(servicio),
      level,
    }))
  );

  // --- El prompt del Agent, como lo sincroniza telnyxAgentSync.ts ---
  const idiomas = resolverIdiomas({
    ...ajustes,
    zona: cooficialDeLaZona({
      address: especificacion.direccion,
      businessDetails: especificacion.informacion,
    }),
  });
  const transferenciaAlDueno = resolverTransferenciaAlDueno(
    {
      customerLineType: negocio.customerLineType,
      phone: telefonoDelNegocio,
      telnyxPhoneNumber: negocio.telnyxPhoneNumber,
      ownerWhatsappNumber: negocio.ownerWhatsappNumber,
      ownerPhoneIsCustomerLine: false,
    },
    ajustes.pasarLlamadas
  );
  const systemPrompt = buildManagedAgentPrompt({
    businessName: contrato.nombre,
    businessDetails: especificacion.informacion,
    businessType: especificacion.tipoDeNegocio,
    settings: ajustes,
    timezone: ZONA_HORARIA,
    minAdvanceBookingMinutes: null,
    maxAppointmentDurationMinutes: null,
    listaDeEspera: opciones.listaDeEspera,
    recordatorioPorWhatsapp: recordatorioIncluido({ plan: "pro" }),
    ocultarNumeroDelNegocio: negocio.hideOwnerNumberFromClients === true,
    transferenciaAlDueno,
    idiomas: idiomas.idiomas,
  });
  const agente = {
    id: `lab-${clave}-agente`,
    nombre: `${contrato.nombre} · ${BUSINESS_TYPE_LABELS[especificacion.tipoDeNegocio]}`,
    systemPrompt,
    firstMessage: saludoDelNegocio(idiomas, contrato.nombre),
  };

  // --- Llamadas libres, chats y lo que las acompaña ---
  const { tipo, cantidad, chats } = especificacion.llamadas;
  const llamadas: LlamadaDeSiembra[] = [];
  const citas: CitaDeSiembra[] = [];
  const clientes = new Set<string>();
  const MINUTO_MS = 60_000;
  const DIA_MS = 24 * 60 * MINUTO_MS;

  for (let i = 0; i < cantidad; i++) {
    const telefono = telefonoDeLaLlamada(tipo, i);
    llamadas.push({
      callId: `lab-${clave}-${numero(i + 1)}`,
      voiceProvider: "telnyx",
      fromNumber: telefono,
      // La más reciente primero: es la que reparte antes el laboratorio.
      startedAt: new Date(ahora.getTime() - (i + 1) * 15 * MINUTO_MS),
      grabacionPermitida: grabacionPermitidaDe(tipo),
      conCita: false,
    });
    if (telefono && tipo !== "sin_decidir") clientes.add(telefono);
  }
  for (let i = 0; i < chats; i++) {
    const telefono = telefonoDeFiccion(50 + i);
    llamadas.push({
      callId: `whatsapp:chat:lab-${clave}-${numero(i + 1)}`,
      voiceProvider: "whatsapp",
      fromNumber: telefono,
      startedAt: new Date(ahora.getTime() - (i + 1) * 20 * MINUTO_MS),
      grabacionPermitida: null,
      conCita: false,
    });
  }

  const corte = servicios.find((s) => s.name === "Corte");

  // Cambiar y anular: una cita el próximo jueves por cada teléfono, en la
  // llamada de historial de ese teléfono (una Call solo admite una cita).
  // Se reparten en huecos de 30 minutos entre los profesionales para que no
  // se solapen. Todas a nombre del cliente del contrato: con nombre, quien
  // llama es un cliente conocido (lib/contextoDeLlamada.ts) y el laboratorio
  // le saluda por él; con el mismo en todas, el assistant de prueba lleva
  // las mismas variables para todas las llamadas.
  if (tipo === "con_cita_futura" && corte) {
    const jueves = proximoDiaDeLaSemana(ahora, 4);
    for (let i = 0; i < cantidad; i++) {
      const callId = `lab-${clave}-historial-${numero(i + 1)}`;
      const hueco = i % HUECOS_DEL_JUEVES;
      const profesional =
        profesionales[
          Math.floor(i / HUECOS_DEL_JUEVES) % profesionales.length
        ]!;
      llamadas.push({
        callId,
        voiceProvider: "telnyx",
        fromNumber: telefonoDeFiccion(i),
        startedAt: new Date(ahora.getTime() - ((10 + i) * DIA_MS) / 10),
        grabacionPermitida: true,
        conCita: true,
      });
      citas.push({
        id: `lab-${clave}-cita-${numero(i + 1)}`,
        callId,
        programedAt: instanteDeHoraLocal(
          jueves,
          9 + Math.floor(hueco / 2),
          (hueco % 2) * 30
        ),
        durationMinutes: corte.durationMinutes,
        clientName:
          contrato.variablesDeLaLlamada?.nombre_cliente ??
          elementoDe(NOMBRES_DE_CLIENTES, i),
        servicio: corte.name,
        profesional: profesional.name,
      });
      clientes.add(telefonoDeFiccion(i));
    }
  }

  // Cliente conocido: Marta reservó un Corte con Laura hace tres semanas.
  if (tipo === "cliente_conocido" && corte) {
    const callId = `lab-${clave}-historial-0001`;
    llamadas.push({
      callId,
      voiceProvider: "telnyx",
      fromNumber: telefonoDeFiccion(0),
      startedAt: new Date(ahora.getTime() - 21 * DIA_MS),
      grabacionPermitida: true,
      conCita: true,
    });
    citas.push({
      id: `lab-${clave}-cita-0001`,
      callId,
      programedAt: new Date(ahora.getTime() - 20 * DIA_MS),
      durationMinutes: corte.durationMinutes,
      clientName: "Marta",
      servicio: corte.name,
      profesional: "Laura",
    });
  }

  // Lista de espera: todos los profesionales ocupados el viernes a las 10.
  if (especificacion.ocuparViernesALas10 && corte) {
    let numeroDeBloqueo = 0;
    for (const viernes of proximosViernesALas10(ahora)) {
      for (const profesional of profesionales) {
        numeroDeBloqueo++;
        const callId = `lab-${clave}-bloqueo-${numero(numeroDeBloqueo, 2)}`;
        llamadas.push({
          callId,
          voiceProvider: "telnyx",
          fromNumber: telefonoDeFiccion(90 + numeroDeBloqueo),
          startedAt: new Date(ahora.getTime() - 3 * DIA_MS),
          grabacionPermitida: true,
          conCita: true,
        });
        citas.push({
          id: `lab-${clave}-cita-${numero(numeroDeBloqueo, 2)}`,
          callId,
          programedAt: viernes,
          durationMinutes: 60,
          clientName: `Cliente ocupado ${numeroDeBloqueo}`,
          servicio: corte.name,
          profesional: profesional.name,
        });
      }
    }
  }

  const libres = llamadas.filter((l) => !l.conCita);
  return {
    clave,
    id: contrato.id,
    nombre: contrato.nombre,
    negocio,
    emailDelDueno: `lab-${clave}@alhabla.local`,
    agente,
    servicios,
    profesionales,
    niveles,
    llamadas,
    citas,
    clientesQueAceptaron: [...clientes],
    resumen: {
      llamadasLibres: libres.filter((l) => l.voiceProvider === "telnyx").length,
      chatsLibres: libres.filter((l) => l.voiceProvider === "whatsapp").length,
      llamadasConCita: llamadas.filter((l) => l.conCita).length,
      citas: citas.length,
      telefonosDistintos: new Set(
        llamadas.map((l) => l.fromNumber).filter(Boolean)
      ).size,
    },
  };
}

export function planificarTodo(
  opciones: OpcionesDeSiembra,
  solo?: readonly string[]
): PlanDeNegocio[] {
  const claves = especificaciones().map((e) => e.clave);
  for (const pedida of solo ?? []) {
    if (!claves.includes(pedida)) {
      throw new ErrorDeUso(
        `No hay negocio «${pedida}» (hay ${claves.join(", ")})`
      );
    }
  }
  return especificaciones()
    .filter((e) => !solo || solo.includes(e.clave))
    .map((e) => planificarSiembra(e, opciones));
}

/** Los números a los que se ponen bajas: todos los de ficción y los móviles
 * de los dueños de transferencia. */
export function telefonosConBaja(): Array<{
  telefono: string;
  audiencia: "client" | "owner";
}> {
  return [
    ...TELEFONOS_DE_CLIENTE_DE_LABORATORIO.map((telefono) => ({
      telefono,
      audiencia: "client" as const,
    })),
    ...Object.values(TELEFONOS_DE_TRANSFERENCIA_DE_LABORATORIO).map(
      ({ movilDelDueno }) => ({
        telefono: movilDelDueno,
        audiencia: "owner" as const,
      })
    ),
  ];
}

/**
 * Comprueba que nada de lo planificado puede escribir a una persona: ningún
 * teléfono de cliente fuera de la ficción, ningún negocio con número de
 * Telnyx salvo los dos de transferencia, y el dueño sin alta. Lanza con la
 * primera violación.
 */
export function exigirSiembraSinDestinatarios(planes: PlanDeNegocio[]): void {
  for (const plan of planes) {
    const conTransferencia = PRIMERA_CLAVE_DE_TRANSFERENCIA.includes(
      plan.clave
    );
    if (plan.negocio.telnyxPhoneNumber && !conTransferencia) {
      throw new Error(
        `[Laboratorio] ${plan.clave} tiene número de Telnyx y no es de transferencia: enviaría mensajes`
      );
    }
    // Los dos de transferencia tienen número de Telnyx (la tool lo exige) y
    // por eso no pueden tener citas con consentimiento hacia un teléfono
    // real: sus llamadas son de ficción y las bajas del STOP las cubren.
    if (conTransferencia && plan.citas.length > 0) {
      throw new Error(
        `[Laboratorio] ${plan.clave} tiene número de Telnyx: no puede llevar citas sembradas`
      );
    }
    if (
      plan.negocio.ownerWhatsappOptInAt ||
      (plan.negocio.notificationPrefs as { avisoPorReserva?: boolean })
        .avisoPorReserva !== false
    ) {
      throw new Error(
        `[Laboratorio] ${plan.clave}: el dueño no puede tener alta de WhatsApp ni avisos por reserva`
      );
    }
    for (const llamada of plan.llamadas) {
      if (
        llamada.fromNumber !== null &&
        !esTelefonoDeFiccion(llamada.fromNumber)
      ) {
        throw new Error(
          `[Laboratorio] ${plan.clave}: ${llamada.callId} usa ${llamada.fromNumber}, que no es un teléfono de ficción`
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Argumentos y guardas
// ---------------------------------------------------------------------------

export class ErrorDeUso extends Error {}

export interface Opciones {
  ayuda: boolean;
  borrar: boolean;
  restablecer: boolean;
  dryRun: boolean;
  solo: string[] | null;
}

export const AYUDA = `Siembra de los negocios de prueba del laboratorio de prompt

  npx tsx scripts/sembrarNegociosDeLaboratorio.ts [opciones]

  (sin opciones)    crea o deja como nuevos los negocios y re-ocupa los viernes
  --restablecer     deshace lo que dejó el laboratorio (citas, recados, permisos
                    de grabación) y repone las citas sembradas; sin tocar nada más
  --borrar          quita los negocios sembrados y las bajas que se pusieron
  --solo a,b        solo esos negocios (por su clave)
  --dry-run         no escribe: enseña lo que haría
  --ayuda`;

export function parsearArgumentos(argv: string[]): Opciones {
  const opciones: Opciones = {
    ayuda: false,
    borrar: false,
    restablecer: false,
    dryRun: false,
    solo: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const argumento = argv[i]!;
    if (!argumento.startsWith("--")) {
      throw new ErrorDeUso(`Argumento inesperado: ${argumento}`);
    }
    const [nombre = "", valorEnLinea] = argumento.slice(2).split(/=(.*)/s);
    switch (nombre) {
      case "ayuda":
        opciones.ayuda = true;
        break;
      case "borrar":
        opciones.borrar = true;
        break;
      case "restablecer":
        opciones.restablecer = true;
        break;
      case "dry-run":
        opciones.dryRun = true;
        break;
      case "solo": {
        const valor = valorEnLinea ?? argv[++i];
        if (!valor || valor.startsWith("--")) {
          throw new ErrorDeUso("Falta el valor de --solo");
        }
        opciones.solo = valor
          .split(",")
          .map((parte) => parte.trim())
          .filter(Boolean);
        break;
      }
      default:
        throw new ErrorDeUso(`Opción desconocida: --${nombre}`);
    }
  }
  if (opciones.borrar && opciones.restablecer) {
    throw new ErrorDeUso("--borrar y --restablecer no van juntos");
  }
  return opciones;
}

/**
 * La `DATABASE_URL` de dev vista desde el Mac, o error si no es local, si la
 * base no es «botbook» o si el puerto no es el del Docker de dev: la siembra
 * borra y reescribe, y nunca debe poder hacerlo en otra BD (la de
 * producción tras un proxy, la de los tests de integración…).
 */
export function exigirBdDeDevLocal(url: string | undefined): string {
  if (!url) throw new Error("[Laboratorio] Falta DATABASE_URL");
  let local: string;
  try {
    local = urlDeBdDeDev({ DATABASE_URL: url });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    throw new Error(`[Laboratorio] ${mensaje.replace(/^\[MCP\]\s*/, "")}`);
  }
  // Cualquier Postgres que escuche en localhost pasa urlDeBdDeDev: también
  // el de Homebrew, un Cloud SQL Auth Proxy de producción o el de los tests.
  exigirBaseDeDatosDeDev(local);
  return local;
}

// ---------------------------------------------------------------------------
// Escritura en la BD
// ---------------------------------------------------------------------------

/** Lo que usa la siembra de Prisma (y lo que simulan los tests). */
export type ClienteDeSiembra = Pick<
  PrismaClient,
  | "$transaction"
  | "$queryRaw"
  | "business"
  | "user"
  | "agent"
  | "service"
  | "professional"
  | "professionalService"
  | "call"
  | "booking"
  | "lead"
  | "clienteDelNegocio"
  | "clientConversation"
  | "claveTemporal"
  | "sentMessage"
  | "inboundMessage"
  | "whatsappOptOut"
>;

type Transaccion = Prisma.TransactionClient;

const OPCIONES_DE_TRANSACCION = { timeout: 120_000, maxWait: 10_000 };

export const claveDeCacheDeVoz = (businessId: string) =>
  `voice_config:${businessId}`;

/**
 * Antes de escribir, dentro de la misma transacción: la conexión es de la
 * base de dev. La URL ya se comprobó al arrancar; esto cubre lo que la URL
 * no dice (un túnel o un proxy que apunte a otra base).
 */
export async function exigirBaseDeLaTransaccion(
  tx: Pick<Transaccion, "$queryRaw">
): Promise<void> {
  const filas = await tx.$queryRaw<
    Array<{ base: string }>
  >`SELECT current_database() AS base`;
  const base = filas[0]?.base;
  if (base !== BASE_DE_DATOS_DE_DEV) {
    throw new Error(
      `[Laboratorio] La conexión es a la base «${base ?? "?"}», no a la de desarrollo («${BASE_DE_DATOS_DE_DEV}»): no se escribe nada`
    );
  }
}

/** Un negocio con ese id que no se llama «Lab · …» no es nuestro. */
async function exigirNegocioDeLaboratorio(
  tx: Transaccion,
  id: string
): Promise<boolean> {
  const existente = await tx.business.findUnique({
    where: { id },
    select: { name: true },
  });
  if (
    existente &&
    !existente.name.startsWith(PREFIJO_DEL_NOMBRE_DE_LABORATORIO)
  ) {
    throw new Error(
      `[Laboratorio] El negocio ${id} existe y se llama «${existente.name}», no «${PREFIJO_DEL_NOMBRE_DE_LABORATORIO}…»: no se toca`
    );
  }
  return existente !== null;
}

function datosDeLlamada(plan: PlanDeNegocio, llamada: LlamadaDeSiembra) {
  const esChat = llamada.voiceProvider === "whatsapp";
  return {
    id: llamada.callId,
    callId: llamada.callId,
    businessId: plan.id,
    agentId: plan.agente.id,
    fromNumber: llamada.fromNumber,
    voiceProvider: llamada.voiceProvider,
    providerCallId: llamada.callId,
    // Cerradas: ni el barrido de zombis ni el laboratorio las toman por una
    // llamada en curso.
    status: "COMPLETED" as const,
    ...(esChat ? {} : { outcome: "RESOLVED" as const, durationSecs: 75 }),
    startedAt: llamada.startedAt,
    endedAt: new Date(llamada.startedAt.getTime() + (esChat ? 0 : 75_000)),
    ultimaActividadAt: llamada.startedAt,
    grabacionPermitida: llamada.grabacionPermitida,
  };
}

function datosDeCita(plan: PlanDeNegocio, cita: CitaDeSiembra) {
  const servicio = plan.servicios.find((s) => s.name === cita.servicio)!;
  const profesional = plan.profesionales.find(
    (p) => p.name === cita.profesional
  );
  return {
    id: cita.id,
    callId: cita.callId,
    programedAt: cita.programedAt,
    durationMinutes: cita.durationMinutes,
    numberPeople: 1,
    clientName: cita.clientName,
    serviceIds: [servicio.id],
    professionalId: profesional?.id ?? null,
    smsConsent: true,
    createdVia: "voice",
  };
}

function datosDeCliente(plan: PlanDeNegocio, telefono: string, ahora: Date) {
  return {
    businessId: plan.id,
    telefono,
    grabacionAceptada: true,
    grabacionDecididaAt: ahora,
  };
}

export interface DependenciasDeEscritura {
  /** Hash de una contraseña aleatoria que no se guarda en ninguna parte. */
  hashDeContrasenaAleatoria(): Promise<string>;
  ahora(): Date;
}

/** Crea el negocio entero, o lo deja como nuevo si ya existía. */
export async function aplicarPlan(
  prisma: ClienteDeSiembra,
  plan: PlanDeNegocio,
  deps: DependenciasDeEscritura
): Promise<void> {
  const ahora = deps.ahora();
  await prisma.$transaction(async (tx) => {
    await exigirBaseDeLaTransaccion(tx);
    await exigirNegocioDeLaboratorio(tx, plan.id);

    // Lo de dentro se vuelve a crear: así también se va lo que dejaron las
    // repeticiones del laboratorio. Las llamadas arrastran sus citas, recados
    // y transcripciones.
    await tx.call.deleteMany({ where: { businessId: plan.id } });
    await tx.clienteDelNegocio.deleteMany({ where: { businessId: plan.id } });
    await tx.clientConversation.deleteMany({ where: { businessId: plan.id } });
    await tx.professional.deleteMany({ where: { businessId: plan.id } });
    await tx.service.deleteMany({ where: { businessId: plan.id } });
    await tx.agent.deleteMany({ where: { businessId: plan.id } });
    await tx.sentMessage.deleteMany({ where: { businessId: plan.id } });
    // La caché de la configuración de voz guarda horario y ajustes durante
    // una hora.
    await tx.claveTemporal.deleteMany({
      where: {
        OR: [{ businessId: plan.id }, { clave: claveDeCacheDeVoz(plan.id) }],
      },
    });

    const { id, ...sinId } = plan.negocio;
    await tx.business.upsert({
      where: { id: plan.id },
      create: plan.negocio,
      update: sinId as Prisma.BusinessUncheckedUpdateInput,
    });

    // El dueño: la contraseña solo se crea la primera vez.
    const dueno = await tx.user.findUnique({
      where: { email: plan.emailDelDueno },
      select: { id: true },
    });
    if (dueno) {
      await tx.user.update({
        where: { id: dueno.id },
        data: { businessId: plan.id },
      });
    } else {
      await tx.user.create({
        data: {
          email: plan.emailDelDueno,
          password: await deps.hashDeContrasenaAleatoria(),
          businessId: plan.id,
          termsAcceptedAt: ahora,
          tokenVersion: 0,
        },
      });
    }

    await tx.service.createMany({
      data: plan.servicios.map((s) => ({ ...s, businessId: plan.id })),
    });
    await tx.professional.createMany({
      data: plan.profesionales.map((p) => ({ ...p, businessId: plan.id })),
    });
    if (plan.niveles.length > 0) {
      await tx.professionalService.createMany({ data: plan.niveles });
    }
    await tx.agent.create({
      data: {
        id: plan.agente.id,
        businessId: plan.id,
        name: plan.agente.nombre,
        systemPrompt: plan.agente.systemPrompt,
        firstMessage: plan.agente.firstMessage,
      },
    });
    await tx.call.createMany({
      data: plan.llamadas.map((l) => datosDeLlamada(plan, l)),
    });
    if (plan.citas.length > 0) {
      await tx.booking.createMany({
        data: plan.citas.map((c) => datosDeCita(plan, c)),
      });
    }
    if (plan.clientesQueAceptaron.length > 0) {
      await tx.clienteDelNegocio.createMany({
        data: plan.clientesQueAceptaron.map((t) =>
          datosDeCliente(plan, t, ahora)
        ),
      });
    }
  }, OPCIONES_DE_TRANSACCION);
}

/**
 * Deshace lo que dejó el laboratorio en el negocio, sin tocar el negocio ni
 * las llamadas: borra todas las citas y recados, devuelve a cada llamada su
 * permiso de grabación y su informe, repone los clientes que aceptaron y
 * vuelve a poner las citas sembradas (con las fechas de `plan`).
 */
export async function restablecerPlan(
  prisma: ClienteDeSiembra,
  plan: PlanDeNegocio,
  ahora: Date
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await exigirBaseDeLaTransaccion(tx);
    const existe = await exigirNegocioDeLaboratorio(tx, plan.id);
    if (!existe) {
      throw new Error(
        `[Laboratorio] ${plan.clave} no está sembrado; corre la siembra sin --restablecer`
      );
    }
    await tx.booking.deleteMany({ where: { call: { businessId: plan.id } } });
    await tx.lead.deleteMany({ where: { call: { businessId: plan.id } } });
    await tx.clienteDelNegocio.deleteMany({ where: { businessId: plan.id } });
    await tx.sentMessage.deleteMany({ where: { businessId: plan.id } });
    await tx.claveTemporal.deleteMany({
      where: {
        OR: [{ businessId: plan.id }, { clave: claveDeCacheDeVoz(plan.id) }],
      },
    });

    // El permiso de grabación vuelve al de la siembra, por tipo de llamada.
    for (const permitida of [true, null] as const) {
      const callIds = plan.llamadas
        .filter(
          (l) =>
            l.voiceProvider === "telnyx" && l.grabacionPermitida === permitida
        )
        .map((l) => l.callId);
      if (callIds.length === 0) continue;
      await tx.call.updateMany({
        where: { businessId: plan.id, callId: { in: callIds } },
        data: {
          grabacionPermitida: permitida,
          grabacionPreguntadaAt: null,
          grabacionRechazadaAt: null,
          postCallReport: Prisma.DbNull,
          postCallReportAt: null,
          summary: null,
          requestedService: null,
          successful: null,
        },
      });
    }

    if (plan.citas.length > 0) {
      await tx.booking.createMany({
        data: plan.citas.map((c) => datosDeCita(plan, c)),
      });
    }
    if (plan.clientesQueAceptaron.length > 0) {
      await tx.clienteDelNegocio.createMany({
        data: plan.clientesQueAceptaron.map((t) =>
          datosDeCliente(plan, t, ahora)
        ),
      });
    }
  }, OPCIONES_DE_TRANSACCION);
}

/**
 * Las bajas (STOP) de los números de ficción y de los dos dueños, marcadas
 * como de la siembra. Una baja que ya existía no se toca: si es de la
 * siembra y estaba revocada, vuelve a estar vigente; si es de otro y está
 * vigente, protege igual (y `--borrar` no la quitará); si es de otro y está
 * revocada, falla, porque ese número podría recibir mensajes y no es
 * nuestro para darlo de baja.
 */
export async function ponerBajas(
  prisma: ClienteDeSiembra,
  ahora: Date
): Promise<number> {
  const bajas = telefonosConBaja();
  return prisma.$transaction(async (tx) => {
    await exigirBaseDeLaTransaccion(tx);
    const existentes = await tx.whatsappOptOut.findMany({
      where: {
        OR: bajas.map(({ telefono, audiencia }) => ({
          phoneNumber: telefono,
          audience: audiencia,
        })),
      },
      select: {
        id: true,
        phoneNumber: true,
        audience: true,
        revokedAt: true,
        inboundMessageId: true,
      },
    });
    const clave = (telefono: string, audiencia: string) =>
      `${audiencia}:${telefono}`;
    const porClave = new Map(
      existentes.map((fila) => [clave(fila.phoneNumber, fila.audience), fila])
    );

    const ajenasRevocadas = existentes.filter(
      (fila) =>
        fila.revokedAt !== null &&
        fila.inboundMessageId !== MARCA_DE_LAS_BAJAS_DE_LABORATORIO
    );
    if (ajenasRevocadas.length > 0) {
      throw new Error(
        `[Laboratorio] Estos números tienen una baja revocada que no puso la siembra, así que podrían recibir mensajes: ${ajenasRevocadas
          .map((fila) => `${fila.phoneNumber} (${fila.audience})`)
          .join(", ")}. Revísalo a mano; la siembra no los da de baja`
      );
    }

    const nuestrasRevocadas = existentes
      .filter(
        (fila) =>
          fila.revokedAt !== null &&
          fila.inboundMessageId === MARCA_DE_LAS_BAJAS_DE_LABORATORIO
      )
      .map((fila) => fila.id);
    if (nuestrasRevocadas.length > 0) {
      await tx.whatsappOptOut.updateMany({
        where: { id: { in: nuestrasRevocadas } },
        data: { revokedAt: null, revokedByMessageId: null, optedOutAt: ahora },
      });
    }

    const nuevas = bajas.filter(
      ({ telefono, audiencia }) => !porClave.has(clave(telefono, audiencia))
    );
    if (nuevas.length > 0) {
      await tx.whatsappOptOut.createMany({
        data: nuevas.map(({ telefono, audiencia }) => ({
          phoneNumber: telefono,
          audience: audiencia,
          optedOutAt: ahora,
          keyword: "STOP",
          inboundMessageId: MARCA_DE_LAS_BAJAS_DE_LABORATORIO,
        })),
      });
    }
    return nuevas.length + nuestrasRevocadas.length;
  }, OPCIONES_DE_TRANSACCION);
}

export interface ResumenDeBorrado {
  negocios: number;
  bajas: number;
}

/** Quita lo sembrado: los negocios por sus ids fijos (y con ellos todo lo de
 * dentro) y las bajas que puso la siembra (con su marca); nada más. */
export async function borrarSiembra(
  prisma: ClienteDeSiembra,
  ids: readonly string[]
): Promise<ResumenDeBorrado> {
  return prisma.$transaction(async (tx) => {
    await exigirBaseDeLaTransaccion(tx);
    const encontrados = await tx.business.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, name: true },
    });
    const ajenos = encontrados.filter(
      (n) => !n.name.startsWith(PREFIJO_DEL_NOMBRE_DE_LABORATORIO)
    );
    if (ajenos.length > 0) {
      throw new Error(
        `[Laboratorio] ${ajenos.map((n) => `${n.id} («${n.name}»)`).join(", ")} no se llama «${PREFIJO_DEL_NOMBRE_DE_LABORATORIO}…»: no se borra nada`
      );
    }
    await tx.sentMessage.deleteMany({
      where: { businessId: { in: [...ids] } },
    });
    await tx.inboundMessage.deleteMany({
      where: { businessId: { in: [...ids] } },
    });
    await tx.claveTemporal.deleteMany({
      where: { clave: { in: ids.map(claveDeCacheDeVoz) } },
    });
    const negocios = await tx.business.deleteMany({
      where: { id: { in: [...ids] } },
    });
    const bajas = await tx.whatsappOptOut.deleteMany({
      where: {
        inboundMessageId: MARCA_DE_LAS_BAJAS_DE_LABORATORIO,
        OR: telefonosConBaja().map(({ telefono, audiencia }) => ({
          phoneNumber: telefono,
          audience: audiencia,
        })),
      },
    });
    return { negocios: negocios.count, bajas: bajas.count };
  }, OPCIONES_DE_TRANSACCION);
}

// ---------------------------------------------------------------------------
// Presentación
// ---------------------------------------------------------------------------

export function describirPlan(plan: PlanDeNegocio): string {
  const r = plan.resumen;
  const profesionales = plan.profesionales.map((p) => p.name).join(", ");
  const servicios = plan.servicios
    .map(
      (s) =>
        `${s.name} ${s.durationMinutes} min${s.priceCents === null ? "" : ` ${(s.priceCents / 100).toFixed(0)} €`}`
    )
    .join(", ");
  return [
    `${plan.clave} (${plan.id})`,
    `  ${plan.nombre}; ${plan.negocio.businessType}; ${plan.emailDelDueno}`,
    `  servicios: ${servicios}`,
    `  profesionales: ${profesionales}`,
    `  ${r.llamadasLibres} llamadas libres, ${r.chatsLibres} chats, ${r.llamadasConCita} llamadas con cita sembrada (${r.citas} citas), ${r.telefonosDistintos} teléfonos de ficción distintos`,
    ...(plan.citas.length > 0
      ? [
          `  citas: ${plan.citas[0]!.programedAt.toISOString()} … ${plan.citas[plan.citas.length - 1]!.programedAt.toISOString()}`,
        ]
      : []),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

/**
 * La `DATABASE_URL` de dev, solo del .env de dev (el del checkout principal,
 * como el MCP): una exportada en la shell puede ser la de producción vista
 * por un Cloud SQL Auth Proxy en 127.0.0.1, así que no se usa (se avisa si
 * es otra). Deja en `process.env` la comprobada, que es la que lee Prisma.
 */
export function prepararEntorno(
  cargar: () => Record<string, string> = cargarEnv,
  avisar: (mensaje: string) => void = (mensaje) => console.warn(mensaje)
): string {
  const local = exigirBdDeDevLocal(cargar().DATABASE_URL);
  const deLaShell = process.env.DATABASE_URL;
  if (deLaShell && deLaShell !== local) {
    avisar(
      "[Laboratorio] Se ignora la DATABASE_URL de la shell: la siembra solo usa la del .env de dev"
    );
  }
  process.env.DATABASE_URL = local;
  return local;
}

async function main(): Promise<void> {
  const opciones = parsearArgumentos(process.argv.slice(2));
  if (opciones.ayuda) {
    console.log(AYUDA);
    return;
  }
  const urlLocal = prepararEntorno();
  const destino = new URL(urlLocal);
  console.log(
    `[Laboratorio] BD de dev: ${destino.hostname}:${destino.port}${destino.pathname}`
  );

  const { prisma } = await import("../src/lib/prisma.js");
  const ahora = new Date();
  try {
    const plantilla = await prisma.whatsappTemplate.findUnique({
      where: { key: CLAVE_LISTA_DE_ESPERA },
      select: { status: true },
    });
    const listaDeEspera = plantilla?.status === "APPROVED";
    const planes = planificarTodo(
      { ahora, listaDeEspera },
      opciones.solo ?? undefined
    );
    exigirSiembraSinDestinatarios(planes);

    if (opciones.borrar) {
      const ids = (
        opciones.solo
          ? planes.map((p) => p.id)
          : NEGOCIOS_DE_LABORATORIO.map((n) => n.id)
      ) as string[];
      if (opciones.dryRun) {
        console.log(
          `[Laboratorio] --dry-run: borraría ${ids.length} negocios:`
        );
        for (const id of ids) console.log(`  ${id}`);
        return;
      }
      const resumen = await borrarSiembra(prisma, ids);
      console.log(
        `[Laboratorio] Borrados ${resumen.negocios} negocios y ${resumen.bajas} bajas`
      );
      return;
    }

    if (opciones.dryRun) {
      console.log(
        `[Laboratorio] --dry-run: ${opciones.restablecer ? "restablecería" : "sembraría"} ${planes.length} negocios (no se escribe nada)\n`
      );
      for (const plan of planes) console.log(`${describirPlan(plan)}\n`);
      return;
    }

    for (const plan of planes) {
      if (opciones.restablecer) {
        await restablecerPlan(prisma, plan, ahora);
      } else {
        await aplicarPlan(prisma, plan, {
          ahora: () => ahora,
          hashDeContrasenaAleatoria: () =>
            bcrypt.hash(randomBytes(24).toString("base64url"), 10),
        });
      }
      console.log(
        `${opciones.restablecer ? "[restablecido] " : ""}${describirPlan(plan)}\n`
      );
    }
    if (!opciones.restablecer) {
      const nuevas = await ponerBajas(prisma, ahora);
      console.log(`[Laboratorio] Bajas de WhatsApp puestas: ${nuevas} nuevas`);
    }
    console.log(
      `[Laboratorio] hueco_libre ${plantilla ? plantilla.status : "sin plantilla"}: ` +
        (listaDeEspera
          ? "la lista de espera está ACTIVA en dev; E22a (desactivada) ya no vale y E22b sí"
          : "la lista de espera está desactivada en dev; E22a vale y E22b no está disponible")
    );
  } finally {
    await prisma.$disconnect();
  }
}

const esElPrincipal =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (esElPrincipal) {
  main().catch((error) => {
    console.error(
      error instanceof ErrorDeUso
        ? `${error.message}\n\n${AYUDA}`
        : error instanceof Error && error.message.startsWith("[Laboratorio]")
          ? error.message
          : `[Laboratorio] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  });
}
