import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VistaDeCompetidor } from "@/components/competencia/vista-de-competidor";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import type { CompetidorDetalle } from "@/lib/types";
import { clienteFalso } from "../helpers/cliente-falso";
import {
  analisisDeCompetidor,
  datoDeCompetidor,
  detalleDeCompetidor,
} from "../helpers/competencia-datos";
import { renderConCliente } from "../helpers/render";

const empujar = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: empujar }),
}));

beforeEach(() => {
  empujar.mockReset();
});

/** Intl separa la cifra y el símbolo con un espacio duro: se compara con uno normal. */
const normal = (texto: string | null) => (texto ?? "").replace(/[  ]/g, " ");

function montarDemo(id: string) {
  const cliente = clienteDemo({ retardoMs: 0 });
  renderConCliente(<VistaDeCompetidor id={id} />, cliente);
  return cliente;
}

function montarFalso(
  detalle: CompetidorDetalle,
  sustitutos: Partial<ClienteGrowth> = {}
) {
  const cliente = clienteFalso({
    detalleDeCompetidor: async () => detalle,
    ...sustitutos,
  });
  const vista = renderConCliente(
    <VistaDeCompetidor id={detalle.id} />,
    cliente
  );
  return { cliente, ...vista };
}

describe("Competidor · la ficha", () => {
  it("cabecera: nombre, dominio como texto, estado y origen", async () => {
    montarDemo("demo-co-3");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Recepción Express (ejemplo)",
      })
    ).toBeInTheDocument();
    const dominio = screen.getAllByText("recepcion-express.example")[0];
    expect(dominio.closest("a")).toBeNull();
    expect(screen.getByText("Pendiente de revisión")).toBeInTheDocument();
    expect(screen.getByText("Añadido por ti")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Competencia/ })).toHaveAttribute(
      "href",
      "/competencia"
    );
  });

  it("lleva siempre el aviso «Información interna: no se puede citar en un borrador»", async () => {
    for (const id of ["demo-co-1", "demo-co-2", "demo-co-3", "demo-co-4"]) {
      const { unmount } = renderConCliente(
        <VistaDeCompetidor id={id} />,
        clienteDemo({ retardoMs: 0 })
      );
      const texto = await screen.findByText(
        "Información interna: no se puede citar en un borrador."
      );
      expect(texto.closest('[role="note"]')).not.toBeNull();
      unmount();
    }
  });

  it("los del repositorio dicen que sus comparativas publicables viven en comparativas.ts; los demás no", async () => {
    montarDemo("demo-co-1");
    expect(
      await screen.findByText(/comparativas publicables\s+viven en/)
    ).toBeInTheDocument();
    expect(screen.getByText("web/src/lib/comparativas.ts")).toBeInTheDocument();
  });

  it("uno añadido a mano no habla de comparativas.ts", async () => {
    montarDemo("demo-co-3");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText("web/src/lib/comparativas.ts")).toBeNull();
  });

  it("la URL de partida https es un enlace seguro: https, nueva pestaña y nofollow noopener noreferrer", async () => {
    montarDemo("demo-co-3");
    const enlace = await screen.findByRole("link", {
      name: /https:\/\/recepcion-express\.example\//,
    });
    expect(enlace).toHaveAttribute(
      "href",
      "https://recepcion-express.example/"
    );
    expect(enlace).toHaveAttribute("target", "_blank");
    const rel = enlace.getAttribute("rel") ?? "";
    for (const clave of ["nofollow", "noopener", "noreferrer"]) {
      expect(rel).toContain(clave);
    }
  });

  it("una URL de partida que no es https no se enlaza (http, javascript:, data:)", async () => {
    for (const url of [
      "http://rival.example/",
      "javascript:alert(1)",
      "data:text/html,<b>x</b>",
    ]) {
      const { unmount, container } = montarFalso(detalleDeCompetidor({ url }));
      await screen.findByRole("heading", { level: 1, name: "Rival" });
      expect(container.querySelector(`a[href^="javascript:"]`)).toBeNull();
      expect(container.querySelector(`a[href^="data:"]`)).toBeNull();
      expect(container.querySelector(`a[href^="http://"]`)).toBeNull();
      expect(
        screen.getByText(/no se enlaza: no es una dirección https/)
      ).toBeVisible();
      unmount();
    }
  });

  it("sin URL de partida lo dice, sin inventar nada", async () => {
    montarDemo("demo-co-2");
    expect(await screen.findByText("Sin dirección")).toBeInTheDocument();
  });

  it("las páginas que lo mencionan enlazan a la Bandeja filtrada", async () => {
    montarDemo("demo-co-3");
    expect(
      await screen.findByRole("link", { name: "2 oportunidades en la Bandeja" })
    ).toHaveAttribute("href", "/bandeja?menciona=recepcion-express.example");
  });

  it("si no existe, lo cuenta el error del backend", async () => {
    montarDemo("no-existe");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El competidor no existe."
    );
  });
});

