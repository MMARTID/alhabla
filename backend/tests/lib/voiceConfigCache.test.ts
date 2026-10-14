import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  claveDeCacheDeVoz,
  invalidarCacheDeVoz,
} from "../../src/lib/voiceConfigCache.js";
import { borrarClave } from "../../src/lib/almacenTemporal.js";

vi.mock("../../src/lib/almacenTemporal.js", () => ({
  borrarClave: vi.fn(),
}));

describe("invalidarCacheDeVoz", () => {
  const del = vi.mocked(borrarClave);
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    del.mockReset().mockResolvedValue(undefined);
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("borra la clave voice_config:<negocio> y solo esa", async () => {
    await invalidarCacheDeVoz("biz_1");

    expect(claveDeCacheDeVoz("biz_1")).toBe("voice_config:biz_1");
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith("voice_config:biz_1");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("si el borrado falla no lanza y lo registra con el negocio, firmado [Calendar] por defecto", async () => {
    const fallo = new Error("Postgres caído");
    del.mockRejectedValue(fallo);

    await expect(invalidarCacheDeVoz("biz_1")).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      "[Calendar] No se pudo invalidar la caché de configuración de voz para biz_1:",
      fallo
    );
  });

  it("firma el log con el prefijo del módulo que la llama", async () => {
    const fallo = new Error("Postgres caído");
    del.mockRejectedValue(fallo);

    await invalidarCacheDeVoz("biz_1", "[Phone]");

    expect(consoleError).toHaveBeenCalledWith(
      "[Phone] No se pudo invalidar la caché de configuración de voz para biz_1:",
      fallo
    );
  });

  it("tampoco lanza si el almacén falla al instante", async () => {
    del.mockImplementation(() => {
      throw new Error("Prisma sin conectar");
    });

    await expect(
      invalidarCacheDeVoz("biz_1", "[Booking settings]")
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "[Booking settings] No se pudo invalidar la caché de configuración de voz para biz_1:",
      expect.any(Error)
    );
  });
});
