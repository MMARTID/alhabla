import { beforeEach, describe, expect, it, vi } from "vitest";

const enviados: { ruta: string; cuerpo: Record<string, unknown>; llamada?: string }[] = [];
let respuestas: Record<string, unknown>[] = [];

vi.mock("../../mcp/webhooks.js", () => ({
  enviarWebhookTelnyx: vi.fn(
    async (opciones: {
      ruta: string;
      cuerpo: Record<string, unknown>;
      callControlId?: string;
      crearLlamada?: () => Promise<string>;
    }) => {
      const llamada = opciones.callControlId ?? (await opciones.crearLlamada?.());
      enviados.push({ ruta: opciones.ruta, cuerpo: opciones.cuerpo, llamada });
      return { status: 200, respuesta: respuestas.shift() ?? { success: true }, llamada };
    }
  ),
}));
vi.mock("../../mcp/llamadasSimuladas.js", () => ({
  crearLlamadaSimulada: vi.fn(async () => "sim-mcp-1"),
}));
vi.mock("../../mcp/enviosSimulados.js", () => ({
  leerEnviosSimulados: vi.fn(async () => []),
}));
vi.mock("../../mcp/sqlDeSoloLectura.js", () => ({
  ejecutarSoloLectura: vi.fn(async () => ({ filas: [] })),
}));

const { simularConversacion, preguntaDeGrabacionDe } = await import(
  "../../mcp/conversacionSimulada.js"
);

const PREGUNTA = {
  success: true,
  result: {
    pregunta_de_grabacion: "¿Le importa que grabemos la llamada?",
    siguiente_paso: "di solo la pregunta",
  },
};
const COMPROBADO = {
  success: true,
  result: { available: true, availabilityToken: "tok-1", grabacion: { guardada: true } },
};

const base = {
  urlDeBdDeDev: "postgres://local",
  clavePrivada: "clave",
  businessId: "negocio-1",
  esperaDeGrabacionMs: 0,
};

beforeEach(() => {
  enviados.length = 0;
  respuestas = [];
});

describe("simular_conversacion: pregunta de grabación", () => {
  it("la contesta sola y el book_appointment usa el token que trae", async () => {
    respuestas = [PREGUNTA, COMPROBADO, { success: true, result: { bookingId: "b1" } }];
    const resultado = await simularConversacion({
      ...base,
      pasos: [
        { tool: "check_availability", cuerpo: { startDateTime: "2026-11-10T10:00" } },
        { tool: "book_appointment", cuerpo: { clientName: "Ana" } },
      ],
    });

    expect(enviados.map((e) => e.ruta)).toEqual([
      "/webhooks/telnyx/tools/check_availability",
      "/webhooks/telnyx/tools/preferencia_de_grabacion",
      "/webhooks/telnyx/tools/book_appointment",
    ]);
    // La respuesta va en la misma llamada simulada.
    expect(enviados.every((e) => e.llamada === "sim-mcp-1")).toBe(true);
    expect(enviados[1].cuerpo).toEqual({ acepta: true });
    expect(enviados[2].cuerpo).toEqual({ clientName: "Ana", availabilityToken: "tok-1" });
    const automatico = resultado.pasos[1] as { paso: number; automatico?: string };
    expect(automatico.paso).toBe(1);
    expect(automatico.automatico).toMatch(/acepta/);
  });

  it("con rechaza contesta que no", async () => {
    respuestas = [PREGUNTA, COMPROBADO];
    await simularConversacion({
      ...base,
      respuestaDeGrabacion: "rechaza",
      pasos: [{ tool: "check_availability" }],
    });
    expect(enviados[1].cuerpo).toEqual({ acepta: false });
  });

  it("con no_contestar la deja sin respuesta", async () => {
    respuestas = [PREGUNTA];
    const resultado = await simularConversacion({
      ...base,
      respuestaDeGrabacion: "no_contestar",
      pasos: [{ tool: "check_availability" }],
    });
    expect(enviados).toHaveLength(1);
    expect(resultado.pasos).toHaveLength(1);
  });

  it("no se adelanta si el paso siguiente ya la contesta", async () => {
    respuestas = [PREGUNTA, COMPROBADO];
    await simularConversacion({
      ...base,
      pasos: [
        { tool: "check_availability" },
        { tool: "preferencia_de_grabacion", cuerpo: { acepta: false } },
      ],
    });
    expect(enviados.map((e) => e.cuerpo)).toEqual([{}, { acepta: false }]);
  });

  it("en el Gestor no hay pregunta de grabación que contestar", async () => {
    respuestas = [PREGUNTA];
    await simularConversacion({
      ...base,
      canal: "gestor",
      pasos: [{ tool: "consultar_agenda" }],
    });
    expect(enviados).toHaveLength(1);
  });

  it("solo reconoce la pregunta dentro de result", () => {
    expect(preguntaDeGrabacionDe(PREGUNTA)).toBe(PREGUNTA.result.pregunta_de_grabacion);
    expect(preguntaDeGrabacionDe(COMPROBADO)).toBeNull();
    expect(preguntaDeGrabacionDe({ pregunta_de_grabacion: "x" })).toBeNull();
    expect(preguntaDeGrabacionDe(null)).toBeNull();
  });
});
