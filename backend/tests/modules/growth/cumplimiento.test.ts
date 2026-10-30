import { describe, it, expect } from "vitest";
import {
  REGLAS_DE_AGENDA,
  aliasesDeCompetidor,
  contieneCorreo,
  contieneTelefono,
  esHostDeAlhabla,
  esReglaDeAgenda,
  evaluarCumplimiento,
  fallosDelTexto,
  mencionaPalabra,
  normalizarDominio,
  sinPuntoFinal,
  type AfirmacionCitada,
  type BorradorAEvaluar,
  type ContextoDeCumplimiento,
} from "../../../src/modules/growth/cumplimiento.js";

const AHORA = new Date("2026-11-02T10:00:00Z");
/** Espacio de ancho cero: escrito por su código para que se vea en el fichero. */
const ZWSP = String.fromCodePoint(0x200b);

/** Unión de ancho cero: escrito por su código para que se vea en el fichero. */
const ZWJ = String.fromCodePoint(0x200d);

/** Guion blando: escrito por su código para que se vea en el fichero. */
const SHY = String.fromCodePoint(0x00ad);

/** Marca de izquierda a derecha: escrito por su código para que se vea en el fichero. */
const LRM = String.fromCodePoint(0x200e);

/** Marca de derecha a izquierda: escrito por su código para que se vea en el fichero. */
const RLM = String.fromCodePoint(0x200f);

/** E cirílica (U+0435): escrito por su código para que se vea en el fichero. */
const E_CIRILICA = String.fromCodePoint(0x0435);

/** X cirílica (U+0445): escrito por su código para que se vea en el fichero. */
const X_CIRILICA = String.fromCodePoint(0x0445);

/** E cirílica mayúscula (U+0415): escrito por su código para que se vea en el fichero. */
const E_CIRILICA_MAYUSCULA = String.fromCodePoint(0x0415);

/** Épsilon griega (U+03B5): escrito por su código para que se vea en el fichero. */
const EPSILON_GRIEGA = String.fromCodePoint(0x03b5);

/** Letras y cifras a ancho completo (U+FF01 a U+FF5E), por su código. */
const aAnchoCompleto = (texto: string) =>
  Array.from(texto, (c) =>
    c === " " ? c : String.fromCodePoint(c.codePointAt(0)! + 0xfee0)
  ).join("");

const TEXTO_BUENO =
  "Hola, soy el fundador de Alhabla. Hemos hecho una recepcionista de IA para peluquerías que atiende las llamadas y reserva en el calendario del negocio. Pensamos que vuestro listado de herramientas podría interesar a quien lo lee, y si os encaja nos gustaría aparecer. Un saludo.";

function borrador(cambios: Partial<BorradorAEvaluar> = {}): BorradorAEvaluar {
  return {
    tipo: "email",
    objetivo: "BACKLINKS",
    asunto: "Una recepcionista de IA para vuestro listado",
    texto: TEXTO_BUENO,
    enlaceUrl: "https://alhabla.ai/peluqueria?utm_source=directorio",
    afirmaciones: ["funcion.reserva_en_calendario"],
    ...cambios,
  };
}

function contexto(
  cambios: Partial<ContextoDeCumplimiento> = {}
): ContextoDeCumplimiento {
  return {
    clavesVigentes: new Set([
      "funcion.reserva_en_calendario",
      "precio.plan.pro",
      "comparativa.heydiga",
    ]),
    afirmacionesCitadas: [],
    terminosProhibidos: [{ termino: "Telnyx", palabraEntera: true }],
    competidores: [
      { nombre: "HeyDiga", dominio: "heydiga.ai" },
      { nombre: "fonio", dominio: "fonio.ai" },
    ],
    textosAnteriores: [],
    textosDeLaMismaOportunidad: [],
    gestionesDelDominio: [],
    aprobadasDelDominio: 0,
    contactosEstaSemana: 0,
    topeSemanal: 5,
    umbralDeSimilitud: 0.6,
    ahora: AHORA,
    ...cambios,
  };
}

/** Una afirmación `comparativa` vigente que cita el borrador. */
function comparativa(
  clave: string,
  competidorDominio?: string
): AfirmacionCitada {
  return {
    clave,
    tipo: "comparativa",
    valor: competidorDominio ? { competidorDominio } : { dato: "sin dominio" },
  };
}

function reglasQueFallan(
  resultado: ReturnType<typeof evaluarCumplimiento>,
  duras = true
): string[] {
  return resultado.comprobaciones
    .filter((c) => !c.ok && c.dura === duras)
    .map((c) => c.regla);
}

