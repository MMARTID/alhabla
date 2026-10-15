import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FranjaDev } from "@/components/franja-dev";

const VARIABLES = [
  "NEXT_PUBLIC_DEV_RAMA",
  "NEXT_PUBLIC_DEV_COMMIT",
  "NEXT_PUBLIC_DEV_PANEL_URL",
] as const;

afterEach(() => {
  for (const variable of VARIABLES) delete process.env[variable];
});

describe("FranjaDev", () => {
  it("no pinta nada fuera del entorno de desarrollo fijo (producción, vistas previas)", () => {
    const { container } = render(<FranjaDev />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dice qué rama y commit enseña la app y lleva al panel", () => {
    process.env.NEXT_PUBLIC_DEV_RAMA = "feat/aviso-ia";
    process.env.NEXT_PUBLIC_DEV_COMMIT = "00ea566";
    render(<FranjaDev />);
    const enlace = screen.getByRole("link", { name: /DEV/ });
    expect(enlace).toHaveTextContent("DEV");
    expect(enlace).toHaveTextContent("feat/aviso-ia · 00ea566");
    expect(enlace).toHaveAttribute("href", "http://localhost:3005");
    expect(enlace).toHaveAttribute("target", "_blank");
  });
});
