import { describe, it, expect } from "vitest";

import { nicheLandings, type NicheSlug } from "@/lib/niche-landings";
import {
  GUION_GENERAL,
  GUIONES_SECTOR,
  HORA_CITA,
  guionDe,
  relato,
  sumarMinutos,
} from "@/lib/relato-guiones";

const SECTORES = Object.keys(nicheLandings) as NicheSlug[];

/**
 * Los guiones del relato iPhone → portátil: uno por landing, la misma
 * historia con el vocabulario de cada sector.
 */
describe("relato-guiones", () => {
  it("hay un guion por sector y la portada usa el general", () => {
    expect(Object.keys(GUIONES_SECTOR).sort()).toEqual([...SECTORES].sort());
    expect(guionDe()).toBe(GUION_GENERAL);
    for (const sector of SECTORES) {
      expect(guionDe(sector)).toBe(GUIONES_SECTOR[sector]);
    }
  });

  it("suma minutos a una hora", () => {
    expect(sumarMinutos("17:30", 90)).toBe("19:00");
    expect(sumarMinutos("17:30", 45)).toBe("18:15");
    expect(sumarMinutos("09:50", 15)).toBe("10:05");
  });

  it.each([
    ["general", GUION_GENERAL] as const,
    ...SECTORES.map((s) => [s, GUIONES_SECTOR[s]] as const),
  ])("el guion %s cuenta la historia completa con sus nombres", (_, guion) => {
    const r = relato(guion);
    // El saludo real: el nombre del negocio y el aviso de IA (art. 50 RIA).
    expect(r.saludo).toContain(guion.negocio);
    expect(r.saludo).toContain("inteligencia artificial");
    // Como la recepcionista real: la duración solo si pasa de 80 minutos;
    // el permiso de grabar, mientras comprueba el hueco; y el resumen y el
    // WhatsApp en un solo turno, sin prometer el recordatorio (Pro y Scale).
    expect(r.ofrece.includes("minutos")).toBe(guion.servicio.minutos > 80);
    const textos = r.turnos.map((t) => t.texto);
    const grabar = textos.findIndex((t) => t.includes("grabe tus llamadas"));
    const nombre = textos.findIndex((t) => t.includes("¿A nombre de quién"));
    const resumen = textos.findIndex((t) => t.includes("¿Te la reservo"));
    expect(grabar).toBeGreaterThan(0);
    expect(nombre).toBeGreaterThan(grabar);
    expect(resumen).toBeGreaterThan(nombre);
    expect(textos[resumen]).toContain(guion.profesional);
    expect(textos[resumen]).toContain("por WhatsApp");
    expect(textos.some((t) => t.includes("recordatorio"))).toBe(false);
    expect(textos.some((t) => t.includes("Un momento"))).toBe(false);
    // La agenda: la cuarta fila es el hueco libre, con su duración.
    expect(r.agenda).toHaveLength(6);
    expect(r.agenda[3].hora).toBe(HORA_CITA);
    expect(r.agenda[3].detalle).toContain(`${guion.servicio.minutos} min`);
    // Un hueco de 30 minutos no cabe: el servicio dura más.
    expect(guion.servicio.minutos).toBeGreaterThan(30);
    // Las tres notificaciones de la pantalla de bloqueo.
    // El aviso al dueño, con el formato de avisoNuevaReserva.
    expect(r.avisos).toHaveLength(1);
    expect(r.avisos[0].texto).toBe(
      `${guion.negocio}: nueva cita. ${guion.cliente.nombre}, jueves ${HORA_CITA}, ${guion.servicio.nombre}, con ${guion.profesional}. Ya está en tu agenda.`
    );
    // El Gestor: la baja y las citas, una propuesta cada vez.
    expect(r.asistente.baja).toContain(guion.profesional);
    expect(r.asistente.orden).toContain(guion.companera);
    expect(r.asistente.propuesta).toMatch(/^¿Confirmas\? Marcar a /);
    expect(r.asistente.siguiente).toMatch(/^¿Confirmas\? Mover /);
    expect(r.asistente.siguiente).toContain(guion.companera);
    expect(guion.companera).not.toBe(guion.profesional);
    // Los teléfonos son del rango sin atribuir (79…).
    expect(guion.cliente.telefono).toMatch(/^\+34 79/);
  });
});
