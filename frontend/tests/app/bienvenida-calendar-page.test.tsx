import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterBusinessCalendarPage from "@/app/bienvenida/calendar/page";
import { cambiarModoDeAgenda } from "@/lib/api";
import { BUSINESS_TYPE_ONBOARDING_TEXTS } from "@/lib/business-type";
import type { Business } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  cambiarModoDeAgenda: vi.fn(),
  getGoogleCalendarAuthUrl: vi.fn(),
  getMicrosoftCalendarAuthUrl: vi.fn(),
}));

const mockedCambiarModoDeAgenda = vi.mocked(cambiarModoDeAgenda);

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

  it("avisa, con el texto del sector, de que saltarse el paso deja la recepcionista sin reservar (auditoría 28-10, hallazgo 2)", async () => {
    location = mockLocation("?businessType=barberia");
    render(<RegisterBusinessCalendarPage />);

    const aviso = await screen.findByText(
      BUSINESS_TYPE_ONBOARDING_TEXTS.barberia.calendar.sinCalendario
    );
    expect(aviso).toHaveTextContent(/no reserva cortes ni barbas/);
    expect(aviso).toHaveTextContent(
      /conectar tu calendario o activar la agenda de Alhabla .* en Agente › Calendario/
    );
    expect(
      screen.getByRole("button", { name: "Configurar calendario después" })
    ).toHaveAccessibleDescription(
      BUSINESS_TYPE_ONBOARDING_TEXTS.barberia.calendar.sinCalendario
    );
  });

  it("todos los sectores dicen que saltarse el paso toma nota pero no reserva, y las dos salidas", () => {
    for (const textos of Object.values(BUSINESS_TYPE_ONBOARDING_TEXTS)) {
      expect(textos.calendar.sinCalendario).toMatch(
        /^Si lo dejas para después, tu recepcionista atiende y toma nota de lo que te piden, pero no reserva .+\. Puedes conectar tu calendario o activar la agenda de Alhabla cuando quieras en Agente › Calendario\.$/
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

  it("«Usar la agenda de Alhabla» activa ese modo y sigue al pago", async () => {
    const user = userEvent.setup();
    mockedCambiarModoDeAgenda.mockResolvedValue({} as Business);
    location = mockLocation("?businessType=peluqueria&plan=inicio");
    render(<RegisterBusinessCalendarPage />);

    await user.click(
      screen.getByRole("button", { name: /Usar la agenda de Alhabla/ })
    );

    expect(mockedCambiarModoDeAgenda).toHaveBeenCalledWith("alhabla");
    expect(
      await screen.findByText(
        "Agenda de Alhabla activada. Te llevamos al siguiente paso…"
      )
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(location?.getHref()).toBe("/checkout?plan=inicio")
    );
  });
});
