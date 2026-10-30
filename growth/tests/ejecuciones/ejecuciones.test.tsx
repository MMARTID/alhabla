import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { VistaDeEjecuciones } from "@/components/ejecuciones/vista-de-ejecuciones";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { FiltrosDeEjecuciones } from "@/lib/types";
import { clienteFalso } from "../helpers/cliente-falso";
import {
  detalleDeEjecucion,
  ejecucion,
  hace,
  listaDeEjecuciones,
} from "../helpers/d2-datos";
import { renderConCliente } from "../helpers/render";
import ejecucionAbierta from "../fixtures/ejecucion-real-188.json";
import ejecucionCerrada from "../fixtures/ejecucion-real-199.json";

function ultimosFiltros(cliente: ReturnType<typeof clienteFalso>) {
  const llamadas = cliente.listarEjecuciones.mock.calls;
  return llamadas[llamadas.length - 1][0] as FiltrosDeEjecuciones;
}

function renderizar(
  ejecuciones = [ejecucion()],
  extra: Parameters<typeof clienteFalso>[0] = {}
) {
  const cliente = clienteFalso({
    listarEjecuciones: async () => listaDeEjecuciones(ejecuciones),
    ...extra,
  });
  renderConCliente(<VistaDeEjecuciones />, cliente);
  return cliente;
}

describe("Ejecuciones · lista", () => {
  it("sin ninguna ejecución dice «Aún no hay ejecuciones», sin inventar nada", async () => {
    renderizar([]);
    expect(
      await screen.findByText("Aún no hay ejecuciones")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Ejecuciones" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cada ejecución enseña estado, duración, versión de prompts y su resumen", async () => {
    renderizar([ejecucion()]);

    const fila = within(
      await screen.findByRole("list", { name: "Ejecuciones" })
    ).getByRole("listitem");
    expect(fila).toHaveTextContent("Programada");
    expect(fila).toHaveTextContent("Correcta");
    expect(fila).toHaveTextContent("1 h");
    expect(fila).toHaveTextContent("23 oportunidades");
    expect(fila).toHaveTextContent("prompts 9f8e7d6");
    expect(fila).toHaveTextContent(
      "23 candidatas · 6 calificadas · 17 descartadas · 4 borradores · 1 bloqueada"
    );
  });

  it("una ejecución con error enseña el error en la fila", async () => {
    renderizar([
      ejecucion({
        estado: "error",
        resumen: null,
        error: "Falló el módulo de descubrimiento.",
      }),
    ]);
    const fila = await screen.findByRole("listitem");
    expect(fila).toHaveTextContent("Con error");
    expect(fila).toHaveTextContent("Falló el módulo de descubrimiento.");
  });

  it("una ejecución en curso no inventa una duración", async () => {
    renderizar([
      ejecucion({
        estado: "en_curso",
        inicio: hace(1),
        fin: null,
        duracionSegundos: null,
        resumen: null,
      }),
    ]);
    const fila = await screen.findByRole("listitem");
    expect(fila).toHaveTextContent("En curso");
    expect(fila).toHaveTextContent("En curso desde hace 1 h");
    expect(fila).not.toHaveTextContent("Lleva más de 6 h");
  });

  it("una en curso desde hace más de 6 h se avisa como interrumpida", async () => {
    renderizar([
      ejecucion({
        estado: "en_curso",
        inicio: hace(7),
        fin: null,
        duracionSegundos: null,
        resumen: null,
      }),
    ]);
    expect(
      await screen.findByText(/Lleva más de 6 h en curso/)
    ).toBeInTheDocument();
  });

  it("un resumen con datos raros no tumba la lista", async () => {
    renderizar([
      ejecucion({
        resumen: {
          candidatas: "muchas" as unknown as number,
          calificadas: Number.NaN,
          borradores: 2,
        },
      }),
    ]);
    const fila = await screen.findByRole("listitem");
    expect(fila).toHaveTextContent("2 borradores");
    expect(fila).not.toHaveTextContent("muchas");
  });

  it("filtra por estado y por cómo se lanzó, y vuelve a la primera página", async () => {
    const cliente = renderizar([ejecucion()]);
    const usuario = userEvent.setup();
    await screen.findByRole("list", { name: "Ejecuciones" });

    await usuario.selectOptions(screen.getByLabelText("Estado"), "error");
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({
        estado: "error",
        pagina: 1,
      })
    );
    await usuario.selectOptions(
      screen.getByLabelText("Cómo se lanzó"),
      "manual"
    );
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({
        estado: "error",
        disparador: "manual",
      })
    );
    expect(
      await screen.findByRole("button", { name: "Quitar filtros" })
    ).toBeInTheDocument();
  });

  it("con filtros y sin resultados, no confunde «no hay» con «no coincide»", async () => {
    const cliente = clienteFalso({
      listarEjecuciones: async (filtros) =>
        listaDeEjecuciones(filtros?.estado ? [] : [ejecucion()]),
    });
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeEjecuciones />, cliente);
    await screen.findByRole("list", { name: "Ejecuciones" });

    await usuario.selectOptions(screen.getByLabelText("Estado"), "parcial");
    expect(
      await screen.findByText("Ninguna ejecución coincide con estos filtros")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Aún no hay ejecuciones")
    ).not.toBeInTheDocument();
  });

  it("pagina de 20 en 20", async () => {
    const filas = Array.from({ length: 20 }, (_, i) =>
      ejecucion({ id: `ej-${i}` })
    );
    const cliente = clienteFalso({
      listarEjecuciones: async (filtros) =>
        listaDeEjecuciones(filas, { total: 27, pagina: filtros?.pagina ?? 1 }),
    });
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeEjecuciones />, cliente);

    expect(await screen.findByText("1–20 de 27")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(await screen.findByText("21–27 de 27")).toBeInTheDocument();
    expect(ultimosFiltros(cliente)).toMatchObject({ pagina: 2, limite: 20 });
  });

  it("si no carga, lo dice y deja reintentar", async () => {
    let intento = 0;
    const cliente = clienteFalso({
      listarEjecuciones: async () => {
        intento += 1;
        if (intento === 1) throw new ErrorDeCliente(500, "Fallo del servidor.");
        return listaDeEjecuciones([ejecucion()]);
      },
    });
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeEjecuciones />, cliente);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron cargar las ejecuciones"
    );
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("list", { name: "Ejecuciones" })
    ).toBeInTheDocument();
  });
});

