import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AbrirEjecucionBody,
  AjustesPutBody,
  BorradorBody,
  CerrarEjecucionBody,
  DecisionBody,
  InvestigacionBody,
  ListadoDeBorradoresQuery,
  ListadoDeOportunidadesDelAgenteQuery,
  ListadoDeOportunidadesQuery,
  OportunidadBody,
  OportunidadManualBody,
  PatchBorradorBody,
  RevisionLlmBody,
  SincronizarBody,
  ConocimientoDelAgenteQuery,
  ClaveParams,
  IdParams,
  esTextoBienFormado,
  fechaDeVencimiento,
  finDelDiaEnMadrid,
} from "../../../src/modules/growth/esquemas.js";
import { ConocimientoDelAgenteConsulta } from "../../../src/modules/growth/servicioAgente.js";
import { escaparComodinesDeLike as escaparComodines } from "../../../src/modules/growth/service.js";

/**
 * Correcciones de la 1b sobre los esquemas compartidos: texto mal formado
 * (NUL y sustitutos sueltos: 400, no 500), fechas de vencimiento, comodines
 * de búsqueda y la forma de los módulos de una ejecución.
 */

const NUL = "Hola\u0000mundo";
/** Un emoji partido por la mitad (lo que queda al cortar con `slice` en medio de un par). */
const MEDIO_EMOJI = `texto ${"😀".slice(0, 1)}`;
const MEDIO_EMOJI_BAJO = `${"😀".slice(1)} texto`;

describe("esTextoBienFormado", () => {
  it("rechaza el carácter nulo y los sustitutos sueltos, en cualquier posición", () => {
    expect(esTextoBienFormado(NUL)).toBe(false);
    expect(esTextoBienFormado("\u0000")).toBe(false);
    expect(esTextoBienFormado(MEDIO_EMOJI)).toBe(false);
    expect(esTextoBienFormado(MEDIO_EMOJI_BAJO)).toBe(false);
    expect(esTextoBienFormado("\uD83D\uD83D\uDE00")).toBe(false);
  });

  it("acepta el texto normal, los acentos, la eñe y los emojis completos", () => {
    expect(esTextoBienFormado("")).toBe(true);
    expect(esTextoBienFormado("Peluquería «Ñandú» 😀 – 59 €")).toBe(true);
    expect(esTextoBienFormado("日本語 y العربية")).toBe(true);
  });
});

