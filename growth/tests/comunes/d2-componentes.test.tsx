import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { D2Chips } from "@/components/comunes/d2-chips";
import { D2DialogoDeConfirmacion } from "@/components/comunes/d2-dialogo-de-confirmacion";
import { D2Interruptor } from "@/components/comunes/d2-interruptor";
import { D2Pestanas } from "@/components/comunes/d2-pestanas";

describe("D2Pestanas", () => {
  function Ejemplo() {
    const [valor, setValor] = useState<"a" | "b" | "c">("a");
    return (
      <D2Pestanas
        etiqueta="Secciones"
        idBase="x"
        valor={valor}
        alCambiar={setValor}
        opciones={[
          { valor: "a", etiqueta: "Primera" },
          { valor: "b", etiqueta: "Segunda", cuenta: 7 },
          { valor: "c", etiqueta: "Tercera" },
        ]}
      />
    );
  }

  it("se maneja con flechas, Inicio y Fin, y da el foco a la elegida", async () => {
    const usuario = userEvent.setup();
    render(<Ejemplo />);
    const [a, b, c] = screen.getAllByRole("tab");

    a.focus();
    await usuario.keyboard("{ArrowRight}");
    expect(b).toHaveAttribute("aria-selected", "true");
    expect(b).toHaveFocus();

    await usuario.keyboard("{End}");
    expect(c).toHaveAttribute("aria-selected", "true");
    // Da la vuelta por el final.
    await usuario.keyboard("{ArrowRight}");
    expect(a).toHaveAttribute("aria-selected", "true");
    await usuario.keyboard("{ArrowLeft}");
    expect(c).toHaveAttribute("aria-selected", "true");
    await usuario.keyboard("{Home}");
    expect(a).toHaveAttribute("aria-selected", "true");
  });

  it("enseña la cuenta y mide 44 px de alto", () => {
    render(<Ejemplo />);
    expect(screen.getByRole("tab", { name: /Segunda/ })).toHaveTextContent(
      "Segunda7"
    );
    for (const pestana of screen.getAllByRole("tab")) {
      expect(pestana.className).toContain("h-11");
    }
  });
});

