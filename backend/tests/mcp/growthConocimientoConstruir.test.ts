import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SincronizarBody } from "../../src/modules/growth/esquemas.js";
import { mencionaPalabra } from "../../src/modules/growth/cumplimiento.js";
import {
  ErroresDeExtraccion,
  construirAfirmaciones,
  dominioRaiz,
  euros,
  miles,
  type EntradaDeConocimiento,
} from "../../mcp/growth/conocimiento/construir.js";
import { cargarEntrada } from "../../mcp/growth/conocimiento/entrada.js";
import { parsearProductMd } from "../../mcp/growth/conocimiento/productMd.js";

/**
 * La extracción sobre el repo REAL (PRODUCT.md, web/, planFeatures.ts), y
 * después sobre copias a las que se rompe algo a propósito: lo que protege es
 * que un cambio en el repo que el mapa no cubra haga fallar, no que se ignore.
 * Si no hay `web/` (otro contexto de ejecución), no corre.
 */

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const hayRepo =
  existsSync(join(RAIZ, "PRODUCT.md")) &&
  existsSync(join(RAIZ, "web", "src", "lib", "plans.ts"));

/** Copia profunda: cada test rompe la suya. */
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

describe("utilidades", () => {
  it("formatea miles y euros como la web", () => {
    expect(miles(1500)).toBe("1.500");
    expect(miles(200)).toBe("200");
    expect(euros(0.3)).toBe("0,30");
    expect(euros(0.25)).toBe("0,25");
  });

  it("el dominio del competidor es el registrable, no un subdominio de documentación", () => {
    expect(dominioRaiz("https://docs.vapi.ai/faq")).toBe("vapi.ai");
    expect(dominioRaiz("https://www.retellai.com/pricing")).toBe(
      "retellai.com"
    );
    expect(dominioRaiz("https://elevenlabs.io/docs/x")).toBe("elevenlabs.io");
  });
});

