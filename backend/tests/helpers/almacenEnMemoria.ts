import { vi } from "vitest";

/**
 * El almacén temporal (`src/lib/almacenTemporal.ts`) en memoria, para los
 * tests unitarios que antes simulaban Redis. Cumple lo mismo que la versión
 * de Postgres, que tiene sus propios tests de integración
 * (tests/integration/lib/clavesTemporales.test.ts): una clave caducada no
 * existe, NX solo gana si no hay una viva, GETDEL borra al leer, los campos
 * solo se escriben en una clave viva y los contadores son de ventana fija.
 * La hora es la de `Date.now()`, así que respeta `vi.useFakeTimers`.
 *
 * Uso:
 *   vi.mock("<ruta>/src/lib/almacenTemporal.js", async () =>
 *     (await import("<ruta>/tests/helpers/almacenEnMemoria.js")).almacenEnMemoria);
 * y `reiniciarAlmacenEnMemoria()` en el beforeEach. Cada función es un
 * `vi.fn`: un test puede forzar un fallo con `mockRejectedValueOnce`.
 */

type Entrada = {
  valor: string | Record<string, string>;
  expiraEn: number;
  businessId: string | null;
};

const claves = new Map<string, Entrada>();
const contadores = new Map<string, { valor: number; expiraEn: number }>();

function viva(entrada: Entrada | undefined): entrada is Entrada {
  return Boolean(entrada) && entrada!.expiraEn > Date.now();
}

function hasta(ttlMs: number): number {
  return Date.now() + Math.max(1, Math.floor(ttlMs));
}

type Opciones = { businessId?: string | null };

const implementaciones = {
  guardarClave: async (
    clave: string,
    valor: string,
    ttlMs: number,
    opciones: Opciones = {}
  ) => {
    claves.set(clave, {
      valor,
      expiraEn: hasta(ttlMs),
      businessId: opciones.businessId ?? null,
    });
  },
  guardarClaveSiNoExiste: async (
    clave: string,
    valor: string,
    ttlMs: number,
    opciones: Opciones = {}
  ) => {
    if (viva(claves.get(clave))) return false;
    claves.set(clave, {
      valor,
      expiraEn: hasta(ttlMs),
      businessId: opciones.businessId ?? null,
    });
    return true;
  },
  leerClave: async (clave: string) => {
    const entrada = claves.get(clave);
    return viva(entrada) && typeof entrada.valor === "string"
      ? entrada.valor
      : null;
  },
  consumirClave: async (clave: string) => {
    const entrada = claves.get(clave);
    claves.delete(clave);
    return viva(entrada) && typeof entrada.valor === "string"
      ? entrada.valor
      : null;
  },
  borrarClave: async (clave: string) => {
    claves.delete(clave);
  },
  guardarCampos: async (
    clave: string,
    campos: Record<string, string>,
    ttlMs: number,
    opciones: Opciones = {}
  ) => {
    const entrada = claves.get(clave);
    const previos =
      viva(entrada) && typeof entrada.valor === "object" ? entrada.valor : {};
    claves.set(clave, {
      valor: { ...previos, ...campos },
      expiraEn: hasta(ttlMs),
      businessId: opciones.businessId ?? null,
    });
  },
  fijarCampo: async (clave: string, campo: string, valor: string) => {
    const entrada = claves.get(clave);
    if (!viva(entrada) || typeof entrada.valor !== "object") return false;
    entrada.valor = { ...entrada.valor, [campo]: valor };
    return true;
  },
  fijarCampoSiNoExiste: async (clave: string, campo: string, valor: string) => {
    const entrada = claves.get(clave);
    if (
      !viva(entrada) ||
      typeof entrada.valor !== "object" ||
      campo in entrada.valor
    )
      return false;
    entrada.valor = { ...entrada.valor, [campo]: valor };
    return true;
  },
  leerCampos: async (clave: string) => {
    const entrada = claves.get(clave);
    return viva(entrada) && typeof entrada.valor === "object"
      ? { ...entrada.valor }
      : null;
  },
  incrementarContador: async (clave: string, ventanaMs: number) => {
    const contador = contadores.get(clave);
    if (!contador || contador.expiraEn <= Date.now()) {
      contadores.set(clave, { valor: 1, expiraEn: hasta(ventanaMs) });
      return 1;
    }
    contador.valor += 1;
    return contador.valor;
  },
  leerContador: async (clave: string) => {
    const contador = contadores.get(clave);
    return contador && contador.expiraEn > Date.now() ? contador.valor : 0;
  },
  incrementarContadores: async (
    incrementos: readonly {
      clave: string;
      ventanaMs: number;
      cantidad: number;
    }[]
  ) => {
    const resultado = new Map<string, { valor: number; ttlMs: number }>();
    for (const { clave, ventanaMs, cantidad } of incrementos) {
      const contador = contadores.get(clave);
      if (!contador || contador.expiraEn <= Date.now()) {
        contadores.set(clave, { valor: cantidad, expiraEn: hasta(ventanaMs) });
      } else {
        contador.valor += cantidad;
      }
      const actual = contadores.get(clave)!;
      resultado.set(clave, {
        valor: actual.valor,
        ttlMs: actual.expiraEn - Date.now(),
      });
    }
    return resultado;
  },
  purgarCaducados: async () => ({ claves: 0, contadores: 0, cerrojos: 0 }),
};

type Implementaciones = typeof implementaciones;

export const almacenEnMemoria = Object.fromEntries(
  Object.entries(implementaciones).map(([nombre, implementacion]) => [
    nombre,
    vi.fn(implementacion),
  ])
) as {
  [K in keyof Implementaciones]: ReturnType<typeof vi.fn<Implementaciones[K]>>;
};

/** Vacía el almacén y devuelve cada función a su implementación (deshace
 * los `mockRejectedValueOnce` de un test anterior). */
export function reiniciarAlmacenEnMemoria(): void {
  claves.clear();
  contadores.clear();
  for (const [nombre, implementacion] of Object.entries(implementaciones)) {
    const fn = almacenEnMemoria[nombre as keyof Implementaciones] as ReturnType<
      typeof vi.fn
    >;
    fn.mockReset();
    fn.mockImplementation(implementacion as never);
  }
}

/** Claves vivas ahora mismo (para comprobar qué se guardó). */
export function clavesVivas(): string[] {
  return [...claves.entries()]
    .filter(([, entrada]) => viva(entrada))
    .map(([clave]) => clave);
}

/** La entrada tal cual (valor, caducidad y negocio), viva o no. */
export function entradaDelAlmacen(clave: string): Entrada | undefined {
  return claves.get(clave);
}
