import { describe, expect, it } from "vitest";
import {
  agruparCompetidores,
  agruparDatos,
  dominioDeUrl,
  formatearPrecio,
  fuenteLegible,
  rutaDeCompetidor,
  rutaDeMenciones,
  textoDeErrorDeCompetencia,
  textoDeMenciones,
  tieneAnalisisCaducado,
  validarAltaDeCompetidor,
  validarEdicionDeCompetidor,
} from "@/components/competencia/utilidades";
import { ayudaDeCodigo } from "@/components/comunes/d1-aviso-de-error";
import { ErrorDeCliente } from "@/lib/api-errors";
import { CODIGOS_DE_ERROR_DE_COMPETENCIA } from "@/lib/demo/competencia-demo";
import type { DatoDeCompetidor, ValorDePrecio } from "@/lib/types";
import { competidor } from "../helpers/d2-datos";

/** Intl separa la cifra y el símbolo con un espacio duro: se compara con uno normal. */
const normal = (texto: string) => texto.replace(/[  ]/g, " ");

function precio(cambios: Partial<ValorDePrecio> = {}): ValorDePrecio {
  return { importe: 79, moneda: "EUR", periodo: "mes", ...cambios };
}

function dato(cambios: Partial<DatoDeCompetidor> = {}): DatoDeCompetidor {
  return {
    tipo: "producto",
    etiqueta: "Algo",
    texto: "Un hecho.",
    urlFuente: "https://rival.example/producto",
    consultadoEn: "2026-10-28T09:00:00.000Z",
    ...cambios,
  };
}

describe("formatearPrecio", () => {
  it("escribe la cantidad como en España: coma decimal, símbolo detrás y el periodo", () => {
    expect(normal(formatearPrecio(precio()))).toBe("79 € al mes");
    expect(normal(formatearPrecio(precio({ importe: 49.9 })))).toBe(
      "49,90 € al mes"
    );
    expect(
      normal(formatearPrecio(precio({ importe: 790, periodo: "anio" })))
    ).toBe("790 € al año");
    expect(
      normal(formatearPrecio(precio({ importe: 250, periodo: "unico" })))
    ).toBe("250 € pago único");
  });

  it("separa los miles solo desde cinco cifras, como el español", () => {
    expect(normal(formatearPrecio(precio({ importe: 15000 })))).toBe(
      "15.000 € al mes"
    );
    expect(normal(formatearPrecio(precio({ importe: 1500 })))).toBe(
      "1500 € al mes"
    );
  });

  it("no redondea los precios por uso: 0,055 € sigue siendo 0,055 €", () => {
    expect(
      normal(
        formatearPrecio(
          precio({ importe: 0.055, periodo: "uso", unidad: "minuto" })
        )
      )
    ).toBe("0,055 € por minuto");
  });

  it("dice la unidad y el IVA solo si el dato los trae", () => {
    expect(
      normal(
        formatearPrecio(
          precio({
            importe: 0.12,
            periodo: "uso",
            unidad: "minuto",
            ivaIncluido: false,
          })
        )
      )
    ).toBe("0,12 € por minuto · IVA no incluido");
    expect(
      normal(formatearPrecio(precio({ unidad: "usuario", ivaIncluido: true })))
    ).toBe("79 € al mes por usuario · IVA incluido");
    // Un `uso` sin unidad no inventa una.
    expect(normal(formatearPrecio(precio({ periodo: "uso" })))).toBe(
      "79 € por uso"
    );
    // Sin `ivaIncluido` no se dice nada del IVA.
    expect(formatearPrecio(precio())).not.toMatch(/IVA/);
  });

  it("respeta la moneda del dato", () => {
    expect(normal(formatearPrecio(precio({ moneda: "USD" })))).toMatch(
      /^79 (US\$|\$) al mes$/
    );
    expect(normal(formatearPrecio(precio({ moneda: "GBP" })))).toMatch(
      /^79 (GBP|£) al mes$/
    );
  });
});

