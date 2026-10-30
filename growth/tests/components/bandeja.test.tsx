import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import Bandeja from "@/app/(panel)/bandeja/page";
import { VistaDeBandeja } from "@/components/bandeja/vista-de-bandeja";
import { CLAVE_DE_FILTROS } from "@/components/bandeja/estado-de-filtros";
import { ErrorDeCliente } from "@/lib/api-errors";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import { ESTADOS_DE_LA_BANDEJA } from "@/lib/etiquetas";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteFalso } from "../helpers/cliente-falso";
import {
  REGLA_DURA_ROTA,
  ahoraMas,
  lista,
  oportunidad,
  resumenDeSemana,
} from "../helpers/d1-datos";
import { renderConCliente } from "../helpers/render";
import resumenReal from "../fixtures/resumen-real-924.json";

beforeEach(() => {
  window.sessionStorage.clear();
});

function montar(sustitutos: Partial<ClienteGrowth> = {}) {
  const cliente = clienteFalso({
    resumen: async () => resumenDeSemana(),
    listarOportunidades: async () => lista([oportunidad()]),
    ...sustitutos,
  });
  const vista = renderConCliente(<VistaDeBandeja />, cliente);
  return { cliente, ...vista };
}

/** Los filtros con los que se hizo la última petición de la lista. */
function ultimosFiltros(cliente: ReturnType<typeof clienteFalso>) {
  const llamadas = cliente.listarOportunidades.mock.calls;
  return llamadas[llamadas.length - 1][0];
}

