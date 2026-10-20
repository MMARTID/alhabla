/**
 * Cuenta de caracteres de un SMS como la hace la red, para las plantillas
 * de /herramientas/plantillas-recordatorio-de-cita.
 *
 * Un SMS cabe en 160 caracteres solo si todos están en el alfabeto GSM-7
 * (GSM 03.38). En castellano la trampa son las vocales con tilde aguda:
 * «é» está, pero «á», «í», «ó» y «ú» no, y una sola basta para que el
 * mensaje viaje en UCS-2, con 70 caracteres por SMS. Algunos caracteres
 * (€, corchetes, llaves…) están en la tabla de extensión y cuentan doble.
 * Fuente: tabla GSM-7 de la documentación de Twilio (consultada el
 * 2026-10-20).
 */

const BASICO = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
  )
);
const EXTENSION = new Set(Array.from("^{}\\[~]|€\f"));

export type CuentaSms = {
  caracteres: number;
  /** false si algún carácter obliga a enviar en UCS-2 (70 por SMS). */
  gsm7: boolean;
  /** Los caracteres que sacan el texto de GSM-7, sin repetir. */
  fueraDeGsm7: string[];
  /** Cuántos SMS se facturan: 160/153 en GSM-7, 70/67 en UCS-2. */
  mensajes: number;
};

export function contarSms(texto: string): CuentaSms {
  let caracteres = 0;
  const fuera = new Set<string>();
  for (const c of Array.from(texto)) {
    if (BASICO.has(c)) caracteres += 1;
    else if (EXTENSION.has(c)) caracteres += 2;
    else {
      fuera.add(c);
      caracteres += 1;
    }
  }
  const gsm7 = fuera.size === 0;
  // En UCS-2 cuenta cada unidad de 16 bits: un emoji ocupa dos.
  const total = gsm7 ? caracteres : texto.length;
  const [uno, varios] = gsm7 ? [160, 153] : [70, 67];
  return {
    caracteres: total,
    gsm7,
    fueraDeGsm7: Array.from(fuera),
    mensajes: total <= uno ? 1 : Math.ceil(total / varios),
  };
}

/** Sustituye los campos {nombre}, {día}… por los valores dados; los que
 * no tienen valor se quedan como están, a la vista. */
export function rellenarCampos(texto: string, valores: Record<string, string | undefined>) {
  return texto.replace(/\{([^{}]+)\}/g, (campo, nombre: string) => {
    const valor = valores[nombre]?.trim();
    return valor ? valor : campo;
  });
}
