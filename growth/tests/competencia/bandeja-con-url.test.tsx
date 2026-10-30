import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BandejaConUrl } from "@/components/bandeja/bandeja-con-url";
import { clienteFalso } from "../helpers/cliente-falso";
import { lista, oportunidad, resumenDeSemana } from "../helpers/d1-datos";
import { competidor } from "../helpers/d2-datos";
import { renderConCliente } from "../helpers/render";

/** Lo que devuelve `useSearchParams`: `null` es «fuera del router». */
const parametros = vi.hoisted(() => ({
  actual: null as URLSearchParams | null,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => parametros.actual,
}));

beforeEach(() => {
  window.sessionStorage.clear();
  parametros.actual = null;
});

function montar() {
  const cliente = clienteFalso({
    resumen: async () => resumenDeSemana(),
    listarOportunidades: async () => lista([oportunidad()]),
    competidores: async () => ({
      data: [competidor({ nombre: "HeyDiga", dominio: "heydiga.example" })],
    }),
  });
  const vista = renderConCliente(<BandejaConUrl />, cliente);
  return { cliente, ...vista };
}

describe("BandejaConUrl", () => {
  it("con ?menciona=<dominio> abre la Bandeja filtrada por ese competidor", async () => {
    parametros.actual = new URLSearchParams("menciona=heydiga.example");
    const { cliente } = montar();
    await screen.findByRole("link", { name: /Recepcionistas de IA/ });
    expect(cliente.listarOportunidades.mock.calls[0][0]).toMatchObject({
      menciona: "heydiga.example",
    });
    expect(await screen.findByLabelText("Menciona a")).toHaveValue(
      "heydiga.example"
    );
  });

  it("sin parámetro, o fuera del router, abre como siempre", async () => {
    parametros.actual = new URLSearchParams("");
    const { cliente, unmount } = montar();
    await screen.findByRole("link", { name: /Recepcionistas de IA/ });
    expect(cliente.listarOportunidades.mock.calls[0][0]).not.toHaveProperty(
      "menciona"
    );
    unmount();

    parametros.actual = null;
    const otro = montar();
    await screen.findByRole("link", { name: /Recepcionistas de IA/ });
    expect(
      otro.cliente.listarOportunidades.mock.calls[0][0]
    ).not.toHaveProperty("menciona");
  });
});
