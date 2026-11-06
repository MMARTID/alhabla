import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterBusinessCalendarPage from "@/app/bienvenida/calendar/page";
import { BUSINESS_TYPE_ONBOARDING_TEXTS } from "@/lib/business-type";
import type { Business } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  getGoogleCalendarAuthUrl: vi.fn(),
  getMicrosoftCalendarAuthUrl: vi.fn(),
}));

// El formulario de Apple es el mismo de Agente › Calendario y tiene sus
// propios tests (tests/components/apple-calendar-connect.test.tsx): aquí solo
// importa qué hace el paso cuando se conecta o se cancela.
vi.mock("@/components/apple-calendar-connect", () => ({
  AppleCalendarConnect: ({
    onConnected,
    onCancel,
  }: {
    onConnected: (business: Business) => void;
    onCancel: () => void;
  }) => (
    <div>
      <p>Formulario de Apple</p>
      <button type="button" onClick={() => onConnected({} as Business)}>
        Elegir calendario de prueba
      </button>
      <button type="button" onClick={onCancel}>
        Cancelar Apple
      </button>
    </div>
  ),
}));

function mockLocation(search: string) {
  const original = window.location;
  let hrefValue = `http://localhost/bienvenida/calendar${search}`;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...original,
      search,
      get href() {
        return hrefValue;
      },
      set href(value: string) {
        hrefValue = value;
      },
    },
  });
  return {
    getHref: () => hrefValue,
    restore: () =>
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      }),
  };
}

describe("RegisterBusinessCalendarPage", () => {
  let location: ReturnType<typeof mockLocation> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("alhabla_token", "token");
  });

  afterEach(() => {
    location?.restore();
    location = undefined;
  });

  // PLAN-AGENDA-PRINCIPAL.md: el paso ya no elige dónde se reserva. La agenda
  // viene puesta y se pregunta si hay citas apuntadas en otro sitio.
  it("dice que la agenda ya está lista y ofrece las tres salidas", async () => {
    location = mockLocation("?businessType=barberia");
    render(<RegisterBusinessCalendarPage />);

    expect(
      await screen.findByRole("heading", { name: "Tu agenda ya está lista" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        BUSINESS_TYPE_ONBOARDING_TEXTS.barberia.calendar.subheading
      )
    ).toHaveTextContent(/cortes y barbas en ella desde la primera llamada/);
    expect(
      screen.getByRole("button", { name: /En Google Calendar, Outlook o el iPhone/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /En papel o en otro programa/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /No, empiezo aquí/ })).toBeInTheDocument();
    // Ya no hay modo que elegir ni aviso de «toma nota pero no reserva».
    expect(screen.queryByText(/no reserva/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Usar la agenda de Alhabla/ })).not.toBeInTheDocument();
  });

  it("«No, empiezo aquí» sigue al pago del plan elegido", async () => {
    const user = userEvent.setup();
    location = mockLocation("?businessType=peluqueria&plan=inicio");
    render(<RegisterBusinessCalendarPage />);

    await user.click(await screen.findByRole("button", { name: /No, empiezo aquí/ }));

    await waitFor(() => expect(location?.getHref()).toBe("/checkout?plan=inicio"));
  });

  it("«En papel o en otro programa» explica cómo pasar lo que ya tiene y sigue", async () => {
    const user = userEvent.setup();
    location = mockLocation("?businessType=peluqueria&plan=pro");
    render(<RegisterBusinessCalendarPage />);

    await user.click(await screen.findByRole("button", { name: /En papel o en otro programa/ }));
    expect(
      screen.getByText(BUSINESS_TYPE_ONBOARDING_TEXTS.peluqueria.calendar.sinCalendario)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Seguir" }));
    await waitFor(() => expect(location?.getHref()).toBe("/checkout?plan=pro"));
  });

  it("todos los sectores tienen el texto de la agenda lista, sin «no reserva»", () => {
    for (const textos of Object.values(BUSINESS_TYPE_ONBOARDING_TEXTS)) {
      expect(textos.calendar.heading).toBe("Tu agenda ya está lista");
      expect(textos.calendar.subheading).toMatch(
        /^Tu recepcionista reservará .+ en ella desde la primera llamada\. ¿Tienes ya citas apuntadas en otro sitio\?$/
      );
      expect(textos.calendar.sinCalendario).not.toMatch(/no reserva/);
    }
  });

  it("ofrece Apple / iCloud dentro de «En Google Calendar, Outlook o el iPhone» con el mismo formulario de Agente", async () => {
    const user = userEvent.setup();
    location = mockLocation("?businessType=peluqueria");
    render(<RegisterBusinessCalendarPage />);

    await user.click(
      await screen.findByRole("button", { name: /En Google Calendar, Outlook o el iPhone/ })
    );
    const apple = screen.getByRole("button", { name: /Apple \/ iCloud/ });
    expect(apple).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Formulario de Apple")).not.toBeInTheDocument();

    await user.click(apple);
    expect(apple).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Formulario de Apple")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar Apple" }));
    expect(screen.queryByText("Formulario de Apple")).not.toBeInTheDocument();
  });

  it("al conectar Apple sigue al pago del plan elegido, como a la vuelta de Google", async () => {
    const user = userEvent.setup();
    location = mockLocation("?businessType=peluqueria&plan=pro");
    render(<RegisterBusinessCalendarPage />);

    await user.click(
      await screen.findByRole("button", { name: /En Google Calendar, Outlook o el iPhone/ })
    );
    await user.click(screen.getByRole("button", { name: /Apple \/ iCloud/ }));
    await user.click(
      screen.getByRole("button", { name: "Elegir calendario de prueba" })
    );

    expect(screen.getByText("Te llevamos al siguiente paso…")).toBeInTheDocument();
    await waitFor(() => expect(location?.getHref()).toBe("/checkout?plan=pro"));
  });
});
