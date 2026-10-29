import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CheckoutResultPage from "@/app/checkout/resultado/page";
import {
  getBillingSummary,
  getOnboardingState,
  getPhoneNumberInfo,
  reconcileCheckoutSession,
} from "@/lib/api";
import type { ForwardingStatus, OnboardingState, PhoneNumberStatus } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  getBillingSummary: vi.fn(),
  getOnboardingState: vi.fn(),
  getPhoneNumberInfo: vi.fn(),
  reconcileCheckoutSession: vi.fn(),
}));

const mockedGetBillingSummary = vi.mocked(getBillingSummary);
const mockedReconcileCheckoutSession = vi.mocked(reconcileCheckoutSession);
const mockedGetPhoneNumberInfo = vi.mocked(getPhoneNumberInfo);
const mockedGetOnboardingState = vi.mocked(getOnboardingState);

function numero(status: PhoneNumberStatus | null, forwardingStatus: ForwardingStatus, cambios: Partial<OnboardingState["forwarding"]> = {}) {
  const phoneNumber = status === "active" ? "+34910004127" : null;
  mockedGetPhoneNumberInfo.mockResolvedValue({ phoneNumber, sid: null, purchasedAt: null, status });
  mockedGetOnboardingState.mockResolvedValue({
    steps: { schedule: true, services: true, professionals: true, calendar: true, whatsapp: true, forwarding: forwardingStatus === "done" },
    progress: 80,
    dismissedAt: null,
    completedAt: null,
    isActive: true,
    forwarding: { status: forwardingStatus, phoneNumber, confirmedAt: null, firstCallAt: null, ...cambios },
  });
}

/** Desde Next 15 `searchParams` es una promesa y la página la lee con
 * `use()`. Next la entrega ya resuelta; marcarla como cumplida hace que
 * `use()` devuelva el valor sin suspender, igual que en la app. */
function resuelta<T>(valor: T): Promise<T> {
  return Object.assign(Promise.resolve(valor), {
    status: "fulfilled" as const,
    value: valor,
  });
}

function renderPage(sessionId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CheckoutResultPage searchParams={resuelta({ session_id: sessionId })} />
    </QueryClientProvider>
  );
}

describe("CheckoutResultPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    numero("active", "ready");
  });

  it("con session_id, reconcilia esa sesión de checkout en vez de pedir el resumen general", async () => {
    mockedReconcileCheckoutSession.mockResolvedValue({ status: "ACTIVE" } as any);

    renderPage("cs_test_123");

    await waitFor(() => expect(mockedReconcileCheckoutSession).toHaveBeenCalledWith("cs_test_123"));
    expect(mockedGetBillingSummary).not.toHaveBeenCalled();
  });

  it("sin session_id, pide el resumen de facturación general", async () => {
    mockedGetBillingSummary.mockResolvedValue({ status: "TRIALING" } as any);

    renderPage(undefined);

    await waitFor(() => expect(mockedGetBillingSummary).toHaveBeenCalled());
    expect(mockedReconcileCheckoutSession).not.toHaveBeenCalled();
  });

  it("con estado ACTIVE y el número listo, lleva a activar el desvío y a la llamada de prueba", async () => {
    mockedGetBillingSummary.mockResolvedValue({ status: "ACTIVE" } as any);

    renderPage();

    expect(await screen.findByText("Suscripción confirmada")).toBeInTheDocument();
    const cta = await screen.findByRole("link", { name: "Activar el desvío" });
    expect(cta).toHaveAttribute("href", "/?desvio=abrir");
    expect(screen.getByText(/pulsa «Comprobar desvío». Te haremos una llamada de prueba/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar mi negocio" })).toHaveAttribute("href", "/agente?from=checkout");
    expect(screen.queryByRole("button", { name: /Actualizar/ })).not.toBeInTheDocument();
  });

  it("si el número aún se está comprando, lo dice y sigue sondeando", async () => {
    mockedGetBillingSummary.mockResolvedValue({ status: "ACTIVE" } as any);
    numero("pending", "waiting_number");

    renderPage();

    expect(await screen.findByText("Activando tu número…")).toBeInTheDocument();
    expect(screen.getByText(/Estamos activando tu número, que tarda unos minutos/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al panel" })).toHaveAttribute("href", "/?desvio=abrir");
    expect(screen.queryByRole("link", { name: "Activar el desvío" })).not.toBeInTheDocument();
  });

  it("si la compra del número falló, manda al panel a reintentarla", async () => {
    mockedGetBillingSummary.mockResolvedValue({ status: "ACTIVE" } as any);
    numero("failed", "waiting_number");

    renderPage();

    expect(await screen.findByText(/no hemos podido asignarte el número/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al panel" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("Activando tu número…")).not.toBeInTheDocument();
  });

  it("con el desvío ya hecho, invita a la llamada de prueba a su número", async () => {
    mockedGetBillingSummary.mockResolvedValue({ status: "ACTIVE" } as any);
    numero("active", "done", { customerLine: "+34912345678" });

    renderPage();

    expect(await screen.findByText(/Haz una llamada de prueba al \+34 912 34 56 78/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir al panel" })).toHaveAttribute("href", "/");
  });

  it("con estado TRIALING, también se considera confirmado", async () => {
    mockedGetBillingSummary.mockResolvedValue({ status: "TRIALING" } as any);

    renderPage();

    expect(await screen.findByText("Suscripción confirmada")).toBeInTheDocument();
  });

  it("con un estado pendiente, muestra el mensaje de espera y permite reintentar", async () => {
    mockedGetBillingSummary.mockResolvedValue({ status: "INCOMPLETE" } as any);

    renderPage();

    expect(await screen.findByText("Estamos confirmando tu suscripción")).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: "Ver facturación" });
    expect(cta).toHaveAttribute("href", "/ajustes/facturacion");
    expect(screen.getByRole("button", { name: /Actualizar/ })).toBeInTheDocument();
    // Sin plan confirmado no se compra número: no se pregunta por él.
    expect(mockedGetPhoneNumberInfo).not.toHaveBeenCalled();
    expect(mockedGetOnboardingState).not.toHaveBeenCalled();
  });

  it("el botón Actualizar vuelve a pedir el estado de la suscripción", async () => {
    mockedGetBillingSummary.mockResolvedValue({ status: "INCOMPLETE" } as any);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Estamos confirmando tu suscripción");
    mockedGetBillingSummary.mockClear();

    await user.click(screen.getByRole("button", { name: /Actualizar/ }));

    await waitFor(() => expect(mockedGetBillingSummary).toHaveBeenCalled());
  });

  it("propaga hasPlaceSchedule al CTA si el flag estaba en localStorage, y lo consume", async () => {
    window.localStorage.setItem("alhabla_place_schedule_imported", "true");
    mockedGetBillingSummary.mockResolvedValue({ status: "ACTIVE" } as any);

    renderPage();

    const cta = await screen.findByRole("link", { name: "Revisar mi negocio" });
    expect(cta).toHaveAttribute("href", "/agente?from=checkout&hasPlaceSchedule=true");
    expect(window.localStorage.getItem("alhabla_place_schedule_imported")).toBeNull();
  });
});
