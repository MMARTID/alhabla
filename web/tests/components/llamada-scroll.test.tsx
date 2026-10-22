import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { LlamadaScroll } from "@/components/llamada-scroll";
import { ALTO_BOLSILLO_VH } from "@/lib/transicion-bolsillo-negocio";

/**
 * «En tu bolsillo» acaba tumbando el teléfono y zambulléndolo en la cámara
 * para «En tu negocio», que la solapa: la sección mide lo que dice
 * `lib/transicion-bolsillo-negocio.ts`, y lo que se ve en el relevo es solo
 * el teléfono (la pantalla de bloqueo del portátil es de «En tu negocio»).
 */
describe("LlamadaScroll", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-relato");
  });

  it("pinta los tres pasos con el alto de la transición", () => {
    render(<LlamadaScroll />);

    const seccion = document.getElementById("como-funciona") as HTMLElement;
    expect(seccion.style.height).toBe(`${ALTO_BOLSILLO_VH}vh`);
    expect(
      screen.getByRole("heading", { level: 2, name: "En tu bolsillo" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Ir al paso/ })).toHaveLength(
      3
    );
  });

  it("no pinta la pantalla de bloqueo del portátil: en el relevo solo está el teléfono, que se apaga", () => {
    render(<LlamadaScroll />);

    const seccion = document.getElementById("como-funciona") as HTMLElement;
    // Hasta el 2026-10-22 llevaba una copia dentro de un rectángulo negro.
    expect(seccion.querySelector("[data-bloqueo]")).toBeNull();
    expect(seccion.textContent).not.toContain("Ver agenda de hoy");
    // El marco del teléfono y la capa que apaga su pantalla, para el negro.
    expect(
      seccion.querySelector('img[src="/telefono/frente.svg"]')
    ).not.toBeNull();
    expect(seccion.querySelector('[class*="apagada"]')).not.toBeNull();
  });
});
