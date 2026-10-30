import { describe, expect, it, vi } from "vitest";
import {
  crearClienteDeGrowth,
  ErrorDeGrowthApi,
  validarRuta,
  type Metodo,
} from "../../mcp/growth/cliente.js";
import {
  crearCredenciales,
  type Credenciales,
} from "../../mcp/growth/credenciales.js";

const TOKEN = "gta_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
const OTRO_TOKEN = "gta_ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210zyxwvu";

function json(cuerpo: unknown, status = 200, cabeceras: HeadersInit = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json", ...cabeceras },
  });
}

function credenciales(env: Record<string, string> = {}): Credenciales {
  return crearCredenciales({
    env: { GROWTH_AGENT_TOKEN: TOKEN, ...env },
    leerLlavero: async () => null,
  });
}

function cliente(
  fetchFn: ReturnType<typeof vi.fn>,
  opciones: { credenciales?: Credenciales } = {}
) {
  const esperar = vi.fn().mockResolvedValue(undefined);
  return {
    esperar,
    cliente: crearClienteDeGrowth({
      credenciales: opciones.credenciales ?? credenciales(),
      fetchFn: fetchFn as unknown as typeof fetch,
      esperar,
    }),
  };
}

/** La llamada n-ésima al fetch simulado: URL, método, cabeceras y cuerpo. */
function llamada(fetchFn: ReturnType<typeof vi.fn>, n = 0) {
  const [url, init] = fetchFn.mock.calls[n] as [string, RequestInit];
  return {
    url: new URL(url),
    metodo: init.method,
    cabeceras: init.headers as Record<string, string>,
    cuerpo: init.body as string | undefined,
    init,
  };
}

