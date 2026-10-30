import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CLAVE_DE_FILTROS,
  FILTROS_POR_DEFECTO,
  aFiltrosDeApi,
  filtrosIniciales,
  hayFiltrosActivos,
  leerFiltrosGuardados,
  normalizarMenciona,
} from "@/components/bandeja/estado-de-filtros";
import { VistaDeBandeja } from "@/components/bandeja/vista-de-bandeja";
import { VistaDeRevision } from "@/components/revision/vista-de-revision";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import { ESTADOS_DE_LA_BANDEJA } from "@/lib/etiquetas";
import { clienteFalso } from "../helpers/cliente-falso";
import {
  detalle,
  lista,
  oportunidad,
  resumenDeSemana,
} from "../helpers/d1-datos";
import { competidor } from "../helpers/d2-datos";
import { renderConCliente } from "../helpers/render";

beforeEach(() => {
  window.sessionStorage.clear();
});

const COMPETIDORES = [
  competidor({ id: "a", nombre: "HeyDiga", dominio: "heydiga.example" }),
  competidor({ id: "b", nombre: "Fonio", dominio: "fonio.example" }),
  competidor({
    id: "p",
    nombre: "Propuesto",
    dominio: "propuesto.example",
    estado: "propuesto",
    origen: "agente",
  }),
];

function montar(
  sustitutos: Partial<ClienteGrowth> = {},
  propiedades: { mencionaInicial?: string } = {}
) {
  const cliente = clienteFalso({
    resumen: async () => resumenDeSemana(),
    listarOportunidades: async () => lista([oportunidad()]),
    competidores: async () => ({ data: COMPETIDORES }),
    ...sustitutos,
  });
  renderConCliente(<VistaDeBandeja {...propiedades} />, cliente);
  return cliente;
}

function ultimosFiltros(cliente: ReturnType<typeof clienteFalso>) {
  const llamadas = cliente.listarOportunidades.mock.calls;
  return llamadas[llamadas.length - 1][0];
}

