import { describe, expect, it } from "vitest";
import { ESCENAS_DE_OFICIO, enFrase } from "@/lib/escenas-de-oficio";
import { SECTORES } from "@/lib/sectores";
import { GUIONES_SECTOR } from "@/lib/relato-guiones";
import { NICHE_ACCENTS } from "@/lib/niche-accents";

/**
 * Las escenas del oficio de la portada (components/escenas-de-oficio.tsx):
 * una por landing, en el orden del menú, con la misma clienta, el mismo
 * servicio y el mismo profesional que el guion de su landing, y dentro de
 * los límites de longitud con los que se escribieron.
 */

const palabras = (texto: string) => texto.split(/\s+/).filter(Boolean).length;

const PROHIBIDAS = [
  /telnyx/i,
  /\bgestor\b/i,
  /recepcionista virtual/i,
  /recepcionista de voz/i,
  /agenda real/i,
  /persona real/i,
];

describe("escenas del oficio", () => {
  it("hay ocho, una por landing de sector y en el orden del menú", () => {
    expect(ESCENAS_DE_OFICIO.map((e) => e.slug)).toEqual(Object.keys(SECTORES));
  });

  it("cada una se llama como su sector y tiene acento", () => {
    for (const escena of ESCENAS_DE_OFICIO) {
      expect(escena.oficio, escena.slug).toBe(SECTORES[escena.slug].nombre);
      expect(NICHE_ACCENTS[escena.slug], escena.slug).toBeDefined();
    }
  });

  it("quien llama, el servicio y el profesional son los del guion de su landing", () => {
    for (const { slug, llamada, cita } of ESCENAS_DE_OFICIO) {
      const guion = GUIONES_SECTOR[slug];
      expect(llamada.quien, slug).toBe(
        `${guion.cliente.nombre} ${guion.cliente.apellido}`
      );
      expect(cita.servicio, slug).toBe(guion.servicio.nombre);
      expect(cita.con, slug).toBe(guion.profesional);
    }
  });

  it("las citas son del jueves (piden «mañana») y ninguna repite hora", () => {
    const horas = ESCENAS_DE_OFICIO.map((e) => e.cita.cuando);
    for (const hora of horas)
      expect(hora).toMatch(/^Jue ([01]\d|2[0-3]):[0-5]\d$/);
    expect(new Set(horas).size).toBe(horas.length);
    for (const { slug, llamada } of ESCENAS_DE_OFICIO) {
      expect(llamada.dice, slug).toMatch(/mañana/);
    }
  });

  it("caben en sus límites de palabras", () => {
    for (const e of ESCENAS_DE_OFICIO) {
      expect(palabras(e.momento), `${e.slug}: momento`).toBeLessThanOrEqual(6);
      expect(palabras(e.llamada.dice), `${e.slug}: dice`).toBeLessThanOrEqual(
        12
      );
      expect(palabras(e.detalle), `${e.slug}: detalle`).toBeLessThanOrEqual(18);
      expect(palabras(e.enlace), `${e.slug}: enlace`).toBeLessThanOrEqual(4);
    }
  });

  it("el momento sigue a «Suena y estás» con minúscula", () => {
    for (const { slug, momento } of ESCENAS_DE_OFICIO) {
      const frase = `Suena y estás ${enFrase(momento)}.`;
      expect(frase.charAt(14), slug).toBe(
        frase.charAt(14).toLocaleLowerCase("es-ES")
      );
    }
    expect(enFrase("Con el tinte a media cabeza")).toBe(
      "con el tinte a media cabeza"
    );
  });

  it("los detalles no comparten cinco palabras seguidas y usan el vocabulario de la web", () => {
    const tejas = (texto: string) => {
      const ps = texto.toLowerCase().match(/[a-záéíóúüñ0-9]+/g) ?? [];
      return new Set(
        ps.slice(0, -4).map((_, i) => ps.slice(i, i + 5).join(" "))
      );
    };
    const vistas = new Map<string, string>();
    for (const { slug, detalle } of ESCENAS_DE_OFICIO) {
      for (const teja of tejas(detalle)) {
        expect(vistas.get(teja), `${slug} repite «${teja}»`).toBeUndefined();
        vistas.set(teja, slug);
      }
    }
    for (const e of ESCENAS_DE_OFICIO) {
      for (const texto of [e.momento, e.llamada.dice, e.detalle, e.enlace]) {
        for (const prohibida of PROHIBIDAS)
          expect(texto, e.slug).not.toMatch(prohibida);
      }
    }
  });

  it("fisioterapia no saca el síntoma de quien llama", () => {
    const fisio = ESCENAS_DE_OFICIO.find((e) => e.slug === "fisioterapia");
    expect(fisio?.llamada.dice).not.toMatch(/duele|espalda|dolor/i);
  });
});