describe("el texto libre rechaza NUL y unicode roto con un error de validación (400), nunca llega a la base", () => {
  const base = {
    url: "https://ejemplo.com/alta",
    titulo: "Un título",
    extracto: "Un extracto",
    objetivoPrincipal: "BACKLINKS",
  };
  const textoBueno = `${"a".repeat(80)} soy el fundador de Alhabla`;

  const casos: [string, () => { success: boolean }][] = [
    [
      "OportunidadBody.titulo",
      () => OportunidadBody.safeParse({ ...base, titulo: NUL }),
    ],
    [
      "OportunidadBody.extracto",
      () => OportunidadBody.safeParse({ ...base, extracto: MEDIO_EMOJI }),
    ],
    [
      "OportunidadBody.idioma",
      () => OportunidadBody.safeParse({ ...base, idioma: "e\u0000" }),
    ],
    [
      "OportunidadBody.datos.nota",
      () => OportunidadBody.safeParse({ ...base, datos: { nota: NUL } }),
    ],
    [
      "OportunidadBody.url (NUL en la ruta)",
      () =>
        OportunidadBody.safeParse({
          ...base,
          url: "https://ejemplo.com/a\u0000b",
        }),
    ],
    [
      "OportunidadManualBody.titulo",
      () => OportunidadManualBody.safeParse({ url: base.url, titulo: NUL }),
    ],
    [
      "OportunidadManualBody.nota",
      () =>
        OportunidadManualBody.safeParse({
          url: base.url,
          nota: MEDIO_EMOJI_BAJO,
        }),
    ],
    [
      "InvestigacionBody.resumen",
      () => InvestigacionBody.safeParse({ resumen: NUL }),
    ],
    [
      "InvestigacionBody.quienEdita",
      () => InvestigacionBody.safeParse({ resumen: "ok", quienEdita: NUL }),
    ],
    [
      "InvestigacionBody.competidoresEnlazados",
      () =>
        InvestigacionBody.safeParse({
          resumen: "ok",
          competidoresEnlazados: [NUL],
        }),
    ],
    [
      "InvestigacionBody.contexto (valor anidado)",
      () =>
        InvestigacionBody.safeParse({
          resumen: "ok",
          contexto: { a: { b: [NUL] } },
        }),
    ],
    [
      "InvestigacionBody.contexto (clave)",
      () =>
        InvestigacionBody.safeParse({ resumen: "ok", contexto: { [NUL]: 1 } }),
    ],
    [
      "BorradorBody.texto",
      () => BorradorBody.safeParse({ tipo: "email", texto: NUL }),
    ],
    [
      "BorradorBody.asunto",
      () =>
        BorradorBody.safeParse({
          tipo: "email",
          texto: textoBueno,
          asunto: MEDIO_EMOJI,
        }),
    ],
    [
      "BorradorBody.afirmaciones",
      () =>
        BorradorBody.safeParse({
          tipo: "email",
          texto: textoBueno,
          afirmaciones: ["precio.\u0000"],
        }),
    ],
    [
      "BorradorBody.utm",
      () =>
        BorradorBody.safeParse({
          tipo: "email",
          texto: textoBueno,
          utm: { utm_source: NUL },
        }),
    ],
    [
      "PatchBorradorBody.texto",
      () => PatchBorradorBody.safeParse({ texto: NUL }),
    ],
    [
      "PatchBorradorBody.nota",
      () => PatchBorradorBody.safeParse({ texto: "ok", nota: NUL }),
    ],
    [
      "PatchBorradorBody.asunto",
      () => PatchBorradorBody.safeParse({ asunto: NUL }),
    ],
    [
      "RevisionLlmBody.detalle",
      () =>
        RevisionLlmBody.safeParse({
          comprobaciones: [{ regla: "tono", ok: true, detalle: NUL }],
        }),
    ],
    [
      "RevisionLlmBody.regla",
      () =>
        RevisionLlmBody.safeParse({
          comprobaciones: [{ regla: "to\u0000no", ok: true, detalle: "x" }],
        }),
    ],
    [
      "DecisionBody.devolver.motivo",
      () => DecisionBody.safeParse({ accion: "devolver", motivo: NUL }),
    ],
    [
      "DecisionBody.descartar.motivo",
      () =>
        DecisionBody.safeParse({ accion: "descartar", motivo: MEDIO_EMOJI }),
    ],
    [
      "DecisionBody.marcar_gestionado.notas",
      () =>
        DecisionBody.safeParse({
          accion: "marcar_gestionado",
          canal: "email",
          notas: NUL,
        }),
    ],
    [
      "DecisionBody.marcar_gestionado.textoFinal",
      () =>
        DecisionBody.safeParse({
          accion: "marcar_gestionado",
          canal: "email",
          textoFinal: NUL,
        }),
    ],
    [
      "DecisionBody.rechazado.notas",
      () => DecisionBody.safeParse({ accion: "rechazado", notas: NUL }),
    ],
    [
      "DecisionBody.sin_respuesta.notas",
      () => DecisionBody.safeParse({ accion: "sin_respuesta", notas: NUL }),
    ],
    [
      "DecisionBody.aprobar.borradorId",
      () =>
        DecisionBody.safeParse({ accion: "aprobar", borradorId: "b\u00001" }),
    ],
    [
      "CerrarEjecucionBody.error",
      () => CerrarEjecucionBody.safeParse({ estado: "error", error: NUL }),
    ],
    [
      "CerrarEjecucionBody.resumen.notas",
      () =>
        CerrarEjecucionBody.safeParse({
          estado: "ok",
          resumen: { notas: NUL },
        }),
    ],
    [
      "CerrarEjecucionBody.modulos.error",
      () =>
        CerrarEjecucionBody.safeParse({
          estado: "ok",
          modulos: { discovery: { estado: "error", error: NUL } },
        }),
    ],
    [
      "CerrarEjecucionBody.modulos (nombre)",
      () =>
        CerrarEjecucionBody.safeParse({
          estado: "ok",
          modulos: { [NUL]: { estado: "ok" } },
        }),
    ],
    [
      "AbrirEjecucionBody.modulos.notas",
      () =>
        AbrirEjecucionBody.safeParse({
          disparador: "manual",
          modulos: { discovery: { estado: "en_curso", notas: NUL } },
        }),
    ],
    [
      "ListadoDeOportunidadesQuery.q",
      () => ListadoDeOportunidadesQuery.safeParse({ q: NUL }),
    ],
    [
      "ListadoDeOportunidadesQuery.dominio",
      () =>
        ListadoDeOportunidadesQuery.safeParse({ dominio: "ejem\u0000plo.com" }),
    ],
    [
      "ListadoDeOportunidadesDelAgenteQuery.dominio",
      () =>
        ListadoDeOportunidadesDelAgenteQuery.safeParse({
          dominio: MEDIO_EMOJI,
        }),
    ],
    [
      "ListadoDeBorradoresQuery.q",
      () => ListadoDeBorradoresQuery.safeParse({ q: NUL }),
    ],
    [
      "ConocimientoDelAgenteQuery.q",
      () => ConocimientoDelAgenteQuery.safeParse({ q: NUL }),
    ],
    [
      "ConocimientoDelAgenteQuery.clave",
      () => ConocimientoDelAgenteQuery.safeParse({ clave: NUL }),
    ],
    [
      "ConocimientoDelAgenteConsulta.prefijo",
      () => ConocimientoDelAgenteConsulta.safeParse({ prefijo: NUL }),
    ],
    [
      "ConocimientoDelAgenteConsulta.desde",
      () => ConocimientoDelAgenteConsulta.safeParse({ desde: NUL }),
    ],
    ["ClaveParams.clave", () => ClaveParams.safeParse({ clave: NUL })],
    ["IdParams.id", () => IdParams.safeParse({ id: NUL })],
    [
      "SincronizarBody.afirmaciones.texto",
      () =>
        SincronizarBody.safeParse({
          commitSha: "a".repeat(40),
          afirmaciones: [
            {
              clave: "funcion.x",
              tipo: "funcion",
              texto: NUL,
              fuente: "PRODUCT.md",
            },
          ],
        }),
    ],
    [
      "SincronizarBody.afirmaciones.valor",
      () =>
        SincronizarBody.safeParse({
          commitSha: "a".repeat(40),
          afirmaciones: [
            {
              clave: "funcion.x",
              tipo: "funcion",
              texto: "ok",
              valor: { a: [NUL] },
              fuente: "PRODUCT.md",
            },
          ],
        }),
    ],
  ];

  it.each(casos)("%s", (_nombre, analizar) => {
    expect(analizar().success).toBe(false);
  });

  it("el mensaje dice qué pasa (no es un «Invalid» genérico)", () => {
    const r = OportunidadBody.safeParse({ ...base, titulo: NUL });
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues.map((i) => i.message)).toContain(
      "El texto contiene caracteres no válidos (el carácter nulo o unicode mal formado)."
    );
  });

  it("el mismo texto sin el carácter roto sí pasa (la guarda no rechaza de más)", () => {
    expect(
      OportunidadBody.safeParse({
        ...base,
        titulo: "Peluquería «Ñandú» 😀",
        extracto: "Una página con acentos, eñes y emojis 😀",
        datos: { nota: "Vista en un grupo de peluqueros ✂️" },
      }).success
    ).toBe(true);
    expect(
      InvestigacionBody.safeParse({
        resumen: "Resumen con 😀",
        contexto: { a: ["b", { c: "d" }] },
      }).success
    ).toBe(true);
  });

  it("un anidamiento muy profundo no revienta con un desbordamiento de pila", () => {
    let profundo: unknown = "hoja";
    for (let i = 0; i < 2000; i++) profundo = { a: profundo };
    // Pasa o no el tope de tamaño, pero responde sin lanzar.
    expect(() =>
      InvestigacionBody.safeParse({ resumen: "ok", contexto: profundo })
    ).not.toThrow();
  });
});

