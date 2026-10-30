import { describe, it, expect } from "vitest";
import {
  PREFIJO_DE_TOKEN,
  administradoresDeGrowth,
  generarTokenDeAgente,
  hashDeToken,
} from "../../../src/modules/growth/tokens.js";

describe("tokens de agente de Growth", () => {
  it("lleva el prefijo y no repite", () => {
    const a = generarTokenDeAgente();
    const b = generarTokenDeAgente();
    expect(a.token.startsWith(PREFIJO_DE_TOKEN)).toBe(true);
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThan(40);
  });

  it("guarda solo el hash, y es el SHA-256 del token", () => {
    const { token, hash } = generarTokenDeAgente();
    expect(hash).toBe(hashDeToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });
});

describe("administradoresDeGrowth", () => {
  it("separa por comas, recorta y pasa a minúsculas", () => {
    expect(
      administradoresDeGrowth(" Admin@Alhabla.ai , otra@alhabla.ai ,, ")
    ).toEqual(["admin@alhabla.ai", "otra@alhabla.ai"]);
  });

  it("sin variable no hay administradores", () => {
    const original = process.env.GROWTH_ADMIN_EMAILS;
    delete process.env.GROWTH_ADMIN_EMAILS;
    try {
      expect(administradoresDeGrowth("")).toEqual([]);
      expect(administradoresDeGrowth()).toEqual([]);
    } finally {
      if (original !== undefined) process.env.GROWTH_ADMIN_EMAILS = original;
    }
  });
});