describe("Competidor · el análisis", () => {
  it("el resumen y los datos salen agrupados por tipo, con precios y planes juntos", async () => {
    montarDemo("demo-co-3");
    await screen.findByRole("heading", { level: 3, name: /Versión 2/ });
    const titulos = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent?.replace(/\d+$/, ""));
    expect(titulos).toEqual([
      "Versión 2 · la última",
      "Producto",
      "Servicio",
      "Precios y planes",
      "Integraciones",
      "Idiomas",
      "Límites",
      "Diferencias con Alhabla",
    ]);
    expect(
      screen.getByText(
        /Recepcionista de IA para clínicas y centros de estética/
      )
    ).toBeInTheDocument();
    const precios = screen
      .getByRole("heading", { level: 3, name: /Precios y planes/ })
      .closest("section") as HTMLElement;
    expect(within(precios).getAllByRole("listitem")).toHaveLength(3);
  });

  it("los precios salen formateados en es-ES con su periodo, su unidad y el IVA", async () => {
    montarDemo("demo-co-3");
    const precios = (
      await screen.findByRole("heading", { level: 3, name: /Precios y planes/ })
    ).closest("section") as HTMLElement;
    const textos = within(precios)
      .getAllByRole("listitem")
      .map((li) => normal(li.textContent));
    expect(textos[0]).toContain("79 € al mes · IVA no incluido");
    expect(textos[1]).toContain("790 € al año · IVA incluido");
    expect(textos[2]).toContain("0,12 € por minuto · IVA no incluido");
  });

  it("cada dato lleva su fuente (enlace https nofollow) y la fecha de consulta", async () => {
    montarDemo("demo-co-3");
    const producto = (
      await screen.findByRole("heading", { level: 3, name: /^Producto/ })
    ).closest("section") as HTMLElement;
    const enlace = within(producto).getByRole("link", {
      name: /recepcion-express\.example\/producto/,
    });
    expect(enlace).toHaveAttribute(
      "href",
      "https://recepcion-express.example/producto"
    );
    expect(enlace.getAttribute("rel")).toContain("nofollow");
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(producto).toHaveTextContent("Consultado el 28 oct 2026");
  });

  it("una fuente que no es https se enseña como texto y no se enlaza", async () => {
    const analisis = analisisDeCompetidor({
      datos: [
        datoDeCompetidor({
          etiqueta: "Con http",
          urlFuente: "http://rival.example/viejo",
        }),
        datoDeCompetidor({
          etiqueta: "Con javascript",
          urlFuente: "javascript:alert(1)",
        }),
        datoDeCompetidor({
          etiqueta: "Con data",
          urlFuente: "data:text/html,<script>alert(1)</script>",
        }),
        datoDeCompetidor({
          etiqueta: "Bien",
          urlFuente: "https://rival.example/ok",
        }),
      ],
    });
    const { container } = montarFalso(detalleDeCompetidor({}, [analisis]));
    await screen.findByText("Con http");
    const enlaces = [...container.querySelectorAll("a")]
      .map((a) => a.getAttribute("href"))
      .filter((h) => h && !h.startsWith("/"));
    // La URL de partida (https) y la única fuente https; ninguna otra.
    expect(enlaces).toEqual([
      "https://rival.example/",
      "https://rival.example/ok",
    ]);
    expect(
      screen.getAllByText(/no se enlaza: no es una dirección https/)
    ).toHaveLength(3);
    expect(screen.getByText(/javascript:alert\(1\)/)).toBeInTheDocument();
  });

  it("todo el texto del agente es texto: nada de HTML ni de enlaces dentro", async () => {
    const analisis = analisisDeCompetidor({
      resumen:
        '<img src=x onerror="alert(1)"> y <a href="javascript:alert(2)">enlace</a>',
      notaDeRevision: "<b>nota</b>",
      revisadoEn: "2026-10-29T09:00:00.000Z",
      datos: [
        datoDeCompetidor({
          etiqueta: "<script>alert(3)</script>",
          texto: "<iframe src=javascript:alert(4)></iframe>",
        }),
      ],
    });
    const { container } = montarFalso(
      detalleDeCompetidor(
        { nombre: "<u>Rival</u>", notas: "<svg onload=alert(5)>" },
        [analisis]
      )
    );
    await screen.findByText("<u>Rival</u>");
    expect(
      container.querySelector("img, script, iframe, svg[onload], u, b")
    ).toBeNull();
    expect(screen.getByText(/<img src=x onerror=/)).toBeInTheDocument();
    expect(screen.getByText("<script>alert(3)</script>")).toBeInTheDocument();
    expect(screen.getByText("<b>nota</b>")).toBeInTheDocument();
    for (const a of container.querySelectorAll("a")) {
      expect(a.getAttribute("href")).not.toMatch(/^javascript:/i);
    }
  });

  it("quién lo guardó y cuándo se ve; el pendiente de revisión lo dice", async () => {
    montarDemo("demo-co-3");
    const cabecera = (
      await screen.findByRole("heading", { level: 3, name: /Versión 2/ })
    ).closest("section") as HTMLElement;
    expect(cabecera).toHaveTextContent("Guardada por agente-de-ejemplo");
    expect(cabecera).toHaveTextContent("Pendiente de tu revisión");
  });

  it("un análisis caducado lo avisa, en la cabecera y en el análisis", async () => {
    montarDemo("demo-co-1");
    await screen.findByRole("heading", {
      level: 1,
      name: "Competidor ficticio",
    });
    // La insignia de la cabecera y el aviso dentro del análisis.
    expect(screen.getAllByText(/Análisis caducado/)).toHaveLength(2);
    expect(screen.getByText(/Tiene más de 90 días/)).toBeInTheDocument();
  });

  it("uno revisado enseña cuándo y su nota", async () => {
    montarDemo("demo-co-1");
    expect(await screen.findByText("Tu nota")).toBeInTheDocument();
    expect(
      screen.getByText("Datos correctos. Repetir en tres meses.")
    ).toBeInTheDocument();
    // La insignia de la cabecera y la del propio análisis.
    expect(screen.getAllByText("Revisado")).toHaveLength(2);
  });

  it("sin análisis: «Todavía no lo ha leído el agente»", async () => {
    montarDemo("demo-co-2");
    expect(
      await screen.findByRole("heading", {
        name: "Todavía no lo ha leído el agente",
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Marcar como revisado" })
    ).toBeNull();
    // No hay nada que volver a analizar: ya está pedido.
    expect(
      screen.queryByRole("button", { name: "Volver a analizar" })
    ).toBeNull();
  });
});

describe("Competidor · las versiones del análisis", () => {
  it("con una sola versión no hay selector", async () => {
    montarDemo("demo-co-1");
    await screen.findByRole("heading", { level: 3, name: /Versión 1/ });
    expect(screen.queryByLabelText("Versión del análisis")).toBeNull();
  });

  it("con varias hay selector, de la más nueva a la más vieja, con el estado delante de la fecha y la última elegida", async () => {
    montarDemo("demo-co-3");
    const selector = await screen.findByLabelText("Versión del análisis");
    const opciones = within(selector).getAllByRole("option");
    expect(opciones.map((o) => o.textContent)).toEqual([
      expect.stringMatching(/^Versión 2 \(última\) · sin revisar · .+$/),
      expect.stringMatching(/^Versión 1 · revisada · .+$/),
    ]);
    expect(selector).toHaveValue("demo-an-3-2");
  });

  it("elegir una anterior la carga, avisa de que no es la última y esconde «Marcar como revisado»", async () => {
    const usuario = userEvent.setup();
    const cliente = montarDemo("demo-co-3");
    const espia = vi.spyOn(cliente, "analisisDeCompetidor");
    await usuario.selectOptions(
      await screen.findByLabelText("Versión del análisis"),
      "demo-an-3-1"
    );
    expect(
      await screen.findByRole("heading", { level: 3, name: "Versión 1" })
    ).toBeInTheDocument();
    expect(espia).toHaveBeenCalledWith("demo-co-3", "demo-an-3-1");
    expect(screen.getByText(/Primera lectura de la web/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Marcar como revisado" })
    ).toBeNull();
    // Volver a la última no vuelve a pedir nada.
    await usuario.selectOptions(
      screen.getByLabelText("Versión del análisis"),
      "demo-an-3-2"
    );
    expect(
      await screen.findByRole("heading", { level: 3, name: /Versión 2/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar como revisado" })
    ).toBeInTheDocument();
  });

  it("una versión antigua sin revisar dice que la sustituyeron", async () => {
    const usuario = userEvent.setup();
    const v1 = analisisDeCompetidor({ id: "an-1", version: 1 });
    const v2 = analisisDeCompetidor({
      id: "an-2",
      version: 2,
      resumen: "La segunda lectura.",
    });
    montarFalso(detalleDeCompetidor({}, [v1, v2]), {
      analisisDeCompetidor: async () => v1,
    });
    await usuario.selectOptions(
      await screen.findByLabelText("Versión del análisis"),
      "an-1"
    );
    expect(
      await screen.findByText(
        "Sustituido por una versión más nueva sin llegar a revisarse"
      )
    ).toBeInTheDocument();
  });

  it("si la versión no carga, lo dice con «Reintentar» y la ficha sigue ahí", async () => {
    const usuario = userEvent.setup();
    const v1 = analisisDeCompetidor({ id: "an-1", version: 1 });
    const v2 = analisisDeCompetidor({ id: "an-2", version: 2 });
    montarFalso(detalleDeCompetidor({}, [v1, v2]), {
      analisisDeCompetidor: async () => {
        throw new ErrorDeCliente(500, "Fallo.");
      },
    });
    await usuario.selectOptions(
      await screen.findByLabelText("Versión del análisis"),
      "an-1"
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cargar esa versión"
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Rival" })
    ).toBeVisible();
  });
});

describe("Competidor · marcar como revisado", () => {
  it("abre un diálogo con la nota opcional y, al confirmar, deja el competidor revisado con su nota", async () => {
    const usuario = userEvent.setup();
    montarDemo("demo-co-3");
    await usuario.click(
      await screen.findByRole("button", { name: "Marcar como revisado" })
    );
    const dialogo = screen.getByRole("dialog", {
      name: "Marcar como revisado",
    });
    expect(dialogo).toHaveTextContent("Das por bueno el análisis versión 2");
    expect(dialogo).toHaveTextContent("no se puede citar en un borrador");
    await usuario.type(
      within(dialogo).getByLabelText(/Nota/),
      "Precios comprobados"
    );
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Marcar como revisado" })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText("Tu nota")).toBeInTheDocument();
    expect(screen.getByText("Precios comprobados")).toBeInTheDocument();
    expect(screen.getAllByText("Revisado")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Marcar como revisado" })
    ).toBeNull();
  });

  it("sin nota manda el cuerpo vacío", async () => {
    const usuario = userEvent.setup();
    const analisis = analisisDeCompetidor({ id: "an-1" });
    const { cliente } = montarFalso(detalleDeCompetidor({}, [analisis]), {
      revisarAnalisis: async () =>
        detalleDeCompetidor({ estado: "revisado" }, [analisis]),
    });
    await usuario.click(
      await screen.findByRole("button", { name: "Marcar como revisado" })
    );
    await usuario.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Marcar como revisado",
      })
    );
    await waitFor(() =>
      expect(cliente.revisarAnalisis).toHaveBeenCalledTimes(1)
    );
    expect(cliente.revisarAnalisis).toHaveBeenCalledWith("co-1", "an-1", {});
  });

  it("si el agente guardó otro análisis mientras tanto (409), lo dice y no pierde la nota", async () => {
    const usuario = userEvent.setup();
    montarFalso(detalleDeCompetidor({}, [analisisDeCompetidor()]), {
      revisarAnalisis: async () => {
        throw new ErrorDeCliente(
          409,
          "Ese análisis ya no es el último: revisa el más reciente.",
          { codigo: "analisis_antiguo" }
        );
      },
    });
    await usuario.click(
      await screen.findByRole("button", { name: "Marcar como revisado" })
    );
    const dialogo = screen.getByRole("dialog");
    await usuario.type(within(dialogo).getByLabelText(/Nota/), "Mi nota");
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Marcar como revisado" })
    );
    const aviso = await within(dialogo).findByRole("alert");
    expect(aviso).toHaveTextContent("Ese análisis ya no es el último");
    expect(aviso).toHaveTextContent(
      "El agente ha guardado un análisis más reciente"
    );
    expect(within(dialogo).getByLabelText(/Nota/)).toHaveValue("Mi nota");
  });

  it("una nota de más de 500 caracteres no sale", async () => {
    const usuario = userEvent.setup();
    const { cliente } = montarFalso(
      detalleDeCompetidor({}, [analisisDeCompetidor()])
    );
    await usuario.click(
      await screen.findByRole("button", { name: "Marcar como revisado" })
    );
    const dialogo = screen.getByRole("dialog");
    await usuario.click(within(dialogo).getByLabelText(/Nota/));
    await usuario.paste("x".repeat(501));
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Marcar como revisado" })
    );
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("500");
    expect(cliente.revisarAnalisis).not.toHaveBeenCalled();
  });

  it("el botón no sale en uno ya revisado", async () => {
    montarDemo("demo-co-1");
    await screen.findByRole("heading", { level: 3, name: /Versión 1/ });
    expect(
      screen.queryByRole("button", { name: "Marcar como revisado" })
    ).toBeNull();
  });
});