describe("agruparDatos", () => {
  it("agrupa por tipo en el orden de lectura y junta precios y planes", () => {
    const grupos = agruparDatos([
      dato({ tipo: "limite", etiqueta: "L" }),
      dato({ tipo: "plan", etiqueta: "P1" }),
      dato({ tipo: "producto", etiqueta: "Pr" }),
      dato({ tipo: "precio", etiqueta: "Pc" }),
      dato({ tipo: "plan", etiqueta: "P2" }),
      dato({ tipo: "integracion", etiqueta: "I" }),
    ]);
    expect(grupos.map((g) => g.titulo)).toEqual([
      "Producto",
      "Precios y planes",
      "Integraciones",
      "Límites",
    ]);
    // Dentro de un grupo se respeta el orden del agente.
    expect(grupos[1].datos.map((d) => d.etiqueta)).toEqual(["P1", "Pc", "P2"]);
  });

  it("no hay grupos vacíos y cubre los once tipos", () => {
    expect(agruparDatos([])).toEqual([]);
    const tipos = [
      "producto",
      "servicio",
      "precio",
      "plan",
      "integracion",
      "sector",
      "idioma",
      "canal",
      "limite",
      "diferencia",
      "otro",
    ] as const;
    const grupos = agruparDatos(tipos.map((tipo) => dato({ tipo })));
    expect(grupos.flatMap((g) => g.datos)).toHaveLength(tipos.length);
  });
});

describe("fuenteLegible", () => {
  it("quita el esquema y la barra final", () => {
    expect(fuenteLegible("https://rival.example/precios/")).toBe(
      "rival.example/precios"
    );
    expect(fuenteLegible("https://rival.example/")).toBe("rival.example");
    expect(fuenteLegible("https://rival.example/a?b=1")).toBe(
      "rival.example/a?b=1"
    );
  });

  it("lo que no se entiende como URL sale tal cual, como texto", () => {
    expect(fuenteLegible("javascript:alert(1)")).toBe("javascript:alert(1)");
    expect(fuenteLegible("no es una url")).toBe("no es una url");
  });
});

describe("la lista", () => {
  it("agrupa por estado en el orden en que piden tu atención, sin grupos vacíos", () => {
    const grupos = agruparCompetidores([
      competidor({ id: "1", estado: "revisado" }),
      competidor({ id: "2", estado: "propuesto" }),
      competidor({ id: "3", estado: "revisado" }),
      competidor({ id: "4", estado: "analizado" }),
    ]);
    expect(
      grupos.map((g) => [g.estado, g.competidores.map((c) => c.id)])
    ).toEqual([
      ["propuesto", ["2"]],
      ["analizado", ["4"]],
      ["revisado", ["1", "3"]],
    ]);
    expect(agruparCompetidores([])).toEqual([]);
  });

  it("«caducado» solo con un análisis de más de 90 días", () => {
    const analisis = {
      id: "a",
      version: 1,
      creadoEn: "2026-01-01T00:00:00.000Z",
      revisadoEn: null,
      numDatos: 1,
    };
    expect(tieneAnalisisCaducado(competidor())).toBe(false);
    expect(
      tieneAnalisisCaducado(
        competidor({ analisis: { ...analisis, caducado: false } })
      )
    ).toBe(false);
    expect(
      tieneAnalisisCaducado(
        competidor({ analisis: { ...analisis, caducado: true } })
      )
    ).toBe(true);
  });

  it("las rutas codifican el dominio y el id", () => {
    expect(rutaDeMenciones("rival.example")).toBe(
      "/bandeja?menciona=rival.example"
    );
    expect(rutaDeMenciones("a&b=c")).toBe("/bandeja?menciona=a%26b%3Dc");
    expect(rutaDeCompetidor("a/b")).toBe("/competencia/a%2Fb");
  });
});

describe("textoDeMenciones", () => {
  const nombres = new Map([
    ["a.example", "Alfa"],
    ["b.example", "Beta"],
    ["c.example", "Gamma"],
    ["d.example", "Delta"],
  ]);

  it("pone nombre a los dominios que conoce y deja el dominio si no", () => {
    expect(textoDeMenciones(["a.example"], nombres)).toBe("Alfa");
    expect(textoDeMenciones(["a.example", "x.example"], nombres)).toBe(
      "Alfa y x.example"
    );
  });

  it("lista hasta tres y resume el resto", () => {
    expect(
      textoDeMenciones(["a.example", "b.example", "c.example"], nombres)
    ).toBe("Alfa, Beta y Gamma");
    expect(
      textoDeMenciones(
        ["a.example", "b.example", "c.example", "d.example"],
        nombres
      )
    ).toBe("Alfa, Beta y 2 más");
    expect(textoDeMenciones([], nombres)).toBe("");
  });
});

