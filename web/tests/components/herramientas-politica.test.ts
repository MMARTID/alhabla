import { describe, expect, it } from "vitest";
import { EJEMPLOS_DE_POLITICA, generarPolitica, POLITICA_POR_DEFECTO } from "@/components/herramientas/politica-de-cancelacion";

/**
 * El generador de /herramientas/politica-de-cancelacion escribe textos que
 * un negocio pegará en su mostrador: lo legal que la página promete
 * (cláusula recíproca de la señal, art. 87.2 TRLGDCU) tiene que salir.
 */
describe("generarPolitica", () => {
  it("sin señal no habla de señal y da el plazo y cómo avisar", () => {
    const { cartel, web, confirmacion } = generarPolitica({ ...POLITICA_POR_DEFECTO, telefono: "912 345 678" });
    expect(web).toContain("hasta 24 horas antes");
    expect(web).toContain("llamando al 912 345 678");
    expect(cartel).toContain("llama al 912 345 678");
    expect(`${cartel} ${web} ${confirmacion}`).not.toMatch(/señal/i);
  });

  it("con señal, la cláusula recíproca viene por defecto", () => {
    const { web } = generarPolitica({ ...POLITICA_POR_DEFECTO, senal: "porcentaje", cantidad: "20" });
    expect(web).toContain("una señal del 20 % del precio");
    expect(web).toContain("te compensamos con la misma cantidad");
  });

  it("sin la recíproca, al menos devuelve la señal entera", () => {
    const { web } = generarPolitica({ ...POLITICA_POR_DEFECTO, senal: "fija", cantidad: "15", reciproca: false });
    expect(web).toContain("te devolvemos la señal entera");
  });

  it("el límite de ausencias usa el número elegido", () => {
    const { web } = generarPolitica({ ...POLITICA_POR_DEFECTO, ausencias: "dejar", maxAusencias: "3" });
    expect(web).toContain("a 3 citas");
  });

  it("todos los ejemplos de sector generan los tres textos", () => {
    for (const { valores } of EJEMPLOS_DE_POLITICA) {
      const textos = generarPolitica({ ...POLITICA_POR_DEFECTO, ...valores });
      expect(textos.cartel.length).toBeGreaterThan(50);
      expect(textos.web.length).toBeGreaterThan(100);
      expect(textos.confirmacion).toContain("respondiendo a este mensaje");
    }
  });
});
