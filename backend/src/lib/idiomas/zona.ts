import type { CodigoDeIdioma } from "./catalogo.js";

/**
 * La lengua cooficial del sitio donde está el negocio (decisión del usuario
 * del 2026-10-14): con ella, un negocio que saluda en castellano entiende
 * también esa lengua desde el primer momento (Soniox) y contesta en ella con
 * la voz que la habla (un nodo de conversation_flow que solo cambia la voz,
 * resolverIdiomas y telnyxAssistantPayload.ts). Con flux, el catalán de las
 * llamadas reales llegaba transcrito como italiano.
 *
 * Por la provincia, las dos primeras cifras del código postal. Los números de
 * Telnyx se compran todos en Barcelona (TELNYX_SPAIN_LOCALITY): su prefijo no
 * dice dónde está el negocio.
 *
 * Sin la Comunitat Valenciana ni Navarra (decisión del usuario del
 * 2026-10-14): en buena parte de la Comunitat (Torrevieja, Orihuela,
 * Requena…) se habla castellano y Soniox añade espera a todas las
 * respuestas; en Navarra el euskera solo es cooficial en el norte.
 */
const COOFICIAL_POR_PROVINCIA: Readonly<Record<string, CodigoDeIdioma>> = {
  // Cataluña
  "08": "ca-ES",
  "17": "ca-ES",
  "25": "ca-ES",
  "43": "ca-ES",
  // Illes Balears
  "07": "ca-ES",
  // Euskadi
  "01": "eu-ES",
  "20": "eu-ES",
  "48": "eu-ES",
  // Galicia
  "15": "gl-ES",
  "27": "gl-ES",
  "32": "gl-ES",
  "36": "gl-ES",
};

/**
 * Los países que ofrece la bienvenida, aparte de España, como los escribe
 * Places (en español) o alguien a mano: sus códigos postales de cinco cifras
 * se confundirían con los españoles (20123 Milano, 01069 Dresden, 32801
 * Orlando).
 */
const OTRO_PAIS =
  /(?<!\p{L})(Francia|France|Alemania|Germany|Deutschland|Italia|Italy|Portugal|Pa[ií]ses Bajos|Netherlands|Nederland|B[ée]lgica|Belgium|Belgique|Belgi[ëe]|Austria|[ÖO]sterreich|Suiza|Switzerland|Schweiz|Suisse|Reino Unido|United Kingdom|Estados Unidos|United States|USA|EE\. ?UU\.?|M[ée]xico)(?!\p{L})/u;

/**
 * El código postal español de una dirección: el último número suelto de
 * cinco cifras cuya provincia existe (01–52), seguido del nombre del lugar
 * («08440 Cardedeu»), en una línea que no nombra otro país. En las
 * direcciones de Google Places va cerca del final («…, 231, 08440 Cardedeu,
 * Barcelona, Spain») y los números de calle casi nunca tienen cinco cifras;
 * el nombre detrás descarta cifras sueltas del texto libre («más de 15000
 * clientes»).
 */
export function codigoPostal(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const candidatos = texto
    .split("\n")
    .filter((linea) => !OTRO_PAIS.test(linea))
    .flatMap((linea) => [
      ...linea.matchAll(/(?<!\d)(\d{5})(?=\s+\p{Lu})/gu),
    ])
    .map((coincidencia) => coincidencia[1])
    .filter((codigo) => {
      const provincia = Number(codigo.slice(0, 2));
      return provincia >= 1 && provincia <= 52;
    });
  return candidatos.at(-1) ?? null;
}

/**
 * La lengua cooficial de donde está el negocio, o null. El código postal de
 * su dirección (`Business.address`) y, si no lo lleva, el de lo que el
 * dueño escribió del negocio (`businessDetails`, que la bienvenida rellena
 * con el nombre y la dirección de Places): hay direcciones guardadas a mano
 * sin él.
 */
export function cooficialDeLaZona(negocio: {
  address?: string | null;
  businessDetails?: string | null;
}): CodigoDeIdioma | null {
  const codigo =
    codigoPostal(negocio.address) ?? codigoPostal(negocio.businessDetails);
  return codigo ? (COOFICIAL_POR_PROVINCIA[codigo.slice(0, 2)] ?? null) : null;
}
