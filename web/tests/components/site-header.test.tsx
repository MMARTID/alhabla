import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/site-header";

describe("SiteHeader", () => {
  // Los importadores de marca (ElevenLabs y similares) buscan en la cabecera
  // una imagen descargable con «logo» y, si no la hallan, se quedan con la
  // imagen OG. Un data URI (el BrandMark de las demás páginas) lo descartan.
  it("lleva el logo como imagen con dirección propia, «logo» en el alt y en la clase", () => {
    render(<SiteHeader />);
    const logo = screen.getByRole("img", { name: "Alhabla logo" });
    expect(logo).toHaveAttribute("src", "/brand/alhabla-isotipo.svg");
    expect(logo).toHaveClass("logo");
    // Con medidas explícitas no mueve el diseño mientras carga.
    expect(logo).toHaveAttribute("width", "44");
    expect(logo).toHaveAttribute("height", "44");
  });

  it("sigue enseñando «Alhabla» junto al isotipo y enlaza a la portada", () => {
    render(<SiteHeader />);
    const inicio = screen.getByRole("link", { name: "Ir al inicio de Alhabla" });
    expect(inicio).toHaveAttribute("href", "/");
    expect(inicio).toHaveTextContent("Alhabla");
  });
});
