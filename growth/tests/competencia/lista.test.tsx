import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { VistaDeCompetencia } from "@/components/competencia/vista-de-competencia";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import { clienteFalso } from "../helpers/cliente-falso";
import { detalleDeCompetidor } from "../helpers/competencia-datos";
import { competidor } from "../helpers/d2-datos";
import { renderConCliente } from "../helpers/render";

function montarDemo() {
  const cliente = clienteDemo({ retardoMs: 0 });
  renderConCliente(<VistaDeCompetencia />, cliente);
  return cliente;
}

/** La sección (`<section>`) de un grupo, por el título de su `<h2>` (que lleva la cuenta detrás). */
async function grupo(titulo: string): Promise<HTMLElement> {
  const h2 = await screen.findByRole("heading", {
    level: 2,
    name: new RegExp(`^${titulo}\\s*\\d*$`),
  });
  return h2.closest("section") as HTMLElement;
}

/** La tarjeta de un competidor, por el nombre que lleva en su `<h3>`. */
async function tarjeta(nombre: RegExp | string): Promise<HTMLElement> {
  const titulo = await screen.findByRole("heading", { level: 3, name: nombre });
  return titulo.closest("li") as HTMLElement;
}

describe("Competencia · la lista", () => {
  it("agrupa a los competidores por lo que piden de ti, en este orden", async () => {
    montarDemo();
    await grupo("Propuestos por el agente");
    const titulos = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent?.replace(/\s+\d+$/, ""));
    expect(titulos).toEqual([
      "Propuestos por el agente",
      "Por analizar",
      "Analizados · pendientes de revisión",
      "Revisados",
    ]);
    expect(screen.getByText("4 competidores")).toBeInTheDocument();
    // Cada uno, en su grupo.
    expect(
      within(await grupo("Propuestos por el agente")).getByText(
        "Atiende24 (ejemplo)"
      )
    ).toBeInTheDocument();
    expect(
      within(await grupo("Por analizar")).getByText(
        "Otra recepcionista (ejemplo)"
      )
    ).toBeInTheDocument();
    expect(
      within(await grupo("Analizados · pendientes de revisión")).getByText(
        "Recepción Express (ejemplo)"
      )
    ).toBeInTheDocument();
    expect(
      within(await grupo("Revisados")).getByText("Competidor ficticio")
    ).toBeInTheDocument();
  });

  it("cada tarjeta enseña nombre, dominio, origen, estado, oportunidades y menciones", async () => {
    montarDemo();
    const ficticio = await tarjeta("Competidor ficticio");
    expect(ficticio).toHaveTextContent("competidor-ficticio.example");
    expect(ficticio).toHaveTextContent("Revisado");
    expect(ficticio).toHaveTextContent("Del repositorio");
    expect(ficticio).toHaveTextContent("1 oportunidad");
    expect(ficticio).toHaveTextContent("3 menciones");

    const express = await tarjeta(/Recepción Express/);
    expect(express).toHaveTextContent("Pendiente de revisión");
    expect(express).toHaveTextContent("Añadido por ti");
    expect(express).toHaveTextContent("Análisis v2");
    expect(express).toHaveTextContent("9 datos");
  });

  it("el nombre lleva a su ficha y el número de menciones, a la Bandeja filtrada", async () => {
    montarDemo();
    const ficticio = await tarjeta("Competidor ficticio");
    expect(
      within(ficticio).getByRole("link", { name: "Competidor ficticio" })
    ).toHaveAttribute("href", "/competencia/demo-co-1");
    expect(
      within(ficticio).getByRole("link", { name: /3 menciones/ })
    ).toHaveAttribute("href", "/bandeja?menciona=competidor-ficticio.example");
  });

  it("sin menciones no hay enlace: lo dice como texto", async () => {
    montarDemo();
    const atiende = await tarjeta(/Atiende24/);
    expect(atiende).toHaveTextContent("Sin menciones");
    expect(
      within(atiende).queryByRole("link", { name: /mención/ })
    ).not.toBeInTheDocument();
  });

  it("«Análisis caducado» solo en el que tiene un análisis de más de 90 días", async () => {
    montarDemo();
    await grupo("Revisados");
    const caducados = screen.getAllByText("Análisis caducado");
    expect(caducados).toHaveLength(1);
    expect(caducados[0].closest("li")).toHaveTextContent("Competidor ficticio");
  });

  it("un competidor por analizar dice que el agente lo hará en su próxima ejecución", async () => {
    montarDemo();
    const otra = await tarjeta(/Otra recepcionista/);
    expect(otra).toHaveTextContent(
      "El agente lo analizará en su próxima ejecución"
    );
  });

  it("el dominio es texto: nunca un enlace", async () => {
    montarDemo();
    await grupo("Revisados");
    const dominio = screen.getByText("competidor-ficticio.example");
    expect(dominio.closest("a")).toBeNull();
    expect(
      screen.queryByRole("link", { name: /competidor-ficticio\.example$/ })
    ).toBeNull();
  });

  it("sin competidores, un estado vacío con la invitación a añadir (y un solo botón «Añadir competidor»)", async () => {
    renderConCliente(
      <VistaDeCompetencia />,
      clienteFalso({ competidores: async () => ({ data: [] }) })
    );
    expect(
      await screen.findByText("Todavía no hay competidores")
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Añadir competidor" })
    ).toHaveLength(1);
  });

  it("si falla, lo dice con «Reintentar» y reintenta", async () => {
    let intento = 0;
    const usuario = userEvent.setup();
    renderConCliente(
      <VistaDeCompetencia />,
      clienteFalso({
        competidores: async () => {
          intento += 1;
          if (intento === 1) throw new ErrorDeCliente(500, "Fallo.");
          return { data: [competidor()] };
        },
      })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron cargar los competidores"
    );
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Competidor ficticio")).toBeInTheDocument();
  });
});

