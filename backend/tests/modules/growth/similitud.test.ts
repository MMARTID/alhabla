import { describe, it, expect } from "vitest";
import {
  maximaSimilitud,
  similitud,
} from "../../../src/modules/growth/similitud.js";

const MENSAJE =
  "Hola, soy el fundador de Alhabla. Hemos creado una recepcionista de IA para peluquerías y barberías en España que atiende las llamadas y reserva citas.";

describe("similitud entre textos", () => {
  it("un texto es idéntico a sí mismo", () => {
    expect(similitud(MENSAJE, MENSAJE)).toBe(1);
  });

  it("ignora mayúsculas, acentos y signos", () => {
    expect(
      similitud(
        "Recepcionista de IA para peluquerías",
        "RECEPCIONISTA, de IA... para peluquerias!"
      )
    ).toBe(1);
  });

  it("dos mensajes sin nada en común no se parecen", () => {
    expect(
      similitud(
        MENSAJE,
        "El tiempo mañana será soleado con vientos flojos del norte"
      )
    ).toBe(0);
  });

  it("cambiar una palabra suelta sigue siendo casi lo mismo", () => {
    const casi = MENSAJE.replace("peluquerías", "salones");
    expect(similitud(MENSAJE, casi)).toBeGreaterThan(0.6);
    expect(similitud(MENSAJE, casi)).toBeLessThan(1);
  });

  it("un texto vacío no se parece a nada", () => {
    expect(similitud("", MENSAJE)).toBe(0);
    expect(similitud("", "")).toBe(0);
  });

  it("los textos de menos de tres palabras se comparan por palabras", () => {
    expect(similitud("hola mundo", "hola mundo")).toBe(1);
    expect(similitud("hola", "adiós")).toBe(0);
  });

  it("devuelve el mayor parecido con cualquiera de los anteriores", () => {
    const otros = ["nada que ver con esto en absoluto de verdad", MENSAJE];
    expect(maximaSimilitud(MENSAJE, otros)).toBe(1);
    expect(maximaSimilitud(MENSAJE, [])).toBe(0);
  });
});
