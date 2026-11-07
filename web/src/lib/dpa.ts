/**
 * Contrato de encargado del tratamiento (DPA, art. 28 RGPD) que cada negocio
 * acepta al registrarse. Versión y fecha viven aquí para que la página, la
 * casilla del registro y lo que se guarde de cada aceptación hablen de lo mismo.
 * Cualquier cambio de texto sube `DPA_VERSION`; un cambio de subencargados avisa
 * a los negocios con 15 días de antelación (ver el propio DPA).
 */
export const DPA_VERSION = "1.0";
export const DPA_FECHA = "2026-11-07";

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
      "Telefonía, mensajería y WhatsApp; recepcionista de IA (transcripción, voz y los modelos de lenguaje que aloja)",
    ubicacion:
      "La cuenta de Alhabla tiene localidad de datos en Alemania y el audio se procesa en Fráncfort. Según su contrato, sus instalaciones principales están en EE. UU. y la región de los modelos de lenguaje no está garantizada: pueden ejecutarse fuera del EEE",
  },
  {
    nombre: "Modelos de lenguaje alojados por Telnyx",
    funcion:
      "Generan las respuestas de la recepcionista, por teléfono y en los mensajes de WhatsApp con los clientes",
    ubicacion: "Sin garantía de región: pueden procesar el texto fuera del EEE",
  },
  {
    nombre: "OpenAI (a través de Telnyx)",
    funcion:
      "Modelo de lenguaje de tu asistente por WhatsApp (el Gestor): recibe los mensajes del dueño y los datos de citas que consulta",
    ubicacion: "Puede procesar fuera del EEE; la región no la fija Alhabla",
  },
  {
    nombre: "Soniox",
    funcion:
      "Transcripción y voz en catalán, euskera y gallego, solo en los negocios de esas zonas",
    ubicacion: "Puede procesar fuera del EEE; la región no la fija Alhabla",
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
    funcion: "Almacenamiento privado de las grabaciones, cifrado en reposo por el proveedor",
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
