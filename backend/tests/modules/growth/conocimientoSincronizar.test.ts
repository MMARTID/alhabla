import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SincronizarBody } from "../../../src/modules/growth/esquemas.js";
import { ErrorDeGrowth } from "../../../src/modules/growth/service.js";

/**
 * La sincronización contra una base de datos EN MEMORIA, no contra un mock de
 * cada llamada: lo que importa (que dos pasadas iguales no cambien nada, que no
 * haya dos vigentes de la misma clave, que se bloqueen los borradores justos)
 * se comprueba mirando el estado final, no qué métodos se llamaron.
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
        if ("startsWith" in e)
          return String(valor).startsWith(String(e.startsWith));
        return false;
      }
      return valor === esperado;
    });
  };

  const modelo = (tabla: Fila[], opciones: { prefijo?: string } = {}) => ({
    findMany: vi.fn(async (args: { where?: Fila; select?: Fila } = {}) =>
      tabla.filter((f) => coincide(f, args.where)).map((f) => ({ ...f }))
    ),
    createMany: vi.fn(
      async ({ data }: { data: Fila[]; skipDuplicates?: boolean }) => {
        for (const d of data) {
          tabla.push({
            id: nuevoId(),
            vigenteHasta: null,
            ...d,
          });
        }
        return { count: data.length };
      }
    ),
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
    _prefijo: opciones.prefijo,
  });

  const afirmaciones = modelo(tablas.afirmaciones);
  const borradores = modelo(tablas.borradores);
  // El borrador trae su oportunidad como en la consulta real.
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
    // Los `SELECT … FOR UPDATE` del bloqueo de borradores: sin efecto aquí.
    $queryRaw: vi.fn(async () => []),
    growthAfirmacion: {
      ...afirmaciones,
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
      update: vi.fn(async ({ where, data }: { where: Fila; data: Fila }) => {
        const fila = tablas.paginas.find((p) => p.ruta === where.ruta)!;
        Object.assign(fila, data);
        return fila;
      }),
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
  return { baseEnMemoria: tablas, prismaMock: prisma, nuevoId };
});

vi.mock("../../../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const {
  sincronizarConocimiento,
  afirmacionesConTerminosProhibidos,
  CLAVE_DEL_CERROJO_DE_CONOCIMIENTO,
} = await import("../../../src/modules/growth/conocimiento/sincronizar.js");

const COMMIT_1 = "1".repeat(40);
const COMMIT_2 = "2".repeat(40);
const AGENTE = { nombre: "conocimiento-semanal" };
const AHORA = new Date("2026-10-30T08:00:00Z");

function lote(cambios: Partial<SincronizarBody> = {}): SincronizarBody {
  return {
    commitSha: COMMIT_1,
    afirmaciones: [
      {
        clave: "precio.plan.pro",
        tipo: "precio",
        texto: "Plan Pro: 139 € + IVA al mes, 600 minutos incluidos.",
        valor: { cuotaEur: 139 },
        fuente: "web/src/lib/plans.ts#plans-pro",
      },
      {
        clave: "funcion.registro_de_llamadas",
        tipo: "funcion",
        texto: "Registro de llamadas con transcripción y grabación.",
        valor: { huellaOrigen: "abc123abc123" },
        fuente: "PRODUCT.md#capacidades-confirmadas",
      },
      {
        clave: "limite.sin_prueba_social.testimonios",
        tipo: "limite",
        texto: "No existen testimonios ni casos de éxito de clientes.",
        fuente: "PRODUCT.md#ausencias",
      },
      {
        clave: "prohibida.proveedores",
        tipo: "prohibida",
        texto: "No se nombra a ningún proveedor.",
        valor: { terminos: ["Telnyx"], palabrasEnteras: true },
        fuente: "growth/agentes/reglas/afirmaciones-prohibidas.md#proveedores",
      },
    ],
    competidores: [{ nombre: "Retell AI", dominio: "retellai.com" }],
    nichos: [{ slug: "peluqueria", nombre: "Peluquerías" }],
    paginas: [
      {
        ruta: "/planes",
        nombre: "Planes y precios",
        seccion: "principal",
        actualizado: "2026-10-29T00:00:00Z",
      },
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

function vigentes() {
  return baseEnMemoria.afirmaciones.filter((a) => a.vigenteHasta === null);
}

function escrituras() {
  return [
    prismaMock.growthAfirmacion.createMany,
    prismaMock.growthAfirmacion.updateMany,
    prismaMock.growthBorrador.updateMany,
    prismaMock.growthOportunidad.updateMany,
    prismaMock.growthRevisionCumplimiento.create,
    prismaMock.growthDecision.create,
    prismaMock.growthCompetidor.createMany,
    prismaMock.growthNicho.createMany,
    prismaMock.growthPagina.createMany,
    prismaMock.growthPagina.update,
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
    afirmaciones: ["precio.plan.pro"],
    creadoEn: new Date("2026-10-20T00:00:00Z"),
    ...resto,
  };
  baseEnMemoria.borradores.push(fila);
  return fila;
}

describe("sincronizarConocimiento", () => {
  beforeEach(() => {
    for (const tabla of Object.values(baseEnMemoria)) tabla.length = 0;
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("la primera sincronización", () => {
    it("crea las afirmaciones, siembra competidores, nichos y páginas y guarda el snapshot", async () => {
      const r = await sincronizar(lote());

      expect(r.sinCambios).toBe(false);
      // Mismos datos con los nombres del contrato de la API.
      expect(r.altas).toEqual(r.nuevas);
      expect(r.cierres).toEqual(r.retiradas);
      expect(r.actualizadasEnSitio).toBe(0);
      expect(r.snapshot).toMatchObject({
        commitSha: COMMIT_1,
        vigentes: 4,
        antiguedadHoras: 0,
        obsoleto: false,
        porTipo: { precio: 1, funcion: 1, limite: 1, prohibida: 1 },
      });
      expect(r.nuevas.sort()).toEqual([
        "funcion.registro_de_llamadas",
        "limite.sin_prueba_social.testimonios",
        "precio.plan.pro",
        "prohibida.proveedores",
      ]);
      expect(r.competidoresNuevos).toEqual(["retellai.com"]);
      expect(r.nichosNuevos).toEqual(["peluqueria"]);
      expect(r.paginasNuevas).toEqual(["/planes"]);
      expect(vigentes()).toHaveLength(4);
      expect(vigentes().every((a) => a.commitSha === COMMIT_1)).toBe(true);
      expect(vigentes().every((a) => a.vigenteDesde === AHORA)).toBe(true);
      expect(baseEnMemoria.nichos[0]).toMatchObject({
        slug: "peluqueria",
        estado: "activo",
        origen: "web_sectores",
      });
      expect(baseEnMemoria.paginas[0]).toMatchObject({
        ruta: "/planes",
        nichoSlug: null,
      });

      const snapshot = baseEnMemoria.ajustes[0];
      expect(snapshot.clave).toBe("sistema.conocimiento");
      expect(snapshot.valor).toMatchObject({
        commitSha: COMMIT_1,
        vigentes: 4,
        porTipo: { precio: 1, funcion: 1, limite: 1, prohibida: 1 },
        sincronizadoPor: "agente:conocimiento-semanal",
        previo: null,
      });
      expect(baseEnMemoria.decisiones).toHaveLength(1);
      expect(baseEnMemoria.decisiones[0]).toMatchObject({
        accion: "conocimiento_sincronizado",
        por: "agente:conocimiento-semanal",
      });
      expect(baseEnMemoria.decisiones[0].motivo).toBe(
        "commit 1111111: +4 ~0 -0"
      );
    });

    it("toma el cerrojo asesor antes de leer nada y todo va en una sola transacción", async () => {
      await sincronizar(lote());
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
      const [plantilla, clave] = prismaMock.$executeRaw.mock
        .calls[0] as unknown as [string[], string];
      expect(plantilla.join("?")).toMatch(
        /pg_advisory_xact_lock\(hashtext\(\?\)\)/
      );
      expect(clave).toBe(CLAVE_DEL_CERROJO_DE_CONOCIMIENTO);
      expect(prismaMock.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prismaMock.growthAfirmacion.findMany.mock.invocationCallOrder[0]
      );
    });
  });

  describe("idempotencia", () => {
    it("repetir el mismo lote no crea, cierra, bloquea ni deja rastro, solo renueva el snapshot", async () => {
      await sincronizar(lote());
      const decisionesAntes = baseEnMemoria.decisiones.length;
      const vigentesAntes = JSON.stringify(baseEnMemoria.afirmaciones);
      vi.clearAllMocks();

      const r = await sincronizar(lote(), {
        ahora: new Date("2026-11-06T08:00:00Z"),
      });

      expect(r.sinCambios).toBe(true);
      expect(r.nuevas).toEqual([]);
      expect(r.modificadas).toEqual([]);
      expect(r.retiradas).toEqual([]);
      expect(r.iguales).toBe(4);
      expect(r.snapshotAnterior).toMatchObject({ commitSha: COMMIT_1 });
      expect(JSON.stringify(baseEnMemoria.afirmaciones)).toBe(vigentesAntes);
      expect(baseEnMemoria.decisiones).toHaveLength(decisionesAntes);
      expect(escrituras()).toBe(0);
      // Lo único que cambia: la fecha de la última comprobación.
      expect(baseEnMemoria.ajustes[0].valor).toMatchObject({
        sincronizadoEn: "2026-11-06T08:00:00.000Z",
      });
    });

    it("el mismo lote en otro commit tampoco cambia nada, pero el snapshot apunta al commit nuevo", async () => {
      await sincronizar(lote());
      const r = await sincronizar(lote({ commitSha: COMMIT_2 }));
      expect(r.sinCambios).toBe(true);
      expect(vigentes().every((a) => a.commitSha === COMMIT_1)).toBe(true);
      expect(baseEnMemoria.ajustes[0].valor).toMatchObject({
        commitSha: COMMIT_2,
      });
    });

    it("nunca hay dos vigentes de la misma clave, pase lo que pase", async () => {
      await sincronizar(lote());
      const cambiado = lote({ commitSha: COMMIT_2 });
      cambiado.afirmaciones[0] = {
        ...cambiado.afirmaciones[0],
        texto: "Plan Pro: 149 € + IVA al mes.",
      };
      await sincronizar(cambiado);
      await sincronizar(cambiado);
      const claves = vigentes().map((a) => a.clave);
      expect(new Set(claves).size).toBe(claves.length);
    });
  });

  describe("un cambio en el repo", () => {
    function conPrecio(texto: string): SincronizarBody {
      const l = lote({ commitSha: COMMIT_2 });
      l.afirmaciones[0] = { ...l.afirmaciones[0], texto };
      return l;
    }

    it("versiona la afirmación: cierra la vieja y abre la nueva en el mismo instante, sin hueco ni solape", async () => {
      await sincronizar(lote());
      const despues = new Date("2026-11-06T08:00:00Z");
      const r = await sincronizar(conPrecio("Plan Pro: 149 € + IVA al mes."), {
        ahora: despues,
      });

      expect(r.modificadas).toEqual([
        { clave: "precio.plan.pro", campos: ["texto"], semantico: true },
      ]);
      const versiones = baseEnMemoria.afirmaciones.filter(
        (a) => a.clave === "precio.plan.pro"
      );
      expect(versiones).toHaveLength(2);
      const vieja = versiones.find((v) => v.vigenteHasta !== null)!;
      const nueva = versiones.find((v) => v.vigenteHasta === null)!;
      expect(vieja.vigenteHasta).toBe(despues);
      expect(nueva.vigenteDesde).toBe(despues);
      expect(nueva.commitSha).toBe(COMMIT_2);
      expect(nueva.texto).toBe("Plan Pro: 149 € + IVA al mes.");
      expect(baseEnMemoria.decisiones.at(-1)?.motivo).toBe(
        "commit 2222222: +0 ~1 -0. Modificadas (1): precio.plan.pro."
      );
    });

    it("bloquea el borrador pendiente que cita la clave, deja una revisión y bloquea la oportunidad", async () => {
      await sincronizar(lote());
      sembrarBorrador();
      const r = await sincronizar(conPrecio("Plan Pro: 149 € + IVA al mes."));

      expect(r.borradoresBloqueados).toEqual([
        {
          borradorId: "bor_1",
          oportunidadId: "op_1",
          claves: ["precio.plan.pro"],
        },
      ]);
      expect(baseEnMemoria.borradores[0].estado).toBe("bloqueado");
      expect(baseEnMemoria.oportunidades[0].estado).toBe("bloqueada");
      expect(baseEnMemoria.revisiones).toHaveLength(1);
      expect(baseEnMemoria.revisiones[0]).toMatchObject({
        borradorId: "bor_1",
        resultado: "bloquea",
        revisor: "reglas",
      });
      const comprobaciones = baseEnMemoria.revisiones[0]
        .comprobaciones as Fila[];
      expect(comprobaciones[0]).toMatchObject({
        regla: "afirmaciones_vigentes",
        ok: false,
        dura: true,
      });
      expect(String(comprobaciones[0].detalle)).toContain("precio.plan.pro");
      expect(baseEnMemoria.decisiones.at(-2)).toMatchObject({
        accion: "bloquear_por_conocimiento",
        por: "sistema",
        borradorId: "bor_1",
        oportunidadId: "op_1",
      });
    });

    it("también bloquea un borrador ya aprobado (y su oportunidad aprobada) mientras no se haya gestionado", async () => {
      await sincronizar(lote());
      sembrarBorrador({ estado: "aprobado", estadoOportunidad: "aprobada" });
      await sincronizar(conPrecio("Plan Pro: 149 € + IVA al mes."));
      expect(baseEnMemoria.borradores[0].estado).toBe("bloqueado");
      expect(baseEnMemoria.oportunidades[0].estado).toBe("bloqueada");
    });

    it("no toca borradores gestionados, descartados ni en borrador, ni los que citan otras claves", async () => {
      await sincronizar(lote());
      sembrarBorrador({
        id: "gestionado",
        estado: "gestionado",
        oportunidadId: "op_g",
        estadoOportunidad: "gestionada",
      });
      sembrarBorrador({
        id: "descartado",
        estado: "descartado",
        oportunidadId: "op_d",
        estadoOportunidad: "descartada",
      });
      sembrarBorrador({
        id: "en_borrador",
        estado: "borrador",
        oportunidadId: "op_b",
        estadoOportunidad: "con_borrador",
      });
      sembrarBorrador({
        id: "otra_clave",
        afirmaciones: ["funcion.registro_de_llamadas"],
        oportunidadId: "op_o",
      });
      const r = await sincronizar(conPrecio("Plan Pro: 149 € + IVA al mes."));

      expect(r.borradoresBloqueados).toEqual([]);
      const estados = Object.fromEntries(
        baseEnMemoria.borradores.map((b) => [b.id, b.estado])
      );
      expect(estados).toEqual({
        gestionado: "gestionado",
        descartado: "descartado",
        en_borrador: "borrador",
        otra_clave: "pendiente_aprobacion",
      });
      expect(
        baseEnMemoria.oportunidades.find((o) => o.id === "op_g")?.estado
      ).toBe("gestionada");
    });

    it("si solo cambia la fuente, versiona pero no bloquea nada", async () => {
      await sincronizar(lote());
      sembrarBorrador();
      const l = lote({ commitSha: COMMIT_2 });
      l.afirmaciones[0] = {
        ...l.afirmaciones[0],
        fuente: "web/src/lib/plans.ts#otra-ancla",
      };
      const r = await sincronizar(l);
      expect(r.modificadas[0]).toMatchObject({
        campos: ["fuente"],
        semantico: false,
      });
      expect(r.borradoresBloqueados).toEqual([]);
      expect(baseEnMemoria.borradores[0].estado).toBe("pendiente_aprobacion");
      expect(baseEnMemoria.oportunidades[0].estado).toBe(
        "pendiente_aprobacion"
      );
    });

    it("una clave retirada se cierra con vigenteHasta (no se borra) y bloquea lo que la citaba", async () => {
      const inicial = lote();
      // Con pocas funciones retirar una pasaría del 25 % del tipo.
      for (const c of ["horario", "calendarios", "idiomas", "voz"]) {
        inicial.afirmaciones.push({
          clave: `funcion.${c}`,
          tipo: "funcion",
          texto: `Función ${c}.`,
          fuente: "PRODUCT.md#capacidades-confirmadas",
        });
      }
      await sincronizar(inicial);
      sembrarBorrador({ afirmaciones: ["funcion.registro_de_llamadas"] });
      const l = { ...inicial, commitSha: COMMIT_2 };
      l.afirmaciones = l.afirmaciones.filter(
        (a) => a.clave !== "funcion.registro_de_llamadas"
      );
      const r = await sincronizar(l);

      expect(r.retiradas).toEqual(["funcion.registro_de_llamadas"]);
      const fila = baseEnMemoria.afirmaciones.find(
        (a) => a.clave === "funcion.registro_de_llamadas"
      )!;
      expect(fila.vigenteHasta).toBe(AHORA);
      expect(baseEnMemoria.afirmaciones).toHaveLength(8);
      expect(r.borradoresBloqueados).toHaveLength(1);
      expect(baseEnMemoria.borradores[0].estado).toBe("bloqueado");
    });

    it("si el borrador cambió de estado mientras tanto (lo aprobó el fundador), no se le quita y se avisa", async () => {
      await sincronizar(lote());
      sembrarBorrador();
      // Entre la lectura y el bloqueo, otro proceso lo mueve.
      prismaMock.growthBorrador.updateMany.mockImplementationOnce(async () => ({
        count: 0,
      }));
      const r = await sincronizar(conPrecio("Plan Pro: 149 € + IVA al mes."));
      expect(r.borradoresBloqueados).toEqual([]);
      expect(r.avisos.join(" ")).toMatch(/bor_1.*cambió de estado/);
      expect(baseEnMemoria.revisiones).toEqual([]);
      expect(baseEnMemoria.oportunidades[0].estado).toBe(
        "pendiente_aprobacion"
      );
    });

    it("la oportunidad que ya no puede bloquearse no impide bloquear el borrador, y se avisa", async () => {
      await sincronizar(lote());
      sembrarBorrador({ estadoOportunidad: "gestionada" });
      const r = await sincronizar(conPrecio("Plan Pro: 149 € + IVA al mes."));
      expect(baseEnMemoria.borradores[0].estado).toBe("bloqueado");
      expect(baseEnMemoria.oportunidades[0].estado).toBe("gestionada");
      expect(r.avisos.join(" ")).toMatch(/op_1.*gestionada/);
    });
  });

  describe("guardas", () => {
    it("un lote vacío se rechaza con 400 aunque declare tipos, y no escribe nada", async () => {
      await sincronizar(lote());
      vi.clearAllMocks();
      await expect(
        sincronizar({
          commitSha: COMMIT_2,
          tipos: ["precio"],
          afirmaciones: [],
        })
      ).rejects.toMatchObject({ status: 400, codigo: "lote_vacio" });
      expect(escrituras()).toBe(0);
      expect(vigentes()).toHaveLength(4);
    });

    describe("cierres masivos", () => {
      async function baseGrande() {
        const l = lote();
        for (let i = 0; i < 20; i++) {
          l.afirmaciones.push({
            clave: `pagina.p${i}`,
            tipo: "pagina",
            texto: `Página ${i}`,
            fuente: "web/src/lib/paginas.ts",
          });
        }
        await sincronizar(l);
        return l;
      }

      function sinPaginas(l: SincronizarBody, quitar: number): SincronizarBody {
        const paginas = l.afirmaciones.filter((a) => a.tipo === "pagina");
        const fuera = new Set(paginas.slice(0, quitar).map((p) => p.clave));
        return {
          ...l,
          commitSha: COMMIT_2,
          afirmaciones: l.afirmaciones.filter((a) => !fuera.has(a.clave)),
        };
      }

      it("rechaza con 409 cierres_masivos, no escribe nada y dice cuáles se cerrarían", async () => {
        const l = await baseGrande();
        vi.clearAllMocks();
        const error = await sincronizar(sinPaginas(l, 10)).catch((e) => e);
        expect(error).toBeInstanceOf(ErrorDeGrowth);
        expect(error).toMatchObject({ status: 409, codigo: "cierres_masivos" });
        expect(error.extra.cierres).toBe(10);
        expect(error.extra.claves).toHaveLength(10);
        expect(escrituras()).toBe(0);
        expect(vigentes()).toHaveLength(24);
      });

      it("simular no falla: devuelve el diff y dice que no es aplicable", async () => {
        const l = await baseGrande();
        vi.clearAllMocks();
        const r = await sincronizar(sinPaginas(l, 10), { simular: true });
        expect(r.aplicable).toBe(false);
        expect(r.motivoNoAplicable).toMatch(/10 de 20 de tipo pagina/);
        expect(r.retiradas).toHaveLength(10);
        expect(escrituras()).toBe(0);
      });

      it("forzarCierres (solo un administrador) los aplica", async () => {
        const l = await baseGrande();
        const r = await sincronizar(sinPaginas(l, 10), { forzarCierres: true });
        expect(r.retiradas).toHaveLength(10);
        expect(vigentes()).toHaveLength(14);
      });

      it("pocos cierres sí pasan (hasta dos de un tipo y no más del 25 %)", async () => {
        const l = await baseGrande();
        const r = await sincronizar(sinPaginas(l, 2));
        expect(r.retiradas).toHaveLength(2);
      });

      it("tres cierres de un mismo tipo ya son masivos, aunque sean el 15 % de las páginas", async () => {
        const l = await baseGrande();
        await expect(sincronizar(sinPaginas(l, 3))).rejects.toMatchObject({
          status: 409,
          codigo: "cierres_masivos",
        });
      });

      it("el mensaje dice que lo aplica un administrador", async () => {
        const l = await baseGrande();
        const error = await sincronizar(sinPaginas(l, 5)).catch((e) => e);
        expect(error.message).toMatch(/administrador/);
      });

      it("un tipo cubierto del que el lote no trae ni una afirmación nunca se vacía sin forzar", async () => {
        await sincronizar(lote());
        const sinPrecios = lote({
          commitSha: COMMIT_2,
          tipos: ["precio", "funcion", "limite", "prohibida"],
        });
        sinPrecios.afirmaciones = sinPrecios.afirmaciones.filter(
          (a) => a.tipo !== "precio"
        );
        await expect(sincronizar(sinPrecios)).rejects.toMatchObject({
          status: 409,
          codigo: "cierres_masivos",
        });
        expect(vigentes().some((a) => a.clave === "precio.plan.pro")).toBe(
          true
        );
      });
    });

    describe("términos prohibidos dentro de lo que se afirma", () => {
      it("rechaza con 400 una función cuyo texto usa un término de la lista y no escribe nada", async () => {
        const l = lote();
        l.afirmaciones[1] = {
          ...l.afirmaciones[1],
          texto: "Número de España con Telnyx aprovisionado tras el checkout.",
        };
        const error = await sincronizar(l).catch((e) => e);
        expect(error).toMatchObject({
          status: 400,
          codigo: "termino_prohibido",
        });
        expect(error.extra.afirmaciones).toEqual([
          { clave: "funcion.registro_de_llamadas", terminos: ["Telnyx"] },
        ]);
        expect(escrituras()).toBe(0);
        expect(baseEnMemoria.afirmaciones).toEqual([]);
      });

      it("si el lote no cubre las prohibidas, usa las vigentes de la base", async () => {
        await sincronizar(lote());
        vi.clearAllMocks();
        await expect(
          sincronizar({
            commitSha: COMMIT_2,
            afirmaciones: [
              {
                clave: "funcion.x",
                tipo: "funcion",
                texto: "Funciona con Telnyx.",
                fuente: "PRODUCT.md#capacidades-confirmadas",
              },
            ],
          })
        ).rejects.toMatchObject({ codigo: "termino_prohibido" });
      });

      it("las limitaciones y las propias prohibidas quedan fuera: pueden citar la categoría para decir que no existe", async () => {
        const l = lote();
        l.afirmaciones[2] = {
          ...l.afirmaciones[2],
          texto: "No se nombra Telnyx ni se inventan testimonios.",
        };
        await expect(sincronizar(l)).resolves.toMatchObject({
          sinCambios: false,
        });
      });

      it("respeta palabrasEnteras: «API» no salta con «fisioterapia»", () => {
        const infracciones = afirmacionesConTerminosProhibidos(
          [
            {
              clave: "pagina.fisioterapia",
              tipo: "pagina",
              texto: "Recepcionista de IA para fisioterapia",
              fuente: "web/src/lib/paginas.ts",
            },
            {
              clave: "pagina.api",
              tipo: "pagina",
              texto: "Conecta con la API.",
              fuente: "web/src/lib/paginas.ts",
            },
          ],
          [{ termino: "API", palabraEntera: true }]
        );
        expect(infracciones).toEqual([
          { clave: "pagina.api", terminos: ["API"] },
        ]);
      });
    });

    it("solo cierra los tipos cubiertos: sincronizar páginas no toca los precios", async () => {
      await sincronizar(lote());
      const r = await sincronizar({
        commitSha: COMMIT_2,
        afirmaciones: [
          {
            clave: "pagina.planes",
            tipo: "pagina",
            texto: "Planes y precios",
            fuente: "web/src/lib/paginas.ts",
          },
        ],
      });
      expect(r.retiradas).toEqual([]);
      expect(vigentes().some((a) => a.clave === "precio.plan.pro")).toBe(true);
    });

    it("dos vigentes de la misma clave (no debería ocurrir) se arreglan: queda una y se avisa", async () => {
      await sincronizar(lote());
      const original = baseEnMemoria.afirmaciones.find(
        (a) => a.clave === "precio.plan.pro"
      )!;
      baseEnMemoria.afirmaciones.push({
        ...original,
        id: "duplicada",
        vigenteDesde: new Date("2026-09-01T00:00:00Z"),
      });
      const r = await sincronizar(lote());
      expect(r.sinCambios).toBe(false);
      expect(r.avisos.join(" ")).toMatch(/clave repetida/);
      expect(
        vigentes().filter((a) => a.clave === "precio.plan.pro")
      ).toHaveLength(1);
    });
  });

  describe("siembra", () => {
    it("los competidores y nichos existentes no se tocan: solo altas", async () => {
      baseEnMemoria.nichos.push({
        id: "n1",
        slug: "peluqueria",
        nombre: "Peluquería (editado)",
        estado: "descartado",
        origen: "web_sectores",
      });
      baseEnMemoria.competidores.push({
        id: "c1",
        nombre: "Retell (nombre del fundador)",
        dominio: "retellai.com",
      });
      const r = await sincronizar(lote());
      expect(r.nichosNuevos).toEqual([]);
      expect(r.competidoresNuevos).toEqual([]);
      expect(baseEnMemoria.nichos[0]).toMatchObject({
        estado: "descartado",
        nombre: "Peluquería (editado)",
      });
      expect(baseEnMemoria.competidores[0].nombre).toBe(
        "Retell (nombre del fundador)"
      );
    });

    it("las páginas existentes se actualizan sin tocar lo que es de Search Console", async () => {
      baseEnMemoria.paginas.push({
        ruta: "/planes",
        nombre: "Planes (antiguo)",
        seccion: "principal",
        nichoSlug: null,
        actualizado: new Date("2026-10-01T00:00:00Z"),
        indexada: true,
        comprobadaEn: new Date("2026-10-28T00:00:00Z"),
      });
      const r = await sincronizar(lote());
      expect(r.paginasActualizadas).toEqual(["/planes"]);
      expect(baseEnMemoria.paginas[0]).toMatchObject({
        nombre: "Planes y precios",
        indexada: true,
      });
    });
  });

  describe("simular", () => {
    it("calcula el diff completo sin abrir transacción ni escribir una sola fila", async () => {
      await sincronizar(lote());
      sembrarBorrador();
      vi.clearAllMocks();
      const l = lote({ commitSha: COMMIT_2 });
      l.afirmaciones[0] = { ...l.afirmaciones[0], texto: "Plan Pro: 149 €." };

      const r = await sincronizar(l, { simular: true });

      expect(r.simulado).toBe(true);
      expect(r.snapshot).toBeNull();
      expect(r.aplicable).toBe(true);
      expect(r.modificadas).toHaveLength(1);
      expect(r.borradoresBloqueados).toEqual([
        {
          borradorId: "bor_1",
          oportunidadId: "op_1",
          claves: ["precio.plan.pro"],
        },
      ]);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
      expect(escrituras()).toBe(0);
      expect(baseEnMemoria.borradores[0].estado).toBe("pendiente_aprobacion");
    });
  });

  describe("snapshot", () => {
    it("guarda el rastro de los ficheros leídos con su blob SHA", async () => {
      await sincronizar(lote(), {
        fuentes: [
          {
            ruta: "web/src/lib/plans.ts",
            blobSha: "9".repeat(40),
            commitSha: "8".repeat(40),
          },
        ],
      });
      expect(baseEnMemoria.ajustes[0].valor).toMatchObject({
        fuentes: [
          {
            ruta: "web/src/lib/plans.ts",
            blobSha: "9".repeat(40),
            commitSha: "8".repeat(40),
          },
        ],
      });
    });

    it("sin rastro del cliente, al menos lista los ficheros de las afirmaciones", async () => {
      await sincronizar(lote());
      const fuentes = (baseEnMemoria.ajustes[0].valor as { fuentes: Fila[] })
        .fuentes;
      expect(fuentes.map((f) => f.ruta).sort()).toEqual([
        "PRODUCT.md",
        "growth/agentes/reglas/afirmaciones-prohibidas.md",
        "web/src/lib/plans.ts",
      ]);
    });

    it("acumula los cambios recientes y descarta los de más de 30 días", async () => {
      await sincronizar(lote(), { ahora: new Date("2026-09-01T00:00:00Z") });
      const l = lote({ commitSha: COMMIT_2 });
      l.afirmaciones[0] = { ...l.afirmaciones[0], texto: "Plan Pro: 149 €." };
      await sincronizar(l, { ahora: new Date("2026-10-30T00:00:00Z") });

      const cambios = (
        baseEnMemoria.ajustes[0].valor as {
          cambiosRecientes: { clave: string; cambio: string }[];
        }
      ).cambiosRecientes;
      // Las 4 altas de septiembre ya son demasiado viejas; queda la modificación.
      expect(cambios).toEqual([
        expect.objectContaining({
          clave: "precio.plan.pro",
          cambio: "modificacion",
        }),
      ]);
    });
  });
});
