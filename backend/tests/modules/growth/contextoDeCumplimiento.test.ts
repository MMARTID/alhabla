import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PrismaMock } from "./ayudas.js";
import { hace } from "./ayudas.js";
import {
  ajustesEfectivosDe,
  construirSnapshotDeConocimiento,
  contactosDeLaSemana,
  contextoDeCumplimiento,
  dominiosEnEnfriamiento,
  evaluarBorradorConContexto,
  leerAjustesEfectivos,
  terminosProhibidosDe,
} from "../../../src/modules/growth/contextoDeCumplimiento.js";

const { prismaMock } = await vi.hoisted(async () => {
  const { crearPrismaMock } = await import("./ayudas.js");
  return { prismaMock: crearPrismaMock() };
});

vi.mock("../../../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const mock = prismaMock as PrismaMock;

describe("ajustes efectivos", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sin nada guardado valen los de por defecto", () => {
    expect(ajustesEfectivosDe([])).toEqual({
      topeSemanal: 5,
      umbralDeSimilitud: 0.6,
      umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
      pausa: false,
    });
  });

  it("mezcla lo guardado con los valores por defecto", () => {
    const e = ajustesEfectivosDe([
      { clave: "topeSemanal", valor: 3 },
      { clave: "pausa", valor: true },
      {
        clave: "umbralesPorObjetivo",
        valor: { LEADS: 40, BACKLINKS: 70, TRAFICO_MARCA: 50 },
      },
    ]);
    expect(e.topeSemanal).toBe(3);
    expect(e.pausa).toBe(true);
    expect(e.umbralesPorObjetivo).toEqual({
      TRAFICO_MARCA: 50,
      LEADS: 40,
      BACKLINKS: 70,
    });
    expect(e.umbralDeSimilitud).toBe(0.6);
  });

  it("un valor fuera de rango no se aplica (debilitaría una regla dura) y se dice en el log", () => {
    const e = ajustesEfectivosDe([
      { clave: "topeSemanal", valor: 500 },
      { clave: "umbralDeSimilitud", valor: 1 },
      { clave: "umbralesPorObjetivo", valor: { LEADS: "mucho" } },
      { clave: "pausa", valor: "true" },
    ]);
    expect(e.topeSemanal).toBe(5);
    expect(e.umbralDeSimilitud).toBe(0.6);
    expect(e.umbralesPorObjetivo.LEADS).toBe(60);
    expect(e.pausa).toBe(false);
    expect(console.error).toHaveBeenCalled();
    expect(vi.mocked(console.error).mock.calls[0]![0]).toContain("[Growth]");
  });

  it("un tope no entero o NaN tampoco", () => {
    expect(
      ajustesEfectivosDe([{ clave: "topeSemanal", valor: 2.5 }]).topeSemanal
    ).toBe(5);
    expect(
      ajustesEfectivosDe([{ clave: "topeSemanal", valor: null }]).topeSemanal
    ).toBe(5);
  });

  it("leerAjustesEfectivos pide solo las claves editables y dice cuándo se guardó cada una", async () => {
    const fecha = new Date("2026-11-01T10:00:00Z");
    mock.growthAjuste.findMany.mockResolvedValue([
      { clave: "pausa", valor: true, actualizadoEn: fecha },
    ]);
    const r = await leerAjustesEfectivos();
    expect(mock.growthAjuste.findMany.mock.calls[0]![0].where).toEqual({
      clave: {
        in: [
          "topeSemanal",
          "umbralDeSimilitud",
          "umbralesPorObjetivo",
          "pausa",
        ],
      },
    });
    expect(r.valores.pausa).toBe(true);
    expect(r.actualizadoEn.pausa).toEqual(fecha);
    expect(r.actualizadoEn.topeSemanal).toBeNull();
  });
});

describe("términos prohibidos", () => {
  it("lee valor.terminos y palabrasEnteras (por defecto, palabra entera)", () => {
    expect(
      terminosProhibidosDe({
        texto: "No se nombra",
        valor: { terminos: ["Telnyx", "API"], palabrasEnteras: false },
      })
    ).toEqual([
      { termino: "Telnyx", palabraEntera: false },
      { termino: "API", palabraEntera: false },
    ]);
    expect(
      terminosProhibidosDe({ texto: "x", valor: { terminos: ["API"] } })
    ).toEqual([{ termino: "API", palabraEntera: true }]);
  });

  it("sin lista cae a la frase completa; ignora lo que no es texto", () => {
    expect(
      terminosProhibidosDe({ texto: "frase entera", valor: null })
    ).toEqual([{ termino: "frase entera", palabraEntera: true }]);
    expect(
      terminosProhibidosDe({
        texto: "x",
        valor: { terminos: ["a b c", 3, null] },
      })
    ).toEqual([{ termino: "a b c", palabraEntera: true }]);
  });
});

