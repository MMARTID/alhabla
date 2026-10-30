import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SincronizarBody } from "../../../src/modules/growth/esquemas.js";

/**
 * Revisión 1b (informes de conocimiento A1, backend B7 y M2): lo que un token
 * con alcance `conocimiento` NO puede hacer con las reglas duras, y la carrera
 * entre el sincronizador y aprobar. Base de datos en memoria: se comprueba el
 * estado final, no las llamadas.
 */

type Fila = Record<string, unknown>;

const { baseEnMemoria, prismaMock } = await vi.hoisted(async () => {
  const { vi } = await import("vitest");
  const tablas = {
    afirmaciones: [] as Fila[],
    borradores: [] as Fila[],
    oportunidades: [] as Fila[],
    revisiones: [] as Fila[],
    decisiones: [] as Fila[],
    ajustes: [] as Fila[],
    competidores: [] as Fila[],
    nichos: [] as Fila[],
    paginas: [] as Fila[],
  };
  let secuencia = 0;
  const nuevoId = () => `id_${++secuencia}`;

  const coincide = (fila: Fila, donde: Fila | undefined): boolean => {
    if (!donde) return true;
    return Object.entries(donde).every(([campo, esperado]) => {
      const valor = fila[campo];
      if (esperado === null) return valor === null || valor === undefined;
      if (
        esperado &&
        typeof esperado === "object" &&
        !(esperado instanceof Date)
      ) {
        const e = esperado as Fila;
        if ("in" in e) return (e.in as unknown[]).includes(valor);
        if ("hasSome" in e) {
          return (e.hasSome as unknown[]).some((x) =>
            (valor as unknown[]).includes(x)
          );
        }
        return false;
      }
      return valor === esperado;
    });
  };

  const modelo = (tabla: Fila[]) => ({
    findMany: vi.fn(async (args: { where?: Fila } = {}) =>
      tabla.filter((f) => coincide(f, args.where)).map((f) => ({ ...f }))
    ),
    createMany: vi.fn(async ({ data }: { data: Fila[] }) => {
      for (const d of data) {
        tabla.push({ id: nuevoId(), vigenteHasta: null, ...d });
      }
      return { count: data.length };
    }),
    updateMany: vi.fn(async ({ where, data }: { where: Fila; data: Fila }) => {
      const filas = tabla.filter((f) => coincide(f, where));
      for (const f of filas) Object.assign(f, data);
      return { count: filas.length };
    }),
    create: vi.fn(async ({ data }: { data: Fila }) => {
      const fila = { id: nuevoId(), ...data };
      tabla.push(fila);
      return fila;
    }),
  });

  const borradores = modelo(tablas.borradores);
  borradores.findMany.mockImplementation(async (args: { where?: Fila } = {}) =>
    tablas.borradores
      .filter((f) => coincide(f, args.where))
      .map((f) => ({
        ...f,
        oportunidad: tablas.oportunidades
          .filter((o) => o.id === f.oportunidadId)
          .map((o) => ({ id: o.id, estado: o.estado }))[0],
      }))
  );

  const prisma = {
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async (..._args: unknown[]): Promise<unknown[]> => []),
    growthAfirmacion: {
      ...modelo(tablas.afirmaciones),
      groupBy: vi.fn(async ({ where }: { where: Fila }) => {
        const conteo = new Map<string, number>();
        for (const f of tablas.afirmaciones.filter((x) => coincide(x, where))) {
          conteo.set(f.tipo as string, (conteo.get(f.tipo as string) ?? 0) + 1);
        }
        return [...conteo].map(([tipo, n]) => ({ tipo, _count: { _all: n } }));
      }),
    },
    growthBorrador: borradores,
    growthOportunidad: modelo(tablas.oportunidades),
    growthRevisionCumplimiento: modelo(tablas.revisiones),
    growthDecision: modelo(tablas.decisiones),
    growthCompetidor: modelo(tablas.competidores),
    growthNicho: modelo(tablas.nichos),
    growthPagina: {
      ...modelo(tablas.paginas),
      update: vi.fn(),
    },
    growthAjuste: {
      findUnique: vi.fn(async ({ where }: { where: { clave: string } }) => {
        const fila = tablas.ajustes.find((a) => a.clave === where.clave);
        return fila ? { ...fila } : null;
      }),
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { clave: string };
          create: Fila;
          update: Fila;
        }) => {
          const fila = tablas.ajustes.find((a) => a.clave === where.clave);
          if (fila) Object.assign(fila, update, { actualizadoEn: new Date() });
          else tablas.ajustes.push({ ...create, actualizadoEn: new Date() });
        }
      ),
    },
  };
  return { baseEnMemoria: tablas, prismaMock: prisma };
});

