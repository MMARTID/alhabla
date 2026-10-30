import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { VistaDeHistorial } from "@/components/historial/vista-de-historial";
import {
  finDelDia,
  inicioDelDia,
} from "@/components/historial/filtros-de-historial";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { FiltrosDeDecisiones } from "@/lib/types";
import { clienteFalso } from "../helpers/cliente-falso";
import { decision, listaDeDecisiones } from "../helpers/d2-datos";
import { renderConCliente } from "../helpers/render";

const DECISIONES = [
  decision({ id: "d1", por: "ana@alhabla.ai", accion: "aprobar" }),
  decision({
    id: "d2",
    por: "agente:orquestador",
    accion: "investigar",
    borrador: null,
    oportunidad: {
      id: "op-2",
      titulo: "Asociación de peluqueros",
      dominio: "peluqueros.example",
      url: "https://peluqueros.example",
      estado: "investigada",
    },
  }),
  decision({
    id: "d3",
    por: "sistema",
    accion: "conocimiento_sincronizado",
    motivo: "commit 9f8e7d6: +2 ~1 -1",
    oportunidad: null,
    borrador: null,
  }),
];

/** Doce llamadas por pantalla: se mira la última que hizo la vista. */
function ultimosFiltros(cliente: ReturnType<typeof clienteFalso>) {
  const llamadas = cliente.listarDecisiones.mock.calls;
  return llamadas[llamadas.length - 1][0] as FiltrosDeDecisiones;
}