describe("snapshot del conocimiento", () => {
  const ahora = new Date("2026-11-10T12:00:00Z");

  it("sin fila o con un valor raro es null", () => {
    expect(
      construirSnapshotDeConocimiento(undefined, undefined, ahora)
    ).toBeNull();
    expect(construirSnapshotDeConocimiento("x", ahora, ahora)).toBeNull();
    expect(construirSnapshotDeConocimiento([], ahora, ahora)).toBeNull();
    expect(construirSnapshotDeConocimiento({}, ahora, ahora)).toBeNull();
  });

  it("calcula la antigüedad desde cuándo se sincronizó, no desde cuándo cambió algo", () => {
    const s = construirSnapshotDeConocimiento(
      {
        commitSha: "abc1234",
        vigentes: 160,
        porTipo: { precio: 9, funcion: 16, malo: "x" },
      },
      new Date("2026-11-10T06:00:00Z"),
      ahora
    );
    expect(s).toEqual({
      commitSha: "abc1234",
      sincronizadoEn: "2026-11-10T06:00:00.000Z",
      antiguedadHoras: 6,
      obsoleto: false,
      vigentes: 160,
      porTipo: { precio: 9, funcion: 16 },
    });
  });

  it("pasados 8 días está obsoleto", () => {
    const valor = { commitSha: "abc1234", vigentes: 1, porTipo: {} };
    expect(
      construirSnapshotDeConocimiento(
        valor,
        new Date("2026-11-02T13:00:00Z"),
        ahora
      )?.obsoleto
    ).toBe(false);
    expect(
      construirSnapshotDeConocimiento(
        valor,
        new Date("2026-11-02T11:00:00Z"),
        ahora
      )?.obsoleto
    ).toBe(true);
  });
});

describe("contactos y enfriamiento", () => {
  beforeEach(() => vi.resetAllMocks());

  it("la semana cuenta lo hecho y lo aprobado sin gestionar, sin la propia oportunidad", async () => {
    mock.growthGestion.count.mockResolvedValue(2);
    mock.growthOportunidad.count.mockResolvedValue(3);
    const r = await contactosDeLaSemana(prismaMock as never, {
      excluirOportunidadId: "o1",
    });
    expect(r).toEqual({ hechas: 2, aprobadasSinGestionar: 3, total: 5 });
    expect(mock.growthOportunidad.count.mock.calls[0]![0].where).toEqual({
      estado: "aprobada",
      id: { not: "o1" },
    });
    const desde = mock.growthGestion.count.mock.calls[0]![0].where.hechaEn
      .gte as Date;
    expect(Date.now() - desde.getTime()).toBeGreaterThan(
      6.9 * 24 * 3600 * 1000
    );
    expect(Date.now() - desde.getTime()).toBeLessThan(7.1 * 24 * 3600 * 1000);
  });

  it("los dominios en enfriamiento terminan 90 días después de la última gestión", async () => {
    const ultima = hace(10);
    mock.growthGestion.findMany.mockResolvedValue([
      { dominio: "a.com", hechaEn: ultima },
      { dominio: "a.com", hechaEn: hace(40) },
      { dominio: "b.com", hechaEn: hace(80) },
    ]);
    mock.growthOportunidad.findMany.mockResolvedValue([
      { dominio: "c.com" },
      { dominio: "c.com" },
    ]);
    const r = await dominiosEnEnfriamiento(prismaMock as never);
    expect(r.dominiosEnEnfriamiento).toHaveLength(2);
    expect(r.dominiosEnEnfriamiento[0]).toEqual({
      dominio: "a.com",
      hasta: new Date(ultima.getTime() + 90 * 24 * 3600 * 1000),
    });
    expect(r.dominiosConAprobadaPendiente).toEqual(["c.com"]);
  });
});