describe("cliente de Growth: qué envía", () => {
  it("GET con consulta, token solo en la cabecera y sin cuerpo", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ data: [] }));
    const { cliente: c } = cliente(fetchFn);
    const r = await c.peticion("GET", "/growth/agente/oportunidades", {
      consulta: {
        estado: ["detectada", "devuelta"],
        fuente: "manual",
        limite: 25,
        omitido: undefined,
        activo: true,
      },
    });
    expect(r).toEqual({ status: 200, datos: { data: [] } });

    const l = llamada(fetchFn);
    expect(l.url.origin).toBe("https://api.alhabla.ai");
    expect(l.url.pathname).toBe("/growth/agente/oportunidades");
    expect(l.url.searchParams.get("estado")).toBe("detectada,devuelta");
    expect(l.url.searchParams.get("fuente")).toBe("manual");
    expect(l.url.searchParams.get("limite")).toBe("25");
    expect(l.url.searchParams.get("activo")).toBe("true");
    expect(l.url.searchParams.has("omitido")).toBe(false);
    expect(l.metodo).toBe("GET");
    expect(l.cuerpo).toBeUndefined();
    expect(l.cabeceras.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(l.cabeceras["User-Agent"]).toBe("alhabla-growth-mcp/1.0");
    expect(l.url.toString()).not.toContain(TOKEN);
    expect(l.cabeceras["Content-Type"]).toBeUndefined();
  });

  it("POST y PUT envían JSON; sin cuerpo, `{}` (Fastify 5 rechaza el vacío)", async () => {
    const fetchFn = vi
      .fn()
      .mockImplementation(async () => json({ ok: true }, 201));
    const { cliente: c } = cliente(fetchFn);
    await c.peticion("POST", "/growth/agente/ejecuciones", {
      cuerpo: { disparador: "programada" },
    });
    await c.peticion("PUT", "/growth/agente/oportunidades/abc/investigacion", {
      cuerpo: { resumen: "x" },
    });
    await c.peticion("POST", "/growth/agente/oportunidades/abc/estado");

    expect(llamada(fetchFn, 0).metodo).toBe("POST");
    expect(JSON.parse(llamada(fetchFn, 0).cuerpo!)).toEqual({
      disparador: "programada",
    });
    expect(llamada(fetchFn, 0).cabeceras["Content-Type"]).toBe(
      "application/json"
    );
    expect(llamada(fetchFn, 1).metodo).toBe("PUT");
    expect(llamada(fetchFn, 2).cuerpo).toBe("{}");
  });

  it("no sigue redirecciones y pone un tiempo máximo", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({}));
    const { cliente: c } = cliente(fetchFn);
    await c.peticion("GET", "/growth/agente/contexto");
    const { init } = llamada(fetchFn);
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("una redirección es un error y no se sigue", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.com" },
      })
    );
    const { cliente: c } = cliente(fetchFn);
    await expect(c.peticion("GET", "/growth/agente/contexto")).rejects.toThrow(
      /redirección/
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("usa el host de GROWTH_API_URL permitido (dev) y nunca otro", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({}));
    const { cliente: c } = cliente(fetchFn, {
      credenciales: credenciales({ GROWTH_API_URL: "http://localhost:3000" }),
    });
    await c.peticion("GET", "/growth/agente/contexto");
    expect(llamada(fetchFn).url.origin).toBe("http://localhost:3000");

    const { cliente: ajeno } = cliente(fetchFn, {
      credenciales: credenciales({ GROWTH_API_URL: "https://evil.com" }),
    });
    fetchFn.mockClear();
    await expect(
      ajeno.peticion("GET", "/growth/agente/contexto")
    ).rejects.toThrow(/GROWTH_API_URL/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("guarda de rutas: solo /growth/agente/", () => {
  const rechazadas = [
    "/growth/admin/oportunidades",
    "/growth/admin/ajustes",
    "/health",
    "/internal/jobs/growth-mantenimiento",
    "/growth/agente",
    "/growth/agentes/x",
    "growth/agente/contexto",
    "https://evil.com/growth/agente/x",
    "//evil.com/growth/agente/x",
    "/growth/agente/../admin/ajustes",
    "/growth/agente/oportunidades/..%2f..%2fadmin",
    "/growth/agente/%2e%2e/admin",
    "/growth/agente/%2E%2E/admin",
    "/growth/agente/x?token=1",
    "/growth/agente/x#y",
    "/growth/agente//x",
    "/growth/agente/a\\b",
    "/growth/agente/a b",
    "/growth/agente/a\nb",
    "/growth/agente/a%00b",
    "",
  ];

  it.each(rechazadas)("rechaza «%s»", (ruta) => {
    expect(() => validarRuta(ruta)).toThrow(/Ruta no permitida/);
  });

  it("acepta las rutas del agente", () => {
    for (const ruta of [
      "/growth/agente/contexto",
      "/growth/agente/oportunidades/abc123/estado",
      "/growth/agente/conocimiento/sincronizar",
      "/growth/agente/borradores/evaluar",
    ]) {
      expect(() => validarRuta(ruta)).not.toThrow();
    }
  });

  it("el cliente falla antes de leer el token ni llamar a la red", async () => {
    const fetchFn = vi.fn();
    const leerLlavero = vi.fn();
    const { cliente: c } = cliente(fetchFn, {
      credenciales: crearCredenciales({ env: {}, leerLlavero }),
    });
    await expect(
      c.peticion("GET", "/growth/admin/oportunidades")
    ).rejects.toThrow(/Ruta no permitida/);
    expect(leerLlavero).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("solo GET, POST y PUT", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({}));
    const { cliente: c } = cliente(fetchFn);
    for (const metodo of ["DELETE", "PATCH", "HEAD"]) {
      await expect(
        c.peticion(metodo as Metodo, "/growth/agente/contexto")
      ).rejects.toThrow(/Método no permitido/);
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("cliente de Growth: errores en español", () => {
  async function fallo(
    estado: number,
    cuerpo: unknown,
    metodo: Metodo = "POST"
  ) {
    const fetchFn = vi.fn().mockResolvedValue(json(cuerpo, estado));
    const { cliente: c } = cliente(fetchFn);
    const error = await c
      .peticion(metodo, "/growth/agente/oportunidades/abc/estado", {
        cuerpo: {},
        idempotente: false,
      })
      .catch((e) => e);
    return { error: error as ErrorDeGrowthApi, fetchFn };
  }

  it("400: la lista de campos de Zod", async () => {
    const { error } = await fallo(400, {
      error: [
        {
          path: ["puntTrafico"],
          message: "Number must be less than or equal to 100",
        },
        { path: [], message: "Cuerpo no válido" },
      ],
    });
    expect(error).toBeInstanceOf(ErrorDeGrowthApi);
    expect(error.status).toBe(400);
    expect(error.message).toContain(
      "puntTrafico: Number must be less than or equal to 100"
    );
    expect(error.message).toContain("(cuerpo): Cuerpo no válido");
  });

  it("400 con un texto del servidor", async () => {
    const { error } = await fallo(400, { error: "El nicho «x» no existe." });
    expect(error.message).toContain("El nicho «x» no existe.");
  });

  it("401: token no válido o revocado, con el comando del llavero y sin el valor", async () => {
    const { error } = await fallo(401, { error: "Token no válido." });
    expect(error.message).toMatch(/no válido o revocado/);
    expect(error.message).toContain(
      "security add-generic-password -s alhabla-growth -a api.alhabla.ai -U -w"
    );
    expect(error.message).not.toContain(TOKEN);
  });

  it("403: el mensaje del backend", async () => {
    const { error } = await fallo(403, {
      error: "El token no tiene el alcance «escribir».",
    });
    expect(error.status).toBe(403);
    expect(error.message).toContain("El token no tiene el alcance «escribir».");
  });

  it("404 y 409 con el mensaje y el código del backend", async () => {
    const nf = await fallo(404, { error: "La oportunidad no existe." });
    expect(nf.error.message).toContain("La oportunidad no existe.");

    const c = await fallo(409, {
      error: "Growth está en pausa.",
      codigo: "pausa",
    });
    expect(c.error.status).toBe(409);
    expect(c.error.codigo).toBe("pausa");
    expect(c.error.message).toContain("Growth está en pausa.");
    expect(c.error.message).toContain("pausa");
    expect(c.fetchFn).toHaveBeenCalledTimes(1);
  });

  it("429 y 5xx: mensajes propios", async () => {
    const limite = await fallo(
      429,
      { statusCode: 429, message: "rate limit" },
      "GET"
    );
    expect(limite.error.message).toMatch(/limita las peticiones/);

    const caida = await fallo(503, { error: "Error interno." });
    expect(caida.error.message).toMatch(/falló \(HTTP 503\)/);
  });

  it("un 5xx con cuerpo que no es JSON no rompe", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response("<html>Bad Gateway</html>", { status: 502 })
      );
    const { cliente: c } = cliente(fetchFn);
    const error = await c
      .peticion("GET", "/growth/agente/contexto")
      .catch((e) => e);
    expect(error.status).toBe(502);
    expect(error.message).toMatch(/HTTP 502/);
  });

  it("el token que el backend eche en un error sale censurado", async () => {
    const { error } = await fallo(500, {
      error: `Fallo con Authorization: Bearer ${TOKEN} y ${OTRO_TOKEN}`,
    });
    expect(error.message).not.toContain(TOKEN);
    expect(error.message).not.toContain(OTRO_TOKEN);
  });

  it("sin red: «No responde» con el origen", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const { cliente: c } = cliente(fetchFn);
    const error = await c
      .peticion("POST", "/growth/agente/oportunidades/abc/estado", {
        idempotente: true,
      })
      .catch((e) => e);
    expect(error.status).toBeNull();
    expect(error.message).toContain("No responde https://api.alhabla.ai");
  });

  it("una respuesta enorme se rechaza", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response("x".repeat(2_100_000), { status: 200 }));
    const { cliente: c } = cliente(fetchFn);
    await expect(c.peticion("GET", "/growth/agente/contexto")).rejects.toThrow(
      /demasiado grande/
    );
  });
});

describe("cliente de Growth: reintentos", () => {
  it("GET: reintenta un 503 dos veces (1 s y 3 s) y acaba bien", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "x" }, 503))
      .mockResolvedValueOnce(json({ error: "x" }, 502))
      .mockResolvedValueOnce(json({ ok: true }));
    const { cliente: c, esperar } = cliente(fetchFn);
    const r = await c.peticion("GET", "/growth/agente/contexto");
    expect(r.datos).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(esperar.mock.calls.map((x) => x[0])).toEqual([1_000, 3_000]);
  });

  it("GET: se rinde tras tres intentos", async () => {
    const fetchFn = vi.fn().mockImplementation(async () => json({}, 500));
    const { cliente: c } = cliente(fetchFn);
    await expect(c.peticion("GET", "/growth/agente/contexto")).rejects.toThrow(
      /HTTP 500/
    );
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("GET: reintenta un fallo de red", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(json({ ok: 1 }));
    const { cliente: c } = cliente(fetchFn);
    expect((await c.peticion("GET", "/growth/agente/contexto")).datos).toEqual({
      ok: 1,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("429: respeta Retry-After (con tope) en lo idempotente", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429, { "retry-after": "7" }))
      .mockResolvedValueOnce(json({}, 429, { "retry-after": "9999" }))
      .mockResolvedValueOnce(json({ ok: 1 }));
    const { cliente: c, esperar } = cliente(fetchFn);
    await c.peticion("GET", "/growth/agente/contexto");
    expect(esperar.mock.calls.map((x) => x[0])).toEqual([7_000, 15_000]);
  });

  it("una escritura idempotente también se reintenta", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(json({ creada: false, id: "a" }));
    const { cliente: c } = cliente(fetchFn);
    const r = await c.peticion("POST", "/growth/agente/oportunidades", {
      cuerpo: { url: "https://ejemplo.com" },
      idempotente: true,
    });
    expect(r.datos).toEqual({ creada: false, id: "a" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("una escritura que no es idempotente NO se reintenta (red)", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const { cliente: c } = cliente(fetchFn);
    const error = await c
      .peticion("POST", "/growth/agente/oportunidades/abc/borradores", {
        cuerpo: { texto: "hola" },
      })
      .catch((e) => e);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(error.message).toMatch(/No se sabe si se llegó a aplicar/);
    expect(error.detalles.puedeHaberSeAplicado).toBe(true);
  });

  it("una escritura que no es idempotente NO se reintenta (5xx y 429)", async () => {
    for (const estado of [500, 503, 429]) {
      const fetchFn = vi.fn().mockResolvedValue(json({ error: "x" }, estado));
      const { cliente: c } = cliente(fetchFn);
      const error = await c
        .peticion("POST", "/growth/agente/oportunidades/abc/borradores", {
          cuerpo: {},
        })
        .catch((e) => e);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      if (estado >= 500) {
        expect(error.message).toMatch(/No se sabe si se llegó a aplicar/);
      }
    }
  });

  it("nunca se reintenta un error del cliente (400, 403, 404, 409)", async () => {
    for (const estado of [400, 403, 404, 409]) {
      const fetchFn = vi.fn().mockResolvedValue(json({ error: "no" }, estado));
      const { cliente: c } = cliente(fetchFn);
      await c.peticion("GET", "/growth/agente/contexto").catch(() => undefined);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    }
  });

  it("un tiempo agotado se explica", async () => {
    const agotado = Object.assign(new Error("timeout"), {
      name: "TimeoutError",
    });
    const fetchFn = vi.fn().mockRejectedValue(agotado);
    const { cliente: c } = cliente(fetchFn);
    const error = await c
      .peticion("POST", "/growth/agente/oportunidades/abc/borradores", {})
      .catch((e) => e);
    expect(error.message).toMatch(/no respondió a tiempo/);
    expect(error.message).toMatch(/No se sabe si se llegó a aplicar/);
  });
});

describe("cliente de Growth: un 401 por token rotado", () => {
  it("relee el token y repite una vez si es otro (también un POST)", async () => {
    let actual = TOKEN;
    const credenciales = crearCredenciales({
      env: {},
      leerLlavero: async () => actual,
    });
    await credenciales.token(); // queda cacheado el viejo
    actual = OTRO_TOKEN; // se rota en el llavero

    const fetchFn = vi.fn().mockImplementation(async (_url, init) => {
      const cabecera = (init.headers as Record<string, string>).Authorization;
      return cabecera === `Bearer ${OTRO_TOKEN}`
        ? json({ id: "e1" }, 201)
        : json({ error: "Token no válido." }, 401);
    });
    const { cliente: c } = cliente(fetchFn, { credenciales });

    const r = await c.peticion("POST", "/growth/agente/ejecuciones", {
      cuerpo: {},
    });
    expect(r.status).toBe(201);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const usadas = fetchFn.mock.calls.map(
      (x) => (x[1].headers as Record<string, string>).Authorization
    );
    expect(usadas).toEqual([`Bearer ${TOKEN}`, `Bearer ${OTRO_TOKEN}`]);
  });

  it("solo relee una vez: si el nuevo también da 401, falla", async () => {
    let actual = TOKEN;
    const credenciales = crearCredenciales({
      env: {},
      leerLlavero: async () => actual,
    });
    await credenciales.token();
    actual = OTRO_TOKEN;
    const fetchFn = vi.fn().mockResolvedValue(json({ error: "no" }, 401));
    const { cliente: c } = cliente(fetchFn, { credenciales });
    await expect(
      c.peticion("POST", "/growth/agente/ejecuciones", { cuerpo: {} })
    ).rejects.toThrow(/no válido o revocado/);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("si el token releído es el mismo, falla sin insistir", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: "no" }, 401));
    const { cliente: c } = cliente(fetchFn);
    await expect(
      c.peticion("POST", "/growth/agente/ejecuciones", { cuerpo: {} })
    ).rejects.toThrow(/no válido o revocado/);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("cliente de Growth: peticiones de una en una", () => {
  it("la segunda no sale hasta que acaba la primera", async () => {
    const orden: string[] = [];
    let liberar!: () => void;
    const primera = new Promise<void>((resolver) => (liberar = resolver));
    const fetchFn = vi.fn().mockImplementation(async (url: string) => {
      const ruta = new URL(url).pathname;
      orden.push(`inicio ${ruta}`);
      if (ruta.endsWith("/uno")) await primera;
      orden.push(`fin ${ruta}`);
      return json({ ruta });
    });
    const { cliente: c } = cliente(fetchFn);

    const a = c.peticion("GET", "/growth/agente/uno");
    const b = c.peticion("GET", "/growth/agente/dos");
    await new Promise((r) => setTimeout(r, 20));
    expect(orden).toEqual(["inicio /growth/agente/uno"]);
    liberar();
    await Promise.all([a, b]);
    expect(orden).toEqual([
      "inicio /growth/agente/uno",
      "fin /growth/agente/uno",
      "inicio /growth/agente/dos",
      "fin /growth/agente/dos",
    ]);
  });

  it("un fallo no bloquea la cola", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "no" }, 404))
      .mockResolvedValueOnce(json({ ok: 1 }));
    const { cliente: c } = cliente(fetchFn);
    const [a, b] = await Promise.allSettled([
      c.peticion("GET", "/growth/agente/uno"),
      c.peticion("GET", "/growth/agente/dos"),
    ]);
    expect(a.status).toBe("rejected");
    expect(b.status).toBe("fulfilled");
  });
});
