import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  acquireBookingLock,
  acquireLock,
  releaseBookingLock,
  releaseLock,
} from "../../src/lib/bookingLock.js";
import { adquirirCerrojo, liberarCerrojo } from "../../src/lib/cerrojos.js";

// Desde el corte de Redis (PR A), bookingLock.ts es un envoltorio de
// lib/cerrojos.ts con las mismas firmas de siempre: el algoritmo (reintentos,
// presupuesto, tokens, compare-and-delete y modo compatibilidad) se prueba en
// tests/lib/cerrojos.test.ts y contra Postgres y Redis reales en
// tests/integration/lib/cerrojos.test.ts.
vi.mock("../../src/lib/cerrojos.js", () => ({
  adquirirCerrojo: vi.fn(),
  liberarCerrojo: vi.fn(),
}));

const adquirir = vi.mocked(adquirirCerrojo);
const liberar = vi.mocked(liberarCerrojo);

describe("acquireLock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("«adquirido» ⇒ el token propio", async () => {
    adquirir.mockResolvedValueOnce({ estado: "adquirido", token: "tok-1" });

    await expect(acquireLock("billing_usage:biz_1", 90_000, 0)).resolves.toBe(
      "tok-1"
    );
    expect(adquirir).toHaveBeenCalledWith("billing_usage:biz_1", 90_000, 0);
  });

  it("«ocupado» ⇒ null", async () => {
    adquirir.mockResolvedValueOnce({ estado: "ocupado" });

    await expect(acquireLock("k", 1_000, 0)).resolves.toBeNull();
  });

  it("«error» ⇒ null (falla cerrado: quien llama no entra en la sección crítica)", async () => {
    adquirir.mockResolvedValueOnce({ estado: "error", motivo: "ECONNREFUSED" });

    await expect(acquireLock("k", 1_000, 0)).resolves.toBeNull();
  });
});

describe("acquireBookingLock y releaseBookingLock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("coge booking_lock:<negocio> con 45 s de TTL y 6 s de presupuesto (la misma clave que usaban las revisiones de Redis)", async () => {
    adquirir.mockResolvedValueOnce({ estado: "adquirido", token: "tok-r" });

    await expect(acquireBookingLock("biz_1")).resolves.toBe("tok-r");
    expect(adquirir).toHaveBeenCalledWith("booking_lock:biz_1", 45_000, 6_000);
  });

  it("devuelve null si la agenda está ocupada", async () => {
    adquirir.mockResolvedValueOnce({ estado: "ocupado" });

    await expect(acquireBookingLock("biz_1")).resolves.toBeNull();
  });

  it("libera con su clave y su token (compare-and-delete en lib/cerrojos.ts)", async () => {
    liberar.mockResolvedValueOnce(undefined);

    await releaseBookingLock("biz_1", "token-abc");

    expect(liberar).toHaveBeenCalledWith("booking_lock:biz_1", "token-abc");
  });
});

describe("releaseLock", () => {
  it("delega en liberarCerrojo con la misma clave y token", async () => {
    liberar.mockResolvedValueOnce(undefined);

    await expect(
      releaseLock("phone_provision_lock:biz_1", "tok")
    ).resolves.toBeUndefined();
    expect(liberar).toHaveBeenCalledWith("phone_provision_lock:biz_1", "tok");
  });
});