describe("Historial · decisiones", () => {
  it("enseña quién lo hizo en las tres formas: correo, agente y sistema", async () => {
    const cliente = clienteFalso({
      listarDecisiones: async () => listaDeDecisiones(DECISIONES),
    });
    renderConCliente(<VistaDeHistorial />, cliente);

    const lista = await screen.findByRole("list", { name: "Decisiones" });
    const filas = within(lista).getAllByRole("listitem");
    expect(filas).toHaveLength(3);
    expect(filas[0]).toHaveTextContent("ana@alhabla.ai");
    expect(filas[1]).toHaveTextContent("Agente (orquestador)");
    expect(filas[2]).toHaveTextContent("Sistema");
    // La acción se lee en castellano, no como el identificador.
    expect(filas[0]).toHaveTextContent("Aprobada");
    expect(filas[1]).toHaveTextContent("Investigada");
    expect(filas[2]).toHaveTextContent("Conocimiento sincronizado");
  });

  it("enlaza a la oportunidad dentro del panel y dice cuando no hay ninguna", async () => {
    const cliente = clienteFalso({
      listarDecisiones: async () => listaDeDecisiones(DECISIONES),
    });
    renderConCliente(<VistaDeHistorial />, cliente);

    const enlace = await screen.findByRole("link", {
      name: "Listado de recepcionistas de IA",
    });
    expect(enlace).toHaveAttribute("href", "/oportunidad/op-1");
    // Un enlace interno: no se abre fuera ni lleva rel de enlace externo.
    expect(enlace).not.toHaveAttribute("target");
    expect(screen.getByText("No cuelga de ninguna oportunidad.")).toBeVisible();
  });

  it("pinta el título, el dominio y el motivo como texto, nunca como HTML", async () => {
    const cliente = clienteFalso({
      listarDecisiones: async () =>
        listaDeDecisiones([
          decision({
            motivo: '<img src="x" onerror="alert(1)"> y <b>negrita</b>',
            oportunidad: {
              id: "op-1",
              titulo: "<script>alert(1)</script>Título raro",
              dominio: "<i>dominio</i>",
              url: "https://x.example",
              estado: "aprobada",
            },
          }),
        ]),
    });
    const { container } = renderConCliente(<VistaDeHistorial />, cliente);

    expect(await screen.findByText(/Título raro/)).toBeInTheDocument();
    expect(container.querySelector("img, script, b, i")).toBeNull();
    expect(
      screen.getByText('<img src="x" onerror="alert(1)"> y <b>negrita</b>')
    ).toBeInTheDocument();
  });

  it("pagina de 20 en 20, con «1–20 de 45», y vuelve a pedir la página que toca", async () => {
    const filas = Array.from({ length: 20 }, (_, i) =>
      decision({ id: `d-${i}`, motivo: `motivo ${i}` })
    );
    const cliente = clienteFalso({
      listarDecisiones: async (filtros) =>
        listaDeDecisiones(filas, { total: 45, pagina: filtros?.pagina ?? 1 }),
    });
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeHistorial />, cliente);

    expect(await screen.findByText("1–20 de 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anterior/ })).toBeDisabled();
    expect(ultimosFiltros(cliente)).toMatchObject({ pagina: 1, limite: 20 });

    await usuario.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(await screen.findByText("21–40 de 45")).toBeInTheDocument();
    expect(ultimosFiltros(cliente)).toMatchObject({ pagina: 2, limite: 20 });

    await usuario.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(await screen.findByText("41–45 de 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Siguiente/ })).toBeDisabled();
  });

  it("al cambiar un filtro vuelve a la primera página", async () => {
    const filas = Array.from({ length: 20 }, (_, i) =>
      decision({ id: `d-${i}` })
    );
    const cliente = clienteFalso({
      listarDecisiones: async (filtros) =>
        listaDeDecisiones(filas, { total: 45, pagina: filtros?.pagina ?? 1 }),
    });
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeHistorial />, cliente);

    await screen.findByText("1–20 de 45");
    await usuario.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByText("21–40 de 45");

    await usuario.selectOptions(screen.getByLabelText("Acción"), "aprobar");
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({
        accion: "aprobar",
        pagina: 1,
      })
    );
  });

  it("ofrece las acciones que hay en el registro, con su cuenta", async () => {
    const cliente = clienteFalso({
      listarDecisiones: async () => listaDeDecisiones(DECISIONES),
    });
    renderConCliente(<VistaDeHistorial />, cliente);

    await screen.findByRole("list", { name: "Decisiones" });
    const selector = screen.getByLabelText("Acción");
    const opciones = within(selector)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opciones).toEqual([
      "Todas las acciones",
      "Ajustes cambiados (2)",
      "Aprobada (3)",
      "Devuelta (1)",
    ]);
  });

  it("filtra por fechas con el día entero y por «solo sistema»", async () => {
    const cliente = clienteFalso({
      listarDecisiones: async () => listaDeDecisiones(DECISIONES),
    });
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeHistorial />, cliente);
    await screen.findByRole("list", { name: "Decisiones" });

    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: "2026-10-05" },
    });
    await usuario.click(
      screen.getByRole("checkbox", {
        name: /Solo ajustes y tareas del sistema/,
      })
    );

    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({
        fechaDesde: new Date(2026, 9, 1, 0, 0, 0, 0).toISOString(),
        // El backend filtra con <=: el «hasta» tiene que llegar al final del día.
        fechaHasta: new Date(2026, 9, 5, 23, 59, 59, 999).toISOString(),
        soloSistema: true,
        pagina: 1,
      })
    );
  });

  it("si «desde» cae después de «hasta» avisa y no manda ninguna de las dos fechas", async () => {
    const cliente = clienteFalso({
      listarDecisiones: async () => listaDeDecisiones(DECISIONES),
    });
    renderConCliente(<VistaDeHistorial />, cliente);
    await screen.findByRole("list", { name: "Decisiones" });

    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-10-20" },
    });
    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: "2026-10-05" },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "«Desde» es posterior a «Hasta»"
    );
    expect(screen.getByLabelText("Desde")).toBeInvalid();
    expect(screen.getByLabelText("Hasta")).toBeInvalid();
    // Ninguna petición lleva el rango imposible: ni entero ni a medias.
    const rangosPedidos = cliente.listarDecisiones.mock.calls.filter(
      ([filtros]) => filtros?.fechaDesde && filtros?.fechaHasta
    );
    expect(rangosPedidos).toHaveLength(0);
  });

  it("«Quitar filtros» lo deja todo como estaba", async () => {
    const cliente = clienteFalso({
      listarDecisiones: async () => listaDeDecisiones(DECISIONES),
    });
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeHistorial />, cliente);
    await screen.findByRole("list", { name: "Decisiones" });
    expect(
      screen.queryByRole("button", { name: "Quitar filtros" })
    ).not.toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText("Acción"), "aprobar");
    await usuario.click(
      screen.getByRole("checkbox", {
        name: /Solo ajustes y tareas del sistema/,
      })
    );
    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-10-01" },
    });
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({
        accion: "aprobar",
        soloSistema: true,
      })
    );

    await usuario.click(screen.getByRole("button", { name: "Quitar filtros" }));

    expect(screen.getByLabelText("Acción")).toHaveValue("");
    expect(screen.getByLabelText("Desde")).toHaveValue("");
    expect(
      screen.getByRole("checkbox", {
        name: /Solo ajustes y tareas del sistema/,
      })
    ).not.toBeChecked();
    expect(
      screen.queryByRole("button", { name: "Quitar filtros" })
    ).not.toBeInTheDocument();
  });

  it("sin decisiones lo dice con honestidad; con filtros, distingue «no hay» de «no coincide»", async () => {
    const cliente = clienteFalso({
      listarDecisiones: async () =>
        listaDeDecisiones([], { conteos: { porAccion: {} } }),
    });
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeHistorial />, cliente);

    expect(
      await screen.findByText("Todavía no hay decisiones")
    ).toBeInTheDocument();

    await usuario.click(
      screen.getByRole("checkbox", {
        name: /Solo ajustes y tareas del sistema/,
      })
    );
    expect(
      await screen.findByText("Ninguna decisión coincide con estos filtros")
    ).toBeInTheDocument();
  });

  it("si falla la carga dice por qué y deja reintentar", async () => {
    let intento = 0;
    const cliente = clienteFalso({
      listarDecisiones: async () => {
        intento += 1;
        if (intento === 1) throw new ErrorDeCliente(403, "No tienes acceso.");
        return listaDeDecisiones(DECISIONES);
      },
    });
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeHistorial />, cliente);

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent(
      "No se pudo cargar el historial de decisiones"
    );
    expect(aviso).toHaveTextContent("No tienes acceso.");

    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("list", { name: "Decisiones" })
    ).toBeInTheDocument();
  });
});

describe("filtros del Historial: fechas", () => {
  it("el día empieza a las 00:00 y acaba a las 23:59:59.999 de la zona del navegador", () => {
    expect(inicioDelDia("2026-10-30")).toBe(
      new Date(2026, 9, 30, 0, 0, 0, 0).toISOString()
    );
    expect(finDelDia("2026-10-30")).toBe(
      new Date(2026, 9, 30, 23, 59, 59, 999).toISOString()
    );
  });

  it.each(["", "30/10/2026", "2026-13-01", "2026-02-31", "ayer"])(
    "%j no es un día válido",
    (texto) => {
      expect(inicioDelDia(texto)).toBeUndefined();
      expect(finDelDia(texto)).toBeUndefined();
    }
  );
});
