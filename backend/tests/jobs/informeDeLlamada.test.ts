import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  esquemaDelInforme,
  instruccionesDelInforme,
  MODELO_DEL_INFORME,
  pedirInformeDeLlamada,
  processInformeDeLlamadaJob,
  transcripcionParaElInforme,
} from "../../src/jobs/informeDeLlamada.js";
import { prisma } from "../../src/lib/prisma.js";
import { telnyxAiAdapter } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";
import { procesarInformeFinal } from "../../src/modules/whatsapp/recados.js";
import { guardarIdiomaDelCliente } from "../../src/lib/idiomaDelCliente.js";
import { enqueueInformeDeLlamadaJob } from "../../src/lib/cloudTasks.js";
import { InformeFinalSchema } from "../../src/modules/whatsapp/recados.js";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: { call: { findUnique: vi.fn() } },
}));
vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: { completarConEsquema: vi.fn() },
}));
vi.mock("../../src/modules/whatsapp/recados.js", async (original) => ({
  ...(await original<typeof import("../../src/modules/whatsapp/recados.js")>()),
  procesarInformeFinal: vi.fn(),
}));
vi.mock("../../src/lib/idiomaDelCliente.js", () => ({
  guardarIdiomaDelCliente: vi.fn(),
}));
vi.mock("../../src/lib/cloudTasks.js", () => ({
  enqueueInformeDeLlamadaJob: vi.fn(),
}));

const mockedFindUnique = vi.mocked(prisma.call.findUnique);
const mockedCompletar = vi.mocked(telnyxAiAdapter.completarConEsquema);
const mockedProcesar = vi.mocked(procesarInformeFinal);
const mockedIdioma = vi.mocked(guardarIdiomaDelCliente);

const MENSAJES = [
  { role: "assistant", text: "Peluquería Ana, te atiende una inteligencia artificial." },
  { role: "user", text: "Quería dejar un recado para Ana, que me llame." },
  { role: "assistant", text: "" },
  { role: "tool", text: `{"services":"${"x".repeat(3000)}"}` },
  { role: "assistant", text: "¿A este mismo número?" },
  { role: "user", text: "Sí, a este. Soy Lucía." },
];

function llamada(cambios: Record<string, unknown> = {}) {
  return {
    id: "call_1",
    callId: "v3:control",
    businessId: "biz_1",
    voiceProvider: "telnyx",
    fromNumber: "+34612345678",
    business: { id: "biz_1", name: "Peluquería Ana", timezone: "Europe/Madrid" },
    transcript: { messages: MENSAJES },
    ...cambios,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mockedProcesar.mockResolvedValue({ outcome: "guardado", leadId: "lead_1" });
});

describe("transcripcionParaElInforme", () => {
  it("una línea por mensaje con quién habla, sin los vacíos y con las respuestas largas de tools recortadas", () => {
    const texto = transcripcionParaElInforme(MENSAJES);
    const lineas = texto.split("\n");
    expect(lineas).toHaveLength(5);
    expect(lineas[0]).toBe(
      "Recepcionista: Peluquería Ana, te atiende una inteligencia artificial."
    );
    expect(lineas[1]).toBe("Cliente: Quería dejar un recado para Ana, que me llame.");
    expect(lineas[2]!.startsWith("Respuesta de una herramienta: ")).toBe(true);
    expect(lineas[2]!.length).toBeLessThan(1_600);
  });

  it("sin mensajes, nada", () => {
    expect(transcripcionParaElInforme(null)).toBe("");
  });
});

describe("esquemaDelInforme", () => {
  it("todos los campos obligatorios, con el recado y el idioma anulables y que_paso delante", () => {
    const esquema = esquemaDelInforme() as {
      properties: Record<string, Record<string, unknown>>;
      required: string[];
    };
    expect(Object.keys(esquema.properties)[0]).toBe("que_paso");
    expect(esquema.required).toEqual(Object.keys(esquema.properties));
    expect(esquema.properties.recado!.anyOf).toEqual([
      expect.objectContaining({ type: "object", required: ["motivo"] }),
      { type: "null" },
    ]);
    expect(esquema.properties.idioma_del_cliente!.anyOf).toContainEqual({
      type: "null",
    });
  });

  it("lo que devuelve con «nada» explícito lo acepta el informe de siempre como sin recado", () => {
    const leido = InformeFinalSchema.parse({
      que_paso: "Reservó un corte.",
      resultado: "RESOLVED",
      motivo_escalada: "NO_APLICA",
      fallo_de_tool: false,
      servicio_pedido: "",
      recado: null,
      idioma_del_cliente: null,
      dudas_sin_respuesta: [],
    });
    expect(leido.recado).toBeNull();
    expect(leido.dudas_sin_respuesta).toEqual([]);
  });
});

describe("instruccionesDelInforme", () => {
  it("lleva el negocio, el número de la llamada para el recado y el orden del resultado", () => {
    const texto = instruccionesDelInforme({
      negocio: "Peluquería Ana",
      telefonoDeLaLlamada: "+34612345678",
    });
    expect(texto).toContain("«Peluquería Ana»");
    expect(texto).toContain("al número desde el que llama (+34612345678)");
    expect(texto).toContain("1. NO_ANSWER: el cliente no llegó a decir qué quería.");
    expect(texto.indexOf("2. ESCALATED")).toBeLessThan(texto.indexOf("5. RESOLVED"));
  });
});

