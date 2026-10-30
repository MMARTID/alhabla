/**
 * Las piezas puras de los filtros del Historial: fechas y dominios tal como
 * los espera el backend.
 */

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Un `AAAA-MM-DD` de un `<input type="date">` como fecha local, o `null`. */
function diaLocal(
  texto: string,
  hora: number,
  minuto: number,
  segundo: number,
  milisegundo: number
): Date | null {
  const partes = DIA.exec(texto);
  if (!partes) return null;
  const [anio, mes, dia] = [partes[1], partes[2], partes[3]].map(Number);
  const fecha = new Date(
    anio,
    mes - 1,
    dia,
    hora,
    minuto,
    segundo,
    milisegundo
  );
  // `new Date(2026, 1, 31)` se corrige solo a marzo: eso no es un día válido.
  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return null;
  }
  return fecha;
}

/** 00:00 de ese día en la zona del navegador, en ISO. */
export function inicioDelDia(texto: string): string | undefined {
  return diaLocal(texto, 0, 0, 0, 0)?.toISOString();
}

/**
 * 23:59:59.999 de ese día en la zona del navegador, en ISO. El backend filtra
 * con `<=`: mandar solo el día dejaría fuera todo lo que pasó ese día.
 */
export function finDelDia(texto: string): string | undefined {
  return diaLocal(texto, 23, 59, 59, 999)?.toISOString();
}

export type RangoDeFechas = {
  desde?: string;
  hasta?: string;
  /** «Desde» cae después de «hasta»: no se manda ninguna de las dos. */
  invalido: boolean;
};

export function rangoDeFechas(desde: string, hasta: string): RangoDeFechas {
  const inicio = desde ? inicioDelDia(desde) : undefined;
  const fin = hasta ? finDelDia(hasta) : undefined;
  if (inicio && fin && Date.parse(inicio) > Date.parse(fin)) {
    return { invalido: true };
  }
  return { desde: inicio, hasta: fin, invalido: false };
}

/**
 * El dominio como lo guarda el backend: en minúsculas, sin esquema, sin ruta
 * y sin `www.`. Acepta que se pegue una URL entera.
 */
export function normalizarDominio(texto: string): string {
  let dominio = texto.trim().toLowerCase();
  if (dominio === "") return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(dominio)) {
    try {
      dominio = new URL(dominio).hostname;
    } catch {
      // Se queda como está: el backend dirá que no hay coincidencias.
    }
  }
  dominio = dominio.split(/[/?#]/)[0];
  return dominio.replace(/^www\./, "");
}
