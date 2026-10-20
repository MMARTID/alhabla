import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  CampoNumeroDeAlhabla,
  ConNumeroDeAlhabla,
  TablaDeCodigos,
  limpiarNumero,
} from "@/components/desvio/codigos-de-desvio";

function pintar() {
  render(
    <ConNumeroDeAlhabla>
      <CampoNumeroDeAlhabla />
      <TablaDeCodigos
        titulo="Móvil de prueba"
        filas={[
          {
            tipo: "Si no contestas",
            activar: "**61*{N}**{T}#",
            quitar: "##61#",
            segundos: { opciones: [5, 20], inicial: 20 },
          },
        ]}
      />
    </ConNumeroDeAlhabla>
  );
}

describe("limpiarNumero", () => {
  it("deja las 9 cifras y quita el prefijo de España", () => {
    expect(limpiarNumero("910 00 00 00")).toBe("910000000");
    expect(limpiarNumero("+34 910 000 000")).toBe("910000000");
    expect(limpiarNumero("0034910000000")).toBe("910000000");
  });
});

describe("TablaDeCodigos", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  it("sin número pinta «número» y no copia un código a medias", async () => {
    pintar();
    expect(screen.getByText("número")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /falta tu número/ }));
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Escribe primero tu número de Alhabla"
    );
    expect(screen.getByLabelText("Tu número de Alhabla")).toHaveFocus();
  });

  it("con el número escrito copia el código completo, con los segundos elegidos", async () => {
    pintar();
    fireEvent.change(screen.getByLabelText("Tu número de Alhabla"), {
      target: { value: "910 000 000" },
    });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "5" } });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Copiar **61*910000000**5#" })
      );
    });
    expect(writeText).toHaveBeenCalledWith("**61*910000000**5#");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Copiado: **61*910000000**5#"
    );
  });

  it("los códigos sin número se copian siempre", async () => {
    pintar();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copiar ##61#" }));
    });
    expect(writeText).toHaveBeenCalledWith("##61#");
  });

  it("avisa si el número no es español", () => {
    pintar();
    fireEvent.change(screen.getByLabelText("Tu número de Alhabla"), {
      target: { value: "12345" },
    });
    expect(
      screen.getByText(/9 cifras y empieza por 6, 7, 8 o 9/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tu número de Alhabla")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });
});
