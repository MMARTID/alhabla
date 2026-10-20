import { describe, it, expect } from "vitest";
import {
  CODIGO_ANULAR_DESVIOS_MOVIL,
  CODIGOS_FIJO,
  CODIGOS_MOVIL,
  OPERADORES,
  esOperador,
  guiaDeDesvio,
  type LineaDeDesvio,
  type OperadorId,
} from "@/lib/desvio-por-operador";

const NUMERO = "+34930453218";
const LINEAS: LineaDeDesvio[] = ["movil", "fijo"];
const COMPANIAS: Array<OperadorId | null> = [
  null,
  ...OPERADORES.map((operador) => operador.id),
];

function codigosDe(linea: LineaDeDesvio, operador: OperadorId | null) {
  return guiaDeDesvio(linea, operador).grupos.flatMap((grupo) => grupo.codigos);
}

describe("guiaDeDesvio", () => {
  it.each(
    LINEAS.flatMap((linea) => COMPANIAS.map((op) => [linea, op] as const))
  )(
    "%s · %s: ids únicos, el recomendado primero y el número dentro de cada código",
    (linea, operador) => {
      const guia = guiaDeDesvio(linea, operador);
      const codigos = codigosDe(linea, operador);
      const ids = codigos.map((codigo) => codigo.id);

      expect(guia.comoMarcar.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
      for (const grupo of guia.grupos) {
        expect(grupo.codigos[0].recomendado).toBe(true);
        expect(grupo.codigos[0].tipo).toBe("no-contesta");
        expect(grupo.codigos.slice(1).some((c) => c.recomendado)).toBe(false);
      }
      const numero = linea === "fijo" ? "930453218" : NUMERO;
      for (const codigo of codigos) {
        expect(codigo.activar(NUMERO)).toContain(numero);
        expect(codigo.desactivar).not.toContain(numero);
      }
    }
  );

  it("en el móvil, cualquier compañía lleva el aviso del buzón y el del iPhone", () => {
    for (const operador of COMPANIAS) {
      const avisos = guiaDeDesvio("movil", operador).avisos.join(" ");
      expect(avisos).toMatch(/sustituye al buzón de voz/);
      expect(avisos).toMatch(/Buzón de voz en vivo/);
    }
  });

  it("los del estándar: **61* en el móvil y *61*…# con 9 cifras en el fijo", () => {
    expect(CODIGOS_MOVIL.map((c) => c.activar(NUMERO))).toEqual([
      "**61*+34930453218#",
      "**67*+34930453218#",
      "**62*+34930453218#",
      "**21*+34930453218#",
    ]);
    expect(CODIGOS_FIJO.map((c) => [c.activar(NUMERO), c.desactivar])).toEqual([
      ["*61*930453218#", "#61#"],
      ["*67*930453218#", "#67#"],
      ["*21*930453218#", "#21#"],
    ]);
    // Un número que no es español no se toca.
    expect(CODIGOS_FIJO[0].activar("+447700900123")).toBe("*61*+447700900123#");
    expect(CODIGO_ANULAR_DESVIOS_MOVIL).toBe("##002#");
  });

  it("el fijo de Simyo no existe: sin códigos", () => {
    expect(guiaDeDesvio("fijo", "simyo").grupos).toEqual([]);
  });

  it("el móvil de Simyo no ofrece «comunicando», que no publica", () => {
    expect(codigosDe("movil", "simyo").map((c) => c.tipo)).toEqual([
      "no-contesta",
      "apagado",
      "todas",
    ]);
  });

  it("Avatel publica los del móvil con un solo asterisco", () => {
    expect(codigosDe("movil", "avatel")[0].activar(NUMERO)).toBe(
      "*61*+34930453218#"
    );
  });

  it("esOperador solo acepta las compañías de la lista", () => {
    expect(esOperador("vodafone")).toBe(true);
    expect(esOperador("")).toBe(false);
    expect(esOperador("telefonica")).toBe(false);
  });
});
