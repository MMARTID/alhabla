import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  CalculadoraCompacta,
  lineaDelPlan,
} from "@/components/herramientas/calculadora-compacta";
import {
  calcular,
  estadoInicial,
} from "@/components/herramientas/calculo-de-llamadas-perdidas";
import { peluqueriaCanina } from "@/lib/sectores/peluqueria-canina";

/** Intl pone espacios duros antes del «€»: se comparan como espacios. */
const texto = (el: HTMLElement) =>
  el.textContent?.replace(/\s+/g, " ").trim() ?? "";

function botonProbar() {
  return screen.getByRole("link", { name: /Probar 7 días gratis/ });
}

describe("CalculadoraCompacta en la portada", () => {
  it("parte de peluquería con la cuenta de la completa y propone Inicio", () => {
    render(<CalculadoraCompacta />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "¿Cuánto me cuestan las llamadas que no cojo?"
    );
    // 10 llamadas × 52/12 × 60 % × 30 % × 45 € ≈ 351 €
    expect(texto(document.querySelector('[aria-live="polite"]')!)).toBe(
      "Con estos números, unos 351 € al mes en citas que acaban en otro sitio."
    );
    expect(
      screen.getByText(
        /Inicio cuesta 59 € \+ IVA al mes: se paga con 2 de esas citas\./
      )
    ).toBeInTheDocument();
    expect(botonProbar()).toHaveAttribute("href", "/planes?plan=inicio");
    expect(botonProbar()).toHaveAttribute("data-evento", "clic_probar");
    expect(botonProbar()).toHaveAttribute(
      "data-ubicacion",
      "portada_calculadora"
    );
  });

  it("«¿Cuántos sois?» cambia el plan a uno donde caben", () => {
    render(<CalculadoraCompacta />);
    fireEvent.click(screen.getByRole("radio", { name: "De 4 a 10" }));
    expect(botonProbar()).toHaveAttribute("href", "/planes?plan=pro");
    fireEvent.click(screen.getByRole("radio", { name: "Más de 10" }));
    expect(botonProbar()).toHaveAttribute("href", "/planes?plan=scale");
  });

  it("el oficio cambia el precio de partida", () => {
    render(<CalculadoraCompacta />);
    fireEvent.change(screen.getByLabelText("Tu oficio"), {
      target: { value: "estetica" },
    });
    expect(
      screen.getByRole("slider", { name: "Precio medio de una cita" })
    ).toHaveValue("80");
    expect(
      screen.getByText(/se paga con una sola de esas citas/)
    ).toBeInTheDocument();
  });

  it("sin llamadas pide los números y no promete citas que no hay", () => {
    render(<CalculadoraCompacta />);
    fireEvent.change(
      screen.getByRole("slider", { name: "Llamadas que no coges a la semana" }),
      { target: { value: "0" } }
    );
    expect(
      screen.getByText("Pon cuántas llamadas no coges para ver la cuenta.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/de esas citas/)).not.toBeInTheDocument();
    expect(screen.getByText(/lo que cobras por 2 citas/)).toBeInTheDocument();
  });

  it("enseña los supuestos y abre la completa con los mismos números", () => {
    render(<CalculadoraCompacta />);
    expect(screen.getByText("De dónde sale la cuenta")).toBeInTheDocument();
    expect(
      screen.getByText(/el 60 % de las llamadas que no coges/)
    ).toBeInTheDocument();
    const completa = screen.getByRole("link", {
      name: /Ajusta los supuestos en la calculadora completa/,
    });
    const url = new URL(completa.getAttribute("href")!, "https://alhabla.ai");
    expect(url.pathname).toBe("/herramientas/calculadora-de-llamadas-perdidas");
    expect(url.searchParams.get("sector")).toBe("peluqueria");
    expect(url.searchParams.get("llamadas")).toBe("10");
    expect(url.searchParams.get("ticket")).toBe("45");
  });
});

describe("CalculadoraCompacta en una landing de sector", () => {
  it("lleva el oficio fijo, su precio y el nicho en el botón", () => {
    render(<CalculadoraCompacta sector={peluqueriaCanina} />);
    expect(screen.queryByLabelText("Tu oficio")).not.toBeInTheDocument();
    expect(
      screen.getByText(/orientativo para peluquerías caninas/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Precio medio de una cita" })
    ).toHaveValue("40");
    expect(botonProbar()).toHaveAttribute(
      "href",
      "/planes?plan=inicio&niche=peluqueria-canina"
    );
    expect(botonProbar()).toHaveAttribute(
      "data-ubicacion",
      "sector_calculadora"
    );
    const completa = screen.getByRole("link", {
      name: /Ajusta los supuestos en la calculadora completa/,
    });
    expect(completa.getAttribute("href")).toContain("sector=canina");
  });
});

describe("lineaDelPlan", () => {
  it("suma los minutos extra cuando el plan se queda corto", () => {
    const r = calcular({ ...estadoInicial("peluqueria"), llamadas: "60" });
    expect(lineaDelPlan(r).replace(/\s/g, " ")).toBe(
      "Pro cuesta 139 € + IVA al mes y 45 € en minutos extra: se paga con 5 de esas citas."
    );
  });
});
