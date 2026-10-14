import { afterEach, describe, expect, it } from "vitest";
import Retell from "retell-sdk";
import { TelnyxAiAdapter } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";
import {
  firmarComoRetell,
  firmarComoTelnyx,
  generarClavesDeSimulacion,
} from "../../mcp/firmas.js";

// Lo que importa del MCP es que la verificación DE VERDAD del backend acepte
// sus firmas: se comprueba con el mismo código que usan los preHandlers.

const CUERPO = JSON.stringify({ fecha: "2026-10-15", servicio: "Corte" });
const claveOriginal = process.env.TELNYX_PUBLIC_KEY;

afterEach(() => {
  if (claveOriginal === undefined) delete process.env.TELNYX_PUBLIC_KEY;
  else process.env.TELNYX_PUBLIC_KEY = claveOriginal;
});

describe("firmarComoTelnyx", () => {
  it("la verificación del adaptador acepta la firma con la clave de simulación", async () => {
    const { publica, privada } = generarClavesDeSimulacion();
    process.env.TELNYX_PUBLIC_KEY = publica;
    const { firma, marcaDeTiempo } = firmarComoTelnyx(CUERPO, privada);

    await expect(
      new TelnyxAiAdapter().verifyWebhookSignature(CUERPO, firma, marcaDeTiempo)
    ).resolves.toBe(true);
  });

  it("con otra clave pública (la de Telnyx en el backend de dev) no pasa", async () => {
    const simulacion = generarClavesDeSimulacion();
    process.env.TELNYX_PUBLIC_KEY = generarClavesDeSimulacion().publica;
    const { firma, marcaDeTiempo } = firmarComoTelnyx(CUERPO, simulacion.privada);

    await expect(
      new TelnyxAiAdapter().verifyWebhookSignature(CUERPO, firma, marcaDeTiempo)
    ).resolves.toBe(false);
  });

  it("la firma cubre el cuerpo exacto: tocar un byte la invalida", async () => {
    const { publica, privada } = generarClavesDeSimulacion();
    process.env.TELNYX_PUBLIC_KEY = publica;
    const { firma, marcaDeTiempo } = firmarComoTelnyx(CUERPO, privada);

    await expect(
      new TelnyxAiAdapter().verifyWebhookSignature(`${CUERPO} `, firma, marcaDeTiempo)
    ).resolves.toBe(false);
  });

  it("la pública tiene el formato de Telnyx: 32 bytes crudos en base64", () => {
    const { publica } = generarClavesDeSimulacion();
    expect(Buffer.from(publica, "base64")).toHaveLength(32);
  });
});

describe("firmarComoRetell", () => {
  it("Retell.verify (lo que usa RetellAdapter) acepta la firma", async () => {
    const firma = await firmarComoRetell(CUERPO, "key_de_prueba");
    await expect(Retell.verify(CUERPO, "key_de_prueba", firma)).resolves.toBe(true);
    await expect(Retell.verify(CUERPO, "otra_key", firma)).resolves.toBe(false);
  });
});
