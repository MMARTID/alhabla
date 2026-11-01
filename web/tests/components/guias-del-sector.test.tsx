import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { GuiasDelSector } from "@/components/sector/guias-del-sector";
import { GUIAS_POR_SECTOR } from "@/lib/blog-enlaces";
import { SECTORES } from "@/lib/sectores";

describe("GuiasDelSector", () => {
  it("pone en el HTML las tres guías del oficio, por orden, más el enlace al blog", () => {
    render(<GuiasDelSector sector={SECTORES.peluqueria} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Guías para peluquerías" })
    ).toBeInTheDocument();

    const lista = screen.getByRole("list");
    const hrefs = within(lista)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(
      GUIAS_POR_SECTOR.peluqueria.map((slug) => `/blog/${slug}`)
    );

    expect(screen.getByRole("link", { name: /Todo el blog/ })).toHaveAttribute(
      "href",
      "/blog"
    );
  });

  it("cada sector nombra a quien va dirigido y enlaza solo a artículos del blog", () => {
    for (const sector of Object.values(SECTORES)) {
      const { unmount } = render(<GuiasDelSector sector={sector} />);
      expect(
        screen.getByRole("heading", { level: 2 })
      ).toHaveTextContent(`Guías para ${sector.paraQuien}`);
      const enlaces = within(screen.getByRole("list")).getAllByRole("link");
      expect(enlaces, sector.slug).toHaveLength(3);
      for (const a of enlaces) {
        expect(a.getAttribute("href")).toMatch(/^\/blog\/[a-z0-9-]+$/);
      }
      unmount();
    }
  });
});