describe("Competencia · los propuestos por el agente", () => {
  it("se pueden aceptar: pasan a «Por analizar» y dejan de tener los botones", async () => {
    const usuario = userEvent.setup();
    montarDemo();
    const atiende = await tarjeta(/Atiende24/);
    await usuario.click(
      within(atiende).getByRole("button", { name: /Aceptar/ })
    );
    const porAnalizar = await grupo("Por analizar");
    await waitFor(() =>
      expect(within(porAnalizar).getByText("Atiende24 (ejemplo)")).toBeVisible()
    );
    expect(
      screen.queryByRole("heading", { name: /Propuestos por el agente/ })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Aceptar/ })).toBeNull();
  });

  it("rechazar pide confirmación y no borra hasta que la das", async () => {
    const usuario = userEvent.setup();
    const cliente = montarDemo();
    const atiende = await tarjeta(/Atiende24/);
    await usuario.click(
      within(atiende).getByRole("button", { name: /Rechazar/ })
    );
    const dialogo = screen.getByRole("alertdialog", {
      name: "¿Rechazar esta propuesta?",
    });
    expect(dialogo).toHaveTextContent(
      "Si el agente lo vuelve a encontrar en otra ejecución, podrá proponerlo otra vez."
    );
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Cancelar" })
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect((await cliente.competidores()).data).toHaveLength(4);

    await usuario.click(
      within(await tarjeta(/Atiende24/)).getByRole("button", {
        name: /Rechazar/,
      })
    );
    await usuario.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Rechazar",
      })
    );
    await waitFor(() =>
      expect(screen.queryByText("Atiende24 (ejemplo)")).toBeNull()
    );
    expect(screen.getByText("3 competidores")).toBeInTheDocument();
  });

  it("los botones llevan el nombre del competidor para los lectores de pantalla", async () => {
    montarDemo();
    expect(
      await screen.findByRole("button", {
        name: "Aceptar a Atiende24 (ejemplo)",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Rechazar a Atiende24 (ejemplo)" })
    ).toBeInTheDocument();
  });

  it("si aceptar falla, lo dice con qué hacer y la tarjeta se queda donde estaba", async () => {
    const usuario = userEvent.setup();
    renderConCliente(
      <VistaDeCompetencia />,
      clienteFalso({
        competidores: async () => ({
          data: [
            competidor({
              id: "p",
              nombre: "Propuesto",
              dominio: "propuesto.example",
              estado: "propuesto",
              origen: "agente",
            }),
          ],
        }),
        aceptarCompetidor: async () => {
          throw new ErrorDeCliente(
            409,
            "Solo se puede aceptar un competidor propuesto (este está por_analizar).",
            { codigo: "estado_incorrecto" }
          );
        },
      })
    );
    await usuario.click(await screen.findByRole("button", { name: /Aceptar/ }));
    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent(
      "Solo se puede aceptar un competidor propuesto"
    );
    expect(aviso).toHaveTextContent("recarga la pantalla");
    expect(screen.getByText("Propuesto")).toBeInTheDocument();
  });
});

