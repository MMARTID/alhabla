import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Borradores from "@/app/(panel)/borradores/page";
import { VistaDeBorradores } from "@/components/borradores/vista-de-borradores";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import { clienteFalso } from "../helpers/cliente-falso";
import {
  REGLA_DURA_ROTA,
  AVISO_DE_PARECIDO,
  ahoraMas,
  borradorResumen,
  listaDeBorradores,
} from "../helpers/d1-datos";
import { renderConCliente } from "../helpers/render";

function montar(sustitutos: Partial<ClienteGrowth> = {}) {
  const cliente = clienteFalso({
    listarBorradores: async () => listaDeBorradores([borradorResumen()]),
    ...sustitutos,
  });
  const vista = renderConCliente(<VistaDeBorradores />, cliente);
  return { cliente, ...vista };
}

function ultimosFiltros(cliente: ReturnType<typeof clienteFalso>) {
  const llamadas = cliente.listarBorradores.mock.calls;
  return llamadas[llamadas.length - 1][0];
}

describe("Borradores: grupos", () => {
  it("empieza en «Por revisar» y pide ese grupo", async () => {
    const { cliente } = montar();
    await screen.findByRole("link", { name: /Una recepcionista de IA/ });
    expect(cliente.listarBorradores).toHaveBeenCalledWith({
      grupo: "pendientes",
      orden: "recientes",
      pagina: 1,
      limite: 20,
    });
    expect(
      screen.getByRole("button", { name: /^Por revisar/ })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("los seis grupos llevan su recuento", async () => {
    montar();
    const grupo = await screen.findByRole("group", {
      name: "Estado de los borradores",
    });
    await waitFor(() =>
      expect(
        within(grupo).getByRole("button", { name: "Bloqueados (1)" })
      ).toBeInTheDocument()
    );
    for (const [nombre, n] of [
      ["Por revisar", 2],
      ["Aprobados", 1],
      ["Gestionados", 0],
      ["Caducados", 0],
      ["Descartados", 3],
    ] as const) {
      expect(
        within(grupo).getByRole("button", { name: `${nombre} (${n})` })
      ).toBeInTheDocument();
    }
  });

  it.each([
    ["Bloqueados", "bloqueados"],
    ["Aprobados", "aprobados"],
    ["Gestionados", "gestionados"],
    ["Caducados", "caducados"],
    ["Descartados", "descartados"],
  ])("«%s» pide el grupo %s y lo marca como activo", async (nombre, grupo) => {
    const user = userEvent.setup();
    const { cliente } = montar();
    await screen.findByRole("link", { name: /Una recepcionista de IA/ });

    await user.click(
      screen.getByRole("button", { name: new RegExp(`^${nombre}`) })
    );

    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ grupo, pagina: 1 })
    );
    expect(
      screen.getByRole("button", { name: new RegExp(`^${nombre}`) })
    ).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Borradores: tarjetas", () => {
  it("cada tarjeta es el enlace profundo a su Revisión, ya en esa versión", async () => {
    montar({
      listarBorradores: async () =>
        listaDeBorradores([
          borradorResumen({ id: "bo-77", oportunidadId: "op/9", version: 3 }),
        ]),
    });
    const tarjeta = await screen.findByRole("link", {
      name: /Una recepcionista de IA/,
    });
    expect(tarjeta).toHaveAttribute(
      "href",
      "/oportunidad/op%2F9?borrador=bo-77"
    );
    expect(tarjeta).toHaveTextContent("revista.example");
    expect(tarjeta).toHaveTextContent("versión 3");
    expect(tarjeta).toHaveTextContent("412 caracteres");
  });

  it("un bloqueado enseña el porqué: la regla dura que falla con su detalle", async () => {
    montar({
      listarBorradores: async () =>
        listaDeBorradores([
          borradorResumen({
            estado: "bloqueado",
            resultado: "bloquea",
            reglasFallidas: [REGLA_DURA_ROTA, AVISO_DE_PARECIDO],
          }),
        ]),
    });
    const tarjeta = await screen.findByRole("link", {
      name: /Una recepcionista de IA/,
    });
    expect(tarjeta).toHaveTextContent("Bloqueado");
    expect(tarjeta).toHaveTextContent(
      "Bloquea: Sin términos prohibidos. Usa el término prohibido «número 1»."
    );
    // Y el aviso blando, aparte y como aviso.
    expect(tarjeta).toHaveTextContent(
      "Aviso: Parecido con la versión anterior. Se parece un 38 % a la versión anterior."
    );
  });

  it("un borrador sin reglas fallidas no enseña ninguna", async () => {
    montar();
    const tarjeta = await screen.findByRole("link", {
      name: /Una recepcionista de IA/,
    });
    expect(tarjeta).not.toHaveTextContent("Bloquea:");
    expect(tarjeta).not.toHaveTextContent("Aviso:");
  });

  it("enseña el estado, el resultado, el tipo, el objetivo y el plazo", async () => {
    montar({
      listarBorradores: async () =>
        listaDeBorradores([
          borradorResumen({
            resultado: "aviso",
            editadoPorHumano: true,
            oportunidad: {
              ...borradorResumen().oportunidad,
              expiraEn: ahoraMas(2.5),
            },
          }),
        ]),
    });
    const tarjeta = await screen.findByRole("link", {
      name: /Una recepcionista de IA/,
    });
    expect(tarjeta).toHaveTextContent("Por revisar");
    expect(tarjeta).toHaveTextContent("Con avisos");
    expect(tarjeta).toHaveTextContent("Correo");
    expect(tarjeta).toHaveTextContent("C · Backlinks");
    expect(tarjeta).toHaveTextContent("Editado a mano");
    expect(tarjeta).toHaveTextContent("Caduca en 2 d");
  });

  it("un aprobado cuya oportunidad ya venció lleva el chip «Vencida»", async () => {
    montar({
      listarBorradores: async () =>
        listaDeBorradores([
          borradorResumen({
            estado: "aprobado",
            oportunidad: {
              ...borradorResumen().oportunidad,
              estado: "aprobada",
              expiraEn: ahoraMas(-1),
            },
          }),
        ]),
    });
    expect(await screen.findByText("Vencida")).toBeInTheDocument();
  });

  it("un gestionado enseña el canal, la fecha y el resultado de la gestión", async () => {
    montar({
      listarBorradores: async () =>
        listaDeBorradores([
          borradorResumen({
            estado: "gestionado",
            gestion: {
              canal: "formulario",
              hechaEn: "2026-10-20T10:00:00Z",
              resultado: "pendiente",
            },
            oportunidad: {
              ...borradorResumen().oportunidad,
              estado: "gestionada",
            },
          }),
        ]),
    });
    const tarjeta = await screen.findByRole("link", {
      name: /Una recepcionista de IA/,
    });
    expect(tarjeta).toHaveTextContent("Formulario el");
    expect(tarjeta).toHaveTextContent("Pendiente");
  });

  it("sin asunto, el título es el tipo de borrador", async () => {
    montar({
      listarBorradores: async () =>
        listaDeBorradores([
          borradorResumen({ asunto: null, tipo: "ficha_directorio" }),
        ]),
    });
    expect(
      await screen.findByRole("link", { name: /Ficha de directorio/ })
    ).toBeInTheDocument();
  });

  it("lo que escribió el agente (asunto, vista previa, regla) se pinta como texto", async () => {
    const { container } = montar({
      listarBorradores: async () =>
        listaDeBorradores([
          borradorResumen({
            asunto: '<img src=x onerror="window.__pwned=1">Asunto',
            textoPreview: "<script>window.__pwned=2</script>Vista previa",
            reglasFallidas: [
              {
                regla: "x",
                ok: false,
                dura: true,
                detalle: "<b>detalle</b> en negrita",
              },
            ],
            oportunidad: {
              ...borradorResumen().oportunidad,
              titulo: "<u>Título</u>",
              dominio: "<i>d</i>.example",
            },
          }),
        ]),
    });
    expect(await screen.findByText(/<img src=x onerror/)).toBeInTheDocument();
    expect(
      screen.getByText(/<script>window.__pwned=2<\/script>Vista previa/)
    ).toBeInTheDocument();
    expect(container.querySelector("img, script, b, u, i")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("la tarjeta no contiene enlaces anidados: solo el de la Revisión", async () => {
    montar({
      listarBorradores: async () =>
        listaDeBorradores([
          borradorResumen({
            enlaceUrl: "javascript:alert(1)",
            oportunidad: {
              ...borradorResumen().oportunidad,
              url: "javascript:alert(2)",
            },
          }),
        ]),
    });
    await screen.findByRole("link", { name: /Una recepcionista de IA/ });
    expect(document.querySelectorAll("a[href]")).toHaveLength(1);
    expect(document.querySelector('a[href*="javascript"]')).toBeNull();
  });
});

describe("Borradores: vacíos y errores", () => {
  it.each([
    ["bloqueados", "No hay borradores bloqueados."],
    ["pendientes", "No hay borradores por revisar."],
    ["aprobados", "No hay borradores aprobados pendientes de gestionar."],
    ["gestionados", "Todavía no has gestionado ningún borrador."],
    ["caducados", "Ninguna oportunidad con borrador ha caducado."],
    ["descartados", "No hay borradores descartados."],
  ])("el grupo %s vacío dice la verdad: «%s»", async (grupo, texto) => {
    const user = userEvent.setup();
    montar({ listarBorradores: async () => listaDeBorradores([]) });
    await screen.findByText("No hay borradores por revisar.");
    if (grupo !== "pendientes") {
      const etiqueta = {
        bloqueados: "Bloqueados",
        aprobados: "Aprobados",
        gestionados: "Gestionados",
        caducados: "Caducados",
        descartados: "Descartados",
      }[grupo]!;
      await user.click(
        screen.getByRole("button", { name: new RegExp(`^${etiqueta}`) })
      );
    }
    expect(await screen.findByText(texto)).toBeInTheDocument();
  });

  it("con filtros y sin resultados no dice que no hay borradores: dice que los filtros no encajan", async () => {
    const user = userEvent.setup();
    montar({
      listarBorradores: async (filtros) =>
        listaDeBorradores(filtros?.tipo ? [] : [borradorResumen()]),
    });
    await screen.findByRole("link", { name: /Una recepcionista de IA/ });
    await user.selectOptions(
      screen.getByLabelText("Tipo de borrador"),
      "formulario"
    );
    expect(
      await screen.findByText("Ningún borrador encaja con estos filtros")
    ).toBeInTheDocument();
  });

  it("si falla la carga, error con «Reintentar»", async () => {
    const user = userEvent.setup();
    let llamada = 0;
    montar({
      listarBorradores: async () => {
        llamada += 1;
        if (llamada === 1) throw new ErrorDeCliente(503, "x");
        return listaDeBorradores([borradorResumen()]);
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron cargar los borradores"
    );
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("link", { name: /Una recepcionista de IA/ })
    ).toBeInTheDocument();
  });
});

describe("Borradores: filtros, búsqueda y páginas", () => {
  it("objetivo, tipo y orden se piden al servidor y vuelven a la primera página", async () => {
    const user = userEvent.setup();
    const { cliente } = montar();
    await screen.findByRole("link", { name: /Una recepcionista de IA/ });

    await user.selectOptions(screen.getByLabelText("Objetivo"), "LEADS");
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ objetivo: "LEADS" })
    );
    await user.selectOptions(
      screen.getByLabelText("Tipo de borrador"),
      "email"
    );
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({
        objetivo: "LEADS",
        tipo: "email",
      })
    );
    await user.selectOptions(screen.getByLabelText("Ordenar por"), "caducan");
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ orden: "caducan" })
    );
  });

  it("buscar manda q recortado; la X lo quita", async () => {
    const user = userEvent.setup();
    const { cliente } = montar();
    await screen.findByRole("link", { name: /Una recepcionista de IA/ });

    await user.type(
      screen.getByRole("searchbox", {
        name: "Buscar por asunto, texto o dominio",
      }),
      "  revista  "
    );
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ q: "revista" })
    );

    await user.click(
      screen.getByRole("button", { name: "Quitar la búsqueda" })
    );
    // Sin búsqueda vuelve a la consulta de antes (que sigue fresca en la caché).
    expect(
      screen.queryByRole("button", { name: "Quitar la búsqueda" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", {
        name: "Buscar por asunto, texto o dominio",
      })
    ).toHaveValue("");
  });

  it("buscar con Enter también funciona y una búsqueda vacía no manda q", async () => {
    const user = userEvent.setup();
    const { cliente } = montar();
    await screen.findByRole("link", { name: /Una recepcionista de IA/ });
    const caja = screen.getByRole("searchbox", {
      name: "Buscar por asunto, texto o dominio",
    });
    await user.type(caja, "x{Enter}");
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ q: "x" })
    );
    await user.clear(caja);
    await user.type(caja, "   {Enter}");
    // Una búsqueda en blanco equivale a no buscar: desaparece la X.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Quitar la búsqueda" })
      ).not.toBeInTheDocument()
    );
  });

  it("la búsqueda no pasa de 100 caracteres", async () => {
    const user = userEvent.setup();
    const { cliente } = montar();
    await screen.findByRole("link", { name: /Una recepcionista de IA/ });
    const caja = screen.getByRole("searchbox", {
      name: "Buscar por asunto, texto o dominio",
    });
    await user.click(caja);
    await user.paste("a".repeat(150));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(ultimosFiltros(cliente)?.q?.length).toBe(100));
  });

  it("al cambiar de grupo se vuelve a la primera página", async () => {
    const user = userEvent.setup();
    const { cliente } = montar({
      listarBorradores: async (filtros) =>
        listaDeBorradores([borradorResumen({ id: `p${filtros?.pagina}` })], {
          total: 45,
          pagina: filtros?.pagina ?? 1,
        }),
    });
    expect(await screen.findByText("1–20 de 45")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({ pagina: 2 })
    );
    await user.click(screen.getByRole("button", { name: /^Aprobados/ }));
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({
        grupo: "aprobados",
        pagina: 1,
      })
    );
  });
});

