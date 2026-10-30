import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  appUrl,
  growthUrl,
  origenesPermitidos,
  webUrl,
} from "../../src/lib/urls.js";

const VARS = [
  "APP_URL",
  "WEB_URL",
  "FRONTEND_URL",
  "GROWTH_URL",
  "EXTRA_ALLOWED_ORIGIN",
];
const previas: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const v of VARS) {
    previas[v] = process.env[v];
    delete process.env[v];
  }
});
afterEach(() => {
  for (const v of VARS) {
    if (previas[v] === undefined) delete process.env[v];
    else process.env[v] = previas[v];
  }
});

describe("urls", () => {
  it("sin variables, las dos apuntan a localhost:3001", () => {
    expect(appUrl()).toBe("http://localhost:3001");
    expect(webUrl("/register")).toBe("http://localhost:3001/register");
  });

  it("FRONTEND_URL sigue valiendo como respaldo de las dos, sin barra final", () => {
    process.env.FRONTEND_URL = "https://alhabla.ai/";
    expect(appUrl("/ajustes#whatsapp")).toBe(
      "https://alhabla.ai/ajustes#whatsapp"
    );
    expect(webUrl()).toBe("https://alhabla.ai");
  });

  it("APP_URL manda sobre FRONTEND_URL y WEB_URL sobre las dos", () => {
    process.env.FRONTEND_URL = "https://vieja.alhabla.ai";
    process.env.APP_URL = "https://app.alhabla.ai";
    expect(appUrl("/login")).toBe("https://app.alhabla.ai/login");
    expect(webUrl()).toBe("https://app.alhabla.ai");
    process.env.WEB_URL = "https://alhabla.ai";
    expect(webUrl("/blog")).toBe("https://alhabla.ai/blog");
  });

  it("el dashboard de Growth, sin variable, está en localhost:3003", () => {
    expect(growthUrl()).toBe("http://localhost:3003");
    expect(growthUrl("/oportunidades")).toBe(
      "http://localhost:3003/oportunidades"
    );
  });

  it("GROWTH_URL se lee sin barra final y no depende de APP_URL ni FRONTEND_URL", () => {
    process.env.FRONTEND_URL = "https://alhabla.ai";
    process.env.APP_URL = "https://app.alhabla.ai";
    process.env.GROWTH_URL = " https://growth.alhabla.ai/ ";
    expect(growthUrl()).toBe("https://growth.alhabla.ai");
  });

  it("CORS admite app, web, Growth y el origen extra, sin duplicados ni vacíos", () => {
    process.env.APP_URL = "https://app.alhabla.ai";
    process.env.WEB_URL = "https://alhabla.ai";
    process.env.GROWTH_URL = "https://growth.alhabla.ai";
    process.env.EXTRA_ALLOWED_ORIGIN = " ";
    expect([...origenesPermitidos()]).toEqual([
      "https://app.alhabla.ai",
      "https://alhabla.ai",
      "https://growth.alhabla.ai",
    ]);
    process.env.EXTRA_ALLOWED_ORIGIN = "https://tunel.trycloudflare.com";
    expect(origenesPermitidos().has("https://tunel.trycloudflare.com")).toBe(
      true
    );
    delete process.env.WEB_URL;
    // WEB_URL cae a APP_URL: app, Growth y el extra.
    expect(origenesPermitidos().size).toBe(3);
  });

  it("CORS no admite el origen del dashboard con otra escritura", () => {
    process.env.GROWTH_URL = "https://growth.alhabla.ai";
    const permitidos = origenesPermitidos();
    expect(permitidos.has("https://growth.alhabla.ai")).toBe(true);
    expect(permitidos.has("https://growth.alhabla.ai/")).toBe(false);
    expect(permitidos.has("http://growth.alhabla.ai")).toBe(false);
    expect(permitidos.has("https://evil-growth.alhabla.ai")).toBe(false);
  });
});
