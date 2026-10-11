import { prisma } from "../../../src/lib/prisma.js";

/** Valor del contador en su ventana vigente; 0 si no existe o ya caducó. */
export async function leerContador(clave: string): Promise<number> {
  const filas = await prisma.$queryRaw<{ valor: number }[]>`
    SELECT "valor" FROM "contadores"
    WHERE "clave" = ${clave} AND "expiraEn" > now()`;
  return filas[0] ? Number(filas[0].valor) : 0;
}
