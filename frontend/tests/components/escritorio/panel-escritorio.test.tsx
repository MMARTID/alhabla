import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PanelEscritorio } from "@/components/escritorio/panel-escritorio";
import {
  getAgenda,
  getBookingSettings,
  getCalls,
  getOnboardingState,
  getPendingBookings,
  getPhoneNumberInfo,
  getStats,
} from "@/lib/api";
import type { Business, OnboardingState } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/hooks/use-aviso-de-minutos", () => ({ useMinutesWarning: () => null }));
vi.mock("@/lib/api", () => ({
  getAgenda: vi.fn(),
  getBookingSettings: vi.fn(),
  getCalls: vi.fn(),
  getOnboardingState: vi.fn(),
  getPendingBookings: vi.fn(),
  getPhoneNumberInfo: vi.fn(),
  getStats: vi.fn(),
  dismissOnboarding: vi.fn(),
  provisionPhoneNumber: vi.fn(),
  resolverCitaPendiente: vi.fn(),
  confirmForwarding: vi.fn(),
  getForwardingCheck: vi.fn(),
  startForwardingCheck: vi.fn(),
  updateMyBusiness: vi.fn(),
}));

const abierto = { enabled: true, intervals: [{ start: "09:00", end: "20:00" }] };
const horario = {
  version: 1,
  week: {
    monday: abierto,
    tuesday: abierto,
    wednesday: abierto,
    thursday: abierto,
    friday: abierto,
    saturday: abierto,
    sunday: { enabled: false, intervals: [] },
  },
  exceptions: [],
};

const negocio = {
  id: "biz_1",
  name: "Peluquería Aurora",
  phone: "+34912345678",
  timezone: "Europe/Madrid",
  schedule: horario,
  plan: "basic",
  active: true,
  bookingCapacity: 2,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  subscriptionStatus: "ACTIVE",
  calendarProvider: "google",
  activeCalendar: { provider: "google", connected: true, calendarId: "primary", accountEmail: null, disconnectedAt: null, lastError: null },
  agents: [],
} as unknown as Business;

function onboarding(forwarding: OnboardingState["forwarding"]["status"]): OnboardingState {
  return {
    steps: { schedule: true, services: true, professionals: true, calendar: true, whatsapp: true, forwarding: forwarding === "done" },
    progress: 100,
    dismissedAt: null,
    completedAt: null,
    isActive: false,
    forwarding: { status: forwarding, phoneNumber: "+34910004127", confirmedAt: null, firstCallAt: null },
  };
}

function conCliente(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("PanelEscritorio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAgenda).mockResolvedValue({ from: "", until: "", total: 0, limit: 200, offset: 0, hasMore: false, bookings: [] });
    vi.mocked(getCalls).mockResolvedValue({ data: [], total: 0, limit: 6, offset: 0 });
    vi.mocked(getStats).mockResolvedValue({} as never);
    vi.mocked(getPendingBookings).mockResolvedValue([]);
    vi.mocked(getPhoneNumberInfo).mockResolvedValue({ phoneNumber: "+34910004127", sid: null, purchasedAt: null, status: "active" });
    vi.mocked(getOnboardingState).mockResolvedValue(onboarding("done"));
    vi.mocked(getBookingSettings).mockResolvedValue({ bookingCapacity: 2, professionals: [], services: [] });
  });

  it("sin horario avisa de que la recepcionista atiende pero no reserva", async () => {
    conCliente(<PanelEscritorio business={{ ...negocio, schedule: {} }} avisoDeCalendario={null} />);

    const tarjeta = await screen.findByRole("link", { name: /Configura tu horario/ });
    expect(tarjeta).toHaveAttribute("href", "/agente?section=business-hours");
    expect(tarjeta).toHaveTextContent("atiende pero no puede reservar ninguna cita");
  });

  it("enlaza a Profesionales si alguno sigue con el nombre del alta", async () => {
    vi.mocked(getBookingSettings).mockResolvedValue({
      bookingCapacity: 2,
      professionals: [
        { id: "p1", name: "Profesional 1", active: true, serviceIds: [], serviceLevels: {}, createdAt: "", updatedAt: "" },
      ],
      services: [],
    });

    conCliente(<PanelEscritorio business={negocio} avisoDeCalendario={null} />);

    const enlace = await screen.findByRole("link", { name: /Ponle nombre a tu profesional/ });
    expect(enlace).toHaveAttribute("href", "/agente?section=professionals");
    expect(enlace).toHaveTextContent("«Profesional 1» sigue con el nombre del alta");
  });

  it("al volver del pago abre los pasos del desvío, y al cerrarlos no se reabren", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue(onboarding("ready"));

    conCliente(<PanelEscritorio business={negocio} avisoDeCalendario={null} abrirDesvio={1} />);

    const dialogo = await screen.findByRole("dialog", { name: "Desvía tu teléfono a la recepcionista" });
    expect(dialogo).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Desvía tu teléfono a la recepcionista" })).not.toBeInTheDocument();
  });

  it("con el desvío hecho no abre nada aunque se pida", async () => {
    conCliente(<PanelEscritorio business={negocio} avisoDeCalendario={null} abrirDesvio={1} />);

    await screen.findByRole("heading", { name: "Hoy" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
