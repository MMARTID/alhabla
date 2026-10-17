import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "../../../src/lib/prisma.js";
import { invalidarCacheDeVoz } from "../../../src/lib/voiceConfigCache.js";
import { syncAgentToTelnyx } from "../../../src/lib/telnyxAgentSync.js";
import { guardarInformacionDelNegocio } from "../../../src/modules/businesses/informacion.js";

vi.mock("../../../src/lib/prisma.js", () => ({
  prisma: { business: { updateMany: vi.fn() } },
}));
vi.mock("../../../src/lib/voiceConfigCache.js", () => ({
  invalidarCacheDeVoz: vi.fn(),
}));
vi.mock("../../../src/lib/telnyxAgentSync.js", () => ({
  syncAgentToTelnyx: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.mocked(prisma.business.updateMany).mockResolvedValue({ count: 1 });
});

describe("guardarInformacionDelNegocio", () => {
  it("guarda solo si el texto sigue siendo el esperado, invalida la caché y sincroniza Telnyx", async () => {
    const orden: string[] = [];
    vi.mocked(prisma.business.updateMany).mockImplementation((async () => {
      orden.push("update");
      return { count: 1 };
    }) as never);
    vi.mocked(invalidarCacheDeVoz).mockImplementation(async () => {
      orden.push("cache");
    });
    vi.mocked(syncAgentToTelnyx).mockImplementation(async () => {
      orden.push("telnyx");
    });

    const r = await guardarInformacionDelNegocio("biz_1", {
      esperado: "Estamos en la calle Mayor 1.",
      nuevo: "Estamos en la calle Mayor 1.\nAceptamos Bizum.",
    });

    expect(r).toEqual({ guardado: true, sincronizado: true });
    expect(prisma.business.updateMany).toHaveBeenCalledWith({
      where: { id: "biz_1", businessDetails: "Estamos en la calle Mayor 1." },
      data: {
        businessDetails: "Estamos en la calle Mayor 1.\nAceptamos Bizum.",
      },
    });
    expect(orden).toEqual(["update", "cache", "telnyx"]);
  });

  it("si otro lo cambió entretanto no guarda ni sincroniza nada", async () => {
    vi.mocked(prisma.business.updateMany).mockResolvedValue({ count: 0 });

    expect(
      await guardarInformacionDelNegocio("biz_1", {
        esperado: null,
        nuevo: "Aceptamos Bizum.",
      })
    ).toEqual({ guardado: false, sincronizado: false });
    expect(prisma.business.updateMany).toHaveBeenCalledWith({
      where: { id: "biz_1", businessDetails: null },
      data: { businessDetails: "Aceptamos Bizum." },
    });
    expect(invalidarCacheDeVoz).not.toHaveBeenCalled();
    expect(syncAgentToTelnyx).not.toHaveBeenCalled();
  });

  it("si la sincronización lanza, el texto queda guardado y se registra alto para el reconciliador", async () => {
    vi.mocked(syncAgentToTelnyx).mockRejectedValue(new Error("Telnyx 500"));

    expect(
      await guardarInformacionDelNegocio("biz_1", {
        esperado: null,
        nuevo: "Aceptamos Bizum.",
      })
    ).toEqual({ guardado: true, sincronizado: false });
    expect(syncAgentToTelnyx).toHaveBeenCalledWith("biz_1");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("biz_1 guardada pero la recepcionista no se pudo sincronizar")
    );
  });
});
