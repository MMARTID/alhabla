import { describe, it, expect } from "vitest";
import {
  agendaDeNegocio,
  leerResultadoDelScript,
} from "../../mcp/calendarioFalso.js";
import type { ResultadoDeConsulta } from "../../mcp/sqlDeSoloLectura.js";

// Las dos herramientas del MCP para las pruebas de punta a punta de la agenda
// principal: calendario_falso (lee lo que devuelve el script de backend-sim)
// y agenda_dev (cruza citas y eventos del calendario falso).

describe("leerResultadoDelScript", () => {
  it("coge el JSON de la última línea con el separador, aunque antes haya logs", () => {
    const salida = [
      "[Calendar] Volcado de la agenda del negocio biz_1 a Google Calendar: 2 copiadas",
      '@@RESULTADO@@{"ok":true,"resultado":{"copiadas":2}}',
    ].join("\n");
    expect(leerResultadoDelScript(salida)).toEqual({
      ok: true,
      resultado: { copiadas: 2 },
    });
  });

  it("sin separador explica que backend-sim corre otra rama", () => {
    expect(() => leerResultadoDelScript("nada")).toThrow(/scripts\/sim/);
  });
});

function resultado(filas: Record<string, unknown>[]): ResultadoDeConsulta {
  return {
    columnas: Object.keys(filas[0] ?? {}),
    filas,
    totalFilas: filas.length,
    truncado: false,
  };
}

describe("agendaDeNegocio", () => {
  const cita = (extra: Record<string, unknown>) => ({
    id: "b",
    programedAt: new Date("2026-12-10T10:00:00Z"),
    durationMinutes: 45,
    isCancelled: false,
    externalEventId: null,
    copiaEnCalendario: null,
    ...extra,
  });

  it("cuenta las copias por estado y saca lo que no cuadra con el calendario falso", async () => {
    const eventos = [
      { id: "ev_ok", summary: "", inicio: "2026-12-10T10:00:00.000Z", fin: "2026-12-10T10:45:00.000Z", origen: "alhabla" },
      { id: "ev_movido", summary: "", inicio: "2026-12-10T12:00:00.000Z", fin: "2026-12-10T12:45:00.000Z", origen: "alhabla" },
      { id: "ev_cancelada", summary: "", inicio: "2026-12-10T16:00:00.000Z", fin: "2026-12-10T16:45:00.000Z", origen: "alhabla" },
      { id: "amano1", summary: "Dentista", inicio: "2026-12-11T09:00:00.000Z", fin: "2026-12-11T10:00:00.000Z", origen: "a_mano" },
    ];
    const ejecutar = async (sql: string) => {
      if (sql.includes("FROM bookings")) {
        return resultado([
          cita({ id: "b_ok", externalEventId: "ev_ok", copiaEnCalendario: "hecha" }),
          cita({ id: "b_movida", externalEventId: "ev_movido", copiaEnCalendario: "hecha" }),
          cita({ id: "b_borrada", externalEventId: "ev_borrado", copiaEnCalendario: "hecha" }),
          cita({ id: "b_sin", copiaEnCalendario: "pendiente" }),
          cita({ id: "b_cancelada", isCancelled: true, externalEventId: "ev_cancelada" }),
        ]);
      }
      if (sql.includes("FROM businesses")) {
        return resultado([{ calendarProvider: "google", provider: "google", connected: true }]);
      }
      if (sql.includes("FROM claves_temporales")) {
        return resultado([{ valor: JSON.stringify({ estado: "ok", eventos }) }]);
      }
      return resultado([]);
    };

    const agenda = await agendaDeNegocio("postgres://dev", { businessId: "biz_1" }, { ejecutar });

    expect(agenda.copias).toEqual({ hecha: 3, pendiente: 1 });
    expect(agenda.descuadres).toEqual({
      activasSinEvento: ["b_sin"],
      eventoDeCitaCancelada: ["b_cancelada"],
      eventoAOtraHora: [
        { bookingId: "b_movida", cita: "2026-12-10T10:00:00.000Z", evento: "2026-12-10T12:00:00.000Z" },
      ],
      eventoQueNoEsta: ["b_borrada"],
      apuntadosAMano: [eventos[3]],
    });
  });

  it("sin calendario falso no hay descuadres que calcular; un negocio que no existe falla", async () => {
    const ejecutar = async (sql: string) =>
      sql.includes("FROM businesses")
        ? resultado([{ calendarProvider: null, provider: null }])
        : resultado([]);
    const agenda = await agendaDeNegocio("postgres://dev", { businessId: "biz_1" }, { ejecutar });
    expect(agenda.calendarioFalso).toBeNull();
    expect(agenda).not.toHaveProperty("descuadres");

    await expect(
      agendaDeNegocio("postgres://dev", { businessId: "no" }, { ejecutar: async () => resultado([]) })
    ).rejects.toThrow(/No existe el negocio/);
  });
});