describe("evaluarCumplimiento", () => {
  it("un borrador correcto pasa sin avisos", () => {
    const r = evaluarCumplimiento(borrador(), contexto());
    expect(r.resultado).toBe("pasa");
    expect(reglasQueFallan(r)).toEqual([]);
    expect(reglasQueFallan(r, false)).toEqual([]);
  });

  describe("afirmaciones", () => {
    it("bloquea una afirmación que no existe o ya no vale", () => {
      const r = evaluarCumplimiento(
        borrador({ afirmaciones: ["funcion.inventada"] }),
        contexto()
      );
      expect(r.resultado).toBe("bloquea");
      expect(reglasQueFallan(r)).toContain("afirmaciones_vigentes");
    });

    it("bloquea un precio sin afirmación de precio", () => {
      const r = evaluarCumplimiento(
        borrador({ texto: `${TEXTO_BUENO} Cuesta 139 € al mes.` }),
        contexto()
      );
      expect(reglasQueFallan(r)).toContain("precio_trazable");
    });

    it("bloquea los minutos sin afirmación de precio", () => {
      const r = evaluarCumplimiento(
        borrador({ texto: `${TEXTO_BUENO} Incluye 600 minutos.` }),
        contexto()
      );
      expect(reglasQueFallan(r)).toContain("precio_trazable");
    });

    it("deja el precio si cita su afirmación", () => {
      const r = evaluarCumplimiento(
        borrador({
          texto: `${TEXTO_BUENO} Cuesta 139 € al mes.`,
          afirmaciones: ["precio.plan.pro"],
        }),
        contexto()
      );
      expect(reglasQueFallan(r)).not.toContain("precio_trazable");
    });
  });

  describe("lo que no se dice", () => {
    it("«API» como palabra entera no salta con «fisioterapia» ni «Vapi»", () => {
      const prohibidoApi = {
        terminosProhibidos: [{ termino: "API", palabraEntera: true }],
      };
      for (const frase of [
        "Atendemos clínicas de fisioterapia en toda España.",
        "Nos comparan a veces con Vapi y con otros.",
      ]) {
        const r = evaluarCumplimiento(
          borrador({ texto: `${TEXTO_BUENO} ${frase}` }),
          contexto(prohibidoApi)
        );
        expect(reglasQueFallan(r)).not.toContain("sin_terminos_prohibidos");
      }
      for (const frase of [
        "Tiene una API abierta.",
        "Conecta (API) y listo.",
      ]) {
        const r = evaluarCumplimiento(
          borrador({ texto: `${TEXTO_BUENO} ${frase}` }),
          contexto(prohibidoApi)
        );
        expect(reglasQueFallan(r)).toContain("sin_terminos_prohibidos");
      }
    });

    it("con palabraEntera en false el término casa dentro de otras palabras", () => {
      const r = evaluarCumplimiento(
        borrador({ texto: `${TEXTO_BUENO} Es cosa de fisioterapia.` }),
        contexto({
          terminosProhibidos: [{ termino: "API", palabraEntera: false }],
        })
      );
      expect(reglasQueFallan(r)).toContain("sin_terminos_prohibidos");
    });

    it("un término de menos de tres caracteres no se aplica nunca", () => {
      const r = evaluarCumplimiento(
        borrador({ texto: `${TEXTO_BUENO} Todo con IA.` }),
        contexto({
          terminosProhibidos: [
            { termino: "IA", palabraEntera: true },
            { termino: "ia", palabraEntera: false },
          ],
        })
      );
      expect(reglasQueFallan(r)).not.toContain("sin_terminos_prohibidos");
    });

    it("bloquea un término prohibido, sin importar mayúsculas", () => {
      const r = evaluarCumplimiento(
        borrador({ texto: `${TEXTO_BUENO} Funciona sobre TELNYX.` }),
        contexto()
      );
      expect(r.resultado).toBe("bloquea");
      expect(reglasQueFallan(r)).toContain("sin_terminos_prohibidos");
    });

    it("bloquea nombrar a un competidor sin dato comparativo", () => {
      const r = evaluarCumplimiento(
        borrador({ texto: `${TEXTO_BUENO} Somos mejores que HeyDiga.` }),
        contexto()
      );
      expect(reglasQueFallan(r)).toContain("comparativa_con_fuente");
    });

    it("permite nombrar al competidor con una afirmación comparativa", () => {
      const r = evaluarCumplimiento(
        borrador({
          texto: `${TEXTO_BUENO} Frente a HeyDiga, el precio es distinto.`,
          afirmaciones: [
            "funcion.reserva_en_calendario",
            "comparativa.heydiga",
          ],
        }),
        contexto({
          afirmacionesCitadas: [
            comparativa("comparativa.heydiga", "heydiga.ai"),
          ],
        })
      );
      expect(reglasQueFallan(r)).not.toContain("comparativa_con_fuente");
    });

    it("una comparativa de OTRO competidor no cubre al que se nombra", () => {
      const r = evaluarCumplimiento(
        borrador({
          texto: `${TEXTO_BUENO} Frente a HeyDiga, el precio es distinto.`,
          afirmaciones: ["funcion.reserva_en_calendario", "comparativa.fonio"],
        }),
        contexto({
          clavesVigentes: new Set([
            "funcion.reserva_en_calendario",
            "comparativa.fonio",
          ]),
          afirmacionesCitadas: [comparativa("comparativa.fonio", "fonio.ai")],
        })
      );
      expect(reglasQueFallan(r)).toContain("comparativa_con_fuente");
    });

    it("una comparativa sin competidorDominio no cubre a nadie", () => {
      const r = evaluarCumplimiento(
        borrador({
          texto: `${TEXTO_BUENO} Frente a HeyDiga, el precio es distinto.`,
          afirmaciones: [
            "funcion.reserva_en_calendario",
            "comparativa.heydiga",
          ],
        }),
        contexto({
          afirmacionesCitadas: [comparativa("comparativa.heydiga")],
        })
      );
      expect(reglasQueFallan(r)).toContain("comparativa_con_fuente");
    });

    it("hace falta un dato por CADA competidor nombrado", () => {
      const texto = `${TEXTO_BUENO} Frente a HeyDiga y a fonio, el precio es distinto.`;
      const solo1 = evaluarCumplimiento(
        borrador({ texto, afirmaciones: ["comparativa.heydiga"] }),
        contexto({
          afirmacionesCitadas: [
            comparativa("comparativa.heydiga", "heydiga.ai"),
          ],
        })
      );
      expect(reglasQueFallan(solo1)).toContain("comparativa_con_fuente");
      expect(
        solo1.comprobaciones.find((c) => c.regla === "comparativa_con_fuente")
          ?.detalle
      ).toContain("fonio");

      const ambos = evaluarCumplimiento(
        borrador({
          texto,
          afirmaciones: ["comparativa.heydiga", "comparativa.fonio"],
        }),
        contexto({
          afirmacionesCitadas: [
            comparativa("comparativa.heydiga", "heydiga.ai"),
            comparativa("comparativa.fonio", "www.Fonio.ai"),
          ],
        })
      );
      expect(reglasQueFallan(ambos)).not.toContain("comparativa_con_fuente");
    });

    it("un dato que no es de tipo comparativa no cubre la comparación", () => {
      const r = evaluarCumplimiento(
        borrador({
          texto: `${TEXTO_BUENO} Frente a HeyDiga, el precio es distinto.`,
          afirmaciones: ["funcion.reserva_en_calendario"],
        }),
        contexto({
          afirmacionesCitadas: [
            {
              clave: "funcion.reserva_en_calendario",
              tipo: "funcion",
              valor: { competidorDominio: "heydiga.ai" },
            },
          ],
        })
      );
      expect(reglasQueFallan(r)).toContain("comparativa_con_fuente");
    });

    it("también cuenta nombrar al competidor por su dominio", () => {
      const r = evaluarCumplimiento(
        borrador({
          texto: `${TEXTO_BUENO} Mirad heydiga.ai antes de decidir.`,
        }),
        contexto()
      );
      expect(reglasQueFallan(r)).toContain("comparativa_con_fuente");
    });

    it("un competidor con nombre de palabra común no salta dentro de otra palabra", () => {
      const habla = {
        competidores: [{ nombre: "Habla", dominio: "habla.ai" }],
      };
      const cubierta = (texto: string) =>
        evaluarCumplimiento(
          borrador({ texto }),
          contexto(habla)
        ).comprobaciones.find((c) => c.regla === "comparativa_con_fuente")?.ok;
      expect(
        cubierta(`${TEXTO_BUENO} Hablamos pronto, sin hablar de más.`)
      ).toBe(true);
      // «habla» es un verbo corriente: sola ya no nombra a un competidor que
      // se llame Habla. Solo cuenta con su dominio o con «Habla AI».
      expect(cubierta(`${TEXTO_BUENO} Habla con nosotros.`)).toBe(true);
      expect(cubierta(`${TEXTO_BUENO} Alhabla habla español y catalán.`)).toBe(
        true
      );
      expect(cubierta(`${TEXTO_BUENO} Mirad habla.ai antes de decidir.`)).toBe(
        false
      );
      expect(cubierta(`${TEXTO_BUENO} Frente a Habla AI, mejor.`)).toBe(false);
    });
  });

  describe("identificación", () => {
    it("bloquea un correo que no dice quién escribe", () => {
      const r = evaluarCumplimiento(
        borrador({
          texto:
            "Hola, tenemos una recepcionista de IA para peluquerías que atiende las llamadas y reserva citas. Os la dejamos por si os interesa para vuestro listado.",
        }),
        contexto()
      );
      expect(reglasQueFallan(r)).toContain("identificacion");
    });

    it("una ficha de directorio no necesita firma", () => {
      const r = evaluarCumplimiento(
        borrador({
          tipo: "ficha_directorio",
          texto:
            "Recepcionista de IA para peluquerías y barberías de España: atiende las llamadas, consulta el horario y reserva citas en el calendario del negocio, a cualquier hora.",
        }),
        contexto()
      );
      expect(reglasQueFallan(r)).not.toContain("identificacion");
    });
  });

  describe("esquemas de enlaces", () => {
    it.each([
      "Os proponemos un intercambio de enlaces entre las dos webs.",
      "Pagamos por el enlace si lo ponéis en la portada.",
      "Podemos comprar un enlace en vuestro artículo.",
      "Podemos hacer un link exchange.",
    ])("bloquea: %s", (frase) => {
      const r = evaluarCumplimiento(
        borrador({ texto: `${TEXTO_BUENO} ${frase}` }),
        contexto()
      );
      expect(reglasQueFallan(r)).toContain("sin_esquemas_de_enlaces");
    });

    it("bloquea un enlace que no apunta a alhabla.ai", () => {
      const r = evaluarCumplimiento(
        borrador({ enlaceUrl: "https://otra-web.com/oferta?utm_source=x" }),
        contexto()
      );
      expect(reglasQueFallan(r)).toContain("enlace_a_alhabla");
    });

    it("no se deja engañar por un dominio que solo contiene alhabla.ai", () => {
      const r = evaluarCumplimiento(
        borrador({ enlaceUrl: "https://alhabla.ai.malo.com/?utm_source=x" }),
        contexto()
      );
      expect(reglasQueFallan(r)).toContain("enlace_a_alhabla");
    });

    it("acepta subdominios de alhabla.ai", () => {
      const r = evaluarCumplimiento(
        borrador({ enlaceUrl: "https://www.alhabla.ai/planes?utm_source=x" }),
        contexto()
      );
      expect(reglasQueFallan(r)).not.toContain("enlace_a_alhabla");
    });
  });

  describe("frecuencia de contacto", () => {
    it("bloquea un segundo contacto con el mismo dominio en 90 días", () => {
      const r = evaluarCumplimiento(
        borrador(),
        contexto({ gestionesDelDominio: [new Date("2026-09-20T00:00:00Z")] })
      );
      expect(reglasQueFallan(r)).toContain("un_contacto_por_dominio");
    });

    it("permite volver a escribir pasados los 90 días", () => {
      const r = evaluarCumplimiento(
        borrador(),
        contexto({ gestionesDelDominio: [new Date("2026-07-01T00:00:00Z")] })
      );
      expect(reglasQueFallan(r)).not.toContain("un_contacto_por_dominio");
    });

    it("bloquea si ya hay otra oportunidad aprobada del mismo dominio sin gestionar", () => {
      const r = evaluarCumplimiento(
        borrador(),
        contexto({ aprobadasDelDominio: 1 })
      );
      expect(reglasQueFallan(r)).toContain("un_contacto_por_dominio");
      expect(
        r.comprobaciones.find((c) => c.regla === "un_contacto_por_dominio")
          ?.detalle
      ).toContain("aprobada");
    });

    it("bloquea al llegar al tope semanal", () => {
      const r = evaluarCumplimiento(
        borrador(),
        contexto({ contactosEstaSemana: 5, topeSemanal: 5 })
      );
      expect(reglasQueFallan(r)).toContain("tope_semanal");
    });

    it("deja pasar mientras no se llegue al tope", () => {
      const r = evaluarCumplimiento(
        borrador(),
        contexto({ contactosEstaSemana: 4, topeSemanal: 5 })
      );
      expect(reglasQueFallan(r)).not.toContain("tope_semanal");
    });
  });

  describe("plantillas repetidas", () => {
    it("bloquea un texto casi idéntico a uno anterior", () => {
      const r = evaluarCumplimiento(
        borrador(),
        contexto({ textosAnteriores: [TEXTO_BUENO.replace("listado", "web")] })
      );
      expect(reglasQueFallan(r)).toContain("sin_plantilla_repetida");
    });

    it("avisa, sin bloquear, cuando el parecido es medio", () => {
      const mitad = TEXTO_BUENO.split(" ").slice(0, 28).join(" ");
      const r = evaluarCumplimiento(
        borrador(),
        contexto({
          textosAnteriores: [
            `${mitad} y otras cosas distintas que no se parecen en nada a lo escrito aquí, para dejar el parecido en un punto intermedio entre los dos textos`,
          ],
        })
      );
      expect(reglasQueFallan(r)).not.toContain("sin_plantilla_repetida");
    });
  });

  describe("versiones de una misma oportunidad", () => {
    it("una versión casi igual a la anterior de la misma oportunidad avisa, no bloquea", () => {
      const r = evaluarCumplimiento(
        borrador(),
        contexto({
          textosDeLaMismaOportunidad: [TEXTO_BUENO.replace("listado", "web")],
        })
      );
      expect(reglasQueFallan(r)).not.toContain("sin_plantilla_repetida");
      expect(reglasQueFallan(r, false)).toContain(
        "similitud_con_version_anterior"
      );
      expect(r.resultado).toBe("aviso");
    });

    it("el mismo texto en OTRA oportunidad sigue bloqueando", () => {
      const r = evaluarCumplimiento(
        borrador(),
        contexto({ textosAnteriores: [TEXTO_BUENO] })
      );
      expect(reglasQueFallan(r)).toContain("sin_plantilla_repetida");
    });

    it("una versión reescrita no avisa de nada", () => {
      const r = evaluarCumplimiento(
        borrador(),
        contexto({
          textosDeLaMismaOportunidad: [
            "Buenas tardes, escribo desde un estudio pequeño de Valencia para proponer una colaboración editorial distinta, con otro enfoque y otras palabras.",
          ],
        })
      );
      expect(reglasQueFallan(r, false)).not.toContain(
        "similitud_con_version_anterior"
      );
    });

    it("sin versión anterior no hay nada con lo que comparar", () => {
      const r = evaluarCumplimiento(borrador(), contexto());
      expect(
        r.comprobaciones.find(
          (c) => c.regla === "similitud_con_version_anterior"
        )
      ).toMatchObject({ ok: true, dura: false });
    });
  });

  describe("datos personales", () => {
    it("bloquea un correo ajeno", () => {
      const r = evaluarCumplimiento(
        borrador({
          texto: `${TEXTO_BUENO} Escribid a maria.lopez@ejemplo.es.`,
        }),
        contexto()
      );
      expect(reglasQueFallan(r)).toContain("sin_datos_personales");
    });

    it("permite el correo de Alhabla", () => {
      const r = evaluarCumplimiento(
        borrador({ texto: `${TEXTO_BUENO} Escribidnos a hola@alhabla.ai.` }),
        contexto()
      );
      expect(reglasQueFallan(r)).not.toContain("sin_datos_personales");
    });

    it("bloquea un teléfono", () => {
      const r = evaluarCumplimiento(
        borrador({ texto: `${TEXTO_BUENO} Llamad al 612 345 678.` }),
        contexto()
      );
      expect(reglasQueFallan(r)).toContain("sin_datos_personales");
    });

    it("no confunde un precio ni una cifra con un teléfono", () => {
      const r = evaluarCumplimiento(
        borrador({
          texto: `${TEXTO_BUENO} Desde 59 € al mes, 200 minutos y 3 profesionales.`,
          afirmaciones: ["funcion.reserva_en_calendario", "precio.plan.pro"],
        }),
        contexto()
      );
      expect(reglasQueFallan(r)).not.toContain("sin_datos_personales");
    });
  });

  describe("tipo de borrador y objetivo", () => {
    it("un texto invitado solo encaja con backlinks", () => {
      const r = evaluarCumplimiento(
        borrador({ tipo: "texto_invitado", objetivo: "LEADS" }),
        contexto()
      );
      expect(reglasQueFallan(r)).toContain("tipo_acorde_con_objetivo");
    });

    it("una ficha de directorio no encaja con clientes potenciales", () => {
      const r = evaluarCumplimiento(
        borrador({ tipo: "ficha_directorio", objetivo: "LEADS" }),
        contexto()
      );
      expect(reglasQueFallan(r)).toContain("tipo_acorde_con_objetivo");
    });
  });

  describe("reglas blandas: avisan pero no bloquean", () => {
    it("avisa de un enlace sin UTM", () => {
      const r = evaluarCumplimiento(
        borrador({ enlaceUrl: "https://alhabla.ai/peluqueria" }),
        contexto()
      );
      expect(r.resultado).toBe("aviso");
      expect(reglasQueFallan(r, false)).toContain("enlace_con_utm");
    });

    it("avisa de un texto demasiado corto", () => {
      const r = evaluarCumplimiento(
        borrador({
          texto: "Soy el fundador de Alhabla, escribo por vuestro listado.",
        }),
        contexto()
      );
      expect(r.resultado).toBe("aviso");
      expect(reglasQueFallan(r, false)).toContain("longitud_razonable");
    });

    it("avisa de más de dos enlaces en el texto", () => {
      const r = evaluarCumplimiento(
        borrador({
          texto: `${TEXTO_BUENO} https://alhabla.ai/a https://alhabla.ai/b https://alhabla.ai/c`,
        }),
        contexto()
      );
      expect(reglasQueFallan(r, false)).toContain("pocos_enlaces");
    });

    it("una regla dura que falla pesa más que un aviso", () => {
      const r = evaluarCumplimiento(
        borrador({
          afirmaciones: ["funcion.inventada"],
          enlaceUrl: "https://alhabla.ai/peluqueria",
        }),
        contexto()
      );
      expect(r.resultado).toBe("bloquea");
    });
  });

  it("cada comprobación trae su regla y un detalle legible", () => {
    const r = evaluarCumplimiento(borrador(), contexto());
    for (const c of r.comprobaciones) {
      expect(c.regla).toMatch(/^[a-z_]+$/);
      expect(c.detalle.length).toBeGreaterThan(5);
    }
  });
});

