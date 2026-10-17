import { describe, it, expect, vi, beforeEach } from "vitest";
import Telnyx from "telnyx";
import { telnyxAiAdapter } from "../../../src/adapters/telnyx/TelnyxAiAdapter.js";
import {
  contestarConReintentos,
  esFalloTransitorioDeTelnyx,
  ESPERAS_ENTRE_REINTENTOS_MS,
  NoSePudoContestar,
} from "../../../src/adapters/telnyx/contestarLlamada.js";

vi.mock("../../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: { answerCallWithAssistant: vi.fn() },
}));

const mockedAnswer = vi.mocked(telnyxAiAdapter.answerCallWithAssistant);

function errorDeTelnyx(status: number, codigo = "90000") {
  return Telnyx.APIError.generate(
    status,
    { errors: [{ code: codigo, title: `error ${status}` }] },
    undefined,
    new Headers()
  );
}

const CONTEXTO = {
  callControlId: "call_ctrl_1",
  assistantId: "assistant_1",
  businessId: "biz1",
  opciones: { greeting: "Hola", dynamicVariables: { nombre_cliente: "" } },
};

describe("esFalloTransitorioDeTelnyx", () => {
  it("reintenta 5xx, 429, fallos de red y timeouts; nunca un 4xx ni un error que no sea de Telnyx", () => {
    expect(esFalloTransitorioDeTelnyx(errorDeTelnyx(500))).toBe(true);
    expect(esFalloTransitorioDeTelnyx(errorDeTelnyx(503))).toBe(true);
    expect(esFalloTransitorioDeTelnyx(errorDeTelnyx(429))).toBe(true);
    expect(
      esFalloTransitorioDeTelnyx(
        new Telnyx.APIConnectionError({ message: "ECONNRESET" })
      )
    ).toBe(true);
    expect(
      esFalloTransitorioDeTelnyx(new Telnyx.APIConnectionTimeoutError())
    ).toBe(true);
    expect(esFalloTransitorioDeTelnyx(errorDeTelnyx(422))).toBe(false);
    expect(esFalloTransitorioDeTelnyx(errorDeTelnyx(404))).toBe(false);
    expect(esFalloTransitorioDeTelnyx(new Error("otra cosa"))).toBe(false);
  });
});

describe("contestarConReintentos", () => {
  const esperar = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("contesta a la primera sin esperar", async () => {
    mockedAnswer.mockResolvedValueOnce(undefined);

    await contestarConReintentos({ ...CONTEXTO, esperar });

    expect(mockedAnswer).toHaveBeenCalledTimes(1);
    expect(mockedAnswer).toHaveBeenCalledWith(
      "call_ctrl_1",
      "assistant_1",
      CONTEXTO.opciones
    );
    expect(esperar).not.toHaveBeenCalled();
  });

  it("ante un 503 espera y repite con las mismas opciones", async () => {
    mockedAnswer
      .mockRejectedValueOnce(errorDeTelnyx(503))
      .mockResolvedValueOnce(undefined);

    await contestarConReintentos({ ...CONTEXTO, esperar });

    expect(mockedAnswer).toHaveBeenCalledTimes(2);
    expect(mockedAnswer).toHaveBeenLastCalledWith(
      "call_ctrl_1",
      "assistant_1",
      CONTEXTO.opciones
    );
    expect(esperar).toHaveBeenCalledWith(ESPERAS_ENTRE_REINTENTOS_MS[0]);
  });

  it("con la voz de la cooficial, un fallo transitorio no la descarta: repite con ella", async () => {
    const sinVoz = {
      opciones: { grabar: false },
      voz: "Soniox.tts-rt-v2.Marta",
    };
    mockedAnswer
      .mockRejectedValueOnce(errorDeTelnyx(502))
      .mockResolvedValueOnce(undefined);

    await contestarConReintentos({ ...CONTEXTO, sinVoz, esperar });

    expect(mockedAnswer).toHaveBeenLastCalledWith(
      "call_ctrl_1",
      "assistant_1",
      CONTEXTO.opciones
    );
  });

  it("agotados los reintentos lanza NoSePudoContestar con los intentos hechos", async () => {
    mockedAnswer.mockRejectedValue(errorDeTelnyx(503));

    const error = await contestarConReintentos({ ...CONTEXTO, esperar }).catch(
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(NoSePudoContestar);
    expect(error).toMatchObject({
      intentos: ESPERAS_ENTRE_REINTENTOS_MS.length + 1,
      quizaContestada: false,
    });
    expect(esperar.mock.calls.map(([ms]) => ms)).toEqual([
      ...ESPERAS_ENTRE_REINTENTOS_MS,
    ]);
  });

  it("un 4xx no se reintenta", async () => {
    mockedAnswer.mockRejectedValueOnce(errorDeTelnyx(422, "90018"));

    const error = await contestarConReintentos({ ...CONTEXTO, esperar }).catch(
      (e: unknown) => e
    );

    expect(error).toMatchObject({ intentos: 1, quizaContestada: false });
    expect(mockedAnswer).toHaveBeenCalledTimes(1);
    expect(esperar).not.toHaveBeenCalled();
  });

  it("si Telnyx rechaza la voz de la llamada, contesta sin ella", async () => {
    const sinVoz = {
      opciones: { dynamicVariables: { nombre_cliente: "" }, grabar: true },
      voz: "Soniox.tts-rt-v2.Marta",
    };
    mockedAnswer
      .mockRejectedValueOnce(errorDeTelnyx(422))
      .mockResolvedValueOnce(undefined);

    await contestarConReintentos({ ...CONTEXTO, sinVoz, esperar });

    expect(mockedAnswer).toHaveBeenLastCalledWith(
      "call_ctrl_1",
      "assistant_1",
      sinVoz.opciones
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(
        /rechazó contestar con la voz Soniox\.tts-rt-v2\.Marta \(negocio biz1\)/
      )
    );
    expect(esperar).not.toHaveBeenCalled();
  });

  // Un timeout no dice si Telnyx ejecutó el comando: si el siguiente intento
  // recibe un 4xx (p. ej. «ya contestada»), colgar cortaría una llamada que
  // está hablando con la recepcionista.
  it("tras un timeout, un 4xx deja la llamada como quizá contestada", async () => {
    mockedAnswer
      .mockRejectedValueOnce(new Telnyx.APIConnectionTimeoutError())
      .mockRejectedValueOnce(errorDeTelnyx(422));

    const error = await contestarConReintentos({ ...CONTEXTO, esperar }).catch(
      (e: unknown) => e
    );

    expect(error).toMatchObject({ intentos: 2, quizaContestada: true });
  });
});
