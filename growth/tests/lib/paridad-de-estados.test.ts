import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ESTADO_POR_ACCION, TRANSICIONES } from "@/lib/demo/estados-demo";
import { ESTADOS_DE_OPORTUNIDAD } from "@/lib/types";

/**
 * La demostración aplica «la misma tabla de estados que el backend», pero
 * copiada a mano. Este test la compara con el fichero del backend para que
 * las dos no se separen sin que nadie se entere. Si falla, copia la tabla de
 * backend/src/modules/growth/estados.ts a src/lib/demo/estados-demo.ts.
 */
const RUTA_DEL_BACKEND = path.resolve(
  import.meta.dirname,
  "../../../backend/src/modules/growth/estados.ts"
);

/** Lee `const TRANSICIONES = { estado: { destino: ["actor", ...] } }`. */
function leerTablaDelBackend(codigo: string) {
  const inicio = codigo.indexOf("const TRANSICIONES");
  const abre = codigo.indexOf("{", codigo.indexOf("=", inicio));
  const cierra = codigo.indexOf("\n};", abre);
  const cuerpo = codigo.slice(abre, cierra);
  const tabla: Record<string, Record<string, string[]>> = {};
  let estado: string | null = null;
  for (const linea of cuerpo.split("\n")) {
    const sinComentario = linea.replace(/\/\/.*$/, "").trimEnd();
    const abreEstado = sinComentario.match(/^ {2}(\w+): \{(\},?)?$/);
    if (abreEstado) {
      estado = abreEstado[1];
      tabla[estado] = {};
      if (abreEstado[2]) estado = null; // `conseguida: {},`
      continue;
    }
    if (/^ {2}\},?$/.test(sinComentario)) {
      estado = null;
      continue;
    }
    const transicion = sinComentario.match(/^ {4}(\w+): \[(.*)\],?$/);
    if (transicion && estado) {
      tabla[estado][transicion[1]] = [
        ...transicion[2].matchAll(/"(\w+)"/g),
      ].map((m) => m[1]);
    }
  }
  return tabla;
}

describe("la tabla de estados de la demostración", () => {
  const codigo = readFileSync(RUTA_DEL_BACKEND, "utf8");
  const delBackend = leerTablaDelBackend(codigo);

  it("se ha podido leer la del backend (13 estados)", () => {
    expect(Object.keys(delBackend).sort()).toEqual(
      [...ESTADOS_DE_OPORTUNIDAD].sort()
    );
    // Una comprobación de cordura del lector: hay transiciones de verdad.
    expect(delBackend.pendiente_aprobacion.aprobada).toEqual(["admin"]);
  });

  it("es idéntica: mismos estados, mismos destinos, mismos actores", () => {
    const copia = JSON.parse(JSON.stringify(TRANSICIONES)) as typeof delBackend;
    for (const estado of ESTADOS_DE_OPORTUNIDAD) {
      const esperado = delBackend[estado];
      const actual = copia[estado];
      expect(Object.keys(actual).sort(), `destinos de ${estado}`).toEqual(
        Object.keys(esperado).sort()
      );
      for (const destino of Object.keys(esperado)) {
        expect([...actual[destino]].sort(), `${estado} → ${destino}`).toEqual(
          [...esperado[destino]].sort()
        );
      }
    }
  });

  it("copia también ESTADO_POR_ACCION del servicio", () => {
    const servicio = readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../../backend/src/modules/growth/service.ts"
      ),
      "utf8"
    );
    const bloque = servicio.match(/const ESTADO_POR_ACCION[^{]*\{([^}]*)\}/);
    expect(
      bloque,
      "no se encontró ESTADO_POR_ACCION en service.ts"
    ).not.toBeNull();
    const delServicio = Object.fromEntries(
      [...bloque![1].matchAll(/(\w+):\s*"(\w+)"/g)].map((m) => [m[1], m[2]])
    );
    // El backend no tiene todavía `rechazado` si esa decisión llega después:
    // todo lo que el servicio ya conoce tiene que coincidir.
    for (const [accion, estado] of Object.entries(delServicio)) {
      expect(
        ESTADO_POR_ACCION[accion as keyof typeof ESTADO_POR_ACCION],
        accion
      ).toBe(estado);
    }
    expect(ESTADO_POR_ACCION.rechazado).toBe("sin_respuesta");
  });
});
