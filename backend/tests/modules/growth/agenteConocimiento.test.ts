import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PrismaMock } from "./ayudas.js";

const { prismaMock } = await vi.hoisted(async () => {
  const { crearPrismaMock } = await import("./ayudas.js");
  return { prismaMock: crearPrismaMock() };
});

vi.mock("../../../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const { ConocimientoDelAgenteConsulta, leerConocimientoDelAgente } =
  await import("../../../src/modules/growth/servicioAgente.js");

const mock = prismaMock as PrismaMock;

/**
 * La lectura de conocimiento con cursor de A2 (`leerConocimientoDelAgente`).
 * La ruta `GET /growth/agente/conocimiento` la registra el sincronizador
 * (`routesConocimiento.ts`) y hoy no usa esta función: se prueba aquí, al
 * nivel del servicio, para que cambiar la ruta sea solo cambiar una llamada.
 */

function afirmacion(clave: string, cambios: Record<string, unknown> = {}) {
  return {
    clave,
    tipo: clave.split(".")[0],
    texto: `Texto de ${clave}`,
    valor: null,
    fuente: "web/src/lib/plans.ts#x",
    commitSha: "abc1234",
    nichoSlug: null,
    vigenteDesde: new Date("2026-10-01T00:00:00.000Z"),
    ...cambios,
  };
}

function consultar(entrada: Record<string, unknown> = {}) {
  return leerConocimientoDelAgente(
    ConocimientoDelAgenteConsulta.parse(entrada)
  );
}

describe("lectura de conocimiento del agente (con cursor)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.growthAjuste.findUnique.mockResolvedValue(null);
    mock.growthAfirmacion.findMany.mockResolvedValue([]);
    mock.growthAfirmacion.count.mockResolvedValue(0);
  });

  it("solo lee lo VIGENTE, ordenado por clave", async () => {
    await consultar();
    const consulta = mock.growthAfirmacion.findMany.mock.calls[0]![0];
    expect(consulta.where).toEqual({ vigenteHasta: null });
    expect(consulta.orderBy).toEqual([{ clave: "asc" }, { id: "asc" }]);
    expect(mock.growthAfirmacion.count.mock.calls[0]![0].where).toEqual({
      vigenteHasta: null,
    });
  });

  it("devuelve cada afirmación con su fuente y su commit, el total y el snapshot", async () => {
    mock.growthAfirmacion.findMany.mockResolvedValue([
      afirmacion("precio.plan.pro", { valor: { euros: 139 } }),
    ]);
    mock.growthAfirmacion.count.mockResolvedValue(160);
    mock.growthAjuste.findUnique.mockResolvedValue({
      clave: "sistema.conocimiento",
      valor: { commitSha: "abc1234", vigentes: 160, porTipo: { precio: 9 } },
      actualizadoEn: new Date(),
    });

    const respuesta = await consultar();

    expect(respuesta.total).toBe(160);
    expect(respuesta.snapshot).toMatchObject({
      commitSha: "abc1234",
      vigentes: 160,
    });
    expect(respuesta.data).toEqual([
      expect.objectContaining({
        clave: "precio.plan.pro",
        tipo: "precio",
        valor: { euros: 139 },
        fuente: "web/src/lib/plans.ts#x",
        commitSha: "abc1234",
        textoRecortado: false,
      }),
    ]);
    // Sin el id interno de la base de datos.
    expect(respuesta.data[0]).not.toHaveProperty("id");
  });

  it("recorta el texto a 400 caracteres y lo dice", async () => {
    mock.growthAfirmacion.findMany.mockResolvedValue([
      afirmacion("funcion.larga", { texto: "x".repeat(900) }),
      afirmacion("funcion.justa", { texto: "y".repeat(400) }),
    ]);
    const { data } = await consultar();

    expect(data[0]!.texto).toHaveLength(400);
    expect(data[0]!.texto.endsWith("…")).toBe(true);
    expect(data[0]!.textoRecortado).toBe(true);
    expect(data[1]!.texto).toHaveLength(400);
    expect(data[1]!.textoRecortado).toBe(false);
  });

  it("filtra por tipo, por prefijo de clave (con `prefijo` o con `clave`) y por texto", async () => {
    await consultar({ tipo: "precio", prefijo: "precio.plan", q: "Pro" });
    expect(mock.growthAfirmacion.findMany.mock.calls[0]![0].where).toEqual({
      vigenteHasta: null,
      tipo: "precio",
      clave: { startsWith: "precio.plan" },
      OR: [
        { clave: { contains: "Pro", mode: "insensitive" } },
        { texto: { contains: "Pro", mode: "insensitive" } },
      ],
    });

    mock.growthAfirmacion.findMany.mockClear();
    await consultar({ clave: "funcion." });
    expect(mock.growthAfirmacion.findMany.mock.calls[0]![0].where).toEqual({
      vigenteHasta: null,
      clave: { startsWith: "funcion." },
    });
  });

  it("el cursor `desde` pide las claves posteriores a la última que se leyó, sin cambiar el total", async () => {
    await consultar({ desde: "precio.plan.pro", tipo: "precio" });

    expect(mock.growthAfirmacion.findMany.mock.calls[0]![0].where).toEqual({
      AND: [
        { vigenteHasta: null, tipo: "precio" },
        { clave: { gt: "precio.plan.pro" } },
      ],
    });
    // El total es el de todo lo que cumple el filtro, no el de lo que queda.
    expect(mock.growthAfirmacion.count.mock.calls[0]![0].where).toEqual({
      vigenteHasta: null,
      tipo: "precio",
    });
  });

  it("si hay más que el límite devuelve el límite y la clave siguiente; si no, null", async () => {
    mock.growthAfirmacion.findMany.mockResolvedValue([
      afirmacion("precio.a"),
      afirmacion("precio.b"),
      afirmacion("precio.c"),
    ]);
    const primera = await consultar({ limite: "2" });

    expect(primera.data.map((a) => a.clave)).toEqual(["precio.a", "precio.b"]);
    expect(primera.siguiente).toBe("precio.b");
    // Pide una de más para saber si queda otra página.
    expect(mock.growthAfirmacion.findMany.mock.calls[0]![0].take).toBe(3);

    mock.growthAfirmacion.findMany.mockResolvedValue([afirmacion("precio.c")]);
    const ultima = await consultar({ limite: "2", desde: "precio.b" });
    expect(ultima.data.map((a) => a.clave)).toEqual(["precio.c"]);
    expect(ultima.siguiente).toBeNull();
  });

  it("el límite por defecto es 200 y el máximo 500", async () => {
    await consultar();
    expect(mock.growthAfirmacion.findMany.mock.calls[0]![0].take).toBe(201);
    expect(() => consultar({ limite: "501" })).toThrow();
    expect(() => consultar({ limite: "0" })).toThrow();
  });

  it("rechaza un tipo que no existe y un texto vacío", async () => {
    expect(() => consultar({ tipo: "magia" })).toThrow();
    expect(() => consultar({ q: "" })).toThrow();
  });
});
