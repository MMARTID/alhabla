import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VistaDeTareas } from "@/components/tareas/vista-de-tareas";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import type { Tarea } from "@/lib/types";
import { clienteFalso } from "../helpers/cliente-falso";
import { renderConCliente } from "../helpers/render";
import { fichaDeAlhabla, tarea } from "../helpers/tareas-datos";

/**
 * El demo fecha sus datos respecto al reloj y las tareas hechas llevan «hace
 * 6 días»: el reloj se fija el 30-10-2026, el día en que se escribió.
 */
const AHORA_DEL_DEMO = new Date("2026-10-30T09:00:00.000Z");

function montarDemo() {
  const cliente = clienteDemo({ retardoMs: 0, ahora: () => AHORA_DEL_DEMO });
  renderConCliente(<VistaDeTareas />, cliente);
  return cliente;
}

/** Un cliente falso con una lista de tareas que cambia con cada acción. */
function montarFalso(
  inicial: Tarea[],
  sustitutos: Partial<ClienteGrowth> = {}
) {
  let lista = inicial;
  const cliente = clienteFalso({
    fichaDeAlhabla: async () => fichaDeAlhabla(),
    tareas: async () => ({ data: lista }),
    ...sustitutos,
  });
  const vista = renderConCliente(<VistaDeTareas />, cliente);
  return {
    cliente,
    ...vista,
    cambiar: (nueva: Tarea[]) => {
      lista = nueva;
    },
  };
}

/** La tarjeta (`<li>`) de una tarea, por el título de su `<h3>`. */
async function tarjeta(titulo: string | RegExp): Promise<HTMLElement> {
  const h3 = await screen.findByRole("heading", { level: 3, name: titulo });
  return h3.closest("li") as HTMLElement;
}

/** La sección de un grupo, por el título de su `<h2>` (con la cuenta detrás). */
async function grupo(titulo: string): Promise<HTMLElement> {
  const h2 = await screen.findByRole("heading", {
    level: 2,
    name: new RegExp(`^${titulo}\\s*\\d*$`),
  });
  return h2.closest("section") as HTMLElement;
}

