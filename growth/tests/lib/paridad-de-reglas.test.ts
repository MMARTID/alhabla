import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO,
  NOMBRES_DE_REGLAS_BLANDAS,
  NOMBRES_DE_REGLAS_DURAS,
  REGLAS_DE_AGENDA,
  UMBRAL_DE_AVISO_DE_SIMILITUD,
} from "@/lib/demo/reglas-demo";

/**
 * El motor de reglas de la demostración (`src/lib/demo/reglas-demo.ts`) es
 * una copia del del backend. Este test lee `cumplimiento.ts` y falla si las
 * dos se separan en lo que la Revisión enseña por nombre: las reglas duras y
 * blandas, su orden, cuáles son de agenda y los umbrales. Si falla, copia el
 * cambio a `reglas-demo.ts` (y mira también los mensajes de `evaluarCumplimiento`).
 */
const RUTA_DEL_BACKEND = path.resolve(
  import.meta.dirname,
  "../../../backend/src/modules/growth/cumplimiento.ts"
);

const codigo = readFileSync(RUTA_DEL_BACKEND, "utf8");

/** Lee `export const NOMBRE = [ "a", "b" ] ...;` */
function leerLista(nombre: string): string[] {
  const inicio = codigo.indexOf(`export const ${nombre}`);
  expect(inicio, `no se encontró ${nombre} en cumplimiento.ts`).toBeGreaterThan(
    -1
  );
  const abre = codigo.indexOf("[", codigo.indexOf("=", inicio));
  const cierra = codigo.indexOf("]", abre);
  return [...codigo.slice(abre, cierra).matchAll(/"([a-z_]+)"/g)].map(
    (m) => m[1]
  );
}

function leerNumero(nombre: string): number {
  const m = codigo.match(
    new RegExp(`export const ${nombre}\\s*=\\s*([0-9.]+)`)
  );
  expect(m, `no se encontró ${nombre}`).not.toBeNull();
  return Number(m![1]);
}

/** Los nombres de regla en el orden en que `evaluarCumplimiento` las apunta. */
function leerOrdenDeEvaluacion(): string[] {
  const cuerpo = codigo.slice(
    codigo.indexOf("export function evaluarCumplimiento")
  );
  return [...cuerpo.matchAll(/comprobacion\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
}

describe("las reglas de la demostración siguen a las del backend", () => {
  it("las reglas duras son las mismas, en el mismo orden", () => {
    expect([...NOMBRES_DE_REGLAS_DURAS]).toEqual(
      leerLista("NOMBRES_DE_REGLAS_DURAS")
    );
    expect(NOMBRES_DE_REGLAS_DURAS).toHaveLength(12);
  });

  it("las reglas blandas son las mismas, en el mismo orden", () => {
    expect([...NOMBRES_DE_REGLAS_BLANDAS]).toEqual(
      leerLista("NOMBRES_DE_REGLAS_BLANDAS")
    );
    expect(NOMBRES_DE_REGLAS_BLANDAS).toHaveLength(5);
  });

  it("el motor del backend las evalúa en ese mismo orden (duras y luego blandas)", () => {
    expect(leerOrdenDeEvaluacion()).toEqual([
      ...NOMBRES_DE_REGLAS_DURAS,
      ...NOMBRES_DE_REGLAS_BLANDAS,
    ]);
  });

  it("las reglas de agenda son las mismas", () => {
    expect([...REGLAS_DE_AGENDA].sort()).toEqual(
      leerLista("REGLAS_DE_AGENDA").sort()
    );
  });

  it("los días entre contactos al mismo dominio y el umbral de aviso de similitud son los mismos", () => {
    expect(DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO).toBe(
      leerNumero("DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO")
    );
    expect(UMBRAL_DE_AVISO_DE_SIMILITUD).toBe(
      leerNumero("UMBRAL_DE_AVISO_DE_SIMILITUD")
    );
  });
});
