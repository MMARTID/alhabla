import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  IdiomasDelProfesional,
  NOTA_DE_IDIOMAS,
  alternarIdioma,
  idiomasEnPalabras,
} from "@/components/idiomas-del-profesional";

// Como los manda GET /booking-settings (idiomasDelEquipo): el orden del
// catálogo de la recepcionista, sin el castellano.
const OPCIONES = [
  { codigo: "en-GB", etiqueta: "Inglés" },
  { codigo: "fr-FR", etiqueta: "Francés" },
  { codigo: "ca-ES", etiqueta: "Catalán" },
  { codigo: "it-IT", etiqueta: "Italiano" },
];

describe("idiomas del profesional", () => {
  it("una casilla por idioma, con los marcados ya marcados y la nota del castellano", () => {
    render(
      <IdiomasDelProfesional opciones={OPCIONES} value={["ca-ES"]} onChange={vi.fn()} idPrefix="p" />
    );

    const grupo = screen.getByRole("group", { name: "Idiomas que habla además del castellano" });
    expect(within(grupo).getAllByRole("checkbox")).toHaveLength(4);
    expect(within(grupo).getByRole("checkbox", { name: "Catalán" })).toBeChecked();
    expect(within(grupo).getByRole("checkbox", { name: "Inglés" })).not.toBeChecked();
    expect(screen.getByText(NOTA_DE_IDIOMAS)).toBeInTheDocument();
  });

  it("al marcar uno emite la lista completa en el orden del catálogo", async () => {
    const onChange = vi.fn();
    render(
      <IdiomasDelProfesional opciones={OPCIONES} value={["ca-ES"]} onChange={onChange} idPrefix="p" />
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Inglés" }));

    expect(onChange).toHaveBeenCalledWith(["en-GB", "ca-ES"]);
  });

  it("al desmarcar el único queda vacío (solo castellano)", async () => {
    const onChange = vi.fn();
    render(
      <IdiomasDelProfesional opciones={OPCIONES} value={["ca-ES"]} onChange={onChange} idPrefix="p" />
    );

    await userEvent.click(screen.getByRole("checkbox", { name: "Catalán" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("sin opciones (un backend anterior) no pinta nada", () => {
    const { container } = render(
      <IdiomasDelProfesional opciones={[]} value={[]} onChange={vi.fn()} idPrefix="p" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("alternarIdioma descarta repetidos y lo que ya no está en el catálogo", () => {
    expect(alternarIdioma(["ca-ES", "xx-XX", "ca-ES"], "en-GB", OPCIONES)).toEqual(["en-GB", "ca-ES"]);
  });

  it("idiomasEnPalabras los dice en minúscula y con «e» delante de un sonido de i", () => {
    expect(idiomasEnPalabras([], OPCIONES)).toBe("");
    expect(idiomasEnPalabras(["ca-ES"], OPCIONES)).toBe("catalán");
    expect(idiomasEnPalabras(["ca-ES", "en-GB"], OPCIONES)).toBe("inglés y catalán");
    expect(idiomasEnPalabras(["it-IT", "ca-ES"], OPCIONES)).toBe("catalán e italiano");
    expect(idiomasEnPalabras(["en-GB", "fr-FR", "ca-ES"], OPCIONES)).toBe("inglés, francés y catalán");
  });
});
