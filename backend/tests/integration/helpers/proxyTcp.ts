import net from "node:net";

/**
 * Proxy TCP entre un cliente y el Redis (o el Postgres) real de los tests,
 * para provocar de verdad lo que en producción haría un Memorystore o un
 * Cloud SQL lento o caído:
 * - `retrasar(ms)`: lo que manda el cliente llega al servidor `ms` más tarde
 *   (en orden).
 * - `retrasarRespuestas(ms)`: lo que contesta el servidor llega al cliente
 *   `ms` más tarde (en orden): la sentencia ya se ejecutó cuando el cliente
 *   se entera.
 * - `congelar()`: lo que manda el cliente no llega nunca.
 * - `congelarLasAbiertas()`: igual, pero solo en las conexiones abiertas
 *   ahora (una conexión medio abierta); las nuevas pasan.
 * - `retener()`: lo que manda el cliente se guarda, en orden, hasta
 *   `reanudar()`, que lo entrega (una consulta colgada que acaba
 *   ejecutándose tarde).
 * - `cortar()`: cierra las conexiones abiertas y rechaza las nuevas.
 * - `reanudar()`: vuelve a dejar pasar (y a aceptar conexiones), también en
 *   las conexiones congeladas una a una.
 */
export function crearProxyTcp(destino: { host: string; port: number }) {
  let modo: "pasar" | "congelar" | "retener" | "rechazar" = "pasar";
  let retrasoMs = 0;
  let retrasoDeRespuestasMs = 0;
  const sockets = new Set<net.Socket>();
  const clientes = new Set<net.Socket>();
  const congeladas = new Set<net.Socket>();
  const retenidos: Array<{ servidor: net.Socket; datos: Buffer }> = [];
  const servidor = net.createServer((cliente) => {
    if (modo === "rechazar") {
      cliente.destroy();
      return;
    }
    const redis = net.connect(destino);
    sockets.add(cliente);
    sockets.add(redis);
    clientes.add(cliente);
    cliente.on("data", (datos) => {
      if (congeladas.has(cliente)) return;
      if (modo === "retener") {
        retenidos.push({ servidor: redis, datos });
        return;
      }
      if (modo !== "pasar") return;
      if (retrasoMs > 0) setTimeout(() => redis.write(datos), retrasoMs);
      else redis.write(datos);
    });
    redis.on("data", (datos) => {
      if (retrasoDeRespuestasMs > 0) {
        setTimeout(() => cliente.write(datos), retrasoDeRespuestasMs);
      } else {
        cliente.write(datos);
      }
    });
    const cerrar = () => {
      cliente.destroy();
      redis.destroy();
      sockets.delete(cliente);
      sockets.delete(redis);
      clientes.delete(cliente);
      congeladas.delete(cliente);
    };
    cliente.on("close", cerrar);
    redis.on("close", cerrar);
    cliente.on("error", () => {});
    redis.on("error", () => {});
  });
  return {
    /** Escucha en un puerto libre de 127.0.0.1 y lo devuelve. */
    escuchar: () =>
      new Promise<number>((resolve) =>
        servidor.listen(0, "127.0.0.1", () =>
          resolve((servidor.address() as net.AddressInfo).port)
        )
      ),
    retrasar: (ms: number) => {
      retrasoMs = ms;
    },
    retrasarRespuestas: (ms: number) => {
      retrasoDeRespuestasMs = ms;
    },
    congelar: () => {
      modo = "congelar";
    },
    /** Devuelve cuántas conexiones ha congelado. */
    congelarLasAbiertas: () => {
      for (const cliente of clientes) congeladas.add(cliente);
      return clientes.size;
    },
    retener: () => {
      modo = "retener";
    },
    cortar: () => {
      modo = "rechazar";
      for (const s of sockets) s.destroy();
      sockets.clear();
      retenidos.length = 0;
    },
    reanudar: () => {
      modo = "pasar";
      congeladas.clear();
      for (const { servidor: destinoDeLosDatos, datos } of retenidos.splice(
        0
      )) {
        if (!destinoDeLosDatos.destroyed) destinoDeLosDatos.write(datos);
      }
    },
    cerrar: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        servidor.close(() => resolve());
      }),
  };
}

/** `REDIS_URL` que pasa por el proxy, con el mismo índice de base de datos. */
export function urlAtravesDelProxy(urlReal: string, puerto: number): string {
  const real = new URL(urlReal);
  return `redis://127.0.0.1:${puerto}${real.pathname}`;
}

export function destinoDe(urlReal: string): { host: string; port: number } {
  const real = new URL(urlReal);
  return { host: real.hostname, port: Number(real.port || 6379) };
}