describe("mencionaPalabra", () => {
  it("no distingue mayúsculas ni acentos", () => {
    expect(mencionaPalabra("Una recepción rápida", "RECEPCION")).toBe(true);
    expect(mencionaPalabra("la peluquería", "peluqueria")).toBe(true);
  });

  it("exige palabra entera, en cualquier alfabeto", () => {
    expect(mencionaPalabra("habla español", "hab")).toBe(false);
    expect(mencionaPalabra("hablamos", "habla")).toBe(false);
    expect(mencionaPalabra("¿Habla usted?", "habla")).toBe(true);
    expect(mencionaPalabra("canción", "canci")).toBe(false);
    expect(mencionaPalabra('a la "API".', "api")).toBe(true);
    // Un número pegado también es parte de la palabra.
    expect(mencionaPalabra("api2", "api")).toBe(false);
    expect(mencionaPalabra("Wi-Fi gratis", "wi-fi")).toBe(true);
  });

  it("los términos de varias palabras casan con cualquier espacio en medio", () => {
    expect(mencionaPalabra("nuestro agente\n  de voz", "agente de voz")).toBe(
      true
    );
    expect(mencionaPalabra("agente de vozes", "agente de voz")).toBe(false);
  });

  it("un término con caracteres de expresión regular no rompe ni casa de más", () => {
    expect(mencionaPalabra("cuesta 5.0 euros", "5.0")).toBe(true);
    expect(mencionaPalabra("cuesta 5x0 euros", "5.0")).toBe(false);
    expect(mencionaPalabra("a (b) c", "(b)")).toBe(true);
    expect(() => mencionaPalabra("texto", "[abc")).not.toThrow();
    expect(() => mencionaPalabra("texto", "a+++")).not.toThrow();
  });

  it("menos de tres caracteres nunca casan", () => {
    expect(mencionaPalabra("la ia", "ia")).toBe(false);
    expect(mencionaPalabra("la ia", "ia", { palabraEntera: false })).toBe(
      false
    );
    expect(mencionaPalabra("la ia", "  ")).toBe(false);
  });

  it("con palabraEntera en false basta una subcadena", () => {
    expect(mencionaPalabra("hablamos", "habla", { palabraEntera: false })).toBe(
      true
    );
  });
});