describe("Borradores con el cliente de demostración", () => {
  it("la página carga sin errores y deja de mostrar esqueletos", async () => {
    renderConCliente(<Borradores />, clienteDemo({ retardoMs: 0 }));
    await screen.findAllByRole("link", { name: /versión/ });
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("«Caducados» enseña algo con los datos de demostración, y ese borrador no sale en «Descartados»", async () => {
    const user = userEvent.setup();
    renderConCliente(<Borradores />, clienteDemo({ retardoMs: 0 }));
    await screen.findAllByRole("link", { name: /versión/ });
    const grupo = screen.getByRole("group", {
      name: "Estado de los borradores",
    });
    await user.click(within(grupo).getByRole("button", { name: /^Caducados/ }));
    const tarjeta = await screen.findByRole("link", {
      name: /Concurso de herramientas digitales/,
    });
    expect(tarjeta).toHaveAttribute(
      "href",
      "/oportunidad/demo-op-14?borrador=demo-bo-14-1"
    );
    expect(
      screen.queryByText("Ninguna oportunidad con borrador ha caducado.")
    ).toBeNull();

    await user.click(
      within(grupo).getByRole("button", { name: /^Descartados/ })
    );
    await screen.findAllByRole("link", { name: /versión/ });
    expect(
      screen.queryByRole("link", { name: /Concurso de herramientas digitales/ })
    ).toBeNull();
  });

  it("los bloqueados de la demo traen el porqué", async () => {
    const user = userEvent.setup();
    renderConCliente(<Borradores />, clienteDemo({ retardoMs: 0 }));
    await screen.findAllByRole("link", { name: /versión/ });
    await user.click(screen.getByRole("button", { name: /^Bloqueados/ }));
    const tarjetas = await screen.findAllByRole("link", { name: /Bloquea:/ });
    expect(tarjetas.length).toBeGreaterThan(0);
    for (const tarjeta of tarjetas) {
      expect(tarjeta).toHaveAttribute(
        "href",
        expect.stringMatching(/^\/oportunidad\/[^?]+\?borrador=/)
      );
    }
  });
});