vi.mock("../../../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const { sincronizarConocimiento } =
  await import("../../../src/modules/growth/conocimiento/sincronizar.js");

const COMMIT_1 = "1".repeat(40);
const COMMIT_2 = "2".repeat(40);
const AGENTE = { nombre: "conocimiento-semanal" };
const AHORA = new Date("2026-10-30T08:00:00Z");

const REGLAS = [
  ["proveedores", ["Telnyx", "Soniox"]],
  ["jerga", ["webhook", "LLM", "orquestador"]],
  ["agenda_real", ["agenda real", "calendario real"]],
  ["promesas", ["24/7", "llenar la agenda"]],
  ["denominaciones", ["recepcionista virtual"]],
] as const;

function prohibida(clave: string, terminos: readonly string[], enteras = true) {
  return {
    clave: `prohibida.${clave}`,
    tipo: "prohibida" as const,
    texto: `No se dice: ${terminos.join("; ")}.`,
    valor: { terminos: [...terminos], palabrasEnteras: enteras },
    fuente: `growth/agentes/reglas/afirmaciones-prohibidas.md#${clave}`,
  };
}

/** Una base parecida a la real: 5 prohibidas, 8 funciones, 10 precios… */
function loteCompleto(cambios: Partial<SincronizarBody> = {}): SincronizarBody {
  return {
    commitSha: COMMIT_1,
    afirmaciones: [
      ...REGLAS.map(([c, t]) => prohibida(c, t)),
      ...Array.from({ length: 8 }, (_, i) => ({
        clave: `funcion.f${i}`,
        tipo: "funcion" as const,
        texto: `Función número ${i}.`,
        fuente: "PRODUCT.md#capacidades-confirmadas",
      })),
      ...Array.from({ length: 10 }, (_, i) => ({
        clave: `precio.p${i}`,
        tipo: "precio" as const,
        texto: `Precio número ${i}.`,
        fuente: "web/src/lib/plans.ts#plans",
      })),
    ],
    ...cambios,
  };
}

function sincronizar(
  body: SincronizarBody,
  opciones: Partial<Parameters<typeof sincronizarConocimiento>[1]> = {}
) {
  return sincronizarConocimiento(body, {
    agente: AGENTE,
    ahora: AHORA,
    ...opciones,
  });
}

const vigentes = () =>
  baseEnMemoria.afirmaciones.filter((a) => a.vigenteHasta === null);

function terminosVigentes(): string[] {
  return vigentes()
    .filter((a) => a.tipo === "prohibida")
    .flatMap((a) => (a.valor as { terminos: string[] }).terminos);
}

function escrituras() {
  return [
    prismaMock.growthAfirmacion.createMany,
    prismaMock.growthAfirmacion.updateMany,
    prismaMock.growthBorrador.updateMany,
    prismaMock.growthOportunidad.updateMany,
    prismaMock.growthRevisionCumplimiento.create,
    prismaMock.growthDecision.create,
  ].reduce((total, fn) => total + fn.mock.calls.length, 0);
}

function sembrarBorrador(cambios: Fila & { estadoOportunidad?: string } = {}) {
  const { estadoOportunidad, ...resto } = cambios;
  const oportunidadId = (resto.oportunidadId as string) ?? "op_1";
  if (!baseEnMemoria.oportunidades.some((o) => o.id === oportunidadId)) {
    baseEnMemoria.oportunidades.push({
      id: oportunidadId,
      estado: estadoOportunidad ?? "pendiente_aprobacion",
    });
  }
  const fila = {
    id: "bor_1",
    oportunidadId,
    estado: "pendiente_aprobacion",
    afirmaciones: ["precio.p1"],
    creadoEn: new Date("2026-10-20T00:00:00Z"),
    ...resto,
  };
  baseEnMemoria.borradores.push(fila);
  return fila;
}

describe("un token con alcance conocimiento no debilita las reglas duras", () => {
  beforeEach(async () => {
    for (const tabla of Object.values(baseEnMemoria)) tabla.length = 0;
    vi.clearAllMocks();
    prismaMock.$queryRaw.mockImplementation(async () => []);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await sincronizar(loteCompleto());
    vi.clearAllMocks();
  });

  describe("prohibida solo se puede añadir", () => {
    it("un lote con UNA sola prohibida (cierra las otras cuatro) responde 409 prohibida_debilitada y no escribe nada", async () => {
      const antes = terminosVigentes();
      expect(antes).toContain("Telnyx");

      const soloUna = {
        commitSha: COMMIT_2,
        afirmaciones: [prohibida("jerga", ["webhook", "LLM", "orquestador"])],
      } as SincronizarBody;
      const error = await sincronizar(soloUna).catch((e) => e);

      expect(error).toMatchObject({
        status: 409,
        codigo: "prohibida_debilitada",
      });
      expect(error.message).toMatch(/administrador/);
      expect(error.extra.prohibidas.map((p: Fila) => p.clave).sort()).toEqual([
        "prohibida.agenda_real",
        "prohibida.denominaciones",
        "prohibida.promesas",
        "prohibida.proveedores",
      ]);
      expect(error.extra.prohibidas[0]).toMatchObject({ motivo: "retirada" });
      expect(escrituras()).toBe(0);
      expect(terminosVigentes()).toEqual(antes);
    });

    it("cambiar los términos de prohibida.proveedores a ['xyzzy'] responde 409 y dice qué términos se perderían", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      const i = l.afirmaciones.findIndex(
        (a) => a.clave === "prohibida.proveedores"
      );
      l.afirmaciones[i] = prohibida("proveedores", ["xyzzy"]);

      const error = await sincronizar(l).catch((e) => e);
      expect(error).toMatchObject({
        status: 409,
        codigo: "prohibida_debilitada",
      });
      expect(error.extra.prohibidas).toEqual([
        {
          clave: "prohibida.proveedores",
          motivo: "terminos_quitados",
          terminos: ["Telnyx", "Soniox"],
        },
      ]);
      expect(error.message).toContain("prohibida.proveedores");
      expect(error.message).toContain("Telnyx");
      expect(escrituras()).toBe(0);
      expect(terminosVigentes()).toContain("Telnyx");
    });

    it("quitar solo uno de varios términos también es debilitar", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      const i = l.afirmaciones.findIndex((a) => a.clave === "prohibida.jerga");
      l.afirmaciones[i] = prohibida("jerga", ["webhook", "LLM"]);
      await expect(sincronizar(l)).rejects.toMatchObject({
        codigo: "prohibida_debilitada",
        extra: {
          prohibidas: [
            {
              clave: "prohibida.jerga",
              motivo: "terminos_quitados",
              terminos: ["orquestador"],
            },
          ],
        },
      });
    });

    it("pasar palabrasEnteras de true a false responde 409", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      const i = l.afirmaciones.findIndex(
        (a) => a.clave === "prohibida.agenda_real"
      );
      l.afirmaciones[i] = prohibida(
        "agenda_real",
        ["agenda real", "calendario real"],
        false
      );
      const error = await sincronizar(l).catch((e) => e);
      expect(error).toMatchObject({ codigo: "prohibida_debilitada" });
      expect(error.extra.prohibidas[0]).toMatchObject({
        clave: "prohibida.agenda_real",
        motivo: "palabras_enteras",
      });
    });

    it("endurecer sí se permite: una prohibida nueva y un término más", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      const i = l.afirmaciones.findIndex(
        (a) => a.clave === "prohibida.proveedores"
      );
      l.afirmaciones[i] = prohibida("proveedores", [
        "Telnyx",
        "Soniox",
        "Deepgram",
      ]);
      l.afirmaciones.push(prohibida("nueva", ["frase nueva"]));

      const r = await sincronizar(l);
      expect(r.aplicable).toBe(true);
      expect(r.prohibidasDebilitadas).toEqual([]);
      expect(terminosVigentes()).toEqual(
        expect.arrayContaining(["Deepgram", "frase nueva", "Telnyx"])
      );
    });

    it("la simulación no falla: dice que no es aplicable y qué se debilitaría, sin escribir", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      l.afirmaciones = l.afirmaciones.filter(
        (a) => a.clave !== "prohibida.proveedores"
      );
      const r = await sincronizar(l, { simular: true });
      expect(r.aplicable).toBe(false);
      expect(r.motivoNoAplicable).toMatch(/prohibida.proveedores/);
      expect(r.prohibidasDebilitadas).toEqual([
        {
          clave: "prohibida.proveedores",
          motivo: "retirada",
          terminos: ["Telnyx", "Soniox"],
        },
      ]);
      expect(escrituras()).toBe(0);
    });

    it("forzarCierres (solo un administrador, sin ruta hoy) sí lo aplica", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      const i = l.afirmaciones.findIndex(
        (a) => a.clave === "prohibida.proveedores"
      );
      l.afirmaciones[i] = prohibida("proveedores", ["xyzzy"]);
      const r = await sincronizar(l, { forzarCierres: true });
      expect(r.aplicable).toBe(true);
      expect(terminosVigentes()).toContain("xyzzy");
      expect(terminosVigentes()).not.toContain("Telnyx");
    });
  });

  describe("el cierre masivo se mide por tipo", () => {
    it("retirar 3 funciones de 8 (el 37 %) es un cierre masivo aunque sea el 10 % de la base", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      l.afirmaciones = l.afirmaciones.filter(
        (a) => !["funcion.f0", "funcion.f1", "funcion.f2"].includes(a.clave)
      );
      const error = await sincronizar(l).catch((e) => e);
      expect(error).toMatchObject({ status: 409, codigo: "cierres_masivos" });
      expect(error.extra.porTipo).toContainEqual({
        tipo: "funcion",
        vigentes: 8,
        cierres: 3,
        modificadas: 0,
      });
      expect(error.message).toMatch(/administrador/);
      expect(escrituras()).toBe(0);
    });

    it("retirar 1 de 8 funciones pasa (12 %)", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      l.afirmaciones = l.afirmaciones.filter((a) => a.clave !== "funcion.f0");
      const r = await sincronizar(l);
      expect(r.retiradas).toEqual(["funcion.f0"]);
    });

    it("retirar 3 precios de 10 (más de dos) es masivo; 2 de 10 pasa", async () => {
      const sin = (n: number) => {
        const l = loteCompleto({ commitSha: COMMIT_2 });
        const fuera = new Set(
          Array.from({ length: n }, (_, i) => `precio.p${i}`)
        );
        l.afirmaciones = l.afirmaciones.filter((a) => !fuera.has(a.clave));
        return l;
      };
      await expect(sincronizar(sin(3))).rejects.toMatchObject({
        codigo: "cierres_masivos",
      });
      await expect(sincronizar(sin(2))).resolves.toMatchObject({
        aplicable: true,
      });
    });

    it("un tipo vaciado en el repo (se manda `tipos`, pero no trae ni una función) se rechaza con un mensaje claro", async () => {
      const l = loteCompleto({
        commitSha: COMMIT_2,
        tipos: ["precio", "funcion", "prohibida"],
      });
      l.afirmaciones = l.afirmaciones.filter((a) => a.tipo !== "funcion");
      const error = await sincronizar(l).catch((e) => e);
      expect(error).toMatchObject({ status: 409, codigo: "cierres_masivos" });
      expect(error.message).toMatch(
        /no trae ninguna afirmación de funcion y la base tiene vigentes de ese tipo/
      );
      expect(error.extra.tiposVaciados).toEqual(["funcion"]);
      expect(vigentes().filter((a) => a.tipo === "funcion")).toHaveLength(8);
    });

    it("sin `tipos`, el mismo lote NO se ve como vaciado (por eso el CLI y el MCP lo mandan siempre)", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      l.afirmaciones = l.afirmaciones.filter((a) => a.tipo !== "funcion");
      const r = await sincronizar(l);
      expect(r.retiradas).toEqual([]);
      expect(vigentes().filter((a) => a.tipo === "funcion")).toHaveLength(8);
    });

    it("reescribir casi toda la base de una pasada (modificaciones) es masivo; un cambio de precios no", async () => {
      // Una base con 60 páginas más: 83 vigentes.
      const grande = loteCompleto({ commitSha: COMMIT_2 });
      for (let i = 0; i < 60; i++) {
        grande.afirmaciones.push({
          clave: `pagina.p${i}`,
          tipo: "pagina",
          texto: `Página ${i}`,
          fuente: "web/src/lib/paginas.ts",
        });
      }
      await sincronizar(grande);
      vi.clearAllMocks();

      const roto = {
        ...grande,
        commitSha: "3".repeat(40),
        afirmaciones: grande.afirmaciones.map((a) =>
          a.tipo === "pagina" ? { ...a, texto: `${a.texto} (roto)` } : a
        ),
      };
      const error = await sincronizar(roto).catch((e) => e);
      expect(error).toMatchObject({ status: 409, codigo: "cierres_masivos" });
      expect(error.message).toMatch(/Se cambiarían 60 de 83/);
      expect(escrituras()).toBe(0);

      const precios = {
        ...grande,
        commitSha: "4".repeat(40),
        afirmaciones: grande.afirmaciones.map((a) =>
          a.tipo === "precio" ? { ...a, texto: `${a.texto} (nuevo)` } : a
        ),
      };
      await expect(sincronizar(precios)).resolves.toMatchObject({
        aplicable: true,
      });
    });
  });

  describe("términos prohibidos", () => {
    it("una función con Telnyx dentro de `valor` se rechaza con 400, no solo si lo dice el texto", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      l.afirmaciones.push({
        clave: "funcion.falsa_telnyx",
        tipo: "funcion",
        texto: "Una función inocente.",
        valor: { detalle: { nota: "Funciona con Telnyx" } },
        fuente: "PRODUCT.md#capacidades-confirmadas",
      });
      const error = await sincronizar(l).catch((e) => e);
      expect(error).toMatchObject({ status: 400, codigo: "termino_prohibido" });
      expect(error.extra.afirmaciones).toEqual([
        { clave: "funcion.falsa_telnyx", terminos: ["Telnyx"] },
      ]);
      expect(escrituras()).toBe(0);
    });

    it("una URL o una ruta en `valor` no cuenta (puede llevar «webhook» sin decirlo)", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      l.afirmaciones.push({
        clave: "pagina.docs",
        tipo: "pagina",
        texto: "Documentación",
        valor: { url: "https://ejemplo.com/webhook/guia", ruta: "/webhook" },
        fuente: "web/src/lib/paginas.ts#docs",
      });
      await expect(sincronizar(l)).resolves.toMatchObject({ aplicable: true });
    });

    it.each([
      ["invisibles", "Tel​nyx", /invisibles/],
      ["menos de tres caracteres tras normalizar", "ab́", /menos de 3/],
      ["solo marcas", "⃐⃐⃐⃐", /letras ni números/],
      ["solo signos", "-----", /letras ni números/],
      ["compatibilidad que queda corta", "ｘｙ", /menos de 3/],
    ])(
      "un término inservible (%s) se rechaza con 400",
      async (_n, termino, motivo) => {
        const l = loteCompleto({ commitSha: COMMIT_2 });
        l.afirmaciones.push(prohibida("trampa", [termino]));
        const error = await sincronizar(l).catch((e) => e);
        expect(error).toMatchObject({
          status: 400,
          codigo: "termino_prohibido_invalido",
        });
        expect(error.extra.terminos[0].motivo).toMatch(motivo);
        expect(escrituras()).toBe(0);
      }
    );

    it("un término normal, con tildes o espacios, vale", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      l.afirmaciones.push(prohibida("ok", ["Ventaja competitiva", "24/7"]));
      await expect(sincronizar(l)).resolves.toMatchObject({ aplicable: true });
    });
  });

  describe("el rastro de lo que cambió", () => {
    it("la decisión conocimiento_sincronizado lleva las claves retiradas y las modificadas, truncadas", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      // Una retirada y diez modificadas (más de las que caben en la lista).
      l.afirmaciones = l.afirmaciones
        .filter((a) => a.clave !== "funcion.f7")
        .map((a) =>
          a.tipo === "precio" ? { ...a, texto: `${a.texto} (nuevo)` } : a
        );
      await sincronizar(l);
      const motivo = String(baseEnMemoria.decisiones.at(-1)!.motivo);
      expect(motivo).toMatch(/^commit 2222222: \+0 ~10 -1\./);
      expect(motivo).toContain("Retiradas (1): funcion.f7.");
      expect(motivo).toMatch(/Modificadas \(10\): precio\.p0, precio\.p1/);
      expect(motivo).toMatch(/ y 4 más\./);
      expect(motivo.length).toBeLessThanOrEqual(900);
    });

    it("la decisión de bloqueo y la revisión dicen qué clave se retiró y cuál se modificó", async () => {
      sembrarBorrador({ afirmaciones: ["funcion.f7", "precio.p1"] });
      const l = loteCompleto({ commitSha: COMMIT_2 });
      l.afirmaciones = l.afirmaciones
        .filter((a) => a.clave !== "funcion.f7")
        .map((a) =>
          a.clave === "precio.p1" ? { ...a, texto: "Precio distinto." } : a
        );
      const r = await sincronizar(l);

      expect(r.borradoresBloqueados).toEqual([
        {
          borradorId: "bor_1",
          oportunidadId: "op_1",
          claves: ["funcion.f7", "precio.p1"],
        },
      ]);
      const bloqueo = baseEnMemoria.decisiones.find(
        (d) => d.accion === "bloquear_por_conocimiento"
      )!;
      expect(bloqueo.motivo).toContain("Retiradas (1): funcion.f7.");
      expect(bloqueo.motivo).toContain("Modificadas (1): precio.p1.");
      const comprobaciones = baseEnMemoria.revisiones[0]
        .comprobaciones as Fila[];
      expect(comprobaciones[0].detalle).toContain("funcion.f7");
      expect(comprobaciones[0].detalle).toContain("precio.p1");
    });
  });

  describe("carrera con aprobar", () => {
    it("un borrador aprobado entre la lectura y el cierre se bloquea igual, con su oportunidad", async () => {
      sembrarBorrador({ afirmaciones: ["precio.p1"] });
      // Cuando el sincronizador bloquea las filas, el fundador acaba de aprobar:
      // el estado que se leyó al principio («pendiente») ya no es el real.
      prismaMock.$queryRaw.mockImplementationOnce(async () => {
        baseEnMemoria.borradores[0].estado = "aprobado";
        baseEnMemoria.oportunidades[0].estado = "aprobada";
        return [];
      });
      const l = loteCompleto({ commitSha: COMMIT_2 });
      l.afirmaciones = l.afirmaciones.map((a) =>
        a.clave === "precio.p1" ? { ...a, texto: "Otro precio." } : a
      );

      const r = await sincronizar(l);

      expect(r.avisos).toEqual([]);
      expect(r.borradoresBloqueados).toHaveLength(1);
      expect(baseEnMemoria.borradores[0].estado).toBe("bloqueado");
      expect(baseEnMemoria.oportunidades[0].estado).toBe("bloqueada");
      expect(vigentes().find((a) => a.clave === "precio.p1")!.texto).toBe(
        "Otro precio."
      );
    });

    it("bloquea las filas antes de volver a leer: la oportunidad primero y después el borrador (el orden de aprobar)", async () => {
      sembrarBorrador({ afirmaciones: ["precio.p1"] });
      const orden: string[] = [];
      prismaMock.$queryRaw.mockImplementation(async (...args: unknown[]) => {
        orden.push(
          /growth_oportunidades/.test((args[0] as string[]).join(""))
            ? "oportunidades"
            : "borradores"
        );
        return [];
      });
      const l = loteCompleto({ commitSha: COMMIT_2 });
      l.afirmaciones = l.afirmaciones.map((a) =>
        a.clave === "precio.p1" ? { ...a, texto: "Otro precio." } : a
      );
      await sincronizar(l);
      expect(orden).toEqual(["oportunidades", "borradores"]);
      const lecturas =
        prismaMock.growthBorrador.findMany.mock.invocationCallOrder;
      const bloqueos = prismaMock.$queryRaw.mock.invocationCallOrder;
      // Una lectura antes de bloquear y otra después.
      expect(lecturas[0]).toBeLessThan(bloqueos[0]);
      expect(lecturas.at(-1)).toBeGreaterThan(bloqueos.at(-1)!);
    });

    it("sin borradores afectados no bloquea ninguna fila", async () => {
      const l = loteCompleto({ commitSha: COMMIT_2 });
      l.afirmaciones = l.afirmaciones.map((a) =>
        a.clave === "precio.p1" ? { ...a, texto: "Otro precio." } : a
      );
      await sincronizar(l);
      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    });

    it("la clave del cerrojo exclusivo del sincronizador sigue siendo growth_conocimiento", async () => {
      await sincronizar(loteCompleto({ commitSha: COMMIT_2 }));
      const [, clave] = prismaMock.$executeRaw.mock.calls[0] as unknown as [
        string[],
        string,
      ];
      expect(clave).toBe("growth_conocimiento");
    });
  });

  describe("cambios recientes del snapshot", () => {
    it("la primera sincronización no corta a 50: resume por tipo", async () => {
      for (const tabla of Object.values(baseEnMemoria)) tabla.length = 0;
      await sincronizar(loteCompleto());
      const snapshot = baseEnMemoria.ajustes[0].valor as {
        cambiosRecientes: {
          clave: string;
          cambio: string;
          cantidad?: number;
        }[];
      };
      // 23 altas caben: se enumeran. Con 60 ya no.
      expect(snapshot.cambiosRecientes).toHaveLength(23);

      for (const tabla of Object.values(baseEnMemoria)) tabla.length = 0;
      const grande = loteCompleto();
      for (let i = 0; i < 60; i++) {
        grande.afirmaciones.push({
          clave: `pagina.p${i}`,
          tipo: "pagina",
          texto: `Página ${i}`,
          fuente: "web/src/lib/paginas.ts",
        });
      }
      await sincronizar(grande);
      const resumen = (baseEnMemoria.ajustes[0].valor as typeof snapshot)
        .cambiosRecientes;
      expect(resumen).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            clave: "pagina.*",
            cambio: "alta",
            cantidad: 60,
          }),
          expect.objectContaining({
            clave: "funcion.*",
            cambio: "alta",
            cantidad: 8,
          }),
          expect.objectContaining({
            clave: "prohibida.*",
            cambio: "alta",
            cantidad: 5,
          }),
        ])
      );
      expect(resumen.reduce((total, c) => total + (c.cantidad ?? 1), 0)).toBe(
        83
      );
    });
  });
});
