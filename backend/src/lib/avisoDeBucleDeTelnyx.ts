/** El texto fijo con el que Telnyx corta un turno en bucle de tools. Vive
 * aparte de chatCliente.ts para que el laboratorio lo use sin cargar el
 * módulo de WhatsApp. */
export function esAvisoDeBucleDeTelnyx(respuesta: string): boolean {
  return /stuck in a loop repeating the same tool action/i.test(respuesta);
}
