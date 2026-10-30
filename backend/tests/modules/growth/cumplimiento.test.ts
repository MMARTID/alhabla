import { describe, it, expect } from "vitest";
import {
  evaluarCumplimiento,
  type BorradorAEvaluar,
  type ContextoDeCumplimiento,
} from "../../../src/modules/growth/cumplimiento.js";

const AHORA = new Date("2026-11-02T10:00:00Z");

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
    terminosProhibidos: ["Telnyx"],
    competidores: ["HeyDiga", "fonio"],
    textosAnteriores: [],
    gestionesDelDominio: [],
    contactosEstaSemana: 0,
    topeSemanal: 5,
    umbralDeSimilitud: 0.6,
    ahora: AHORA,
    ...cambios,
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
        contexto()
      );
      expect(reglasQueFallan(r)).not.toContain("comparativa_con_fuente");
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