describe("Tareas · la lista con el demo", () => {
  it("siembra las iniciales: nueve pendientes, las hechas y la descartada, cada una en su grupo", async () => {
    montarDemo();
    const pendientes = await grupo("Pendientes");
    expect(pendientes).toHaveTextContent("Pendientes 9");
    expect(
      within(pendientes).getByRole("heading", { level: 3, name: "G2" })
    ).toBeInTheDocument();
    expect(
      within(pendientes).getByRole("heading", {
        level: 3,
        name: "Capterra (también GetApp y Software Advice)",
      })
    ).toBeInTheDocument();
    const hechas = await grupo("Hechas");
    expect(hechas).toHaveTextContent("Hechas 2");
    expect(
      within(hechas).getByRole("heading", { level: 3, name: "Beautymarket" })
    ).toBeInTheDocument();
    const descartadas = await grupo("Descartadas");
    expect(
      within(descartadas).getByRole("heading", {
        level: 3,
        name: "AlternativeTo",
      })
    ).toBeInTheDocument();
  });

  it("las hechas van de la más reciente a la más antigua", async () => {
    montarDemo();
    const hechas = await grupo("Hechas");
    // La tarea manual se hizo hace 6 días; Beautymarket, el 31-10-2026.
    expect(
      within(hechas)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent)
    ).toEqual(["Beautymarket", "Guía de herramientas para pymes (ejemplo)"]);
  });

  it("una tarea enseña título, dominio como texto, categoría, origen, notas y los pasos en una lista numerada", async () => {
    montarDemo();
    const g2 = await tarjeta("G2");
    expect(g2).toHaveTextContent("g2.com");
    expect(g2).toHaveTextContent("Directorio de software");
    expect(g2).toHaveTextContent("Del repositorio");
    expect(g2).toHaveTextContent(
      "Por búsqueda, sin confirmar: perfil gratuito en sell.g2.com/create-free-profile."
    );
    const pasos = within(g2).getByRole("list");
    expect(pasos.tagName).toBe("OL");
    expect(within(pasos).getAllByRole("listitem")).toHaveLength(4);
    expect(pasos).toHaveTextContent("Abre la página.");
    // El dominio nunca es un enlace.
    expect(
      within(g2).queryByRole("link", { name: "g2.com" })
    ).not.toBeInTheDocument();
  });

  it("«Abrir» es un enlace https que abre otra pestaña con nofollow, noopener y noreferrer", async () => {
    montarDemo();
    const g2 = await tarjeta("G2");
    const abrir = within(g2).getByRole("link", { name: /Abrir/ });
    expect(abrir).toHaveAttribute("href", "https://www.g2.com/");
    expect(abrir).toHaveAttribute("target", "_blank");
    const rel = abrir.getAttribute("rel") ?? "";
    for (const palabra of ["nofollow", "noopener", "noreferrer"]) {
      expect(rel).toContain(palabra);
    }
  });

  it("lo hecho enseña el resultado, el día y la nota; lo descartado, su motivo; los pasos, plegados", async () => {
    montarDemo();
    const beauty = await tarjeta("Beautymarket");
    expect(beauty).toHaveTextContent("En revisión");
    expect(beauty).toHaveTextContent("Hecha el 31 oct 2026");
    expect(beauty).toHaveTextContent("Ficha enviada por el fundador");
    const pasos = within(beauty).getByText(/Ver los 4 pasos/);
    expect(pasos.closest("details")).not.toHaveAttribute("open");
    const alternativeTo = await tarjeta("AlternativeTo");
    expect(alternativeTo).toHaveTextContent("Descartada");
    expect(alternativeTo).toHaveTextContent("Solo deja sugerir alternativas");
  });

  it("las acciones de cada estado: pendientes, hechas y descartadas", async () => {
    montarDemo();
    const g2 = await tarjeta("G2");
    for (const nombre of [/Marcar hecha/, /Descartar/, /Editar/]) {
      expect(within(g2).getByRole("button", { name: nombre })).toBeEnabled();
    }
    expect(
      within(g2).queryByRole("button", { name: /Reabrir/ })
    ).not.toBeInTheDocument();
    const beauty = await tarjeta("Beautymarket");
    expect(
      within(beauty).getByRole("button", { name: /Reabrir/ })
    ).toBeEnabled();
    expect(
      within(beauty).queryByRole("button", { name: /Marcar hecha/ })
    ).not.toBeInTheDocument();
  });

  it("las del repositorio no se borran: sin «Borrar»; las tuyas sí", async () => {
    montarDemo();
    const g2 = await tarjeta("G2");
    expect(
      within(g2).queryByRole("button", { name: /Borrar/ })
    ).not.toBeInTheDocument();
    const manual = await tarjeta(/Guía de herramientas/);
    expect(
      within(manual).getByRole("button", { name: /Borrar/ })
    ).toBeEnabled();
    expect(manual).toHaveTextContent("Añadida por ti");
  });
});

