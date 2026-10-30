import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ErroresDeExtraccion,
  TIPOS_QUE_CUBRE_EL_EXTRACTOR,
  construirAfirmaciones,
  type EntradaDeConocimiento,
} from "../../mcp/growth/conocimiento/construir.js";
import { cargarEntrada } from "../../mcp/growth/conocimiento/entrada.js";
import {
  huellasActuales,
  reescribirHuellas,
} from "../../mcp/growth/conocimiento/huellas.js";
import {
  COMPETIDORES_ADICIONALES,
  FRASES_DECLARADAS,
  MAPA_DE_PRODUCT,
} from "../../mcp/growth/conocimiento/mapa.js";
import { huellaDe } from "../../mcp/growth/conocimiento/productMd.js";
import { mencionaPalabra } from "../../src/modules/growth/cumplimiento.js";

/**
 * Revisión 1b (conocimiento M2, M3, M1, B1 y e2e A1): lo que protege que el
 * texto revisado a mano siga atado al bullet del que sale, que una limitación
 * que desaparece haga fallar la extracción (no solo avisar) y que la carga
 * lleve siempre los tipos que cubre.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const hayRepo =
  existsSync(join(RAIZ, "PRODUCT.md")) &&
  existsSync(join(RAIZ, "web", "src", "lib", "plans.ts"));

function copia(entrada: EntradaDeConocimiento): EntradaDeConocimiento {
  return structuredClone(entrada);
}

function problemasDe(entrada: EntradaDeConocimiento): string[] {
  try {
    construirAfirmaciones(entrada);
  } catch (error) {
    if (error instanceof ErroresDeExtraccion) return [...error.problemas];
    throw error;
  }
  return [];
}

describe.skipIf(!hayRepo)("el mapa sobre el repo real", () => {
  let entrada: EntradaDeConocimiento;
  let resultado: ReturnType<typeof construirAfirmaciones>;

  beforeAll(async () => {
    entrada = await cargarEntrada(RAIZ);
    resultado = construirAfirmaciones(entrada);
  }, 30_000);

  const de = (clave: string) =>
    resultado.afirmaciones.find((a) => a.clave === clave)!;

  describe("huellas: el texto revisado a mano va atado al bullet", () => {
    it("hoy todas las huellas coinciden con PRODUCT.md (y hay una por cada texto revisado)", () => {
      const huellas = huellasActuales(entrada.productMd);
      const destinos = MAPA_DE_PRODUCT.filter((e) => "destino" in e).length;
      expect(huellas).toHaveLength(destinos + FRASES_DECLARADAS.length);
      expect(huellas.filter((h) => h.actual !== h.esperada)).toEqual([]);
      for (const h of huellas) expect(h.esperada).toMatch(/^[0-9a-f]{12}$/);
    });

    it("«5–480 min» → «10–480 min» en PRODUCT.md hace fallar la extracción", () => {
      const rota = copia(entrada);
      const bullet = rota.productMd.bullets.find((b) =>
        /^Duración de servicios/.test(b.texto)
      )!;
      expect(bullet.texto).toContain("5–480 min");
      bullet.texto = bullet.texto.replace("5–480 min", "10–480 min");

      const problemas = problemasDe(rota);
      const mensaje = problemas.join("\n");
      expect(problemas).toHaveLength(1);
      expect(mensaje).toMatch(
        /El bullet de limite\.duracion_y_capacidad cambió desde que se revisó su texto/
      );
      expect(mensaje).toMatch(/ahora dice «Duración de servicios 10–480 min/);
      expect(mensaje).toMatch(/Revisa el texto .* y actualiza la huella/);
      expect(mensaje).toMatch(/--actualizar-huellas/);
    });

    it("mientras la huella no se actualice, ni los parsers ni la carga la dan por buena", () => {
      const rota = copia(entrada);
      const bullet = rota.productMd.bullets.find((b) =>
        /^Duración de servicios/.test(b.texto)
      )!;
      bullet.texto = bullet.texto.replace("5–480 min", "10–480 min");
      expect(() => construirAfirmaciones(rota)).toThrow(ErroresDeExtraccion);
      const [h] = huellasActuales(rota.productMd).filter(
        (x) => x.clave === "limite.duracion_y_capacidad"
      );
      expect(h.actual).not.toBe(h.esperada);
      expect(h.actual).toBe(huellaDe(bullet.texto));
    });

    it("tras releer y actualizar la huella, la extracción vuelve a pasar", () => {
      const rota = copia(entrada);
      const bullet = rota.productMd.bullets.find((b) =>
        /^Duración de servicios/.test(b.texto)
      )!;
      bullet.texto = bullet.texto.replace("5–480 min", "10–480 min");
      const entrada2 = MAPA_DE_PRODUCT.find(
        (e) =>
          "destino" in e && e.destino.clave === "limite.duracion_y_capacidad"
      )! as { destino: { huella: string } };
      const original = entrada2.destino.huella;
      try {
        entrada2.destino.huella = huellaDe(bullet.texto);
        expect(problemasDe(rota)).toEqual([]);
      } finally {
        entrada2.destino.huella = original;
      }
    });

    it("un cambio en un bullet que el mapa ignora no obliga a nada", () => {
      const rota = copia(entrada);
      const bullet = rota.productMd.bullets.find((b) =>
        /^Facturación:/.test(b.texto)
      )!;
      bullet.texto = `${bullet.texto} Y una frase más.`;
      expect(problemasDe(rota)).toEqual([]);
    });

    it("cada huella cambia si cambia su bullet (no hay dos destinos con la misma)", () => {
      const huellas = huellasActuales(entrada.productMd).map((h) => h.esperada);
      expect(new Set(huellas).size).toBe(huellas.length);
    });
  });

  describe("limitaciones declaradas dentro de un bullet", () => {
    it("que la frase desaparezca es un ERROR de la extracción, no un aviso", () => {
      const rota = copia(entrada);
      const bullet = rota.productMd.bullets.find((b) =>
        /^Tu asistente:/.test(b.texto)
      )!;
      expect(bullet.texto).toContain("no está aún en WhatsApp");
      bullet.texto = bullet.texto.replace(
        "Reabrir un día ya cerrado no está aún en WhatsApp",
        "Reabrir un día ya cerrado ya se puede por WhatsApp"
      );
      const problemas = problemasDe(rota).join("\n");
      expect(problemas).toMatch(
        /La limitación limite\.asistente\.reabrir_dia_cerrado ya no aparece en PRODUCT\.md/
      );
      expect(problemas).toMatch(/quita la entrada de FRASES_DECLARADAS/);
    });

    it("si el bullet entero desaparece, también", () => {
      const rota = copia(entrada);
      rota.productMd.bullets = rota.productMd.bullets.filter(
        (b) => !/^Tu asistente:/.test(b.texto)
      );
      expect(problemasDe(rota).join("\n")).toMatch(
        /La limitación limite\.asistente\.reabrir_dia_cerrado ya no aparece/
      );
    });

    it("la frase sigue pero su contexto cambió: hay que releerla", () => {
      const rota = copia(entrada);
      const bullet = rota.productMd.bullets.find((b) =>
        /^Tu asistente:/.test(b.texto)
      )!;
      bullet.texto = bullet.texto.replace(
        "no está aún en WhatsApp",
        "no está aún en WhatsApp salvo para el dueño"
      );
      const problemas = problemasDe(rota).join("\n");
      expect(problemas).toMatch(
        /La frase de la limitación limite\.asistente\.reabrir_dia_cerrado cambió/
      );
    });
  });

  describe("tipos: la carga dice de qué tipos es completa", () => {
    it("el resultado lleva los siete tipos, y todos tienen afirmaciones", () => {
      expect(resultado.tipos).toEqual([...TIPOS_QUE_CUBRE_EL_EXTRACTOR]);
      expect(resultado.tipos).toHaveLength(7);
      for (const tipo of resultado.tipos) {
        expect(resultado.afirmaciones.some((a) => a.tipo === tipo)).toBe(true);
      }
    });

    it("un tipo vaciado en el repo se detecta al extraer, con la fuente a revisar", () => {
      const rota = copia(entrada);
      rota.web.comparativas.resumen = [];
      rota.web.comparativas.fuentes = [];
      const problemas = problemasDe(rota).join("\n");
      expect(problemas).toMatch(
        /no ha producido ninguna afirmación de tipo comparativa/
      );
      expect(problemas).toMatch(/web\/src\/lib\/comparativas\.ts/);
    });

    it("otro tipo vaciado: ningún sector", () => {
      const rota = copia(entrada);
      rota.web.sectores = [];
      expect(problemasDe(rota).join("\n")).toMatch(
        /ninguna afirmación de tipo sector/
      );
    });
  });

  describe("competidores sembrados", () => {
    it("además de los de comparativas.ts van HeyDiga y fonio (pendientes de confirmar por el fundador)", () => {
      expect(COMPETIDORES_ADICIONALES).toEqual([
        { nombre: "HeyDiga", dominio: "heydiga.ai" },
        { nombre: "fonio", dominio: "fonio.ai" },
      ]);
      const dominios = resultado.competidores.map((c) => c.dominio);
      expect(dominios).toEqual(
        expect.arrayContaining(["heydiga.ai", "fonio.ai", "vapi.ai"])
      );
      expect(new Set(dominios).size).toBe(dominios.length);
      expect(resultado.competidores).toContainEqual({
        nombre: "HeyDiga",
        dominio: "heydiga.ai",
      });
    });

    it("no hay comparativas de ellos (la web no se compara con HeyDiga ni fonio) y ninguna prohibida los nombra", () => {
      expect(
        resultado.afirmaciones.filter(
          (a) =>
            a.tipo === "comparativa" &&
            ["heydiga.ai", "fonio.ai"].includes(
              (a.valor as { competidorDominio: string }).competidorDominio
            )
        )
      ).toEqual([]);
      const prohibidos = resultado.afirmaciones
        .filter((a) => a.tipo === "prohibida")
        .flatMap((a) => (a.valor as { terminos: string[] }).terminos);
      for (const competidor of resultado.competidores) {
        for (const termino of prohibidos) {
          expect(
            mencionaPalabra(competidor.nombre, termino),
            `${competidor.nombre} ↔ ${termino}`
          ).toBe(false);
        }
      }
    });

    it("el competidor de comparativas.ts no se duplica si ya estuviera", () => {
      const rota = copia(entrada);
      rota.web.comparativas.resumen[0].nombre = "HeyDiga";
      rota.web.comparativas.fuentes = rota.web.comparativas.fuentes.map((f) =>
        f.nombre.startsWith("Retell AI:")
          ? {
              ...f,
              nombre: f.nombre.replace("Retell AI", "HeyDiga"),
              url: "https://heydiga.ai/p",
            }
          : f
      );
      const r = construirAfirmaciones(rota);
      expect(
        r.competidores.filter((c) => c.dominio === "heydiga.ai")
      ).toHaveLength(1);
    });
  });

  describe("textos revisados", () => {
    it("el registro de llamadas dice que la grabación depende de quien llama", () => {
      expect(de("funcion.registro_de_llamadas").texto).toBe(
        "Registro de llamadas con transcripción, grabación (si quien llama lo permite) y clasificación de resultado."
      );
    });

    it("el negocio de ejemplo de cada sector va marcado como ficticio", () => {
      const sectores = resultado.afirmaciones.filter(
        (a) => a.tipo === "sector"
      );
      expect(sectores).toHaveLength(8);
      for (const s of sectores) {
        const valor = s.valor as Record<string, unknown>;
        expect(typeof valor.negocioDeEjemplo).toBe("string");
        expect(valor.negocioDeEjemploEsFicticio).toBe(true);
      }
    });
  });
});

describe("reescribirHuellas", () => {
  const CODIGO = [
    "export const MAPA = [",
    "  {",
    "    destino: {",
    '      clave: "funcion.a",',
    '      huella: "000000000000",',
    '      texto: "A",',
    "    },",
    "  },",
    "  {",
    "    destino: {",
    '      clave: "limite.b.c",',
    '      huella: "111111111111",',
    '      texto: "B",',
    "    },",
    "  },",
    "];",
  ].join("\n");

  it("cambia solo la huella de la clave indicada", () => {
    const nuevo = reescribirHuellas(CODIGO, [
      { clave: "limite.b.c", esperada: "111111111111", actual: "abcdefabcdef" },
    ]);
    expect(nuevo).toContain(
      'clave: "limite.b.c",\n      huella: "abcdefabcdef"'
    );
    expect(nuevo).toContain(
      'clave: "funcion.a",\n      huella: "000000000000"'
    );
    expect(nuevo.replace("abcdefabcdef", "111111111111")).toBe(CODIGO);
  });

  it("falla si la clave ya no encuentra su origen o no tiene la forma esperada", () => {
    expect(() =>
      reescribirHuellas(CODIGO, [
        { clave: "funcion.a", esperada: "000000000000", actual: null },
      ])
    ).toThrow(/ya no encuentra su origen/);
    expect(() =>
      reescribirHuellas(CODIGO, [
        {
          clave: "funcion.z",
          esperada: "000000000000",
          actual: "abcdefabcdef",
        },
      ])
    ).toThrow(/No encuentro/);
  });
});
