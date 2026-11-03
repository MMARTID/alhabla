/** Formato internacional E.164 (+34600123456) — compartido entre la
 * validación de entrada (PATCH /business/me) y el punto que realmente envía
 * el SMS, para que ambos apliquen la misma regla. Sin esto, un número mal
 * formateado que se colara por cualquier otra vía llegaría a Telnyx sin
 * ninguna comprobación. */
export const E164_PHONE_REGEX = /^\+[1-9]\d{7,14}$/;

export function isValidE164Phone(phone: string): boolean {
  return E164_PHONE_REGEX.test(phone);
}

/**
 * Teléfono que dicta un cliente (el de un recado o el de contacto de una
 * cita) en E.164, o null si no es utilizable. Acepta espacios, guiones,
 * puntos y paréntesis, el prefijo «00» y los nueve dígitos de un número
 * español sin prefijo, con o sin el 34 delante. Guardarlo tal cual lo dijo
 * el modelo («612 345 678») dejaba la cita sin WhatsApp y al cliente sin
 * reconocer en la siguiente llamada (auditoría del 16-10).
 */
export function normalizarTelefono(
  value: string | null | undefined
): string | null {
  const bruto = (value ?? "").replace(/[\s().-]/g, "");
  if (!bruto) return null;
  const candidato = bruto.startsWith("+")
    ? bruto
    : bruto.startsWith("00")
      ? `+${bruto.slice(2)}`
      : /^(34)?[6789]\d{8}$/.test(bruto)
        ? `+34${bruto.slice(-9)}`
        : bruto;
  return isValidE164Phone(candidato) ? candidato : null;
}

/** Alphanumeric Sender ID de SMS («ALHABLA»): hasta 11 letras, cifras o
 * espacios y al menos una letra (si fueran solo cifras sería un número). */
export const SENDER_ID_ALFANUMERICO_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9 ]{1,11}$/;

/**
 * Número legible para un texto al cliente: un +34 de nueve dígitos sale en
 * grupos de tres («+34 930 454 394»); cualquier otro se devuelve tal cual.
 */
export function formatearTelefonoLegible(e164: string): string {
  const match = /^\+34(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return match ? `+34 ${match[1]} ${match[2]} ${match[3]}` : e164;
}

/**
 * Fijo geográfico (8xx/9xx con segundo dígito 1-8) o móvil (6xx, 71x-79x)
 * de España: lo único que un negocio puede desviar a su número de Alhabla y
 * lo único a lo que «Comprobar desvío» llama pagando Alhabla. Fuera quedan
 * los 800/900 (gratuitos), 80x/90x (tarificación adicional), 70x (números
 * personales), 5xx (nómadas) y cualquier destino internacional.
 */
export function esLineaDeClientesEspanola(e164: string): boolean {
  return /^\+34(?:6\d{8}|7[1-9]\d{7}|[89][1-8]\d{7})$/.test(e164);
}

const CIFRAS_HABLADAS = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
];

/** «0199» → «cero uno nueve nueve». */
function cifrasHabladas(cifras: string): string {
  return [...cifras].map((cifra) => CIFRAS_HABLADAS[Number(cifra)]).join(" ");
}

/** Grupos de tres cifras; si sobra una, el último grupo lleva cuatro. */
function enGruposDeTres(cifras: string): string[] {
  const grupos = cifras.match(/\d{1,3}/g) ?? [];
  if (grupos.length > 1 && grupos[grupos.length - 1].length === 1) {
    const ultima = grupos.pop() as string;
    grupos[grupos.length - 1] += ultima;
  }
  return grupos;
}

/**
 * Un teléfono en E.164 como se le repite al cliente, cifra a cifra y en
 * grupos de tres: «+34612345678» es «seis uno dos, tres cuatro cinco, seis
 * siete ocho» (sin el prefijo de España) y «+12025550199», «más uno, dos
 * cero dos, cinco cinco cinco, cero uno nueve nueve». book_appointment lo
 * devuelve para que la recepcionista lo lea en vez de recordarlo: el
 * laboratorio del 03-11 con GLM-5.3-Flash repitió «cero uno nueve» de un
 * número acabado en 0199. null si no es E.164.
 */
export function telefonoParaDecir(e164: string): string | null {
  if (!isValidE164Phone(e164)) return null;
  const espanol = /^\+34(\d{9})$/.exec(e164);
  if (espanol) {
    return enGruposDeTres(espanol[1]).map(cifrasHabladas).join(", ");
  }
  // Norteamérica (+1): prefijo, 3, 3 y 4, como se dicta allí.
  const norteamericano = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  const grupos = norteamericano
    ? ["1", ...norteamericano.slice(1)]
    : enGruposDeTres(e164.slice(1));
  return `más ${grupos.map(cifrasHabladas).join(", ")}`;
}
