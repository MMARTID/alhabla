import { describe, it, expect } from "vitest";
import { esNombreDeClienteValido } from "../../src/lib/nombreDelCliente.js";

describe("esNombreDeClienteValido", () => {
  it("acepta nombres reales", () => {
    for (const nombre of ["Marta García", "Joan", "Ana María", "Mª José", "Lu"]) {
      expect(esNombreDeClienteValido(nombre), nombre).toBe(true);
    }
  });

  // Laboratorio del 14-10: lo que mandó la recepcionista antes de preguntar.
  it("rechaza vacíos, rellenos y variables sin sustituir", () => {
    for (const nombre of [
      "",
      "   ",
      "Cliente",
      "No indicado",
      "{{nombre_cliente}}",
      "Desconocido",
      "anónimo",
      "Sin nombre.",
      "N/A",
      null,
      undefined,
    ]) {
      expect(esNombreDeClienteValido(nombre as string), String(nombre)).toBe(
        false
      );
    }
  });
});
