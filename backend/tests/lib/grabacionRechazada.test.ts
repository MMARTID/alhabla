import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  borrarGrabacionesDeTelnyx,
  registrarGrabacionRechazada,
} from "../../src/lib/grabacionRechazada.js";
import { prisma } from "../../src/lib/prisma.js";
import { telnyxAiAdapter } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    call: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: { stopRecording: vi.fn(), deleteRecording: vi.fn() },
}));

const mockedCallFindFirst = vi.mocked(prisma.call.findFirst);
const mockedCallUpdateMany = vi.mocked(prisma.call.updateMany);
const mockedStopRecording = vi.mocked(telnyxAiAdapter.stopRecording);
const mockedDeleteRecording = vi.mocked(telnyxAiAdapter.deleteRecording);

const entrada = {
  callId: "v3:ctrl_1",
  businessId: "biz_1",
  etiqueta: "llamada v3:ctrl_1",
};

describe("registrarGrabacionRechazada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("en Telnyx anota la marca antes de parar la grabación", async () => {
    mockedCallFindFirst.mockResolvedValue({
      id: "call_db_1",
      voiceProvider: "telnyx",
      grabacionRechazadaAt: null,
    } as any);
    const orden: string[] = [];
    mockedCallUpdateMany.mockImplementation((async () => {
      orden.push("marca");
      return { count: 1 };
    }) as any);
    mockedStopRecording.mockImplementation(async () => {
      orden.push("parar");
    });

    await expect(registrarGrabacionRechazada(entrada)).resolves.toBe(
      "registrado"
    );

    // Solo la llamada de ese negocio: el callId viene del webhook, pero el
    // negocio manda.
    expect(mockedCallFindFirst).toHaveBeenCalledWith({
      where: { callId: "v3:ctrl_1", businessId: "biz_1" },
      select: { id: true, voiceProvider: true, grabacionRechazadaAt: true },
    });
    expect(mockedCallUpdateMany).toHaveBeenCalledWith({
      where: { id: "call_db_1", grabacionRechazadaAt: null },
      data: { grabacionRechazadaAt: expect.any(Date) },
    });
    expect(mockedStopRecording).toHaveBeenCalledWith("v3:ctrl_1");
    // El call.recording.saved de lo ya grabado llega en cuanto se para y
    // tiene que encontrar la marca.
    expect(orden).toEqual(["marca", "parar"]);
  });

  it("si Telnyx no la para, queda registrada igual y lo dice en el log", async () => {
    mockedCallFindFirst.mockResolvedValue({
      id: "call_db_1",
      voiceProvider: "telnyx",
      grabacionRechazadaAt: null,
    } as any);
    mockedStopRecording.mockRejectedValue(new Error("90018 no recording"));

    await expect(registrarGrabacionRechazada(entrada)).resolves.toBe(
      "registrado"
    );

    expect(mockedCallUpdateMany).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/Telnyx no paró la grabación \(negocio biz_1\).*90018/)
    );
  });

  it("en Retell solo la anota: no se puede parar a mitad de llamada", async () => {
    mockedCallFindFirst.mockResolvedValue({
      id: "call_db_1",
      voiceProvider: "retell",
      grabacionRechazadaAt: null,
    } as any);

    await expect(
      registrarGrabacionRechazada({ ...entrada, callId: "call_retell_1" })
    ).resolves.toBe("registrado");

    expect(mockedCallUpdateMany).toHaveBeenCalled();
    expect(mockedStopRecording).not.toHaveBeenCalled();
  });

  it("si ya la había pedido, no la vuelve a parar", async () => {
    mockedCallFindFirst.mockResolvedValue({
      id: "call_db_1",
      voiceProvider: "telnyx",
      grabacionRechazadaAt: new Date(),
    } as any);

    await expect(registrarGrabacionRechazada(entrada)).resolves.toBe(
      "ya_registrado"
    );

    expect(mockedCallUpdateMany).not.toHaveBeenCalled();
    expect(mockedStopRecording).not.toHaveBeenCalled();
  });

  it("sin la llamada en la base de datos no hace nada y lo dice en el log", async () => {
    mockedCallFindFirst.mockResolvedValue(null);

    await expect(registrarGrabacionRechazada(entrada)).resolves.toBe(
      "sin_llamada"
    );

    expect(mockedStopRecording).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("la grabación se guardará")
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
