/**
 * La ejecución abierta de esta sesión del MCP. El modelo no maneja el
 * `ejecucionId`: `abrir_ejecucion` lo guarda aquí y `crear_oportunidad` y
 * `cerrar_ejecucion` lo usan solos, así una página con instrucciones
 * inyectadas no puede ligar oportunidades a la ejecución de otro ni cerrarla
 * con un id inventado.
 *
 * Vive en la memoria del proceso: si el MCP se reinicia a mitad de un run se
 * pierde, y el backend cierra como «error» toda ejecución que lleve más de 6 h
 * en curso al abrir la siguiente.
 */
export type EstadoDeEjecucion = {
  actual(): string | null;
  abrir(id: string): void;
  cerrar(): void;
};

export function crearEstadoDeEjecucion(): EstadoDeEjecucion {
  let id: string | null = null;
  return {
    actual: () => id,
    abrir: (nuevo) => {
      id = nuevo;
    },
    cerrar: () => {
      id = null;
    },
  };
}
