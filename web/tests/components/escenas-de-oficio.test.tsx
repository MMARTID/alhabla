import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { EscenasDeOficio } from "@/components/escenas-de-oficio";
import { ESCENAS_DE_OFICIO } from "@/lib/escenas-de-oficio";

describe("EscenasDeOficio", () => {
  it("pinta las ocho escenas resueltas, cada una con su enlace a la landing", () => {
    render(<EscenasDeOficio />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Elige tu oficio y mira la llamada que entra.",
      })
    ).toBeInTheDocument();
    const tarjetas = screen.getAllByRole("listitem");
    expect(tarjetas).toHaveLength(8);
    tarjetas.forEach((tarjeta, i) => {
      const escena = ESCENAS_DE_OFICIO[i];
      const t = within(tarjeta);
      expect(t.getByRole("heading", { level: 3 })).toHaveTextContent(
        escena.oficio
      );
      expect(t.getByText(escena.llamada.dice)).toBeInTheDocument();
      expect(t.getByText(escena.cita.servicio)).toBeInTheDocument();
      // El detalle va en el DOM aunque el cajón esté cerrado.
      expect(t.getByText(escena.detalle)).toBeInTheDocument();
      // Sin JavaScript de por medio (el servidor), la escena sale resuelta.
      expect(tarjeta).not.toHaveAttribute("data-fase");
      expect(t.getByRole("link", { name: escena.enlace })).toHaveAttribute(
        "href",
        `/${escena.slug}`
      );
    });
  });

  it("un toque abre el cajón y otro lo cierra, una tarjeta a la vez", () => {
    render(<EscenasDeOficio />);
    const [primera, segunda] = screen.getAllByRole("listitem");
    const botonPrimera = within(primera).getByRole("button", {
      name: "Más sobre peluquerías",
    });
    const botonSegunda = within(segunda).getByRole("button", {
      name: "Más sobre barberías",
    });

    fireEvent.click(botonPrimera);
    expect(primera).toHaveAttribute("data-abierta", "true");
    expect(botonPrimera).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(botonSegunda);
    expect(primera).not.toHaveAttribute("data-abierta");
    expect(segunda).toHaveAttribute("data-abierta", "true");

    fireEvent.click(botonSegunda);
    expect(segunda).not.toHaveAttribute("data-abierta");
    expect(botonSegunda).toHaveAttribute("aria-expanded", "false");
  });
});
