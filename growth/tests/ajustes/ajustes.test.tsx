import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VistaDeAjustes } from "@/components/ajustes/vista-de-ajustes";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { Ajustes, CambiosDeAjustes } from "@/lib/types";
import { clienteFalso } from "../helpers/cliente-falso";
import { ajustes as crearAjustes, competidor } from "../helpers/d2-datos";
import { renderConCliente } from "../helpers/render";

/** Aplica un PUT como lo haría el backend: solo toca las claves que vienen. */
function aplicar(actual: Ajustes, cambios: CambiosDeAjustes): Ajustes {
  return {
    ...actual,
    valores: {
      ...actual.valores,
      ...cambios,
      umbralesPorObjetivo: {
        ...actual.valores.umbralesPorObjetivo,
        ...cambios.umbralesPorObjetivo,
      },
    },
    actualizadoEn: {
      ...actual.actualizadoEn,
      ...Object.fromEntries(
        Object.keys(cambios).map((c) => [c, new Date().toISOString()])
      ),
    },
  };
}

/** Un backend de ajustes en memoria: GET devuelve lo último que guardó el PUT. */
function montar(
  inicial: Ajustes = crearAjustes(),
  extra: Parameters<typeof clienteFalso>[0] = {}
) {
  let actual = inicial;
  const cliente = clienteFalso({
    ajustes: async () => actual,
    guardarAjustes: async (cambios) => {
      actual = aplicar(actual, cambios);
      return actual;
    },
    competidores: async () => ({ data: [competidor()] }),
    ...extra,
  });
  renderConCliente(<VistaDeAjustes />, cliente);
  return cliente;
}

const campo = (nombre: string) => screen.getByLabelText(nombre);

async function escribir(
  usuario: ReturnType<typeof userEvent.setup>,
  nombre: string,
  texto: string
) {
  const entrada = campo(nombre);
  await usuario.clear(entrada);
  if (texto !== "") await usuario.type(entrada, texto);
}