describe("contextoDeCumplimiento", () => {
  function preparar() {
    vi.resetAllMocks();
    mock.growthAfirmacion.findMany.mockResolvedValue([
      {
        clave: "funcion.reserva",
        tipo: "funcion",
        texto: "Reserva",
        valor: null,
      },
      {
        clave: "comparativa.heydiga",
        tipo: "comparativa",
        texto: "HeyDiga",
        valor: { competidorDominio: "heydiga.ai" },
      },
      {
        clave: "prohibida.proveedor",
        tipo: "prohibida",
        texto: "Proveedor",
        valor: { terminos: ["Telnyx"], palabrasEnteras: true },
      },
    ]);
    mock.growthCompetidor.findMany.mockResolvedValue([
      { nombre: "HeyDiga", dominio: "heydiga.ai" },
    ]);
    mock.growthAjuste.findMany.mockResolvedValue([
      { clave: "topeSemanal", valor: 4, actualizadoEn: new Date() },
    ]);
    mock.growthBorrador.findMany.mockImplementation(
      async ({ where }: { where: { oportunidadId: unknown } }) =>
        typeof where.oportunidadId === "object"
          ? [{ texto: "De otra oportunidad", textoFinal: "Enviado a otra" }]
          : [{ texto: "Versión 1", textoFinal: null }]
    );
    mock.growthGestion.findMany.mockResolvedValue([{ hechaEn: hace(20) }]);
    mock.growthGestion.count.mockResolvedValue(2);
    mock.growthOportunidad.count.mockImplementation(
      async ({ where }: { where: { dominio?: string } }) =>
        where.dominio ? 1 : 3
    );
  }

  beforeEach(preparar);

  it("separa los textos de otras oportunidades de los de la misma", async () => {
    const { contexto } = await contextoDeCumplimiento({
      dominio: "ejemplo.com",
      oportunidadId: "o1",
      excluirBorradorId: "b2",
    });
    expect(contexto.textosAnteriores).toEqual([
      "De otra oportunidad",
      "Enviado a otra",
    ]);
    expect(contexto.textosDeLaMismaOportunidad).toEqual(["Versión 1"]);

    const consultas = mock.growthBorrador.findMany.mock.calls.map(
      (c) => c[0].where
    );
    // De otras oportunidades: solo lo que se dijo (o está a punto de decirse).
    expect(consultas).toContainEqual(
      expect.objectContaining({
        oportunidadId: { not: "o1" },
        estado: { in: ["pendiente_aprobacion", "aprobado", "gestionado"] },
      })
    );
    // El propio borrador se excluye de la comparación con su oportunidad.
    expect(consultas).toContainEqual({
      oportunidadId: "o1",
      id: { not: "b2" },
    });
  });

  describe("la plantilla repetida solo mira lo anterior y lo que se dijo", () => {
    const deOtras = () =>
      mock.growthBorrador.findMany.mock.calls
        .map((c) => c[0])
        .find(
          (consulta: { where: { oportunidadId: unknown } }) =>
            typeof consulta.where.oportunidadId === "object"
        );

    it("solo borradores pendientes, aprobados o gestionados: ni bloqueados ni descartados", async () => {
      await contextoDeCumplimiento({
        dominio: "ejemplo.com",
        oportunidadId: "o1",
      });
      const estados = deOtras().where.estado.in as string[];
      expect(estados.sort()).toEqual([
        "aprobado",
        "gestionado",
        "pendiente_aprobacion",
      ]);
      expect(estados).not.toContain("bloqueado");
      expect(estados).not.toContain("descartado");
      expect(estados).not.toContain("borrador");
    });

    it("de los últimos 180 días y sin tope de 30 filas", async () => {
      const ahora = new Date("2026-11-02T10:00:00Z");
      await contextoDeCumplimiento({
        dominio: "ejemplo.com",
        oportunidadId: "o1",
        ahora,
      });
      const consulta = deOtras();
      expect(consulta.where.creadoEn.gte).toEqual(
        new Date(ahora.getTime() - 180 * 24 * 60 * 60 * 1000)
      );
      // Un recorte de 30 dejaba pasar el texto de un mensaje ya enviado.
      expect(consulta.take).toBeGreaterThan(30);
    });

    it("con un borrador ya creado, solo compara con lo escrito ANTES (creadoEn explícito)", async () => {
      const creadoEn = new Date("2026-10-01T10:00:00Z");
      await contextoDeCumplimiento({
        dominio: "ejemplo.com",
        oportunidadId: "o1",
        excluirBorradorId: "b2",
        creadoEn,
      });
      expect(deOtras().where.creadoEn.lt).toEqual(creadoEn);
      // Con la fecha en la mano no se pregunta por ella.
      expect(mock.growthBorrador.findUnique).not.toHaveBeenCalled();
    });

    it("sin creadoEn, lo busca por el id del borrador que se evalúa", async () => {
      const creadoEn = new Date("2026-10-01T10:00:00Z");
      mock.growthBorrador.findUnique.mockResolvedValue({ creadoEn });
      await contextoDeCumplimiento({
        dominio: "ejemplo.com",
        oportunidadId: "o1",
        excluirBorradorId: "b2",
      });
      expect(mock.growthBorrador.findUnique).toHaveBeenCalledWith({
        where: { id: "b2" },
        select: { creadoEn: true },
      });
      expect(deOtras().where.creadoEn.lt).toEqual(creadoEn);
    });

    it("un borrador nuevo (sin id) se compara con todo lo que ya existe, sin límite superior", async () => {
      await contextoDeCumplimiento({
        dominio: "ejemplo.com",
        oportunidadId: "o1",
      });
      expect(deOtras().where.creadoEn).not.toHaveProperty("lt");
      expect(mock.growthBorrador.findUnique).not.toHaveBeenCalled();
    });
  });

  it("cuenta lo aprobado sin gestionar para el tope y para el dominio", async () => {
    const { contexto, agenda, ajustes } = await contextoDeCumplimiento({
      dominio: "ejemplo.com",
      oportunidadId: "o1",
    });
    expect(contexto.contactosEstaSemana).toBe(5); // 2 hechas + 3 aprobadas
    expect(contexto.aprobadasDelDominio).toBe(1);
    expect(contexto.topeSemanal).toBe(4);
    expect(ajustes.topeSemanal).toBe(4);
    expect(agenda.contactos).toEqual({
      hechas: 2,
      aprobadasSinGestionar: 3,
      total: 5,
    });
    expect(contexto.gestionesDelDominio).toHaveLength(1);
  });

  it("con incluirAprobadas en false solo cuenta lo hecho, y la agenda sigue diciendo lo aprobado", async () => {
    const { contexto, agenda } = await contextoDeCumplimiento({
      dominio: "ejemplo.com",
      oportunidadId: "o1",
      incluirAprobadas: false,
    });
    expect(contexto.contactosEstaSemana).toBe(2);
    expect(contexto.aprobadasDelDominio).toBe(0);
    expect(agenda.aprobadasDelDominio).toBe(1);
    expect(agenda.contactos.aprobadasSinGestionar).toBe(3);
  });

  it("las afirmaciones citadas llevan tipo y valor, solo las que cita el borrador", async () => {
    const { contexto } = await contextoDeCumplimiento({
      dominio: "ejemplo.com",
      oportunidadId: "o1",
      afirmaciones: ["comparativa.heydiga", "no.existe"],
    });
    expect(contexto.afirmacionesCitadas).toEqual([
      {
        clave: "comparativa.heydiga",
        tipo: "comparativa",
        valor: { competidorDominio: "heydiga.ai" },
      },
    ]);
    expect([...contexto.clavesVigentes].sort()).toEqual([
      "comparativa.heydiga",
      "funcion.reserva",
      "prohibida.proveedor",
    ]);
    expect(contexto.terminosProhibidos).toEqual([
      { termino: "Telnyx", palabraEntera: true },
    ]);
  });

  it("usa el cliente que se le pasa (la transacción), no el global", async () => {
    const otro = {
      growthAfirmacion: { findMany: vi.fn().mockResolvedValue([]) },
      growthCompetidor: { findMany: vi.fn().mockResolvedValue([]) },
      growthAjuste: { findMany: vi.fn().mockResolvedValue([]) },
      growthBorrador: { findMany: vi.fn().mockResolvedValue([]) },
      growthGestion: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      growthOportunidad: { count: vi.fn().mockResolvedValue(0) },
    };
    await contextoDeCumplimiento({
      dominio: "x.com",
      oportunidadId: "o1",
      cliente: otro as never,
    });
    expect(otro.growthAfirmacion.findMany).toHaveBeenCalled();
    expect(mock.growthAfirmacion.findMany.mock.calls.length).toBe(0);
  });

  it("evaluarBorradorConContexto aplica las reglas con ese contexto", async () => {
    const r = await evaluarBorradorConContexto(
      {
        tipo: "email",
        objetivo: "BACKLINKS",
        asunto: "Hola",
        texto:
          "Hola, soy el fundador de Alhabla. Comparamos con HeyDiga en precio y en reservas, y usamos Telnyx por debajo, que lo sepáis. Un saludo cordial desde el equipo.",
        enlaceUrl: "https://alhabla.ai/?utm_source=x",
        afirmaciones: ["funcion.reserva"],
      },
      { dominio: "ejemplo.com", oportunidadId: "o1" }
    );
    const falla = r.comprobaciones
      .filter((c) => c.dura && !c.ok)
      .map((c) => c.regla);
    expect(falla).toEqual(
      expect.arrayContaining([
        "sin_terminos_prohibidos",
        "comparativa_con_fuente",
        "un_contacto_por_dominio",
        "tope_semanal",
      ])
    );
    expect(r.resultado).toBe("bloquea");
    expect(r.agenda.contactos.total).toBe(5);
  });
});
