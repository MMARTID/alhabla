import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { VistaDeConocimiento } from "@/components/conocimiento/vista-de-conocimiento";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { HistorialDeAfirmacion } from "@/lib/types";
import { clienteFalso } from "../helpers/cliente-falso";
import { afirmacion, conocimiento, hace, snapshot } from "../helpers/d2-datos";
import { renderConCliente } from "../helpers/render";

function renderizar(
  respuesta = conocimiento(),
  extra: Parameters<typeof clienteFalso>[0] = {}
) {
  const cliente = clienteFalso({
    conocimiento: async () => respuesta,
    ...extra,
  });
  renderConCliente(<VistaDeConocimiento />, cliente);
  return cliente;
}

describe("Conocimiento · afirmaciones", () => {
  it("las agrupa por tipo, con lo prohibido y las limitaciones primero", async () => {
    renderizar();

    await screen.findByRole("heading", { level: 2, name: /Prohibido decir/ });
    const titulos = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent?.replace(/\s+/g, " ").trim());
    expect(titulos).toEqual([
      "Prohibido decir 1",
      "Limitaciones 1",
      "Precios 1",
      "Funciones 1",
      "Sectores 1",
      "Cambios de los últimos 30 días 0",
    ]);
  });

  it("cada afirmación enseña su clave, su texto, su fuente (ruta#ancla) y su commit", async () => {
    renderizar();

    const grupo = (
      await screen.findByRole("heading", { level: 2, name: /Precios/ })
    ).closest("section") as HTMLElement;
    const fila = within(grupo).getByRole("listitem");
    expect(fila).toHaveTextContent("precio.plan.pro");
    expect(fila).toHaveTextContent("El plan Pro cuesta 139 € al mes más IVA.");
    expect(fila).toHaveTextContent("web/src/lib/plans.ts#pro");
    // El commit va en corto: siete caracteres.
    expect(fila).toHaveTextContent("abc1234");
    expect(fila).not.toHaveTextContent("abc1234def5678");
  });

  it("«Prohibido decir» enseña los términos y cómo se buscan", async () => {
    renderizar();

    const grupo = (
      await screen.findByRole("heading", { level: 2, name: /Prohibido decir/ })
    ).closest("section") as HTMLElement;
    const terminos = within(grupo).getByRole("list", {
      name: "Términos que bloquean un borrador",
    });
    expect(
      within(terminos)
        .getAllByRole("listitem")
        .map((t) => t.textContent)
    ).toEqual(["100 % garantizado", "sin límites"]);
    expect(grupo).toHaveTextContent("Se busca como palabra entera.");
  });

  it("una prohibida sin lista de términos lo dice: solo cuenta la frase", async () => {
    const base = conocimiento();
    base.porTipo.prohibida = [
      afirmacion({
        id: "p2",
        clave: "prohibida.sin_lista",
        tipo: "prohibida",
        texto: "No se dice esta frase.",
        valor: null,
      }),
      afirmacion({
        id: "p3",
        clave: "prohibida.dentro",
        tipo: "prohibida",
        texto: "Términos sueltos.",
        valor: { terminos: ["gestor"], palabrasEnteras: false },
      }),
    ];
    renderizar(base);

    expect(
      await screen.findByText(
        "Sin lista de términos: solo cuenta la frase completa."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Se busca dentro de cualquier palabra.")
    ).toBeInTheDocument();
  });

  it("un valor con forma rara no tumba la pantalla", async () => {
    const base = conocimiento();
    base.porTipo.prohibida = [
      afirmacion({
        id: "p4",
        clave: "prohibida.rara",
        tipo: "prohibida",
        texto: "Valor raro.",
        valor: { terminos: [1, null, { a: 1 }, ""], palabrasEnteras: "sí" },
      }),
    ];
    renderizar(base);
    expect(await screen.findByText("Valor raro.")).toBeInTheDocument();
    expect(
      screen.getByText("Sin lista de términos: solo cuenta la frase completa.")
    ).toBeInTheDocument();
  });

  it("pinta todo como texto: nada de HTML ni de enlaces con lo que llega", async () => {
    const base = conocimiento();
    base.porTipo.precio = [
      afirmacion({
        texto:
          '<a href="javascript:alert(1)">pulsa</a><img src=x onerror=alert(1)>',
        fuente: "web/src/lib/plans.ts#<b>pro</b>",
      }),
    ];
    const { container } = (() => {
      const cliente = clienteFalso({ conocimiento: async () => base });
      return {
        container: renderConCliente(<VistaDeConocimiento />, cliente).container,
      };
    })();

    await screen.findByText(/pulsa/);
    expect(container.querySelector("a, img, b")).toBeNull();
  });

  it("filtra por tipo con los chips, que traen su cuenta", async () => {
    const usuario = userEvent.setup();
    renderizar();

    const grupoDeChips = await screen.findByRole("group", {
      name: "Tipo de afirmación",
    });
    expect(
      within(grupoDeChips)
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual([
      "Todo5",
      "Prohibido decir1",
      "Limitaciones1",
      "Precios1",
      "Funciones1",
      "Sectores1",
      "Comparativas0",
      "Páginas0",
    ]);

    await usuario.click(
      within(grupoDeChips).getByRole("button", { name: /Precios/ })
    );
    expect(
      screen.getByRole("heading", { level: 2, name: /Precios/ })
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { level: 2, name: /Funciones/ })
    ).not.toBeInTheDocument();
    // Los cambios recientes son del conjunto, no de un tipo.
    expect(
      screen.queryByRole("heading", { name: /Cambios de los últimos 30 días/ })
    ).not.toBeInTheDocument();
  });

  it("busca por clave, texto o fuente, sin distinguir mayúsculas ni acentos", async () => {
    const usuario = userEvent.setup();
    renderizar();
    const buscador = await screen.findByRole("searchbox", {
      name: "Buscar en el conocimiento",
    });

    await usuario.type(buscador, "PELUQUERIA");
    expect(
      screen.getByText(
        "Alhabla atiende llamadas y reserva citas en peluquerías."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/plan Pro/)).not.toBeInTheDocument();
    expect(screen.getByText("1 afirmación de 5")).toBeInTheDocument();

    await usuario.clear(buscador);
    await usuario.type(buscador, "plans.ts#inicio");
    expect(
      screen.getByText(/El plan Inicio admite hasta 3 profesionales/)
    ).toBeInTheDocument();

    // Los términos prohibidos también se buscan.
    await usuario.clear(buscador);
    await usuario.type(buscador, "sin limites");
    expect(
      screen.getByText("No se prometen resultados absolutos.")
    ).toBeVisible();
  });

  it("si nada coincide lo dice, con lo que se buscó", async () => {
    const usuario = userEvent.setup();
    renderizar();
    await usuario.type(
      await screen.findByRole("searchbox", {
        name: "Buscar en el conocimiento",
      }),
      "unicornio"
    );
    expect(screen.getByText("Ninguna afirmación coincide")).toBeInTheDocument();
    expect(screen.getByText(/«unicornio»/)).toBeInTheDocument();
  });
});