describe("Competencia · añadir un competidor", () => {
  async function abrir(cliente: ClienteGrowth = clienteDemo({ retardoMs: 0 })) {
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeCompetencia />, cliente);
    await usuario.click(
      await screen.findByRole("button", { name: "Añadir competidor" })
    );
    const dialogo = screen.getByRole("dialog", { name: "Añadir competidor" });
    return { usuario, dialogo };
  }

  it("explica que el agente lo analizará en el siguiente run y pide la URL (obligatoria) y, si quieres, nombre y notas", async () => {
    const { dialogo } = await abrir();
    expect(dialogo).toHaveTextContent(
      "El agente la leerá en el siguiente run y guardará su servicio, su producto y sus precios"
    );
    expect(within(dialogo).getByLabelText("Dirección de su web")).toHaveFocus();
    expect(within(dialogo).getByLabelText(/Nombre/)).toBeInTheDocument();
    expect(within(dialogo).getByLabelText(/Notas/)).toBeInTheDocument();
    expect(within(dialogo).getAllByText("Opcional")).toHaveLength(2);
  });

  it("sin URL o con una que no es http(s) no sale ninguna petición", async () => {
    const cliente = clienteFalso({ competidores: async () => ({ data: [] }) });
    const { usuario, dialogo } = await abrir(cliente);
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Añadir competidor" })
    );
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "Escribe la dirección web."
    );

    await usuario.type(
      within(dialogo).getByLabelText("Dirección de su web"),
      "javascript:alert(1)"
    );
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Añadir competidor" })
    );
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "empiece por http:// o https://"
    );
    expect(cliente.anadirCompetidor).not.toHaveBeenCalled();
  });

  it("manda la URL, el nombre y las notas recortados, y omite lo vacío", async () => {
    const cliente = clienteFalso({
      competidores: async () => ({ data: [] }),
      anadirCompetidor: async () =>
        detalleDeCompetidor({ id: "nuevo", nombre: "Rival" }),
    });
    const { usuario, dialogo } = await abrir(cliente);
    await usuario.type(
      within(dialogo).getByLabelText("Dirección de su web"),
      "  https://rival.example/precios  "
    );
    await usuario.type(within(dialogo).getByLabelText(/Nombre/), " Rival SL ");
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Añadir competidor" })
    );
    await waitFor(() =>
      expect(cliente.anadirCompetidor).toHaveBeenCalledTimes(1)
    );
    expect(cliente.anadirCompetidor).toHaveBeenCalledWith({
      url: "https://rival.example/precios",
      nombre: "Rival SL",
    });
  });

  it("con el cliente de demostración: cierra, avisa con un enlace a la ficha y lo pone en «Por analizar»", async () => {
    const { usuario, dialogo } = await abrir();
    await usuario.type(
      within(dialogo).getByLabelText("Dirección de su web"),
      "https://www.nuevo-rival.example/?utm_source=x"
    );
    await usuario.type(
      within(dialogo).getByLabelText(/Notas/),
      "Me lo pasó una clienta"
    );
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Añadir competidor" })
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    const aviso = screen.getByRole("status");
    expect(aviso).toHaveTextContent("Competidor añadido");
    expect(aviso).toHaveTextContent(
      "El agente lo analizará en el siguiente run"
    );
    expect(
      within(aviso).getByRole("link", { name: /Ver la ficha de/ })
    ).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/competencia\/demo-nuevo-/)
    );
    const porAnalizar = await grupo("Por analizar");
    await waitFor(() =>
      expect(within(porAnalizar).getByText("Nuevo-rival")).toBeVisible()
    );
    const nueva = within(porAnalizar).getByText("Nuevo-rival").closest("li")!;
    expect(nueva).toHaveTextContent("nuevo-rival.example");
    expect(nueva).toHaveTextContent("Añadido por ti");
  });

  it("si ya existe (409), lo dice, dice qué hacer, enlaza al que ya está y deja lo escrito", async () => {
    const { usuario, dialogo } = await abrir();
    await usuario.type(
      within(dialogo).getByLabelText("Dirección de su web"),
      "https://competidor-ficticio.example/otra"
    );
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Añadir competidor" })
    );
    const aviso = await within(dialogo).findByRole("alert");
    expect(aviso).toHaveTextContent("Ya existe un competidor con ese dominio.");
    expect(aviso).toHaveTextContent("Ábrelo desde la lista");
    expect(
      within(dialogo).getByRole("link", {
        name: "Ver el competidor que ya existe",
      })
    ).toHaveAttribute("href", "/competencia/demo-co-1");
    expect(within(dialogo).getByLabelText("Dirección de su web")).toHaveValue(
      "https://competidor-ficticio.example/otra"
    );
    // Sigue abierto y el botón se puede volver a usar.
    expect(
      within(dialogo).getByRole("button", { name: "Añadir competidor" })
    ).toBeEnabled();
  });

  it("el dominio de Alhabla es un 400 con su explicación", async () => {
    const { usuario, dialogo } = await abrir();
    await usuario.type(
      within(dialogo).getByLabelText("Dirección de su web"),
      "https://alhabla.ai"
    );
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Añadir competidor" })
    );
    const aviso = await within(dialogo).findByRole("alert");
    expect(aviso).toHaveTextContent("Esa página es de Alhabla");
    expect(aviso).toHaveTextContent("pega la web del competidor");
  });

  it("un doble clic manda una sola petición y deja el botón deshabilitado mientras vuela", async () => {
    let resolver!: (c: ReturnType<typeof detalleDeCompetidor>) => void;
    const cliente = clienteFalso({
      competidores: async () => ({ data: [] }),
      anadirCompetidor: () =>
        new Promise((r) => {
          resolver = r;
        }),
    });
    const { usuario, dialogo } = await abrir(cliente);
    await usuario.type(
      within(dialogo).getByLabelText("Dirección de su web"),
      "https://rival.example"
    );
    const boton = within(dialogo).getByRole("button", {
      name: "Añadir competidor",
    });
    await usuario.dblClick(boton);
    expect(cliente.anadirCompetidor).toHaveBeenCalledTimes(1);
    expect(
      within(dialogo).getByRole("button", { name: "Añadiendo…" })
    ).toBeDisabled();
    resolver(detalleDeCompetidor());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Cancelar y Escape cierran sin llamar a nadie", async () => {
    const cliente = clienteFalso({ competidores: async () => ({ data: [] }) });
    const { usuario, dialogo } = await abrir(cliente);
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Cancelar" })
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await usuario.click(
      screen.getByRole("button", { name: "Añadir competidor" })
    );
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cliente.anadirCompetidor).not.toHaveBeenCalled();
  });
});

describe("Competencia · el texto de terceros es texto", () => {
  it("un nombre, un dominio y unas notas con HTML o con javascript: no se interpretan ni se enlazan", async () => {
    const { container } = renderConCliente(
      <VistaDeCompetencia />,
      clienteFalso({
        competidores: async () => ({
          data: [
            competidor({
              id: "hostil",
              nombre: "<b>Rival</b>",
              dominio: "javascript:alert(1)",
              notas:
                '<img src=x onerror="alert(1)"> <a href="javascript:alert(2)">pulsa</a>',
              estado: "propuesto",
              origen: "agente",
            }),
          ],
        }),
      })
    );
    await screen.findByText("<b>Rival</b>");
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(container.querySelector("img, b, script")).toBeNull();
    // Los únicos enlaces son los internos del panel.
    const destinos = [...container.querySelectorAll("a")].map((a) =>
      a.getAttribute("href")
    );
    for (const destino of destinos) {
      expect(destino).toMatch(/^\/competencia(\/|$)/);
    }
    expect(screen.getByText(/onerror=/)).toBeInTheDocument();
  });
});
