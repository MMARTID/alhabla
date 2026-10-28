import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FormularioDeCreacion } from "@/components/agenda/nueva-cita";
import { bloquearHoras, crearCita, marcarAusencia } from "@/lib/api";
import type { BookingProfessional, BookingService, BusinessSchedule } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  crearCita: vi.fn(),
  bloquearHoras: vi.fn(),
  marcarAusencia: vi.fn(),
}));
const mockedCrear = vi.mocked(crearCita);
const mockedBloquear = vi.mocked(bloquearHoras);
const mockedAusencia = vi.mocked(marcarAusencia);

// Viernes 2 de octubre de 2026 a mediodía en Madrid.
const AHORA = new Date("2026-10-02T10:00:00Z");
const tramos = { enabled: true, intervals: [{ start: "09:00", end: "20:00" }] };
const HORARIO: BusinessSchedule = {
  version: 1,
  week: {
    monday: tramos,
    tuesday: tramos,
    wednesday: tramos,
    thursday: tramos,
    friday: tramos,
    saturday: tramos,
    sunday: { enabled: false, intervals: [] },
  },
};
const SERVICIOS = [
  { id: "svc_corte", name: "Corte", durationMinutes: 30, priceCents: 1500, active: true },
  { id: "svc_color", name: "Color", durationMinutes: 60, priceCents: 4000, active: true },
  { id: "svc_viejo", name: "Antiguo", durationMinutes: 30, priceCents: null, active: false },
] as unknown as BookingService[];
const PROFESIONALES = [
  { id: "p1", name: "Lucía", active: true, serviceIds: [] },
  { id: "p2", name: "Marcos", active: true, serviceIds: [] },
] as unknown as BookingProfessional[];

