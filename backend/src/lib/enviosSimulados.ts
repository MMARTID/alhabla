/**
 * Envíos simulados: con `ENVIOS_SIMULADOS=1` los WhatsApp, SMS y correos no
 * salen; se registra en el log a quién iban y qué llevaban. Lo activa
 * backend-sim (perfil sim de docker-compose), el destino de los webhooks
 * simulados del MCP de desarrollo (backend/mcp/), para poder probar una tool
 * de voz entera sin escribir a nadie de verdad. Las citas sí se crean en el
 * calendario real: es lo que se está probando.
 *
 * En producción no hace nada aunque esté puesto: no hay manera de que un
 * despliegue deje de avisar a los negocios por una variable mal copiada.
 */
export function enviosSimulados(): boolean {
  return (
    process.env.ENVIOS_SIMULADOS === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

/** Log del envío que no sale, con el mismo formato en los tres canales. */
export function registrarEnvioSimulado(
  canal: "WhatsApp" | "SMS" | "Correo",
  destino: string,
  detalle: string
): void {
  console.warn(
    `[${canal}] ENVÍO SIMULADO (ENVIOS_SIMULADOS=1), no sale: destino=${destino} ${detalle}`
  );
}
