import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  articuloDeBlog,
  parsearFrontmatter,
} from "../../mcp/growth/conocimiento/frontmatter.js";
import {
  bulletsDe,
  huellaDe,
  parsearProductMd,
  slugDeAncla,
  terminosNuncaDe,
} from "../../mcp/growth/conocimiento/productMd.js";
import {
  parsearReglasProhibidas,
  terminosSinCubrir,
} from "../../mcp/growth/conocimiento/reglasProhibidas.js";
import { nombreExportadoDeSector } from "../../mcp/growth/conocimiento/entrada.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const hayRepo =
  existsSync(join(RAIZ, "PRODUCT.md")) &&
  existsSync(join(RAIZ, "web", "content"));

describe("parsearProductMd", () => {
  const DOC = [
    "# Producto",
    "",
    "## Capabilities and Constraints",
    "",
    "**Capacidades confirmadas**",
    "",
    "- Primero con una `identidad` en código",
    "  y una continuación sangrada.",
    "- Segundo.",
    "",
    "**Terminología del producto** (visible al usuario)",
    "",
    "Se dice «a». Nunca «b», «c» ni el nombre de ningún proveedor (Acme…).",
    "",
    "## Otra sección",
    "",
    "- Un bullet de otra sección.",
  ].join("\n");

  it("agrupa los bullets por sección y negrita-encabezado, y une las continuaciones", () => {
    const p = parsearProductMd(DOC);
    expect(p.secciones).toEqual([
      "Capabilities and Constraints",
      "Otra sección",
    ]);
    expect(p.bullets).toHaveLength(3);
    expect(p.bullets[0]).toMatchObject({
      seccion: "Capabilities and Constraints",
      grupo: "Capacidades confirmadas",
      linea: 7,
      texto:
        "Primero con una `identidad` en código y una continuación sangrada.",
    });
    expect(p.bullets[2]).toMatchObject({
      seccion: "Otra sección",
      grupo: null,
    });
  });

  it("la negrita-encabezado con paréntesis abre el grupo sin el paréntesis y su párrafo no es un bullet", () => {
    const p = parsearProductMd(DOC);
    expect(p.parrafos).toHaveLength(1);
    expect(p.parrafos[0]).toMatchObject({
      grupo: "Terminología del producto",
      texto:
        "Se dice «a». Nunca «b», «c» ni el nombre de ningún proveedor (Acme…).",
    });
  });

  it("bulletsDe falla con un mensaje útil si el grupo ya no existe", () => {
    const p = parsearProductMd(DOC);
    expect(() =>
      bulletsDe(p, "Capabilities and Constraints", "Restricciones duras")
    ).toThrow(
      /ya no tiene bullets en «Capabilities and Constraints» › «Restricciones duras»/
    );
  });

  it("un bullet nuevo cambia el recuento: nada se cuela sin pasar por el mapa", () => {
    const con = parsearProductMd(`${DOC}\n- Tercero.`);
    expect(con.bullets).toHaveLength(4);
  });

  it("extrae los términos de «Nunca» y el proveedor", () => {
    const p = parsearProductMd(DOC);
    expect(terminosNuncaDe(p.parrafos[0].texto)).toEqual({
      terminos: ["b", "c"],
      proveedores: ["Acme"],
    });
  });

  it("sin la palabra «Nunca» falla en lugar de devolver una lista vacía", () => {
    expect(() => terminosNuncaDe("Se dice «a».")).toThrow(
      /ya no contiene «Nunca»/
    );
  });

  it("huellaDe no depende de espacios ni mayúsculas, pero sí del contenido", () => {
    expect(huellaDe("Hola   mundo\n")).toBe(huellaDe("hola mundo"));
    expect(huellaDe("hola mundo")).not.toBe(huellaDe("hola mundos"));
    expect(huellaDe("x")).toMatch(/^[0-9a-f]{12}$/);
  });

  it("slugDeAncla quita tildes y signos", () => {
    expect(slugDeAncla("Decisiones abiertas — no inventar una respuesta")).toBe(
      "decisiones-abiertas-no-inventar-una-respuesta"
    );
    expect(slugDeAncla("Terminología del producto")).toBe(
      "terminologia-del-producto"
    );
  });

  describe.skipIf(!hayRepo)("el PRODUCT.md real", () => {
    const real = hayRepo
      ? parsearProductMd(readFileSync(join(RAIZ, "PRODUCT.md"), "utf8"))
      : null!;

    it("tiene las secciones que el extractor necesita", () => {
      for (const seccion of [
        "Capabilities and Constraints",
        "Brand Commitments",
        "Evidence on Hand",
        "Operating Context",
      ]) {
        expect(real.secciones).toContain(seccion);
      }
    });

    it("los grupos de capacidades y restricciones tienen bullets", () => {
      expect(
        bulletsDe(
          real,
          "Capabilities and Constraints",
          "Capacidades confirmadas"
        ).length
      ).toBeGreaterThanOrEqual(8);
      expect(
        bulletsDe(real, "Capabilities and Constraints", "Restricciones duras")
          .length
      ).toBeGreaterThanOrEqual(4);
      expect(
        bulletsDe(real, "Brand Commitments", null).length
      ).toBeGreaterThanOrEqual(5);
    });

    it("la lista de términos que nunca se dicen incluye los que el repo declara", () => {
      const parrafo = real.parrafos.find(
        (p) => p.grupo === "Terminología del producto"
      )!;
      const { terminos, proveedores } = terminosNuncaDe(parrafo.texto);
      expect(terminos).toEqual(
        expect.arrayContaining([
          "recepcionista virtual",
          "agenda real",
          "API",
          "webhook",
        ])
      );
      expect(proveedores).toContain("Telnyx");
    });
  });
});

