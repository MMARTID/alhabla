import { describe, expect, it } from "vitest";
import {
  LIMITE_DE_SALIDA,
  acotarHastaQueQuepa,
  ajustarTamano,
  darFormaAlConocimiento,
  tamano,
} from "../../mcp/growth/salidas.js";

/**
 * La red de seguridad del tamaño y el cursor del conocimiento, sin pasar por el
 * servidor MCP: funciones puras con respuestas sintéticas.
 */

describe("ajustarTamano", () => {
  it("lo que cabe se devuelve tal cual", () => {
    const datos = { a: [1, 2, 3], b: "texto" };
    expect(ajustarTamano(datos)).toBe(datos);
  });

  it("una lista enorme pierde elementos del final, no da error, y lo dice", () => {
    const lista = Array.from({ length: 1_000 }, (_, i) => ({
      id: i,
      cuerpo: "x".repeat(300),
    }));
    const salida = ajustarTamano({ total: 1_000, lista }) as {
      error?: string;
      lista: { id: number }[];
      recortada: string[];
    };
    expect(salida.error).toBeUndefined();
    expect(tamano(salida)).toBeLessThanOrEqual(LIMITE_DE_SALIDA);
    expect(salida.lista.length).toBeGreaterThan(10);
    expect(salida.lista.length).toBeLessThan(1_000);
    // Se queda con los primeros, en orden, y los textos intactos.
    expect(salida.lista.map((e) => e.id)).toEqual(
      Array.from({ length: salida.lista.length }, (_, i) => i)
    );
    expect(salida.recortada.join(" ")).toMatch(
      new RegExp(`lista: se dejaron ${salida.lista.length} de 1000`)
    );
  });

  it("recorta primero la lista que más pesa y deja la pequeña entera", () => {
    const grande = Array.from(
      { length: 400 },
      (_, i) => `g${i}${"x".repeat(100)}`
    );
    const pequena = ["a", "b", "c"];
    const salida = ajustarTamano({ pequena, grande }) as {
      pequena: string[];
      grande: string[];
    };
    expect(salida.pequena).toEqual(pequena);
    expect(salida.grande.length).toBeLessThan(400);
    expect(tamano(salida)).toBeLessThanOrEqual(LIMITE_DE_SALIDA);
  });

  it("listas anidadas: se recortan por dentro sin romper la estructura", () => {
    const salida = ajustarTamano({
      items: Array.from({ length: 20 }, (_, i) => ({
        id: i,
        hijos: Array.from({ length: 100 }, (_, j) => ({
          j,
          texto: "z".repeat(60),
        })),
      })),
    }) as { items: { id: number; hijos: unknown[] }[] };
    expect(tamano(salida)).toBeLessThanOrEqual(LIMITE_DE_SALIDA);
    expect(salida.items.length).toBeGreaterThan(0);
    for (const item of salida.items) {
      expect(typeof item.id).toBe("number");
      expect(Array.isArray(item.hijos)).toBe(true);
      expect(item.hijos.length).toBeGreaterThan(0);
    }
  });

  it("un texto gigante se acorta y la lista pequeña no se toca", () => {
    const salida = ajustarTamano({
      texto: "y".repeat(100_000),
      lista: [1, 2],
    }) as { texto: string; lista: number[]; recortada: string[] };
    expect(salida.texto.length).toBeLessThanOrEqual(2_000);
    expect(salida.lista).toEqual([1, 2]);
    expect(salida.recortada[0]).toMatch(/2000/);
  });

  it("una lista de textos grandes acorta también los textos si quitar elementos no basta", () => {
    const salida = ajustarTamano({
      lista: Array.from({ length: 3 }, () => ({
        a: "a".repeat(9_000),
        b: "b".repeat(9_000),
      })),
    }) as { error?: string; lista: unknown[] };
    expect(salida.error).toBeUndefined();
    expect(tamano(salida)).toBeLessThanOrEqual(LIMITE_DE_SALIDA);
    expect(salida.lista.length).toBeGreaterThan(0);
  });

  it("solo da error cuando ni un elemento por lista cabe", () => {
    // Sin listas que recortar y con tantas claves que ni a 300 caracteres cabe.
    const enorme = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`c${i}`, "w".repeat(300)])
    );
    const salida = ajustarTamano(enorme) as { error?: string };
    expect(salida.error).toMatch(/demasiado grande/);
  });

  it("la nota de lo recortado también cuenta para el límite", () => {
    for (const longitud of [60, 200, 1_000, 5_000]) {
      const salida = ajustarTamano({
        lista: Array.from({ length: longitud }, (_, i) => ({
          i,
          t: "t".repeat(150),
        })),
      });
      expect(tamano(salida)).toBeLessThanOrEqual(LIMITE_DE_SALIDA);
    }
  });
});