describe("D2Chips", () => {
  it("marca la opción activa con aria-pressed y avisa de la elegida", async () => {
    const alCambiar = vi.fn();
    const usuario = userEvent.setup();
    render(
      <D2Chips
        etiqueta="Tipo"
        valor={null}
        alCambiar={alCambiar}
        opciones={[
          { valor: null, etiqueta: "Todo", cuenta: 9 },
          { valor: "x", etiqueta: "Equis", cuenta: 4 },
        ]}
      />
    );
    expect(screen.getByRole("button", { name: /Todo/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await usuario.click(screen.getByRole("button", { name: /Equis/ }));
    expect(alCambiar).toHaveBeenCalledWith("x");
  });
});

describe("D2Interruptor", () => {
  it("es un switch controlado: no cambia solo, avisa de lo que se pide", async () => {
    const alCambiar = vi.fn();
    const usuario = userEvent.setup();
    render(
      <D2Interruptor activo={false} alCambiar={alCambiar} etiqueta="Pausar" />
    );
    const interruptor = screen.getByRole("switch", { name: "Pausar" });
    expect(interruptor).toHaveAttribute("aria-checked", "false");

    await usuario.click(interruptor);
    expect(alCambiar).toHaveBeenCalledWith(true);
    // Sigue como estaba hasta que el padre lo cambie.
    expect(interruptor).toHaveAttribute("aria-checked", "false");
  });

  it("deshabilitado no responde", async () => {
    const alCambiar = vi.fn();
    const usuario = userEvent.setup();
    render(
      <D2Interruptor
        activo
        deshabilitado
        alCambiar={alCambiar}
        etiqueta="Pausar"
      />
    );
    await usuario.click(screen.getByRole("switch"));
    expect(alCambiar).not.toHaveBeenCalled();
  });
});

describe("D2DialogoDeConfirmacion", () => {
  function Ejemplo(props: {
    alConfirmar?: () => void;
    alCancelar?: () => void;
    guardando?: boolean;
    error?: string | null;
  }) {
    const [abierto, setAbierto] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setAbierto(true)}>
          Abrir
        </button>
        <D2DialogoDeConfirmacion
          abierto={abierto}
          titulo="¿Seguro?"
          etiquetaDeConfirmar="Sí, hazlo"
          guardando={props.guardando}
          error={props.error}
          alConfirmar={props.alConfirmar ?? (() => {})}
          alCancelar={() => {
            props.alCancelar?.();
            setAbierto(false);
          }}
        >
          <p>Esto cambia cosas.</p>
        </D2DialogoDeConfirmacion>
      </>
    );
  }

  it("no existe hasta que se abre, y se abre como diálogo modal con nombre y descripción", async () => {
    const usuario = userEvent.setup();
    render(<Ejemplo />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Abrir" }));
    const dialogo = screen.getByRole("alertdialog", { name: "¿Seguro?" });
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveAccessibleDescription(/Esto cambia cosas/);
  });

  it("el foco entra en «Cancelar» (la opción segura) y vuelve al botón que lo abrió", async () => {
    const usuario = userEvent.setup();
    render(<Ejemplo />);
    const abrir = screen.getByRole("button", { name: "Abrir" });
    await usuario.click(abrir);
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();

    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(abrir).toHaveFocus();
  });

  it("Escape cancela y confirmar solo avisa; nada se confirma sin pulsar el botón", async () => {
    const alConfirmar = vi.fn();
    const alCancelar = vi.fn();
    const usuario = userEvent.setup();
    render(<Ejemplo alConfirmar={alConfirmar} alCancelar={alCancelar} />);

    await usuario.click(screen.getByRole("button", { name: "Abrir" }));
    await usuario.keyboard("{Escape}");
    expect(alCancelar).toHaveBeenCalledTimes(1);
    expect(alConfirmar).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole("button", { name: "Abrir" }));
    await usuario.click(screen.getByRole("button", { name: "Sí, hazlo" }));
    expect(alConfirmar).toHaveBeenCalledTimes(1);
  });

  it("Tab no se sale del diálogo: da la vuelta entre sus dos botones", async () => {
    const usuario = userEvent.setup();
    render(<Ejemplo />);
    await usuario.click(screen.getByRole("button", { name: "Abrir" }));

    const cancelar = screen.getByRole("button", { name: "Cancelar" });
    const confirmar = screen.getByRole("button", { name: "Sí, hazlo" });
    expect(cancelar).toHaveFocus();
    await usuario.tab();
    expect(confirmar).toHaveFocus();
    await usuario.tab();
    expect(cancelar).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(confirmar).toHaveFocus();
  });

  it("mientras guarda no se puede cancelar ni confirmar otra vez", async () => {
    const alConfirmar = vi.fn();
    const alCancelar = vi.fn();
    const usuario = userEvent.setup();
    render(
      <Ejemplo guardando alConfirmar={alConfirmar} alCancelar={alCancelar} />
    );
    await usuario.click(screen.getByRole("button", { name: "Abrir" }));

    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Sí, hazlo/ })).toBeDisabled();
    await usuario.keyboard("{Escape}");
    expect(alCancelar).not.toHaveBeenCalled();
  });

  it("al guardar, el foco no se escapa a la página de detrás", async () => {
    const usuario = userEvent.setup();
    const { rerender } = render(<Ejemplo />);
    await usuario.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();

    // Los dos botones se desactivan; el foco pasa al propio diálogo.
    rerender(<Ejemplo guardando />);
    expect(screen.getByRole("alertdialog")).toHaveFocus();
  });

  it("enseña por qué falló", async () => {
    const usuario = userEvent.setup();
    render(<Ejemplo error="No se pudo guardar." />);
    await usuario.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar.");
  });
});
