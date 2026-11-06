import { beforeEach, describe, expect, it, vi } from "vitest";

const adapter = vi.hoisted(() => ({
  conversacionesDeLaLlamada: vi.fn(),
  listConversationMessages: vi.fn(),
  stopAssistantOnCall: vi.fn(),
  startAssistantOnCall: vi.fn(),
  hangupCall: vi.fn(),
}));
const bd = vi.hoisted(() => ({
  call: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
}));
const almacen = vi.hoisted(() => ({
  guardarClave: vi.fn(),
  leerClave: vi.fn(),
}));
const contexto = vi.hoisted(() => ({ resolverContextoDeLlamada: vi.fn() }));
const informe = vi.hoisted(() => ({ pedirInformeDeLlamada: vi.fn() }));

vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: adapter,
}));
vi.mock("../../src/lib/prisma.js", () => ({ prisma: bd }));
vi.mock("../../src/lib/almacenTemporal.js", () => almacen);
vi.mock("../../src/lib/contextoDeLlamada.js", () => contexto);
vi.mock("../../src/jobs/informeDeLlamada.js", () => informe);
// Un 5xx se repite; lo demás, no (como contestarLlamada.ts con Telnyx).
vi.mock("../../src/adapters/telnyx/contestarLlamada.js", () => ({
  esFalloTransitorioDeTelnyx: (error: { status?: number }) =>
    (error?.status ?? 0) >= 500,
}));

import {
  cambiarDeIdioma,
  historialParaElNuevo,
  quedanConversaciones,
} from "../../src/lib/cambioDeIdioma.js";

const CA = "assistant-cooficial";
const FLUX = "assistant-flux";
const SALUDO =
  "Peluquería Mallorca, te atiende su recepcionista de IA. ¿En qué te ayudo?";

function llamada(cambios: Record<string, unknown> = {}) {
  return {
    id: "call_1",
    businessId: "negocio_1",
    fromNumber: "+34930453237",
    assistantsArrancados: 1,
    agent: { telnyxAssistantId: FLUX, telnyxCooficialAssistantId: CA },
    business: {
      id: "negocio_1",
      name: "Peluquería Mallorca",
      agentSettings: null,
      businessType: "peluqueria",
      address: "Carrer de Mallorca 1, 08013 Barcelona",
      businessDetails: null,
      timezone: "Europe/Madrid",
      phone: null,
      telnyxPhoneNumber: "+34930453236",
      ownerWhatsappNumber: null,
    },
    ...cambios,
  };
}

const PARAMS = {
  idioma: "ca-ES",
  lo_que_dice: "Bon dia, voldria hora per tallar-me els cabells demà.",
  primera_respuesta: "Vols tallar-te els cabells demà. A quina hora et va bé?",
};

