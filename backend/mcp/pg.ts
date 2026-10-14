import pg from "pg";

/**
 * Prisma guarda los DateTime en columnas `timestamp(3)` SIN zona horaria y
 * siempre en UTC. pg, por defecto, lee ese tipo como hora LOCAL del proceso:
 * en un Mac en Madrid, una cita de las 09:00 UTC salía como 07:00 UTC. Se
 * leen como UTC, igual que hace Prisma. (`timestamptz` ya trae su zona.)
 */
const TIMESTAMP_SIN_ZONA = 1114;
pg.types.setTypeParser(TIMESTAMP_SIN_ZONA, (valor) =>
  new Date(`${valor.replace(" ", "T")}Z`)
);

export default pg;