describe("datos personales en una investigación", () => {
  it("detecta correos", () => {
    expect(contieneCorreo("escribe a maria@ejemplo.es")).toBe(true);
    expect(contieneCorreo("sin correo, solo ejemplo.es")).toBe(false);
    // Dos llamadas seguidas dan lo mismo (la expresión global guarda estado).
    expect(contieneCorreo("a@b.co")).toBe(true);
    expect(contieneCorreo("a@b.co")).toBe(true);
  });

  it("detecta teléfonos españoles pero no fechas ni cifras", () => {
    for (const telefono of [
      "612 345 678",
      "612345678",
      "+34 612 345 678",
      "0034 612345678",
      "91 234 56 78",
      "912-345-678",
    ]) {
      expect(contieneTelefono(`llamad al ${telefono} hoy`)).toBe(true);
    }
    for (const texto of [
      "actualizado el 2026-10-30 12:00",
      "10.000 visitas al mes",
      "domain authority 41, 1234567",
      "factura 20261030",
    ]) {
      expect(contieneTelefono(texto)).toBe(false);
    }
  });
});

describe("dominios", () => {
  it("reconoce alhabla.ai y sus subdominios, y nada más", () => {
    expect(esHostDeAlhabla("alhabla.ai")).toBe(true);
    expect(esHostDeAlhabla("APP.Alhabla.ai")).toBe(true);
    expect(esHostDeAlhabla("alhabla.ai.malo.com")).toBe(false);
    expect(esHostDeAlhabla("notalhabla.ai")).toBe(false);
  });

  it("normaliza un dominio", () => {
    expect(normalizarDominio(" WWW.HeyDiga.AI ")).toBe("heydiga.ai");
  });

  it("el punto final de un FQDN no cambia de sitio", () => {
    expect(sinPuntoFinal("alhabla.ai.")).toBe("alhabla.ai");
    expect(sinPuntoFinal("alhabla.ai..")).toBe("alhabla.ai");
    expect(esHostDeAlhabla("alhabla.ai.")).toBe(true);
    expect(esHostDeAlhabla("www.alhabla.ai.")).toBe(true);
    expect(esHostDeAlhabla("alhabla.ai.malo.com.")).toBe(false);
    expect(normalizarDominio("www.HeyDiga.ai.")).toBe("heydiga.ai");
    expect(normalizarDominio("heydiga.ai.")).toBe("heydiga.ai");
  });
});

