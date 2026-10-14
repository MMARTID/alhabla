import { describe, it, expect } from "vitest";
import {
  cerrarRedisDeCompatibilidad,
  conectarRedisDeCompatibilidad,
  pingDeRedisDeCompatibilidad,
} from "../../../src/lib/redisDeCompatibilidad.js";

// /health (server.ts) solo exige Redis mientras haya cliente de los cerrojos,
// y lo comprueba por ese cliente, el que decide si se puede reservar.
describe("Redis en /health", () => {
  it("con el cliente de los cerrojos, PING por él; sin él, Redis no cuenta", async () => {
    const ping = pingDeRedisDeCompatibilidad();
    expect(ping).not.toBeNull();
    await expect(ping!()).resolves.toBe("PONG");

    await cerrarRedisDeCompatibilidad();
    try {
      expect(pingDeRedisDeCompatibilidad()).toBeNull();
      // Un ping ya repartido a /health antes del cierre falla, no se cuelga.
      await expect(ping!()).rejects.toThrow();
    } finally {
      await conectarRedisDeCompatibilidad();
    }
  });
});