describe("Bandeja: orden y contenido", () => {
  it("pide por defecto lo que merece tu tiempo, ordenado por puntuación, y pinta las tarjetas en ese orden", async () => {
    const { cliente } = montar({
      listarOportunidades: async () =>
        lista([
          oportunidad({ id: "a", titulo: "La mejor", puntuacion: 91 }),
          oportunidad({ id: "b", titulo: "La media", puntuacion: 72 }),
          oportunidad({ id: "c", titulo: "La justa", puntuacion: 61 }),
        ]),
    });

    const enlaces = await screen.findAllByRole("link", { name: /\/100/ });
    expect(enlaces.map((e) => e.getAttribute("href"))).toEqual([
      "/oportunidad/a",
      "/oportunidad/b",
      "/oportunidad/c",
    ]);
    expect(enlaces[0]).toHaveTextContent("La mejor");
    expect(cliente.listarOportunidades).toHaveBeenCalledWith({
      estado: ESTADOS_DE_LA_BANDEJA,
      orden: "puntuacion",
      pagina: 1,
      limite: 20,
    });
  });

  it("con el cliente de demostración las puntuaciones salen de mayor a menor", async () => {
    renderConCliente(<Bandeja />, clienteDemo({ retardoMs: 0 }));
    const enlaces = await screen.findAllByRole("link", { name: /\/100/ });
    const puntuaciones = enlaces.map((e) =>
      Number(/Puntuación (\d+)\/100/.exec(e.textContent ?? "")?.[1])
    );
    expect(puntuaciones.length).toBeGreaterThan(2);
    expect(puntuaciones).toEqual([...puntuaciones].sort((a, b) => b - a));
  });

  it("cada tarjeta enseña objetivo, estado, tipo de destino y la regla que bloquea", async () => {
    montar({
      listarOportunidades: async () =>
        lista([
          oportunidad({
            id: "blq",
            titulo: "Con bloqueo",
            estado: "bloqueada",
            datos: { tipoDestino: "directorio" },
            borradorActual: {
              id: "bo",
              version: 1,
              tipo: "email",
              estado: "bloqueado",
              editadoPorHumano: false,
              resultado: "bloquea",
              reglasFallidas: [REGLA_DURA_ROTA],
            },
          }),
        ]),
    });
    const tarjeta = await screen.findByRole("link", { name: /Con bloqueo/ });
    expect(tarjeta).toHaveTextContent("C · Backlinks");
    expect(tarjeta).toHaveTextContent("Bloqueada");
    expect(tarjeta).toHaveTextContent("Directorio");
    expect(tarjeta).toHaveTextContent("Bloquea: Sin términos prohibidos");
  });

  it("una oportunidad con expiraEn pasada lleva el chip «Vencida»; una a punto, «Caduca en N d»", async () => {
    montar({
      listarOportunidades: async () =>
        lista([
          oportunidad({
            id: "v",
            titulo: "Ya venció",
            expiraEn: ahoraMas(-2),
            diasParaCaducar: -2,
          }),
          oportunidad({
            id: "p",
            titulo: "Vence pronto",
            expiraEn: ahoraMas(3.5),
            diasParaCaducar: 4,
          }),
          oportunidad({
            id: "l",
            titulo: "Con margen",
            expiraEn: ahoraMas(40.5),
            diasParaCaducar: 41,
          }),
        ]),
    });
    const vencida = await screen.findByRole("link", { name: /Ya venció/ });
    expect(within(vencida).getByText("Vencida")).toBeInTheDocument();
    const pronto = screen.getByRole("link", { name: /Vence pronto/ });
    expect(within(pronto).getByText("Caduca en 3 d")).toBeInTheDocument();
    const margen = screen.getByRole("link", { name: /Con margen/ });
    expect(within(margen).getByText("Caduca en 40 d")).toBeInTheDocument();
  });

  it("el texto de un tercero con HTML se pinta como texto, no como HTML", async () => {
    const { container } = montar({
      listarOportunidades: async () =>
        lista([
          oportunidad({
            titulo: '<img src=x onerror="window.__pwned=1"> Oferta',
            extracto: "<script>window.__pwned=2</script>Texto del extracto",
            dominio: "<b>malo</b>.example",
          }),
        ]),
    });
    expect(
      await screen.findByText(/<img src=x onerror="window.__pwned=1"> Oferta/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/<script>window.__pwned=2<\/script>Texto del extracto/)
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("la tarjeta es un solo enlace a la Revisión: nada de enlaces anidados al exterior", async () => {
    montar({
      listarOportunidades: async () =>
        lista([oportunidad({ id: "con/barra", url: "javascript:alert(1)" })]),
    });
    const enlaces = await screen.findAllByRole("link");
    const tarjetas = enlaces.filter((e) =>
      (e.getAttribute("href") ?? "").startsWith("/oportunidad/")
    );
    expect(tarjetas).toHaveLength(1);
    expect(tarjetas[0]).toHaveAttribute("href", "/oportunidad/con%2Fbarra");
    expect(document.querySelector('a[href^="javascript"]')).toBeNull();
  });
});

describe("Bandeja: filtros", () => {
  it("el objetivo (A/B/C) se pide al servidor y vuelve a la primera página", async () => {
    const user = userEvent.setup();
    const { cliente } = montar();
    await screen.findByRole("link", { name: /\/100/ });

    await user.click(screen.getByRole("radio", { name: "C · Backlinks" }));

    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({
        objetivo: "BACKLINKS",
        pagina: 1,
      })
    );
    await user.click(
      screen.getByRole("radio", { name: "B · Clientes potenciales" })
    );
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ objetivo: "LEADS" })
    );
    // Volver a «Todos» ya estaba en la caché (frescura de 15 s): no hace falta
    // otra petición, pero la pantalla tiene que reflejarlo.
    await user.click(screen.getByRole("radio", { name: "Todos" }));
    expect(screen.getByRole("radio", { name: "Todos" })).toBeChecked();
    expect(
      screen.queryByRole("button", { name: "Quitar filtros" })
    ).not.toBeInTheDocument();
  });

  it("las etiquetas de los objetivos son las del plan", async () => {
    montar();
    await screen.findByRole("link", { name: /\/100/ });
    expect(
      screen.getByRole("radio", { name: "A · Tráfico y marca" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "B · Clientes potenciales" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "C · Backlinks" })
    ).toBeInTheDocument();
  });

  it("el estado se filtra con el selector: «Todas» quita el filtro y uno concreto manda solo ese", async () => {
    const user = userEvent.setup();
    const { cliente } = montar();
    await screen.findByRole("link", { name: /\/100/ });

    await user.selectOptions(screen.getByLabelText("Estado"), "bloqueada");
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ estado: ["bloqueada"] })
    );

    await user.selectOptions(screen.getByLabelText("Estado"), "todas");
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).not.toHaveProperty("estado")
    );
  });

  it("el selector de estado enseña cuántas hay de cada uno", async () => {
    const conteos = {
      ...lista([]).conteos.porEstado,
      bloqueada: 4,
      pendiente_aprobacion: 7,
    };
    montar({
      listarOportunidades: async () =>
        lista([oportunidad()], { conteos: { porEstado: conteos } }),
    });
    await screen.findByRole("link", { name: /\/100/ });
    expect(
      screen.getByRole("option", { name: "Bloqueada (4)" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Por revisar (7)" })
    ).toBeInTheDocument();
    // «Para mirar» suma los estados de la bandeja.
    expect(
      screen.getByRole("option", { name: "Para mirar (11)" })
    ).toBeInTheDocument();
  });

  it("el nicho se ofrece a partir de los que han salido en las listas y filtra por slug", async () => {
    const user = userEvent.setup();
    const { cliente } = montar({
      listarOportunidades: async () =>
        lista([
          oportunidad({
            id: "a",
            nicho: { id: "n1", slug: "peluqueria", nombre: "Peluquería" },
          }),
          oportunidad({
            id: "b",
            nicho: { id: "n2", slug: "barberia", nombre: "Barbería" },
          }),
        ]),
    });
    await screen.findAllByRole("link", { name: /\/100/ });

    await user.selectOptions(screen.getByLabelText("Nicho"), "barberia");

    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ nicho: "barberia" })
    );
  });

  it("el tipo de destino se filtra", async () => {
    const user = userEvent.setup();
    const { cliente } = montar();
    await screen.findByRole("link", { name: /\/100/ });
    await user.selectOptions(
      screen.getByLabelText("Tipo de destino"),
      "prensa"
    );
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ tipoDestino: "prensa" })
    );
  });

  it("el orden se puede cambiar", async () => {
    const user = userEvent.setup();
    const { cliente } = montar();
    await screen.findByRole("link", { name: /\/100/ });
    await user.selectOptions(screen.getByLabelText("Ordenar por"), "caducan");
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ orden: "caducan" })
    );
  });

  it("«Quitar filtros» vuelve a lo de por defecto y solo sale si hay filtros", async () => {
    const user = userEvent.setup();
    const { cliente } = montar();
    await screen.findByRole("link", { name: /\/100/ });
    expect(
      screen.queryByRole("button", { name: "Quitar filtros" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "C · Backlinks" }));
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ objetivo: "BACKLINKS" })
    );
    await user.click(
      await screen.findByRole("button", { name: "Quitar filtros" })
    );

    expect(screen.getByRole("radio", { name: "Todos" })).toBeChecked();
    expect(
      screen.queryByRole("button", { name: "Quitar filtros" })
    ).not.toBeInTheDocument();
    // Y lo que se enseña vuelve a ser la lista de por defecto.
    expect(
      await screen.findByRole("link", { name: /\/100/ })
    ).toBeInTheDocument();
  });

  it("los filtros se recuerdan al volver a la Bandeja en la misma pestaña (pero no la página)", async () => {
    const user = userEvent.setup();
    const primera = montar();
    await screen.findByRole("link", { name: /\/100/ });
    await user.click(
      screen.getByRole("radio", { name: "A · Tráfico y marca" })
    );
    await waitFor(() =>
      expect(window.sessionStorage.getItem(CLAVE_DE_FILTROS)).toContain(
        "TRAFICO_MARCA"
      )
    );
    primera.unmount();

    const segunda = montar();
    await waitFor(() =>
      expect(ultimosFiltros(segunda.cliente)).toMatchObject({
        objetivo: "TRAFICO_MARCA",
        pagina: 1,
      })
    );
    expect(
      await screen.findByRole("radio", { name: "A · Tráfico y marca" })
    ).toBeChecked();
  });

  it("un valor corrupto guardado en la pestaña no rompe nada: se usan los de por defecto", async () => {
    window.sessionStorage.setItem(
      CLAVE_DE_FILTROS,
      JSON.stringify({ estado: "inventado", objetivo: "X", orden: 3 })
    );
    const { cliente } = montar();
    await screen.findByRole("link", { name: /\/100/ });
    expect(ultimosFiltros(cliente)).toEqual({
      estado: ESTADOS_DE_LA_BANDEJA,
      orden: "puntuacion",
      pagina: 1,
      limite: 20,
    });
  });
});