describe("processInformeDeLlamadaJob", () => {
  it("pide el informe al modelo con la transcripción y lo procesa como el de la tool", async () => {
    mockedFindUnique.mockResolvedValue(llamada() as any);
    mockedCompletar.mockResolvedValue({
      contenido: JSON.stringify({
        que_paso: "Dejó un recado.",
        resultado: "LEAD_CAPTURED",
        motivo_escalada: "NO_APLICA",
        fallo_de_tool: false,
        servicio_pedido: "",
        recado: {
          nombre: "Lucía",
          telefono: "+34612345678",
          motivo: "Que Ana la llame",
          quiere_que_le_llamen: true,
        },
        idioma_del_cliente: "es-ES",
        dudas_sin_respuesta: [],
      }),
      tokens: { entrada: 900, salida: 120 },
    });

    await processInformeDeLlamadaJob({ callId: "call_1" });

    const peticion = mockedCompletar.mock.calls[0]![0];
    expect(peticion.modelo).toBe(MODELO_DEL_INFORME);
    expect(peticion.mensajes[0]!.role).toBe("system");
    expect(peticion.mensajes[1]!.content).toContain(
      "Cliente: Sí, a este. Soy Lucía."
    );
    expect(peticion.esquema.schema).toEqual(esquemaDelInforme());
    expect(mockedProcesar).toHaveBeenCalledWith({
      business: { id: "biz_1", name: "Peluquería Ana", timezone: "Europe/Madrid" },
      callControlId: "v3:control",
      params: expect.objectContaining({
        resultado: "LEAD_CAPTURED",
        recado: expect.objectContaining({ nombre: "Lucía" }),
      }),
    });
    expect(mockedIdioma).toHaveBeenCalledWith(
      expect.objectContaining({
        callId: "v3:control",
        businessId: "biz_1",
        idioma: "es-ES",
      })
    );
  });

  it("si el cliente no llegó a hablar, NO_ANSWER sin gastar el modelo", async () => {
    mockedFindUnique.mockResolvedValue(
      llamada({
        transcript: { messages: [{ role: "assistant", text: "Peluquería Ana, ¿dígame?" }] },
      }) as any
    );
    await processInformeDeLlamadaJob({ callId: "call_1" });
    expect(mockedCompletar).not.toHaveBeenCalled();
    expect(mockedProcesar).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { resultado: "NO_ANSWER", motivo_escalada: "NO_APLICA" },
      })
    );
  });

  it("sin transcripción todavía, espera a que llegue (lo pide la recuperación)", async () => {
    mockedFindUnique.mockResolvedValue(llamada({ transcript: null }) as any);
    await processInformeDeLlamadaJob({ callId: "call_1" });
    expect(mockedCompletar).not.toHaveBeenCalled();
    expect(mockedProcesar).not.toHaveBeenCalled();
  });

  it("un chat de WhatsApp no pasa por aquí: lo informa la recepcionista", async () => {
    mockedFindUnique.mockResolvedValue(llamada({ voiceProvider: "whatsapp" }) as any);
    await processInformeDeLlamadaJob({ callId: "call_1" });
    expect(mockedCompletar).not.toHaveBeenCalled();
    expect(mockedProcesar).not.toHaveBeenCalled();
  });

  it("si el modelo falla o no devuelve un JSON, la llamada se queda sin informe y queda en el log", async () => {
    mockedFindUnique.mockResolvedValue(llamada() as any);
    mockedCompletar.mockRejectedValueOnce(new Error("Telnyx 503"));
    await processInformeDeLlamadaJob({ callId: "call_1" });
    mockedCompletar.mockResolvedValueOnce({
      contenido: "no es json",
      tokens: { entrada: null, salida: null },
    });
    await processInformeDeLlamadaJob({ callId: "call_1" });
    expect(mockedProcesar).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("se queda sin informe")
    );
  });

  it("si la BD falla, lanza para que Cloud Tasks lo repita", async () => {
    mockedFindUnique.mockRejectedValue(new Error("BD caída"));
    await expect(processInformeDeLlamadaJob({ callId: "call_1" })).rejects.toThrow(
      "BD caída"
    );
  });
});

describe("pedirInformeDeLlamada", () => {
  it("encola el job y, si falla, no lanza pero lo deja en el log con negocio y llamada", async () => {
    await pedirInformeDeLlamada({ callRowId: "call_1", businessId: "biz_1", origen: "x" });
    expect(enqueueInformeDeLlamadaJob).toHaveBeenCalledWith({ callId: "call_1" });

    vi.mocked(enqueueInformeDeLlamadaJob).mockRejectedValueOnce(new Error("cola"));
    await expect(
      pedirInformeDeLlamada({ callRowId: "call_1", businessId: "biz_1", origen: "x" })
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/call_1 \(negocio biz_1.*cola/)
    );
  });
});
