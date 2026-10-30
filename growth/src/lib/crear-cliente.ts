import { clienteHttp } from "./cliente-http";
import type { ClienteGrowth } from "./cliente";

/**
 * El cliente que usa el panel. Es el PRIMERO de los dos únicos puntos de
 * bifurcación de la demostración (el otro es `PuertaDeSesion`): la condición
 * va escrita aquí, tal cual, y no en un módulo aparte, para que el compilador
 * la sustituya por `false` en producción y elimine como código muerto el
 * bloque entero, la importación de `lib/demo/*` incluida. Un paso de CI
 * comprueba que la sentinela de los datos de prueba no llega al build.
 */
export function crearCliente(): ClienteGrowth | Promise<ClienteGrowth> {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_GROWTH_DEMO === "1"
  ) {
    return import("./demo/cliente-demo").then(({ clienteDemo }) =>
      clienteDemo()
    );
  }
  return clienteHttp;
}