describe("validar el alta", () => {
  it("la URL es obligatoria y solo vale http o https", () => {
    expect(validarAltaDeCompetidor("", "", "").url).toBe(
      "Escribe la dirección web."
    );
    expect(validarAltaDeCompetidor("   ", "", "").url).toBeDefined();
    expect(validarAltaDeCompetidor("rival.example", "", "").url).toMatch(
      /http:\/\/ o https:\/\//
    );
    expect(validarAltaDeCompetidor("javascript:alert(1)", "", "").url).toMatch(
      /http:\/\/ o https:\/\//
    );
    expect(validarAltaDeCompetidor("ftp://rival.example", "", "").url).toMatch(
      /http:\/\/ o https:\/\//
    );
    expect(validarAltaDeCompetidor("https://rival.example", "", "")).toEqual(
      {}
    );
  });

  it("no admite usuario ni contraseña en la dirección", () => {
    expect(
      validarAltaDeCompetidor("https://alhabla.ai@rival.example", "", "").url
    ).toMatch(/usuario y la contraseña/);
  });

  it("el nombre, las notas y la dirección tienen tope", () => {
    const errores = validarAltaDeCompetidor(
      `https://rival.example/${"a".repeat(2000)}`,
      "n".repeat(121),
      "x".repeat(501)
    );
    expect(errores.url).toMatch(/2000/);
    expect(errores.nombre).toMatch(/120/);
    expect(errores.notas).toMatch(/500/);
    expect(
      validarAltaDeCompetidor(
        "https://rival.example",
        "n".repeat(120),
        "x".repeat(500)
      )
    ).toEqual({});
  });
});

describe("validar la edición", () => {
  const valores = { nombre: "Rival", url: "", notas: "" };

  it("el nombre no puede quedar vacío", () => {
    expect(
      validarEdicionDeCompetidor({ ...valores, nombre: "  " }).nombre
    ).toBe("Escribe un nombre.");
  });

  it("la URL es opcional y puede ser de otro dominio (cambia el dominio)", () => {
    expect(validarEdicionDeCompetidor(valores)).toEqual({});
    expect(
      validarEdicionDeCompetidor({
        ...valores,
        url: "https://www.rival.example/precios",
      })
    ).toEqual({});
    expect(
      validarEdicionDeCompetidor({
        ...valores,
        url: "https://otro.example/precios",
      })
    ).toEqual({});
    expect(
      validarEdicionDeCompetidor({ ...valores, url: "javascript:alert(1)" }).url
    ).toMatch(/http:\/\/ o https:\/\//);
  });
});

describe("dominioDeUrl", () => {
  it("sale en minúsculas, sin www ni punto final", () => {
    expect(dominioDeUrl("https://WWW.Rival.Example./precios")).toBe(
      "rival.example"
    );
    expect(dominioDeUrl("no es una url")).toBeNull();
  });
});

describe("textoDeErrorDeCompetencia", () => {
  it("junta lo que dijo el backend con qué hacer según el código", () => {
    const texto = textoDeErrorDeCompetencia(
      new ErrorDeCliente(409, "Ya existe un competidor con ese dominio.", {
        codigo: "competidor_existente",
      }),
      "respaldo"
    );
    expect(texto).toMatch(/^Ya existe un competidor con ese dominio\. Ábrelo/);
  });

  it("sin código conocido, solo el mensaje; sin mensaje, el respaldo", () => {
    expect(
      textoDeErrorDeCompetencia(new ErrorDeCliente(500, "Fallo."), "respaldo")
    ).toBe("Fallo.");
    expect(textoDeErrorDeCompetencia(new Error("x"), "respaldo")).toBe(
      "respaldo"
    );
  });
});

describe("ayudaDeCodigo", () => {
  it("todo código de error de la competencia dice qué hacer ahora, en español", () => {
    for (const codigo of CODIGOS_DE_ERROR_DE_COMPETENCIA) {
      const ayuda = ayudaDeCodigo(codigo);
      expect(ayuda, codigo).toEqual(expect.stringMatching(/[a-záéíóú]{4,}/));
      expect(ayuda, codigo).not.toMatch(/^\s*$/);
    }
  });

  it("un código que no se conoce, o ninguno, no inventa consejo", () => {
    expect(ayudaDeCodigo("otro_codigo")).toBeNull();
    expect(ayudaDeCodigo(null)).toBeNull();
  });
});
