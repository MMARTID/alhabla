import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  marcarPataSinCall,
  motivoDePataSinCall,
} from "../../../src/adapters/telnyx/patasSinCall.js";

const { mockAlmacen } = vi.hoisted(() => ({
  mockAlmacen: { guardarClave: vi.fn(), leerClave: vi.fn() },
}));

vi.mock("../../../src/lib/almacenTemporal.js", () => mockAlmacen);

describe("patas sin Call (transferencia al dueño, entrante de la comprobación)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAlmacen.guardarClave.mockResolvedValue(undefined);
    mockAlmacen.leerClave.mockResolvedValue(null);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marca la pata con su motivo y un TTL de un día, y la recupera por call_control_id", async () => {
    await marcarPataSinCall("v3:abc", "transferencia");

    expect(mockAlmacen.guardarClave).toHaveBeenCalledWith(
      "telnyx:pata_sin_call:v3:abc",
      "transferencia",
      24 * 3600 * 1000
    );

    mockAlmacen.leerClave.mockResolvedValue("transferencia");
    await expect(motivoDePataSinCall("v3:abc")).resolves.toBe("transferencia");
    expect(mockAlmacen.leerClave).toHaveBeenCalledWith(
      "telnyx:pata_sin_call:v3:abc"
    );
  });

  it("sin marca (o con un valor extraño) devuelve null", async () => {
    await expect(motivoDePataSinCall("v3:nada")).resolves.toBeNull();
    mockAlmacen.leerClave.mockResolvedValue("otra cosa");
    await expect(motivoDePataSinCall("v3:nada")).resolves.toBeNull();
  });

  it("si el almacén falla no lanza: lo dice en el log y se comporta como si no hubiera marca", async () => {
    mockAlmacen.guardarClave.mockRejectedValue(new Error("Postgres caído"));
    mockAlmacen.leerClave.mockRejectedValue(new Error("Postgres caído"));

    await expect(
      marcarPataSinCall("v3:abc", "comprobacion")
    ).resolves.toBeUndefined();
    await expect(motivoDePataSinCall("v3:abc")).resolves.toBeNull();

    expect(console.error).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("motivo=comprobacion")
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Postgres caído")
    );
  });
});
