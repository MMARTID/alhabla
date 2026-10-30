import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { normalizarDominio } from "@/components/historial/filtros-de-historial";
import { VistaDeHistorial } from "@/components/historial/vista-de-historial";
import type { FiltrosDeGestiones } from "@/lib/types";
import { clienteFalso } from "../helpers/cliente-falso";
import {
  decision,
  gestion,
  hace,
  listaDeDecisiones,
  listaDeGestiones,
} from "../helpers/d2-datos";
import { renderConCliente } from "../helpers/render";

function ultimosFiltros(cliente: ReturnType<typeof clienteFalso>) {
  const llamadas = cliente.listarGestiones.mock.calls;
  return llamadas[llamadas.length - 1][0] as FiltrosDeGestiones;
}

async function abrirGestiones(cliente: ReturnType<typeof clienteFalso>) {
  const usuario = userEvent.setup();
  renderConCliente(<VistaDeHistorial />, cliente);
  await screen.findByRole("list", { name: "Decisiones" });
  await usuario.click(screen.getByRole("tab", { name: "Gestiones" }));
  return usuario;
}

function clienteConGestiones(
  gestiones = [gestion()],
  extra: Parameters<typeof listaDeGestiones>[1] = {}
) {
  return clienteFalso({
    listarDecisiones: async () => listaDeDecisiones([decision()]),
    listarGestiones: async () => listaDeGestiones(gestiones, extra),
  });
}

describe("Historial · pestañas", () => {
  it("abre en Decisiones y cambia a Gestiones con el ratón y con el teclado", async () => {
    const cliente = clienteConGestiones();
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeHistorial />, cliente);

    const decisiones = screen.getByRole("tab", { name: "Decisiones" });
    const gestiones = screen.getByRole("tab", { name: "Gestiones" });
    expect(decisiones).toHaveAttribute("aria-selected", "true");
    expect(gestiones).toHaveAttribute("aria-selected", "false");
    // Solo la pestaña activa entra en el orden de tabulación.
    expect(gestiones).toHaveAttribute("tabindex", "-1");
    expect(cliente.listarGestiones).not.toHaveBeenCalled();

    await usuario.click(gestiones);
    expect(gestiones).toHaveAttribute("aria-selected", "true");
    expect(
      await screen.findByRole("list", { name: "Gestiones" })
    ).toBeVisible();
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      gestiones.id
    );

    gestiones.focus();
    await usuario.keyboard("{ArrowLeft}");
    expect(decisiones).toHaveAttribute("aria-selected", "true");
    expect(decisiones).toHaveFocus();
  });
});