describe("parsearFrontmatter", () => {
  function doc(frontmatter: string) {
    return `---\n${frontmatter}\n---\nCuerpo`;
  }

  it("entiende comillas dobles, simples, sin comillas y booleanos", () => {
    expect(
      parsearFrontmatter(
        doc(
          [
            'titulo: "Dos: puntos y «latinas»"',
            "autor: 'O''Brien'",
            "fecha: 2026-09-22",
            "sector: ''",
            "borrador: false",
            "visible: true",
          ].join("\n")
        )
      )
    ).toEqual({
      titulo: "Dos: puntos y «latinas»",
      autor: "O'Brien",
      fecha: "2026-09-22",
      sector: "",
      borrador: false,
      visible: true,
    });
  });

  it("une el escalar plegado «>-» con espacios, sin truncarlo", () => {
    expect(
      parsearFrontmatter(
        doc(
          "resumen: >-\n  Una línea que sigue\n  en la otra.\nfecha: 2026-01-01"
        )
      )
    ).toEqual({
      resumen: "Una línea que sigue en la otra.",
      fecha: "2026-01-01",
    });
  });

  it('las comillas dobles admiten \\" y \\\\', () => {
    expect(
      parsearFrontmatter(doc('titulo: "Dice \\"hola\\" a C:\\\\"'))
    ).toEqual({
      titulo: 'Dice "hola" a C:\\',
    });
  });

  it.each([
    ["una lista", "tags:\n  - a\n  - b"],
    ["un mapa anidado", "autor:\n  nombre: x"],
    ["una línea sangrada suelta", "titulo: x\n  suelta: y"],
    ["una clave repetida", "titulo: a\ntitulo: b"],
    ["una comilla sin cerrar", 'titulo: "abierta'],
    ["un escape no soportado", 'titulo: "a\\nb"'],
    ["un valor vacío", "titulo:"],
    ["una línea que no es clave: valor", "esto no es yaml"],
    ["un comentario al final", "titulo: algo # comentario"],
    ["un valor con corchetes", "titulo: [a, b]"],
    ["un bloque plegado sin contenido", "resumen: >-\nfecha: 2026-01-01"],
  ])("falla ante %s en lugar de interpretarlo mal", (_nombre, frontmatter) => {
    expect(() => parsearFrontmatter(doc(frontmatter))).toThrow(
      /Frontmatter no soportado/
    );
  });

  it("falla si el fichero no empieza por --- o no lo cierra", () => {
    expect(() => parsearFrontmatter("titulo: x")).toThrow(/no empieza por/);
    expect(() => parsearFrontmatter("---\ntitulo: x\nCuerpo")).toThrow(
      /no se cierra/
    );
  });

  describe("articuloDeBlog", () => {
    const base = [
      "titulo: Un título",
      "resumen: Un resumen",
      "fecha: 2026-09-21",
      "sector: peluqueria",
    ];

    it("lee los campos obligatorios y deja los opcionales a null", () => {
      expect(articuloDeBlog("mi-articulo", doc(base.join("\n")))).toEqual({
        slug: "mi-articulo",
        titulo: "Un título",
        resumen: "Un resumen",
        fecha: "2026-09-21",
        actualizado: null,
        autor: null,
        sector: "peluqueria",
        idioma: null,
        borrador: false,
      });
    });

    it("falta un campo obligatorio, una fecha mal escrita o un borrador que no es booleano", () => {
      // Sin sector (como en la web) el artículo existe; sin título o sin fecha, no.
      expect(
        articuloDeBlog("x", doc("titulo: a\nresumen: b\nfecha: 2026-09-21"))
          .sector
      ).toBe("");
      expect(() =>
        articuloDeBlog("x", doc("resumen: b\nfecha: 2026-09-21"))
      ).toThrow(/no tiene «titulo»/);
      expect(() =>
        articuloDeBlog(
          "x",
          doc(base.join("\n").replace("2026-09-21", "21/09/2026"))
        )
      ).toThrow(/no es AAAA-MM-DD/);
      expect(() =>
        articuloDeBlog("x", doc(`${base.join("\n")}\nborrador: si`))
      ).toThrow(/no es true ni false/);
    });
  });

  describe.skipIf(!hayRepo)("los artículos reales del blog", () => {
    const carpeta = join(RAIZ, "web", "content", "blog");
    const ficheros = hayRepo
      ? readdirSync(carpeta).filter((f) => f.endsWith(".mdx"))
      : [];

    it("hay artículos", () => {
      expect(ficheros.length).toBeGreaterThanOrEqual(10);
    });

    it.each(ficheros)("%s se lee entero y sin truncar", (fichero) => {
      const articulo = articuloDeBlog(
        fichero.replace(/\.mdx$/, ""),
        readFileSync(join(carpeta, fichero), "utf8")
      );
      expect(articulo.titulo.length).toBeGreaterThan(5);
      expect(articulo.resumen.length).toBeGreaterThan(20);
      // Un resumen plegado mal leído acabaría en «>-» o en la mitad de una frase.
      expect(articulo.resumen).not.toMatch(/^[>|]/);
      expect(articulo.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("el resumen plegado de agenda-para-spa se lee completo", () => {
      const articulo = articuloDeBlog(
        "agenda-para-spa",
        readFileSync(join(carpeta, "agenda-para-spa.mdx"), "utf8")
      );
      expect(articulo.resumen).toMatch(/^Digitaliza la agenda del spa/);
      expect(articulo.resumen).toMatch(/migrar sin caos\.$/);
    });
  });
});

describe("reglas prohibidas", () => {
  const DOC = [
    "## Reglas aplicadas",
    "",
    "| Clave | Términos | Palabra entera | Motivo | Fuente |",
    "|---|---|---|---|---|",
    "| proveedores | Telnyx | sí | No se nombra. | PRODUCT.md |",
    "| jerga | prompt; LLM | no | Sin jerga. | PRODUCT.md |",
    "",
    "## Descartados (no se emiten)",
    "",
    "| Término | Por qué no se emite |",
    "|---|---|",
    "| API | Ambiguo. |",
    "",
    "## Pendiente de decidir",
    "",
    "- Algo.",
  ].join("\n");

  it("lee las dos tablas", () => {
    expect(parsearReglasProhibidas(DOC)).toEqual({
      reglas: [
        {
          clave: "proveedores",
          terminos: ["Telnyx"],
          palabrasEnteras: true,
          motivo: "No se nombra.",
          fuente: "PRODUCT.md",
        },
        {
          clave: "jerga",
          terminos: ["prompt", "LLM"],
          palabrasEnteras: false,
          motivo: "Sin jerga.",
          fuente: "PRODUCT.md",
        },
      ],
      descartados: [{ termino: "API", motivo: "Ambiguo." }],
    });
  });

  it.each([
    [
      "falta una sección",
      DOC.replace("## Descartados (no se emiten)", "## Otra"),
    ],
    ["cambian las columnas", DOC.replace("Palabra entera", "Entera")],
    ["una celda vacía", DOC.replace("| No se nombra. |", "|  |")],
    [
      "un término de menos de tres caracteres",
      DOC.replace("prompt; LLM", "prompt; IA"),
    ],
    ["«palabra entera» ni sí ni no", DOC.replace("| sí |", "| quizá |")],
    [
      "una clave con mayúsculas",
      DOC.replace("| proveedores |", "| Proveedores |"),
    ],
    ["una regla repetida", DOC.replace("| jerga |", "| proveedores |")],
  ])("falla si %s", (_nombre, doc) => {
    expect(() => parsearReglasProhibidas(doc)).toThrow(/\[Conocimiento\]/);
  });

  it("terminosSinCubrir detecta lo que el repo prohíbe y el fichero ignora", () => {
    const reglas = parsearReglasProhibidas(DOC);
    expect(
      terminosSinCubrir(reglas, ["telnyx", "API", "webhook", "Prompt"])
    ).toEqual(["webhook"]);
  });

  describe.skipIf(!hayRepo)("el fichero real", () => {
    const ruta = join(
      RAIZ,
      "growth",
      "agentes",
      "reglas",
      "afirmaciones-prohibidas.md"
    );

    it("cumple las condiciones del backend: al menos tres caracteres y palabra entera", () => {
      const { reglas } = parsearReglasProhibidas(readFileSync(ruta, "utf8"));
      expect(reglas.length).toBeGreaterThan(0);
      for (const regla of reglas) {
        expect(regla.palabrasEnteras).toBe(true);
        for (const termino of regla.terminos) {
          expect(termino.length).toBeGreaterThanOrEqual(3);
        }
      }
    });

    it("no emite ninguno de los términos ambiguos, y los lista como descartados", () => {
      const { reglas, descartados } = parsearReglasProhibidas(
        readFileSync(ruta, "utf8")
      );
      const emitidos = reglas.flatMap((r) =>
        r.terminos.map((t) => t.toLowerCase())
      );
      for (const ambiguo of [
        "api",
        "modelo",
        "agente de voz",
        "gestor",
        "el gestor",
        "persona real",
      ]) {
        expect(emitidos).not.toContain(ambiguo);
      }
      const descartado = descartados.map((d) => d.termino.toLowerCase());
      expect(descartado).toEqual(
        expect.arrayContaining([
          "api",
          "modelo",
          "agente de voz",
          "el gestor",
          "persona real",
        ])
      );
    });

    it("cubre todo lo que PRODUCT.md dice que nunca se dice", () => {
      const reglas = parsearReglasProhibidas(readFileSync(ruta, "utf8"));
      const product = parsearProductMd(
        readFileSync(join(RAIZ, "PRODUCT.md"), "utf8")
      );
      const parrafo = product.parrafos.find(
        (p) => p.grupo === "Terminología del producto"
      )!;
      const { terminos, proveedores } = terminosNuncaDe(parrafo.texto);
      expect(terminosSinCubrir(reglas, [...terminos, ...proveedores])).toEqual(
        []
      );
    });
  });
});

describe("nombreExportadoDeSector", () => {
  it("lee el nombre del export de un fichero de sector", () => {
    expect(
      nombreExportadoDeSector(
        'import x from "y";\n\nexport const centroDeEstetica: SectorLanding = {\n  slug: "a",\n};'
      )
    ).toBe("centroDeEstetica");
    expect(nombreExportadoDeSector("export const otra = 1;")).toBeNull();
  });
});
