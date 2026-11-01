/**
 * Lo que la información del negocio dice del precio de un servicio que no lo
 * tiene en el catálogo («Tintes desde 30 €», «la keratina, con presupuesto»).
 *
 * get_catalog lo pone junto a «sin precio» en la línea del servicio. Con el
 * dato solo en el prompt, el «sin precio» del catálogo ganaba: la
 * recepcionista contestaba «el tinte no tiene un precio fijado» aunque la
 * información dijera «desde 30 €» (laboratorio, E5b: 0 de 10 el 30-10).
 */

/** Como mucho, dos trozos de la información por servicio. */
const MAX_TROZOS = 2;
const MAX_CARACTERES = 200;

/** Algo que habla de precio: una cifra, euros, «desde», «presupuesto»... */
const SENAL_DE_PRECIO =
  /\d|€|\beuros?\b|\bdesde\b|\bpresupuesto\b|\bconsultar\b|\bgratis\b|\bgratuit/;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** La raíz de cada palabra del nombre con cuatro letras o más: «tinte» →
 * «tint» (casa con «tintes»), «pestañas» → «pestan». Las cortas («de»,
 * «con», «uñas»...) no cuentan: casarían con cualquier cosa. */
function raices(nombreDelServicio: string): string[] {
  return normalizar(nombreDelServicio)
    .split(/[^a-z]+/)
    .filter((palabra) => palabra.length >= 4)
    .map((palabra) => palabra.slice(0, Math.max(4, palabra.length - 2)));
}

/** Frases y trozos separados por comas («Corte 18 €, tintes desde 30 €»);
 * la coma decimal («12,50 €») no corta. */
function trozos(informacion: string): string[] {
  return informacion
    .split(/[.;\n]+(?!\d)|,\s+/)
    .map((trozo) => trozo.trim())
    .filter(Boolean);
}

export function precioEnLaInformacion(
  nombreDelServicio: string,
  informacion: string | null | undefined
): string | null {
  if (!informacion?.trim()) return null;
  const buscadas = raices(nombreDelServicio);
  if (buscadas.length === 0) return null;

  const encontrados = trozos(informacion).filter((trozo) => {
    const normalizado = normalizar(trozo);
    return (
      SENAL_DE_PRECIO.test(normalizado) &&
      buscadas.some((raiz) => new RegExp(`(^|[^a-z])${raiz}`).test(normalizado))
    );
  });
  if (encontrados.length === 0) return null;

  const texto = encontrados.slice(0, MAX_TROZOS).join("; ");
  return texto.length > MAX_CARACTERES
    ? `${texto.slice(0, MAX_CARACTERES - 1).trimEnd()}…`
    : texto;
}
