import { describe, it, expect } from "vitest";
import ICAL from "ical.js";
import {
  construirFeedIcs,
  tituloDeCitaDelFeed,
  uidDeCitaDelFeed,
} from "../../src/lib/feedIcal.js";

function eventos(ics: string) {
  const vcalendar = new ICAL.Component(ICAL.parse(ics));
  return {
    vcalendar,
    vevents: vcalendar.getAllSubcomponents("vevent").map((v) => ({
      uid: v.getFirstPropertyValue("uid"),
      summary: v.getFirstPropertyValue("summary"),
      description: v.getFirstPropertyValue("description"),
      status: v.getFirstPropertyValue("status"),
      transp: v.getFirstPropertyValue("transp"),
      dtstart: String(v.getFirstPropertyValue("dtstart")),
      dtend: String(v.getFirstPropertyValue("dtend")),
    })),
  };
}

describe("feedIcal (PLAN-AGENDA-ALHABLA.md, fase 3)", () => {
  it("el título lleva servicio y nombre, nunca el teléfono", () => {
    expect(tituloDeCitaDelFeed({ clientName: "Marta", serviceNames: ["Corte"] })).toBe("Corte · Marta");
    expect(tituloDeCitaDelFeed({ clientName: " Marta ", serviceNames: ["Corte", "Mechas"] })).toBe(
      "Corte y Mechas · Marta"
    );
    expect(tituloDeCitaDelFeed({ clientName: null, serviceNames: [] })).toBe("Cita");
    expect(tituloDeCitaDelFeed({ clientName: "", serviceNames: ["Corte"] })).toBe("Corte");
  });

  it("construye un VCALENDAR con nombre, un VEVENT por cita (UID estable) y las ausencias como «No está»", () => {
    const ics = construirFeedIcs({
      nombreDelNegocio: "Peluquería Ana",
      ahora: new Date("2026-10-28T12:00:00Z"),
      citas: [
        {
          id: "bk_1",
          programedAt: new Date("2026-11-05T16:00:00Z"),
          durationMinutes: 45,
          clientName: "Marta",
          serviceNames: ["Corte"],
          professionalName: "Laura",
          isCancelled: false,
          updatedAt: new Date("2026-10-20T10:00:00Z"),
        },
        {
          id: "bk_2",
          programedAt: new Date("2026-11-06T09:00:00Z"),
          durationMinutes: 30,
          clientName: "Pedro",
          serviceNames: [],
          professionalName: null,
          isCancelled: true,
          updatedAt: new Date("2026-10-27T10:00:00Z"),
        },
      ],
      ausencias: [
        {
          id: "aus_1",
          professionalName: "Laura",
          startsAt: new Date("2026-11-10T00:00:00Z"),
          endsAt: new Date("2026-11-12T00:00:00Z"),
          reason: "Vacaciones",
        },
      ],
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("X-WR-CALNAME:Agenda de Peluquería Ana");
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).not.toMatch(/\+34|6\d{8}/);

    const { vevents } = eventos(ics);
    expect(vevents).toHaveLength(3);
    expect(vevents[0]).toMatchObject({
      uid: uidDeCitaDelFeed("bk_1"),
      summary: "Corte · Marta",
      description: "Con Laura",
      status: "CONFIRMED",
      transp: "OPAQUE",
      dtstart: "2026-11-05T16:00:00Z",
      dtend: "2026-11-05T16:45:00Z",
    });
    // La cancelada reciente se publica como CANCELLED para que el calendario
    // suscrito la retire.
    expect(vevents[1]).toMatchObject({
      uid: "cita-bk_2@alhabla.ai",
      summary: "Cita · Pedro",
      status: "CANCELLED",
      transp: "TRANSPARENT",
    });
    expect(vevents[2]).toMatchObject({
      uid: "ausencia-aus_1@alhabla.ai",
      summary: "No está: Laura",
      description: "Vacaciones",
      transp: "TRANSPARENT",
      dtstart: "2026-11-10T00:00:00Z",
      dtend: "2026-11-12T00:00:00Z",
    });
  });

  it("sin citas ni ausencias sigue siendo un calendario válido", () => {
    const ics = construirFeedIcs({ nombreDelNegocio: "Barbería", citas: [], ausencias: [] });
    expect(eventos(ics).vevents).toHaveLength(0);
    expect(ics).toContain("END:VCALENDAR");
  });
});