function montar(extra: Partial<Parameters<typeof FormularioDeCreacion>[0]> = {}) {
  const onHecho = vi.fn();
  const onCancelar = vi.fn();
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <FormularioDeCreacion
        timeZone="Europe/Madrid"
        ahora={AHORA}
        horario={HORARIO}
        profesionales={PROFESIONALES}
        servicios={SERVICIOS}
        inicial={{ dia: "2026-10-05" }}
        onHecho={onHecho}
        onCancelar={onCancelar}
        {...extra}
      />
    </QueryClientProvider>
  );
  return { onHecho, onCancelar };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FormularioDeCreacion — Nueva cita", () => {
  it("comprueba el hueco antes de dejar apuntar y luego apunta con los mismos datos", async () => {
    const user = userEvent.setup();
    mockedCrear.mockImplementation(async (cuerpo) =>
      cuerpo.soloComprobar
        ? { ok: true, descripcion: "apuntar" }
        : {
            ok: true,
            mensaje: "Cita apuntada: Marta el lunes 5 a las 10:00 con Lucía.",
            cita: { id: "bk_nueva", programedAt: "2026-10-05T08:00:00Z", professional: { id: "p1", name: "Lucía" } },
          }
    );
    const { onHecho } = montar();

    // Sin servicio ni hora no se apunta nada.
    const apuntar = screen.getByRole("button", { name: /^Apuntar/ });
    expect(apuntar).toBeDisabled();
    expect(screen.getByText("Elige al menos un servicio.")).toBeInTheDocument();
    // Los servicios inactivos no se ofrecen.
    expect(screen.queryByRole("button", { name: /Antiguo/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Cliente"), "Marta");
    await user.click(screen.getByRole("button", { name: /Corte · 30 min/ }));
    await user.selectOptions(screen.getByLabelText("Hora"), "10:00");
    await user.selectOptions(screen.getByLabelText("Profesional"), "p1");

    await waitFor(() => expect(screen.getByText(/Hueco libre/)).toBeInTheDocument());
    expect(mockedCrear).toHaveBeenCalledWith(
      expect.objectContaining({
        fechaHora: "2026-10-05T10:00",
        servicios: ["svc_corte"],
        profesionalId: "p1",
        soloComprobar: true,
      })
    );

    await user.click(screen.getByRole("button", { name: "Apuntar a las 10:00" }));

    await waitFor(() => expect(onHecho).toHaveBeenCalled());
    expect(mockedCrear).toHaveBeenLastCalledWith({
      cliente: "Marta",
      telefono: undefined,
      fechaHora: "2026-10-05T10:00",
      servicios: ["svc_corte"],
      profesionalId: "p1",
    });
    expect(onHecho).toHaveBeenCalledWith({
      mensaje: "Cita apuntada: Marta el lunes 5 a las 10:00 con Lucía.",
      dia: "2026-10-05",
      citaId: "bk_nueva",
    });
  });

  it("enseña el motivo del servidor si el hueco no vale, y no deja apuntar", async () => {
    const user = userEvent.setup();
    mockedCrear.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Lucía no está ese día." } },
    });
    montar();

    await user.type(screen.getByLabelText("Cliente"), "Marta");
    await user.click(screen.getByRole("button", { name: /Corte · 30 min/ }));
    await user.selectOptions(screen.getByLabelText("Hora"), "10:00");

    await waitFor(() => expect(screen.getByText("Lucía no está ese día.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /^Apuntar/ })).toBeDisabled();
  });

  it("la duración de la cita es la suma de los servicios elegidos", async () => {
    const user = userEvent.setup();
    mockedCrear.mockResolvedValue({ ok: true, descripcion: "apuntar" });
    montar();

    await user.click(screen.getByRole("button", { name: /Corte · 30 min/ }));
    await user.click(screen.getByRole("button", { name: /Color · 60 min/ }));
    await user.selectOptions(screen.getByLabelText("Hora"), "10:00");

    await waitFor(() => expect(screen.getByText("Hueco libre (90 min)")).toBeInTheDocument());
    // A las 19:30 ya no caben 90 minutos antes del cierre a las 20:00.
    expect(screen.queryByRole("option", { name: "19:30" })).not.toBeInTheDocument();
  });
});

describe("FormularioDeCreacion — Bloquear horas y Ausencia", () => {
  it("bloquea un tramo del día con las horas elegidas", async () => {
    const user = userEvent.setup();
    mockedBloquear.mockResolvedValue({ ok: true, mensaje: "el lunes queda de 09:00 a 16:00." });
    const { onHecho } = montar();

    await user.click(screen.getByRole("tab", { name: "Bloquear horas" }));
    await user.selectOptions(screen.getByLabelText("Desde"), "16:00");
    await user.selectOptions(screen.getByLabelText("Hasta"), "20:00");
    await user.type(screen.getByLabelText(/Motivo/), "Médico");
    await user.click(screen.getByRole("button", { name: "Bloquear de 16:00 a 20:00" }));

    await waitFor(() => expect(onHecho).toHaveBeenCalledWith({ mensaje: "el lunes queda de 09:00 a 16:00.", dia: "2026-10-05" }));
    expect(mockedBloquear).toHaveBeenCalledWith({ fecha: "2026-10-05", desde: "16:00", hasta: "20:00", motivo: "Médico" });
  });

  it("marca una ausencia de día entero de la persona elegida", async () => {
    const user = userEvent.setup();
    mockedAusencia.mockResolvedValue({ ok: true, mensaje: "Marcos no está el lunes 5." });
    const { onHecho } = montar();

    await user.click(screen.getByRole("tab", { name: "Ausencia" }));
    await user.selectOptions(screen.getByLabelText("Quién"), "p2");
    await user.click(screen.getByRole("button", { name: "Marcar ausencia" }));

    await waitFor(() => expect(onHecho).toHaveBeenCalledWith({ mensaje: "Marcos no está el lunes 5.", dia: "2026-10-05" }));
    expect(mockedAusencia).toHaveBeenCalledWith({
      profesionalId: "p2",
      desde: "2026-10-05",
      hasta: undefined,
      motivo: undefined,
    });
  });
});
