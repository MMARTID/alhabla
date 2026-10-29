import { formatIncludedMinutes, plans } from "@/lib/plans";
import { contactEmail } from "@/lib/seo";

/**
 * Lo común de las comparativas con plataformas de agentes de voz
 * (app/comparativa/**, desde el 2026-10-29). Son publicidad comparativa del
 * art. 10 de la Ley 3/1991: solo características esenciales, objetivas y
 * verificables, con la fecha y la URL de cada dato. Lo que la otra
 * plataforma no publica se escribe «No consta en su web», nunca «no lo
 * tiene», y donde es mejor se dice.
 *
 * Las filas de Alhabla salen de aquí para que las cinco páginas digan lo
 * mismo y el precio venga siempre de lib/plans.ts. Al cambiar lo que hace
 * Alhabla o lo que publica una plataforma, se revisa la página, su fecha
 * `actualizado` en lib/paginas.ts y CONSULTADAS.
 */

/** Día en que se comprobaron contra su web oficial los datos de cada plataforma. */
export const CONSULTADAS = "2026-10-29";

/** «29 de octubre de 2026», para la nota legal. */
const CONSULTADAS_EN_TEXTO = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(`${CONSULTADAS}T12:00:00Z`));

export const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
export const porMinuto = (precio: number, minutos: number) => eur(precio / minutos);

const [inicio, pro, scale] = plans;

/** «59, 139 o 269 € + IVA al mes». */
export const CUOTAS = `${inicio.price}, ${pro.price} o ${scale.price} € + IVA al mes`;

/** «200, 600 o 1.500 minutos incluidos». */
export const MINUTOS_INCLUIDOS = `${formatIncludedMinutes(inicio.minutes)}, ${formatIncludedMinutes(pro.minutes)} o ${formatIncludedMinutes(scale.minutes)} minutos incluidos`;

/** «de 0,20 € a 0,30 € + IVA». */
export const MINUTO_EXTRA = `de ${eur(scale.extraPerMinute)} a ${eur(inicio.extraPerMinute)} + IVA`;

/**
 * La columna de Alhabla de la tabla de cada comparativa, fila a fila. Todo es
 * verdad hoy en todos los planes (PRODUCT.md › Capabilities), salvo lo que
 * dice su plan.
 */
export const ALHABLA = {
  queEs: "Una recepcionista de IA ya hecha para negocios con cita",
  paraQuien: "Peluquerías, barberías, estética, uñas, fisioterapia y otros negocios con cita en España",
  quienLoMonta: "Tú, sin programar: en el alta eliges tus servicios, tu equipo y tu horario",
  precio: `${CUOTAS}, con ${MINUTOS_INCLUIDOS}. En euros`,
  aparte: `Solo el minuto extra, ${MINUTO_EXTRA}. Número, calendario, WhatsApp e idiomas van incluidos`,
  numero: "Incluido: un número español al que desvías el tuyo, sin cambiar de número",
  idiomas: "Español de España y siete idiomas más; catalán, euskera o gallego según la zona del negocio",
  calendarios: "Google, Outlook o iCloud, conectados directamente; o la agenda de Alhabla si no usas ninguno",
  whatsappCliente: "Sí: confirma cada cita por WhatsApp y el cliente puede escribir para cambiarla o cancelarla. En Pro y Scale, también el recordatorio",
  asistente: "Sí: tu asistente, en todos los planes. Ningún cambio se aplica sin tu «Confirmar»",
} as const;

export const FUENTE_LEY: { nombre: string; url: string } = {
  nombre: "Ley 3/1991 de Competencia Desleal, art. 10",
  url: "https://www.boe.es/buscar/act.php?id=BOE-A-1991-628",
};

/** Texto de la Nota «Sobre esta comparativa» que cierra cada página. */
export function notaSobreLaComparativa(marca: string) {
  return `Comparación de características publicadas, hecha por Alhabla con los datos consultados el ${CONSULTADAS_EN_TEXTO}, según el artículo 10 de la Ley 3/1991 de Competencia Desleal. ${marca} es una marca de su titular; Alhabla no tiene relación con ella. Si un dato ha cambiado, escríbenos a ${contactEmail} y lo corregimos.`;
}

/** La pregunta que reconoce quién escribe la comparativa. */
export function preguntaDeImparcialidad(marca: string) {
  return {
    question: "¿Esta comparativa es imparcial?",
    answer: `La escribe Alhabla, así que tenlo en cuenta. Para compensarlo, solo usamos lo que ${marca} publica en su web, con el enlace a cada dato, y decimos en qué casos te conviene más ${marca}. Si ves un dato desactualizado, escríbenos a ${contactEmail} y lo corregimos.`,
  };
}

export type FilaDelResumen = {
  ruta?: string;
  nombre: string;
  paraQuien: string;
  precio: string;
  numero: string;
};

/**
 * La tabla del índice /comparativa: las cinco plataformas con página propia y
 * dos para grandes empresas (PolyAI, Voiceflow) que solo van aquí. Cada dato
 * sale de la web oficial (FUENTES_DEL_RESUMEN), consultada en CONSULTADAS.
 */