describe("acotarHastaQueQuepa", () => {
  const construir = (dentro: string[]) => ({
    rodea: "r".repeat(1_000),
    dentro,
  });

  it("mide la estructura final, con lo que rodea a la lista", () => {
    const elementos = Array.from({ length: 100 }, () => "e".repeat(100));
    const { elementos: dentro, omitidos } = acotarHastaQueQuepa(
      elementos,
      construir,
      5_000
    );
    expect(dentro.length + omitidos).toBe(100);
    expect(tamano(construir(dentro))).toBeLessThanOrEqual(5_000);
    // Y es el máximo: uno más ya no cabe.
    expect(
      tamano(construir(elementos.slice(0, dentro.length + 1)))
    ).toBeGreaterThan(5_000);
  });

  it("si todo cabe, no quita nada", () => {
    const r = acotarHastaQueQuepa(["a", "b"], construir);
    expect(r).toEqual({ elementos: ["a", "b"], omitidos: 0 });
  });

  it("nunca deja la lista vacía por tamaño", () => {
    const r = acotarHastaQueQuepa(["x".repeat(50_000), "y"], construir);
    expect(r.elementos).toHaveLength(1);
    expect(r.omitidos).toBe(1);
  });

  it("una lista vacía se queda vacía", () => {
    expect(acotarHastaQueQuepa([], construir)).toEqual({
      elementos: [],
      omitidos: 0,
    });
  });
});

describe("darFormaAlConocimiento: el cursor", () => {
  const afirmacion = (i: number, extra: Record<string, unknown> = {}) => ({
    clave: `pagina.p${String(i).padStart(3, "0")}`,
    tipo: "pagina",
    texto: "t".repeat(100),
    fuente: "web/src/lib/paginas.ts",
    commitSha: "a".repeat(40),
    ...extra,
  });

  it("pasa el cursor del backend y avisa de que hay más", () => {
    const r = darFormaAlConocimiento(
      {
        snapshot: null,
        total: 10,
        data: [afirmacion(1), afirmacion(2)],
        siguiente: "pagina.p002",
      },
      { limitePedido: 2 }
    );
    expect(r.siguiente).toBe("pagina.p002");
    expect(r.puedeHaberMas).toBe(true);
    expect(r.nota).toContain('desde="pagina.p002"');
    expect(r.total).toBe(10);
    expect(r).not.toHaveProperty("omitidas");
  });

  it("sin más páginas, el cursor es null y no hay aviso", () => {
    const r = darFormaAlConocimiento(
      { data: [afirmacion(1)], total: 1, siguiente: null },
      { limitePedido: 50 }
    );
    expect(r.siguiente).toBeNull();
    expect(r).not.toHaveProperty("puedeHaberMas");
  });

  it("si se recorta por tamaño, el cursor es la última clave devuelta", () => {
    const muchas = Array.from({ length: 100 }, (_, i) =>
      afirmacion(i, { texto: "t".repeat(400) })
    );
    const r = darFormaAlConocimiento(
      { data: muchas, total: 300, siguiente: "pagina.p099" },
      { limitePedido: 100 }
    );
    expect(tamano(r)).toBeLessThanOrEqual(LIMITE_DE_SALIDA);
    expect(r.omitidas).toBeGreaterThan(0);
    expect(r.siguiente).toBe(r.afirmaciones.at(-1)!.clave);
    expect(r.afirmaciones.length + r.omitidas!).toBe(100);
  });

  it("un backend sin cursor que llena la página: se sigue desde la última clave", () => {
    const r = darFormaAlConocimiento(
      { data: [afirmacion(1), afirmacion(2), afirmacion(3)] },
      { limitePedido: 3 }
    );
    expect(r.siguiente).toBe("pagina.p003");
    expect(r.puedeHaberMas).toBe(true);
  });

  it("el valor solo sale si se pide, y un texto largo se marca como recortado", () => {
    const datos = {
      data: [
        afirmacion(1, { valor: { a: 1 }, texto: "l".repeat(600) }),
        afirmacion(2, { valor: { b: 2 }, textoRecortado: true }),
      ],
    };
    const sinValor = darFormaAlConocimiento(datos, { limitePedido: 10 });
    for (const a of sinValor.afirmaciones)
      expect(a).not.toHaveProperty("valor");
    expect(sinValor.afirmaciones[0]!.texto).toHaveLength(400);
    expect(sinValor.afirmaciones[0]!.textoRecortado).toBe(true);
    expect(sinValor.afirmaciones[1]!.textoRecortado).toBe(true);

    const conValor = darFormaAlConocimiento(datos, {
      limitePedido: 10,
      incluirValor: true,
    });
    expect(conValor.afirmaciones[0]!.valor).toEqual({ a: 1 });
  });

  it("tolera una respuesta sin forma", () => {
    for (const rara of [null, undefined, "x", 3, [], { data: "no" }]) {
      const r = darFormaAlConocimiento(rara, { limitePedido: 50 });
      expect(r.afirmaciones).toEqual([]);
      expect(r.siguiente).toBeNull();
    }
  });
});
