import { describe, expect, it } from "vitest";
import {
  agruparCambios,
  normalizarParaBuscar,
  terminosProhibidos,
  valorComoTexto,
} from "@/components/conocimiento/utilidades";

describe("normalizarParaBuscar", () => {
  it("quita acentos y mayúsculas", () => {
    expect(normalizarParaBuscar("  Peluquería   ÁÉÍÓÚ ñ ")).toBe(
      "peluqueria   aeiou n"
    );
  });
});

describe("terminosProhibidos", () => {
  it("lee la lista y por defecto busca palabras enteras", () => {
    expect(terminosProhibidos({ terminos: ["API", "modelo"] })).toEqual({
      terminos: ["API", "modelo"],
      palabrasEnteras: true,
    });
    expect(
      terminosProhibidos({ terminos: ["x"], palabrasEnteras: false })
    ).toEqual({ terminos: ["x"], palabrasEnteras: false });
  });

  it.each([
    ["null", null],
    ["un texto", "terminos"],
    ["una lista", ["a"]],
    ["sin terminos", { palabrasEnteras: true }],
    ["terminos que no es lista", { terminos: "a" }],
    ["terminos vacíos o que no son texto", { terminos: ["", "  ", 3, null] }],
  ])("%s → null", (_nombre, valor) => {
    expect(terminosProhibidos(valor)).toBeNull();
  });

  it("descarta lo que no es texto pero conserva el resto", () => {
    expect(
      terminosProhibidos({ terminos: ["a", 3, "b", ""] })?.terminos
    ).toEqual(["a", "b"]);
  });
});

describe("valorComoTexto", () => {
  it("serializa objetos y recorta lo enorme", () => {
    expect(valorComoTexto({ precio: 139 })).toBe('{\n  "precio": 139\n}');
    const largo = valorComoTexto("x".repeat(5000), 100);
    expect(largo).toHaveLength(101);
    expect(largo?.endsWith("…")).toBe(true);
  });

  it.each([null, undefined, {}, []])("%j no se enseña", (valor) => {
    expect(valorComoTexto(valor)).toBeNull();
  });

  it("no revienta con una referencia circular", () => {
    const circular: Record<string, unknown> = {};
    circular.yo = circular;
    expect(valorComoTexto(circular)).toBeNull();
  });
});

describe("agruparCambios", () => {
  const alta = (clave: string, en: string, commitSha = "n") => ({
    clave,
    tipo: "precio" as const,
    cambio: "alta" as const,
    en,
    commitSha,
  });
  const cierre = (clave: string, en: string, commitSha = "v") => ({
    ...alta(clave, en, commitSha),
    cambio: "cierre" as const,
  });

  it("une un alta y un cierre de la misma clave en una modificación, con el commit del alta", () => {
    const resultado = agruparCambios([
      cierre("precio.a", "2026-10-28T10:00:00.000Z", "viejo"),
      alta("precio.a", "2026-10-28T10:00:00.000Z", "nuevo"),
    ]);
    expect(resultado).toEqual([
      {
        clave: "precio.a",
        tipo: "precio",
        cambio: "modificada",
        en: "2026-10-28T10:00:00.000Z",
        commitSha: "nuevo",
      },
    ]);
  });

  it("no junta claves distintas ni cambios separados en el tiempo", () => {
    const resultado = agruparCambios([
      alta("precio.a", "2026-10-28T10:00:00.000Z"),
      cierre("precio.b", "2026-10-28T10:00:00.000Z"),
      cierre("precio.a", "2026-10-01T10:00:00.000Z"),
    ]);
    expect(resultado.map((c) => [c.clave, c.cambio])).toEqual([
      ["precio.a", "alta"],
      ["precio.b", "cierre"],
      ["precio.a", "cierre"],
    ]);
  });

  it("tolera unos segundos de diferencia entre el cierre y el alta", () => {
    const resultado = agruparCambios([
      alta("precio.a", "2026-10-28T10:00:02.000Z"),
      cierre("precio.a", "2026-10-28T10:00:00.000Z"),
    ]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].cambio).toBe("modificada");
  });

  it("devuelve del más reciente al más antiguo y no pierde ninguno", () => {
    const entrada = [
      alta("a", "2026-10-01T00:00:00.000Z"),
      alta("b", "2026-10-03T00:00:00.000Z"),
      cierre("c", "2026-10-02T00:00:00.000Z"),
    ];
    const resultado = agruparCambios(entrada);
    expect(resultado.map((c) => c.clave)).toEqual(["b", "c", "a"]);
    expect(entrada.map((c) => c.clave)).toEqual(["a", "b", "c"]);
  });

  it("dos modificaciones de la misma clave a la vez no se cruzan", () => {
    const resultado = agruparCambios([
      alta("precio.a", "2026-10-28T10:00:00.000Z", "n2"),
      cierre("precio.a", "2026-10-28T10:00:00.000Z", "v2"),
      alta("precio.a", "2026-10-28T10:00:30.000Z", "n3"),
      cierre("precio.a", "2026-10-28T10:00:30.000Z", "v3"),
    ]);
    expect(resultado.map((c) => c.cambio)).toEqual([
      "modificada",
      "modificada",
    ]);
  });
});