describe("Competidor · volver a analizar", () => {
  it("pide confirmación, la cancela sin llamar y, al confirmar, lo deja «por analizar» conservando el análisis", async () => {
    const usuario = userEvent.setup();
    const cliente = montarDemo("demo-co-3");
    const espia = vi.spyOn(cliente, "reanalizarCompetidor");
    await usuario.click(
      await screen.findByRole("button", { name: "Volver a analizar" })
    );
    const dialogo = screen.getByRole("alertdialog", {
      name: "¿Volver a analizar?",
    });
    expect(dialogo).toHaveTextContent(
      "El análisis actual se conserva como versión anterior"
    );
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Cancelar" })
    );
    expect(espia).not.toHaveBeenCalled();

    await usuario.click(
      screen.getByRole("button", { name: "Volver a analizar" })
    );
    await usuario.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Volver a analizar",
      })
    );
    await waitFor(() => expect(espia).toHaveBeenCalledWith("demo-co-3"));
    expect(
      await screen.findByText(
        /El agente lo volverá a leer en su próxima ejecución/
      )
    ).toBeInTheDocument();
    // Mientras tanto se sigue viendo el análisis anterior, y ya no hay nada que pedir.
    expect(
      screen.getByRole("heading", { level: 3, name: /Versión 2/ })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Volver a analizar" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Marcar como revisado" })
    ).toBeNull();
  });

  it("si falla, lo dice dentro del diálogo y no lo cierra", async () => {
    const usuario = userEvent.setup();
    montarFalso(detalleDeCompetidor({}, [analisisDeCompetidor()]), {
      reanalizarCompetidor: async () => {
        throw new ErrorDeCliente(
          409,
          "Un competidor propuesto primero se acepta.",
          {
            codigo: "estado_incorrecto",
          }
        );
      },
    });
    await usuario.click(
      await screen.findByRole("button", { name: "Volver a analizar" })
    );
    await usuario.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Volver a analizar",
      })
    );
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByRole("alert")).toHaveTextContent(
      "Un competidor propuesto primero se acepta. Ha cambiado mientras mirabas"
    );
  });

  it("también se puede en uno revisado", async () => {
    montarDemo("demo-co-1");
    expect(
      await screen.findByRole("button", { name: "Volver a analizar" })
    ).toBeInTheDocument();
  });
});