describe("Conocimiento · sincronización", () => {
  it("con el snapshot al día enseña cuándo, el commit y cuántas hay, sin aviso", async () => {
    renderizar(conocimiento({ snapshot: snapshot({ vigentes: 5 }) }));

    expect(await screen.findByText(/hace 2 h/)).toBeInTheDocument();
    expect(screen.getByText("9f8e7d6")).toBeInTheDocument();
    expect(screen.getByText("5 afirmaciones vigentes")).toBeInTheDocument();
    expect(
      screen.queryByText("El conocimiento está desactualizado")
    ).not.toBeInTheDocument();
  });

  it("un snapshot obsoleto (más de 8 días) muestra el aviso y dice qué hacer", async () => {
    renderizar(
      conocimiento({
        snapshot: snapshot({
          obsoleto: true,
          antiguedadHoras: 24 * 9 + 5,
          sincronizadoEn: hace(24 * 9 + 5),
        }),
      })
    );

    expect(
      await screen.findByText("El conocimiento está desactualizado")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Hace 9 días que no se sincroniza/)
    ).toBeInTheDocument();
    expect(screen.getByText("sincronizar_conocimiento")).toBeInTheDocument();
  });

  it("también avisa si la edad pasa de 8 días aunque el backend no lo marque", async () => {
    renderizar(
      conocimiento({
        snapshot: snapshot({ obsoleto: false, antiguedadHoras: 24 * 8 + 1 }),
      })
    );
    expect(
      await screen.findByText("El conocimiento está desactualizado")
    ).toBeInTheDocument();
  });

  it("justo en el límite de 8 días todavía no avisa", async () => {
    renderizar(
      conocimiento({
        snapshot: snapshot({ obsoleto: false, antiguedadHoras: 24 * 8 }),
      })
    );
    await screen.findByText(/afirmaciones vigentes/);
    expect(
      screen.queryByText("El conocimiento está desactualizado")
    ).not.toBeInTheDocument();
  });

  it("sin ninguna sincronización lo dice con honestidad", async () => {
    const vacio = conocimiento({ snapshot: null });
    for (const tipo of Object.keys(vacio.porTipo) as Array<
      keyof typeof vacio.porTipo
    >) {
      vacio.porTipo[tipo] = [];
      vacio.conteos[tipo] = 0;
    }
    renderizar(vacio);

    expect(
      await screen.findByText("Todavía no se ha sincronizado el conocimiento")
    ).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("avisa si la lista está recortada", async () => {
    renderizar(conocimiento({ truncado: true }));
    expect(
      await screen.findByText(/Hay más de 1\.000 afirmaciones vigentes/)
    ).toBeInTheDocument();
  });
});

describe("Conocimiento · cambios recientes", () => {
  const cambios = [
    {
      clave: "precio.plan.pro",
      tipo: "precio" as const,
      cambio: "alta" as const,
      en: "2026-10-28T10:00:00.000Z",
      commitSha: "bbbbbbb1111",
    },
    {
      clave: "precio.plan.pro",
      tipo: "precio" as const,
      cambio: "cierre" as const,
      en: "2026-10-28T10:00:00.000Z",
      commitSha: "aaaaaaa0000",
    },
    {
      clave: "funcion.vieja",
      tipo: "funcion" as const,
      cambio: "cierre" as const,
      en: "2026-10-20T10:00:00.000Z",
      commitSha: "ccccccc2222",
    },
  ];

  it("junta el cierre y el alta de la misma clave en una sola «Modificada»", async () => {
    renderizar(conocimiento({ cambiosRecientes: cambios }));

    const seccion = (
      await screen.findByRole("heading", {
        name: /Cambios de los últimos 30 días/,
      })
    ).closest("section") as HTMLElement;
    const filas = within(seccion).getAllByRole("listitem");
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("precio.plan.pro");
    expect(filas[0]).toHaveTextContent("Modificada");
    // Con el commit de la versión nueva.
    expect(filas[0]).toHaveTextContent("bbbbbbb");
    expect(filas[1]).toHaveTextContent("funcion.vieja");
    expect(filas[1]).toHaveTextContent("Retirada");
  });

  it("enseña cinco y el resto bajo «Ver los N cambios»", async () => {
    const muchos = Array.from({ length: 8 }, (_, i) => ({
      clave: `pagina.p${i}`,
      tipo: "pagina" as const,
      cambio: "alta" as const,
      en: new Date(Date.UTC(2026, 9, 20 + i)).toISOString(),
      commitSha: "abcdef0123",
    }));
    const usuario = userEvent.setup();
    renderizar(conocimiento({ cambiosRecientes: muchos }));

    const seccion = (
      await screen.findByRole("heading", {
        name: /Cambios de los últimos 30 días/,
      })
    ).closest("section") as HTMLElement;
    expect(within(seccion).getAllByRole("listitem")).toHaveLength(5);

    await usuario.click(
      within(seccion).getByRole("button", { name: "Ver los 8 cambios" })
    );
    expect(within(seccion).getAllByRole("listitem")).toHaveLength(8);
  });

  it("sin cambios dice que no ha cambiado nada", async () => {
    renderizar(conocimiento({ cambiosRecientes: [] }));
    expect(
      await screen.findByText("No ha cambiado nada en los últimos 30 días.")
    ).toBeInTheDocument();
  });
});

describe("Conocimiento · historial de una clave", () => {
  const historial: HistorialDeAfirmacion = {
    clave: "precio.plan.pro",
    versiones: [
      {
        id: "v2",
        tipo: "precio",
        texto: "El plan Pro cuesta 139 € al mes más IVA.",
        valor: { precio: 139 },
        fuente: "web/src/lib/plans.ts#pro",
        commitSha: "bbbbbbb1111",
        vigenteDesde: "2026-10-17T00:00:00.000Z",
        vigenteHasta: null,
      },
      {
        id: "v1",
        tipo: "precio",
        texto: "El plan Pro cuesta 129 € al mes más IVA.",
        valor: { precio: 129 },
        fuente: "web/src/lib/plans.ts#pro",
        commitSha: "aaaaaaa0000",
        vigenteDesde: "2026-09-01T00:00:00.000Z",
        vigenteHasta: "2026-10-17T00:00:00.000Z",
      },
    ],
  };

  it("se pide solo al abrirlo y enseña las versiones, la vigente y las cerradas", async () => {
    const usuario = userEvent.setup();
    const cliente = renderizar(conocimiento(), {
      historialDeAfirmacion: async () => historial,
    });
    const boton = await screen.findByRole("button", {
      name: /Ver el historial de precio\.plan\.pro/,
    });
    expect(cliente.historialDeAfirmacion).not.toHaveBeenCalled();
    expect(boton).toHaveAttribute("aria-expanded", "false");

    await usuario.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    const versiones = await screen.findByRole("list", {
      name: "Versiones de precio.plan.pro",
    });
    expect(cliente.historialDeAfirmacion).toHaveBeenCalledWith(
      "precio.plan.pro"
    );
    const filas = within(versiones).getAllByRole("listitem");
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("Vigente");
    expect(filas[0]).toHaveTextContent("139 €");
    expect(filas[1]).toHaveTextContent("Cerrada");
    expect(filas[1]).toHaveTextContent("129 €");
    expect(filas[1]).toHaveTextContent("aaaaaaa");

    await usuario.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "false");
  });

  it("si el historial falla lo dice sin tirar el resto de la lista", async () => {
    const usuario = userEvent.setup();
    renderizar(conocimiento(), {
      historialDeAfirmacion: async () => {
        throw new ErrorDeCliente(404, "Esa afirmación no existe.");
      },
    });
    await usuario.click(
      await screen.findByRole("button", {
        name: /Ver el historial de precio\.plan\.pro/,
      })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esa afirmación no existe."
    );
    expect(
      screen.getByText("El plan Pro cuesta 139 € al mes más IVA.")
    ).toBeVisible();
  });
});

describe("Conocimiento · errores", () => {
  it("si no carga, dice por qué y deja reintentar", async () => {
    let intento = 0;
    const cliente = clienteFalso({
      conocimiento: async () => {
        intento += 1;
        if (intento === 1)
          throw new ErrorDeCliente(503, "Growth no está configurado.");
        return conocimiento();
      },
    });
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeConocimiento />, cliente);

    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("No se pudo cargar el conocimiento");
    expect(aviso).toHaveTextContent("Growth no está configurado.");
    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: /Precios/ })
    ).toBeVisible();
  });
});