describe("fechas de vencimiento (expiraEn)", () => {
  describe("fechaDeVencimiento", () => {
    it("una fecha sola es el FINAL de ese día en Europe/Madrid (invierno: UTC+1)", () => {
      expect(fechaDeVencimiento("2026-11-05")?.toISOString()).toBe(
        "2026-11-05T22:59:59.999Z"
      );
      expect(fechaDeVencimiento("2027-01-31")?.toISOString()).toBe(
        "2027-01-31T22:59:59.999Z"
      );
    });

    it("en verano (UTC+2) el final del día es una hora antes en UTC", () => {
      expect(fechaDeVencimiento("2026-07-15")?.toISOString()).toBe(
        "2026-07-15T21:59:59.999Z"
      );
    });

    it("los días del cambio de hora: el 29-03-2026 empieza el verano y el 25-10-2026 acaba", () => {
      // 23:59 del 29 de marzo ya es CEST (+2); el 25 de octubre ya es CET (+1).
      expect(fechaDeVencimiento("2026-03-29")?.toISOString()).toBe(
        "2026-03-29T21:59:59.999Z"
      );
      expect(fechaDeVencimiento("2026-10-25")?.toISOString()).toBe(
        "2026-10-25T22:59:59.999Z"
      );
      // El día anterior al cambio de marzo todavía es invierno.
      expect(fechaDeVencimiento("2026-03-28")?.toISOString()).toBe(
        "2026-03-28T22:59:59.999Z"
      );
    });

    it("finDelDiaEnMadrid es el último milisegundo del día de Madrid: un ms más es el día siguiente", () => {
      const fin = finDelDiaEnMadrid(2026, 11, 5);
      const siguiente = new Date(fin.getTime() + 1);
      const enMadrid = new Intl.DateTimeFormat("es-ES", {
        timeZone: "Europe/Madrid",
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
      expect(enMadrid.format(fin)).toBe("5/11, 23:59");
      expect(enMadrid.format(siguiente)).toBe("6/11, 00:00");
    });

    it("una fecha con hora exige la zona: Z o un desfase", () => {
      expect(fechaDeVencimiento("2026-11-05T10:00:00Z")?.toISOString()).toBe(
        "2026-11-05T10:00:00.000Z"
      );
      expect(
        fechaDeVencimiento("2026-11-05T10:00:00+01:00")?.toISOString()
      ).toBe("2026-11-05T09:00:00.000Z");
      expect(
        fechaDeVencimiento("2026-11-05T10:00:00.250-05:00")?.toISOString()
      ).toBe("2026-11-05T15:00:00.250Z");
      expect(fechaDeVencimiento("2026-11-05T10:00Z")?.toISOString()).toBe(
        "2026-11-05T10:00:00.000Z"
      );
    });

    it.each([
      "2026-11-05T10:00",
      "2026-11-05T10:00:00",
      "2026-11-05 10:00:00Z",
      "2026-11-05T25:00:00Z",
      "2026-11-05T10:00:00+99:00",
      "2026-02-30",
      "2026-13-01",
      "2026-00-10",
      "2026-1-5",
      "5 de noviembre",
      "05/11/2026",
      "1762300800000",
      "Thu Nov 05 2026",
      "",
      "   ",
    ])("%j no es ISO 8601 y se rechaza", (texto) => {
      expect(fechaDeVencimiento(texto)).toBeNull();
    });
  });

  describe("en los cuerpos que la usan", () => {
    const base = {
      url: "https://ejemplo.com/alta",
      titulo: "Un título",
      extracto: "Un extracto",
      objetivoPrincipal: "BACKLINKS",
    };

    afterEach(() => {
      vi.useRealTimers();
    });

    it("OportunidadBody y OportunidadManualBody entienden la fecha sola como el final del día de Madrid", () => {
      const a = OportunidadBody.parse({ ...base, expiraEn: "2999-01-01" });
      expect(a.expiraEn).toBeInstanceOf(Date);
      expect(a.expiraEn?.toISOString()).toBe("2999-01-01T22:59:59.999Z");
      const b = OportunidadManualBody.parse({
        url: base.url,
        expiraEn: "2999-07-01",
      });
      expect(b.expiraEn?.toISOString()).toBe("2999-07-01T21:59:59.999Z");
    });

    it("una fecha de hoy sigue siendo futura hasta el final del día de Madrid", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-05T21:00:00Z")); // 22:00 en Madrid
      expect(
        OportunidadManualBody.safeParse({
          url: base.url,
          expiraEn: "2026-11-05",
        }).success
      ).toBe(true);
      // Pasado el último milisegundo del día, ya no.
      vi.setSystemTime(new Date("2026-11-05T23:00:00Z")); // 00:00 del 6 en Madrid
      expect(
        OportunidadManualBody.safeParse({
          url: base.url,
          expiraEn: "2026-11-05",
        }).success
      ).toBe(false);
    });

    it("una fecha pasada, una hora sin zona y un número se rechazan con un mensaje que explica el formato", () => {
      for (const expiraEn of [
        "2020-01-01",
        "2020-01-01T00:00:00Z",
        "2999-01-01T10:00:00",
        "2999-01-01 10:00:00Z",
        "mañana",
        1762300800000,
        null,
      ]) {
        const r = OportunidadBody.safeParse({ ...base, expiraEn });
        expect(r.success, String(expiraEn)).toBe(false);
      }
      const sinZona = OportunidadBody.safeParse({
        ...base,
        expiraEn: "2999-01-01T10:00:00",
      });
      expect(
        sinZona.success ? [] : sinZona.error.issues.map((i) => i.message)
      ).toEqual([expect.stringContaining("ISO 8601")]);
      const pasada = OportunidadBody.safeParse({
        ...base,
        expiraEn: "2020-01-01",
      });
      expect(
        pasada.success ? [] : pasada.error.issues.map((i) => i.message)
      ).toEqual(["La fecha debe ser futura."]);
    });
  });
});

describe("escaparComodines", () => {
  it("escapa %, _ y la propia barra para que un LIKE los busque tal cual", () => {
    expect(escaparComodines("100%")).toBe("100\\%");
    expect(escaparComodines("a_b")).toBe("a\\_b");
    expect(escaparComodines("c:\\ruta")).toBe("c:\\\\ruta");
    expect(escaparComodines("_%\\")).toBe("\\_\\%\\\\");
  });

  it("no toca el texto normal", () => {
    expect(escaparComodines("peluquería")).toBe("peluquería");
    expect(escaparComodines("")).toBe("");
  });
});

describe("módulos de una ejecución", () => {
  it("al abrir, cada módulo es { estado, inicio?, fin?, error?, notas? } y puede estar en_curso", () => {
    const r = AbrirEjecucionBody.safeParse({
      disparador: "programada",
      modulos: {
        discovery: {
          estado: "en_curso",
          inicio: "2026-10-30T05:00:00.000Z",
        },
        qualification: { estado: "omitido", notas: "Sin candidatas" },
        enlaces: {
          estado: "error",
          inicio: "2026-10-30T05:00:00Z",
          fin: "2026-10-30T05:05:00+01:00",
          error: "Sin respuesta",
        },
        otro: { estado: "ok" },
        mas: { estado: "parcial" },
      },
    });
    expect(r.success).toBe(true);
  });

  it.each([
    ["un estado que no existe", { estado: "casi" }],
    ["sin estado", { notas: "x" }],
    ["un campo que no existe", { estado: "ok", resultado: "ok" }],
    ["inicio sin zona", { estado: "ok", inicio: "2026-10-30T05:00:00" }],
    ["un módulo que no es un objeto", "ok"],
    ["una notas demasiado larga", { estado: "ok", notas: "n".repeat(501) }],
  ])("al abrir se rechaza %s", (_nombre, modulo) => {
    expect(
      AbrirEjecucionBody.safeParse({
        disparador: "manual",
        modulos: { discovery: modulo },
      }).success
    ).toBe(false);
  });

  it("al abrir, los módulos no pasan de 8 KB serializados", () => {
    const modulos = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [
        `modulo_${i}`,
        { estado: "ok", notas: "n".repeat(300) },
      ])
    );
    expect(
      AbrirEjecucionBody.safeParse({ disparador: "manual", modulos }).success
    ).toBe(false);
  });

  it("al cerrar un módulo no puede seguir en curso", () => {
    expect(
      CerrarEjecucionBody.safeParse({
        estado: "ok",
        modulos: { discovery: { estado: "en_curso" } },
      }).success
    ).toBe(false);
  });
});

describe("ajustes: los esquemas nuevos no cambian lo que ya aceptaban", () => {
  it("un PUT de ajustes sigue pasando", () => {
    expect(AjustesPutBody.safeParse({ topeSemanal: 3 }).success).toBe(true);
  });
});
