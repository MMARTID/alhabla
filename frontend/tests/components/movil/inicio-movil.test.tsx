import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InicioMovil } from "@/components/movil/inicio-movil";
import {
  getAgenda,
  getBillingSummary,
  getBookingSettings,
  getCalls,
  getOnboardingState,
  getPendingBookings,
  getPhoneNumberInfo,
  getStats,
  resolverCitaPendiente,
} from "@/lib/api";
import type { Business } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  getAgenda: vi.fn(),
  getBillingSummary: vi.fn(),
  getCalls: vi.fn(),
  getCall: vi.fn(),
  getOnboardingState: vi.fn(),
  getPendingBookings: vi.fn(),
  getPhoneNumberInfo: vi.fn(),
  getStats: vi.fn(),
  dismissOnboarding: vi.fn(),
  marcarRecado: vi.fn(),
  provisionPhoneNumber: vi.fn(),
  resolverCitaPendiente: vi.fn(),
  getBookingSettings: vi.fn().mockResolvedValue({ professionals: [], services: [] }),
  moverCita: vi.fn(),
  cancelarCita: vi.fn(),
  avisarClienteDeCita: vi.fn(),
  confirmForwarding: vi.fn(),
  getForwardingCheck: vi.fn(),
  startForwardingCheck: vi.fn(),
  updateMyBusiness: vi.fn(),
}));
vi.mock("@/components/providers", () => ({ useBusiness: () => ({ hasToken: true }) }));

