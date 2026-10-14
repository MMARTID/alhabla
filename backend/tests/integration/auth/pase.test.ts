import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import { canjearPase, crearPase } from "../../../src/modules/auth/pase.js";
import { resetDb } from "../helpers/db.js";
import { createTestBusiness } from "../helpers/fixtures.js";

// Contra Postgres real (claves_temporales): un solo uso, caducidad,
// aislamiento entre pases y borrado con el negocio. Lo que la web de
// marketing y la app se pasan entre dominios.
describe("pase de un solo uso (integración)", () => {
  let negocio1: string;
  let negocio2: string;

  beforeEach(async () => {
    await resetDb();
    negocio1 = (await createTestBusiness()).id;
    negocio2 = (await createTestBusiness()).id;
  });

  it("se canjea una sola vez y devuelve exactamente el usuario con el que se creó", async () => {
    const pase = await crearPase({ id: "user_1", businessId: negocio1 });
    expect(pase).toMatch(/^[0-9a-f]{64}$/);
    const otro = await crearPase({ id: "user_2", businessId: negocio2 });
    expect(otro).not.toBe(pase);

    expect(await canjearPase(pase!)).toEqual({
      id: "user_1",
      businessId: negocio1,
    });
    expect(await canjearPase(pase!)).toBeNull();
    expect(await canjearPase(otro!)).toEqual({
      id: "user_2",
      businessId: negocio2,
    });
    expect(
      await prisma.claveTemporal.count({
        where: { clave: { startsWith: "auth:pase:" } },
      })
    ).toBe(0);
  });

  it("dos canjes a la vez del mismo pase: solo uno entra", async () => {
    const pase = await crearPase({ id: "user_1", businessId: negocio1 });
    const resultados = await Promise.all([
      canjearPase(pase!),
      canjearPase(pase!),
      canjearPase(pase!),
    ]);
    expect(resultados.filter((r) => r !== null)).toHaveLength(1);
  });

  it("caduca a los 60 s y no admite códigos inventados", async () => {
    const antes = Date.now();
    const pase = await crearPase({ id: "user_1", businessId: negocio1 });
    const fila = await prisma.claveTemporal.findUniqueOrThrow({
      where: { clave: `auth:pase:${pase}` },
    });
    const vidaMs = fila.expiraEn.getTime() - antes;
    expect(vidaMs).toBeGreaterThan(50_000);
    expect(vidaMs).toBeLessThanOrEqual(61_000);
    expect(fila.businessId).toBe(negocio1);
    expect(await canjearPase("f".repeat(64))).toBeNull();
    expect(await canjearPase("no-es-un-pase")).toBeNull();
  });

  it("un pase caducado no se canjea aunque su fila siga", async () => {
    const pase = await crearPase({ id: "user_1", businessId: negocio1 });
    await prisma.claveTemporal.update({
      where: { clave: `auth:pase:${pase}` },
      data: { expiraEn: new Date(Date.now() - 1_000) },
    });
    expect(await canjearPase(pase!)).toBeNull();
  });

  it("se borra con el negocio", async () => {
    const pase = await crearPase({ id: "user_1", businessId: negocio1 });
    await prisma.business.delete({ where: { id: negocio1 } });
    expect(await canjearPase(pase!)).toBeNull();
  });
});
