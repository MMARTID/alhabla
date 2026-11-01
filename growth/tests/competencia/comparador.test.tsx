import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  AVISO_DEL_COMPARADOR,
  VistaDelComparador,
} from "@/components/competencia/vista-del-comparador";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import { clienteFalso } from "../helpers/cliente-falso";
import { afirmacion, conocimiento } from "../helpers/d2-datos";
import { renderConCliente } from "../helpers/render";
import {
  datoDeComparador,
  filaDelComparador,
  respuestaDelComparador,
} from "../helpers/tareas-datos";

/** Intl separa la cifra y el símbolo con un espacio duro: se compara con uno normal. */
const normal = (texto: string | null) => (texto ?? "").replace(/[  ]/g, " ");

/**
 * Los análisis del demo se fechan respecto al reloj (el del repositorio caduca
 * a los 90 días): el reloj se fija el 30-10-2026, el día en que se escribió.
 */
const AHORA_DEL_DEMO = new Date("2026-10-30T09:00:00.000Z");

function montarDemo() {
  const cliente = clienteDemo({ retardoMs: 0, ahora: () => AHORA_DEL_DEMO });
  renderConCliente(<VistaDelComparador />, cliente);
  return cliente;
}

function montarFalso(sustitutos: Partial<ClienteGrowth> = {}) {
  const cliente = clienteFalso({
    conocimiento: async () => conocimiento(),
    ...sustitutos,
  });
  renderConCliente(<VistaDelComparador />, cliente);
  return cliente;
}

/** La fila de la tabla cuyo `<h3>` es este nombre. */
async function fila(nombre: string | RegExp): Promise<HTMLElement> {
  const titulo = await screen.findByRole("heading", { level: 3, name: nombre });
  return titulo.closest("tr") as HTMLElement;
}

describe("Comparador · lo de siempre", () => {
  it("lleva el título de Competencia, las dos pestañas con la del comparador marcada y el aviso fijo", async () => {
    montarDemo();
    await fila("Alhabla");
    expect(
      screen.getByRole("heading", { level: 1, name: "Competencia" })
    ).toBeInTheDocument();
    const pestanas = screen.getByRole("navigation", {
      name: "Secciones de Competencia",
    });
    expect(
      within(pestanas).getByRole("link", { name: "Competidores" })
    ).toHaveAttribute("href", "/competencia");
    const comparador = within(pestanas).getByRole("link", {
      name: "Comparador",
    });
    expect(comparador).toHaveAttribute("href", "/competencia/comparador");
    expect(comparador).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("note")).toHaveTextContent(AVISO_DEL_COMPARADOR);
    expect(AVISO_DEL_COMPARADOR).toBe(
      "Información interna: no se puede citar en un borrador. Los precios están en la moneda en que se publican (sin convertir) y puede que no sean comparables plan a plan."
    );
  });

  it("Alhabla va la primera, con los tres planes: cuota, minutos incluidos y minuto extra", async () => {
    montarDemo();
    const alhabla = await fila("Alhabla");
    expect(alhabla.parentElement?.firstElementChild).toBe(alhabla);
    const texto = normal(alhabla.textContent);
    for (const [plan, cuota, minutos, extra] of [
      ["Inicio", "59 € al mes", "200 minutos incluidos", "0,30 € por minuto"],
      ["Pro", "139 € al mes", "600 minutos incluidos", "0,25 € por minuto"],
      ["Scale", "269 € al mes", "1.500 minutos incluidos", "0,20 € por minuto"],
    ]) {
      expect(texto).toContain(plan);
      expect(texto).toContain(`${cuota} · IVA no incluido`);
      expect(texto).toContain(minutos);
      expect(texto).toContain(`${extra} extra · IVA no incluido`);
    }
    // Cada plan dice de dónde sale y desde cuándo vale.
    expect(texto).toContain("Fuente: demo/plans.ts#inicio");
    expect(texto).toMatch(/vigente desde el 1\d oct 2026/);
  });

  it("los competidores salen de menor a mayor precio de entrada y los propuestos no salen", async () => {
    montarDemo();
    await fila("Alhabla");
    const nombres = screen
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(nombres).toEqual([
      "Alhabla",
      "Competidor ficticio",
      // 790 € al año es 65,83 € al mes: más barato que sus 79 € mensuales.
      "Recepción Express (ejemplo)",
      "Otra recepcionista (ejemplo)",
    ]);
    expect(screen.queryByText("Atiende24 (ejemplo)")).not.toBeInTheDocument();
    expect(screen.getByText(/3 competidores · 1 revisado/)).toBeInTheDocument();
  });

  it("cada precio lleva su fuente (enlace https nofollow, en otra pestaña) y el día en que se leyó", async () => {
    montarDemo();
    const express = await fila(/Recepción Express/);
    const enlaces = within(express).getAllByRole("link", {
      name: /recepcion-express\.example\/precios/,
    });
    expect(enlaces.length).toBeGreaterThanOrEqual(3);
    for (const enlace of enlaces) {
      expect(enlace.getAttribute("href")).toBe(
        "https://recepcion-express.example/precios"
      );
      expect(enlace).toHaveAttribute("target", "_blank");
      const rel = enlace.getAttribute("rel") ?? "";
      for (const palabra of ["nofollow", "noopener", "noreferrer"]) {
        expect(rel).toContain(palabra);
      }
    }
    expect(normal(express.textContent)).toContain("Consultado el 28 oct 2026");
    // Los importes, como se publican: la moneda, el periodo y la unidad.
    const texto = normal(express.textContent);
    expect(texto).toContain("79 € al mes · IVA no incluido");
    expect(texto).toContain("790 € al año · IVA incluido");
    expect(texto).toContain("0,12 € por minuto · IVA no incluido");
  });

  it("enseña el precio de entrada (con el anual dividido entre 12 y avisando de que lo es)", async () => {
    montarDemo();
    const ficticio = await fila("Competidor ficticio");
    expect(normal(ficticio.textContent)).toContain("Desde 49 € al mes");
    const express = await fila(/Recepción Express/);
    expect(normal(express.textContent)).toContain(
      "Desde 790 € al año (≈ 65,83 € al mes)"
    );
  });

  it("los límites y las integraciones, idiomas y canales salen en su columna", async () => {
    montarDemo();
    const express = await fila(/Recepción Express/);
    expect(express).toHaveTextContent("Sin calendarios externos");
    expect(express).toHaveTextContent("No se conecta a Google Calendar");
    expect(express).toHaveTextContent("WhatsApp");
    expect(express).toHaveTextContent("Castellano y catalán");
    // Lo que no se compara (producto, servicio, diferencias) no sale.
    expect(express).not.toHaveTextContent("Agenda propia obligatoria");
  });

  it("dice en qué estado está cada análisis: revisado, caducado, pendiente de revisión o sin analizar", async () => {
    montarDemo();
    const ficticio = await fila("Competidor ficticio");
    expect(ficticio).toHaveTextContent("Revisado");
    expect(ficticio).toHaveTextContent("Caducado");
    const express = await fila(/Recepción Express/);
    expect(express).toHaveTextContent("Pendiente de revisión");
    expect(express).not.toHaveTextContent("Caducado");
    const otra = await fila(/Otra recepcionista/);
    expect(otra).toHaveTextContent("Sin analizar");
    expect(otra).toHaveTextContent("Todavía no hay análisis");
  });

  it("el nombre de un competidor lleva a su ficha y el dominio es solo texto", async () => {
    montarDemo();
    const express = await fila(/Recepción Express/);
    expect(
      within(express).getByRole("link", { name: /Recepción Express/ })
    ).toHaveAttribute("href", "/competencia/demo-co-3");
    expect(
      within(express).queryByRole("link", { name: "recepcion-express.example" })
    ).not.toBeInTheDocument();
    expect(
      within(express).getByText("recepcion-express.example")
    ).toBeInTheDocument();
  });
});

