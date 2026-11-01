import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FichaDeAlhabla } from "@/components/tareas/ficha-de-alhabla";
import {
  contarCaracteres,
  excesoSobreElLimite,
  textoDeLaFichaCompleta,
} from "@/components/tareas/utilidades";
import { ErrorDeCliente } from "@/lib/api-errors";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import { clienteFalso } from "../helpers/cliente-falso";
import { renderConCliente } from "../helpers/render";
import { campoDeFicha, fichaDeAlhabla } from "../helpers/tareas-datos";

/** La demo fecha el snapshot respecto al reloj: el reloj se fija. */
const AHORA_DEL_DEMO = new Date("2026-10-30T09:00:00.000Z");

function montar(sustitutos: Partial<ClienteGrowth>) {
  const cliente = clienteFalso(sustitutos);
  renderConCliente(<FichaDeAlhabla />, cliente);
  return cliente;
}

/** El `<li>` de un campo, por el título de su `<h3>`. */
async function campo(etiqueta: string): Promise<HTMLElement> {
  const titulo = await screen.findByRole("heading", {
    level: 3,
    name: etiqueta,
  });
  return titulo.closest("li") as HTMLElement;
}

describe("Ficha de Alhabla", () => {
  it("cada campo enseña su texto en una caja, sus caracteres y las claves de las que sale", async () => {
    montar({ fichaDeAlhabla: async () => fichaDeAlhabla() });
    const corta = await campo("Descripción corta");
    expect(corta).toHaveTextContent(
      "Recepcionista de IA que atiende las llamadas de tu negocio."
    );
    expect(corta).toHaveTextContent("59 de 160 caracteres");
    expect(within(corta).getByText("pagina.inicio")).toBeInTheDocument();
    // Sin límite, solo cuenta.
    expect(await campo("Nombre del producto")).toHaveTextContent(
      "7 caracteres"
    );
    expect(
      screen.getByText(
        /Compuesta con las afirmaciones vigentes del commit 1234abc/
      )
    ).toBeInTheDocument();
  });

  it("el texto sale en una caja monoespaciada y respeta los saltos de línea", async () => {
    montar({
      fichaDeAlhabla: async () =>
        fichaDeAlhabla({
          campos: [
            campoDeFicha({
              clave: "precios",
              etiqueta: "Precios",
              texto: "Plan Inicio: 59 €.\nPlan Pro: 139 €.",
            }),
          ],
        }),
    });
    const caja = (await campo("Precios")).querySelector(".font-mono");
    expect(caja).not.toBeNull();
    expect(caja?.className).toContain("whitespace-pre-wrap");
    expect(caja?.textContent).toBe("Plan Inicio: 59 €.\nPlan Pro: 139 €.");
  });

  it("«Copiar» copia exactamente lo que se ve en ese campo", async () => {
    const user = userEvent.setup();
    const texto = "Alhabla  con dos espacios\ny «comillas» <b>no html</b>";
    montar({
      fichaDeAlhabla: async () =>
        fichaDeAlhabla({ campos: [campoDeFicha({ texto })] }),
    });
    const nombre = await campo("Nombre del producto");
    await user.click(
      within(nombre).getByRole("button", { name: /Copiar Nombre del producto/ })
    );
    expect(await navigator.clipboard.readText()).toBe(texto);
    // Lo que se ve en la caja es lo mismo.
    expect(nombre.querySelector(".font-mono")?.textContent).toBe(texto);
    expect(within(nombre).getByRole("button")).toHaveTextContent("Copiado");
  });

  it("«Copiar todo» copia cada campo con su etiqueta, en orden, tal cual se ve", async () => {
    const user = userEvent.setup();
    const ficha = fichaDeAlhabla({
      campos: [
        campoDeFicha(),
        campoDeFicha({
          clave: "web",
          etiqueta: "Sitio web",
          texto: "https://alhabla.ai/",
        }),
        campoDeFicha({
          clave: "precios",
          etiqueta: "Precios",
          texto: null,
          faltan: ["precio.desde"],
        }),
      ],
    });
    montar({ fichaDeAlhabla: async () => ficha });
    await campo("Nombre del producto");
    await user.click(screen.getByRole("button", { name: /Copiar todo/ }));
    expect(await navigator.clipboard.readText()).toBe(
      "Nombre del producto\nAlhabla\n\nSitio web\nhttps://alhabla.ai/"
    );
    expect(textoDeLaFichaCompleta(ficha.campos)).toBe(
      "Nombre del producto\nAlhabla\n\nSitio web\nhttps://alhabla.ai/"
    );
  });

  it("un campo que no se puede componer lo dice, enseña lo que falta y no se puede copiar", async () => {
    montar({
      fichaDeAlhabla: async () =>
        fichaDeAlhabla({
          campos: [
            campoDeFicha({
              clave: "precios",
              etiqueta: "Precios",
              texto: null,
              afirmaciones: ["precio.plan.pro"],
              faltan: ["precio.desde", "precio.iva"],
            }),
          ],
        }),
    });
    const precios = await campo("Precios");
    expect(precios).toHaveTextContent(
      "Este campo no se puede componer todavía"
    );
    expect(precios).toHaveTextContent("Faltan en la base de conocimiento:");
    expect(within(precios).getByText("precio.desde")).toBeInTheDocument();
    expect(within(precios).getByText("precio.iva")).toBeInTheDocument();
    expect(within(precios).getByText("precio.plan.pro")).toBeInTheDocument();
    expect(within(precios).getByRole("button")).toBeDisabled();
    expect(precios).not.toHaveTextContent("caracteres");
  });

  it("un texto parcial (la descripción larga sin alguna función) sale con lo que falta", async () => {
    montar({
      fichaDeAlhabla: async () =>
        fichaDeAlhabla({
          campos: [
            campoDeFicha({
              clave: "descripcion_larga",
              etiqueta: "Descripción larga",
              texto: "Alhabla es una recepcionista de IA.",
              limite: 1000,
              afirmaciones: ["funcion.idiomas"],
              faltan: ["funcion.calendarios"],
            }),
          ],
        }),
    });
    const larga = await campo("Descripción larga");
    expect(larga).toHaveTextContent("Alhabla es una recepcionista de IA.");
    expect(larga).toHaveTextContent("funcion.calendarios");
    expect(within(larga).getByRole("button")).toBeEnabled();
  });

  it("avisa cuando un texto pasa del límite orientativo y de cuánto", async () => {
    const largo = "a".repeat(170);
    montar({
      fichaDeAlhabla: async () =>
        fichaDeAlhabla({
          campos: [
            campoDeFicha({
              clave: "descripcion_corta",
              etiqueta: "Descripción corta",
              texto: largo,
              limite: 160,
            }),
          ],
        }),
    });
    const corta = await campo("Descripción corta");
    expect(corta).toHaveTextContent("170 de 160 caracteres");
    expect(corta).toHaveTextContent(
      "Pasa del límite orientativo por 10 caracteres"
    );
  });

  it("los avisos del servidor (términos prohibidos) salen arriba, bien visibles", async () => {
    montar({
      fichaDeAlhabla: async () =>
        fichaDeAlhabla({
          avisos: [
            "El campo «Descripción corta» contiene términos que no se pueden decir: sin límites.",
          ],
        }),
    });
    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("Revisa estos textos antes de pegarlos");
    expect(aviso).toHaveTextContent(
      "El campo «Descripción corta» contiene términos que no se pueden decir: sin límites."
    );
    // El campo se devuelve igualmente: el administrador decide qué pega.
    expect(
      screen.getByRole("heading", { level: 3, name: "Descripción corta" })
    ).toBeInTheDocument();
  });

  it("sin sincronizar nunca dice que no hay de dónde componerla", async () => {
    montar({
      fichaDeAlhabla: async () =>
        fichaDeAlhabla({ commit: null, sincronizadaEn: null }),
    });
    expect(
      await screen.findByText(/no se ha sincronizado nunca/)
    ).toBeInTheDocument();
  });

  it("el texto que parece HTML o un enlace se pinta como texto", async () => {
    const { container } = renderConCliente(
      <FichaDeAlhabla />,
      clienteFalso({
        fichaDeAlhabla: async () =>
          fichaDeAlhabla({
            campos: [
              campoDeFicha({
                texto:
                  '<img src=x onerror="alert(1)"> <a href="javascript:alert(2)">x</a>',
              }),
            ],
            avisos: ["<script>alert(3)</script>"],
          }),
      })
    );
    await screen.findByText(/onerror=/);
    expect(container.querySelector("img, script, a")).toBeNull();
    expect(screen.getByText("<script>alert(3)</script>")).toBeInTheDocument();
  });

  it("mientras carga hay un esqueleto y si falla, el error con «Reintentar»", async () => {
    montar({
      fichaDeAlhabla: async () => {
        throw new ErrorDeCliente(500, "x");
      },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cargar la ficha de Alhabla"
    );
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
    // Sin ficha no hay nada que copiar.
    expect(
      screen.queryByRole("button", { name: /Copiar todo/ })
    ).not.toBeInTheDocument();
  });

  it("con el demo, la ficha sale completa, sin avisos y con las claves reales", async () => {
    renderConCliente(
      <FichaDeAlhabla />,
      clienteDemo({ retardoMs: 0, ahora: () => AHORA_DEL_DEMO })
    );
    const etiquetas = (await screen.findAllByRole("heading", { level: 3 })).map(
      (h) => h.textContent
    );
    expect(etiquetas).toEqual([
      "Nombre del producto",
      "Sitio web",
      "Descripción corta",
      "Descripción larga",
      "Precios",
      "Prueba y permanencia",
      "Idiomas",
      "Categorías",
    ]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const precios = await campo("Precios");
    expect(precios).toHaveTextContent("precio.plan.scale");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Copiar todo/ })).toBeEnabled()
    );
  });
});

describe("utilidades de la ficha", () => {
  it("cuenta los caracteres como los cuenta quien pega (una letra con tilde es una)", () => {
    expect(contarCaracteres("niño")).toBe(4);
    expect(contarCaracteres("a😀b")).toBe(3);
  });

  it("el exceso sobre el límite es 0 sin límite o sin texto", () => {
    expect(excesoSobreElLimite(campoDeFicha({ texto: "x".repeat(200) }))).toBe(
      0
    );
    expect(
      excesoSobreElLimite(campoDeFicha({ texto: null, limite: 160 }))
    ).toBe(0);
    expect(
      excesoSobreElLimite(campoDeFicha({ texto: "x".repeat(161), limite: 160 }))
    ).toBe(1);
  });
});
