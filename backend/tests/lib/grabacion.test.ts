import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  borrarGrabacionesDeTelnyx,
  estadoDeGrabacion,
  guardarPreferenciaDeGrabacion,
  telefonoDelCliente,
  tocaPreguntarPorGrabar,
} from "../../src/lib/grabacion.js";
import { prisma } from "../../src/lib/prisma.js";
import { telnyxAiAdapter } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    call: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    clienteDelNegocio: { upsert: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: {
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    deleteRecording: vi.fn(),
  },
}));

const mockedCallFindFirst = vi.mocked(prisma.call.findFirst);
const mockedCallUpdate = vi.mocked(prisma.call.update);
const mockedCallUpdateMany = vi.mocked(prisma.call.updateMany);
const mockedClienteUpsert = vi.mocked(prisma.clienteDelNegocio.upsert);
const mockedClienteFindUnique = vi.mocked(prisma.clienteDelNegocio.findUnique);
const mockedStartRecording = vi.mocked(telnyxAiAdapter.startRecording);
const mockedStopRecording = vi.mocked(telnyxAiAdapter.stopRecording);
const mockedDeleteRecording = vi.mocked(telnyxAiAdapter.deleteRecording);

const llamada = (campos: Record<string, unknown> = {}) =>
  ({
    id: "call_db_1",
    callId: "v3:ctrl_1",
    fromNumber: "+34600111222",
    voiceProvider: "telnyx",
    grabacionPermitida: false,
    grabacionRechazadaAt: null,
    ...campos,
  }) as any;

const entrada = {
  callId: "v3:ctrl_1",
  businessId: "biz_1",
  etiqueta: "llamada v3:ctrl_1",
};

describe("estadoDeGrabacion y telefonoDelCliente", () => {
  it("traduce el permiso guardado", () => {
    expect(estadoDeGrabacion(true)).toBe("aceptada");
    expect(estadoDeGrabacion(false)).toBe("rechazada");
    expect(estadoDeGrabacion(null)).toBe("sin_preguntar");
    expect(estadoDeGrabacion(undefined)).toBe("sin_preguntar");
  });

  it("solo recuerda teléfonos E.164", () => {
    expect(telefonoDelCliente("+34600111222")).toBe("+34600111222");
    expect(telefonoDelCliente("anonymous")).toBeNull();
    expect(telefonoDelCliente("")).toBeNull();
    expect(telefonoDelCliente(null)).toBeNull();
  });

  // Con algunos desvíos la operadora presenta como llamante la línea del
  // negocio: todos sus clientes acabarían en una sola ficha.
  it("nunca recuerda un teléfono del propio negocio", () => {
    const negocio = {
      phone: "+34930000001",
      telnyxPhoneNumber: "+34930000002",
      ownerWhatsappNumber: "+34600000003",
    };
    expect(telefonoDelCliente("+34930000001", negocio)).toBeNull();
    expect(telefonoDelCliente("+34930000002", negocio)).toBeNull();
    expect(telefonoDelCliente("+34600000003", negocio)).toBeNull();
    expect(telefonoDelCliente("+34600111222", negocio)).toBe("+34600111222");
  });
});

