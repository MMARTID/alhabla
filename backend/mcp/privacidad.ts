/**
 * Teléfonos en E.164 (+ y de 6 a 15 cifras): los de los clientes salen en
 * logs, conversaciones y tools. Las herramientas de producción y de Telnyx
 * los enmascaran por defecto y dejan las 3 últimas cifras, que bastan para
 * distinguir a un cliente de otro. Un número escrito sin «+» (en un recado,
 * por ejemplo) no se reconoce.
 */
const TELEFONO = /\+\d{6,15}/g;

export function enmascararTelefonos(texto: string): string {
  return texto.replace(
    TELEFONO,
    (numero) =>
      `${numero.slice(0, 3)}${"•".repeat(numero.length - 6)}${numero.slice(-3)}`
  );
}

/** Lo mismo en cualquier valor: cadenas sueltas, objetos y listas. */
export function enmascararEnTodo<T>(valor: T): T {
  if (typeof valor === "string") return enmascararTelefonos(valor) as T;
  if (Array.isArray(valor)) return valor.map(enmascararEnTodo) as T;
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([clave, v]) => [clave, enmascararEnTodo(v)])
    ) as T;
  }
  return valor;
}

/** Recorta una cadena larga dejando dicho cuánto medía. */
export function recortar(texto: string, maximo: number): string {
  return texto.length > maximo
    ? `${texto.slice(0, maximo)}… (${texto.length} caracteres)`
    : texto;
}
