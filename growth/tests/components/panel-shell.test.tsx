import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FranjaDemo } from "@/components/franja-demo";
import { PanelShell } from "@/components/panel-shell";
import { guardarCredencial, obtenerEstadoDeSesion } from "@/lib/sesion";
import { clienteFalso } from "../helpers/cliente-falso";
import { instalarGoogleFalso } from "../helpers/google-falso";
import { crearJwt } from "../helpers/jwt";
import { renderConCliente } from "../helpers/render";
import { reiniciarTodo } from "../helpers/reiniciar";

let ruta = "/bandeja";
vi.mock("next/navigation", () => ({
  usePathname: () => ruta,
}));

const DESTINOS = [
  ["Bandeja", "/bandeja"],
  ["Borradores", "/borradores"],
  ["Historial", "/historial"],
  ["Conocimiento", "/conocimiento"],
  ["Competencia", "/competencia"],
  ["Ejecuciones", "/ejecuciones"],
  ["Ajustes", "/ajustes"],
] as const;

function montar() {
  guardarCredencial(crearJwt({ email: "admin@alhabla.ai" }));
  return renderConCliente(
    <PanelShell>
      <h1>Contenido</h1>
    </PanelShell>,
    clienteFalso({ yo: async () => ({ email: "admin@alhabla.ai" }) })
  );
}

beforeEach(() => {
  ruta = "/bandeja";
  reiniciarTodo();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PanelShell", () => {
  it("la barra lateral enlaza a las siete vistas y marca la actual", async () => {
    ruta = "/historial";
    montar();
    const [lateral] = screen.getAllByRole("navigation", { name: "Principal" });
    for (const [nombre, href] of DESTINOS) {
      expect(
        within(lateral).getByRole("link", { name: nombre })
      ).toHaveAttribute("href", href);
    }
    expect(
      within(lateral).getByRole("link", { name: "Historial" })
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(lateral).getByRole("link", { name: "Bandeja" })
    ).not.toHaveAttribute("aria-current");
  });

  it("la Revisión de una oportunidad cuelga de la Bandeja", () => {
    ruta = "/oportunidad/abc123";
    montar();
    const [lateral] = screen.getAllByRole("navigation", { name: "Principal" });
    expect(
      within(lateral).getByRole("link", { name: "Bandeja" })
    ).toHaveAttribute("aria-current", "page");
  });

  it("enseña el correo de la sesión y el contenido, con un enlace para saltar a él", async () => {
    montar();
    expect(await screen.findAllByText("admin@alhabla.ai")).not.toHaveLength(0);
    expect(
      screen.getByRole("heading", { name: "Contenido" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Saltar al contenido" })
    ).toHaveAttribute("href", "#contenido");
    expect(document.getElementById("contenido")).toContainElement(
      screen.getByRole("heading", { name: "Contenido" })
    );
  });

  it("la barra inferior del móvil tiene cuatro pestañas y «Más»", () => {
    montar();
    const barra = screen.getAllByRole("navigation", { name: "Principal" })[1];
    expect(
      within(barra)
        .getAllByRole("link")
        .map((l) => l.textContent)
    ).toEqual(["Bandeja", "Borradores", "Historial", "Conocimiento"]);
    expect(within(barra).getByRole("button", { name: "Más" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("«Más» abre Competencia, Ejecuciones, Ajustes, la apariencia y cerrar sesión; Escape lo cierra", async () => {
    const user = userEvent.setup();
    montar();
    const mas = screen.getByRole("button", { name: "Más" });
    await user.click(mas);

    expect(mas).toHaveAttribute("aria-expanded", "true");
    const menu = document.getElementById("menu-mas")!;
    expect(
      within(menu).getByRole("link", { name: "Competencia" })
    ).toHaveAttribute("href", "/competencia");
    expect(
      within(menu).getByRole("link", { name: "Ejecuciones" })
    ).toHaveAttribute("href", "/ejecuciones");
    expect(within(menu).getByRole("link", { name: "Ajustes" })).toHaveAttribute(
      "href",
      "/ajustes"
    );
    expect(
      within(menu).getByRole("radiogroup", { name: "Apariencia" })
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole("button", { name: "Cerrar sesión" })
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(document.getElementById("menu-mas")).toBeNull();
    expect(mas).toHaveAttribute("aria-expanded", "false");
  });

  it("«Más» se cierra al tocar fuera y al cambiar de ruta", async () => {
    const user = userEvent.setup();
    const { rerender } = montar();
    await user.click(screen.getByRole("button", { name: "Más" }));
    expect(document.getElementById("menu-mas")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Cerrar el menú" }));
    expect(document.getElementById("menu-mas")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Más" }));
    ruta = "/ajustes";
    rerender(<div />);
    expect(document.getElementById("menu-mas")).toBeNull();
  });

  it("en «Más», la pestaña queda marcada cuando estás en Ejecuciones o Ajustes", () => {
    ruta = "/ajustes";
    montar();
    const barra = screen.getAllByRole("navigation", { name: "Principal" })[1];
    expect(
      within(barra).getByRole("button", { name: "Más" }).className
    ).toContain("text-morado-tinta");
  });

  it("la ficha de un competidor cuelga de Competencia, que en el móvil vive en «Más»", () => {
    ruta = "/competencia/demo-co-3";
    montar();
    const [lateral, barra] = screen.getAllByRole("navigation", {
      name: "Principal",
    });
    expect(
      within(lateral).getByRole("link", { name: "Competencia" })
    ).toHaveAttribute("aria-current", "page");
    // No es una de las cuatro pestañas: la marca «Más».
    expect(
      within(barra)
        .getAllByRole("link")
        .map((l) => l.textContent)
    ).not.toContain("Competencia");
    expect(
      within(barra).getByRole("button", { name: "Más" }).className
    ).toContain("text-morado-tinta");
  });

  it("cerrar sesión borra la sesión, vacía la caché y le dice a Google que no entre solo", async () => {
    const google = instalarGoogleFalso();
    const user = userEvent.setup();
    const { queryClient } = montar();
    await screen.findAllByText("admin@alhabla.ai");
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    await user.click(
      screen.getAllByRole("button", { name: "Cerrar sesión" })[0]
    );

    expect(obtenerEstadoDeSesion().estado).toBe("sin_sesion");
    expect(google.id.disableAutoSelect).toHaveBeenCalled();
    // Nada del panel queda en la caché para la siguiente cuenta (solo puede
    // quedar una consulta vacía, la del correo, que este shell sigue pintando).
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .filter((q) => q.state.data !== undefined)
    ).toHaveLength(0);
  });

  it("en la demostración no hay «Cerrar sesión»", () => {
    vi.stubEnv("NEXT_PUBLIC_GROWTH_DEMO", "1");
    montar();
    expect(
      screen.queryByRole("button", { name: "Cerrar sesión" })
    ).not.toBeInTheDocument();
  });
});

describe("FranjaDemo", () => {
  it("solo se pinta con la demostración activa", () => {
    const { container, rerender } = renderConCliente(
      <FranjaDemo />,
      clienteFalso()
    );
    expect(container).toBeEmptyDOMElement();

    vi.stubEnv("NEXT_PUBLIC_GROWTH_DEMO", "1");
    rerender(<FranjaDemo />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "DEMOSTRACIÓN · datos de prueba"
    );
  });

  it("en producción no se pinta aunque la variable exista", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GROWTH_DEMO", "1");
    const { container } = renderConCliente(<FranjaDemo />, clienteFalso());
    expect(container).toBeEmptyDOMElement();
  });
});
