import { describe, it, expect } from "vitest";
import { proximosDias } from "../../src/lib/proximosDias.js";

describe("proximosDias", () => {
  it("hoy y 13 días más, con el mes al empezar y al cambiar (E4: el jueves es el 5)", () => {
    // Viernes 30 de octubre de 2026 por la tarde en Madrid.
    expect(
      proximosDias(new Date("2026-10-30T16:00:00Z"), "Europe/Madrid")
    ).toBe(
      "Próximos días: hoy, viernes 30 de octubre; sábado 31; domingo 1 de noviembre; lunes 2; martes 3; miércoles 4; jueves 5; viernes 6; sábado 7; domingo 8; lunes 9; martes 10; miércoles 11; jueves 12."
    );
  });

  it("el día es el de la zona del negocio, no el del servidor", () => {
    // 23:30 UTC del sábado 31 de octubre: en Madrid ya es domingo 1.
    expect(
      proximosDias(new Date("2026-10-31T23:30:00Z"), "Europe/Madrid")
    ).toMatch(/^Próximos días: hoy, domingo 1 de noviembre; lunes 2;/);
    // Y en Canarias aún es sábado 31.
    expect(
      proximosDias(new Date("2026-10-31T23:30:00Z"), "Atlantic/Canary")
    ).toMatch(
      /^Próximos días: hoy, sábado 31 de octubre; domingo 1 de noviembre;/
    );
  });

  it("sin zona, la de Madrid", () => {
    expect(proximosDias(new Date("2026-10-31T23:30:00Z"), "")).toMatch(
      /^Próximos días: hoy, domingo 1 de noviembre/
    );
  });
});
