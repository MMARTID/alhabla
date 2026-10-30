import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { useCliente } from "@/lib/cliente";
import { clienteHttp } from "@/lib/cliente-http";
import { crearCliente } from "@/lib/crear-cliente";
import { useEffect, useState } from "react";

function Sonda() {
  const cliente = useCliente();
  const [correo, setCorreo] = useState("…");
  useEffect(() => {
    // En la demostración `yo()` responde sin red; el HTTP no se llama aquí.
    if (cliente !== clienteHttp)
      void cliente.yo().then((r) => setCorreo(r.email));
  }, [cliente]);
  return (
    <p data-testid="sonda">
      {cliente === clienteHttp ? "http" : `demo:${correo}`}
    </p>
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("crearCliente", () => {
  it("sin demostración devuelve el cliente HTTP, de forma síncrona", () => {
    expect(crearCliente()).toBe(clienteHttp);
  });

  it("con la demostración (solo en desarrollo) devuelve una promesa del cliente de datos de prueba", async () => {
    vi.stubEnv("NEXT_PUBLIC_GROWTH_DEMO", "1");
    const resultado = crearCliente();
    expect(resultado).toBeInstanceOf(Promise);
    const cliente = await resultado;
    expect(cliente).not.toBe(clienteHttp);
    await expect(cliente.yo()).resolves.toEqual({ email: "demo@alhabla.ai" });
  });

  it("en producción, aunque la variable exista, devuelve el HTTP", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GROWTH_DEMO", "1");
    expect(crearCliente()).toBe(clienteHttp);
  });

  it("con otro valor que «1» no hay demostración", () => {
    vi.stubEnv("NEXT_PUBLIC_GROWTH_DEMO", "true");
    expect(crearCliente()).toBe(clienteHttp);
  });
});

describe("Providers", () => {
  it("pinta de inmediato con el cliente HTTP", () => {
    render(
      <Providers>
        <Sonda />
      </Providers>
    );
    expect(screen.getByTestId("sonda")).toHaveTextContent("http");
  });

  it("con la demostración espera a que cargue el cliente de datos de prueba", async () => {
    vi.stubEnv("NEXT_PUBLIC_GROWTH_DEMO", "1");
    render(
      <Providers>
        <Sonda />
      </Providers>
    );
    await waitFor(() =>
      expect(screen.getByTestId("sonda")).toHaveTextContent(
        "demo:demo@alhabla.ai"
      )
    );
  });
});