describe("tocaPreguntarPorGrabar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedClienteFindUnique.mockResolvedValue(null);
    mockedCallUpdateMany.mockResolvedValue({ count: 1 } as any);
  });

  const sinPreguntar = (campos: Record<string, unknown> = {}) =>
    llamada({
      grabacionPreguntadaAt: null,
      business: { phone: "+34930000001" },
      ...campos,
    });

  it("a quien no lo ha decidido, sí, una vez, y lo deja anotado", async () => {
    mockedCallFindFirst.mockResolvedValue(sinPreguntar());

    await expect(tocaPreguntarPorGrabar(entrada)).resolves.toBe(true);

    expect(mockedCallFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { callId: "v3:ctrl_1", businessId: "biz_1" },
      })
    );
    expect(mockedClienteFindUnique).toHaveBeenCalledWith({
      where: {
        businessId_telefono: { businessId: "biz_1", telefono: "+34600111222" },
      },
      select: { grabacionAceptada: true },
    });
    // Atómico: dos tools a la vez no lo preguntan dos veces, ni a quien
    // contestó entre la lectura y la escritura.
    expect(mockedCallUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "call_db_1",
        grabacionPreguntadaAt: null,
        grabacionRechazadaAt: null,
        OR: [{ grabacionPermitida: null }, { grabacionPermitida: false }],
      },
      data: { grabacionPreguntadaAt: expect.any(Date) },
    });
  });

  it("si otra tool lo anotó a la vez, o ya contestó, no", async () => {
    mockedCallFindFirst.mockResolvedValue(sinPreguntar());
    mockedCallUpdateMany.mockResolvedValue({ count: 0 } as any);

    await expect(tocaPreguntarPorGrabar(entrada)).resolves.toBe(false);
  });

  it.each([
    ["ya se le preguntó en esta llamada", { grabacionPreguntadaAt: new Date() }],
    ["ya se graba (lo aceptó antes)", { grabacionPermitida: true }],
    ["pidió en esta llamada que no se grabe", { grabacionRechazadaAt: new Date() }],
  ])("si %s, no", async (_motivo, campos) => {
    mockedCallFindFirst.mockResolvedValue(sinPreguntar(campos));

    await expect(tocaPreguntarPorGrabar(entrada)).resolves.toBe(false);
    expect(mockedCallUpdateMany).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "si ya lo decidió en otra llamada (%s), no",
    async (aceptada) => {
      mockedCallFindFirst.mockResolvedValue(sinPreguntar());
      mockedClienteFindUnique.mockResolvedValue({
        grabacionAceptada: aceptada,
      } as any);

      await expect(tocaPreguntarPorGrabar(entrada)).resolves.toBe(false);
      expect(mockedCallUpdateMany).not.toHaveBeenCalled();
    }
  );

  it("con número oculto o del negocio, se le pregunta para esta llamada", async () => {
    mockedCallFindFirst.mockResolvedValue(
      sinPreguntar({ fromNumber: "+34930000001" })
    );

    await expect(tocaPreguntarPorGrabar(entrada)).resolves.toBe(true);
    expect(mockedClienteFindUnique).not.toHaveBeenCalled();
  });

  it("sin la llamada, o si falla la base de datos, no se pregunta y lo dice en el log", async () => {
    mockedCallFindFirst.mockResolvedValueOnce(null);
    await expect(tocaPreguntarPorGrabar(entrada)).resolves.toBe(false);

    mockedCallFindFirst.mockRejectedValueOnce(new Error("timeout"));
    await expect(tocaPreguntarPorGrabar(entrada)).resolves.toBe(false);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/no se pudo saber si toca preguntar.*negocio biz_1.*timeout/)
    );
  });
});

