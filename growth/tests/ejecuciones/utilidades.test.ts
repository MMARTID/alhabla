import { describe, expect, it } from "vitest";
import {
  ETIQUETA_DE_ESTADO_DE_MODULO,
  TONO_DE_ESTADO_DE_MODULO,
  estaColgada,
  etiquetaDeModulo,
  leerModulos,
  leerResumen,
  numeroOpcional,
} from "@/components/ejecuciones/utilidades";
import ejecucionAbierta from "../fixtures/ejecucion-real-188.json";
import ejecucionCerrada from "../fixtures/ejecucion-real-199.json";

describe("etiquetaDeModulo", () => {
  it("traduce los módulos conocidos y humaniza el resto", () => {
    expect(etiquetaDeModulo("discovery")).toBe("Descubrimiento");
    expect(etiquetaDeModulo("Cumplimiento")).toBe("Cumplimiento");
    expect(etiquetaDeModulo("seo_geo")).toBe("Seo geo");
    expect(etiquetaDeModulo("__")).toBe("__");
  });

  it("no se deja engañar por claves del prototipo de Object", () => {
    expect(etiquetaDeModulo("constructor")).toBe("Constructor");
    expect(etiquetaDeModulo("__proto__")).toBe("Proto");
    expect(etiquetaDeModulo("toString")).toBe("ToString");
  });
});

describe("leerModulos", () => {
  it("lee estado, duración, error y notas", () => {
    expect(
      leerModulos({
        discovery: {
          estado: "ok",
          inicio: "2026-10-30T10:00:00Z",
          fin: "2026-10-30T10:01:30Z",
          notas: "Todo bien.",
        },
        calificacion: { estado: "error", error: "Falló." },
      })
    ).toEqual([
      {
        clave: "discovery",
        estado: "ok",
        duracion: 90,
        error: null,
        notas: "Todo bien.",
      },
      {
        clave: "calificacion",
        estado: "error",
        duracion: null,
        error: "Falló.",
        notas: null,
      },
    ]);
  });

  it.each([null, undefined, "texto", 3, ["a"]])(
    "con %j como módulos no hay ninguno",
    (modulos) => {
      expect(leerModulos(modulos)).toEqual([]);
    }
  );

  it("ignora lo que no es texto, un estado inventado y una duración imposible", () => {
    const [modulo] = leerModulos({
      x: {
        estado: "casi",
        error: { a: 1 },
        notas: 5,
        inicio: "2026-10-30T10:05:00Z",
        fin: "2026-10-30T10:00:00Z",
      },
    });
    expect(modulo).toEqual({
      clave: "x",
      estado: null,
      duracion: null,
      error: null,
      notas: null,
    });
  });

  it("un módulo que no es un objeto sale sin estado", () => {
    expect(leerModulos({ a: "x", b: null, c: 4 }).map((m) => m.estado)).toEqual(
      [null, null, null]
    );
  });
});

describe("leerResumen", () => {
  it("lee los contadores en orden, en singular o plural", () => {
    const resumen = leerResumen({
      bloqueadas: 1,
      candidatas: 23,
      calificadas: 0,
      notas: "Una nota.",
    });
    expect(resumen.contadores).toEqual([
      { clave: "candidatas", n: 23, texto: "candidatas" },
      { clave: "calificadas", n: 0, texto: "calificadas" },
      { clave: "bloqueadas", n: 1, texto: "bloqueada" },
    ]);
    expect(resumen.notas).toBe("Una nota.");
  });

  it("ordena los motivos de descarte de más a menos y descarta los vacíos", () => {
    expect(
      leerResumen({
        descartesPorMotivo: {
          idioma: 2,
          irrelevante: 9,
          duplicada: 0,
          mal: "x",
        },
      }).motivos
    ).toEqual([
      { codigo: "irrelevante", n: 9 },
      { codigo: "idioma", n: 2 },
    ]);
  });

  it("separa lo que declaró el agente", () => {
    const resumen = leerResumen({
      candidatas: 22,
      declaradoPorElAgente: { candidatas: 30 },
    });
    expect(resumen.declarado).toEqual([
      { clave: "candidatas", n: 30, texto: "candidatas" },
    ]);
    expect(leerResumen({ candidatas: 1 }).declarado).toBeNull();
  });

  it.each([null, undefined, "x", 3, [1, 2]])("con %j no hay nada", (valor) => {
    expect(leerResumen(valor)).toEqual({
      contadores: [],
      motivos: [],
      notas: null,
      declarado: null,
    });
  });
});