// ── Correcciones de la revisión de la Fase 1b ───────────────────────────

describe("texto camuflado: caracteres invisibles, homoglifos y compatibilidad", () => {
  const prohibidos = (texto: string) =>
    reglasQueFallan(
      evaluarCumplimiento(
        borrador({ texto: `${TEXTO_BUENO} ${texto}` }),
        contexto({
          terminosProhibidos: [
            { termino: "Retell", palabraEntera: true },
            { termino: "Telnyx", palabraEntera: true },
          ],
          competidores: [{ nombre: "HeyDiga", dominio: "heydiga.ai" }],
        })
      )
    );

  it.each([
    ["espacio de ancho cero", `Mejores que Re${ZWSP}tell, sin duda.`],
    ["unión de ancho cero", `Mejores que Re${ZWJ}tell, sin duda.`],
    ["guion blando", `Mejores que Re${SHY}tell, sin duda.`],
    ["marca de dirección", `Mejores que ${LRM}Retell${RLM}, sin duda.`],
    ["e cirílica", `Mejores que R${E_CIRILICA}tell, sin duda.`],
    ["e y x cirílicas en Telnyx", `Usamos T${E_CIRILICA}lny${X_CIRILICA}.`],
    ["ancho completo", `Mejores que ${aAnchoCompleto("Retell")}.`],
    ["mayúscula cirílica", `Mejores que R${E_CIRILICA_MAYUSCULA}TELL.`],
    ["épsilon griega", `Usamos T${EPSILON_GRIEGA}lnyx.`],
  ])("sigue encontrando un término prohibido con %s", (_nombre, frase) => {
    expect(prohibidos(frase)).toContain("sin_terminos_prohibidos");
  });

  it("camuflar el nombre de un competidor tampoco lo esconde de la regla 3", () => {
    expect(prohibidos(`Frente a Hey${ZWSP}Diga, mejor.`)).toContain(
      "comparativa_con_fuente"
    );
    expect(prohibidos(`Frente a H${E_CIRILICA}yDiga, mejor.`)).toContain(
      "comparativa_con_fuente"
    );
  });

  it("un texto limpio sigue pasando", () => {
    expect(prohibidos("Hablamos de recepcionistas en español.")).toEqual([]);
  });

  it("mencionaPalabra ve a través de lo invisible y de los homoglifos", () => {
    expect(mencionaPalabra(`Re${ZWSP}tell AI`, "retell")).toBe(true);
    expect(mencionaPalabra(`R${E_CIRILICA}tell`, "Retell")).toBe(true);
    // Y el término puede traer lo mismo que el texto.
    expect(mencionaPalabra("Retell", `R${E_CIRILICA}${ZWSP}tell`)).toBe(true);
    // Pero no inventa coincidencias dentro de otra palabra.
    expect(mencionaPalabra("Retellado", "Retell")).toBe(false);
  });
});