describe("Competidor · quitar", () => {
  it("el del repositorio no se puede quitar: el botón está desactivado y dice por qué", async () => {
    montarDemo("demo-co-1");
    const boton = await screen.findByRole("button", { name: "Quitar" });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription(
      /Viene del repositorio y el sincronizador del conocimiento lo volvería a crear/
    );
  });

  it("uno añadido a mano pide confirmación, no llama al cancelar y, al confirmar, vuelve a la lista", async () => {
    const usuario = userEvent.setup();
    const cliente = montarDemo("demo-co-3");
    const espia = vi.spyOn(cliente, "quitarCompetidor");
    await usuario.click(await screen.findByRole("button", { name: "Quitar" }));
    const dialogo = screen.getByRole("alertdialog", {
      name: "¿Quitar este competidor?",
    });
    expect(dialogo).toHaveTextContent("todas las versiones de su análisis");
    expect(dialogo).toHaveTextContent("No se puede deshacer");
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Cancelar" })
    );
    expect(espia).not.toHaveBeenCalled();
    expect(empujar).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole("button", { name: "Quitar" }));
    await usuario.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Quitar competidor",
      })
    );
    await waitFor(() => expect(empujar).toHaveBeenCalledWith("/competencia"));
    expect(espia).toHaveBeenCalledWith("demo-co-3");
    expect((await cliente.competidores()).data.map((c) => c.id)).not.toContain(
      "demo-co-3"
    );
  });

  it("no vuelve a pedir la ficha que acaba de borrar (nada de un 404 antes de salir)", async () => {
    const usuario = userEvent.setup();
    const cliente = montarDemo("demo-co-3");
    const detalle = vi.spyOn(cliente, "detalleDeCompetidor");
    await usuario.click(await screen.findByRole("button", { name: "Quitar" }));
    const antes = detalle.mock.calls.length;
    await usuario.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Quitar competidor",
      })
    );
    await waitFor(() => expect(empujar).toHaveBeenCalled());
    expect(detalle.mock.calls.length).toBe(antes);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("si el backend dice que es del repositorio (409), lo explica y no navega", async () => {
    const usuario = userEvent.setup();
    montarFalso(
      detalleDeCompetidor({ origen: "manual" }, [analisisDeCompetidor()]),
      {
        quitarCompetidor: async () => {
          throw new ErrorDeCliente(
            409,
            "Este competidor viene del repositorio y no se puede quitar desde aquí.",
            { codigo: "competidor_del_repositorio" }
          );
        },
      }
    );
    await usuario.click(await screen.findByRole("button", { name: "Quitar" }));
    await usuario.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Quitar competidor",
      })
    );
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "el sincronizador lo volvería a crear"
    );
    expect(empujar).not.toHaveBeenCalled();
  });
});

