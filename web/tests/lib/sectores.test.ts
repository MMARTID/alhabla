import { describe, expect, it } from "vitest";
import { SECTORES } from "@/lib/sectores";
import type { SectorLanding } from "@/lib/sectores/tipos";
import { paginasDeLaSeccion } from "@/lib/paginas";

/**
 * Los límites de la plantilla «Las preguntas de la dueña»
 * (PLAN-WEB-CONTENIDO.md) y el vocabulario de la web, sobre los datos de
 * cada sector: así quien escribe un sector se entera aquí y no en la
 * revisión de diseño.
 */

const palabras = (texto: string) => texto.split(/\s+/).filter(Boolean).length;

/** Todo el texto visible de un sector, para el barrido de vocabulario. */
function textos(s: SectorLanding): string[] {
  return [
    s.descripcion,
    s.hero.frase,
    s.llamada.pregunta,
    s.llamada.respuesta,
    ...s.llamada.lineas.map((l) => ("accion" in l ? l.accion : l.texto)),
    s.asistente.pregunta,
    s.asistente.respuesta,
    ...s.asistente.turnos.map((t) => t.texto),
    s.whatsapp.pregunta,
    s.whatsapp.respuesta,
    s.whatsapp.confirmacion.servicio,
    s.whatsapp.confirmacion.cuando,
    ...s.whatsapp.conversacion.map((m) => m.texto),
    s.oficio.pregunta,
    s.oficio.respuesta,
    ...s.oficio.equipo,
    ...s.oficio.servicios.map((f) => f.servicio),
    s.oficio.reparto,
    s.oficio.salud?.texto ?? "",
    ...s.faqs.flatMap((f) => [f.question, f.answer]),
    s.cierre,
  ];
}

const PROHIBIDAS = [
  /telnyx/i,
  /\bgestor\b/i,
  /recepcionista virtual/i,
  /recepcionista de voz/i,
  /agenda real/i,
  /calendario real/i,
  /24\/7/,
  /competitiv/i,
  /productividad/i,
  /llenar la agenda/i,
  /persona real/i,
];

describe("datos de las landings de sector", () => {
  it("hay uno por cada página de sector del registro", () => {
    const rutas = paginasDeLaSeccion("sectores").map((p) => p.ruta);
    expect(
      Object.keys(SECTORES)
        .map((s) => `/${s}`)
        .sort()
    ).toEqual([...rutas].sort());
  });

  for (const sector of Object.values(SECTORES)) {
    describe(sector.slug, () => {
      it("respeta los límites de palabras", () => {
        expect(sector.descripcion.length).toBeLessThanOrEqual(160);
        expect(palabras(sector.hero.frase)).toBeLessThanOrEqual(25);
        for (const p of [
          sector.llamada,
          sector.asistente,
          sector.whatsapp,
          sector.oficio,
        ]) {
          expect(palabras(p.respuesta), p.pregunta).toBeLessThanOrEqual(40);
        }
        expect(palabras(sector.oficio.reparto)).toBeLessThanOrEqual(30);
        if (sector.oficio.salud) {
          expect(palabras(sector.oficio.salud.texto)).toBeLessThanOrEqual(50);
        }
        for (const f of sector.faqs) {
          expect(palabras(f.answer), f.question).toBeLessThanOrEqual(60);
        }
        expect(palabras(sector.cierre)).toBeLessThanOrEqual(16);
      });

      it("no usa el vocabulario prohibido", () => {
        for (const texto of textos(sector)) {
          for (const prohibida of PROHIBIDAS) {
            expect(texto, String(prohibida)).not.toMatch(prohibida);
          }
        }
      });

      it("la llamada reserva y manda el WhatsApp, y el saludo lo pone la plantilla", () => {
        const acciones = sector.llamada.lineas.flatMap((l) =>
          "accion" in l ? [l.icono] : []
        );
        expect(acciones).toContain("reserva");
        expect(acciones).toContain("whatsapp");
        const primera = sector.llamada.lineas[0];
        expect("texto" in primera && primera.texto).not.toMatch(
          /inteligencia artificial/
        );
      });

      it("la tabla de servicios enseña los tres niveles y duraciones reales", () => {
        const niveles = new Set(
          sector.oficio.servicios.flatMap((f) => f.niveles)
        );
        expect([...niveles].sort()).toEqual([
          "especialista",
          "lo-hace",
          "no-sugerir",
        ]);
        expect(new Set(sector.oficio.equipo).size).toBe(3);
        for (const f of sector.oficio.servicios) {
          expect(f.minutos % 5, f.servicio).toBe(0);
          expect(f.minutos, f.servicio).toBeGreaterThanOrEqual(15);
          expect(f.minutos, f.servicio).toBeLessThanOrEqual(240);
        }
      });
    });
  }
});
