import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import type { PrismaMock } from "./ayudas.js";
import { comoAgente, registroDeToken } from "./ayudas.js";

/**
 * Una simulación (`?simular=true`) no escribe nada, así que no debe exigir la
 * guardia de pausa (como `evaluar`); la sincronización de verdad sí. Revisión
 * 1b, e2e B6.
 */

const { prismaMock, sincronizarMock } = await vi.hoisted(async () => {
  const { crearPrismaMock } = await import("./ayudas.js");
  const { vi } = await import("vitest");
  return { prismaMock: crearPrismaMock(), sincronizarMock: vi.fn() };
});

vi.mock("../../../src/lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../../../src/modules/growth/conocimiento/sincronizar.js", () => ({
  sincronizarConocimiento: sincronizarMock,
}));

const mock = prismaMock as PrismaMock;
const RUTA = "/growth/agente/conocimiento/sincronizar";
const COMMIT = "a".repeat(40);

const CUERPO = {
  commitSha: COMMIT,
  afirmaciones: [
    {
      clave: "precio.plan.pro",
      tipo: "precio",
      texto: "Plan Pro: 139 € + IVA al mes.",
      fuente: "web/src/lib/plans.ts#plans-pro",
    },
  ],
};

describe("sincronizar con Growth en pausa", () => {
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.resetAllMocks();
    process.env.GROWTH_GOOGLE_CLIENT_ID = "cliente.apps.googleusercontent.com";
    process.env.GROWTH_ADMIN_EMAILS = "admin@alhabla.ai";
    mock.growthTokenAgente.update.mockResolvedValue({});
    mock.growthTokenAgente.findUnique.mockResolvedValue(
      registroDeToken({ alcances: ["conocimiento"] })
    );
    mock.growthAjuste.findMany.mockResolvedValue([]);
    mock.growthAjuste.findUnique.mockImplementation(
      async ({ where }: { where: { clave: string } }) =>
        where.clave === "pausa"
          ? { clave: "pausa", valor: true, actualizadoEn: new Date() }
          : null
    );
    sincronizarMock.mockResolvedValue({ sinCambios: true, commitSha: COMMIT });
    fastify = Fastify();
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  function enviar(query = "") {
    return fastify.inject({
      method: "POST",
      url: `${RUTA}${query}`,
      headers: comoAgente(),
      payload: CUERPO as never,
    });
  }

  it("la simulación se hace en pausa: no escribe, y es cuando conviene ver qué cambiaría", async () => {
    const r = await enviar("?simular=true");
    expect(r.statusCode).toBe(200);
    expect(sincronizarMock).toHaveBeenCalledTimes(1);
    expect(sincronizarMock.mock.calls[0][1]).toMatchObject({ simular: true });
  });

  it("también con simular=1", async () => {
    const r = await enviar("?simular=1");
    expect(r.statusCode).toBe(200);
    expect(sincronizarMock.mock.calls[0][1]).toMatchObject({ simular: true });
  });

  it("aplicar de verdad sigue parado por la pausa (409 pausa)", async () => {
    const r = await enviar();
    expect(r.statusCode).toBe(409);
    expect(r.json().codigo).toBe("pausa");
    expect(sincronizarMock).not.toHaveBeenCalled();
  });

  it.each(["?simular=false", "?simular=0"])(
    "%s no es una simulación: 409 pausa",
    async (query) => {
      const r = await enviar(query);
      expect(r.statusCode).toBe(409);
      expect(r.json().codigo).toBe("pausa");
      expect(sincronizarMock).not.toHaveBeenCalled();
    }
  );

  it("una consulta que no se entiende no exime de la pausa", async () => {
    for (const query of ["?simular=quizas", "?simular=true&simular=false"]) {
      const r = await enviar(query);
      expect(r.statusCode).toBe(409);
      expect(r.json().codigo).toBe("pausa");
    }
    expect(sincronizarMock).not.toHaveBeenCalled();
  });

  it("la simulación sigue exigiendo el alcance «conocimiento»", async () => {
    mock.growthTokenAgente.findUnique.mockResolvedValue(
      registroDeToken({ alcances: ["leer", "escribir"] })
    );
    const r = await enviar("?simular=true");
    expect(r.statusCode).toBe(403);
    expect(sincronizarMock).not.toHaveBeenCalled();
  });
});
