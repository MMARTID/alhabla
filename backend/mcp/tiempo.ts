const UNIDADES_MS = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

/**
 * Un momento en ISO a partir de «hace cuánto» («30s», «10m», «2h», «1d») o
 * de una fecha ISO. Es lo que se mete en los filtros de Cloud Logging: se
 * valida para no pasar al filtro nada que no sea una fecha.
 */
export function momentoDesde(entrada: string, ahora = Date.now()): string {
  const duracion = /^(\d+)([smhd])$/.exec(entrada.trim());
  if (duracion) {
    const [, cantidad, unidad] = duracion;
    return new Date(
      ahora - Number(cantidad) * UNIDADES_MS[unidad as keyof typeof UNIDADES_MS]
    ).toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(entrada.trim())) {
    const fecha = new Date(entrada.trim());
    if (!Number.isNaN(fecha.getTime())) return fecha.toISOString();
  }
  throw new Error(
    `[MCP] «${entrada}» no es una duración como 30s, 10m, 2h o 1d ni una fecha ISO`
  );
}
