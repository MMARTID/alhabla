import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  guardarIdiomaDelCliente,
  idiomaGuardadoDelCliente,
} from "../../src/lib/idiomaDelCliente.js";
import { prisma } from "../../src/lib/prisma.js";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    call: { findFirst: vi.fn() },
    clienteDelNegocio: { upsert: vi.fn(), findUnique: vi.fn() },
  },
}));

const mockedCallFindFirst = vi.mocked(prisma.call.findFirst);
const mockedUpsert = vi.mocked(prisma.clienteDelNegocio.upsert);
const mockedFindUnique = vi.mocked(prisma.clienteDelNegocio.findUnique);

const llamada = (fromNumber: string | null) =>
  ({
    fromNumber,
    business: {
      phone: "+34930000001",
      telnyxPhoneNumber: "+34930000002",
      ownerWhatsappNumber: "+34600999999",
    },
  }) as any;

describe("guardarIdiomaDelCliente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCallFindFirst.mockResolvedValue(llamada("+34600111222"));
    mockedUpsert.mockResolvedValue({} as any);
  });

  it("lo guarda en la ficha del cliente de ese negocio, con la fecha", async () => {
    await guardarIdiomaDelCliente({
      callId: "v3:abc",
      businessId: "biz_1",
      idioma: "ca-ES",
      etiqueta: "llamada v3:abc",
    });

    // La llamada, solo de ese negocio.
    expect(mockedCallFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { callId: "v3:abc", businessId: "biz_1" },
      })
    );
    expect(mockedUpsert).toHaveBeenCalledWith({
      where: {
        businessId_telefono: { businessId: "biz_1", telefono: "+34600111222" },
      },
      create: {
        businessId: "biz_1",
        telefono: "+34600111222",
        idioma: "ca-ES",
        idiomaAt: expect.any(Date),
      },
      update: { idioma: "ca-ES", idiomaAt: expect.any(Date) },
    });
  });

  it("sin idioma (no llegó a hablar) no hace nada", async () => {
    await guardarIdiomaDelCliente({
      callId: "v3:abc",
      businessId: "biz_1",
      idioma: undefined,
      etiqueta: "llamada v3:abc",
    });

    expect(mockedCallFindFirst).not.toHaveBeenCalled();
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it("un idioma fuera del catálogo no se guarda y se dice en el log", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});

    await guardarIdiomaDelCliente({
      callId: "v3:abc",
      businessId: "biz_1",
      idioma: "klingon",
      etiqueta: "llamada v3:abc",
    });

    expect(mockedUpsert).not.toHaveBeenCalled();
    expect(aviso).toHaveBeenCalledWith(
      expect.stringMatching(/klingon.*negocio biz_1/)
    );
    aviso.mockRestore();
  });

  it.each([
    ["número oculto", "anonymous"],
    ["un teléfono del propio negocio", "+34930000002"],
  ])("con %s no guarda nada", async (_caso, from) => {
    mockedCallFindFirst.mockResolvedValue(llamada(from));

    await guardarIdiomaDelCliente({
      callId: "v3:abc",
      businessId: "biz_1",
      idioma: "en-GB",
      etiqueta: "llamada v3:abc",
    });

    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it("si la base de datos falla, no lanza: lo dice en el log", async () => {
    mockedUpsert.mockRejectedValue(new Error("BD caída"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      guardarIdiomaDelCliente({
        callId: "v3:abc",
        businessId: "biz_1",
        idioma: "en-GB",
        etiqueta: "llamada v3:abc",
      })
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/en-GB.*negocio biz_1.*BD caída/)
    );
    error.mockRestore();
  });
});

describe("idiomaGuardadoDelCliente", () => {
  const entrada = {
    businessId: "biz_1",
    telefono: "+34600111222",
    negocio: { phone: "+34930000001" },
    idiomas: ["es-ES", "en-GB", "ca-ES"] as const,
    etiqueta: "Chat cliente",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve el guardado si la recepcionista lo habla", async () => {
    mockedFindUnique.mockResolvedValue({ idioma: "en-GB" } as any);

    await expect(
      idiomaGuardadoDelCliente({ ...entrada, idiomas: [...entrada.idiomas] })
    ).resolves.toBe("en-GB");
    expect(mockedFindUnique).toHaveBeenCalledWith({
      where: {
        businessId_telefono: { businessId: "biz_1", telefono: "+34600111222" },
      },
      select: { idioma: true },
    });
  });

  it("null si no lo habla, si no hay o si no es un cliente", async () => {
    mockedFindUnique.mockResolvedValue({ idioma: "eu-ES" } as any);
    await expect(
      idiomaGuardadoDelCliente({ ...entrada, idiomas: [...entrada.idiomas] })
    ).resolves.toBeNull();

    mockedFindUnique.mockResolvedValue(null);
    await expect(
      idiomaGuardadoDelCliente({ ...entrada, idiomas: [...entrada.idiomas] })
    ).resolves.toBeNull();

    mockedFindUnique.mockClear();
    await expect(
      idiomaGuardadoDelCliente({
        ...entrada,
        idiomas: [...entrada.idiomas],
        telefono: "+34930000001",
      })
    ).resolves.toBeNull();
    expect(mockedFindUnique).not.toHaveBeenCalled();
  });

  it("si la base de datos falla, null y lo dice en el log", async () => {
    mockedFindUnique.mockRejectedValue(new Error("BD caída"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      idiomaGuardadoDelCliente({ ...entrada, idiomas: [...entrada.idiomas] })
    ).resolves.toBeNull();
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/negocio biz_1.*BD caída/)
    );
    error.mockRestore();
  });
});