describe("precio_trazable: las formas de hablar de dinero, minutos o gratis", () => {
  const habla = (
    frase: string,
    afirmaciones = ["funcion.reserva_en_calendario"]
  ) =>
    evaluarCumplimiento(
      borrador({ texto: `${TEXTO_BUENO} ${frase}`, afirmaciones }),
      contexto()
    );

  it.each([
    "Cuesta 59 EUR al mes.",
    "Cuesta 59 eur al mes.",
    "Cuesta 59 euros al mes.",
    "Cuesta 59€ al mes.",
    "Cuesta € 59 al mes.",
    "Cuesta 59,90 € al mes.",
    "Cuesta 1.200 euros al año.",
    "Cuesta 59 dólares al mes.",
    "Cuesta 59 USD al mes.",
    "Cuesta $59 al mes.",
    "Cuesta 59$ al mes.",
    "Incluye 200 mins al mes.",
    "Incluye 200 min al mes.",
    "Incluye 200 minutos al mes.",
    "Incluye 200minutos al mes.",
    "Cuesta cincuenta y nueve euros al mes.",
    "Cuesta ciento treinta y nueve euros al mes.",
    "Cuesta un euro al día.",
    "Cuesta dos mil quinientos euros al año.",
    "Incluye doscientos minutos al mes.",
    "Hay una prueba gratis.",
    "Es totalmente GRATUITO para vosotros.",
    "El plan es gratuita al principio.",
    "Sin coste para el listado.",
    "Hay un free trial de dos semanas.",
  ])("exige citar un precio: %s", (frase) => {
    expect(reglasQueFallan(habla(frase))).toContain("precio_trazable");
  });

  it("citar una afirmación `precio.*` lo resuelve", () => {
    for (const frase of [
      "Cuesta 59 EUR al mes.",
      "Cuesta cincuenta y nueve euros al mes.",
      "Incluye 200 mins.",
      "Hay una prueba gratis.",
    ]) {
      const r = habla(frase, [
        "funcion.reserva_en_calendario",
        "precio.plan.pro",
      ]);
      expect(reglasQueFallan(r), frase).not.toContain("precio_trazable");
    }
  });

  it.each([
    "Somos tres profesionales en Madrid.",
    "Lo vimos el 2026-10-30 a las 12:00.",
    "La zona euro y la Eurocopa no son precios.",
    "Ya tenemos 40 clientes y 3 sectores.",
    "Dos minutos de lectura bastan.",
    "Un minuto de su tiempo.",
    "Hablamos sin ningún compromiso.",
    "Una gratificación no es un precio.",
  ])("no se confunde con un precio: %s", (frase) => {
    const detalle = habla(frase).comprobaciones.find(
      (c) => c.regla === "precio_trazable"
    );
    expect(detalle?.ok, frase).toBe(true);
  });

  it("también lo ve en el asunto", () => {
    const r = evaluarCumplimiento(
      borrador({ asunto: "Gratis para vuestro listado" }),
      contexto()
    );
    expect(reglasQueFallan(r)).toContain("precio_trazable");
  });
});

describe("sin_datos_personales también mira el asunto y lo camuflado", () => {
  const conAsunto = (asunto: string, texto = TEXTO_BUENO) =>
    reglasQueFallan(
      evaluarCumplimiento(borrador({ asunto, texto }), contexto())
    );

  it("un correo ajeno en el asunto bloquea", () => {
    expect(conAsunto("Para maria.lopez@ejemplo.es")).toContain(
      "sin_datos_personales"
    );
  });

  it("un teléfono en el asunto bloquea", () => {
    expect(conAsunto("Llamadme al 612 345 678")).toContain(
      "sin_datos_personales"
    );
  });

  it("el correo de Alhabla en el asunto no", () => {
    expect(conAsunto("Escribid a hola@alhabla.ai")).not.toContain(
      "sin_datos_personales"
    );
  });

  it("un correo con espacio de ancho cero o un teléfono con dígitos de ancho completo se ven igual", () => {
    expect(
      conAsunto("x", `${TEXTO_BUENO} Escribid a maria${ZWSP}.lopez@ejemplo.es.`)
    ).toContain("sin_datos_personales");
    expect(
      conAsunto(
        "x",
        `${TEXTO_BUENO} Llamad al ${aAnchoCompleto("612")} ${aAnchoCompleto("345")} ${aAnchoCompleto("678")}.`
      )
    ).toContain("sin_datos_personales");
  });

  it("el asunto y el texto no se pegan: dos cifras sueltas en cada uno no forman un teléfono", () => {
    expect(
      conAsunto("Oferta 2026", "1234 es el código de nuestra guía.")
    ).not.toContain("sin_datos_personales");
  });

  it("contieneCorreo y contieneTelefono ven a través de lo invisible", () => {
    expect(contieneCorreo(`ma${ZWSP}ria@ejemplo.es`)).toBe(true);
    expect(contieneTelefono(`612${ZWSP}345${ZWSP}678`)).toBe(true);
  });
});