describe("guardarPreferenciaDeGrabacion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("con su sí, lo recuerda para ese negocio y teléfono y empieza a grabar en Telnyx", async () => {
    mockedCallFindFirst.mockResolvedValue(llamada());

    await expect(
      guardarPreferenciaDeGrabacion({ ...entrada, acepta: true })
    ).resolves.toBe("aceptada");

    // Solo la llamada de ese negocio: el callId viene del webhook, pero el
    // negocio manda.
    expect(mockedCallFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { callId: "v3:ctrl_1", businessId: "biz_1" },
      })
    );
    expect(mockedClienteUpsert).toHaveBeenCalledWith({
      where: {
        businessId_telefono: { businessId: "biz_1", telefono: "+34600111222" },
      },
      create: {
        businessId: "biz_1",
        telefono: "+34600111222",
        grabacionAceptada: true,
        grabacionDecididaAt: expect.any(Date),
        grabacionCallId: "v3:ctrl_1",
      },
      update: {
        grabacionAceptada: true,
        grabacionDecididaAt: expect.any(Date),
        grabacionCallId: "v3:ctrl_1",
      },
    });
    expect(mockedCallUpdate).toHaveBeenCalledWith({
      where: { id: "call_db_1" },
      data: { grabacionPermitida: true },
    });
    expect(mockedStartRecording).toHaveBeenCalledWith("v3:ctrl_1");
  });

  it("si Telnyx no empieza a grabar, el permiso queda guardado y lo dice en el log", async () => {
    mockedCallFindFirst.mockResolvedValue(llamada());
    mockedStartRecording.mockRejectedValue(new Error("90018"));

    await expect(
      guardarPreferenciaDeGrabacion({ ...entrada, acepta: true })
    ).resolves.toBe("aceptada");

    expect(mockedClienteUpsert).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/Telnyx no empezó a grabar.*negocio biz_1.*90018/)
    );
  });

  it("si ya se grababa (aceptó en otra llamada), no vuelve a empezar", async () => {
    mockedCallFindFirst.mockResolvedValue(
      llamada({ grabacionPermitida: true })
    );

    await guardarPreferenciaDeGrabacion({ ...entrada, acepta: true });

    expect(mockedStartRecording).not.toHaveBeenCalled();
    expect(mockedCallUpdate).not.toHaveBeenCalled();
  });

  it("en Retell guarda el permiso pero no graba: su audio no se guarda", async () => {
    mockedCallFindFirst.mockResolvedValue(
      llamada({ callId: "call_retell_1", voiceProvider: "retell" })
    );

    await expect(
      guardarPreferenciaDeGrabacion({
        ...entrada,
        callId: "call_retell_1",
        acepta: true,
      })
    ).resolves.toBe("aceptada");

    expect(mockedClienteUpsert).toHaveBeenCalled();
    expect(mockedStartRecording).not.toHaveBeenCalled();
  });

  it("con su no, lo recuerda y marca la llamada; sin grabación en curso no hay nada que parar", async () => {
    mockedCallFindFirst.mockResolvedValue(llamada());

    await expect(
      guardarPreferenciaDeGrabacion({ ...entrada, acepta: false })
    ).resolves.toBe("rechazada");

    expect(mockedClienteUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ grabacionAceptada: false }),
      })
    );
    expect(mockedCallUpdateMany).toHaveBeenCalledWith({
      where: { id: "call_db_1", grabacionRechazadaAt: null },
      data: { grabacionRechazadaAt: expect.any(Date) },
    });
    expect(mockedStopRecording).not.toHaveBeenCalled();
  });

  it("si se grababa, anota la marca antes de parar la grabación", async () => {
    mockedCallFindFirst.mockResolvedValue(
      llamada({ grabacionPermitida: true })
    );
    const orden: string[] = [];
    mockedCallUpdateMany.mockImplementation((async () => {
      orden.push("marca");
      return { count: 1 };
    }) as any);
    mockedStopRecording.mockImplementation(async () => {
      orden.push("parar");
    });

    await guardarPreferenciaDeGrabacion({ ...entrada, acepta: false });

    // El call.recording.saved de lo ya grabado llega en cuanto se para y
    // tiene que encontrar la marca.
    expect(orden).toEqual(["marca", "parar"]);
  });

  it("si Telnyx no la para, queda la marca y lo dice en el log", async () => {
    mockedCallFindFirst.mockResolvedValue(
      llamada({ grabacionPermitida: true })
    );
    mockedStopRecording.mockRejectedValue(new Error("90018 no recording"));

    await expect(
      guardarPreferenciaDeGrabacion({ ...entrada, acepta: false })
    ).resolves.toBe("rechazada");

    expect(mockedCallUpdateMany).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/Telnyx no paró la grabación \(negocio biz_1\).*90018/)
    );
  });

  it("con número oculto vale solo para esta llamada", async () => {
    mockedCallFindFirst.mockResolvedValue(
      llamada({ fromNumber: "anonymous", grabacionPermitida: true })
    );

    await guardarPreferenciaDeGrabacion({ ...entrada, acepta: false });

    expect(mockedClienteUpsert).not.toHaveBeenCalled();
    expect(mockedStopRecording).toHaveBeenCalledWith("v3:ctrl_1");
  });

  it("sin la llamada en la base de datos no guarda nada y lo dice en el log", async () => {
    mockedCallFindFirst.mockResolvedValue(null);

    await expect(
      guardarPreferenciaDeGrabacion({ ...entrada, acepta: true })
    ).resolves.toBe("sin_llamada");

    expect(mockedClienteUpsert).not.toHaveBeenCalled();
    expect(mockedStartRecording).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("no se guarda")
    );
  });
});

describe("borrarGrabacionesDeTelnyx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("borra todas las del leg y sigue aunque una falle", async () => {
    mockedDeleteRecording
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(undefined);

    await borrarGrabacionesDeTelnyx({
      grabaciones: [{ id: "rec_1" }, {}, { id: "rec_2" }],
      businessId: "biz_1",
      etiqueta: "llamada v3:ctrl_1",
    });

    expect(mockedDeleteRecording).toHaveBeenCalledTimes(2);
    expect(mockedDeleteRecording).toHaveBeenNthCalledWith(1, "rec_1");
    expect(mockedDeleteRecording).toHaveBeenNthCalledWith(2, "rec_2");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/no se pudo borrar en Telnyx la grabación rec_1.*negocio biz_1.*timeout/)
    );
  });
});
