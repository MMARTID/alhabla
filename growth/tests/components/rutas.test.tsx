import { screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import Ajustes from "@/app/(panel)/ajustes/page";
import Bandeja from "@/app/(panel)/bandeja/page";
import Borradores from "@/app/(panel)/borradores/page";
import Competencia from "@/app/(panel)/competencia/page";
import Conocimiento from "@/app/(panel)/conocimiento/page";
import Ejecuciones from "@/app/(panel)/ejecuciones/page";
import Historial from "@/app/(panel)/historial/page";
import { VistaDeRevision } from "@/components/revision/vista-de-revision";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import { renderConCliente } from "../helpers/render";

/**
 * Cada ruta del panel pinta un `<h1>` con su nombre y datos reales del
 * cliente. Es el contrato mínimo que mantienen las vistas definitivas.
 */
const RUTAS: Array<[string, string, () => ReactElement]> = [
  ["/bandeja", "Bandeja", () => <Bandeja />],
  ["/borradores", "Borradores", () => <Borradores />],
  ["/historial", "Historial", () => <Historial />],
  ["/conocimiento", "Conocimiento", () => <Conocimiento />],
  ["/competencia", "Competencia", () => <Competencia />],
  ["/ejecuciones", "Ejecuciones", () => <Ejecuciones />],
  ["/ajustes", "Ajustes", () => <Ajustes />],
];

describe("las rutas del panel", () => {
  it.each(RUTAS)(
    "%s tiene su título y carga datos de verdad",
    async (_ruta, titulo, pagina) => {
      renderConCliente(pagina(), clienteDemo({ retardoMs: 0 }));
      expect(
        screen.getByRole("heading", { level: 1, name: titulo })
      ).toBeInTheDocument();
      // Pasa del esqueleto a los datos (o a un estado vacío honesto), sin error.
      await waitFor(() =>
        expect(screen.queryByRole("status")).not.toBeInTheDocument()
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
  );

  it("la Revisión carga la oportunidad que dice la URL", async () => {
    renderConCliente(
      <VistaDeRevision id="demo-op-05" />,
      clienteDemo({ retardoMs: 0 })
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Recepcionistas de IA en España: listado actualizado",
      })
    ).toBeInTheDocument();
    // Todo enlace al destino es seguro: https y nofollow.
    const enlaces = screen.getAllByRole("link", {
      name: /revista-pymes.example/,
    });
    expect(enlaces.length).toBeGreaterThan(0);
    for (const enlace of enlaces) {
      expect(enlace).toHaveAttribute(
        "rel",
        expect.stringContaining("nofollow")
      );
      expect(enlace.getAttribute("href")).toMatch(/^https:\/\//);
    }
  });

  it("una oportunidad que no existe se cuenta con el error del backend, no con una pantalla en blanco", async () => {
    renderConCliente(
      <VistaDeRevision id="no-existe" />,
      clienteDemo({ retardoMs: 0 })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La oportunidad no existe."
    );
  });

  it("la Bandeja lista las oportunidades por puntuación", async () => {
    renderConCliente(<Bandeja />, clienteDemo({ retardoMs: 0 }));
    const enlaces = await screen.findAllByRole("link", { name: /\/100/ });
    expect(enlaces[0]).toHaveTextContent(
      "Recepcionistas de IA en España: listado actualizado"
    );
    expect(enlaces[0]).toHaveAttribute("href", "/oportunidad/demo-op-05");
  });

  it("la Bandeja con ?vacio=1 dice la verdad", async () => {
    renderConCliente(<Bandeja />, clienteDemo({ retardoMs: 0, vacio: true }));
    expect(
      await screen.findByText("Esta semana no hay nada que merezca tu tiempo")
    ).toBeInTheDocument();
  });
});
