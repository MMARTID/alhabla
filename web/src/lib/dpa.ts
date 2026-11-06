/**
 * Contrato de encargado del tratamiento (DPA, art. 28 RGPD) que cada negocio
 * acepta al registrarse. Versión y fecha viven aquí para que la página, la
 * casilla del registro y lo que se guarde de cada aceptación hablen de lo mismo.
 * Cualquier cambio de texto sube `DPA_VERSION`; un cambio de subencargados avisa
 * a los negocios con 15 días de antelación (ver el propio DPA).
 */
export const DPA_VERSION = "1.0";
export const DPA_FECHA = "2026-11-06";

export type Subencargado = {
  nombre: string;
  funcion: string;
  ubicacion: string;
};

/**
 * Subencargados que tocan datos de quienes llaman al negocio. Los proveedores
 * de calendario (Google, Microsoft, Apple) no están: los elige y conecta el
 * negocio, no Alhabla. Stripe tampoco: solo ve la facturación del negocio.
 * Mantener alineado con docs/legal/registro-de-actividades.md.
 */
export const SUBENCARGADOS: Subencargado[] = [
  {
    nombre: "Telnyx",
    funcion:
      "Telefonía, mensajería y WhatsApp; recepcionista de IA (transcripción, modelos de lenguaje y voz que ejecuta)",
    ubicacion:
      "Cuenta con localidad de datos en Alemania; parte del tratamiento puede realizarse fuera del EEE con garantías",
  },
  {
    nombre: "Modelos de lenguaje ejecutados por Telnyx",
    funcion:
      "Generan las respuestas de la recepcionista; para tu asistente por WhatsApp, un modelo de OpenAI",
    ubicacion: "Pueden procesar fuera del EEE, con las garantías de Telnyx",
  },
  {
    nombre: "Soniox",
    funcion:
      "Transcripción y voz en catalán, euskera y gallego, solo en los negocios de esas zonas",
    ubicacion: "Fuera del EEE posible, con garantías contractuales",
  },
  {
    nombre: "Meta (WhatsApp Business)",
    funcion: "Entrega de los mensajes de WhatsApp",
    ubicacion: "Según las condiciones de Meta",
  },
  {
    nombre: "Google Cloud",
    funcion: "Alojamiento del servidor y de la base de datos",
    ubicacion: "Unión Europea (Bélgica)",
  },
  {
    nombre: "Cloudflare R2",
    funcion: "Almacenamiento cifrado de las grabaciones",
    ubicacion: "Según la jurisdicción del bucket",
  },
  {
    nombre: "Vercel",
    funcion: "Entrega de la aplicación web; no almacena datos de llamadas",
    ubicacion: "Red global con garantías contractuales",
  },
  {
    nombre: "Zoho Mail",
    funcion: "Envío de correos transaccionales",
    ubicacion: "Según las condiciones de Zoho",
  },
];