describe.skipIf(!hayRepo)("construirAfirmaciones sobre el repo real", () => {
  let entrada: EntradaDeConocimiento;
  let resultado: ReturnType<typeof construirAfirmaciones>;

  beforeAll(async () => {
    entrada = await cargarEntrada(RAIZ);
    resultado = construirAfirmaciones(entrada);
  }, 30_000);

  const claves = () => resultado.afirmaciones.map((a) => a.clave);
  const de = (clave: string) =>
    resultado.afirmaciones.find((a) => a.clave === clave)!;

  describe("lo que sale", () => {
    it("claves únicas, bien formadas y con el tipo como prefijo", () => {
      expect(new Set(claves()).size).toBe(claves().length);
      for (const a of resultado.afirmaciones) {
        expect(a.clave).toMatch(/^[a-z]+([.][a-z0-9_-]+)+$/);
        expect(a.clave.startsWith(`${a.tipo}.`)).toBe(true);
      }
    });

    it("está ordenado por clave: el mismo repo da siempre la misma carga", () => {
      expect(claves()).toEqual([...claves()].sort());
      expect(JSON.stringify(construirAfirmaciones(entrada))).toBe(
        JSON.stringify(resultado)
      );
    });

    it("cubre los siete tipos", () => {
      const tipos = new Set(resultado.afirmaciones.map((a) => a.tipo));
      expect([...tipos].sort()).toEqual([
        "comparativa",
        "funcion",
        "limite",
        "pagina",
        "precio",
        "prohibida",
        "sector",
      ]);
    });

    it("pasa el esquema del servidor, que es lo que importa", () => {
      const forma = SincronizarBody.safeParse({
        commitSha: "a".repeat(40),
        afirmaciones: resultado.afirmaciones,
        competidores: resultado.competidores,
        nichos: resultado.nichos,
        paginas: resultado.paginas,
      });
      expect(forma.success).toBe(true);
    });

    it("toda afirmación cita una ruta real del repo (con ancla)", () => {
      for (const a of resultado.afirmaciones) {
        const ruta = a.fuente.split("#")[0];
        expect(existsSync(join(RAIZ, ruta)), `${a.clave} → ${a.fuente}`).toBe(
          true
        );
        expect(a.fuente).toMatch(/^[A-Za-z0-9_./@-]+(#[A-Za-z0-9_.:@-]+)?$/);
      }
      for (const ruta of resultado.fuentes) {
        expect(existsSync(join(RAIZ, ruta)), ruta).toBe(true);
      }
    });

    it("ningún texto de lo que se afirma contiene un término de la lista de prohibidos", () => {
      const terminos = resultado.afirmaciones
        .filter((a) => a.tipo === "prohibida")
        .flatMap((a) => (a.valor as { terminos: string[] }).terminos);
      expect(terminos).toContain("Telnyx");
      for (const a of resultado.afirmaciones.filter((x) =>
        ["precio", "funcion", "sector", "comparativa", "pagina"].includes(
          x.tipo
        )
      )) {
        for (const termino of terminos) {
          expect(
            mencionaPalabra(a.texto, termino),
            `${a.clave} usa «${termino}»`
          ).toBe(false);
        }
      }
    });
  });

  describe("precios", () => {
    it("salen de plans.ts, con IVA aparte y sin el precio de fundador", () => {
      expect(de("precio.plan.pro").texto).toBe(
        "Plan Pro: 139 € + IVA al mes, 600 minutos incluidos y 0,25 € + IVA por minuto adicional."
      );
      expect(de("precio.plan.scale").texto).toContain("1.500 minutos");
      expect(de("precio.plan.inicio").valor).toEqual({
        plan: "inicio",
        cuotaEur: 59,
        minutosIncluidos: 200,
        minutoExtraEur: 0.3,
        ivaIncluido: false,
      });
      expect(claves().filter((c) => c.startsWith("precio.fundador"))).toEqual(
        []
      );
      expect(JSON.stringify(resultado.afirmaciones)).not.toMatch(
        /founder|fundador/i
      );
    });
  });

  describe("funciones y límites por plan", () => {
    it("los planes de cada función salen del gating, no del texto de la web", () => {
      expect(de("funcion.recordatorios_cita").valor).toEqual({
        feature: "recordatorios_cita",
        planes: ["pro", "scale"],
      });
      expect(de("funcion.recordatorios_cita").texto).toMatch(
        /Disponible en los planes Pro y Scale\.$/
      );
      expect(de("funcion.analitica_avanzada").valor).toMatchObject({
        planes: ["scale"],
      });
      expect(de("funcion.analitica_avanzada").texto).toMatch(
        /Disponible en el plan Scale\.$/
      );
    });

    it("NUNCA se afirma multi_sede, aunque PLAN_FEATURES la tenga en Scale", () => {
      expect(JSON.stringify(resultado.afirmaciones)).not.toMatch(
        /multi[_ -]?sede/i
      );
      expect(entrada.planFeatures.scale.features).toContain("multi_sede");
    });

    it("dice qué NO incluye cada plan (para que el borrador no prometa recordatorios en Inicio)", () => {
      expect(de("limite.plan.inicio.sin_recordatorios_cita").texto).toBe(
        "El plan Inicio no incluye recordatorios de cita por WhatsApp. Lo tienen los planes Pro y Scale."
      );
      expect(
        claves()
          .filter((c) => c.startsWith("limite.plan.inicio.sin_"))
          .sort()
      ).toEqual([
        "limite.plan.inicio.sin_analitica_avanzada",
        "limite.plan.inicio.sin_elegir_voz",
        "limite.plan.inicio.sin_recordatorios_cita",
        "limite.plan.inicio.sin_resumen_semanal",
      ]);
      expect(
        claves().filter((c) => c.startsWith("limite.plan.scale.sin_"))
      ).toEqual([]);
    });

    it("los profesionales de cada plan salen de planFeatures.ts", () => {
      expect(de("limite.plan.inicio.profesionales").texto).toContain("hasta 3");
      expect(de("limite.plan.pro.profesionales").texto).toContain("hasta 10");
      expect(de("limite.plan.scale.profesionales").texto).toBe(
        "El plan Scale no limita el número de profesionales."
      );
    });
  });

  describe("PRODUCT.md", () => {
    it("el proveedor se saca del texto: el bullet del número lo nombra y la afirmación no", () => {
      expect(
        entrada.productMd.bullets.some((b) => /Telnyx/.test(b.texto))
      ).toBe(true);
      expect(de("funcion.numero_de_espana").texto).not.toMatch(/Telnyx/i);
    });

    it("no se ingiere el recordatorio sin plan ni la lista de espera", () => {
      expect(claves()).not.toContain("funcion.lista_de_espera");
      expect(
        JSON.stringify(
          resultado.afirmaciones.filter((a) => a.tipo === "funcion")
        )
      ).not.toMatch(/lista de espera/i);
    });

    it("las afirmaciones de PRODUCT.md llevan la huella de su bullet y ningún número de línea", () => {
      const valor = de("funcion.registro_de_llamadas").valor as Record<
        string,
        unknown
      >;
      expect(valor.huellaOrigen).toMatch(/^[0-9a-f]{12}$/);
      expect(de("funcion.registro_de_llamadas").fuente).toBe(
        "PRODUCT.md#capacidades-confirmadas"
      );
      expect(JSON.stringify(de("funcion.registro_de_llamadas"))).not.toMatch(
        /línea|linea|:\d+/
      );
    });

    it("las limitaciones de primera clase están, con su estado cuando no hay decisión", () => {
      expect(claves()).toEqual(
        expect.arrayContaining([
          "limite.prelanzamiento",
          "limite.sin_prueba_social.testimonios",
          "limite.sin_prueba_social.clientes",
          "limite.sin_prueba_social.metricas",
          "limite.sin_prueba_social.premios_y_prensa",
          "limite.sin_multiusuario",
          "limite.sin_objetivos_de_rendimiento",
          "limite.asistente.reabrir_dia_cerrado",
          "limite.sector.fisioterapia.datos_de_salud",
        ])
      );
      expect(de("limite.sin_multiusuario").valor).toMatchObject({
        estado: "sin_decidir",
      });
      expect(de("limite.sin_objetivos_de_rendimiento").valor).toMatchObject({
        estado: "sin_decidir",
      });
    });
  });

  describe("comparativas", () => {
    it("llevan el dominio del competidor, la fecha de consulta y las fuentes (art. 10 de la Ley 3/1991)", () => {
      const c = de("comparativa.vapi.precio");
      expect(c.valor).toMatchObject({
        plataforma: "Vapi",
        competidorDominio: "vapi.ai",
        consultadaEn: "2026-10-29",
        campo: "precio",
      });
      expect(
        (c.valor as { fuentes: unknown[] }).fuentes.length
      ).toBeGreaterThanOrEqual(2);
      expect(c.texto).toMatch(
        /según su web, consultada el 29 de octubre de 2026\)\.$/
      );
    });

    it("hay tres afirmaciones por plataforma y una competidora por cada una, más HeyDiga y fonio (sin comparativa)", () => {
      expect(claves().filter((c) => c.startsWith("comparativa."))).toHaveLength(
        21
      );
      expect(resultado.competidores.map((c) => c.dominio).sort()).toEqual([
        "bland.ai",
        "elevenlabs.io",
        "fonio.ai",
        "heydiga.ai",
        "poly.ai",
        "retellai.com",
        "synthflow.ai",
        "vapi.ai",
        "voiceflow.com",
      ]);
    });

    it("no hay una comparativa de Alhabla consigo misma: sería un atajo a la regla 3", () => {
      expect(
        claves().filter((c) => c.startsWith("comparativa.alhabla"))
      ).toEqual([]);
    });
  });

  describe("sectores y páginas", () => {
    it("ocho sectores, cada uno con su nicho y su ancla", () => {
      expect(claves().filter((c) => /^sector\.[a-z-]+$/.test(c))).toHaveLength(
        8
      );
      expect(resultado.nichos).toHaveLength(8);
      expect(de("sector.centro-de-estetica").fuente).toBe(
        "web/src/lib/sectores/centro-de-estetica.ts#centroDeEstetica"
      );
      expect(de("sector.fisioterapia").nichoSlug).toBe("fisioterapia");
    });

    it("las páginas son las 56 del registro más los artículos publicados", () => {
      const delRegistro = claves().filter(
        (c) => c.startsWith("pagina.") && !c.startsWith("pagina.blog.")
      );
      const delBlog = claves().filter((c) => c.startsWith("pagina.blog."));
      expect(delRegistro).toHaveLength(entrada.web.paginas.length);
      expect(delBlog).toHaveLength(
        entrada.articulos.filter((a) => !a.borrador).length
      );
      expect(claves()).toContain("pagina.inicio");
      expect(resultado.paginas).toHaveLength(
        delRegistro.length + delBlog.length
      );
    });

    it("la URL va en el valor, no en el texto", () => {
      const p = de("pagina.planes");
      expect(p.valor).toMatchObject({
        ruta: "/planes",
        url: "https://alhabla.ai/planes",
      });
      expect(p.texto).not.toMatch(/https?:/);
    });
  });

  describe("prohibidas", () => {
    it("salen del fichero de reglas, con palabrasEnteras, y sin los ambiguos", () => {
      const prohibidas = resultado.afirmaciones.filter(
        (a) => a.tipo === "prohibida"
      );
      expect(prohibidas.map((a) => a.clave)).toEqual(
        expect.arrayContaining([
          "prohibida.proveedores",
          "prohibida.agenda_real",
        ])
      );
      const todos = prohibidas.flatMap(
        (a) => (a.valor as { terminos: string[] }).terminos
      );
      for (const ambiguo of [
        "API",
        "modelo",
        "agente de voz",
        "el Gestor",
        "persona real",
      ]) {
        expect(todos).not.toContain(ambiguo);
      }
      for (const a of prohibidas) {
        expect((a.valor as { palabrasEnteras: boolean }).palabrasEnteras).toBe(
          true
        );
      }
    });
  });

  // ── Lo que rompe la extracción ──────────────────────────────────────

  describe("falla cuando el repo cambia de forma que el mapa no cubre", () => {
    it("un bullet nuevo en PRODUCT.md sin entrada en el mapa", () => {
      const rota = copia(entrada);
      rota.productMd = parsearProductMd(
        [
          "## Capabilities and Constraints",
          "**Capacidades confirmadas**",
          "- Una capacidad nueva que nadie ha mapeado.",
        ].join("\n")
      );
      const problemas = problemasDe(rota);
      expect(problemas.join("\n")).toMatch(
        /sin entrada en mcp\/growth\/conocimiento\/mapa\.ts/
      );
      expect(problemas.join("\n")).toMatch(/Una capacidad nueva/);
    });

    it("un bullet añadido al PRODUCT.md real", () => {
      const rota = copia(entrada);
      const ultimo = rota.productMd.bullets
        .filter((b) => b.grupo === "Restricciones duras")
        .at(-1)!;
      rota.productMd.bullets.push({
        ...ultimo,
        linea: ultimo.linea + 1,
        texto: "Nuevo límite sin mapear.",
      });
      expect(problemasDe(rota).join("\n")).toMatch(/Nuevo límite sin mapear/);
    });

    it("un bullet que el mapa esperaba y se retiró", () => {
      const rota = copia(entrada);
      rota.productMd.bullets = rota.productMd.bullets.filter(
        (b) => !/^Registro de llamadas/.test(b.texto)
      );
      expect(problemasDe(rota).join("\n")).toMatch(
        /\^Registro de llamadas\/.*ya no encuentra su texto en PRODUCT\.md/
      );
    });

    it("un encabezado renombrado: los bullets quedan sin grupo y nada se ignora en silencio", () => {
      const rota = copia(entrada);
      for (const b of rota.productMd.bullets) {
        if (b.grupo === "Restricciones duras") b.grupo = "Restricciones";
      }
      const problemas = problemasDe(rota);
      expect(problemas.length).toBeGreaterThan(3);
      expect(problemas.join("\n")).toMatch(/«Restricciones»/);
    });

    it("una función nueva en plans.ts sin entrada", () => {
      const rota = copia(entrada);
      rota.web.plans[1].features.push("Soporte prioritario 24 horas");
      expect(problemasDe(rota).join("\n")).toMatch(
        /plan pro: el texto «Soporte prioritario 24 horas» no tiene entrada/
      );
    });

    it("una función en planFeatures.ts que ni plans.ts anuncia ni está excluida", () => {
      const rota = copia(entrada);
      rota.planFeatures.scale.features = [
        ...rota.planFeatures.scale.features,
        "api_publica",
      ];
      expect(problemasDe(rota).join("\n")).toMatch(
        /función «api_publica» y ni plans\.ts la anuncia ni FEATURES_EXCLUIDAS la excluye/
      );
    });

    it("la web y el gating no coinciden en qué plan tiene una función", () => {
      const rota = copia(entrada);
      rota.planFeatures.pro.features = rota.planFeatures.pro.features.filter(
        (f) => f !== "recordatorios_cita"
      );
      expect(problemasDe(rota).join("\n")).toMatch(
        /recordatorios_cita.*empieza en scale/
      );
    });

    it("el precio de plans.ts no coincide con PRODUCT.md", () => {
      const rota = copia(entrada);
      rota.web.plans[1].price = 149;
      expect(problemasDe(rota).join("\n")).toMatch(
        /Precio del plan pro: PRODUCT\.md/
      );
    });

    it("los minutos de plans.ts no coinciden con el catálogo de facturación", () => {
      const rota = copia(entrada);
      rota.billing.pro.includedMinutes = 700;
      expect(problemasDe(rota).join("\n")).toMatch(
        /Minutos del plan pro: backend\/src\/modules\/billing\/catalog\.ts dice 700/
      );
    });

    it("el minuto extra no coincide con el catálogo de facturación", () => {
      const rota = copia(entrada);
      rota.billing.inicio.extraMinuteCents = 35;
      expect(problemasDe(rota).join("\n")).toMatch(
        /Minuto extra del plan inicio/
      );
    });

    it("los profesionales de plans.ts y de planFeatures.ts no coinciden", () => {
      const rota = copia(entrada);
      rota.planFeatures.inicio.maxProfessionals = 5;
      expect(problemasDe(rota).join("\n")).toMatch(
        /Profesionales del plan inicio/
      );
    });

    it("una plataforma del resumen sin fuentes", () => {
      const rota = copia(entrada);
      rota.web.comparativas.fuentes = rota.web.comparativas.fuentes.filter(
        (f) => !f.nombre.startsWith("Vapi:")
      );
      expect(problemasDe(rota).join("\n")).toMatch(
        /Vapi sale en RESUMEN_PLATAFORMAS y no tiene ninguna fuente/
      );
    });

    it("las fuentes de una plataforma en dominios distintos: el competidor sería ambiguo", () => {
      const rota = copia(entrada);
      rota.web.comparativas.fuentes.push({
        nombre: "Vapi: otra",
        url: "https://otra-cosa.com/x",
      });
      expect(problemasDe(rota).join("\n")).toMatch(/más de un dominio/);
    });

    it("una fecha de consulta que no es una fecha", () => {
      const rota = copia(entrada);
      rota.web.comparativas.consultadas = "ayer";
      expect(problemasDe(rota).join("\n")).toMatch(
        /CONSULTADAS .* no es una fecha/
      );
    });

    it("un artículo con un sector que no existe", () => {
      const rota = copia(entrada);
      rota.articulos[0].sector = "taxidermia";
      expect(problemasDe(rota).join("\n")).toMatch(/sector «taxidermia»/);
    });

    it("un texto de lo que se afirma con un término prohibido", () => {
      const rota = copia(entrada);
      rota.web.paginas[1].resumen =
        "Nuestra recepcionista virtual contesta 24/7.";
      const problemas = problemasDe(rota).join("\n");
      expect(problemas).toMatch(
        /usa un término prohibido \(recepcionista virtual, 24\/7\)/
      );
    });

    it("un término que PRODUCT.md prohíbe y el fichero de reglas ignora", () => {
      const rota = copia(entrada);
      rota.reglas.descartados = rota.reglas.descartados.filter(
        (d) => d.termino !== "API"
      );
      expect(problemasDe(rota).join("\n")).toMatch(
        /PRODUCT\.md prohíbe «API» y .* no lo tiene/
      );
    });

    it("un sector sin su export (el ancla no existiría)", () => {
      const rota = copia(entrada);
      delete rota.exportsDeSectores.peluqueria;
      expect(problemasDe(rota).join("\n")).toMatch(
        /export const» del sector peluqueria/
      );
    });

    it("una afirmación que el servidor rechazaría (texto vacío) se rechaza antes de mandarla", () => {
      const rota = copia(entrada);
      rota.web.sectores[0].descripcion = "";
      expect(problemasDe(rota).join("\n")).toMatch(
        /no pasa el esquema del servidor/
      );
    });

    it("cuenta todos los problemas, no solo el primero", () => {
      const rota = copia(entrada);
      rota.web.plans[1].price = 149;
      rota.billing.pro.includedMinutes = 700;
      rota.articulos[0].sector = "taxidermia";
      expect(problemasDe(rota).length).toBeGreaterThanOrEqual(3);
    });
  });
});
