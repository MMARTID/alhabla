import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient();
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  prismaClientSingleton();

if (process.env.NODE_ENV !== "production")
  globalForPrisma.prisma = prisma;

/**
 * La misma URL con `connection_limit=1` y los `parametros` que se pasen. Solo
 * se tocan esos parámetros (o se añaden): el resto, como `host=/cloudsql/…` o
 * una contraseña con caracteres escapados, queda tal cual.
 */
export function conUnaConexion(
  url: string,
  parametros: Record<string, string> = {}
): string {
  let resultado = url;
  for (const [nombre, valor] of Object.entries({
    connection_limit: "1",
    ...parametros,
  })) {
    const asignacion = `${nombre}=${encodeURIComponent(valor)}`;
    const patron = new RegExp(`([?&])${nombre}=[^&#]*`);
    resultado = patron.test(resultado)
      ? resultado.replace(patron, (_, separador) => `${separador}${asignacion}`)
      : `${resultado}${resultado.includes("?") ? "&" : "?"}${asignacion}`;
  }
  return resultado;
}

/**
 * Un cliente aparte con UNA conexión propia, fuera del pool de `prisma`, y los
 * `parametros` de URL que se pasen. Lo usa el limitador de peticiones
 * (lib/limitesDePeticiones.ts): en el pool compartido, sus sentencias
 * esperarían detrás de las consultas de los handlers y vencerían su plazo
 * con Postgres sano (medido: con unas 40 peticiones a la vez y consultas de
 * 30 ms). Es una conexión más por instancia, además de las
 * `connection_limit` del pool (AGENTS.md § Pool).
 */
export function crearClienteDeUnaConexion(
  parametros: Record<string, string> = {}
): PrismaClient {
  const url = process.env.DATABASE_URL;
  return new PrismaClient(
    url ? { datasourceUrl: conUnaConexion(url, parametros) } : undefined
  );
}
