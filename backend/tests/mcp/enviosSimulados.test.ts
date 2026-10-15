import { describe, expect, it } from "vitest";
import {
  extraerEnviosSimulados,
  leerEnviosSimulados,
} from "../../mcp/enviosSimulados.js";
import { registrarEnvioSimulado } from "../../src/lib/enviosSimulados.js";

describe("extraerEnviosSimulados", () => {
  it("lee el formato que escribe registrarEnvioSimulado y se salta el resto", () => {
    // Se genera la línea con la función real, para que un cambio de formato
    // allí rompa este test en vez de dejar al MCP ciego.
    const lineas: string[] = [];
    const original = console.warn;
    console.warn = (mensaje: string) => lineas.push(mensaje);
    try {
      registrarEnvioSimulado("WhatsApp", "+34600000000", "plantilla=cita_confirmada");
      registrarEnvioSimulado("Correo", "a@b.es", "asunto=Hola");
    } finally {
      console.warn = original;
    }

    const volcado = [
      "2026-10-15T12:00:00.000000000Z [Calendar] algo que no es un envío",
      `2026-10-15T12:00:01.000000000Z ${lineas[0]}`,
      '2026-10-15T12:00:02.000000000Z {"level":30,"msg":"request completed"}',
      `2026-10-15T12:00:03.000000000Z ${lineas[1]}`,
    ].join("\n");

    expect(extraerEnviosSimulados(volcado)).toEqual([
      {
        momento: "2026-10-15T12:00:01.000000000Z",
        canal: "WhatsApp",
        destino: "+34600000000",
        detalle: "plantilla=cita_confirmada",
      },
      {
        momento: "2026-10-15T12:00:03.000000000Z",
        canal: "Correo",
        destino: "a@b.es",
        detalle: "asunto=Hola",
      },
    ]);
  });
});

describe("leerEnviosSimulados", () => {
  it("rechaza un «desde» que no sea duración o fecha, sin llegar a docker", async () => {
    await expect(
      leerEnviosSimulados({ desde: "10m; rm -rf /" })
    ).rejects.toThrow(/«desde» tiene que ser una duración/);
  });
});