describe("enlace_a_alhabla también vigila los enlaces del texto", () => {
  const enlaces = (texto: string, asunto?: string) =>
    evaluarCumplimiento(
      borrador({
        texto: `${TEXTO_BUENO} ${texto}`,
        ...(asunto ? { asunto } : {}),
      }),
      contexto()
    );

  it.each([
    "Mirad https://otra-web.com/oferta para más datos.",
    "Mirad http://otra-web.com para más datos.",
    "Mirad www.otra-web.com para más datos.",
    "Mirad HTTPS://OTRA-WEB.COM/x para más datos.",
    "Mirad https://alhabla.ai.malo.com/x para más datos.",
    "Mirad https://alhabla.ai@malo.com/x para más datos.",
    "Mirad https://malo.com/?r=alhabla.ai para más datos.",
    "Mirad (https://otra-web.com/x), os servirá.",
    `Mirad https://otra${ZWSP}-web.com/x para más datos.`,
  ])("bloquea: %s", (frase) => {
    const r = enlaces(frase);
    expect(reglasQueFallan(r)).toContain("enlace_a_alhabla");
    expect(
      r.comprobaciones.find((c) => c.regla === "enlace_a_alhabla")?.detalle
    ).toContain("El texto enlaza a otros sitios");
  });

  it("bloquea un enlace ajeno en el asunto", () => {
    expect(
      reglasQueFallan(enlaces("Hola.", "Mira https://otra-web.com/x"))
    ).toContain("enlace_a_alhabla");
  });

  it.each([
    "Mirad https://alhabla.ai/planes para más datos.",
    "Mirad https://www.alhabla.ai/planes?utm_source=a para más datos.",
    "Mirad https://app.alhabla.ai. Gracias.",
    "Mirad https://alhabla.ai./x para más datos.",
    "Mirad www.alhabla.ai/blog para más datos.",
  ])("deja pasar los de Alhabla: %s", (frase) => {
    expect(reglasQueFallan(enlaces(frase))).not.toContain("enlace_a_alhabla");
  });

  it("un enlace pedido con otro esquema o a otro host sigue bloqueando", () => {
    for (const enlaceUrl of [
      "ftp://alhabla.ai/x",
      "javascript:alert(1)",
      "https://otra-web.com/x",
    ]) {
      expect(
        reglasQueFallan(
          evaluarCumplimiento(borrador({ enlaceUrl }), contexto())
        ),
        enlaceUrl
      ).toContain("enlace_a_alhabla");
    }
    expect(
      reglasQueFallan(
        evaluarCumplimiento(
          borrador({ enlaceUrl: "https://alhabla.ai./x?utm_source=a" }),
          contexto()
        )
      )
    ).not.toContain("enlace_a_alhabla");
  });

  it("la regla blanda pocos_enlaces se mantiene: tres enlaces de Alhabla avisan pero no bloquean", () => {
    const r = enlaces(
      "https://alhabla.ai/a https://alhabla.ai/b https://alhabla.ai/c"
    );
    expect(reglasQueFallan(r)).not.toContain("enlace_a_alhabla");
    expect(reglasQueFallan(r, false)).toContain("pocos_enlaces");
  });
});

describe("enlace_con_utm: el UTM tiene que ir en la URL", () => {
  const regla = (cambios: Partial<BorradorAEvaluar>) =>
    evaluarCumplimiento(borrador(cambios), contexto()).comprobaciones.find(
      (c) => c.regla === "enlace_con_utm"
    )!;

  it("sin utm_source en la URL avisa (blanda) y lo dice", () => {
    const r = regla({ enlaceUrl: "https://alhabla.ai/planes" });
    expect(r).toMatchObject({ ok: false, dura: false });
    expect(r.detalle).toContain("en la URL");
  });

  it("si el borrador declara `utm` pero la URL no lo lleva, explica que el campo no se añade solo", () => {
    const r = regla({
      enlaceUrl: "https://alhabla.ai/planes",
      utm: { utm_source: "directorio", utm_medium: "ficha" },
    });
    expect(r.ok).toBe(false);
    expect(r.detalle).toContain("el campo `utm` no se añade solo");
  });

  it("con utm_source en la URL pasa", () => {
    expect(
      regla({ enlaceUrl: "https://alhabla.ai/planes?utm_source=directorio" }).ok
    ).toBe(true);
  });

  it("un `utm` mal formado no rompe nada", () => {
    for (const utm of [
      null,
      "x",
      3,
      [],
      { utm_source: 3 },
      { utm_source: " " },
    ]) {
      const r = regla({ enlaceUrl: "https://alhabla.ai/planes", utm });
      expect(r.ok).toBe(false);
      expect(r.detalle).not.toContain("no se añade solo");
    }
  });
});

