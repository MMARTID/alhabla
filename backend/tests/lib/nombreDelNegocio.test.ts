import { describe, it, expect } from "vitest";
import { nombreDelNegocioDecible } from "../../src/lib/nombreDelNegocio.js";

describe("nombreDelNegocioDecible", () => {
  it("devuelve el nombre real sin saltos ni espacios seguidos, y sin recortarlo", () => {
    expect(nombreDelNegocioDecible("  Peluquería\n  Ana ")).toBe(
      "Peluquería Ana"
    );
    expect(nombreDelNegocioDecible("x".repeat(70))).toHaveLength(70);
  });

  it("descarta el nombre provisional del registro, los emails y los vacíos", () => {
    for (const nombre of [
      "Negocio de ana@example.com",
      "  Negocio de   ana@example.com",
      "Negocio de Ana",
      "ana@example.com",
      "",
      "   ",
    ]) {
      expect(nombreDelNegocioDecible(nombre), nombre).toBeNull();
    }
  });
});
