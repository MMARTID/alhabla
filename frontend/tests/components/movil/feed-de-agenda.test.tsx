import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeedDeAgenda } from "@/components/movil/agente/feed-de-agenda";
import { activarFeedDeAgenda, desactivarFeedDeAgenda, getFeedDeAgenda } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  getFeedDeAgenda: vi.fn(),
  activarFeedDeAgenda: vi.fn(),
  desactivarFeedDeAgenda: vi.fn(),
}));
const mockedGet = vi.mocked(getFeedDeAgenda);
const mockedActivar = vi.mocked(activarFeedDeAgenda);
const mockedDesactivar = vi.mocked(desactivarFeedDeAgenda);

const URL = "https://api.alhabla.ai/agenda/" + "a".repeat(64) + ".ics";
const ACTIVO = { activo: true, url: URL, webcal: URL.replace("https://", "webcal://") };
const INACTIVO = { activo: false, url: null, webcal: null };

function montar() {
  const avisar = vi.fn();
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={cliente}>
      <FeedDeAgenda avisar={avisar} />
    </QueryClientProvider>
  );
  return { avisar };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FeedDeAgenda (PLAN-AGENDA-ALHABLA.md, fase 3)", () => {
  it("sin enlace ofrece activarlo y, al activarlo, enseña el enlace y el botón del iPhone", async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue(INACTIVO);
    mockedActivar.mockResolvedValue(ACTIVO);
    const { avisar } = montar();

    await user.click(await screen.findByRole("button", { name: "Activar el enlace" }));

    await waitFor(() => expect(screen.getByText(URL)).toBeInTheDocument());
    expect(mockedActivar).toHaveBeenCalledWith(false);
    expect(avisar).toHaveBeenCalledWith("Enlace activado.");
    expect(screen.getByRole("link", { name: /Añadir al iPhone/ })).toHaveAttribute("href", ACTIVO.webcal);
    expect(screen.getByText(/Trata el enlace como una contraseña/)).toBeInTheDocument();
  });

  it("cambiar el enlace pide confirmación y renueva; desactivar lo quita", async () => {
    const user = userEvent.setup();
    mockedGet.mockResolvedValue(ACTIVO);
    mockedActivar.mockResolvedValue({ ...ACTIVO, url: URL.replace(/a{64}/, "b".repeat(64)) });
    mockedDesactivar.mockResolvedValue(INACTIVO);
    montar();

    await user.click(await screen.findByRole("button", { name: "Cambiar enlace" }));
    expect(mockedActivar).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sí, cambiar el enlace" }));
    await waitFor(() => expect(mockedActivar).toHaveBeenCalledWith(true));
    await waitFor(() => expect(screen.getByText(/b{64}/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(mockedDesactivar).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Activar el enlace" })).toBeInTheDocument();
  });
});