describe("Competidor · editar", () => {
  async function abrirEdicion(id = "demo-co-3") {
    const usuario = userEvent.setup();
    const cliente = montarDemo(id);
    await usuario.click(await screen.findByRole("button", { name: "Editar" }));
    return {
      usuario,
      cliente,
      dialogo: screen.getByRole("dialog", { name: "Editar competidor" }),
    };
  }

  it("abre con lo que hay: nombre, URL y notas, y enseña el dominio actual", async () => {
    const { dialogo } = await abrirEdicion();
    expect(within(dialogo).getByLabelText("Nombre")).toHaveValue(
      "Recepción Express (ejemplo)"
    );
    expect(within(dialogo).getByLabelText(/Dirección de partida/)).toHaveValue(
      "https://recepcion-express.example/"
    );
    expect(within(dialogo).getByLabelText(/Notas/)).toHaveValue(
      "Lo vi en un directorio de software para estética."
    );
    expect(dialogo).toHaveTextContent("recepcion-express.example");
  });

  it("guarda solo lo que cambiaste y la cabecera lo refleja", async () => {
    const { usuario, cliente, dialogo } = await abrirEdicion();
    const espia = vi.spyOn(cliente, "editarCompetidor");
    const nombre = within(dialogo).getByLabelText("Nombre");
    await usuario.clear(nombre);
    await usuario.type(nombre, "Express");
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Guardar" })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(espia).toHaveBeenCalledWith("demo-co-3", { nombre: "Express" });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Express" })
    ).toBeInTheDocument();
  });

  it("una URL de otro dominio avisa del nuevo dominio y manda cambiarDominio", async () => {
    const { usuario, cliente, dialogo } = await abrirEdicion();
    const espia = vi.spyOn(cliente, "editarCompetidor");
    const url = within(dialogo).getByLabelText(/Dirección de partida/);
    await usuario.clear(url);
    await usuario.type(url, "https://nuevo-dominio.example/es");
    expect(dialogo).toHaveTextContent("pasará a ser nuevo-dominio.example");
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Guardar" })
    );
    await waitFor(() =>
      expect(espia).toHaveBeenCalledWith("demo-co-3", {
        url: "https://nuevo-dominio.example/es",
        cambiarDominio: true,
      })
    );
  });

  it("vaciar la URL y las notas las borra (manda null)", async () => {
    const { usuario, cliente, dialogo } = await abrirEdicion();
    const espia = vi.spyOn(cliente, "editarCompetidor");
    await usuario.clear(within(dialogo).getByLabelText(/Dirección de partida/));
    await usuario.clear(within(dialogo).getByLabelText(/Notas/));
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Guardar" })
    );
    await waitFor(() =>
      expect(espia).toHaveBeenCalledWith("demo-co-3", {
        notas: null,
        url: null,
      })
    );
    expect(await screen.findByText("Sin dirección")).toBeInTheDocument();
  });

  it("sin cambios cierra sin llamar a nadie", async () => {
    const { usuario, cliente, dialogo } = await abrirEdicion();
    const espia = vi.spyOn(cliente, "editarCompetidor");
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Guardar" })
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(espia).not.toHaveBeenCalled();
  });

  it("un nombre vacío o una URL que no es http(s) tampoco salen", async () => {
    const { usuario, cliente, dialogo } = await abrirEdicion();
    const espia = vi.spyOn(cliente, "editarCompetidor");
    await usuario.clear(within(dialogo).getByLabelText("Nombre"));
    const url = within(dialogo).getByLabelText(/Dirección de partida/);
    await usuario.clear(url);
    await usuario.type(url, "javascript:alert(1)");
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Guardar" })
    );
    const alertas = await within(dialogo).findAllByRole("alert");
    expect(alertas.map((a) => a.textContent)).toEqual([
      "Escribe un nombre.",
      "Escribe una dirección web completa, que empiece por http:// o https://.",
    ]);
    expect(espia).not.toHaveBeenCalled();
  });

  it("si el backend rechaza la URL de otro dominio (400), lo enseña con qué hacer y deja lo escrito", async () => {
    const usuario = userEvent.setup();
    montarFalso(detalleDeCompetidor({}, [analisisDeCompetidor()]), {
      editarCompetidor: async () => {
        throw new ErrorDeCliente(
          400,
          "La URL es de otro dominio que rival.example. Si el competidor cambió de web, confirma el cambio de dominio.",
          { codigo: "url_de_otro_dominio" }
        );
      },
    });
    await usuario.click(await screen.findByRole("button", { name: "Editar" }));
    const dialogo = screen.getByRole("dialog");
    const nombre = within(dialogo).getByLabelText("Nombre");
    await usuario.clear(nombre);
    await usuario.type(nombre, "Otro nombre");
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Guardar" })
    );
    const aviso = await within(dialogo).findByRole("alert");
    expect(aviso).toHaveTextContent("es de otro dominio que rival.example");
    expect(aviso).toHaveTextContent("confirma el cambio de dominio al guardar");
    expect(within(dialogo).getByLabelText("Nombre")).toHaveValue("Otro nombre");
  });
});