describe("Bandeja: contadores", () => {
  it("enseña los números de la semana, con el tope", async () => {
    montar({
      resumen: async () =>
        resumenDeSemana({
          paraRevisar: 6,
          bloqueadas: 2,
          aprobadasSinGestionar: 1,
          // El contrato real: `estaSemana` = `hechas` + `aprobadasSinGestionar`.
          contactos: {
            estaSemana: 4,
            hechas: 3,
            aprobadasSinGestionar: 1,
            tope: 5,
          },
        }),
    });
    const resumen = await screen.findByRole("list", {
      name: "Resumen de la semana",
    });
    expect(
      within(resumen).getByRole("button", { name: /Por revisar\s*6/ })
    ).toBeInTheDocument();
    expect(
      within(resumen).getByRole("button", { name: /Bloqueadas\s*2/ })
    ).toBeInTheDocument();
    expect(resumen).toHaveTextContent("4 de 5");
  });

  it("con un resumen real del servidor, los contactos de la semana no cuentan dos veces las aprobadas", async () => {
    // En la respuesta real `estaSemana` YA es hechas + aprobadas sin gestionar
    // (3 + 2 = 5): sumarle las aprobadas otra vez daría 7.
    expect(resumenReal.contactos).toMatchObject({
      estaSemana: 5,
      hechas: 3,
      aprobadasSinGestionar: 2,
    });
    montar({
      resumen: async () =>
        resumenReal as unknown as ReturnType<typeof resumenDeSemana>,
    });
    const resumen = await screen.findByRole("list", {
      name: "Resumen de la semana",
    });
    expect(resumen).toHaveTextContent("5 de 20");
    expect(resumen).not.toHaveTextContent("7 de 20");
  });

  it("pulsar un contador filtra por ese estado y volver a pulsarlo lo quita", async () => {
    const user = userEvent.setup();
    const { cliente } = montar();
    const boton = await screen.findByRole("button", { name: /Bloqueadas/ });

    await user.click(boton);
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ estado: ["bloqueada"] })
    );
    expect(boton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Estado")).toHaveValue("bloqueada");

    // Volver a pulsarlo quita el filtro (la lista por defecto sigue en caché).
    await user.click(boton);
    expect(boton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Estado")).toHaveValue("bandeja");
  });

  it("si el resumen falla, la lista sigue funcionando", async () => {
    montar({
      resumen: async () => {
        throw new ErrorDeCliente(500, "x");
      },
    });
    expect(
      await screen.findByText(/No se pudieron cargar los contadores/)
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /\/100/ })
    ).toBeInTheDocument();
  });

  it("si Growth está en pausa, lo dice con un enlace a Ajustes", async () => {
    montar({ resumen: async () => resumenDeSemana({ pausa: true }) });
    expect(
      await screen.findByText("Growth está en pausa.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ajustes" })).toHaveAttribute(
      "href",
      "/ajustes"
    );
  });
});

