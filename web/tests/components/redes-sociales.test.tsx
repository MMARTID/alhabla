import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "@/components/site-footer";
import { REDES } from "@/lib/redes";
import { organizationStructuredData } from "@/lib/seo";

describe("perfiles de Alhabla en redes", () => {
  it("el pie enlaza a los cuatro perfiles, en otra pestaña y con nombre accesible", () => {
    render(<SiteFooter />);
    const redes = screen.getByRole("navigation", {
      name: "Alhabla en redes sociales",
    });
    const enlaces = within(redes).getAllByRole("link");
    expect(enlaces.map((enlace) => enlace.getAttribute("href"))).toEqual(
      REDES.map(({ url }) => url)
    );
    for (const enlace of enlaces) {
      expect(enlace).toHaveAttribute("target", "_blank");
      expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
      expect(enlace.getAttribute("aria-label")).toMatch(/^Alhabla en /);
      // Tamaño fijo aunque no cargue el CSS.
      const icono = enlace.querySelector("svg");
      expect(icono).toHaveAttribute("width", "18");
      expect(icono).toHaveAttribute("height", "18");
    }
  });

  it("las URL son canónicas: sin parámetros de los botones de compartir", () => {
    for (const { url } of REDES) {
      const direccion = new URL(url);
      expect(direccion.protocol).toBe("https:");
      // Facebook sin nombre de usuario: el identificador es la URL fija.
      const permitidos = direccion.pathname === "/profile.php" ? ["id"] : [];
      expect([...direccion.searchParams.keys()]).toEqual(permitidos);
    }
  });

  it("la organización del grafo los declara en sameAs", () => {
    expect(organizationStructuredData().sameAs).toEqual(
      REDES.map(({ url }) => url)
    );
  });
});