const abierto = { enabled: true, intervals: [{ start: "09:00", end: "20:00" }] };
const cerrado = { enabled: false, intervals: [] };
const horario = {
  version: 1,
  week: {
    monday: abierto,
    tuesday: abierto,
    wednesday: abierto,
    thursday: abierto,
    friday: abierto,
    saturday: abierto,
    sunday: cerrado,
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
  activeCalendar: { provider: "google", connected: true, calendarId: "primary", accountEmail: "a@b.es", disconnectedAt: null, lastError: null },
  agents: [],
} as unknown as Business;

function conCliente(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("InicioMovil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Solo el reloj: los temporizadores reales siguen para que esperen los findBy.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T04:00:00Z")); // 06:00 en Madrid
    vi.mocked(getAgenda).mockResolvedValue({
      from: "",
      until: "",
      total: 2,
      limit: 50,
      offset: 0,
      hasMore: false,
      bookings: [
        {
          id: "bk_1",
          callId: "c1",
          programedAt: "2026-10-02T08:30:00Z",
          durationMinutes: 150,
          numberPeople: 1,
          clientPhone: "+34633901274",
          professional: { id: "p3", name: "Marisol" },
          services: [{ id: "s3", name: "Mechas balayage", durationMinutes: 150, priceCents: 11000 }],
          externalEventId: null,
          externalCalendarProvider: null,
        },
        {
          id: "bk_2",
          callId: "c2",
          programedAt: "2026-10-02T15:30:00Z",
          durationMinutes: 90,
          numberPeople: 1,
          clientPhone: "+34655214409",
          professional: { id: "p1", name: "Lucía" },
          services: [{ id: "s2", name: "Corte y color", durationMinutes: 90, priceCents: 6500 }],
          externalEventId: null,
          externalCalendarProvider: null,
        },
      ],
    });
    vi.mocked(getPendingBookings).mockResolvedValue([
      {
        id: "lead_1",
        callId: "c9",
        createdAt: "2026-10-01T17:10:00Z",
        clientName: "Rosa",
        clientPhone: "634559021",
        requestedAt: "2026-10-03T09:00:00Z",
        failureCode: "BOOKING_LOCK_TIMEOUT",
      },
    ]);
    vi.mocked(getPhoneNumberInfo).mockResolvedValue({ phoneNumber: "+34910004127", sid: null, purchasedAt: null, status: "active" });
    vi.mocked(getOnboardingState).mockResolvedValue({
      steps: { schedule: true, services: true, professionals: true, calendar: true, whatsapp: true, forwarding: true },
      progress: 100,
      dismissedAt: null,
      completedAt: null,
      isActive: false,
      forwarding: { status: "done", phoneNumber: "+34910004127", confirmedAt: null, firstCallAt: null },
    });
    vi.mocked(getBillingSummary).mockResolvedValue({ includedMinutes: 100, consumedMinutes: 30, extraMinuteCents: 45 } as never);
    vi.mocked(getCalls).mockResolvedValue({ data: [], total: 0, limit: 6, offset: 0, conteos: { todas: 0, conCita: 0, porDevolver: 0 } });
    vi.mocked(getStats).mockResolvedValue({} as never);
    vi.mocked(getBookingSettings).mockResolvedValue({ bookingCapacity: 2, professionals: [], services: [] });
  });

  afterEach(() => vi.useRealTimers());

  it("ordena por urgencia: la cita caída, luego la próxima con su cuenta atrás", async () => {
    conCliente(<InicioMovil business={negocio} avisoDeCalendario={null} />);

    expect(await screen.findByRole("heading", { name: "Una cita se quedó sin reservar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Llamar a Rosa/ })).toHaveAttribute("href", "tel:+34634559021");
    const proxima = await screen.findByRole("region", { name: "Próxima cita" });
    expect(within(proxima).getByText("10:30")).toBeInTheDocument();
    expect(within(proxima).getByText("en 4 h 30 min")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Más tarde hoy" })).toBeInTheDocument();
    expect(screen.getByText("Corte y color")).toBeInTheDocument();
  });

  it("«Ya la he confirmado» cierra la cita pendiente", async () => {
    vi.mocked(resolverCitaPendiente).mockResolvedValue({ ok: true, yaResuelta: false });
    conCliente(<InicioMovil business={negocio} avisoDeCalendario={null} />);

    await userEvent.click(await screen.findByRole("button", { name: "Ya la he confirmado" }));
    expect(resolverCitaPendiente).toHaveBeenCalledWith("lead_1", expect.anything());
    expect(await screen.findByText("Cita marcada como confirmada.")).toBeInTheDocument();
  });

  it("el chip de estado cuenta los avisos y abre su hoja", async () => {
    conCliente(<InicioMovil business={negocio} avisoDeCalendario={null} />);

    const chip = await screen.findByRole("button", { name: "Estado del servicio: 1 aviso" });
    await userEvent.click(chip);
    const hoja = await screen.findByRole("dialog", { name: "Estado del servicio" });
    expect(within(hoja).getByText("Un asunto requiere tu atención")).toBeInTheDocument();
    expect(within(hoja).getByText("Cita sin reservar")).toBeInTheDocument();
  });

  it("sin horario avisa de que atiende pero no reserva, con un solo aviso más en el chip", async () => {
    conCliente(<InicioMovil business={{ ...negocio, schedule: {} }} avisoDeCalendario={null} />);

    expect(await screen.findByRole("link", { name: /Configura tu horario/ })).toHaveAttribute("href", "/agente/horario");
    const chip = await screen.findByRole("button", { name: "Estado del servicio: 2 avisos" });
    await userEvent.click(chip);
    const hoja = await screen.findByRole("dialog", { name: "Estado del servicio" });
    expect(within(hoja).getByText("Atiende, pero no reserva: falta el horario")).toBeInTheDocument();
    expect(within(hoja).getByRole("link", { name: "Configurar horario" })).toHaveAttribute("href", "/agente/horario");
  });

  it("sin agenda, «Atiende, pero no reserva» no suma un segundo aviso", async () => {
    conCliente(
      <InicioMovil
        business={{ ...negocio, activeCalendar: { ...negocio.activeCalendar!, connected: false } }}
        avisoDeCalendario={null}
      />
    );

    // La cita sin reservar y la agenda: la recepcionista no cuenta aparte.
    const chip = await screen.findByRole("button", { name: "Estado del servicio: 2 avisos" });
    await userEvent.click(chip);
    const hoja = await screen.findByRole("dialog", { name: "Estado del servicio" });
    expect(within(hoja).getByText("Atiende, pero no reserva: falta elegir dónde reservar")).toBeInTheDocument();
  });

  it("en la agenda de Alhabla, sin calendario externo, atiende y reserva", async () => {
    conCliente(
      <InicioMovil business={{ ...negocio, activeCalendar: null, modoDeAgenda: "alhabla" }} avisoDeCalendario={null} />
    );

    // Solo la cita sin reservar: ni la agenda ni la recepcionista avisan.
    const chip = await screen.findByRole("button", { name: "Estado del servicio: 1 aviso" });
    expect(screen.queryByRole("link", { name: /Elige dónde reservar/ })).not.toBeInTheDocument();
    await userEvent.click(chip);
    const hoja = await screen.findByRole("dialog", { name: "Estado del servicio" });
    expect(within(hoja).getByText("Atendiendo llamadas")).toBeInTheDocument();
  });

  it("avisa de los profesionales con el nombre del alta y de los servicios sin precio", async () => {
    const profesional = (id: string, name: string) => ({
      id,
      name,
      active: true,
      serviceIds: [],
      serviceLevels: {},
      createdAt: "",
      updatedAt: "",
    });
    const servicio = (id: string, priceCents: number | null) => ({
      id,
      name: `Servicio ${id}`,
      durationMinutes: 30,
      priceCents,
      active: true,
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(getBookingSettings).mockResolvedValue({
      bookingCapacity: 2,
      professionals: [profesional("p1", "Profesional 1"), profesional("p2", "Profesional 2"), profesional("p3", "Marta")],
      services: [servicio("s1", null), servicio("s2", 2500)],
    });

    conCliente(<InicioMovil business={negocio} avisoDeCalendario={null} />);

    const equipo = await screen.findByRole("link", { name: /Ponles nombre a tu equipo/ });
    expect(equipo).toHaveAttribute("href", "/agente/profesionales");
    expect(equipo).toHaveTextContent("«Profesional 1» y «Profesional 2» siguen con el nombre del alta");
    const precios = screen.getByRole("link", { name: /Pon precio a tus servicios/ });
    expect(precios).toHaveAttribute("href", "/agente/servicios");
    expect(precios).toHaveTextContent("Un servicio no tiene precio");
  });

  it("con «Dar precios: nunca» no pide precios", async () => {
    vi.mocked(getBookingSettings).mockResolvedValue({
      bookingCapacity: 2,
      professionals: [],
      services: [{ id: "s1", name: "Corte", durationMinutes: 30, priceCents: null, active: true, createdAt: "", updatedAt: "" }],
    });

    conCliente(
      <InicioMovil
        business={{ ...negocio, agentSettings: { darPrecios: "nunca" } as Business["agentSettings"] }}
        avisoDeCalendario={null}
      />
    );

    await screen.findByRole("region", { name: "Próxima cita" });
    expect(screen.queryByRole("link", { name: /Pon precio a tus servicios/ })).not.toBeInTheDocument();
  });

  it("al llegar con ?desvio=abrir abre los pasos del desvío si falta", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      steps: { schedule: true, services: true, professionals: true, calendar: true, whatsapp: true, forwarding: false },
      progress: 80,
      dismissedAt: null,
      completedAt: null,
      isActive: true,
      forwarding: { status: "ready", phoneNumber: "+34910004127", confirmedAt: null, firstCallAt: null },
    });

    conCliente(<InicioMovil business={negocio} avisoDeCalendario={null} abrirDesvio={1} />);

    expect(await screen.findByRole("dialog", { name: "Desvía tu teléfono" })).toBeInTheDocument();
  });
});