describe("Bandeja: estado vacío honesto", () => {
  it("sin nada que mirar dice cuántas candidatas se descartaron esta semana y por qué", async () => {
    montar({
      listarOportunidades: async () => lista([]),
      resumen: async () =>
        resumenDeSemana({
          descartesUltimos7Dias: {
            total: 7,
            porMotivo: [
              { codigo: "irrelevante", n: 4 },
              { codigo: "idioma", n: 2 },
              { codigo: "bajo_umbral", n: 1 },
            ],
          },
        }),
    });
    expect(
      await screen.findByRole("heading", {
        name: "Esta semana no hay nada que merezca tu tiempo",
      })
    ).toBeInTheDocument();
    expect(await screen.findByText(/se descartaron/)).toHaveTextContent(
      "En los últimos 7 días se descartaron 7 candidatas"
    );
    expect(screen.getByText(/Irrelevante:/)).toHaveTextContent(
      "Irrelevante: 4"
    );
    expect(screen.getByText(/Otro idioma:/)).toHaveTextContent(
      "Otro idioma: 2"
    );
    expect(screen.getByText(/Bajo el umbral/)).toHaveTextContent(
      "Bajo el umbral de puntuación: 1"
    );
  });

  it("con cero descartes lo dice tal cual en vez de inventar actividad", async () => {
    montar({
      listarOportunidades: async () => lista([]),
      resumen: async () => resumenDeSemana({ ultimaEjecucion: null }),
    });
    expect(
      await screen.findByText(
        "En los últimos 7 días no se ha descartado ninguna candidata."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("El agente todavía no ha hecho ninguna ejecución.")
    ).toBeInTheDocument();
  });

  it("dice cuándo corrió el agente por última vez y cómo terminó", async () => {
    montar({
      listarOportunidades: async () => lista([]),
      resumen: async () =>
        resumenDeSemana({
          ultimaEjecucion: {
            id: "e",
            disparador: "programada",
            estado: "error",
            inicio: ahoraMas(-2),
            fin: ahoraMas(-2),
          },
        }),
    });
    expect(
      await screen.findByText(
        /La última ejecución del agente fue hace 2 días y terminó con error/
      )
    ).toBeInTheDocument();
  });

  it("si el resumen no carga, no finge saber qué se descartó", async () => {
    montar({
      listarOportunidades: async () => lista([]),
      resumen: async () => {
        throw new ErrorDeCliente(500, "x");
      },
    });
    expect(
      await screen.findByText(/no puedo decirte qué se quedó fuera/)
    ).toBeInTheDocument();
  });

  it("con filtros activos y sin resultados NO dice «nada que merezca tu tiempo»: dice que los filtros no encajan", async () => {
    const user = userEvent.setup();
    montar({
      listarOportunidades: async (filtros) =>
        lista(filtros?.objetivo ? [] : [oportunidad()]),
    });
    await screen.findByRole("link", { name: /\/100/ });
    await user.click(
      screen.getByRole("radio", { name: "A · Tráfico y marca" })
    );
    expect(
      await screen.findByText("Ninguna oportunidad encaja con estos filtros")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Esta semana no hay nada que merezca tu tiempo")
    ).not.toBeInTheDocument();
  });

  it("con ?vacio=1 en la demostración sale el estado vacío con los descartes de la semana", async () => {
    renderConCliente(<Bandeja />, clienteDemo({ retardoMs: 0, vacio: true }));
    expect(
      await screen.findByText("Esta semana no hay nada que merezca tu tiempo")
    ).toBeInTheDocument();
    expect(await screen.findByText(/se descartaron/)).toBeInTheDocument();
  });

  it("si la lista falla, error con «Reintentar» (sin esqueleto eterno)", async () => {
    const user = userEvent.setup();
    let llamada = 0;
    const { cliente } = montar({
      listarOportunidades: async () => {
        llamada += 1;
        if (llamada === 1) throw new ErrorDeCliente(503, "x");
        return lista([oportunidad()]);
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cargar la bandeja"
    );
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("link", { name: /\/100/ })
    ).toBeInTheDocument();
    expect(cliente.listarOportunidades).toHaveBeenCalledTimes(2);
  });
});

describe("Bandeja: paginación", () => {
  it("con más de una página enseña el rango y pide la siguiente", async () => {
    const user = userEvent.setup();
    const { cliente } = montar({
      listarOportunidades: async (filtros) =>
        lista([oportunidad({ id: `p${filtros?.pagina}` })], {
          total: 45,
          pagina: filtros?.pagina ?? 1,
          limite: 20,
        }),
    });
    expect(await screen.findByText("1–20 de 45")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ pagina: 2 })
    );
    expect(await screen.findByText("21–40 de 45")).toBeInTheDocument();
  });

  it("si la página en la que estabas se queda vacía, ofrece volver a la primera", async () => {
    const user = userEvent.setup();
    const { cliente } = montar({
      listarOportunidades: async (filtros) =>
        filtros?.pagina === 2
          ? // Ya solo quedan 3: la página 2 no existe.
            lista([], { total: 3, pagina: 2 })
          : lista([oportunidad()], { total: 30, pagina: 1 }),
    });
    await screen.findByRole("link", { name: /\/100/ });
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    const volver = await screen.findByRole("button", {
      name: "Volver a la primera página",
    });

    await user.click(volver);

    expect(
      await screen.findByRole("link", { name: /\/100/ })
    ).toBeInTheDocument();
    expect(cliente.listarOportunidades).toHaveBeenCalledWith(
      expect.objectContaining({ pagina: 2 })
    );
  });
});

