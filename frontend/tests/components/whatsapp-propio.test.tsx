import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AVISOS_ANTES_DE_CONECTAR,
  WhatsappPropio,
} from "@/components/whatsapp-propio";
import { getWhatsappPropio, registrarWhatsappPropio } from "@/lib/api";
import type { EstadoWhatsappPropio } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  getWhatsappPropio: vi.fn(),
  registrarWhatsappPropio: vi.fn(),
}));

const mockedGet = vi.mocked(getWhatsappPropio);
const mockedRegistrar = vi.mocked(registrarWhatsappPropio);

const ALTA = {
  appId: "2349496959195397",
  configId: "cfg_1",
  solutionId: "sol_1",
  graphVersion: "v21.0",
};

function estado(
  cambios: Partial<EstadoWhatsappPropio> = {}
): EstadoWhatsappPropio {
  return {
    disponible: true,
    motivo: null,
    alta: ALTA,
    conexion: null,
    ...cambios,
  };
}

function pintar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <WhatsappPropio hasToken />
    </QueryClientProvider>
  );
}

const login = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  window.FB = { init: vi.fn(), login };
});

afterEach(() => {
  cleanup();
  delete window.FB;
});

describe("WhatsappPropio", () => {
  it("no pinta nada si el alta no está disponible y no hay conexión", async () => {
    mockedGet.mockResolvedValue(
      estado({ disponible: false, motivo: "apagado", alta: null })
    );
    const { container } = pintar();
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("antes de conectar cuenta lo que va a pasar y abre el alta de Meta", async () => {
    mockedGet.mockResolvedValue(estado());
    pintar();
    expect(
      await screen.findByText(AVISOS_ANTES_DE_CONECTAR[1])
    ).toBeInTheDocument();
    const boton = screen.getByRole("button", { name: /Conectar mi WhatsApp/ });
    await waitFor(() => expect(boton).toBeEnabled());
    await userEvent.click(boton);
    expect(login).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        config_id: "cfg_1",
        extras: expect.objectContaining({
          setup: { solutionID: "sol_1" },
          featureType: "whatsapp_business_app_onboarding",
        }),
      })
    );
  });

  it("al recibir el fin del alta de Meta lo registra en el backend", async () => {
    mockedGet.mockResolvedValue(estado());
    mockedRegistrar.mockResolvedValue(
      estado({
        conexion: {
          estado: "registrando",
          phoneNumber: null,
          syncDeadline: null,
          errores: [],
          conectadoAt: null,
          puedeRepetir: false,
        },
      })
    );
    pintar();
    const boton = await screen.findByRole("button", {
      name: /Conectar mi WhatsApp/,
    });
    await waitFor(() => expect(boton).toBeEnabled());
    await userEvent.click(boton);
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: "https://www.facebook.com",
          data: JSON.stringify({
            type: "WA_EMBEDDED_SIGNUP",
            event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
            data: { waba_id: "123456", phone_number_id: "654321" },
          }),
        })
      );
    });
    await waitFor(() =>
      expect(mockedRegistrar).toHaveBeenCalledWith(
        { wabaId: "123456", phoneNumberId: "654321" },
        expect.anything()
      )
    );
    expect(
      await screen.findByText(/Estamos terminando la conexión con WhatsApp/)
    ).toBeInTheDocument();
  });

  it("conectado: enseña el número, que los mensajes siguen en Alhabla Reservas y cómo desconectar", async () => {
    mockedGet.mockResolvedValue(
      estado({
        conexion: {
          estado: "active",
          phoneNumber: "+34600111222",
          syncDeadline: null,
          errores: [],
          conectadoAt: "2026-11-06T12:00:00Z",
          puedeRepetir: false,
        },
      })
    );
    pintar();
    expect(await screen.findByText("Conectado")).toBeInTheDocument();
    expect(screen.getByText(/Alhabla Reservas/)).toBeInTheDocument();
    expect(screen.getByText(/Plataforma empresarial/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /conectar/i })
    ).not.toBeInTheDocument();
  });

  it("si la sincronización caducó, deja volver a conectar", async () => {
    mockedGet.mockResolvedValue(
      estado({
        conexion: {
          estado: "sync_deadline_expired",
          phoneNumber: "+34600111222",
          syncDeadline: null,
          errores: [],
          conectadoAt: null,
          puedeRepetir: true,
        },
      })
    );
    pintar();
    expect(await screen.findByText("Sin conectar")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Volver a conectar/ })
    ).toBeInTheDocument();
  });

  it("con el interruptor apagado sigue enseñando una conexión guardada, sin botón", async () => {
    mockedGet.mockResolvedValue(
      estado({
        disponible: false,
        motivo: "apagado",
        alta: null,
        conexion: {
          estado: "disconnected",
          phoneNumber: "+34600111222",
          syncDeadline: null,
          errores: [],
          conectadoAt: null,
          puedeRepetir: true,
        },
      })
    );
    pintar();
    expect(await screen.findByText("Sin conectar")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
