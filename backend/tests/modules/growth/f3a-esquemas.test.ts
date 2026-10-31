import { describe, it, expect } from "vitest";
import {
  AltaDeTareaBody,
  CATEGORIAS_DE_TAREA,
  CambioDeTareaBody,
  ESTADOS_DE_TAREA,
  ORIGENES_DE_TAREA,
  RESULTADOS_DE_TAREA,
  TareaDescartadaBody,
  TareaHechaBody,
} from "../../../src/modules/growth/esquemas.js";

/**
 * Panel útil — los esquemas de las tareas a mano: los catálogos del contrato
 * (que el panel repite en sus tipos) y lo que aceptan y rechazan los cuerpos.
 */

describe("panel útil: esquemas de las tareas a mano", () => {
  it("los catálogos son los del contrato", () => {
    expect([...CATEGORIAS_DE_TAREA]).toEqual([
      "directorio_software",
      "directorio_ia",
      "sector",
      "asociacion",
      "otro",
    ]);
    expect([...ORIGENES_DE_TAREA]).toEqual(["repo", "manual"]);
    expect([...ESTADOS_DE_TAREA]).toEqual(["pendiente", "hecha", "descartada"]);
    expect([...RESULTADOS_DE_TAREA]).toEqual([
      "alta_creada",
      "en_revision",
      "rechazada",
      "sin_alta_gratuita",
      "otro",
    ]);
  });

  describe("AltaDeTareaBody", () => {
    const base = { titulo: "Un directorio", url: "https://ejemplo.com/alta" };

    it("solo exige título y URL", () => {
      expect(AltaDeTareaBody.parse(base)).toEqual(base);
    });

    it("recorta el título y normaliza el dominio (minúsculas, sin www)", () => {
      expect(
        AltaDeTareaBody.parse({
          ...base,
          titulo: "  Un directorio  ",
          dominio: " WWW.Ejemplo.COM ",
        })
      ).toMatchObject({ titulo: "Un directorio", dominio: "ejemplo.com" });
    });

    it("un dominio en blanco pasa a null (el de la URL)", () => {
      expect(
        AltaDeTareaBody.parse({ ...base, dominio: "" }).dominio
      ).toBeNull();
    });

    it("rechaza lo que no es una URL http(s) sin credenciales", () => {
      for (const url of [
        "ejemplo.com",
        "ftp://ejemplo.com/",
        "javascript:alert(1)",
        "data:text/html,x",
        "https://u:p@ejemplo.com/",
        "https://alhabla.ai@sitio-malo.com/",
      ]) {
        expect(AltaDeTareaBody.safeParse({ ...base, url }).success, url).toBe(
          false
        );
      }
    });

    it("rechaza campos que no existen y textos con el carácter nulo", () => {
      expect(
        AltaDeTareaBody.safeParse({ ...base, origen: "repo" }).success
      ).toBe(false);
      expect(
        AltaDeTareaBody.safeParse({ ...base, notas: "a\u0000b" }).success
      ).toBe(false);
      expect(
        AltaDeTareaBody.safeParse({ ...base, pasos: ["a\u0000b"] }).success
      ).toBe(false);
    });

    it("los pasos: hasta 12 de 300, ninguno en blanco", () => {
      const con = (pasos: string[]) =>
        AltaDeTareaBody.safeParse({ ...base, pasos }).success;
      expect(con(Array(12).fill("p".repeat(300)))).toBe(true);
      expect(con(Array(13).fill("p"))).toBe(false);
      expect(con(["p".repeat(301)])).toBe(false);
      expect(con([""])).toBe(false);
      expect(con(["  "])).toBe(false);
    });
  });

  describe("CambioDeTareaBody", () => {
    it("pide al menos un campo, y uno a null cuenta como cambio", () => {
      expect(CambioDeTareaBody.safeParse({}).success).toBe(false);
      expect(CambioDeTareaBody.safeParse({ notas: null }).success).toBe(true);
      expect(CambioDeTareaBody.safeParse({ dominio: null }).success).toBe(true);
      expect(CambioDeTareaBody.safeParse({ pasos: [] }).success).toBe(true);
    });

    it("no deja cambiar el origen, el estado ni el resultado", () => {
      for (const campo of ["origen", "estado", "resultado", "siembra"]) {
        expect(
          CambioDeTareaBody.safeParse({ titulo: "X", [campo]: "x" }).success,
          campo
        ).toBe(false);
      }
    });
  });

  describe("TareaHechaBody y TareaDescartadaBody", () => {
    it("el cuerpo vacío vale (resultado y nota son opcionales)", () => {
      expect(TareaHechaBody.parse({})).toEqual({});
      expect(TareaDescartadaBody.parse({})).toEqual({});
    });

    it("el resultado es uno de los cinco; la nota, de hasta 500", () => {
      for (const resultado of RESULTADOS_DE_TAREA) {
        expect(TareaHechaBody.safeParse({ resultado }).success, resultado).toBe(
          true
        );
      }
      expect(TareaHechaBody.safeParse({ resultado: "genial" }).success).toBe(
        false
      );
      expect(TareaHechaBody.safeParse({ nota: "n".repeat(500) }).success).toBe(
        true
      );
      expect(TareaHechaBody.safeParse({ nota: "n".repeat(501) }).success).toBe(
        false
      );
      expect(
        TareaDescartadaBody.safeParse({ nota: "n".repeat(501) }).success
      ).toBe(false);
    });
  });
});