export const RESUMEN_PLATAFORMAS: readonly FilaDelResumen[] = [
  {
    ruta: "/comparativa/alhabla-vs-retell-ai",
    nombre: "Retell AI",
    paraQuien: "Centros de llamadas de empresa; también se ofrece a pequeños negocios",
    precio: "De 0,07 a 0,31 $ por minuto, por piezas",
    numero: "Solo vende de EE. UU. y Canadá: el español lo traes de tu operador",
  },
  {
    ruta: "/comparativa/alhabla-vs-vapi",
    nombre: "Vapi",
    paraQuien: "Desarrolladores",
    precio: "0,05 $ por minuto de plataforma, más transcripción, modelo de IA, voz y telefonía",
    numero: "Su número gratis es de EE. UU.: el español lo traes de tu operador",
  },
  {
    ruta: "/comparativa/alhabla-vs-bland-ai",
    nombre: "Bland AI",
    paraQuien: "Se presenta para sectores regulados: sanidad, seguros, finanzas",
    precio: "0,14 $ por minuto sin cuota, o 299 $ al mes y 0,12 $ por minuto",
    numero: "Vende de EE. UU. y Canadá; para otros países, su soporte o tu operador",
  },
  {
    ruta: "/comparativa/alhabla-vs-synthflow",
    nombre: "Synthflow",
    paraQuien: "Grandes empresas y centros de llamadas",
    precio: "Solo contrato anual de empresa, desde 30.000 $ al año",
    numero: "Vende de EE. UU., Canadá y Australia: el español lo traes de tu operador",
  },
  {
    ruta: "/comparativa/alhabla-vs-elevenlabs",
    nombre: "ElevenLabs",
    paraQuien: "Desarrolladores y empresas; su recepcionista Reception, a pequeños negocios",
    precio: "Agentes: de 0 $ (15 minutos) a 990 $ al mes, el modelo de IA aparte. Reception: desde 29 $ al mes",
    numero: "Agentes: lo traes de tu operador. Reception: número español tras un trámite con documentos",
  },
  {
    nombre: "PolyAI",
    paraQuien: "Grandes empresas: bancos, hoteles, sanidad",
    precio: "Por minuto, con precio solo a través de ventas",
    numero: "No vende números españoles: conectas tu operador",
  },
  {
    nombre: "Voiceflow",
    paraQuien: "Equipos de atención al cliente de empresas, y agencias",
    precio: "No publica el precio de sus planes en su web",
    numero: "Solo da de EE. UU. o Canadá: el español lo traes de tu operador",
  },
];

export const FUENTES_DEL_RESUMEN: { nombre: string; url: string }[] = [
  { nombre: "Retell AI: precios", url: "https://www.retellai.com/pricing" },
  { nombre: "Retell AI: comprar un número", url: "https://docs.retellai.com/deploy/purchase-number" },
  { nombre: "Vapi: preguntas frecuentes", url: "https://docs.vapi.ai/faq" },
  { nombre: "Vapi: precios", url: "https://vapi.ai/pricing" },
  { nombre: "Vapi: números gratuitos", url: "https://docs.vapi.ai/free-telephony" },
  { nombre: "Bland AI: portada", url: "https://www.bland.ai/" },
  { nombre: "Bland AI: precios", url: "https://www.bland.ai/pricing" },
  { nombre: "Bland AI: comprar un número", url: "https://docs.bland.ai/api-v1/post/inbound-purchase" },
  { nombre: "Synthflow: portada", url: "https://synthflow.ai/" },
  { nombre: "Synthflow: precios", url: "https://synthflow.ai/pricing" },
  { nombre: "Synthflow: números de teléfono", url: "https://docs.synthflow.ai/phone-numbers" },
  { nombre: "ElevenLabs: qué es ElevenAgents", url: "https://elevenlabs.io/docs/eleven-agents/overview" },
  { nombre: "ElevenLabs: precios de ElevenAgents", url: "https://elevenlabs.io/pricing/agents" },
  { nombre: "ElevenLabs: números de teléfono", url: "https://elevenlabs.io/docs/eleven-agents/api-reference/phone-numbers/create" },
  { nombre: "ElevenLabs: planes de Reception", url: "https://elevenlabs.io/docs/reception-ai/billing/plans-and-pricing" },
  { nombre: "ElevenLabs: números internacionales de Reception", url: "https://elevenlabs.io/docs/reception-ai/phone-numbers/international-numbers" },
  { nombre: "PolyAI: introducción", url: "https://docs.poly.ai/platform/introduction" },
  { nombre: "PolyAI: precios", url: "https://poly.ai/pricing" },
  { nombre: "Voiceflow: precios", url: "https://www.voiceflow.com/pricing" },
  { nombre: "Voiceflow: facturación", url: "https://www.voiceflow.com/docs/documentation/account-management/billing" },
  { nombre: "Voiceflow: conectar un número", url: "https://www.voiceflow.com/docs/documentation/deploy/phone/connect-a-phone-number" },
  FUENTE_LEY,
];