describe("cambiarDeIdioma (tool cambiar_de_idioma)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    bd.call.findUnique.mockResolvedValue(llamada());
    bd.call.updateMany.mockResolvedValue({ count: 1 });
    bd.call.update.mockResolvedValue({
      assistantsArrancados: 1,
      conversacionesDeTelnyx: ["conv_1"],
    });
    adapter.conversacionesDeLaLlamada.mockResolvedValue([
      { id: "conv_1", assistantId: FLUX, createdAt: "2026-11-06T10:00:00Z" },
    ]);
    adapter.listConversationMessages.mockResolvedValue([
      {
        role: "user",
        text: "Vuldemanar hora por tallarme el Skabels",
        sentAt: "2026-11-06T10:00:05Z",
      },
      { role: "assistant", text: SALUDO, sentAt: "2026-11-06T10:00:01Z" },
      { role: "tool", text: "{}", sentAt: "2026-11-06T10:00:06Z" },
      { role: "assistant", text: "", sentAt: "2026-11-06T10:00:07Z" },
    ]);
    adapter.stopAssistantOnCall.mockResolvedValue(undefined);
    adapter.startAssistantOnCall.mockResolvedValue(undefined);
    adapter.hangupCall.mockResolvedValue(undefined);
    almacen.leerClave.mockResolvedValue(null);
    almacen.guardarClave.mockResolvedValue(undefined);
    contexto.resolverContextoDeLlamada.mockResolvedValue({
      saludo: SALUDO,
      variables: { nombre_cliente: "Marta", proxima_cita: "" },
      grabar: false,
      voz: null,
    });
  });

  it("para el de flux antes de contestar a la tool y arranca el de la lengua diciendo ya su respuesta, con lo pedido bien escrito", async () => {
    const respuesta = await cambiarDeIdioma({
      callControlId: "v3:abc",
      params: PARAMS,
    });

    expect(respuesta.success).toBe(true);
    expect(respuesta.siguiente_paso).toContain("No digas nada más");
    // Parado dentro de la tool: el modelo de flux no tiene otro turno.
    expect(adapter.stopAssistantOnCall).toHaveBeenCalledWith("v3:abc");
    expect(bd.call.updateMany).toHaveBeenCalledWith({
      where: { id: "call_1", assistantsArrancados: 1 },
      data: { assistantsArrancados: { increment: 1 } },
    });

    await vi.waitFor(() =>
      expect(adapter.startAssistantOnCall).toHaveBeenCalled()
    );
    const [id, destino, opciones] = adapter.startAssistantOnCall.mock.calls[0];
    expect(id).toBe("v3:abc");
    expect(destino).toBe(CA);
    expect(opciones.greeting).toBe(
      "Cap problema, et parlo en català. Vols tallar-te els cabells demà. A quina hora et va bé?"
    );
    // La frase deformada de flux se cambia por la bien escrita.
    expect(opciones.messageHistory).toEqual([
      { role: "assistant", content: SALUDO },
      { role: "user", content: PARAMS.lo_que_dice },
    ]);
    expect(opciones.dynamicVariables).toEqual({
      nombre_cliente: "Marta",
      proxima_cita: "",
    });
    // Lo sembrado, para no duplicarlo en la transcripción.
    expect(almacen.guardarClave).toHaveBeenCalledWith(
      "cambio-de-idioma:sembrados:call_1",
      JSON.stringify(opciones.messageHistory),
      expect.any(Number),
      { businessId: "negocio_1" }
    );
  });

  it("un idioma que habla el de flux no cambia nada", async () => {
    const respuesta = await cambiarDeIdioma({
      callControlId: "v3:abc",
      params: { idioma: "en-GB" },
    });
    expect(respuesta.success).toBe(false);
    expect(adapter.stopAssistantOnCall).not.toHaveBeenCalled();
  });

  it("sin assistant de la lengua, o con otra lengua que la de la zona, sigue el de flux en castellano", async () => {
    bd.call.findUnique.mockResolvedValue(
      llamada({
        agent: { telnyxAssistantId: FLUX, telnyxCooficialAssistantId: null },
      })
    );
    const sinDestino = await cambiarDeIdioma({
      callControlId: "v3:abc",
      params: PARAMS,
    });
    bd.call.findUnique.mockResolvedValue(llamada());
    const otraLengua = await cambiarDeIdioma({
      callControlId: "v3:abc",
      params: { ...PARAMS, idioma: "gl-ES" },
    });

    for (const respuesta of [sinDestino, otraLengua]) {
      expect(respuesta.success).toBe(false);
      expect(respuesta.siguiente_paso).toContain("sigue tú, en castellano");
    }
    expect(adapter.stopAssistantOnCall).not.toHaveBeenCalled();
    expect(bd.call.updateMany).not.toHaveBeenCalled();
  });

  it("si otra llamada a la tool ya está cambiando, no vuelve a parar", async () => {
    bd.call.updateMany.mockResolvedValue({ count: 0 });
    const respuesta = await cambiarDeIdioma({
      callControlId: "v3:abc",
      params: PARAMS,
    });
    expect(respuesta.success).toBe(true);
    expect(adapter.stopAssistantOnCall).not.toHaveBeenCalled();
  });

  it("un 500 al parar se repite una vez; si sigue, el de flux sigue en castellano y se descuenta", async () => {
    adapter.stopAssistantOnCall.mockRejectedValue(
      Object.assign(new Error("500"), { status: 500 })
    );
    const respuesta = await cambiarDeIdioma({
      callControlId: "v3:abc",
      params: PARAMS,
    });

    expect(adapter.stopAssistantOnCall).toHaveBeenCalledTimes(2);
    expect(respuesta.success).toBe(false);
    expect(respuesta.siguiente_paso).toContain("sigue tú, en castellano");
    expect(bd.call.update).toHaveBeenCalledWith({
      where: { id: "call_1" },
      data: { assistantsArrancados: { decrement: 1 } },
    });
    expect(adapter.startAssistantOnCall).not.toHaveBeenCalled();
  });

  it("si el 500 era pasajero, el segundo intento basta", async () => {
    adapter.stopAssistantOnCall
      .mockRejectedValueOnce(Object.assign(new Error("500"), { status: 500 }))
      .mockResolvedValueOnce(undefined);
    const respuesta = await cambiarDeIdioma({
      callControlId: "v3:abc",
      params: PARAMS,
    });
    expect(respuesta.success).toBe(true);
    await vi.waitFor(() =>
      expect(adapter.startAssistantOnCall).toHaveBeenCalledWith(
        "v3:abc",
        CA,
        expect.anything()
      )
    );
  });

  it("si el de la lengua no arranca, vuelve el de flux con lo hablado", async () => {
    adapter.startAssistantOnCall
      .mockRejectedValueOnce(new Error("422"))
      .mockResolvedValueOnce(undefined);
    await cambiarDeIdioma({ callControlId: "v3:abc", params: PARAMS });

    await vi.waitFor(() =>
      expect(adapter.startAssistantOnCall).toHaveBeenCalledTimes(2)
    );
    const [, destino, opciones] = adapter.startAssistantOnCall.mock.calls[1];
    expect(destino).toBe(FLUX);
    expect(opciones.messageHistory.at(-1)).toEqual({
      role: "user",
      content: PARAMS.lo_que_dice,
    });
    expect(adapter.hangupCall).not.toHaveBeenCalled();
  });

  it("si no arranca ninguno, descuenta, pide el informe con lo que hay y cuelga", async () => {
    adapter.startAssistantOnCall.mockRejectedValue(new Error("90018"));
    await cambiarDeIdioma({ callControlId: "v3:abc", params: PARAMS });

    await vi.waitFor(() =>
      expect(adapter.hangupCall).toHaveBeenCalledWith("v3:abc")
    );
    expect(bd.call.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { assistantsArrancados: { decrement: 1 } },
      })
    );
    expect(informe.pedirInformeDeLlamada).toHaveBeenCalledWith(
      expect.objectContaining({ callRowId: "call_1" })
    );
  });

  it("si Telnyx tarda en dar lo hablado, arranca con el saludo y lo que dijo", async () => {
    adapter.conversacionesDeLaLlamada.mockReturnValue(new Promise(() => {}));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await cambiarDeIdioma({ callControlId: "v3:abc", params: PARAMS });
      await vi.advanceTimersByTimeAsync(2500);
      await vi.waitFor(() =>
        expect(adapter.startAssistantOnCall).toHaveBeenCalled()
      );
    } finally {
      vi.useRealTimers();
    }
    expect(
      adapter.startAssistantOnCall.mock.calls[0][2].messageHistory
    ).toEqual([
      { role: "assistant", content: SALUDO },
      { role: "user", content: PARAMS.lo_que_dice },
    ]);
  });
});

describe("historialParaElNuevo", () => {
  it("sin lo que dijo, deja lo hablado tal cual", () => {
    expect(
      historialParaElNuevo({
        copia: [{ role: "assistant", content: SALUDO }],
        saludo: SALUDO,
        loQueDice: null,
      })
    ).toEqual([{ role: "assistant", content: SALUDO }]);
  });

  it("sin nada guardado ni saludo, solo lo que dijo", () => {
    expect(
      historialParaElNuevo({ copia: [], saludo: null, loQueDice: "Bon dia" })
    ).toEqual([{ role: "user", content: "Bon dia" }]);
  });
});

describe("quedanConversaciones", () => {
  it("solo con un cambio de idioma y hasta que termina la última", () => {
    expect(
      quedanConversaciones({
        assistantsArrancados: 1,
        conversacionesDeTelnyx: [],
      })
    ).toBe(false);
    expect(
      quedanConversaciones({
        assistantsArrancados: 2,
        conversacionesDeTelnyx: ["a"],
      })
    ).toBe(true);
    expect(
      quedanConversaciones({
        assistantsArrancados: 2,
        conversacionesDeTelnyx: ["a", "b"],
      })
    ).toBe(false);
  });
});