describe("Comparador · el filtro «Solo revisados»", () => {
  it("deja a Alhabla y a los revisados, lo cuenta y se puede quitar", async () => {
    const user = userEvent.setup();
    montarDemo();
    await fila("Alhabla");
    expect(screen.getByText(/3 competidores · 1 revisado/)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Solo revisados" }));
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    ).toEqual(["Alhabla", "Competidor ficticio"]);
    expect(
      screen.getByText(/1 de 3 competidores · 1 revisado/)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Solo revisados" }));
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
  });

  it("sin ningún revisado lo dice y ofrece ver todos", async () => {
    const user = userEvent.setup();
    montarFalso({
      comparadorDeCompetencia: async () =>
        respuestaDelComparador([filaDelComparador()]),
    });
    await screen.findByRole("heading", { level: 3, name: "Rival" });
    await user.click(screen.getByRole("checkbox", { name: "Solo revisados" }));
    expect(
      screen.getByText("Ningún competidor está revisado todavía")
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver todos" }));
    expect(
      screen.getByRole("heading", { level: 3, name: "Rival" })
    ).toBeInTheDocument();
  });
});

describe("Comparador · estados", () => {
  it("sin competidores confirmados, un estado vacío que dice qué hacer (y el aviso sigue ahí)", async () => {
    montarFalso({
      comparadorDeCompetencia: async () => respuestaDelComparador([]),
    });
    expect(
      await screen.findByText("Todavía no hay nada que comparar")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir a los competidores" })
    ).toHaveAttribute("href", "/competencia");
    expect(screen.getByRole("note")).toHaveTextContent("Información interna");
  });

  it("mientras carga, un esqueleto; si falla, el error con «Reintentar»", async () => {
    montarFalso({
      comparadorDeCompetencia: async () => {
        throw new ErrorDeCliente(500, "x");
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cargar el comparador"
    );
    expect(
      screen.getByRole("button", { name: "Reintentar" })
    ).toBeInTheDocument();
  });

  it("si fallan los precios de Alhabla, lo dice en su fila y los competidores siguen saliendo", async () => {
    montarFalso({
      conocimiento: async () => {
        throw new ErrorDeCliente(500, "x");
      },
      comparadorDeCompetencia: async () =>
        respuestaDelComparador([filaDelComparador()]),
    });
    const alhabla = await fila("Alhabla");
    await waitFor(() =>
      expect(alhabla).toHaveTextContent(
        "No se pudieron cargar los precios de Alhabla"
      )
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "Rival" })
    ).toBeInTheDocument();
  });

  it("sin planes vigentes en el conocimiento, la fila de Alhabla manda sincronizar", async () => {
    montarFalso({
      conocimiento: async () => {
        const vacio = conocimiento();
        vacio.porTipo.precio = [];
        return vacio;
      },
      comparadorDeCompetencia: async () =>
        respuestaDelComparador([filaDelComparador()]),
    });
    const alhabla = await fila("Alhabla");
    await waitFor(() =>
      expect(alhabla).toHaveTextContent("No hay planes vigentes")
    );
  });

  it("una afirmación de precio sin números sale con su texto en vez de inventar la cuota", async () => {
    montarFalso({
      comparadorDeCompetencia: async () =>
        respuestaDelComparador([filaDelComparador()]),
    });
    // `conocimiento()` trae `valor: { precio: 139 }`, que no es la forma real.
    const alhabla = await fila("Alhabla");
    await waitFor(() =>
      expect(alhabla).toHaveTextContent(
        "El plan Pro cuesta 139 € al mes más IVA."
      )
    );
  });

  it("los planes de Alhabla salen del conocimiento vigente, del más barato al más caro", async () => {
    montarFalso({
      conocimiento: async () => {
        const base = conocimiento();
        base.porTipo.precio = [
          afirmacion({
            id: "p2",
            clave: "precio.plan.pro",
            valor: {
              plan: "pro",
              cuotaEur: 139,
              minutosIncluidos: 600,
              minutoExtraEur: 0.25,
            },
          }),
          afirmacion({
            id: "p1",
            clave: "precio.plan.inicio",
            valor: {
              plan: "inicio",
              cuotaEur: 59,
              minutosIncluidos: 200,
              minutoExtraEur: 0.3,
            },
          }),
        ];
        return base;
      },
      comparadorDeCompetencia: async () =>
        respuestaDelComparador([filaDelComparador()]),
    });
    const alhabla = await fila("Alhabla");
    await waitFor(() =>
      expect(normal(alhabla.textContent)).toContain("59 € al mes")
    );
    const texto = normal(alhabla.textContent);
    expect(texto.indexOf("Inicio")).toBeLessThan(texto.indexOf("Pro"));
    expect(texto).toContain("139 € al mes · IVA no incluido");
    expect(texto).toContain("600 minutos incluidos · 0,25 € por minuto extra");
    expect(texto).not.toContain("Scale");
  });
});

describe("Comparador · el texto de terceros es texto", () => {
  it("un nombre, un dominio, unas etiquetas y unos textos con HTML o javascript: ni se interpretan ni se enlazan", async () => {
    const { container } = renderConCliente(
      <VistaDelComparador />,
      clienteFalso({
        conocimiento: async () => conocimiento(),
        comparadorDeCompetencia: async () =>
          respuestaDelComparador([
            filaDelComparador({
              nombre: "<b>Rival</b>",
              dominio: "javascript:alert(1)",
              datos: [
                datoDeComparador({
                  etiqueta: '<img src=x onerror="alert(1)">',
                  texto: '<a href="javascript:alert(2)">pulsa</a>',
                  urlFuente: "javascript:alert(3)",
                }),
                datoDeComparador({
                  tipo: "limite",
                  etiqueta: "Límite http",
                  texto: "Solo http.",
                  valor: undefined,
                  urlFuente: "http://rival.example/limites",
                }),
                datoDeComparador({
                  tipo: "integracion",
                  etiqueta: "<script>alert(4)</script>",
                  valor: undefined,
                }),
              ],
            }),
          ]),
      })
    );
    await screen.findByText("<b>Rival</b>");
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(container.querySelector("img, b, script, [onerror]")).toBeNull();
    // Una fuente que no es https se enseña como texto, nunca como enlace.
    const hrefs = [...container.querySelectorAll("a")].map((a) =>
      a.getAttribute("href")
    );
    for (const href of hrefs) {
      expect(href).toMatch(/^(\/competencia|\/)/);
    }
    expect(
      screen.getByText(/javascript:alert\(3\) \(no se enlaza/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/http:\/\/rival\.example\/limites \(no se enlaza/)
    ).toBeInTheDocument();
    expect(screen.getByText("<script>alert(4)</script>")).toBeInTheDocument();
  });
});
