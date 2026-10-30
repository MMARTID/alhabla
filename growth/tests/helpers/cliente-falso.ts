import { vi, type Mock } from "vitest";
import type { ClienteGrowth } from "@/lib/cliente";

export type ClienteFalso = {
  [K in keyof ClienteGrowth]: Mock<ClienteGrowth[K]>;
};

const NOMBRES: (keyof ClienteGrowth)[] = [
  "yo",
  "resumen",
  "listarOportunidades",
  "anadirUrl",
  "detalleDeOportunidad",
  "decidir",
  "listarBorradores",
  "detalleDeBorrador",
  "editarBorrador",
  "listarDecisiones",
  "listarGestiones",
  "conocimiento",
  "historialDeAfirmacion",
  "listarEjecuciones",
  "detalleDeEjecucion",
  "ajustes",
  "guardarAjustes",
  "competidores",
];

/**
 * Un cliente cuyos métodos son espías que fallan si nadie los configura:
 * un test solo responde a lo que de verdad usa. `clienteFalso({ yo: ... })`
 * sustituye los que se le pasen.
 */
export function clienteFalso(
  sustitutos: Partial<ClienteGrowth> = {}
): ClienteFalso {
  const cliente = {} as Record<string, Mock>;
  for (const nombre of NOMBRES) {
    cliente[nombre] = vi.fn(
      (sustitutos[nombre] as ((...args: unknown[]) => unknown) | undefined) ??
        (async () => {
          throw new Error(
            `clienteFalso.${nombre} no está configurado en este test.`
          );
        })
    );
  }
  return cliente as unknown as ClienteFalso;
}
