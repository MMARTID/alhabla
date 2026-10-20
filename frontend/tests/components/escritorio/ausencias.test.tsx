import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgendaEscritorio } from "@/components/escritorio/agenda/agenda-escritorio";
import { getAgenda, getAusencias, getBookingSettings, quitarAusencia } from "@/lib/api";
import type { AusenciaDelEquipo, BookingSettings, Business } from "@/lib/types";

const replace = vi.fn();
let busqueda = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/agenda",
  useSearchParams: () => new URLSearchParams(busqueda),
}));
vi.mock("@/lib/api", () => ({
  getAgenda: vi.fn(),
  getBookingSettings: vi.fn(),
  getAusencias: vi.fn(),
  quitarAusencia: vi.fn(),
  moverCita: vi.fn(),
  cancelarCita: vi.fn(),
  avisarClienteDeCita: vi.fn(),
}));

const tramos = { enabled: true, intervals: [{ start: "09:00", end: "20:00" }] };
const NEGOCIO = {
  id: "biz_1",
  name: "Peluquería Aurora",
  timezone: "Europe/Madrid",
  schedule: {
    version: 1,
    week: { monday: tramos, tuesday: tramos, wednesday: tramos, thursday: tramos, friday: tramos, saturday: tramos, sunday: { enabled: false, intervals: [] } },
  },
  calendarProvider: "google",
  activeCalendar: { provider: "google", connected: true, calendarId: "primary", accountEmail: null, disconnectedAt: null, lastError: null },
} as unknown as Business;

const AJUSTES = {
  bookingCapacity: 2,
  services: [],
  professionals: [
    { id: "p_laura", name: "Laura", active: true, serviceIds: [], serviceLevels: {} },
    { id: "p_marta", name: "Marta", active: true, serviceIds: [], serviceLevels: {} },
  ],
} as unknown as BookingSettings;

// Lunes 9 de noviembre de 2026, día entero en Madrid (CET).
const AUSENCIA: AusenciaDelEquipo = {
  id: "aus_1",
  professionalId: "p_marta",
  professionalName: "Marta",
  startsAt: "2026-11-08T23:00:00.000Z",
  endsAt: "2026-11-09T23:00:00.000Z",
  reason: "baja",
  createdVia: "owner_chat",
};

function pintar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AgendaEscritorio business={NEGOCIO} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-09T07:00:00Z"));
  busqueda = "vista=dia";
  vi.mocked(getAgenda).mockResolvedValue({ from: "", until: "", total: 0, limit: 200, offset: 0, hasMore: false, bookings: [] });
  vi.mocked(getBookingSettings).mockResolvedValue(AJUSTES);
  vi.mocked(getAusencias).mockResolvedValue([AUSENCIA]);
  vi.mocked(quitarAusencia).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ausencias en la agenda de escritorio (vista Día)", () => {
  it("marca la ausencia en la columna de esa persona y la quita tras confirmar", async () => {
    const user = userEvent.setup({ advanceTimers: () => {} });
    pintar();

    const quitar = await screen.findByRole("button", { name: "Quitar la ausencia de Marta (todo el día)" });
    expect(screen.getByText("Ausente todo el día")).toBeInTheDocument();
    // Laura no tiene ninguna: solo hay un aviso en toda la vista.
    expect(screen.getAllByText(/^Ausente todo el día$/)).toHaveLength(1);
    // Se pidió el día natural del negocio, no el del navegador.
    expect(getAusencias).toHaveBeenCalledWith("2026-11-08T23:00:00.000Z", "2026-11-09T23:00:00.000Z");

    await user.click(quitar);
    const dialogo = screen.getByRole("dialog", { name: "¿Quitar la ausencia de Marta?" });
    expect(within(dialogo).getByText(/La recepcionista volverá a reservarle citas en ese tramo/)).toBeInTheDocument();
    vi.mocked(getAusencias).mockResolvedValue([]);
    await user.click(within(dialogo).getByRole("button", { name: "Quitar ausencia" }));

    expect(quitarAusencia).toHaveBeenCalledWith("aus_1");
    expect(await screen.findByText(/Ausencia de Marta quitada/)).toBeInTheDocument();
    expect(screen.queryByText("Ausente todo el día")).not.toBeInTheDocument();
  });

  it("si no se confirma, no se quita nada", async () => {
    const user = userEvent.setup({ advanceTimers: () => {} });
    pintar();

    await user.click(await screen.findByRole("button", { name: "Quitar la ausencia de Marta (todo el día)" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Dejarla" }));

    expect(quitarAusencia).not.toHaveBeenCalled();
    expect(screen.getByText("Ausente todo el día")).toBeInTheDocument();
  });
});