describe("Ajustes · lectura", () => {
  it("enseña los valores guardados, lo fijo y el resumen de la competencia", async () => {
    montar(crearAjustes(), {
      competidores: async () => ({
        data: [
          competidor({ id: "a", estado: "propuesto", origen: "agente" }),
          competidor({ id: "b", estado: "por_analizar" }),
          competidor({
            id: "c",
            estado: "analizado",
            analisis: {
              id: "an-1",
              version: 2,
              creadoEn: "2026-10-01T09:00:00.000Z",
              revisadoEn: null,
              numDatos: 4,
              caducado: false,
            },
          }),
          competidor({
            id: "d",
            estado: "revisado",
            analisis: {
              id: "an-2",
              version: 1,
              creadoEn: "2026-05-01T09:00:00.000Z",
              revisadoEn: "2026-05-02T09:00:00.000Z",
              numDatos: 3,
              caducado: true,
            },
          }),
        ],
      }),
    });

    expect(await screen.findByLabelText("Contactos por semana")).toHaveValue(
      "5"
    );
    expect(campo("Parecido que bloquea")).toHaveValue("60");
    expect(campo("A · Tráfico y marca")).toHaveValue("60");
    expect(campo("B · Clientes potenciales")).toHaveValue("60");
    expect(campo("C · Backlinks")).toHaveValue("60");

    const fijo = screen
      .getByRole("heading", { name: "Fijo, solo lectura" })
      .closest("section") as HTMLElement;
    expect(fijo).toHaveTextContent("180 días");
    expect(fijo).toHaveTextContent("90 días");

    const competencia = (
      await screen.findByRole("heading", { name: "Competencia" })
    ).closest("section") as HTMLElement;
    const cifra = (nombre: string) =>
      within(competencia).getByText(nombre).nextElementSibling;
    await waitFor(() => expect(cifra("Competidores")).toHaveTextContent("4"));
    expect(cifra("Propuestos por el agente, sin aceptar")).toHaveTextContent(
      "1"
    );
    expect(cifra("Por analizar")).toHaveTextContent("1");
    expect(cifra("Análisis pendientes de revisión")).toHaveTextContent("1");
    expect(cifra("Con el análisis caducado")).toHaveTextContent("1");
    expect(
      within(competencia).getByRole("link", {
        name: /Gestionar la competencia/,
      })
    ).toHaveAttribute("href", "/competencia");
    // Ya no es una lista de solo lectura: ni nombres ni dominios.
    expect(screen.queryByText("competidor-ficticio.example")).toBeNull();
  });

  it("las claves sistema.* se enseñan pero no se pueden editar", async () => {
    montar(
      crearAjustes({
        actualizadoEn: {
          topeSemanal: null,
          umbralDeSimilitud: null,
          umbralesPorObjetivo: null,
          pausa: null,
          "sistema.conocimiento": new Date(
            Date.now() - 3_600_000
          ).toISOString(),
        },
      })
    );

    const fijo = (
      await screen.findByRole("heading", { name: "Fijo, solo lectura" })
    ).closest("section") as HTMLElement;
    expect(fijo).toHaveTextContent("Sincronización del conocimiento");
    expect(fijo).toHaveTextContent("sistema.conocimiento");
    expect(fijo).toHaveTextContent("Actualizado hace 1 h");
    // Ni una entrada ni un botón: solo texto.
    expect(within(fijo).queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(fijo).queryByRole("button")).not.toBeInTheDocument();
    expect(within(fijo).queryByRole("switch")).not.toBeInTheDocument();
    // Las únicas entradas editables son las cinco del formulario.
    expect(screen.getAllByRole("textbox").map((e) => e.id)).toHaveLength(5);
    expect(screen.queryByLabelText(/sistema/i)).not.toBeInTheDocument();
  });

  it("una clave sistema.* desconocida sale como «Valor del sistema»", async () => {
    montar(
      crearAjustes({
        actualizadoEn: {
          topeSemanal: null,
          umbralDeSimilitud: null,
          umbralesPorObjetivo: null,
          pausa: null,
          "sistema.otra": null,
        },
      })
    );
    const fijo = (
      await screen.findByRole("heading", { name: "Fijo, solo lectura" })
    ).closest("section") as HTMLElement;
    expect(fijo).toHaveTextContent("Valor del sistema");
    expect(fijo).toHaveTextContent("Sin actualizar");
  });

  it("sin competidores lo dice, y por qué importa", async () => {
    montar(crearAjustes(), { competidores: async () => ({ data: [] }) });
    expect(
      await screen.findByText("Todavía no hay competidores")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /la regla de comparativas con fuente no tiene con qué comparar/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ir a Competencia/ })
    ).toHaveAttribute("href", "/competencia");
  });

  it("el resumen no pinta ni nombres ni notas de competidores: solo cifras y un enlace a su vista", async () => {
    const cliente = clienteFalso({
      ajustes: async () => crearAjustes(),
      competidores: async () => ({
        data: [
          competidor({
            nombre: "<b>Rival</b>",
            dominio: "javascript:alert(1)",
            notas: "<img src=x onerror=alert(1)>",
          }),
        ],
      }),
    });
    const { container } = renderConCliente(<VistaDeAjustes />, cliente);
    await screen.findByText("Gestionar la competencia");
    expect(screen.queryByText("<b>Rival</b>")).toBeNull();
    expect(container.querySelector("img, b")).toBeNull();
    // El único enlace del resumen es el de la vista de Competencia.
    const enlaces = container.querySelectorAll("a");
    expect([...enlaces].map((a) => a.getAttribute("href"))).toEqual([
      "/competencia",
    ]);
  });

  it("si los competidores fallan, los ajustes siguen a la vista", async () => {
    montar(crearAjustes(), {
      competidores: async () => {
        throw new ErrorDeCliente(500, "Fallo.");
      },
    });
    expect(await screen.findByLabelText("Contactos por semana")).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron cargar los competidores"
    );
  });

  it("si los ajustes no cargan, lo dice y deja reintentar", async () => {
    let intento = 0;
    const cliente = clienteFalso({
      ajustes: async () => {
        intento += 1;
        if (intento === 1)
          throw new ErrorDeCliente(503, "Growth no está configurado.");
        return crearAjustes();
      },
      competidores: async () => ({ data: [] }),
    });
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeAjustes />, cliente);

    const aviso = await screen.findByText("No se pudieron cargar los ajustes");
    expect(aviso.closest('[role="alert"]')).toHaveTextContent(
      "Growth no está configurado."
    );
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByLabelText("Contactos por semana")).toBeVisible();
  });
});

