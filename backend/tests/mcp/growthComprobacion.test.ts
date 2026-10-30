import { describe, expect, it, vi } from "vitest";
import {
  comprobarGrowth,
  DETALLE_SIN_CONFIGURAR,
} from "../../mcp/growth/comprobacion.js";
import { comprobacionDeGrowth } from "../../mcp/diagnostico.js";

const TOKEN = "gta_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";

function json(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const CONTEXTO = {
  ajustes: { pausa: false },
  snapshot: { commitSha: "b".repeat(40), vigentes: 160 },
};

const PIEZA = "Alhabla Growth (token de agente y API)";

describe("comprobarGrowth", () => {
  it("200: la API responde y el token vale", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json(CONTEXTO));
    const r = await comprobarGrowth({
      env: { GROWTH_AGENT_TOKEN: TOKEN },
      fetchFn,
    });
    expect(r).toMatchObject({
      estado: "ok",
      ok: true,
      origen: "https://api.alhabla.ai",
      origenDelToken: "entorno",
    });
    expect(typeof r.ms).toBe("number");
    expect(r.contexto).toEqual(CONTEXTO);

    // Una sola petición de lectura, sin afirmaciones.
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchFn.mock.calls[0]![0]));
    expect(url.pathname).toBe("/growth/agente/contexto");
    expect(url.searchParams.get("sinAfirmaciones")).toBe("true");
    expect(fetchFn.mock.calls[0]![1].method).toBe("GET");
  });

  it("el token puede venir del llavero", async () => {
    const r = await comprobarGrowth({
      env: {},
      leerLlavero: async () => TOKEN,
      fetchFn: vi.fn().mockResolvedValue(json(CONTEXTO)),
    });
    expect(r.ok).toBe(true);
    expect(r.origenDelToken).toBe("llavero");
  });

  it("401: token no válido, con el comando para guardar otro y sin reintentar", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: "no" }, 401));
    const r = await comprobarGrowth({
      env: { GROWTH_AGENT_TOKEN: TOKEN },
      fetchFn,
    });
    expect(r.estado).toBe("token_invalido");
    expect(r.ok).toBe(false);
    expect(r.arreglo).toContain(
      "security add-generic-password -s alhabla-growth -a api.alhabla.ai -U -w"
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("403: el token no tiene el alcance «leer»", async () => {
    const r = await comprobarGrowth({
      env: { GROWTH_AGENT_TOKEN: TOKEN },
      fetchFn: vi
        .fn()
        .mockResolvedValue(
          json({ error: "El token no tiene el alcance «leer»." }, 403)
        ),
    });
    expect(r.estado).toBe("sin_permiso");
    expect(r.ok).toBe(false);
    expect(r.arreglo).toMatch(/alcance/);
  });

  it("5xx y red caída: la API no responde bien, a la primera", async () => {
    for (const fetchFn of [
      vi.fn().mockResolvedValue(json({ error: "Error interno." }, 503)),
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    ]) {
      const r = await comprobarGrowth({
        env: { GROWTH_AGENT_TOKEN: TOKEN },
        fetchFn,
      });
      expect(r.estado).toBe("api_caida");
      expect(r.ok).toBe(false);
      expect(r.arreglo).toMatch(/estado_prod|estado_dev/);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    }
  });

  it("sin token: sin configurar, pero sin ser un fallo, y sin tocar la red", async () => {
    const fetchFn = vi.fn();
    const r = await comprobarGrowth({
      env: {},
      leerLlavero: async () => null,
      fetchFn,
    });
    expect(r.estado).toBe("sin_configurar");
    expect(r.ok).toBe(true);
    expect(r.detalle).toBe(DETALLE_SIN_CONFIGURAR);
    expect(r.detalle).toBe("sin configurar (opcional hasta la Fase 2)");
    expect(r.arreglo).toContain("security add-generic-password");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("URL no permitida: es un fallo, y no se envía el token a ningún sitio", async () => {
    const fetchFn = vi.fn();
    const leerLlavero = vi.fn().mockResolvedValue(TOKEN);
    const r = await comprobarGrowth({
      env: { GROWTH_API_URL: "https://evil.com" },
      leerLlavero,
      fetchFn,
    });
    expect(r.estado).toBe("url_no_permitida");
    expect(r.ok).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(leerLlavero).not.toHaveBeenCalled();
  });

  it("token con mala forma: fallo, sin repetir su valor", async () => {
    const fetchFn = vi.fn();
    const r = await comprobarGrowth({
      env: { GROWTH_AGENT_TOKEN: "esto-no-es-un-token-de-agente" },
      fetchFn,
    });
    expect(r.estado).toBe("token_mal_formado");
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("esto-no-es-un-token");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("nunca devuelve el token, ni siquiera si el backend lo repite", async () => {
    const r = await comprobarGrowth({
      env: { GROWTH_AGENT_TOKEN: TOKEN },
      fetchFn: vi
        .fn()
        .mockResolvedValue(
          json({ error: `Fallo con Bearer ${TOKEN}`, token: TOKEN }, 500)
        ),
    });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
  });

  it("contra localhost usa el host local y la cuenta del llavero local", async () => {
    const leerLlavero = vi.fn().mockResolvedValue(TOKEN);
    const fetchFn = vi.fn().mockResolvedValue(json(CONTEXTO));
    const r = await comprobarGrowth({
      env: { GROWTH_API_URL: "http://localhost:3000" },
      leerLlavero,
      fetchFn,
    });
    expect(r.origen).toBe("http://localhost:3000");
    expect(leerLlavero).toHaveBeenCalledWith("alhabla-growth", "localhost");
    expect(new URL(String(fetchFn.mock.calls[0]![0])).origin).toBe(
      "http://localhost:3000"
    );
  });
});

describe("diagnostico_mcp: la pieza de Alhabla Growth", () => {
  it("sin token es ok y dice «sin configurar (opcional hasta la Fase 2)»", async () => {
    const fetchFn = vi.fn();
    const pieza = await comprobacionDeGrowth({
      fetchFn,
      env: {},
      leerLlavero: async () => null,
    });
    expect(pieza.pieza).toBe(PIEZA);
    expect(pieza.ok).toBe(true);
    expect(pieza.detalle).toBe("sin configurar (opcional hasta la Fase 2)");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("con token válido es ok y sin arreglo", async () => {
    const pieza = await comprobacionDeGrowth({
      fetchFn: vi.fn().mockResolvedValue(json(CONTEXTO)),
      env: { GROWTH_AGENT_TOKEN: TOKEN },
    });
    expect(pieza.ok).toBe(true);
    expect(pieza.detalle).toMatch(/responde y el token/);
    expect(pieza.arreglo).toBeUndefined();
  });

  it("con token revocado falla y dice cómo arreglarlo", async () => {
    const pieza = await comprobacionDeGrowth({
      fetchFn: vi.fn().mockResolvedValue(json({ error: "no" }, 401)),
      env: { GROWTH_AGENT_TOKEN: TOKEN },
    });
    expect(pieza.pieza).toBe(PIEZA);
    expect(pieza.ok).toBe(false);
    expect(pieza.arreglo).toContain("security add-generic-password");
    expect(JSON.stringify(pieza)).not.toContain(TOKEN);
  });

  it("con la API caída o una URL ajena también falla", async () => {
    const caida = await comprobacionDeGrowth({
      fetchFn: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
      env: { GROWTH_AGENT_TOKEN: TOKEN },
    });
    expect(caida.ok).toBe(false);
    expect(caida.arreglo).toBeTruthy();

    const ajena = await comprobacionDeGrowth({
      fetchFn: vi.fn(),
      env: { GROWTH_AGENT_TOKEN: TOKEN, GROWTH_API_URL: "https://evil.com" },
    });
    expect(ajena.ok).toBe(false);
    expect(ajena.arreglo).toMatch(/GROWTH_API_URL/);
  });

  it("un fallo inesperado no rompe el diagnóstico entero: sale como pieza fallida", async () => {
    const rota = {
      status: 200,
      headers: new Headers(),
      body: null,
      text: async () => {
        throw new Error("flujo cortado");
      },
    } as unknown as Response;
    const pieza = await comprobacionDeGrowth({
      fetchFn: vi.fn().mockResolvedValue(rota),
      env: { GROWTH_AGENT_TOKEN: TOKEN },
    });
    expect(pieza.pieza).toBe(PIEZA);
    expect(pieza.ok).toBe(false);
    expect(pieza.detalle).toMatch(/flujo cortado/);
    expect(pieza.arreglo).toMatch(/estado_growth/);
  });
});