describe("Competidor · un propuesto por el agente", () => {
  it("explica que no aplica reglas, enseña lo que dice el agente como texto de terceros y no tiene análisis", async () => {
    montarDemo("demo-co-4");
    const bloque = (
      await screen.findByRole("heading", { name: "Lo propone el agente" })
    ).closest("section") as HTMLElement;
    expect(bloque).toHaveTextContent(
      "no aplica ninguna regla ni cuenta como competidor"
    );
    expect(bloque).toHaveTextContent("texto de terceros");
    expect(bloque).toHaveTextContent(
      "Propuesto por el agente: sale en tres listas"
    );
    expect(screen.queryByRole("heading", { name: "Análisis" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Volver a analizar" })
    ).toBeNull();
  });

  it("aceptarlo lo pasa a «por analizar» y cambia lo que se ve", async () => {
    const usuario = userEvent.setup();
    montarDemo("demo-co-4");
    await usuario.click(await screen.findByRole("button", { name: /Aceptar/ }));
    expect(
      await screen.findByRole("heading", {
        name: "Todavía no lo ha leído el agente",
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Lo propone el agente" })
    ).toBeNull();
  });

  it("rechazarlo lo borra y vuelve a la lista", async () => {
    const usuario = userEvent.setup();
    const cliente = montarDemo("demo-co-4");
    await usuario.click(
      await screen.findByRole("button", { name: /Rechazar/ })
    );
    await usuario.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Rechazar",
      })
    );
    await waitFor(() => expect(empujar).toHaveBeenCalledWith("/competencia"));
    expect(
      (await cliente.competidores()).data.some((c) => c.id === "demo-co-4")
    ).toBe(false);
  });
});