describe("Ejecuciones · detalle", () => {
  it("se pide al abrirla, no antes", async () => {
    const cliente = renderizar([ejecucion()], {
      detalleDeEjecucion: async () => detalleDeEjecucion(),
    });
    const usuario = userEvent.setup();
    const fila = await screen.findByRole("listitem");
    expect(cliente.detalleDeEjecucion).not.toHaveBeenCalled();

    const boton = within(fila).getByRole("button", { expanded: false });
    await usuario.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    await within(fila).findByText("Módulos");
    expect(cliente.detalleDeEjecucion).toHaveBeenCalledWith("ej-1");
  });

  it("enseña los módulos con su estado, su duración, sus notas y su error", async () => {
    renderizar([ejecucion()], {
      detalleDeEjecucion: async () => detalleDeEjecucion(),
    });
    const usuario = userEvent.setup();
    await usuario.click(
      within(await screen.findByRole("listitem")).getByRole("button")
    );

    const modulos = (await screen.findByText("Módulos")).closest(
      "section"
    ) as HTMLElement;
    const filas = within(modulos).getAllByRole("listitem");
    expect(filas).toHaveLength(3);
    expect(filas[0]).toHaveTextContent("Descubrimiento");
    expect(filas[0]).toHaveTextContent("Correcto");
    expect(filas[1]).toHaveTextContent("Investigación");
    expect(filas[1]).toHaveTextContent("Parcial");
    expect(filas[1]).toHaveTextContent("5 min 30 s");
    expect(filas[1]).toHaveTextContent("Dos páginas no cargaron.");
    expect(filas[2]).toHaveTextContent("Cumplimiento");
    expect(filas[2]).toHaveTextContent("Con error");
    expect(filas[2]).toHaveTextContent("El revisor no respondió.");
  });

  it("enseña el error de la ejecución entera", async () => {
    renderizar(
      [ejecucion({ estado: "error", error: "Sin cerrar tras 6 h." })],
      {
        detalleDeEjecucion: async () =>
          detalleDeEjecucion({
            estado: "error",
            error: "Sin cerrar tras 6 h.",
          }),
      }
    );
    const usuario = userEvent.setup();
    await usuario.click(
      within(await screen.findByRole("listitem")).getByRole("button")
    );
    expect(
      await screen.findByText("Error de la ejecución")
    ).toBeInTheDocument();
    expect(screen.getAllByText("Sin cerrar tras 6 h.").length).toBeGreaterThan(
      0
    );
  });

  it("separa lo que cuenta el servidor, con el porcentaje de cada descarte", async () => {
    renderizar([ejecucion()], {
      detalleDeEjecucion: async () => detalleDeEjecucion(),
    });
    const usuario = userEvent.setup();
    await usuario.click(
      within(await screen.findByRole("listitem")).getByRole("button")
    );

    const servidor = (
      await screen.findByText("Lo que cuenta el servidor")
    ).closest("section") as HTMLElement;
    const estados = within(servidor).getByRole("list", {
      name: "Oportunidades por estado",
    });
    expect(estados).toHaveTextContent("17 Descartada");
    expect(estados).toHaveTextContent("5 Por revisar");
    expect(servidor).toHaveTextContent("22 oportunidades en total.");
    // 10 de 17 descartes, 5 de 17, 2 de 17.
    expect(servidor).toHaveTextContent("Irrelevante10 · 59 %");
    expect(servidor).toHaveTextContent("Bajo el umbral de puntuación5 · 29 %");
    expect(servidor).toHaveTextContent("Otro idioma2 · 12 %");
  });

  it("enseña el recuento de borradores que añade el servidor", async () => {
    renderizar([ejecucion()], {
      detalleDeEjecucion: async () =>
        ({ ...detalleDeEjecucion(), borradores: 4 }) as ReturnType<
          typeof detalleDeEjecucion
        >,
    });
    const usuario = userEvent.setup();
    await usuario.click(
      within(await screen.findByRole("listitem")).getByRole("button")
    );
    const estados = await screen.findByRole("list", {
      name: "Oportunidades por estado",
    });
    expect(estados).toHaveTextContent("4 borradores");
  });

  it("compara lo que declaró el agente con lo que midió el servidor", async () => {
    renderizar([ejecucion()], {
      detalleDeEjecucion: async () =>
        detalleDeEjecucion({
          resumen: {
            candidatas: 22,
            calificadas: 5,
            declaradoPorElAgente: { candidatas: 30, calificadas: 5 },
          } as never,
        }),
    });
    const usuario = userEvent.setup();
    await usuario.click(
      within(await screen.findByRole("listitem")).getByRole("button")
    );

    const declarado = (
      await screen.findByText("Lo que declaró el agente")
    ).closest("section") as HTMLElement;
    const filas = within(declarado).getAllByRole("listitem");
    expect(filas[0]).toHaveTextContent("30 candidatas");
    expect(filas[0]).toHaveTextContent("el servidor midió 22");
    // Lo que coincide no se marca.
    expect(filas[1]).toHaveTextContent("5 calificadas");
    expect(filas[1]).not.toHaveTextContent("el servidor midió");
  });

  it("una ejecución real abierta enseña su módulo «En curso» (no «Sin estado»)", async () => {
    renderizar([ejecucion({ estado: "en_curso", fin: null })], {
      detalleDeEjecucion: async () =>
        ejecucionAbierta as unknown as ReturnType<typeof detalleDeEjecucion>,
    });
    const usuario = userEvent.setup();
    await usuario.click(
      within(await screen.findByRole("listitem")).getByRole("button")
    );
    const modulos = (await screen.findByText("Módulos")).closest(
      "section"
    ) as HTMLElement;
    const filas = within(modulos).getAllByRole("listitem");
    expect(filas).toHaveLength(1);
    expect(filas[0]).toHaveTextContent("Descubrimiento");
    expect(filas[0]).toHaveTextContent("En curso");
    expect(filas[0]).not.toHaveTextContent("Sin estado");
  });

  it("un módulo con un estado desconocido se enseña como «Sin estado»", async () => {
    renderizar([ejecucion()], {
      detalleDeEjecucion: async () =>
        detalleDeEjecucion({
          modulos: { discovery: { estado: "pausado" } } as never,
        }),
    });
    const usuario = userEvent.setup();
    await usuario.click(
      within(await screen.findByRole("listitem")).getByRole("button")
    );
    const modulos = (await screen.findByText("Módulos")).closest(
      "section"
    ) as HTMLElement;
    expect(modulos).toHaveTextContent("Sin estado");
  });

  it("una ejecución real cerrada, con `declaradoPorElAgente` anidado, se pinta sin romper y compara lo declarado", async () => {
    renderizar([ejecucion({ estado: "parcial" })], {
      detalleDeEjecucion: async () =>
        ejecucionCerrada as unknown as ReturnType<typeof detalleDeEjecucion>,
    });
    const usuario = userEvent.setup();
    await usuario.click(
      within(await screen.findByRole("listitem")).getByRole("button")
    );
    const declarado = (
      await screen.findByText("Lo que declaró el agente")
    ).closest("section") as HTMLElement;
    const filas = within(declarado).getAllByRole("listitem");
    expect(filas[0]).toHaveTextContent("8 candidatas");
    expect(filas[0]).toHaveTextContent("el servidor midió 7");
    // Lo anidado (descartesPorMotivo) no aparece como una fila rara.
    expect(declarado).not.toHaveTextContent("[object Object]");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lista las oportunidades de la ejecución con enlace interno y su motivo de descarte", async () => {
    renderizar([ejecucion()], {
      detalleDeEjecucion: async () => detalleDeEjecucion(),
    });
    const usuario = userEvent.setup();
    await usuario.click(
      within(await screen.findByRole("listitem")).getByRole("button")
    );

    const enlace = await screen.findByRole("link", {
      name: "Foro de bricolaje",
    });
    expect(enlace).toHaveAttribute("href", "/oportunidad/op-10");
    expect(enlace.closest("li")).toHaveTextContent("Irrelevante");
    expect(enlace.closest("li")).toHaveTextContent("Descartada");
  });

  it("módulos y resumen con formas imposibles se leen sin romper nada", async () => {
    renderizar([ejecucion()], {
      detalleDeEjecucion: async () =>
        detalleDeEjecucion({
          modulos: {
            constructor: { estado: "ok" },
            raro: "texto suelto",
            otro: 42,
            nulo: null,
            sin_estado: { estado: "inventado", error: { a: 1 }, notas: 7 },
          } as never,
          resumen: {
            descartesPorMotivo: [1, 2],
            notas: { a: 1 },
            declaradoPorElAgente: "mucho",
          } as never,
        }),
    });
    const usuario = userEvent.setup();
    await usuario.click(
      within(await screen.findByRole("listitem")).getByRole("button")
    );

    const modulos = (await screen.findByText("Módulos")).closest(
      "section"
    ) as HTMLElement;
    const filas = within(modulos).getAllByRole("listitem");
    expect(filas).toHaveLength(5);
    // Una clave heredada del prototipo no se confunde con una etiqueta.
    expect(filas[0]).toHaveTextContent("Constructor");
    expect(filas[0]).toHaveTextContent("Correcto");
    expect(filas[4]).toHaveTextContent("Sin estado");
    expect(
      screen.queryByText("Lo que declaró el agente")
    ).not.toBeInTheDocument();
  });

  it("pinta los textos del agente como texto", async () => {
    const { container } = (() => {
      const cliente = clienteFalso({
        listarEjecuciones: async () => listaDeEjecuciones([ejecucion()]),
        detalleDeEjecucion: async () =>
          detalleDeEjecucion({
            modulos: {
              discovery: {
                estado: "error",
                error: '<img src=x onerror="alert(1)">',
                notas: "<script>alert(2)</script>",
              },
            },
            oportunidades: [
              {
                id: "op-x",
                titulo: "<b>negrita</b>",
                dominio: "x.example",
                estado: "descartada",
                objetivoPrincipal: "BACKLINKS",
                codigoDescarte: null,
              },
            ],
          }),
      });
      return {
        container: renderConCliente(<VistaDeEjecuciones />, cliente).container,
      };
    })();
    const usuario = userEvent.setup();
    await usuario.click(
      within(await screen.findByRole("listitem")).getByRole("button")
    );
    await screen.findByText('<img src=x onerror="alert(1)">');
    expect(container.querySelector("img, script, b")).toBeNull();
  });

  it("si el detalle falla lo dice dentro de la fila y la lista sigue en pie", async () => {
    renderizar([ejecucion()], {
      detalleDeEjecucion: async () => {
        throw new ErrorDeCliente(404, "La ejecución no existe.");
      },
    });
    const usuario = userEvent.setup();
    await usuario.click(
      within(await screen.findByRole("listitem")).getByRole("button")
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La ejecución no existe."
    );
    expect(
      screen.getByRole("list", { name: "Ejecuciones" })
    ).toBeInTheDocument();
  });
});