describe("Historial · gestiones", () => {
  it("enseña canal, dominio, fecha, resultado y la oportunidad", async () => {
    const cliente = clienteConGestiones([
      gestion({
        canal: "formulario",
        resultado: "aceptado",
        respuestaEn: hace(5),
        notas: "Respondieron al día siguiente.",
      }),
    ]);
    await abrirGestiones(cliente);

    const fila = within(
      await screen.findByRole("list", { name: "Gestiones" })
    ).getByRole("listitem");
    expect(fila).toHaveTextContent("Formulario");
    expect(fila).toHaveTextContent("revista-pymes.example");
    expect(fila).toHaveTextContent("Aceptado");
    expect(fila).toHaveTextContent("Hecha el");
    expect(fila).toHaveTextContent("Respuesta el");
    expect(fila).toHaveTextContent("Respondieron al día siguiente.");
    expect(
      within(fila).getByRole("link", {
        name: "Listado de recepcionistas de IA",
      })
    ).toHaveAttribute("href", "/oportunidad/op-1");
  });

  it("la URL conseguida es un enlace seguro solo si es http(s)", async () => {
    const cliente = clienteConGestiones([
      gestion({
        id: "g-web",
        resultado: "aceptado",
        urlConseguida: "https://revista-pymes.example/listado/",
      }),
    ]);
    await abrirGestiones(cliente);

    const enlace = await screen.findByRole("link", {
      name: /revista-pymes\.example\/listado/,
    });
    expect(enlace).toHaveAttribute(
      "href",
      "https://revista-pymes.example/listado/"
    );
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace.getAttribute("rel")?.split(" ").sort()).toEqual([
      "nofollow",
      "noopener",
      "noreferrer",
    ]);
  });

  it.each([
    "javascript:alert(document.cookie)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//evil.example/x",
    "/ruta/relativa",
  ])(
    "una URL conseguida %j no se pinta como enlace: se enseña como texto",
    async (peligrosa) => {
      const cliente = clienteConGestiones([
        gestion({ resultado: "aceptado", urlConseguida: peligrosa }),
      ]);
      const { container } = renderConCliente(<VistaDeHistorial />, cliente);
      const usuario = userEvent.setup();
      await screen.findByRole("list", { name: "Decisiones" });
      await usuario.click(screen.getByRole("tab", { name: "Gestiones" }));

      const lista = await screen.findByRole("list", { name: "Gestiones" });
      // Ningún `href` sale de aquí con otra cosa que no sea el enlace interno.
      const destinos = Array.from(container.querySelectorAll("a[href]")).map(
        (a) => a.getAttribute("href")
      );
      expect(destinos).toEqual(["/oportunidad/op-1"]);
      expect(lista).toHaveTextContent("(no es una dirección web)");
      expect(lista).toHaveTextContent(peligrosa);
    }
  );

  it("sin URL conseguida no pinta ese apartado", async () => {
    const cliente = clienteConGestiones([gestion({ urlConseguida: null })]);
    await abrirGestiones(cliente);
    await screen.findByRole("list", { name: "Gestiones" });
    expect(screen.queryByText(/Enlace conseguido/)).not.toBeInTheDocument();
  });

  it("el texto que enviaste se ve al abrirlo y es texto", async () => {
    const cliente = clienteConGestiones([
      gestion({
        borrador: {
          id: "bo-1",
          version: 3,
          tipo: "email",
          asunto: null,
          textoFinal: "Hola <b>equipo</b>,\nsoy yo.",
          editadoPorHumano: true,
        },
      }),
    ]);
    const { container } = renderConCliente(<VistaDeHistorial />, cliente);
    const usuario = userEvent.setup();
    await screen.findByRole("list", { name: "Decisiones" });
    await usuario.click(screen.getByRole("tab", { name: "Gestiones" }));

    await screen.findByRole("list", { name: "Gestiones" });
    expect(screen.getByText(/editado por ti/)).toBeInTheDocument();
    expect(screen.getByText("Texto que enviaste")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
  });

  it("los chips de resultado traen su cuenta y filtran", async () => {
    const cliente = clienteConGestiones();
    const usuario = await abrirGestiones(cliente);

    const grupo = await screen.findByRole("group", {
      name: "Resultado de la gestión",
    });
    const botones = within(grupo).getAllByRole("button");
    expect(botones.map((b) => b.textContent)).toEqual([
      "Todas10",
      "Pendiente2",
      "Aceptado3",
      "Rechazado1",
      "Sin respuesta4",
    ]);
    expect(botones[0]).toHaveAttribute("aria-pressed", "true");

    await usuario.click(
      within(grupo).getByRole("button", { name: /Aceptado/ })
    );
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({
        resultado: "aceptado",
        pagina: 1,
      })
    );
    expect(
      within(grupo).getByRole("button", { name: /Aceptado/ })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("filtra por canal y por dominio (que se limpia aunque pegues una URL entera)", async () => {
    const cliente = clienteConGestiones();
    const usuario = await abrirGestiones(cliente);
    await screen.findByRole("list", { name: "Gestiones" });

    await usuario.selectOptions(screen.getByLabelText("Canal"), "formulario");
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ canal: "formulario" })
    );

    const campo = screen.getByLabelText("Dominio");
    await usuario.type(campo, "https://www.Revista-Pymes.example/listado");
    // No consulta letra a letra: espera a Intro.
    expect(ultimosFiltros(cliente).dominio).toBeUndefined();
    await usuario.keyboard("{Enter}");
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({
        dominio: "revista-pymes.example",
        canal: "formulario",
      })
    );
    // El campo enseña lo que se aplicó de verdad.
    expect(campo).toHaveValue("revista-pymes.example");
  });

  it("«Quitar filtros» vacía también el campo del dominio", async () => {
    const cliente = clienteConGestiones();
    const usuario = await abrirGestiones(cliente);
    await screen.findByRole("list", { name: "Gestiones" });

    await usuario.type(screen.getByLabelText("Dominio"), "otro.example{Enter}");
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ dominio: "otro.example" })
    );
    await usuario.click(screen.getByRole("button", { name: "Quitar filtros" }));
    expect(screen.getByLabelText("Dominio")).toHaveValue("");
  });

  it("pagina y vuelve a pedir la página que toca", async () => {
    const filas = Array.from({ length: 20 }, (_, i) =>
      gestion({ id: `g-${i}` })
    );
    const cliente = clienteFalso({
      listarDecisiones: async () => listaDeDecisiones([decision()]),
      listarGestiones: async (filtros) =>
        listaDeGestiones(filas, { total: 33, pagina: filtros?.pagina ?? 1 }),
    });
    const usuario = await abrirGestiones(cliente);

    expect(await screen.findByText("1–20 de 33")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(await screen.findByText("21–33 de 33")).toBeInTheDocument();
    expect(ultimosFiltros(cliente)).toMatchObject({ pagina: 2, limite: 20 });
  });

  it("sin gestiones lo cuenta; con filtros, dice que ninguna coincide", async () => {
    const cliente = clienteConGestiones([], {
      conteos: { porResultado: {} },
    });
    const usuario = await abrirGestiones(cliente);

    expect(
      await screen.findByText("Todavía no hay gestiones")
    ).toBeInTheDocument();
    await usuario.selectOptions(screen.getByLabelText("Canal"), "otro");
    expect(
      await screen.findByText("Ninguna gestión coincide con estos filtros")
    ).toBeInTheDocument();
  });
});

describe("normalizarDominio", () => {
  it.each([
    ["Revista-Pymes.example", "revista-pymes.example"],
    ["  www.revista.example  ", "revista.example"],
    ["https://www.revista.example/listado?x=1#a", "revista.example"],
    ["revista.example/ruta/larga", "revista.example"],
    ["", ""],
  ])("%j → %j", (entrada, esperado) => {
    expect(normalizarDominio(entrada)).toBe(esperado);
  });
});
