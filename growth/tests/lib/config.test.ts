import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `config.ts` y `modo-demo.ts` leen `process.env` al cargar. Cada caso fija el
 * entorno, reinicia los módulos y vuelve a importar.
 */
async function cargarConfig() {
  vi.resetModules();
  return import("@/lib/config");
}

async function cargarModoDemo() {
  vi.resetModules();
  return import("@/lib/modo-demo");
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function entorno(variables: Record<string, string | undefined>) {
  for (const [nombre, valor] of Object.entries(variables)) {
    vi.stubEnv(nombre, valor);
  }
}

describe("config en producción", () => {
  const completo = {
    NODE_ENV: "production",
    NEXT_PUBLIC_API_BASE_URL: "https://api.alhabla.ai",
    NEXT_PUBLIC_GROWTH_GOOGLE_CLIENT_ID: "real.apps.googleusercontent.com",
    NEXT_PUBLIC_GROWTH_DEMO: undefined,
  };

  it("carga con las dos variables y sin la demostración", async () => {
    entorno(completo);
    const { config } = await cargarConfig();
    expect(config).toEqual({
      apiBaseUrl: "https://api.alhabla.ai",
      googleClientId: "real.apps.googleusercontent.com",
    });
  });

  it("LANZA si existe NEXT_PUBLIC_GROWTH_DEMO, con cualquier valor", async () => {
    for (const valor of ["1", "0", "true", ""]) {
      entorno({ ...completo, NEXT_PUBLIC_GROWTH_DEMO: valor });
      await expect(cargarConfig()).rejects.toThrow(
        /NEXT_PUBLIC_GROWTH_DEMO no puede existir en producción/
      );
    }
  });

  it("LANZA si falta NEXT_PUBLIC_API_BASE_URL (o está en blanco)", async () => {
    entorno({ ...completo, NEXT_PUBLIC_API_BASE_URL: undefined });
    await expect(cargarConfig()).rejects.toThrow(/NEXT_PUBLIC_API_BASE_URL/);
    entorno({ ...completo, NEXT_PUBLIC_API_BASE_URL: "   " });
    await expect(cargarConfig()).rejects.toThrow(/NEXT_PUBLIC_API_BASE_URL/);
  });

  it("LANZA si falta el ID de cliente de Google", async () => {
    entorno({ ...completo, NEXT_PUBLIC_GROWTH_GOOGLE_CLIENT_ID: undefined });
    await expect(cargarConfig()).rejects.toThrow(
      /NEXT_PUBLIC_GROWTH_GOOGLE_CLIENT_ID/
    );
  });
});

describe("config en desarrollo y en tests", () => {
  it("sin variables usa el proxy local y no lanza", async () => {
    entorno({
      NODE_ENV: "development",
      NEXT_PUBLIC_API_BASE_URL: undefined,
      NEXT_PUBLIC_GROWTH_GOOGLE_CLIENT_ID: undefined,
      NEXT_PUBLIC_GROWTH_DEMO: undefined,
    });
    const { config, API_LOCAL } = await cargarConfig();
    expect(config).toEqual({ apiBaseUrl: API_LOCAL, googleClientId: null });
  });

  it("la demostración no estorba en desarrollo", async () => {
    entorno({ NODE_ENV: "development", NEXT_PUBLIC_GROWTH_DEMO: "1" });
    await expect(cargarConfig()).resolves.toBeDefined();
  });
});

describe("esModoDemo", () => {
  it("solo se activa en desarrollo y con exactamente «1»", async () => {
    entorno({ NODE_ENV: "development", NEXT_PUBLIC_GROWTH_DEMO: "1" });
    expect((await cargarModoDemo()).esModoDemo()).toBe(true);

    for (const valor of ["0", "true", "si", "", undefined]) {
      entorno({ NODE_ENV: "development", NEXT_PUBLIC_GROWTH_DEMO: valor });
      expect((await cargarModoDemo()).esModoDemo()).toBe(false);
    }
  });

  it("en producción nunca, aunque la variable esté puesta", async () => {
    entorno({ NODE_ENV: "production", NEXT_PUBLIC_GROWTH_DEMO: "1" });
    expect((await cargarModoDemo()).esModoDemo()).toBe(false);
  });
});