describe("regla 3: el competidor se reconoce por sus alias", () => {
  const COMPETIDORES = [
    { nombre: "Retell AI", dominio: "retell.ai" },
    { nombre: "Vapi", dominio: "vapi.ai" },
    { nombre: "Bland AI", dominio: "bland.ai" },
    { nombre: "Synthflow", dominio: "synthflow.ai" },
    { nombre: "ElevenLabs", dominio: "elevenlabs.io" },
    { nombre: "PolyAI", dominio: "poly.ai" },
    { nombre: "Voiceflow", dominio: "voiceflow.com" },
    { nombre: "HeyDiga", dominio: "heydiga.ai" },
    { nombre: "fonio", dominio: "fonio.ai" },
  ];
  const resultado = (
    frase: string,
    extra: Partial<ContextoDeCumplimiento> = {}
  ) =>
    evaluarCumplimiento(
      borrador({ texto: `${TEXTO_BUENO} ${frase}` }),
      contexto({ competidores: COMPETIDORES, ...extra })
    ).comprobaciones.find((c) => c.regla === "comparativa_con_fuente")!;

  it.each([
    "Somos mejores que Retell AI.",
    "Somos mejores que RETELL AI.",
    "Somos mejores que Retell.",
    "Somos mejores que retell.ai.",
    "Somos mejores que RetellAI.",
    "Somos mejores que Retell-AI en español.",
    "Mirad https://www.retell.ai/pricing antes.",
    "Somos mejores que Vapi.",
    "Somos mejores que vapi.ai.",
    "Somos mejores que Bland.",
    "Somos mejores que Bland AI.",
    "Somos mejores que Eleven Labs.",
    "Somos mejores que ElevenLabs.",
    "Somos mejores que elevenlabs.io.",
    "Somos mejores que Eleven.",
    "Somos mejores que Poly AI.",
    "Somos mejores que PolyAI.",
    "Somos mejores que Poly.",
    "Somos mejores que Synthflow.",
    "Somos mejores que Voiceflow.",
    "Somos mejores que HeyDiga.",
    "Somos mejores que Hey Diga.",
    "Somos mejores que heydiga.ai.",
    "Somos mejores que fonio.",
    "Somos mejores que Fonio AI.",
  ])("bloquea sin dato comparativo: %s", (frase) => {
    expect(resultado(frase).ok).toBe(false);
  });

  it.each([
    "Hablamos de la voz de un negocio.",
    "Nuestra voz es suave y blanda al oído.",
    "Vamos a la vapiano de la esquina.",
    "El vapirismo y el navapi no son palabras.",
    "Una polygamia no tiene nada que ver.",
    "Una cuchara polylactica.",
    "La once de la mañana.",
    "Estudiamos el flujo de la voz.",
    "Retellado y fonioso no son palabras.",
  ])("no da falsos positivos con palabras corrientes: %s", (frase) => {
    const r = resultado(frase);
    expect(r.ok, frase).toBe(true);
    expect(r.detalle).toBe("No nombra a ningún competidor.");
  });

  it("con el dato comparativo de ESE competidor, nombrarlo por cualquier alias pasa", () => {
    const comparativas = (dominio: string) => [
      {
        clave: `comparativa.${dominio}`,
        tipo: "comparativa",
        valor: { competidorDominio: dominio },
      },
    ];
    expect(
      resultado("Somos mejores que Retell.", {
        afirmacionesCitadas: comparativas("retell.ai"),
      }).ok
    ).toBe(true);
    // El de otro no sirve.
    expect(
      resultado("Somos mejores que Retell.", {
        afirmacionesCitadas: comparativas("vapi.ai"),
      }).ok
    ).toBe(false);
  });

  it("aliasesDeCompetidor: las formas de nombrar, sin palabras corrientes sueltas", () => {
    expect(aliasesDeCompetidor(COMPETIDORES[0]!).sort()).toEqual(
      ["retell", "retell ai", "retell.ai", "retellai"].sort()
    );
    expect(aliasesDeCompetidor(COMPETIDORES[4]!)).toEqual(
      expect.arrayContaining([
        "elevenlabs.io",
        "elevenlabs",
        "eleven labs",
        "eleven",
      ])
    );
    expect(aliasesDeCompetidor(COMPETIDORES[5]!)).toEqual(
      expect.arrayContaining(["poly.ai", "poly ai", "polyai", "poly"])
    );
    expect(aliasesDeCompetidor(COMPETIDORES[7]!)).toEqual(
      expect.arrayContaining(["heydiga.ai", "heydiga", "hey diga"])
    );
    // «Habla» es un verbo: solo vale con el dominio o con «AI».
    expect(
      aliasesDeCompetidor({ nombre: "Habla", dominio: "www.habla.ai." }).sort()
    ).toEqual(["habla ai", "habla.ai"].sort());
  });
});

describe("las reglas de agenda no son del texto", () => {
  it("REGLAS_DE_AGENDA son un_contacto_por_dominio y tope_semanal", () => {
    expect([...REGLAS_DE_AGENDA].sort()).toEqual([
      "tope_semanal",
      "un_contacto_por_dominio",
    ]);
    expect(esReglaDeAgenda("tope_semanal")).toBe(true);
    expect(esReglaDeAgenda("sin_terminos_prohibidos")).toBe(false);
  });

  const agendaLlena = contexto({
    gestionesDelDominio: [new Date("2026-10-20T00:00:00Z")],
    contactosEstaSemana: 5,
  });

  it("por defecto bloquean (así se crea un borrador)", () => {
    const r = evaluarCumplimiento(borrador(), agendaLlena);
    expect(r.resultado).toBe("bloquea");
    expect(reglasQueFallan(r).sort()).toEqual([
      "tope_semanal",
      "un_contacto_por_dominio",
    ]);
  });

  it("con agendaComoAviso quedan como avisos y el resultado es «aviso», no «bloquea»", () => {
    const r = evaluarCumplimiento(borrador(), agendaLlena, {
      agendaComoAviso: true,
    });
    expect(r.resultado).toBe("aviso");
    expect(reglasQueFallan(r)).toEqual([]);
    expect(reglasQueFallan(r, false).sort()).toEqual([
      "tope_semanal",
      "un_contacto_por_dominio",
    ]);
    // Siguen diciendo por qué.
    expect(
      r.comprobaciones.find((c) => c.regla === "tope_semanal")?.detalle
    ).toContain("tope de 5");
  });

  it("con agendaComoAviso una regla del texto que falla sigue bloqueando", () => {
    const r = evaluarCumplimiento(
      borrador({ texto: `${TEXTO_BUENO} Usamos Telnyx.` }),
      agendaLlena,
      { agendaComoAviso: true }
    );
    expect(r.resultado).toBe("bloquea");
    expect(reglasQueFallan(r)).toEqual(["sin_terminos_prohibidos"]);
  });

  it("fallosDelTexto devuelve solo las duras que fallan y no son de agenda", () => {
    const r = evaluarCumplimiento(
      borrador({ texto: `${TEXTO_BUENO} Usamos Telnyx.` }),
      agendaLlena
    );
    expect(fallosDelTexto(r.comprobaciones).map((c) => c.regla)).toEqual([
      "sin_terminos_prohibidos",
    ]);
    expect(fallosDelTexto([])).toEqual([]);
  });
});