describe("Tareas · marcar hecha, descartar y reabrir", () => {
  it("«Marcar hecha» pide el resultado y una nota y la pasa a Hechas con ellos", async () => {
    const user = userEvent.setup();
    montarDemo();
    const g2 = await tarjeta("G2");
    await user.click(within(g2).getByRole("button", { name: /Marcar hecha/ }));

    const dialogo = await screen.findByRole("dialog", { name: "Marcar hecha" });
    expect(dialogo).toHaveTextContent("G2");
    // El resultado es opcional: empieza en «Sin indicar».
    const resultado = within(dialogo).getByRole("combobox", {
      name: /Resultado/,
    });
    expect(resultado).toHaveValue("");
    expect(
      within(resultado)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual([
      "Sin indicar",
      "Alta creada",
      "En revisión",
      "Rechazada",
      "Sin alta gratuita",
      "Otro",
    ]);
    await user.selectOptions(resultado, "alta_creada");
    await user.type(
      within(dialogo).getByRole("textbox", { name: /Nota/ }),
      "Gratis; pidió verificar el correo."
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar hecha" })
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Marcar hecha" })
      ).not.toBeInTheDocument()
    );
    const hechas = await grupo("Hechas");
    await waitFor(() =>
      expect(
        within(hechas).getByRole("heading", { level: 3, name: "G2" })
      ).toBeInTheDocument()
    );
    const hecha = within(hechas)
      .getByRole("heading", { level: 3, name: "G2" })
      .closest("li") as HTMLElement;
    expect(hecha).toHaveTextContent("Alta creada");
    expect(hecha).toHaveTextContent("Gratis; pidió verificar el correo.");
    expect(hecha).toHaveTextContent("Hecha el 30 oct 2026");
    expect(await grupo("Pendientes")).toHaveTextContent("Pendientes 8");
  });

  it("sin resultado ni nota manda el cuerpo vacío (los dos son opcionales)", async () => {
    const user = userEvent.setup();
    const marcar = vi.fn(async (id: string) =>
      tarea({ id, estado: "hecha", hechaEn: "2026-10-31T10:00:00.000Z" })
    );
    montarFalso([tarea()], { marcarTareaHecha: marcar });
    const t = await tarjeta("Directorio de ejemplo");
    await user.click(within(t).getByRole("button", { name: /Marcar hecha/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar hecha" })
    );
    await waitFor(() => expect(marcar).toHaveBeenCalledTimes(1));
    expect(marcar).toHaveBeenCalledWith("ta-1", {});
  });

  it("manda solo el resultado si no hay nota, y una nota demasiado larga no se envía", async () => {
    const user = userEvent.setup();
    const marcar = vi.fn(async (id: string) =>
      tarea({ id, estado: "hecha", hechaEn: "2026-10-31T10:00:00.000Z" })
    );
    montarFalso([tarea()], { marcarTareaHecha: marcar });
    const t = await tarjeta("Directorio de ejemplo");
    await user.click(within(t).getByRole("button", { name: /Marcar hecha/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.selectOptions(
      within(dialogo).getByRole("combobox", { name: /Resultado/ }),
      "sin_alta_gratuita"
    );
    const nota = within(dialogo).getByRole("textbox", { name: /Nota/ });
    await user.click(nota);
    await user.paste("x".repeat(501));
    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar hecha" })
    );
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "La nota no puede pasar de 500 caracteres."
    );
    expect(marcar).not.toHaveBeenCalled();
    await user.clear(nota);
    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar hecha" })
    );
    await waitFor(() => expect(marcar).toHaveBeenCalledTimes(1));
    expect(marcar).toHaveBeenCalledWith("ta-1", {
      resultado: "sin_alta_gratuita",
    });
  });

  it("si falla, el diálogo se queda abierto con el error y lo escrito", async () => {
    const user = userEvent.setup();
    montarFalso([tarea()], {
      marcarTareaHecha: async () => {
        throw new ErrorDeCliente(404, "La tarea no existe.");
      },
    });
    const t = await tarjeta("Directorio de ejemplo");
    await user.click(within(t).getByRole("button", { name: /Marcar hecha/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(
      within(dialogo).getByRole("textbox", { name: /Nota/ }),
      "Mi nota"
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar hecha" })
    );
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "La tarea no existe."
    );
    expect(within(dialogo).getByRole("textbox", { name: /Nota/ })).toHaveValue(
      "Mi nota"
    );
  });

  it("«Descartar» pide el motivo (opcional) y la pasa a Descartadas", async () => {
    const user = userEvent.setup();
    montarDemo();
    const stork = await tarjeta("Stork");
    await user.click(within(stork).getByRole("button", { name: /Descartar/ }));
    const dialogo = await screen.findByRole("dialog", {
      name: "Descartar tarea",
    });
    await user.type(
      within(dialogo).getByRole("textbox", { name: /Motivo/ }),
      "No admite altas."
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Descartar tarea" })
    );
    const descartadas = await grupo("Descartadas");
    await waitFor(() =>
      expect(
        within(descartadas).getByRole("heading", { level: 3, name: "Stork" })
      ).toBeInTheDocument()
    );
    expect(descartadas).toHaveTextContent("No admite altas.");
  });

  it("«Reabrir» devuelve una hecha a Pendientes sin su resultado", async () => {
    const user = userEvent.setup();
    montarDemo();
    const beauty = await tarjeta("Beautymarket");
    await user.click(within(beauty).getByRole("button", { name: /Reabrir/ }));
    const pendientes = await grupo("Pendientes");
    await waitFor(() =>
      expect(
        within(pendientes).getByRole("heading", {
          level: 3,
          name: "Beautymarket",
        })
      ).toBeInTheDocument()
    );
    const reabierta = await tarjeta("Beautymarket");
    expect(reabierta).not.toHaveTextContent("En revisión");
    expect(reabierta).not.toHaveTextContent("Hecha el");
    expect(
      within(reabierta).getByRole("button", { name: /Marcar hecha/ })
    ).toBeEnabled();
  });

  it("si «Reabrir» falla, lo dice en la tarjeta", async () => {
    const user = userEvent.setup();
    montarFalso(
      [tarea({ estado: "hecha", hechaEn: "2026-10-30T09:00:00.000Z" })],
      {
        reabrirTarea: async () => {
          throw new ErrorDeCliente(404, "La tarea no existe.");
        },
      }
    );
    const t = await tarjeta("Directorio de ejemplo");
    await user.click(within(t).getByRole("button", { name: /Reabrir/ }));
    expect(await within(t).findByRole("alert")).toHaveTextContent(
      "La tarea no existe."
    );
  });
});

describe("Tareas · añadir y editar", () => {
  it("«Añadir tarea» valida el título y una dirección http(s) sin llamar al backend", async () => {
    const user = userEvent.setup();
    const anadir = vi.fn(async () => tarea());
    montarFalso([], { anadirTarea: anadir });
    await user.click(
      await screen.findByRole("button", { name: "Añadir tarea" })
    );
    const dialogo = await screen.findByRole("dialog", { name: "Añadir tarea" });
    await user.click(
      within(dialogo).getByRole("button", { name: "Añadir tarea" })
    );
    expect(within(dialogo).getByText("Escribe un título.")).toBeInTheDocument();
    expect(
      within(dialogo).getByText("Escribe la dirección web.")
    ).toBeInTheDocument();

    await user.type(within(dialogo).getByLabelText("Título"), "Un directorio");
    await user.type(
      within(dialogo).getByLabelText("Dirección"),
      "ftp://directorio.example"
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Añadir tarea" })
    );
    expect(
      within(dialogo).getByText(/que empiece por http:\/\/ o https:\/\//)
    ).toBeInTheDocument();
    expect(anadir).not.toHaveBeenCalled();
  });

  it("añade con título, dirección, categoría, pasos (uno por línea, sin líneas vacías) y notas; sin mandar el dominio", async () => {
    const user = userEvent.setup();
    const anadir = vi.fn(async () => tarea());
    montarFalso([], { anadirTarea: anadir });
    await user.click(
      await screen.findByRole("button", { name: "Añadir tarea" })
    );
    const dialogo = await screen.findByRole("dialog", { name: "Añadir tarea" });
    await user.type(
      within(dialogo).getByLabelText("Título"),
      "  Un directorio "
    );
    await user.type(
      within(dialogo).getByLabelText("Dirección"),
      "https://www.directorio.example/alta"
    );
    await user.selectOptions(
      within(dialogo).getByLabelText("Categoría"),
      "directorio_ia"
    );
    await user.type(
      within(dialogo).getByLabelText(/Pasos/),
      "Abre la página{enter}{enter}  Rellena el alta  {enter}"
    );
    await user.type(
      within(dialogo).getByLabelText(/Notas/),
      "Mirar el precio."
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Añadir tarea" })
    );
    await waitFor(() => expect(anadir).toHaveBeenCalledTimes(1));
    expect(anadir).toHaveBeenCalledWith({
      titulo: "Un directorio",
      url: "https://www.directorio.example/alta",
      categoria: "directorio_ia",
      pasos: ["Abre la página", "Rellena el alta"],
      notas: "Mirar el precio.",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("con el demo, la tarea nueva sale en Pendientes como tuya", async () => {
    const user = userEvent.setup();
    montarDemo();
    await tarjeta("G2");
    await user.click(screen.getByRole("button", { name: "Añadir tarea" }));
    const dialogo = await screen.findByRole("dialog", { name: "Añadir tarea" });
    await user.type(within(dialogo).getByLabelText("Título"), "Mi directorio");
    await user.type(
      within(dialogo).getByLabelText("Dirección"),
      "https://mi-directorio.example/"
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Añadir tarea" })
    );
    const nueva = await tarjeta("Mi directorio");
    expect(nueva).toHaveTextContent("mi-directorio.example");
    expect(nueva).toHaveTextContent("Añadida por ti");
    expect(
      within(await grupo("Pendientes")).getByRole("heading", {
        level: 3,
        name: "Mi directorio",
      })
    ).toBeInTheDocument();
  });

  it("si el backend rechaza el alta, el diálogo sigue abierto con el motivo", async () => {
    const user = userEvent.setup();
    montarFalso([], {
      anadirTarea: async () => {
        throw new ErrorDeCliente(
          400,
          "La URL debe ser http o https y sin usuario ni contraseña."
        );
      },
    });
    await user.click(
      await screen.findByRole("button", { name: "Añadir tarea" })
    );
    const dialogo = await screen.findByRole("dialog", { name: "Añadir tarea" });
    await user.type(within(dialogo).getByLabelText("Título"), "Uno");
    await user.type(
      within(dialogo).getByLabelText("Dirección"),
      "https://uno.example/"
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Añadir tarea" })
    );
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "La URL debe ser http o https"
    );
    expect(within(dialogo).getByLabelText("Título")).toHaveValue("Uno");
  });

  it("editar manda solo lo que has cambiado; vaciar las notas manda null", async () => {
    const user = userEvent.setup();
    const editar = vi.fn(async () => tarea());
    montarFalso([tarea({ notas: "Notas viejas." })], { editarTarea: editar });
    const t = await tarjeta("Directorio de ejemplo");
    await user.click(within(t).getByRole("button", { name: /Editar/ }));
    const dialogo = await screen.findByRole("dialog", { name: "Editar tarea" });
    expect(within(dialogo).getByLabelText("Título")).toHaveValue(
      "Directorio de ejemplo"
    );
    expect(within(dialogo).getByLabelText(/Pasos/)).toHaveValue(
      "Abre la página.\nRellena el alta."
    );
    await user.clear(within(dialogo).getByLabelText("Título"));
    await user.type(within(dialogo).getByLabelText("Título"), "Nuevo título");
    await user.clear(within(dialogo).getByLabelText(/Notas/));
    await user.click(within(dialogo).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(editar).toHaveBeenCalledTimes(1));
    expect(editar).toHaveBeenCalledWith("ta-1", {
      titulo: "Nuevo título",
      notas: null,
    });
  });

  it("editar sin cambiar nada no llama al backend y cierra", async () => {
    const user = userEvent.setup();
    const editar = vi.fn(async () => tarea());
    montarFalso([tarea()], { editarTarea: editar });
    const t = await tarjeta("Directorio de ejemplo");
    await user.click(within(t).getByRole("button", { name: /Editar/ }));
    const dialogo = await screen.findByRole("dialog", { name: "Editar tarea" });
    await user.click(within(dialogo).getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(editar).not.toHaveBeenCalled();
  });

  it("más de 12 pasos o un paso de más de 300 caracteres no se envían", async () => {
    const user = userEvent.setup();
    const editar = vi.fn(async () => tarea());
    montarFalso([tarea()], { editarTarea: editar });
    const t = await tarjeta("Directorio de ejemplo");
    await user.click(within(t).getByRole("button", { name: /Editar/ }));
    const dialogo = await screen.findByRole("dialog", { name: "Editar tarea" });
    const pasos = within(dialogo).getByLabelText(/Pasos/);
    await user.clear(pasos);
    await user.click(pasos);
    await user.paste(
      Array.from({ length: 13 }, (_, i) => `Paso ${i}`).join("\n")
    );
    await user.click(within(dialogo).getByRole("button", { name: "Guardar" }));
    expect(
      within(dialogo).getByText(/Como mucho 12 pasos/)
    ).toBeInTheDocument();
    await user.clear(pasos);
    await user.click(pasos);
    await user.paste("x".repeat(301));
    await user.click(within(dialogo).getByRole("button", { name: "Guardar" }));
    expect(
      within(dialogo).getByText(/Cada paso puede tener hasta 300 caracteres/)
    ).toBeInTheDocument();
    expect(editar).not.toHaveBeenCalled();
  });
});

describe("Tareas · borrar", () => {
  it("borra una tuya tras confirmar", async () => {
    const user = userEvent.setup();
    montarDemo();
    const manual = await tarjeta(/Guía de herramientas/);
    await user.click(within(manual).getByRole("button", { name: /Borrar/ }));
    const confirmacion = await screen.findByRole("alertdialog");
    expect(confirmacion).toHaveTextContent("¿Borrar esta tarea?");
    await user.click(
      within(confirmacion).getByRole("button", { name: "Borrar tarea" })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", {
          level: 3,
          name: /Guía de herramientas/,
        })
      ).not.toBeInTheDocument()
    );
  });

  it("cancelar no borra nada", async () => {
    const user = userEvent.setup();
    const borrar = vi.fn(async () => undefined);
    montarFalso([tarea()], { borrarTarea: borrar });
    const t = await tarjeta("Directorio de ejemplo");
    await user.click(within(t).getByRole("button", { name: /Borrar/ }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Cancelar",
      })
    );
    expect(borrar).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("el 409 tarea_del_repositorio se cuenta con el texto del backend y qué hacer", async () => {
    const user = userEvent.setup();
    montarFalso([tarea({ origen: "manual" })], {
      borrarTarea: async () => {
        throw new ErrorDeCliente(
          409,
          "Esta tarea viene del repositorio y no se puede borrar: descártala.",
          { codigo: "tarea_del_repositorio" }
        );
      },
    });
    const t = await tarjeta("Directorio de ejemplo");
    await user.click(within(t).getByRole("button", { name: /Borrar/ }));
    const confirmacion = await screen.findByRole("alertdialog");
    await user.click(
      within(confirmacion).getByRole("button", { name: "Borrar tarea" })
    );
    const error = await within(confirmacion).findByRole("alert");
    expect(error).toHaveTextContent("no se puede borrar: descártala.");
    expect(error).toHaveTextContent("Descártala en vez de borrarla.");
  });
});

describe("Tareas · estados y seguridad", () => {
  it("sin tareas, un estado vacío", async () => {
    montarFalso([]);
    expect(
      await screen.findByText("Todavía no hay tareas")
    ).toBeInTheDocument();
  });

  it("sin pendientes lo dice, y no enseña grupos vacíos de hechas ni descartadas", async () => {
    montarFalso([
      tarea({ estado: "hecha", hechaEn: "2026-10-30T09:00:00.000Z" }),
    ]);
    const pendientes = await grupo("Pendientes");
    expect(pendientes).toHaveTextContent("No te queda nada pendiente.");
    expect(
      screen.queryByRole("heading", { level: 2, name: /Descartadas/ })
    ).not.toBeInTheDocument();
  });

  it("si falla la carga, el error con «Reintentar»; la ficha sigue con su propia carga", async () => {
    montarFalso([], {
      tareas: async () => {
        throw new ErrorDeCliente(500, "x");
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron cargar las tareas"
    );
    expect(
      await screen.findByRole("heading", {
        level: 3,
        name: "Nombre del producto",
      })
    ).toBeInTheDocument();
  });

  it("el texto de terceros (título, dominio, pasos, notas, notas de resultado) es texto, y una URL que no es https no es enlace", async () => {
    const { container } = renderConCliente(
      <VistaDeTareas />,
      clienteFalso({
        fichaDeAlhabla: async () => fichaDeAlhabla(),
        tareas: async () => ({
          data: [
            tarea({
              titulo: "<b>Hostil</b>",
              dominio: "javascript:alert(1)",
              url: "javascript:alert(2)",
              pasos: ['<img src=x onerror="alert(3)">', "Paso normal"],
              notas: '<a href="javascript:alert(4)">pulsa</a>',
            }),
            tarea({
              id: "ta-2",
              titulo: "Solo http",
              dominio: "viejo.example",
              url: "http://viejo.example/alta",
              estado: "hecha",
              hechaEn: "2026-10-30T09:00:00.000Z",
              notaDeResultado: "<script>alert(5)</script>",
            }),
          ],
        }),
      })
    );
    await screen.findByRole("heading", { level: 3, name: "<b>Hostil</b>" });
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(
      screen.getByText(/javascript:alert\(2\)/, { selector: "span" })
    ).toBeInTheDocument();
    expect(screen.getByText("<script>alert(5)</script>")).toBeInTheDocument();
    expect(container.querySelector("img, b, script, [onerror]")).toBeNull();
    // Ningún enlace sale hacia una dirección que no sea https (ni javascript:).
    const abrir = screen.queryAllByRole("link", { name: /Abrir/ });
    expect(abrir).toHaveLength(0);
    expect(
      screen.getAllByText(/no se enlaza: no es una dirección https/)
    ).toHaveLength(2);
  });
});
