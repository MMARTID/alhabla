import { describe, it, expect } from "vitest";
import {
  articuloDeBlog,
  parsearFrontmatter,
} from "../../mcp/growth/conocimiento/frontmatter.js";
import { parsearReglasProhibidas } from "../../mcp/growth/conocimiento/reglasProhibidas.js";
import {
  afirmacionesConTerminosProhibidos,
  motivoDeTerminoProhibidoInvalido,
  normalizarTermino,
  textosDelValor,
} from "../../src/modules/growth/conocimiento/terminos.js";

/**
 * Revisión 1b (conocimiento B2 y B5): el parser del frontmatter acepta lo que
 * acepta la web, y los términos prohibidos inservibles no llegan a la base.
 */

function doc(frontmatter: string) {
  return `---\n${frontmatter}\n---\nCuerpo`;
}

describe("frontmatter: lo que acepta la web (gray-matter) no rompe la sincronización", () => {
  const MINIMO = ["titulo: Un título", "fecha: 2026-09-21"];

  it("sin resumen ni sector el artículo existe igual (como en la web)", () => {
    expect(articuloDeBlog("sin-resumen", doc(MINIMO.join("\n")))).toEqual({
      slug: "sin-resumen",
      titulo: "Un título",
      resumen: "",
      fecha: "2026-09-21",
      actualizado: null,
      autor: null,
      sector: "",
      idioma: null,
      borrador: false,
    });
  });

  it("una lista YAML en una clave que no se usa (etiquetas) se salta entera", () => {
    const a = articuloDeBlog(
      "con-etiquetas",
      doc(
        [
          ...MINIMO,
          "etiquetas:",
          "  - citas",
          "  - whatsapp",
          "otras:",
          "- a",
          "- b",
          "imagenAlt: Una foto",
          "sector: peluqueria",
        ].join("\n")
      )
    );
    expect(a.sector).toBe("peluqueria");
    expect(a.titulo).toBe("Un título");
  });

  it("un mapa anidado y un valor entre corchetes en claves que no se usan también", () => {
    const a = articuloDeBlog(
      "raro",
      doc(
        [
          ...MINIMO,
          "seo:",
          "  titulo: otro",
          "  descripcion: algo",
          "palabras: [a, b]",
          "resumen: Un resumen",
        ].join("\n")
      )
    );
    expect(a.resumen).toBe("Un resumen");
  });

  it("un bloque literal en una clave ignorada con líneas en blanco dentro", () => {
    const a = articuloDeBlog(
      "bloque",
      doc(
        [
          ...MINIMO,
          "nota: |",
          "  primera",
          "",
          "  tercera",
          "sector: fisioterapia",
        ].join("\n")
      )
    );
    expect(a.sector).toBe("fisioterapia");
  });

  it("la fecha con hora (un Date de YAML) vale: se toma el día, como la web", () => {
    const a = articuloDeBlog(
      "con-hora",
      doc(
        [
          "titulo: T",
          "fecha: 2026-09-21T10:00:00.000Z",
          "actualizado: 2026-10-01T08:00:00Z",
        ].join("\n")
      )
    );
    expect(a.fecha).toBe("2026-09-21");
    expect(a.actualizado).toBe("2026-10-01");
  });

  it("las claves que SÍ se usan siguen siendo estrictas, con un mensaje que lo dice", () => {
    expect(() =>
      articuloDeBlog(
        "x",
        doc([...MINIMO, "sector:", "  - a", "  - b"].join("\n"))
      )
    ).toThrow(/«sector» es una lista o un mapa y aquí se espera un texto/);
    expect(() =>
      articuloDeBlog("x", doc([...MINIMO, 'resumen: "abierto'].join("\n")))
    ).toThrow(/Frontmatter no soportado .*comilla sin cerrar/);
    expect(() =>
      articuloDeBlog("x", doc(["fecha: 2026-09-21"].join("\n")))
    ).toThrow(/no tiene «titulo»/);
    expect(() =>
      articuloDeBlog("x", doc([...MINIMO, "borrador: sí"].join("\n")))
    ).toThrow(/no es true ni false/);
  });

  it("sin la opción soloClaves, parsearFrontmatter sigue siendo estricto con todo", () => {
    expect(() => parsearFrontmatter(doc("tags:\n  - a\n  - b"))).toThrow(
      /Frontmatter no soportado/
    );
    expect(
      parsearFrontmatter(doc("tags:\n  - a\ntitulo: T"), {
        soloClaves: new Set(["titulo"]),
      })
    ).toEqual({ titulo: "T" });
  });
});