describe("Ajustes · pausa", () => {
  it("pausar pide confirmación y avisa de lo que hace; no guarda hasta confirmar", async () => {
    const cliente = montar();
    const usuario = userEvent.setup();
    const interruptor = await screen.findByRole("switch", {
      name: "Pausar el agente",
    });
    expect(interruptor).toHaveAttribute("aria-checked", "false");

    await usuario.click(interruptor);

    const dialogo = screen.getByRole("alertdialog", {
      name: "¿Pausar el agente?",
    });
    expect(dialogo).toHaveTextContent(
      "el backend rechaza cualquier escritura del agente"
    );
    expect(dialogo).toHaveTextContent("añadir oportunidades");
    expect(dialogo).toHaveTextContent("redactar borradores");
    expect(dialogo).toHaveTextContent("abrir ejecuciones");
    expect(dialogo).toHaveTextContent("sincronizar el conocimiento");
    expect(dialogo).toHaveTextContent("guardar investigaciones");
    // Lo que sí puede: leer y cerrar una ejecución que ya estaba abierta.
    expect(dialogo).toHaveTextContent("cerrar una ejecución");
    expect(dialogo).toHaveTextContent("Tú puedes seguir revisando");
    expect(dialogo).toHaveTextContent("Historial");
    // Todavía no ha pasado nada.
    expect(cliente.guardarAjustes).not.toHaveBeenCalled();
    expect(interruptor).toHaveAttribute("aria-checked", "false");
  });

  it("cancelar deja todo como estaba", async () => {
    const cliente = montar();
    const usuario = userEvent.setup();
    const interruptor = await screen.findByRole("switch");
    await usuario.click(interruptor);
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(cliente.guardarAjustes).not.toHaveBeenCalled();
    expect(interruptor).toHaveAttribute("aria-checked", "false");
    expect(interruptor).toHaveFocus();
  });

  it("Escape también cancela", async () => {
    const cliente = montar();
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole("switch"));
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(cliente.guardarAjustes).not.toHaveBeenCalled();
  });

  it("al confirmar guarda solo la pausa y el interruptor refleja lo que guardó el backend", async () => {
    const cliente = montar();
    const usuario = userEvent.setup();
    const interruptor = await screen.findByRole("switch");
    await usuario.click(interruptor);
    await usuario.click(screen.getByRole("button", { name: "Pausar" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(cliente.guardarAjustes).toHaveBeenCalledTimes(1);
    expect(cliente.guardarAjustes).toHaveBeenCalledWith({ pausa: true });
    await waitFor(() =>
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true")
    );
    expect(
      screen.getByText("En pausa: el agente no puede escribir")
    ).toBeInTheDocument();
  });

  it("reanudar también pide confirmación, con su propio texto", async () => {
    const cliente = montar(
      crearAjustes({
        valores: { ...crearAjustes().valores, pausa: true },
        actualizadoEn: {
          topeSemanal: null,
          umbralDeSimilitud: null,
          umbralesPorObjetivo: null,
          pausa: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        },
      })
    );
    const usuario = userEvent.setup();
    const interruptor = await screen.findByRole("switch");
    expect(interruptor).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Último cambio hace 2 días.")).toBeInTheDocument();

    await usuario.click(interruptor);
    const dialogo = screen.getByRole("alertdialog", {
      name: "¿Reanudar el agente?",
    });
    expect(dialogo).toHaveTextContent("El agente volverá a poder escribir");
    expect(cliente.guardarAjustes).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole("button", { name: "Reanudar" }));
    await waitFor(() =>
      expect(cliente.guardarAjustes).toHaveBeenCalledWith({ pausa: false })
    );
    await waitFor(() =>
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-checked",
        "false"
      )
    );
  });

  it("si falla al guardar, el diálogo sigue abierto con el motivo y la pausa no cambia", async () => {
    const cliente = montar(crearAjustes(), {
      guardarAjustes: async () => {
        throw new ErrorDeCliente(409, "Otro cambio se guardó antes.");
      },
    });
    const usuario = userEvent.setup();
    const interruptor = await screen.findByRole("switch");
    await usuario.click(interruptor);
    await usuario.click(screen.getByRole("button", { name: "Pausar" }));

    const dialogo = await screen.findByRole("alertdialog");
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "Otro cambio se guardó antes."
    );
    expect(cliente.guardarAjustes).toHaveBeenCalledTimes(1);
    expect(interruptor).toHaveAttribute("aria-checked", "false");

    // Cancelar limpia el error: la próxima vez no sale el de antes.
    await usuario.click(
      within(dialogo).getByRole("button", { name: "Cancelar" })
    );
    await usuario.click(interruptor);
    const otraVez = await screen.findByRole("alertdialog");
    expect(within(otraVez).queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Ajustes · validación y guardado", () => {
  it("un valor fuera de rango muestra el motivo y no deja guardar", async () => {
    const cliente = montar();
    const usuario = userEvent.setup();
    await screen.findByLabelText("Contactos por semana");

    await escribir(usuario, "Contactos por semana", "25");
    expect(screen.getByText("Entre 0 y 20.")).toBeInTheDocument();
    expect(campo("Contactos por semana")).toBeInvalid();
    expect(campo("Contactos por semana")).toHaveAccessibleDescription(
      /Entre 0 y 20/
    );
    const guardar = screen.getByRole("button", { name: "Guardar cambios" });
    expect(guardar).toBeDisabled();

    await usuario.click(guardar);
    // Ni con Intro dentro del campo.
    await usuario.type(campo("Contactos por semana"), "{Enter}");
    expect(cliente.guardarAjustes).not.toHaveBeenCalled();
  });

  it.each([
    [
      "Contactos por semana",
      "3,5",
      "Debe ser un número entero, sin decimales.",
    ],
    ["Contactos por semana", "", "Escribe cuántos contactos por semana."],
    ["Parecido que bloquea", "95", "Entre 40 y 90 %."],
    ["Parecido que bloquea", "30", "Entre 40 y 90 %."],
    [
      "Parecido que bloquea",
      "mucho",
      "Debe ser un porcentaje, por ejemplo 60.",
    ],
    ["C · Backlinks", "150", "Entre 0 y 100."],
    ["A · Tráfico y marca", "-1", "Debe ser un número entero, sin decimales."],
    ["B · Clientes potenciales", "", "Escribe una puntuación mínima."],
  ])("%s = %j → «%s»", async (nombre, texto, error) => {
    const cliente = montar();
    const usuario = userEvent.setup();
    await screen.findByLabelText("Contactos por semana");

    await escribir(usuario, nombre, texto);
    expect(screen.getByText(error)).toBeInTheDocument();
    expect(campo(nombre)).toBeInvalid();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" })
    ).toBeDisabled();
    expect(cliente.guardarAjustes).not.toHaveBeenCalled();
  });

  it("un campo inválido bloquea aunque otro cambio sea bueno", async () => {
    const cliente = montar();
    const usuario = userEvent.setup();
    await screen.findByLabelText("Contactos por semana");

    await escribir(usuario, "Contactos por semana", "8");
    await escribir(usuario, "C · Backlinks", "200");
    expect(
      screen.getByRole("button", { name: "Guardar cambios" })
    ).toBeDisabled();
    expect(cliente.guardarAjustes).not.toHaveBeenCalled();
  });

  it("sin cambios el botón de guardar está desactivado", async () => {
    montar();
    await screen.findByLabelText("Contactos por semana");
    expect(
      screen.getByRole("button", { name: "Guardar cambios" })
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Descartar cambios" })
    ).not.toBeInTheDocument();
  });

  it("guarda solo lo que cambió y deja el aviso de que queda en el Historial", async () => {
    const cliente = montar();
    const usuario = userEvent.setup();
    await screen.findByLabelText("Contactos por semana");

    await escribir(usuario, "Contactos por semana", "8");
    expect(screen.getByText("Hay cambios sin guardar.")).toBeInTheDocument();
    await usuario.click(
      screen.getByRole("button", { name: "Guardar cambios" })
    );

    await waitFor(() =>
      expect(cliente.guardarAjustes).toHaveBeenCalledTimes(1)
    );
    expect(cliente.guardarAjustes).toHaveBeenCalledWith({ topeSemanal: 8 });
    expect(
      await screen.findByText(
        "Ajustes guardados. El cambio queda en el Historial."
      )
    ).toBeInTheDocument();
    // El formulario pasa a estar limpio con lo que guardó el backend.
    expect(campo("Contactos por semana")).toHaveValue("8");
    expect(
      screen.queryByText("Hay cambios sin guardar.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" })
    ).toBeDisabled();
  });

  it("el parecido se escribe en porcentaje y viaja como proporción", async () => {
    const cliente = montar();
    const usuario = userEvent.setup();
    await screen.findByLabelText("Contactos por semana");

    await escribir(usuario, "Parecido que bloquea", "62,5");
    await usuario.click(
      screen.getByRole("button", { name: "Guardar cambios" })
    );

    await waitFor(() =>
      expect(cliente.guardarAjustes).toHaveBeenCalledWith({
        umbralDeSimilitud: 0.625,
      })
    );
    await waitFor(() =>
      expect(campo("Parecido que bloquea")).toHaveValue("62,5")
    );
  });

  it("al cambiar un umbral manda los tres objetivos a la vez", async () => {
    const cliente = montar();
    const usuario = userEvent.setup();
    await screen.findByLabelText("Contactos por semana");

    await escribir(usuario, "C · Backlinks", "75");
    await usuario.click(
      screen.getByRole("button", { name: "Guardar cambios" })
    );

    await waitFor(() =>
      expect(cliente.guardarAjustes).toHaveBeenCalledWith({
        umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 75 },
      })
    );
  });

  it("nunca manda la pausa ni claves sistema.* al guardar el formulario", async () => {
    const cliente = montar(
      crearAjustes({
        actualizadoEn: {
          topeSemanal: null,
          umbralDeSimilitud: null,
          umbralesPorObjetivo: null,
          pausa: null,
          "sistema.conocimiento": new Date().toISOString(),
        },
      })
    );
    const usuario = userEvent.setup();
    await screen.findByLabelText("Contactos por semana");

    await escribir(usuario, "Contactos por semana", "9");
    await escribir(usuario, "Parecido que bloquea", "50");
    await escribir(usuario, "A · Tráfico y marca", "40");
    await usuario.click(
      screen.getByRole("button", { name: "Guardar cambios" })
    );

    await waitFor(() =>
      expect(cliente.guardarAjustes).toHaveBeenCalledTimes(1)
    );
    const [enviado] = cliente.guardarAjustes.mock.calls[0];
    expect(Object.keys(enviado).sort()).toEqual([
      "topeSemanal",
      "umbralDeSimilitud",
      "umbralesPorObjetivo",
    ]);
  });

  it("si el backend rechaza el guardado, enseña el motivo y conserva lo escrito", async () => {
    const cliente = montar(crearAjustes(), {
      guardarAjustes: async () => {
        throw new ErrorDeCliente(
          400,
          "El tope semanal va de 0 a 20 contactos."
        );
      },
    });
    const usuario = userEvent.setup();
    await screen.findByLabelText("Contactos por semana");

    await escribir(usuario, "Contactos por semana", "8");
    await usuario.click(
      screen.getByRole("button", { name: "Guardar cambios" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El tope semanal va de 0 a 20 contactos."
    );
    expect(campo("Contactos por semana")).toHaveValue("8");
    expect(cliente.guardarAjustes).toHaveBeenCalledTimes(1);

    // Al seguir editando, el aviso de error se va.
    await escribir(usuario, "Contactos por semana", "9");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("no manda dos veces lo mismo si se pulsa mientras guarda", async () => {
    let resolver: (a: Ajustes) => void = () => {};
    const pendiente = new Promise<Ajustes>((r) => (resolver = r));
    const guardar = vi.fn(async () => pendiente);
    const cliente = montar(crearAjustes(), { guardarAjustes: guardar });
    const usuario = userEvent.setup();
    await screen.findByLabelText("Contactos por semana");

    await escribir(usuario, "Contactos por semana", "8");
    await usuario.click(
      screen.getByRole("button", { name: "Guardar cambios" })
    );
    const boton = await screen.findByRole("button", { name: /Guardando/ });
    expect(boton).toBeDisabled();
    // Mientras guarda no se puede seguir editando: se perdería al terminar.
    expect(campo("Contactos por semana")).toBeDisabled();
    expect(campo("C · Backlinks")).toBeDisabled();
    await usuario.click(boton);
    await usuario.type(campo("Contactos por semana"), "{Enter}");
    expect(cliente.guardarAjustes).toHaveBeenCalledTimes(1);

    resolver(aplicar(crearAjustes(), { topeSemanal: 8 }));
    await screen.findByText(/Ajustes guardados/);
  });

  it("«Descartar cambios» devuelve lo guardado", async () => {
    const cliente = montar();
    const usuario = userEvent.setup();
    await screen.findByLabelText("Contactos por semana");

    await escribir(usuario, "Contactos por semana", "99");
    await escribir(usuario, "A · Tráfico y marca", "10");
    await usuario.click(
      screen.getByRole("button", { name: "Descartar cambios" })
    );

    expect(campo("Contactos por semana")).toHaveValue("5");
    expect(campo("A · Tráfico y marca")).toHaveValue("60");
    expect(screen.queryByText("Entre 0 y 20.")).not.toBeInTheDocument();
    expect(cliente.guardarAjustes).not.toHaveBeenCalled();
  });

  it("«Poner los valores iniciales» rellena los de fábrica sin guardar nada", async () => {
    const cliente = montar(
      crearAjustes({
        valores: {
          topeSemanal: 12,
          umbralDeSimilitud: 0.75,
          umbralesPorObjetivo: { TRAFICO_MARCA: 40, LEADS: 70, BACKLINKS: 90 },
          pausa: false,
        },
      })
    );
    const usuario = userEvent.setup();
    await screen.findByLabelText("Contactos por semana");
    expect(
      screen.getByRole("button", { name: "Poner los valores iniciales" })
    ).toBeVisible();

    await usuario.click(
      screen.getByRole("button", { name: "Poner los valores iniciales" })
    );
    expect(campo("Contactos por semana")).toHaveValue("5");
    expect(campo("Parecido que bloquea")).toHaveValue("60");
    expect(campo("A · Tráfico y marca")).toHaveValue("60");
    expect(campo("C · Backlinks")).toHaveValue("60");
    expect(cliente.guardarAjustes).not.toHaveBeenCalled();
    // Y no se ofrece lo que ya está hecho.
    expect(
      screen.queryByRole("button", { name: "Poner los valores iniciales" })
    ).not.toBeInTheDocument();

    await usuario.click(
      screen.getByRole("button", { name: "Guardar cambios" })
    );
    await waitFor(() =>
      expect(cliente.guardarAjustes).toHaveBeenCalledWith({
        topeSemanal: 5,
        umbralDeSimilitud: 0.6,
        umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
      })
    );
  });

  it("enseña cuándo se cambió cada ajuste por última vez", async () => {
    montar(
      crearAjustes({
        actualizadoEn: {
          topeSemanal: new Date(Date.now() - 3 * 86_400_000).toISOString(),
          umbralDeSimilitud: null,
          umbralesPorObjetivo: new Date(
            Date.now() - 2 * 3_600_000
          ).toISOString(),
          pausa: null,
        },
      })
    );
    await screen.findByLabelText("Contactos por semana");
    expect(screen.getByText("Último cambio hace 3 días.")).toBeInTheDocument();
    expect(screen.getByText("Último cambio hace 2 h.")).toBeInTheDocument();
    expect(
      screen.getAllByText("Sin cambios desde el valor inicial.").length
    ).toBeGreaterThan(0);
  });
});
