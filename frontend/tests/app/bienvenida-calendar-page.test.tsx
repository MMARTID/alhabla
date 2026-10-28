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
    window.localStorage.clear();
    window.localStorage.setItem("alhabla_token", "token");
  });

  afterEach(() => {
    location?.restore();
    location = undefined;
  });

  it("avisa, con el texto del sector, de que sin calendario no se reservan citas (auditoría 28-10, hallazgo 2)", async () => {
    location = mockLocation("?businessType=barberia");
    render(<RegisterBusinessCalendarPage />);

    const aviso = await screen.findByText(
      BUSINESS_TYPE_ONBOARDING_TEXTS.barberia.calendar.sinCalendario
    );
    expect(aviso).toHaveTextContent(/no reserva cortes ni barbas/);
    expect(aviso).toHaveTextContent(/Agente › Calendario/);
    expect(
      screen.getByRole("button", { name: "Configurar calendario después" })
    ).toHaveAccessibleDescription(
      BUSINESS_TYPE_ONBOARDING_TEXTS.barberia.calendar.sinCalendario
    );
  });

  it("todos los sectores dicen que sin calendario se atiende y se toma nota, pero no se reserva", () => {
    for (const textos of Object.values(BUSINESS_TYPE_ONBOARDING_TEXTS)) {
      expect(textos.calendar.sinCalendario).toMatch(
        /^Sin calendario, tu recepcionista atiende las llamadas y toma nota .*, pero no reserva .+\. Puedes conectarlo cuando quieras desde la app, en Agente › Calendario\.$/
      );
    }
  });

  it("ofrece Apple / iCloud como tercera opción y abre el mismo formulario de Agente", async () => {
    const user = userEvent.setup();
    location = mockLocation("?businessType=peluqueria");
    render(<RegisterBusinessCalendarPage />);

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

    await user.click(screen.getByRole("button", { name: /Apple \/ iCloud/ }));
    await user.click(
      screen.getByRole("button", { name: "Elegir calendario de prueba" })
    );

    expect(
      screen.getByText("Calendario conectado. Te llevamos al siguiente paso…")
    ).toBeInTheDocument();
    await waitFor(() => expect(location?.getHref()).toBe("/checkout?plan=pro"));
  });
});