describe("términos prohibidos que no sirven", () => {
  it.each([
    ["caracteres invisibles", "Tel​nyx", /invisibles/],
    ["una marca de dirección", "‮pmoc", /invisibles/],
    ["menos de tres caracteres tras normalizar", "ｘｙ", /menos de 3/],
    ["solo acentos", "́́́", /menos de 3/],
    ["solo marcas fuera del rango de los acentos", "⃐⃐⃐", /letras ni números/],
    ["solo signos", "!!!!", /letras ni números/],
    ["vacío", "  ", /menos de 3/],
  ])("%s", (_nombre, termino, motivo) => {
    expect(motivoDeTerminoProhibidoInvalido(termino)).toMatch(motivo);
  });

  it.each([
    "Telnyx",
    "24/7",
    "agente de voz",
    "Ventaja competitiva",
    "LLM",
    "ñoño",
  ])("«%s» vale", (termino) => {
    expect(motivoDeTerminoProhibidoInvalido(termino)).toBeNull();
  });

  it("el parser del fichero de reglas los rechaza (se ve en CI, no al aplicar)", () => {
    const tabla = (terminos: string) =>
      [
        "## Reglas aplicadas",
        "",
        "| Clave | Términos | Palabra entera | Motivo | Fuente |",
        "|---|---|---|---|---|",
        `| x | ${terminos} | sí | m | f |`,
        "",
        "## Descartados (no se emiten)",
        "",
        "| Término | Por qué no se emite |",
        "|---|---|",
        "| a | b |",
      ].join("\n");
    expect(() => parsearReglasProhibidas(tabla("Tel​nyx"))).toThrow(
      /El término «Tel.nyx» de la regla «x» no sirve: lleva caracteres invisibles/
    );
    expect(() => parsearReglasProhibidas(tabla("ab; Telnyx"))).toThrow(
      /«ab» de la regla «x» no sirve/
    );
    expect(
      parsearReglasProhibidas(tabla("Telnyx; Soniox")).reglas[0].terminos
    ).toEqual(["Telnyx", "Soniox"]);
  });

  it("normalizarTermino: mayúsculas, NFKC, invisibles y espacios", () => {
    expect(normalizarTermino("  TELNYX ")).toBe("telnyx");
    expect(normalizarTermino("Ｔｅｌｎｙｘ")).toBe("telnyx");
    expect(normalizarTermino("Tel​nyx")).toBe("telnyx");
    expect(normalizarTermino("Agenda   Real")).toBe("agenda real");
    expect(normalizarTermino("Télnyx")).toBe("telnyx");
  });
});

describe("el invariante de términos prohibidos mira también el valor", () => {
  const TERMINOS = [{ termino: "Telnyx", palabraEntera: true }];

  it("un Telnyx dentro de valor (anidado, en una lista o como clave) es una infracción", () => {
    const base = {
      clave: "funcion.x",
      tipo: "funcion",
      texto: "Una función inocente.",
    };
    for (const valor of [
      { nota: "usa Telnyx" },
      { detalle: { hondo: ["otra", "con Telnyx dentro"] } },
      { Telnyx: true },
    ]) {
      expect(
        afirmacionesConTerminosProhibidos([{ ...base, valor }], TERMINOS)
      ).toEqual([{ clave: "funcion.x", terminos: ["Telnyx"] }]);
    }
  });

  it("las URL y las rutas del valor no cuentan, ni lo que no es texto", () => {
    expect(
      textosDelValor({
        url: "https://docs.ejemplo.com/webhook/telnyx",
        ruta: "/telnyx",
        n: 3,
        ok: true,
        nada: null,
        lista: ["texto", "https://x.test/y"],
      })
    ).toEqual(["url", "ruta", "n", "ok", "nada", "lista", "texto"]);
    expect(
      afirmacionesConTerminosProhibidos(
        [
          {
            clave: "pagina.x",
            tipo: "pagina",
            texto: "Una página",
            valor: { url: "https://alhabla.ai/telnyx", ruta: "/telnyx" },
          },
        ],
        TERMINOS
      )
    ).toEqual([]);
  });

  it("las limitaciones y las prohibidas siguen fuera: pueden nombrar la categoría", () => {
    expect(
      afirmacionesConTerminosProhibidos(
        [
          {
            clave: "limite.x",
            tipo: "limite",
            texto: "No se nombra Telnyx.",
            valor: { nota: "Telnyx" },
          },
          {
            clave: "prohibida.proveedores",
            tipo: "prohibida",
            texto: "No se dice: Telnyx.",
            valor: { terminos: ["Telnyx"] },
          },
        ],
        TERMINOS
      )
    ).toEqual([]);
  });

  it("un valor enorme o circular de profundidad no cuelga el análisis", () => {
    let hondo: unknown = "Telnyx";
    for (let i = 0; i < 50; i++) hondo = { siguiente: hondo };
    expect(() =>
      afirmacionesConTerminosProhibidos(
        [{ clave: "funcion.x", tipo: "funcion", texto: "x", valor: hondo }],
        TERMINOS
      )
    ).not.toThrow();
  });
});