describe("numeroOpcional", () => {
  it("lee un número y devuelve null si falta o no lo es", () => {
    expect(numeroOpcional({ borradores: 4 }, "borradores")).toBe(4);
    expect(numeroOpcional({}, "borradores")).toBeNull();
    expect(numeroOpcional({ borradores: "4" }, "borradores")).toBeNull();
    expect(numeroOpcional({ borradores: Number.NaN }, "borradores")).toBeNull();
  });
});

describe("estaColgada", () => {
  const ahora = new Date("2026-10-30T12:00:00Z");
  it("solo una ejecución en curso de más de 6 h", () => {
    expect(
      estaColgada({ estado: "en_curso", inicio: "2026-10-30T05:59:00Z" }, ahora)
    ).toBe(true);
    expect(
      estaColgada({ estado: "en_curso", inicio: "2026-10-30T06:00:00Z" }, ahora)
    ).toBe(false);
    expect(
      estaColgada({ estado: "ok", inicio: "2026-10-01T00:00:00Z" }, ahora)
    ).toBe(false);
    expect(
      estaColgada({ estado: "en_curso", inicio: "no es fecha" }, ahora)
    ).toBe(false);
  });
});

describe("con las respuestas reales del servidor", () => {
  it("un módulo «en_curso» (lo que escribe el agente al abrir la ejecución) se lee como tal", () => {
    expect(leerModulos(ejecucionAbierta.modulos)).toEqual([
      {
        clave: "discovery",
        estado: "en_curso",
        duracion: null,
        error: null,
        notas: null,
      },
    ]);
    expect(ETIQUETA_DE_ESTADO_DE_MODULO.en_curso).toBe("En curso");
    expect(TONO_DE_ESTADO_DE_MODULO.en_curso).toBe("morado");
  });

  it("un estado de módulo que no conocemos queda sin estado (se enseña como «Sin estado»)", () => {
    for (const raro of ["pausado", "EN_CURSO", "", 3, null]) {
      expect(leerModulos({ x: { estado: raro } })[0].estado).toBeNull();
    }
  });

  it("`declaradoPorElAgente` llega con descartesPorMotivo ANIDADO: los contadores se leen y lo anidado no rompe nada", () => {
    const resumen = leerResumen(ejecucionCerrada.resumen);
    expect(resumen.declarado).toEqual([
      { clave: "candidatas", n: 8, texto: "candidatas" },
      { clave: "calificadas", n: 7, texto: "calificadas" },
      { clave: "descartadas", n: 2, texto: "descartadas" },
      { clave: "borradores", n: 5, texto: "borradores" },
      { clave: "bloqueadas", n: 1, texto: "bloqueada" },
    ]);
    // Lo medido por el servidor, aparte.
    expect(resumen.contadores.find((c) => c.clave === "candidatas")?.n).toBe(7);
    expect(resumen.motivos.map((m) => m.codigo).sort()).toEqual([
      "baja_calidad",
      "bajo_umbral",
      "competidor",
      "irrelevante",
      "otro",
    ]);
  });

  it("un `declaradoPorElAgente` raro (anidado donde no toca, texto en un contador) se ignora", () => {
    const resumen = leerResumen({
      candidatas: 3,
      declaradoPorElAgente: {
        candidatas: { dentro: 1 },
        calificadas: "mucho",
        descartesPorMotivo: { competidor: 1 },
        borradores: 2,
      },
    });
    expect(resumen.declarado).toEqual([
      { clave: "borradores", n: 2, texto: "borradores" },
    ]);
  });
});