describe("Bandeja · «Menciona a X»", () => {
  it("la tarjeta lleva la insignia con el nombre de cada competidor mencionado", async () => {
    montar({
      listarOportunidades: async () =>
        lista([
          oportunidad({
            id: "uno",
            titulo: "Con una mención",
            datos: { competidoresMencionados: ["heydiga.example"] },
          }),
          oportunidad({
            id: "dos",
            titulo: "Con dos menciones",
            datos: {
              competidoresMencionados: ["heydiga.example", "fonio.example"],
            },
          }),
          oportunidad({ id: "cero", titulo: "Sin menciones" }),
        ]),
    });
    expect(
      await screen.findByRole("link", { name: /Con una mención/ })
    ).toHaveTextContent("Menciona a HeyDiga");
    expect(
      screen.getByRole("link", { name: /Con dos menciones/ })
    ).toHaveTextContent("Menciona a HeyDiga y Fonio");
    expect(
      screen.getByRole("link", { name: /Sin menciones/ })
    ).not.toHaveTextContent("Menciona a");
  });

  it("si los competidores no cargan, la insignia sale con el dominio y la Bandeja sigue funcionando", async () => {
    montar({
      competidores: async () => {
        throw new ErrorDeCliente(500, "Fallo.");
      },
      listarOportunidades: async () =>
        lista([
          oportunidad({
            titulo: "Con mención",
            datos: { competidoresMencionados: ["heydiga.example"] },
          }),
        ]),
    });
    expect(
      await screen.findByRole("link", { name: /Con mención/ })
    ).toHaveTextContent("Menciona a heydiga.example");
    // Y no hay selector de competidor: no se sabe a cuáles ofrecer.
    expect(screen.queryByLabelText("Menciona a")).toBeNull();
  });

  it("muchos competidores se resumen: «A, B y 2 más»", async () => {
    montar({
      listarOportunidades: async () =>
        lista([
          oportunidad({
            titulo: "Con muchas",
            datos: {
              competidoresMencionados: [
                "heydiga.example",
                "fonio.example",
                "x.example",
                "y.example",
              ],
            },
          }),
        ]),
    });
    expect(
      await screen.findByRole("link", { name: /Con muchas/ })
    ).toHaveTextContent("Menciona a HeyDiga, Fonio y 2 más");
  });

  it("un nombre con HTML o un dominio raro se pinta como texto", async () => {
    const { container } = renderConCliente(
      <VistaDeBandeja />,
      clienteFalso({
        resumen: async () => resumenDeSemana(),
        listarOportunidades: async () =>
          lista([
            oportunidad({
              titulo: "Hostil",
              datos: { competidoresMencionados: ["a.example"] },
            }),
          ]),
        competidores: async () => ({
          data: [
            competidor({
              nombre: "<img src=x onerror=alert(1)>",
              dominio: "a.example",
            }),
          ],
        }),
      })
    );
    await screen.findByText(/Menciona a <img src=x onerror=alert\(1\)>/);
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("Bandeja · filtro «Menciona a»", () => {
  it("ofrece a los competidores confirmados (no a los propuestos) y filtra por su dominio", async () => {
    const usuario = userEvent.setup();
    const cliente = montar();
    const selector = await screen.findByLabelText("Menciona a");
    expect(
      within(selector)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual(["Cualquiera", "HeyDiga", "Fonio"]);
    await usuario.selectOptions(selector, "fonio.example");
    await waitFor(() =>
      expect(ultimosFiltros(cliente)).toMatchObject({
        menciona: "fonio.example",
      })
    );
    expect(ultimosFiltros(cliente)).toMatchObject({ pagina: 1 });
    // Volver a «Cualquiera» lo quita (la lista sin filtro ya estaba en caché).
    await usuario.selectOptions(screen.getByLabelText("Menciona a"), "");
    await waitFor(() =>
      expect(screen.getByLabelText("Menciona a")).toHaveValue("")
    );
    expect(
      JSON.parse(window.sessionStorage.getItem(CLAVE_DE_FILTROS)!)
    ).toMatchObject({ menciona: "" });
    expect(screen.queryByRole("button", { name: "Quitar filtros" })).toBeNull();
  });

  it("cuenta como filtro activo: sale «Quitar filtros» y lo deja como estaba", async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.selectOptions(
      await screen.findByLabelText("Menciona a"),
      "heydiga.example"
    );
    await usuario.click(
      await screen.findByRole("button", { name: "Quitar filtros" })
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Menciona a")).toHaveValue("")
    );
    expect(screen.queryByRole("button", { name: "Quitar filtros" })).toBeNull();
  });

  it("no hay selector si no hay a quién ofrecer", async () => {
    montar({ competidores: async () => ({ data: [COMPETIDORES[2]] }) });
    await screen.findByRole("link", { name: /Recepcionistas de IA/ });
    expect(screen.queryByLabelText("Menciona a")).toBeNull();
  });

  it("se recuerda al volver a la Bandeja en la misma pestaña", async () => {
    const usuario = userEvent.setup();
    montar();
    await usuario.selectOptions(
      await screen.findByLabelText("Menciona a"),
      "heydiga.example"
    );
    expect(window.sessionStorage.getItem(CLAVE_DE_FILTROS)).toContain(
      "heydiga.example"
    );
  });

  it("con el cliente de demostración trae solo las oportunidades que mencionan a ese competidor", async () => {
    const usuario = userEvent.setup();
    renderConCliente(<VistaDeBandeja />, clienteDemo({ retardoMs: 0 }));
    const selector = await screen.findByLabelText("Menciona a");
    await usuario.selectOptions(selector, "competidor-ficticio.example");
    await waitFor(() =>
      expect(screen.getByText("3 oportunidades")).toBeInTheDocument()
    );
    for (const tarjeta of screen.getAllByRole("link", { name: /\/100/ })) {
      expect(tarjeta).toHaveTextContent("Menciona a");
      expect(tarjeta).toHaveTextContent("Competidor ficticio");
    }
  });
});

describe("Bandeja · abierta con ?menciona=", () => {
  it("abre ya filtrada por ese competidor y con todos los estados, para que cuente lo que decía el número de Competencia", async () => {
    const cliente = montar({}, { mencionaInicial: "heydiga.example" });
    await screen.findByRole("link", { name: /Recepcionistas de IA/ });
    expect(cliente.listarOportunidades).toHaveBeenCalledWith({
      menciona: "heydiga.example",
      orden: "puntuacion",
      pagina: 1,
      limite: 20,
    });
    expect(await screen.findByLabelText("Menciona a")).toHaveValue(
      "heydiga.example"
    );
    expect(screen.getByLabelText("Estado")).toHaveValue("todas");
    expect(window.sessionStorage.getItem(CLAVE_DE_FILTROS)).toContain(
      "heydiga.example"
    );
  });

  it("normaliza el dominio de la URL y se queda con los de por defecto si no lo parece", async () => {
    const cliente = montar({}, { mencionaInicial: " WWW.HeyDiga.example " });
    await screen.findByRole("link", { name: /Recepcionistas de IA/ });
    expect(cliente.listarOportunidades.mock.calls[0][0]).toMatchObject({
      menciona: "heydiga.example",
    });
  });

  it("un valor que no es un dominio se ignora", async () => {
    const cliente = montar({}, { mencionaInicial: "javascript:alert(1)" });
    await screen.findByRole("link", { name: /Recepcionistas de IA/ });
    expect(cliente.listarOportunidades).toHaveBeenCalledWith({
      estado: ESTADOS_DE_LA_BANDEJA,
      orden: "puntuacion",
      pagina: 1,
      limite: 20,
    });
  });
});

describe("los filtros de la Bandeja con «menciona»", () => {
  it("normalizarMenciona solo deja pasar dominios", () => {
    expect(normalizarMenciona("heydiga.example")).toBe("heydiga.example");
    expect(normalizarMenciona("  WWW.Fonio.example ")).toBe("fonio.example");
    for (const malo of [
      "",
      "   ",
      "javascript:alert(1)",
      "a b.example",
      "<b>x</b>",
      "a".repeat(254),
      "-raro.example",
      42,
      null,
      undefined,
    ]) {
      expect(normalizarMenciona(malo), String(malo)).toBe("");
    }
  });

  it("es un filtro más: activo, y a la API solo si está", () => {
    expect(hayFiltrosActivos(FILTROS_POR_DEFECTO)).toBe(false);
    const con = { ...FILTROS_POR_DEFECTO, menciona: "heydiga.example" };
    expect(hayFiltrosActivos(con)).toBe(true);
    expect(aFiltrosDeApi(con)).toMatchObject({ menciona: "heydiga.example" });
    expect(aFiltrosDeApi(FILTROS_POR_DEFECTO)).not.toHaveProperty("menciona");
  });

  it("se lee de la memoria de la pestaña, y un valor corrupto vuelve a «cualquiera»", () => {
    window.sessionStorage.setItem(
      CLAVE_DE_FILTROS,
      JSON.stringify({ menciona: "fonio.example" })
    );
    expect(leerFiltrosGuardados().menciona).toBe("fonio.example");
    window.sessionStorage.setItem(
      CLAVE_DE_FILTROS,
      JSON.stringify({ menciona: "javascript:alert(1)" })
    );
    expect(leerFiltrosGuardados().menciona).toBe("");
    window.sessionStorage.setItem(
      CLAVE_DE_FILTROS,
      JSON.stringify({ menciona: 7 })
    );
    expect(leerFiltrosGuardados().menciona).toBe("");
  });

  it("filtrosIniciales: la URL manda sobre lo recordado, con todos los estados, y se recuerda", () => {
    window.sessionStorage.setItem(
      CLAVE_DE_FILTROS,
      JSON.stringify({ objetivo: "LEADS", menciona: "fonio.example" })
    );
    expect(filtrosIniciales(undefined)).toMatchObject({
      objetivo: "LEADS",
      menciona: "fonio.example",
      estado: "bandeja",
    });
    const desdeLaUrl = filtrosIniciales("heydiga.example");
    expect(desdeLaUrl).toMatchObject({
      objetivo: "LEADS",
      menciona: "heydiga.example",
      estado: "todas",
      pagina: 1,
    });
    expect(leerFiltrosGuardados().menciona).toBe("heydiga.example");
  });
});

describe("Revisión · «Menciona a X»", () => {
  function montarRevision(
    menciones: string[] | undefined,
    ...extra: Array<Partial<ClienteGrowth>>
  ) {
    const cliente = clienteFalso({
      detalleDeOportunidad: async () =>
        detalle({
          datos: {
            tipoDestino: "comparativa",
            competidoresMencionados: menciones,
          },
        }),
      competidores: async () => ({ data: COMPETIDORES }),
      ...Object.assign({}, ...extra),
    });
    renderConCliente(<VistaDeRevision id="op-1" />, cliente);
    return cliente;
  }

  it("la cabecera lleva la insignia y la columna del destino, un enlace a la Bandeja filtrada por cada uno", async () => {
    montarRevision(["heydiga.example", "fonio.example"]);
    const titulo = await screen.findByRole("heading", { level: 1 });
    const cabecera = titulo.closest("header") as HTMLElement;
    await waitFor(() =>
      expect(cabecera).toHaveTextContent("Menciona a HeyDiga y Fonio")
    );
    const destino = screen
      .getByRole("heading", { name: "Destino e investigación" })
      .closest("section") as HTMLElement;
    const enlace = await within(destino).findByRole("link", {
      name: "HeyDiga",
    });
    expect(enlace).toHaveAttribute("href", "/bandeja?menciona=heydiga.example");
    expect(
      within(destino).getByRole("link", { name: "Fonio" })
    ).toHaveAttribute("href", "/bandeja?menciona=fonio.example");
    expect(destino).toHaveTextContent("heydiga.example");
  });

  it("sin menciones no hay ni insignia ni fila", async () => {
    montarRevision(undefined);
    const titulo = await screen.findByRole("heading", { level: 1 });
    expect(titulo.closest("header")).not.toHaveTextContent("Menciona a");
    const destino = screen
      .getByRole("heading", { name: "Destino e investigación" })
      .closest("section") as HTMLElement;
    expect(within(destino).queryByText("Menciona a")).toBeNull();
  });

  it("si los competidores no cargan, sale el dominio como texto del enlace", async () => {
    montarRevision(["heydiga.example"], {
      competidores: async () => {
        throw new ErrorDeCliente(500, "Fallo.");
      },
    });
    const destino = (
      await screen.findByRole("heading", { name: "Destino e investigación" })
    ).closest("section") as HTMLElement;
    expect(
      within(destino).getByRole("link", { name: "heydiga.example" })
    ).toHaveAttribute("href", "/bandeja?menciona=heydiga.example");
  });
});
