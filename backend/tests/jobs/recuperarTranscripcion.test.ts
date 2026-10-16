import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    call: { findUnique: vi.fn() },
    transcript: { upsert: vi.fn() },
  },
}));

vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: { listConversationMessages: vi.fn() },
}));

vi.mock("../../src/lib/cloudTasks.js", () => ({
  enqueueRecuperarTranscripcionJob: vi.fn(),
}));

import { prisma } from "../../src/lib/prisma.js";
import { telnyxAiAdapter } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";
import { enqueueRecuperarTranscripcionJob } from "../../src/lib/cloudTasks.js";
import {
  ESPERAS_RECUPERAR_TRANSCRIPCION_MS,
  MAX_INTENTOS_RECUPERAR_TRANSCRIPCION,
  processRecuperarTranscripcionJob,
  programarRecuperacionDeTranscripcion,
} from "../../src/jobs/recuperarTranscripcion.js";

const mockedCallFindUnique = vi.mocked(prisma.call.findUnique);
const mockedTranscriptUpsert = vi.mocked(prisma.transcript.upsert);
const mockedListConversationMessages = vi.mocked(
  telnyxAiAdapter.listConversationMessages
);
const mockedEnqueue = vi.mocked(enqueueRecuperarTranscripcionJob);

const AHORA = new Date("2026-09-24T09:55:50.000Z");
const LLAMADA = {
  id: "cmufcsz4b0006s601kncxcf5m",
  businessId: "biz_infinity",
  transcript: null,
};
const JOB = { callId: LLAMADA.id, conversationId: "conv_1" };

describe("processRecuperarTranscripcionJob (hallazgo 10 de la auditoría del 16-10)", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    vi.spyOn(console, "log").mockImplementation(() => {});
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedCallFindUnique.mockResolvedValue(LLAMADA as any);
    mockedTranscriptUpsert.mockResolvedValue({} as any);
    mockedEnqueue.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("guarda la transcripción cuando Telnyx ya tiene los mensajes, en orden", async () => {
    mockedListConversationMessages.mockResolvedValue([
      { role: "assistant", text: "¿Me repites?", sentAt: "2026-09-24T09:54:31Z" },
      { role: "user", text: "Llamadme", sentAt: "2026-09-24T09:54:04Z" },
    ]);

    await processRecuperarTranscripcionJob({ ...JOB, intento: 1 });

    expect(mockedListConversationMessages).toHaveBeenCalledWith("conv_1");
    expect(mockedTranscriptUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { callId: LLAMADA.id },
        create: expect.objectContaining({
          callId: LLAMADA.id,
          fullText: "user: Llamadme\nassistant: ¿Me repites?",
        }),
      })
    );
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it("con 0 mensajes programa el siguiente intento con su espera y lo dice con negocio, llamada y conversación", async () => {
    mockedListConversationMessages.mockResolvedValue([]);

    await processRecuperarTranscripcionJob({ ...JOB, intento: 1 });

    expect(mockedTranscriptUpsert).not.toHaveBeenCalled();
    expect(mockedEnqueue).toHaveBeenCalledWith(
      { callId: LLAMADA.id, conversationId: "conv_1", intento: 2 },
      new Date(AHORA.getTime() + ESPERAS_RECUPERAR_TRANSCRIPCION_MS[1])
    );
    const aviso = String(warn.mock.calls[0][0]);
    expect(aviso).toContain("biz_infinity");
    expect(aviso).toContain(LLAMADA.id);
    expect(aviso).toContain("conv_1");
  });

  it("si la descarga falla también reintenta, en vez de lanzar", async () => {
    mockedListConversationMessages.mockRejectedValue(new Error("Telnyx 503"));

    await expect(
      processRecuperarTranscripcionJob({ ...JOB, intento: 2 })
    ).resolves.toBeUndefined();

    expect(mockedEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ intento: 3 }),
      expect.any(Date)
    );
    expect(String(warn.mock.calls[0][0])).toContain("Telnyx 503");
  });

  it("tras el último intento la da por perdida con un error, sin programar más", async () => {
    mockedListConversationMessages.mockResolvedValue([]);

    await processRecuperarTranscripcionJob({
      ...JOB,
      intento: MAX_INTENTOS_RECUPERAR_TRANSCRIPCION,
    });

    expect(mockedEnqueue).not.toHaveBeenCalled();
    const mensaje = String(error.mock.calls[0][0]);
    expect(mensaje).toContain("PERDIDA");
    expect(mensaje).toContain("biz_infinity");
    expect(mensaje).toContain(LLAMADA.id);
    expect(mensaje).toContain("conv_1");
  });

  it("no vuelve a pedir nada si la transcripción ya está guardada (tarea repetida)", async () => {
    mockedCallFindUnique.mockResolvedValue({
      ...LLAMADA,
      transcript: { id: "tr_1" },
    } as any);

    await processRecuperarTranscripcionJob(JOB);

    expect(mockedListConversationMessages).not.toHaveBeenCalled();
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it("ignora una llamada que ya no existe", async () => {
    mockedCallFindUnique.mockResolvedValue(null);

    await processRecuperarTranscripcionJob(JOB);

    expect(mockedListConversationMessages).not.toHaveBeenCalled();
    expect(mockedEnqueue).not.toHaveBeenCalled();
  });

  it("si la BD falla lanza, para que Cloud Tasks lo repita", async () => {
    mockedCallFindUnique.mockRejectedValue(new Error("P1017"));

    await expect(processRecuperarTranscripcionJob(JOB)).rejects.toThrow(
      "P1017"
    );
  });
});

describe("programarRecuperacionDeTranscripcion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("el primer intento va a los 2 minutos", async () => {
    mockedEnqueue.mockResolvedValue(undefined);

    await programarRecuperacionDeTranscripcion({
      businessId: "biz_infinity",
      callRowId: LLAMADA.id,
      conversationId: "conv_1",
      intento: 1,
    });

    expect(mockedEnqueue).toHaveBeenCalledWith(
      { callId: LLAMADA.id, conversationId: "conv_1", intento: 1 },
      new Date(AHORA.getTime() + 2 * 60_000)
    );
  });

  it("no lanza si no se puede encolar, pero lo dice en voz alta", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedEnqueue.mockRejectedValue(new Error("UNAVAILABLE"));

    await expect(
      programarRecuperacionDeTranscripcion({
        businessId: "biz_infinity",
        callRowId: LLAMADA.id,
        conversationId: "conv_1",
        intento: 1,
      })
    ).resolves.toBeUndefined();

    const mensaje = String(error.mock.calls[0][0]);
    expect(mensaje).toContain("biz_infinity");
    expect(mensaje).toContain("conv_1");
    expect(mensaje).toContain("UNAVAILABLE");
  });
});