describe("Añadir URL", () => {
  async function abrirDialogo(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Añadir URL" }));
    return screen.getByRole("dialog", { name: "Añadir URL" });
  }

  it("abre un diálogo con la dirección, el objetivo (Backlinks por defecto) y la nota", async () => {
    const user = userEvent.setup();
    montar();
    const dialogo = await abrirDialogo(user);
    expect(
      within(dialogo).getByLabelText("Dirección de la página")
    ).toHaveFocus();
    expect(within(dialogo).getByLabelText("Objetivo")).toHaveValue("BACKLINKS");
    expect(within(dialogo).getByLabelText(/Nota/)).toBeInTheDocument();
  });

  it.each([
    "javascript:alert(document.cookie)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://servidor.example/archivo",
    "revista.example/sin-esquema",
    "https://",
    "   ",
  ])("rechaza «%s» sin llamar al backend", async (direccion) => {
    const user = userEvent.setup();
    const { cliente } = montar();
    const dialogo = await abrirDialogo(user);
    const campo = within(dialogo).getByLabelText("Dirección de la página");
    if (direccion.trim()) await user.type(campo, direccion);

    await user.click(
      within(dialogo).getByRole("button", { name: "Añadir URL" })
    );

    expect(cliente.anadirUrl).not.toHaveBeenCalled();
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(dialogo.textContent).toMatch(
      /Escribe la dirección de la página|empiece por http:\/\/ o https:\/\//
    );
    // El diálogo sigue abierto con lo escrito.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("una dirección demasiado larga o una nota de más de 500 caracteres no salen", async () => {
    const user = userEvent.setup();
    const { cliente } = montar();
    const dialogo = await abrirDialogo(user);
    await user.click(within(dialogo).getByLabelText("Dirección de la página"));
    await user.paste(`https://revista.example/${"a".repeat(2001)}`);
    await user.click(within(dialogo).getByLabelText(/Nota/));
    await user.paste("n".repeat(501));
    await user.click(
      within(dialogo).getByRole("button", { name: "Añadir URL" })
    );
    expect(cliente.anadirUrl).not.toHaveBeenCalled();
    expect(dialogo).toHaveTextContent("no puede pasar de 2000 caracteres");
    expect(dialogo).toHaveTextContent("no puede pasar de 500 caracteres");
  });

  it("con una URL válida la manda con el objetivo y la nota, cierra el diálogo y avisa", async () => {
    const user = userEvent.setup();
    const { cliente } = montar({
      anadirUrl: async () => ({
        creada: true,
        id: "nueva-1",
        estado: "detectada",
      }),
    });
    const dialogo = await abrirDialogo(user);
    await user.type(
      within(dialogo).getByLabelText("Dirección de la página"),
      "  https://asociacion.example/directorio  "
    );
    await user.selectOptions(
      within(dialogo).getByLabelText("Objetivo"),
      "LEADS"
    );
    await user.type(
      within(dialogo).getByLabelText(/Nota/),
      "Me la pasó una clienta"
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Añadir URL" })
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(cliente.anadirUrl).toHaveBeenCalledTimes(1);
    expect(cliente.anadirUrl).toHaveBeenCalledWith({
      url: "https://asociacion.example/directorio",
      objetivoPrincipal: "LEADS",
      nota: "Me la pasó una clienta",
    });
    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent("URL añadida");
    expect(
      within(aviso).getByRole("link", { name: "Ver la oportunidad" })
    ).toHaveAttribute("href", "/oportunidad/nueva-1");
  });

  it("sin nota no manda el campo", async () => {
    const user = userEvent.setup();
    const { cliente } = montar({
      anadirUrl: async () => ({ creada: true, id: "x", estado: "detectada" }),
    });
    const dialogo = await abrirDialogo(user);
    await user.type(
      within(dialogo).getByLabelText("Dirección de la página"),
      "https://a.example/x"
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Añadir URL" })
    );
    await waitFor(() => expect(cliente.anadirUrl).toHaveBeenCalled());
    expect(cliente.anadirUrl.mock.calls[0][0]).toEqual({
      url: "https://a.example/x",
      objetivoPrincipal: "BACKLINKS",
    });
  });

  it("si la URL ya existía, lo dice con su estado y su motivo, y no la reabre", async () => {
    const user = userEvent.setup();
    montar({
      anadirUrl: async () => ({
        creada: false,
        id: "vieja",
        estado: "descartada",
        motivoDescarte: "Es la web de un competidor.",
      }),
    });
    const dialogo = await abrirDialogo(user);
    await user.type(
      within(dialogo).getByLabelText("Dirección de la página"),
      "https://competidor.example/"
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Añadir URL" })
    );
    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent(
      "Esa URL ya estaba registrada (Descartada)"
    );
    expect(aviso).toHaveTextContent("Es la web de un competidor.");
  });

  it("el error del backend se enseña en el diálogo y lo escrito se queda", async () => {
    const user = userEvent.setup();
    montar({
      anadirUrl: async () => {
        throw new ErrorDeCliente(400, "Esa dirección es de Alhabla.");
      },
    });
    const dialogo = await abrirDialogo(user);
    const campo = within(dialogo).getByLabelText("Dirección de la página");
    await user.type(campo, "https://alhabla.ai/blog");
    await user.click(
      within(dialogo).getByRole("button", { name: "Añadir URL" })
    );
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "Esa dirección es de Alhabla."
    );
    expect(campo).toHaveValue("https://alhabla.ai/blog");
    // Y se puede volver a intentar.
    expect(
      within(dialogo).getByRole("button", { name: "Añadir URL" })
    ).toBeEnabled();
  });

  it("un doble clic en el botón manda una sola petición y lo deja deshabilitado", async () => {
    const user = userEvent.setup();
    let resolver!: (valor: {
      creada: true;
      id: string;
      estado: "detectada";
    }) => void;
    const { cliente } = montar({
      anadirUrl: () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    });
    const dialogo = await abrirDialogo(user);
    await user.type(
      within(dialogo).getByLabelText("Dirección de la página"),
      "https://a.example/x"
    );
    const boton = within(dialogo).getByRole("button", { name: "Añadir URL" });

    await user.dblClick(boton);

    expect(cliente.anadirUrl).toHaveBeenCalledTimes(1);
    expect(
      within(dialogo).getByRole("button", { name: "Añadiendo…" })
    ).toBeDisabled();
    // Mientras vuela no se puede cerrar.
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    resolver({ creada: true, id: "n", estado: "detectada" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(cliente.anadirUrl).toHaveBeenCalledTimes(1);
  });

  it("Cancelar y Escape cierran sin llamar a nadie", async () => {
    const user = userEvent.setup();
    const { cliente } = montar();
    await abrirDialogo(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await abrirDialogo(user);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cliente.anadirUrl).not.toHaveBeenCalled();
  });
});

describe("Bandeja con el cliente de demostración", () => {
  it("se carga sin errores ni esqueletos que se queden", async () => {
    renderConCliente(<Bandeja />, clienteDemo({ retardoMs: 0 }));
    await screen.findAllByRole("link", { name: /\/100/ });
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("añadir una URL de verdad en la demo la deja en la lista de «Todas»", async () => {
    const user = userEvent.setup();
    renderConCliente(<Bandeja />, clienteDemo({ retardoMs: 0 }));
    await user.click(await screen.findByRole("button", { name: "Añadir URL" }));
    const dialogo = screen.getByRole("dialog");
    await user.type(
      within(dialogo).getByLabelText("Dirección de la página"),
      "https://nueva-pagina.example/directorio"
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Añadir URL" })
    );
    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent("URL añadida");

    // Está sin calificar, así que solo sale con el estado «Detectada».
    await user.selectOptions(screen.getByLabelText("Estado"), "detectada");
    expect(
      (await screen.findAllByText("nueva-pagina.example", { exact: false }))
        .length
    ).toBeGreaterThan(0);
  });
});
