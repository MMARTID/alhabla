import { QueryClient } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Pagina from "@/app/(panel)/oportunidad/[id]/page";
import { PuertaDeSesion } from "@/components/puerta-de-sesion";
import { VistaDeRevision } from "@/components/revision/vista-de-revision";
import { ErrorDeCliente, SesionCaducada } from "@/lib/api-errors";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import { guardarCredencial, marcarCaducada } from "@/lib/sesion";
import type {
  DetalleDeOportunidad,
  RespuestaDeEdicion,
  RespuestaDeDecision,
} from "@/lib/types";
import { clienteFalso } from "../helpers/cliente-falso";
import {
  AVISO_DE_PARECIDO,
  REGLAS_LIMPIAS,
  REGLA_DURA_ROTA,
  afirmacion,
  ahoraMas,
  borrador,
  comprobacion,
  detalle,
  revision,
} from "../helpers/d1-datos";
import { instalarGoogleFalso } from "../helpers/google-falso";
import { crearJwt } from "../helpers/jwt";
import { renderConCliente } from "../helpers/render";
import { reiniciarTodo } from "../helpers/reiniciar";

beforeEach(() => {
  reiniciarTodo();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Escenarios
// ---------------------------------------------------------------------------

/** Pendiente de aprobación, borrador limpio, todo en orden. */
const limpio = () => detalle();

/** Bloqueada: el borrador rompe una regla dura. El backend solo deja descartar. */
const bloqueada = () =>
  detalle({
    estado: "bloqueada",
    borradores: [
      borrador({
        estado: "bloqueado",
        revisiones: [
          revision({ comprobaciones: [REGLA_DURA_ROTA, ...REGLAS_LIMPIAS] }),
        ],
      }),
    ],
    borradorEditableId: "bo-1",
    acciones: [{ accion: "descartar", habilitada: true }],
  });

/** Pendiente, pero la última revisión trae una regla dura rota (aprobar sería un 409). */
const pendienteConReglaDura = () =>
  detalle({
    borradores: [
      borrador({
        revisiones: [
          revision({ comprobaciones: [REGLA_DURA_ROTA, ...REGLAS_LIMPIAS] }),
        ],
      }),
    ],
  });

const aprobada = () =>
  detalle({
    estado: "aprobada",
    borradores: [borrador({ estado: "aprobado" })],
    borradorEditableId: null,
    acciones: [
      { accion: "marcar_gestionado", habilitada: true },
      { accion: "descartar", habilitada: true },
    ],
  });

const gestionada = () =>
  detalle({
    estado: "gestionada",
    borradores: [
      borrador({
        estado: "gestionado",
        gestion: {
          id: "ge-1",
          borradorId: "bo-1",
          canal: "formulario",
          dominio: "revista.example",
          hechaEn: ahoraMas(-3),
          respuestaEn: null,
          resultado: "pendiente",
          urlConseguida: null,
          notas: null,
        },
      }),
    ],
    borradorEditableId: null,
    acciones: [
      { accion: "conseguido", habilitada: true },
      { accion: "sin_respuesta", habilitada: true },
      { accion: "rechazado", habilitada: true },
    ],
  });

function montar(
  inicial: DetalleDeOportunidad,
  sustitutos: Partial<ClienteGrowth> = {},
  opciones: { borradorId?: string; queryClient?: QueryClient } = {}
) {
  const cliente = clienteFalso({
    detalleDeOportunidad: async () => inicial,
    ...sustitutos,
  });
  const vista = renderConCliente(
    <VistaDeRevision id={inicial.id} borradorId={opciones.borradorId} />,
    cliente,
    opciones.queryClient
  );
  return { cliente, ...vista };
}

async function cargar() {
  await screen.findByRole("heading", { name: /Borrador/ });
}

const textoDelBorrador = () => screen.getByRole("textbox", { name: "Texto" });
const asuntoDelBorrador = () =>
  screen.getByRole("textbox", { name: /^Asunto/ });
const enlaceDelBorrador = () =>
  screen.getByRole("textbox", { name: /^Enlace a Alhabla/ });

async function reescribir(
  user: ReturnType<typeof userEvent.setup>,
  campo: HTMLElement,
  texto: string
) {
  await user.clear(campo);
  await user.click(campo);
  await user.paste(texto);
}

const OK_DECISION: RespuestaDeDecision = { id: "op-1", estado: "aprobada" };

function respuestaDeEdicion(
  resultado: "pasa" | "aviso" | "bloquea" = "pasa"
): RespuestaDeEdicion {
  return {
    borrador: {
      id: "bo-1",
      oportunidadId: "op-1",
      version: 1,
      tipo: "email",
      objetivo: "BACKLINKS",
      asunto: null,
      texto: "x",
      enlaceUrl: null,
      utm: null,
      afirmaciones: [],
      estado: resultado === "bloquea" ? "bloqueado" : "pendiente_aprobacion",
      textoFinal: null,
      editadoPorHumano: true,
      creadoEn: ahoraMas(-1),
    },
    resultado,
    comprobaciones: [],
    oportunidad: {
      id: "op-1",
      estado: resultado === "bloquea" ? "bloqueada" : "pendiente_aprobacion",
    },
  };
}

// ---------------------------------------------------------------------------
// Estructura
// ---------------------------------------------------------------------------

describe("Revisión: las tres columnas", () => {
  it("destino e investigación, borrador, y cumplimiento con la decisión", async () => {
    montar(limpio());
    await cargar();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Recepcionistas de IA en España",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Destino e investigación" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Borrador v1" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Cumplimiento" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Decisión" })
    ).toBeInTheDocument();
    // El contenedor es una rejilla de una columna en móvil y de tres desde lg.
    const rejilla = screen
      .getByRole("heading", { name: "Destino e investigación" })
      .closest("section")!.parentElement!.parentElement!;
    expect(rejilla.className).toContain("grid");
    expect(rejilla.className).toContain("lg:grid-cols-");
  });

  it("la columna del destino enseña la investigación: quién edita, vía, competidores y dónde contactar", async () => {
    montar(limpio());
    await cargar();
    const destino = screen
      .getByRole("heading", { name: "Destino e investigación" })
      .closest("section")!;
    expect(destino).toHaveTextContent("Medio digital");
    expect(destino).toHaveTextContent("Formulario");
    expect(destino).toHaveTextContent("1 competidor: competidor.example");
    const contacto = within(destino).getByRole("link", {
      name: /revista.example\/contacto/,
    });
    expect(contacto).toHaveAttribute(
      "href",
      "https://revista.example/contacto"
    );
    expect(contacto).toHaveAttribute(
      "rel",
      expect.stringContaining("nofollow")
    );
    expect(contacto).toHaveAttribute("target", "_blank");
  });

  it("enseña las tres puntuaciones y marca la del objetivo principal", async () => {
    montar(limpio());
    await cargar();
    const destino = screen
      .getByRole("heading", { name: "Destino e investigación" })
      .closest("section")!;
    expect(destino).toHaveTextContent("A · Tráfico y marca");
    expect(destino).toHaveTextContent("62/100");
    expect(destino).toHaveTextContent("84/100");
    expect(destino).toHaveTextContent("(objetivo principal)");
  });

  it("sin investigación lo dice, sin inventar nada", async () => {
    montar(detalle({ investigacion: null }));
    await cargar();
    expect(screen.getByText("Todavía sin investigar.")).toBeInTheDocument();
  });

  it("una oportunidad sin borrador explica que lo escribirá el agente", async () => {
    montar(
      detalle({
        estado: "investigada",
        borradores: [],
        borradorEditableId: null,
        acciones: [{ accion: "descartar", habilitada: true }],
      })
    );
    expect(
      await screen.findByText("Todavía no hay borrador")
    ).toBeInTheDocument();
    expect(
      screen.getByText("El agente aún está preparando el borrador.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sin borrador no hay nada que evaluar.")
    ).toBeInTheDocument();
  });

  it("la nota de devolución se enseña a la vista cuando la oportunidad está devuelta", async () => {
    montar(
      detalle({
        estado: "devuelta",
        borradores: [borrador({ estado: "descartado" })],
        borradorEditableId: null,
        acciones: [{ accion: "descartar", habilitada: true }],
        decisiones: [
          {
            id: "d1",
            borradorId: "bo-1",
            accion: "devolver",
            motivo: "Quita la mención al precio.",
            por: "admin@alhabla.ai",
            en: ahoraMas(-1),
          },
        ],
      })
    );
    expect(await screen.findByText("Nota de devolución")).toBeInTheDocument();
    expect(
      screen.getAllByText("Quita la mención al precio.").length
    ).toBeGreaterThan(0);
  });

  it("las decisiones registradas salen con su autor y su fecha", async () => {
    const user = userEvent.setup();
    montar(
      detalle({
        decisiones: [
          {
            id: "d1",
            borradorId: null,
            accion: "investigar",
            motivo: null,
            por: "agente:semanal",
            en: ahoraMas(-4),
          },
        ],
      })
    );
    await cargar();
    await user.click(screen.getByText("Decisiones registradas"));
    const registro = screen
      .getByText("Decisiones registradas")
      .closest("details")!;
    expect(within(registro).getByText("Investigada")).toBeInTheDocument();
    expect(
      within(registro).getByText(/Agente \(semanal\)/)
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Texto de terceros
// ---------------------------------------------------------------------------

describe("Revisión: una descartada enseña por qué", () => {
  it("el código de descarte llega aparte (`codigoDescarte`, como en el backend) y se enseña con su etiqueta", async () => {
    montar(
      detalle({
        estado: "descartada",
        motivoDescarte: "Es una página de un competidor (Retell AI).",
        codigoDescarte: "competidor",
        datos: {},
        acciones: [],
        borradorEditableId: null,
        borradores: [borrador({ estado: "descartado" })],
      })
    );
    await cargar();
    const caja = screen.getByText(/^Descartada · /).closest("div")!;
    expect(caja).toHaveTextContent("Descartada · Es un competidor");
    expect(caja).toHaveTextContent(
      "Es una página de un competidor (Retell AI)."
    );
  });

  it("sin código, solo el motivo", async () => {
    montar(
      detalle({
        estado: "descartada",
        motivoDescarte: "No encaja.",
        codigoDescarte: null,
        acciones: [],
        borradorEditableId: null,
        borradores: [borrador({ estado: "descartado" })],
      })
    );
    await cargar();
    expect(screen.getByText("No encaja.")).toBeInTheDocument();
    expect(screen.queryByText(/^Descartada · /)).toBeNull();
  });
});

describe("Revisión: lo que viene de fuera es dato, no HTML ni enlaces", () => {
  const HTML =
    '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';

  it("título, extracto, resumen de la investigación, nota y texto del borrador se pintan como texto", async () => {
    const { container } = montar(
      detalle({
        titulo: `Título ${HTML}`,
        extracto: `Extracto ${HTML}`,
        dominio: "<b>x</b>.example",
        datos: { nota: `Nota ${HTML}` },
        investigacion: {
          oportunidadId: "op-1",
          resumen: `Resumen ${HTML}`,
          quienEdita: `<i>Alguien</i>`,
          viaDeContacto: "formulario",
          competidoresEnlazados: [`<u>rival</u>.example`],
          contexto: null,
          creadaEn: ahoraMas(-1),
        },
        estado: "aprobada",
        borradores: [
          borrador({
            estado: "aprobado",
            asunto: `Asunto ${HTML}`,
            texto: `Texto ${HTML}`,
            afirmacionesDetalle: [afirmacion({ texto: `Afirmación ${HTML}` })],
          }),
        ],
        borradorEditableId: null,
      })
    );
    await cargar();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: new RegExp("Título <img src=x"),
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp("Extracto <img src=x"))
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp("Resumen <img src=x"))
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp("Texto <img src=x"))
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp("Afirmación <img src=x"))
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b, i, u")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("el texto editable del borrador es un valor de textarea, nunca HTML", async () => {
    const { container } = montar(
      detalle({ borradores: [borrador({ texto: `Hola ${HTML}` })] })
    );
    await cargar();
    expect(textoDelBorrador()).toHaveValue(`Hola ${HTML}`);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("un enlace javascript: no se convierte en href: ni la página, ni el contacto, ni el enlace del borrador, ni el conseguido", async () => {
    montar(
      detalle({
        url: "javascript:alert(document.cookie)",
        estado: "gestionada",
        investigacion: {
          oportunidadId: "op-1",
          resumen: "x",
          quienEdita: null,
          viaDeContacto: null,
          competidoresEnlazados: null,
          contexto: { urlContacto: "javascript:alert(2)" },
          creadaEn: ahoraMas(-1),
        },
        borradores: [
          borrador({
            estado: "gestionado",
            enlaceUrl: "javascript:alert(3)",
            gestion: {
              id: "g",
              borradorId: "bo-1",
              canal: "email",
              dominio: "x",
              hechaEn: ahoraMas(-1),
              respuestaEn: null,
              resultado: "aceptado",
              urlConseguida: "data:text/html,<script>alert(4)</script>",
              notas: null,
            },
          }),
        ],
        borradorEditableId: null,
        acciones: [],
      })
    );
    await cargar();
    const hrefs = Array.from(document.querySelectorAll("a[href]")).map((a) =>
      a.getAttribute("href")
    );
    for (const href of hrefs) {
      expect(href).not.toMatch(/^(javascript|data|vbscript):/i);
    }
    // El texto sí se ve (como dato), sin enlace.
    expect(
      screen.getAllByText("javascript:alert(document.cookie)").length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/javascript:alert\(2\)/)).toBeInTheDocument();
    expect(screen.getByText("javascript:alert(3)")).toBeInTheDocument();
    // «Abrir página» queda apagado.
    expect(
      screen.queryByRole("link", { name: /Abrir página/ })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Abrir página/)).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("«Abrir página» es un enlace externo seguro cuando la URL es https", async () => {
    montar(limpio());
    await cargar();
    const abrir = screen.getByRole("link", { name: /Abrir página/ });
    expect(abrir).toHaveAttribute("href", "https://revista.example/listado");
    expect(abrir).toHaveAttribute("target", "_blank");
    expect(abrir.getAttribute("rel")?.split(" ").sort()).toEqual([
      "nofollow",
      "noopener",
      "noreferrer",
    ]);
  });

  it("un extracto purgado por la retención lo dice con esas palabras", async () => {
    montar(detalle({ extracto: "", extractoPurgado: true }));
    await cargar();
    expect(
      screen.getByText("Texto de terceros retirado por retención.")
    ).toBeInTheDocument();
  });

  it("un extracto vacío en una oportunidad ya calificada también se trata como retirado; en una recién añadida, como «sin leer»", async () => {
    const calificada = montar(
      detalle({
        extracto: "",
        extractoPurgado: false,
        estado: "pendiente_aprobacion",
      })
    );
    await cargar();
    expect(
      screen.getByText("Texto de terceros retirado por retención.")
    ).toBeInTheDocument();
    calificada.unmount();

    montar(
      detalle({
        extracto: "",
        extractoPurgado: false,
        estado: "detectada",
        borradores: [],
        borradorEditableId: null,
        acciones: [{ accion: "descartar", habilitada: true }],
      })
    );
    expect(
      await screen.findByText(
        /Todavía sin extracto: el agente aún no ha leído la página/
      )
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Panel de cumplimiento
// ---------------------------------------------------------------------------

describe("Revisión: panel de cumplimiento", () => {
  function panel() {
    return screen
      .getByRole("heading", { name: "Cumplimiento" })
      .closest("section")!;
  }

  it("lo que bloquea va primero y en rojo, los avisos en ámbar y lo correcto en verde", async () => {
    montar(
      detalle({
        borradores: [
          borrador({
            revisiones: [
              revision({
                comprobaciones: [
                  comprobacion({
                    regla: "identificacion",
                    detalle: "OK identificación",
                  }),
                  AVISO_DE_PARECIDO,
                  REGLA_DURA_ROTA,
                ],
              }),
            ],
          }),
        ],
      })
    );
    await cargar();
    const items = within(panel()).getAllByRole("listitem");
    const textos = items.map((i) => i.textContent ?? "");
    const posicion = (fragmento: string) =>
      textos.findIndex((t) => t.includes(fragmento));
    expect(posicion("Usa el término prohibido")).toBeLessThan(
      posicion("Se parece un 38 %")
    );
    expect(posicion("Se parece un 38 %")).toBeLessThan(
      posicion("OK identificación")
    );
    const bloqueo = items[posicion("Usa el término prohibido")];
    expect(bloqueo.querySelector(".text-error")).not.toBeNull();
    expect(bloqueo).toHaveTextContent("Bloquea");
    const aviso = items[posicion("Se parece un 38 %")];
    expect(aviso.querySelector(".text-aviso")).not.toBeNull();
    const correcta = items[posicion("OK identificación")];
    expect(correcta.querySelector(".text-exito")).not.toBeNull();
    // El resumen cuenta cada cosa.
    expect(panel()).toHaveTextContent("1 bloquea · 1 aviso · 1 correcta");
    expect(within(panel()).getByText("Bloqueado")).toBeInTheDocument();
  });

  it("«similitud con la versión anterior» sale como aviso con su porcentaje", async () => {
    montar(
      detalle({
        borradores: [
          borrador({
            version: 2,
            similitudConVersionAnterior: 0.38,
            revisiones: [
              revision({
                comprobaciones: [...REGLAS_LIMPIAS, AVISO_DE_PARECIDO],
              }),
            ],
          }),
        ],
      })
    );
    await cargar();
    const aviso = within(panel()).getByText(
      "Similitud con la versión anterior: 38 %"
    );
    expect(aviso.closest("div")!.className).toContain("border-aviso-borde");
    expect(panel()).toHaveTextContent(
      "Comprueba que esta versión cambia de verdad"
    );
  });

  it("un parecido que la regla del servidor no marca no alarma, aunque el número sea alto", async () => {
    montar(
      detalle({
        borradores: [
          borrador({ version: 2, similitudConVersionAnterior: 0.12 }),
        ],
      })
    );
    await cargar();
    const fila = within(panel()).getByText(
      "Similitud con la versión anterior: 12 %"
    );
    expect(fila.closest("div")!.className).not.toContain("border-aviso-borde");
  });

  it("las afirmaciones usadas salen con su clave, su fuente y el commit corto", async () => {
    montar(limpio());
    await cargar();
    expect(within(panel()).getByText("precio.plan.pro")).toBeInTheDocument();
    expect(panel()).toHaveTextContent(
      "El plan Pro cuesta 139 € al mes más IVA."
    );
    expect(panel()).toHaveTextContent(
      "Fuente: web/src/lib/plans.ts#pro · commit abcdef1"
    );
    expect(panel()).not.toHaveTextContent("abcdef12");
  });

  it("una afirmación que no existe o que ya se cerró se marca en rojo", async () => {
    montar(
      detalle({
        borradores: [
          borrador({
            afirmacionesDetalle: [
              afirmacion({
                clave: "precio.plan.inventado",
                existe: false,
                texto: null,
                fuente: null,
                commitSha: null,
                vigente: false,
              }),
              afirmacion({
                clave: "funcion.vieja",
                vigente: false,
                vigenteHasta: "2026-10-01T00:00:00Z",
              }),
            ],
          }),
        ],
      })
    );
    await cargar();
    expect(panel()).toHaveTextContent("No existe en la base de conocimiento.");
    expect(panel()).toHaveTextContent("ya no está vigente");
  });

  it("sin afirmaciones lo dice", async () => {
    montar(
      detalle({
        borradores: [borrador({ afirmacionesDetalle: [], afirmaciones: [] })],
      })
    );
    await cargar();
    expect(panel()).toHaveTextContent(
      "no cita ninguna afirmación sobre Alhabla"
    );
  });

  it("los topes de contacto: la semana y el enfriamiento del dominio", async () => {
    const enfriamiento = montar(
      detalle({
        contacto: {
          dominioEnEnfriamientoHasta: "2027-01-10T00:00:00Z",
          contactosEstaSemana: 4,
          topeSemanal: 5,
        },
      })
    );
    await cargar();
    expect(panel()).toHaveTextContent("Esta semana: 4 de 5 contactos.");
    expect(panel()).toHaveTextContent(
      "revista.example está en enfriamiento hasta el"
    );
    enfriamiento.unmount();

    montar(limpio());
    await cargar();
    expect(panel()).toHaveTextContent(
      "no se ha contactado en los últimos 90 días"
    );
  });

  it("la revisión consultiva (de un modelo) sale aparte y dice que no bloquea", async () => {
    montar(
      detalle({
        borradores: [
          borrador({
            revisiones: [
              revision({
                id: "r2",
                revisor: "llm",
                comprobaciones: [
                  comprobacion({
                    regla: "tono_y_claridad",
                    ok: false,
                    dura: false,
                    detalle: "Un poco largo.",
                  }),
                ],
              }),
              revision({ id: "r1" }),
            ],
          }),
        ],
      })
    );
    await cargar();
    expect(
      within(panel()).getByText("Revisión consultiva")
    ).toBeInTheDocument();
    expect(panel()).toHaveTextContent("no bloquea");
    expect(panel()).toHaveTextContent("Un poco largo.");
  });

  it("sin ninguna revisión dice que aún no se ha evaluado", async () => {
    montar(detalle({ borradores: [borrador({ revisiones: [] })] }));
    await cargar();
    expect(panel()).toHaveTextContent("aún no se ha evaluado");
  });
});

// ---------------------------------------------------------------------------
// Aprobar
// ---------------------------------------------------------------------------

describe("Revisión: Aprobar", () => {
  it("con una regla dura fallida el botón está deshabilitado y dice por qué", async () => {
    const { cliente } = montar(pendienteConReglaDura());
    await cargar();
    const aprobar = screen.getByRole("button", { name: "Aprobar" });
    expect(aprobar).toBeDisabled();
    expect(aprobar).toHaveAccessibleDescription(
      /Hay una regla dura sin cumplir: edita el borrador para corregirla/
    );
    // El motivo está a la vista, no solo en un tooltip.
    expect(screen.getByText(/Hay una regla dura sin cumplir/)).toBeVisible();
    await userEvent.setup().click(aprobar);
    expect(cliente.decidir).not.toHaveBeenCalled();
  });

  it("varias reglas duras fallidas: el motivo cuenta cuántas", async () => {
    montar(
      detalle({
        borradores: [
          borrador({
            revisiones: [
              revision({
                comprobaciones: [
                  REGLA_DURA_ROTA,
                  comprobacion({
                    regla: "identificacion",
                    ok: false,
                    dura: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
    await cargar();
    expect(
      screen.getByText(/Hay 2 reglas duras sin cumplir/)
    ).toBeInTheDocument();
  });

  it("un aviso blando NO impide aprobar", async () => {
    montar(
      detalle({
        borradores: [
          borrador({
            revisiones: [
              revision({
                comprobaciones: [AVISO_DE_PARECIDO, ...REGLAS_LIMPIAS],
              }),
            ],
          }),
        ],
      })
    );
    await cargar();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeEnabled();
  });

  it("en una oportunidad bloqueada el botón está apagado y explica que hay que editar", async () => {
    montar(bloqueada());
    await cargar();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();
    expect(
      screen.getByText(
        /Las reglas bloquean el borrador: edítalo para poder aprobarlo/
      )
    ).toBeInTheDocument();
    // Solo se ofrece lo que el backend permite.
    expect(screen.getByRole("button", { name: "Descartar" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Devolver con nota" })
    ).not.toBeInTheDocument();
  });

  it("si el backend dice que no se puede aprobar, enseña su motivo", async () => {
    montar(
      detalle({
        acciones: [
          {
            accion: "aprobar",
            habilitada: false,
            motivo: "La última revisión del borrador lo bloquea.",
          },
          { accion: "descartar", habilitada: true },
        ],
      })
    );
    await cargar();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();
    expect(
      screen.getByText("La última revisión del borrador lo bloquea.")
    ).toBeInTheDocument();
  });

  it("con todo en orden aprueba el borrador pendiente", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio(), {
      decidir: async () => OK_DECISION,
    });
    await cargar();

    await user.click(screen.getByRole("button", { name: "Aprobar" }));

    await waitFor(() => expect(cliente.decidir).toHaveBeenCalledTimes(1));
    expect(cliente.decidir).toHaveBeenCalledWith("op-1", {
      accion: "aprobar",
      borradorId: "bo-1",
    });
  });

  it("tras aprobar se vuelve a pedir el detalle y la pantalla pasa a «Aprobada»", async () => {
    const user = userEvent.setup();
    let estaAprobada = false;
    const { cliente } = montar(limpio(), {
      detalleDeOportunidad: async () => (estaAprobada ? aprobada() : limpio()),
      decidir: async () => {
        estaAprobada = true;
        return OK_DECISION;
      },
    });
    await cargar();
    await user.click(screen.getByRole("button", { name: "Aprobar" }));

    expect(
      await screen.findByRole("button", { name: "Marcar como gestionado" })
    ).toBeEnabled();
    expect(cliente.detalleDeOportunidad.mock.calls.length).toBeGreaterThan(1);
    expect(
      screen.getByText(/Aprobada\. Copia el texto, envíalo tú/)
    ).toBeInTheDocument();
  });

  it("un doble clic en Aprobar manda UNA sola decisión y deja el botón deshabilitado", async () => {
    const user = userEvent.setup();
    let resolver!: (valor: RespuestaDeDecision) => void;
    const { cliente } = montar(limpio(), {
      decidir: () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    });
    await cargar();
    const aprobar = screen.getByRole("button", { name: "Aprobar" });

    await user.dblClick(aprobar);
    await user.click(aprobar);

    expect(cliente.decidir).toHaveBeenCalledTimes(1);
    expect(aprobar).toBeDisabled();
    // También los demás botones de decisión: nada se puede lanzar a la vez.
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Devolver con nota" })
    ).toBeDisabled();

    await act(async () => resolver(OK_DECISION));
    expect(cliente.decidir).toHaveBeenCalledTimes(1);
  });

  it("dos toques en el mismo instante tampoco duplican (el guarda no espera al repintado)", async () => {
    const { cliente } = montar(limpio(), {
      decidir: () => new Promise(() => {}),
    });
    await cargar();
    const aprobar = screen.getByRole("button", { name: "Aprobar" });
    // Dos eventos en el mismo tick, sin dejar que React repinte entre medias.
    act(() => {
      aprobar.click();
      aprobar.click();
    });
    await waitFor(() => expect(cliente.decidir).toHaveBeenCalledTimes(1));
    await new Promise((resolver) => setTimeout(resolver, 30));
    expect(cliente.decidir).toHaveBeenCalledTimes(1);
  });

  it("un 409 de cumplimiento enseña el motivo y las reglas que fallan, y no limpia nada", async () => {
    const user = userEvent.setup();
    montar(limpio(), {
      decidir: async () => {
        throw new ErrorDeCliente(
          409,
          "Una regla dura del borrador ya no se cumple: queda bloqueado.",
          {
            codigo: "cumplimiento",
            comprobaciones: [
              comprobacion({
                regla: "afirmaciones_vigentes",
                ok: false,
                detalle: "La clave precio.plan.pro se cerró el 2026-10-28.",
              }),
            ],
          }
        );
      },
    });
    await cargar();
    await user.click(screen.getByRole("button", { name: "Aprobar" }));

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(
      "Una regla dura del borrador ya no se cumple"
    );
    expect(alerta).toHaveTextContent("Afirmaciones con clave vigente");
    expect(alerta).toHaveTextContent(
      "La clave precio.plan.pro se cerró el 2026-10-28."
    );
    expect(alerta).toHaveTextContent("Corrige lo que sale en rojo");
    // Y se puede volver a intentar.
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeEnabled();
  });

  it.each([
    [
      "tope_semanal",
      "Has alcanzado el tope semanal.",
      "cambia el tope en Ajustes",
    ],
    [
      "dominio_ya_aprobado",
      "Ya hay otra aprobada con este dominio.",
      "un contacto por dominio",
    ],
    [
      "caducada",
      "Esta oportunidad ya ha caducado.",
      "descártala o déjala caducar",
    ],
  ])(
    "el 409 «%s» enseña el texto del backend y qué hacer",
    async (codigo, mensaje, ayuda) => {
      const user = userEvent.setup();
      montar(limpio(), {
        decidir: async () => {
          throw new ErrorDeCliente(409, mensaje, { codigo });
        },
      });
      await cargar();
      await user.click(screen.getByRole("button", { name: "Aprobar" }));
      const alerta = await screen.findByRole("alert");
      expect(alerta).toHaveTextContent(mensaje);
      expect(alerta.textContent?.toLowerCase()).toContain(ayuda.toLowerCase());
    }
  );

  it("si caduca en menos de una semana avisa; si ya venció, no deja aprobar", async () => {
    const pronto = montar(detalle({ expiraEn: ahoraMas(3.5) }));
    await cargar();
    expect(
      screen.getByText(/Caduca en 3 d: si no la gestionas a tiempo se perderá/)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeEnabled();
    pronto.unmount();

    const { cliente } = montar(detalle({ expiraEn: ahoraMas(-1) }));
    await cargar();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();
    expect(screen.getByText(/ya no se puede aprobar/)).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Aprobar" }));
    expect(cliente.decidir).not.toHaveBeenCalled();
  });

  it("con margen de plazo no sale ningún aviso de caducidad", async () => {
    montar(detalle({ expiraEn: ahoraMas(30) }));
    await cargar();
    expect(
      screen.queryByText(/si no la gestionas a tiempo/)
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Editor del borrador
// ---------------------------------------------------------------------------

describe("Revisión: el borrador editable", () => {
  it("muestra asunto, texto y enlace en campos, y el contador de caracteres", async () => {
    const user = userEvent.setup();
    montar(detalle({ borradores: [borrador({ texto: "Hola" })] }));
    await cargar();
    expect(asuntoDelBorrador()).toHaveValue(
      "Una recepcionista de IA para vuestro listado"
    );
    expect(textoDelBorrador()).toHaveValue("Hola");
    expect(screen.getByText("4 de 10.000 caracteres")).toBeInTheDocument();

    await user.click(textoDelBorrador());
    await user.keyboard(" que tal");
    expect(screen.getByText("12 de 10.000 caracteres")).toBeInTheDocument();
  });

  it("pasarse de 10.000 caracteres se marca y no deja guardar", async () => {
    const user = userEvent.setup();
    montar(limpio());
    await cargar();
    await user.click(textoDelBorrador());
    await user.paste("a".repeat(10_001));
    expect(screen.getByText(/de 10.000 caracteres/)).toHaveClass("text-error");
    expect(textoDelBorrador()).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    ).toBeDisabled();
  });

  it("avisa si el enlace no lleva utm_source (y deja de avisar cuando lo lleva)", async () => {
    const user = userEvent.setup();
    montar(
      detalle({ borradores: [borrador({ enlaceUrl: "https://alhabla.ai/" })] })
    );
    await cargar();
    expect(screen.getByText(/no lleva utm_source/)).toBeInTheDocument();

    await reescribir(
      user,
      enlaceDelBorrador(),
      "https://alhabla.ai/?utm_source=revista"
    );
    expect(screen.queryByText(/no lleva utm_source/)).not.toBeInTheDocument();
  });

  it("con el enlace vacío o inválido no avisa de utm_source (hay otro mensaje)", async () => {
    const user = userEvent.setup();
    montar(detalle({ borradores: [borrador({ enlaceUrl: null })] }));
    await cargar();
    expect(screen.queryByText(/no lleva utm_source/)).not.toBeInTheDocument();
    await reescribir(user, enlaceDelBorrador(), "javascript:alert(1)");
    expect(screen.queryByText(/no lleva utm_source/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /El enlace tiene que ser una dirección web que empiece por http/
      )
    ).toBeInTheDocument();
    expect(enlaceDelBorrador()).toHaveAttribute("aria-invalid", "true");
  });

  it("un texto vacío no se puede guardar", async () => {
    const user = userEvent.setup();
    montar(limpio());
    await cargar();
    await user.clear(textoDelBorrador());
    expect(
      screen.getByText("El texto no puede quedar vacío.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    ).toBeDisabled();
  });

  it("sin cambios no hay nada que guardar; con cambios se habilita y aparece «Descartar cambios»", async () => {
    const user = userEvent.setup();
    montar(limpio());
    await cargar();
    const guardar = screen.getByRole("button", { name: "Guardar y reevaluar" });
    expect(guardar).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Descartar cambios" })
    ).not.toBeInTheDocument();

    await user.click(textoDelBorrador());
    await user.keyboard(" más");
    expect(guardar).toBeEnabled();
    expect(screen.getByText(/Tienes cambios sin guardar/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(textoDelBorrador()).toHaveValue(
      "Hola:\n\nSomos Alhabla.\n\nUn saludo."
    );
    expect(guardar).toBeDisabled();
  });

  it("volver a escribir el valor original cuenta como «sin cambios»", async () => {
    const user = userEvent.setup();
    montar(detalle({ borradores: [borrador({ texto: "Hola" })] }));
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard("!");
    expect(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    ).toBeEnabled();
    await user.keyboard("{Backspace}");
    expect(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    ).toBeDisabled();
  });

  it("guardar manda SOLO los campos cambiados", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio(), {
      editarBorrador: async () => respuestaDeEdicion("pasa"),
    });
    await cargar();
    await reescribir(user, asuntoDelBorrador(), "Un asunto nuevo");

    await user.click(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );

    await waitFor(() =>
      expect(cliente.editarBorrador).toHaveBeenCalledTimes(1)
    );
    expect(cliente.editarBorrador).toHaveBeenCalledWith("bo-1", {
      asunto: "Un asunto nuevo",
    });
  });

  it("vaciar el asunto y el enlace manda null", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio(), {
      editarBorrador: async () => respuestaDeEdicion("pasa"),
    });
    await cargar();
    await user.clear(asuntoDelBorrador());
    await user.clear(enlaceDelBorrador());
    await user.click(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );
    await waitFor(() => expect(cliente.editarBorrador).toHaveBeenCalled());
    expect(cliente.editarBorrador).toHaveBeenCalledWith("bo-1", {
      asunto: null,
      enlaceUrl: null,
    });
  });

  it("tras guardar enseña el resultado de las reglas: bien, con avisos o bloqueado", async () => {
    const user = userEvent.setup();
    let resultado: "pasa" | "aviso" | "bloquea" = "aviso";
    montar(limpio(), {
      editarBorrador: async () => respuestaDeEdicion(resultado),
    });
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" a");
    await user.click(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );
    expect(
      await screen.findByText("Guardado. Resultado de las reglas: con avisos.")
    ).toBeInTheDocument();

    resultado = "bloquea";
    await user.keyboard(" b");
    await user.click(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );
    expect(
      await screen.findByText(/Guardado, pero las reglas lo bloquean/)
    ).toBeInTheDocument();
  });

  it("un fallo al guardar enseña el error junto al editor y NO borra lo escrito", async () => {
    const user = userEvent.setup();
    montar(limpio(), {
      editarBorrador: async () => {
        throw new ErrorDeCliente(409, "Este borrador ya no se puede editar.");
      },
    });
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" y una frase importante");

    await user.click(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Este borrador ya no se puede editar.");
    expect(textoDelBorrador()).toHaveValue(
      "Hola:\n\nSomos Alhabla.\n\nUn saludo. y una frase importante"
    );
    expect(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    ).toBeEnabled();
  });

  it("un doble clic en Guardar manda una sola edición", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio(), {
      editarBorrador: () => new Promise(() => {}),
    });
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" a");
    await user.dblClick(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );
    expect(cliente.editarBorrador).toHaveBeenCalledTimes(1);
  });

  it("«Copiar texto» copia lo que ves, incluidas las ediciones sin guardar", async () => {
    const user = userEvent.setup();
    montar(detalle({ borradores: [borrador({ texto: "Hola" })] }));
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" mundo");

    await user.click(screen.getByRole("button", { name: "Copiar texto" }));

    expect(await navigator.clipboard.readText()).toBe("Hola mundo");
    expect(
      await screen.findByRole("button", { name: "Copiado" })
    ).toBeInTheDocument();
  });

  it("«Copiar asunto» y «Copiar enlace» copian cada cosa", async () => {
    const user = userEvent.setup();
    montar(limpio());
    await cargar();
    await user.click(screen.getByRole("button", { name: "Copiar asunto" }));
    expect(await navigator.clipboard.readText()).toBe(
      "Una recepcionista de IA para vuestro listado"
    );
    await user.click(screen.getByRole("button", { name: "Copiar enlace" }));
    expect(await navigator.clipboard.readText()).toBe(
      "https://alhabla.ai/?utm_source=revista&utm_medium=referral"
    );
  });

  it("si el portapapeles falla, lo dice en vez de fingir que copió", async () => {
    const user = userEvent.setup();
    montar(limpio());
    await cargar();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denegado")
    );
    await user.click(screen.getByRole("button", { name: "Copiar texto" }));
    expect(
      await screen.findByRole("button", { name: "No se pudo copiar" })
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// La edición sobrevive
// ---------------------------------------------------------------------------

describe("Revisión: reglas de agenda (un 409 que no cambia nada)", () => {
  const FALLOS_DE_AGENDA: Array<[string, string, string]> = [
    [
      "tope_semanal",
      "Se ha llegado al tope de 5 contactos esta semana (hechos o aprobados).",
      "cambia el tope en ajustes",
    ],
    [
      "dominio_en_enfriamiento",
      "Ya se contactó con este dominio el 2026-10-25: espera 90 días.",
      "solo un contacto por dominio",
    ],
    [
      "dominio_ya_aprobado",
      "Ya hay otra oportunidad aprobada de este dominio pendiente de gestionar.",
      "solo un contacto por dominio",
    ],
  ];

  describe.each(FALLOS_DE_AGENDA)("%s", (codigo, mensaje, ayuda) => {
    const fallo = () => new ErrorDeCliente(409, mensaje, { codigo });

    it("al guardar: el aviso dice el motivo del backend y que no es culpa del texto, y lo escrito sigue ahí", async () => {
      const user = userEvent.setup();
      const { cliente } = montar(limpio(), {
        editarBorrador: async () => {
          throw fallo();
        },
      });
      await cargar();
      await user.click(textoDelBorrador());
      await user.keyboard(" y una frase importante");
      await user.click(
        screen.getByRole("button", { name: "Guardar y reevaluar" })
      );

      const aviso = await screen.findByRole("alert");
      expect(aviso).toHaveTextContent(mensaje);
      expect(aviso.textContent?.toLowerCase()).toContain(ayuda);
      expect(aviso).toHaveTextContent(
        "No se ha cambiado nada y el borrador no queda bloqueado"
      );
      expect(aviso).toHaveTextContent("Lo que escribiste sigue aquí");
      // Es un aviso de agenda (ámbar), no un error del texto (rojo).
      expect(aviso.className).toContain("border-aviso-borde");
      expect(aviso.className).not.toContain("border-error-borde");

      // Lo escrito se conserva y se puede volver a intentar.
      expect(textoDelBorrador()).toHaveValue(
        "Hola:\n\nSomos Alhabla.\n\nUn saludo. y una frase importante"
      );
      expect(
        screen.getByRole("button", { name: "Guardar y reevaluar" })
      ).toBeEnabled();
      expect(cliente.editarBorrador).toHaveBeenCalledTimes(1);
      // Y el borrador NO sale como bloqueado.
      expect(
        screen.queryByText(/Guardado, pero las reglas lo bloquean/)
      ).toBeNull();
      expect(screen.queryByText("Bloqueado")).toBeNull();
    });

    it("al aprobar: mismo aviso, el borrador sigue por revisar y se puede repetir", async () => {
      const user = userEvent.setup();
      const { cliente } = montar(limpio(), {
        decidir: async () => {
          throw fallo();
        },
      });
      await cargar();
      await user.click(screen.getByRole("button", { name: "Aprobar" }));

      const aviso = await screen.findByRole("alert");
      expect(aviso).toHaveTextContent(mensaje);
      expect(aviso).toHaveTextContent(
        "No se ha cambiado nada y el borrador no queda bloqueado"
      );
      expect(aviso.className).toContain("border-aviso-borde");
      expect(screen.getByRole("button", { name: "Aprobar" })).toBeEnabled();
      expect(cliente.decidir).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Bloqueado")).toBeNull();
    });

    it("en «Aprobar con ediciones», si falla el guardado: no se aprueba nada y el texto sigue", async () => {
      const user = userEvent.setup();
      const { cliente } = montar(limpio(), {
        editarBorrador: async () => {
          throw fallo();
        },
        decidir: async () => OK_DECISION,
      });
      await cargar();
      await user.click(textoDelBorrador());
      await user.keyboard(" extra");
      await user.click(
        screen.getByRole("button", { name: "Aprobar con ediciones" })
      );
      const aviso = await screen.findByRole("alert");
      expect(aviso).toHaveTextContent(mensaje);
      expect(aviso).toHaveTextContent("No se ha cambiado nada");
      expect(cliente.decidir).not.toHaveBeenCalled();
      expect(textoDelBorrador()).toHaveValue(
        "Hola:\n\nSomos Alhabla.\n\nUn saludo. extra"
      );
    });

    it("en «Aprobar con ediciones», si el guardado va bien y falla aprobar: dice que los cambios SÍ se guardaron", async () => {
      const user = userEvent.setup();
      montar(limpio(), {
        editarBorrador: async () => respuestaDeEdicion("pasa"),
        decidir: async () => {
          throw fallo();
        },
      });
      await cargar();
      await user.click(textoDelBorrador());
      await user.keyboard(" extra");
      await user.click(
        screen.getByRole("button", { name: "Aprobar con ediciones" })
      );
      const aviso = await screen.findByRole("alert");
      expect(aviso).toHaveTextContent(mensaje);
      expect(aviso).toHaveTextContent("Tus cambios sí se guardaron");
      expect(aviso).toHaveTextContent("El borrador no queda bloqueado");
      expect(aviso).not.toHaveTextContent("No se ha cambiado nada");
    });
  });

  it("un guardado que falla por agenda quita el «Guardado, pero las reglas lo bloquean» de un guardado anterior", async () => {
    const user = userEvent.setup();
    let llamada = 0;
    montar(limpio(), {
      editarBorrador: async () => {
        llamada += 1;
        if (llamada === 1) return respuestaDeEdicion("bloquea");
        throw new ErrorDeCliente(409, "Se ha llegado al tope.", {
          codigo: "tope_semanal",
        });
      },
    });
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" a");
    await user.click(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );
    expect(
      await screen.findByText(/Guardado, pero las reglas lo bloquean/)
    ).toBeInTheDocument();

    await user.keyboard(" b");
    await user.click(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Se ha llegado al tope."
    );
    expect(
      screen.queryByText(/Guardado, pero las reglas lo bloquean/)
    ).toBeNull();
  });

  it("un cumplimiento sigue siendo un error (rojo) y un 409 de otro tipo no se disfraza de agenda", async () => {
    const user = userEvent.setup();
    montar(limpio(), {
      decidir: async () => {
        throw new ErrorDeCliente(409, "El borrador ya no cumple las reglas.", {
          codigo: "cumplimiento",
        });
      },
    });
    await cargar();
    await user.click(screen.getByRole("button", { name: "Aprobar" }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.className).toContain("border-error-borde");
    expect(alerta).not.toHaveTextContent("es una regla de agenda");
  });

  it("el 409 «ya_calificada» (lo usa el agente, no el panel) se enseña sin romper nada", async () => {
    const user = userEvent.setup();
    montar(limpio(), {
      decidir: async () => {
        throw new ErrorDeCliente(409, "Esa oportunidad ya está calificada.", {
          codigo: "ya_calificada",
        });
      },
    });
    await cargar();
    await user.click(screen.getByRole("button", { name: "Aprobar" }));
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Esa oportunidad ya está calificada.");
    expect(alerta).toHaveTextContent("recarga para ver cómo está ahora");
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeEnabled();
  });

  it("un código de 409 que la interfaz no conoce enseña solo el texto del backend", async () => {
    const user = userEvent.setup();
    montar(limpio(), {
      decidir: async () => {
        throw new ErrorDeCliente(409, "Algo que no esperábamos.", {
          codigo: "codigo_nuevo_del_backend",
        });
      },
    });
    await cargar();
    await user.click(screen.getByRole("button", { name: "Aprobar" }));
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Algo que no esperábamos.");
    expect(alerta.className).toContain("border-error-borde");
  });

  it("con la demostración y el tope lleno: «Aprobar» sale apagado con su motivo (como el backend)", async () => {
    const cliente = clienteDemo({ retardoMs: 0 });
    await cliente.guardarAjustes({ topeSemanal: 2 });
    renderConCliente(<VistaDeRevision id="demo-op-06" />, cliente);
    await screen.findByRole("heading", { name: /Borrador/ });
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();
    expect(
      screen.getByText("Se ha llegado al tope de 2 contactos esta semana.")
    ).toBeVisible();
  });

  it("con la demostración y el tope lleno: guardar una edición enseña el aviso de agenda, conserva el texto y NO bloquea el borrador", async () => {
    const user = userEvent.setup();
    const cliente = clienteDemo({ retardoMs: 0 });
    await cliente.guardarAjustes({ topeSemanal: 2 });
    renderConCliente(<VistaDeRevision id="demo-op-06" />, cliente);
    await screen.findByRole("heading", { name: /Borrador/ });
    await user.click(textoDelBorrador());
    await user.keyboard(" Y una frase nueva.");
    await user.click(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );
    const aviso = await screen.findByRole("alert");
    expect(aviso).toHaveTextContent("Se ha llegado al tope de 2 contactos");
    expect(aviso).toHaveTextContent("el borrador no queda bloqueado");
    expect((textoDelBorrador() as HTMLTextAreaElement).value).toMatch(
      /Y una frase nueva\.$/
    );
    const detalle = await cliente.detalleDeOportunidad("demo-op-06");
    expect(detalle.estado).toBe("pendiente_aprobacion");
    expect(detalle.borradores[0].estado).toBe("pendiente_aprobacion");
    expect(detalle.borradores[0].texto).not.toContain("Y una frase nueva.");
  });
});

describe("Revisión: lo escrito sobrevive a un fallo de sesión o de red", () => {
  it("si guardar falla por sesión caducada, el texto se queda, el error sale y se puede repetir", async () => {
    const user = userEvent.setup();
    let caducada = true;
    const { cliente } = montar(limpio(), {
      editarBorrador: async () => {
        if (caducada) throw new SesionCaducada();
        return respuestaDeEdicion("pasa");
      },
    });
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" — párrafo que no quiero perder");

    await user.click(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tu sesión ha caducado. Vuelve a iniciar sesión."
    );
    expect(textoDelBorrador()).toHaveValue(
      "Hola:\n\nSomos Alhabla.\n\nUn saludo. — párrafo que no quiero perder"
    );

    // Vuelve a entrar y repite: lo escrito sigue ahí y ahora sí se guarda.
    caducada = false;
    await user.click(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );
    await waitFor(() =>
      expect(cliente.editarBorrador).toHaveBeenCalledTimes(2)
    );
    expect(cliente.editarBorrador.mock.calls[1][1]).toEqual({
      texto:
        "Hola:\n\nSomos Alhabla.\n\nUn saludo. — párrafo que no quiero perder",
    });
  });

  it("si el refresco de los datos falla (la sesión murió), la Revisión NO se desmonta y el borrador editado sigue", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let llamada = 0;
    montar(
      limpio(),
      {
        detalleDeOportunidad: async () => {
          llamada += 1;
          if (llamada === 1) return limpio();
          throw new SesionCaducada();
        },
      },
      { queryClient }
    );
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" TEXTO NUEVO");

    // Lo que pasa tras cualquier decisión fallida: se invalida y el refresco rebota.
    await queryClient.invalidateQueries();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No se pudo actualizar lo que ves"
      )
    );
    expect(textoDelBorrador()).toHaveValue(
      "Hola:\n\nSomos Alhabla.\n\nUn saludo. TEXTO NUEVO"
    );
    expect(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    ).toBeEnabled();
  });

  it("un refresco con datos nuevos del servidor no pisa lo que estás editando, pero sí cambia lo que no has tocado", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let version = 1;
    montar(
      limpio(),
      {
        detalleDeOportunidad: async () =>
          version === 1
            ? limpio()
            : detalle({
                borradores: [
                  borrador({
                    asunto: "Asunto cambiado en el servidor",
                    texto: "Texto cambiado en el servidor",
                  }),
                ],
              }),
      },
      { queryClient }
    );
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" lo mío");

    version = 2;
    await queryClient.invalidateQueries();

    await waitFor(() =>
      expect(asuntoDelBorrador()).toHaveValue("Asunto cambiado en el servidor")
    );
    expect(textoDelBorrador()).toHaveValue(
      "Hola:\n\nSomos Alhabla.\n\nUn saludo. lo mío"
    );
  });

  it("sin edición propia, un refresco SÍ actualiza el texto", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let version = 1;
    montar(
      limpio(),
      {
        detalleDeOportunidad: async () =>
          version === 1
            ? limpio()
            : detalle({
                borradores: [borrador({ texto: "Versión del servidor" })],
              }),
      },
      { queryClient }
    );
    await cargar();
    version = 2;
    await queryClient.invalidateQueries();
    await waitFor(() =>
      expect(textoDelBorrador()).toHaveValue("Versión del servidor")
    );
  });

  it("con la puerta de sesión real: al caducar, el borrador queda debajo del diálogo, inerte pero intacto, y al volver a entrar sigue", async () => {
    const user = userEvent.setup();
    const google = instalarGoogleFalso();
    guardarCredencial(crearJwt({ email: "admin@alhabla.ai" }));
    const cliente = clienteFalso({
      yo: async () => ({ email: "admin@alhabla.ai" }),
      detalleDeOportunidad: async () => limpio(),
    });
    renderConCliente(
      <PuertaDeSesion>
        <VistaDeRevision id="op-1" />
      </PuertaDeSesion>,
      cliente
    );
    await screen.findByRole("heading", { name: /Borrador/ });
    await user.click(textoDelBorrador());
    await user.keyboard(" ESCRITO ANTES DE CADUCAR");

    act(() => marcarCaducada());

    const dialogo = await screen.findByRole("alertdialog", {
      name: "Tu sesión ha caducado",
    });
    expect(dialogo).toBeInTheDocument();
    expect(textoDelBorrador()).toHaveValue(
      "Hola:\n\nSomos Alhabla.\n\nUn saludo. ESCRITO ANTES DE CADUCAR"
    );
    expect(textoDelBorrador().closest("[inert]")).not.toBeNull();

    act(() => google.entregar(crearJwt({ email: "admin@alhabla.ai" })));
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    );
    expect(textoDelBorrador()).toHaveValue(
      "Hola:\n\nSomos Alhabla.\n\nUn saludo. ESCRITO ANTES DE CADUCAR"
    );
    expect(textoDelBorrador().closest("[inert]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Claves de afirmación
// ---------------------------------------------------------------------------

describe("Revisión: afirmaciones que cita el borrador", () => {
  const claves = () =>
    screen.getByRole("group", { name: "Afirmaciones que cita" });

  it("las claves que cita salen como fichas que se pueden quitar", async () => {
    montar(
      detalle({
        borradores: [
          borrador({ afirmaciones: ["precio.plan.pro", "funcion.agenda"] }),
        ],
      })
    );
    await cargar();
    expect(within(claves()).getByText("precio.plan.pro")).toBeInTheDocument();
    expect(within(claves()).getByText("funcion.agenda")).toBeInTheDocument();
    expect(
      within(claves()).getByRole("button", { name: "Quitar precio.plan.pro" })
    ).toBeInTheDocument();
  });

  it("un borrador sin claves dice «No cita ninguna»", async () => {
    montar(
      detalle({
        borradores: [borrador({ afirmaciones: [], afirmacionesDetalle: [] })],
      })
    );
    await cargar();
    expect(within(claves()).getByText("No cita ninguna.")).toBeInTheDocument();
  });

  it("quitar una clave y guardar manda la lista nueva (y solo ese campo)", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(
      detalle({
        borradores: [
          borrador({ afirmaciones: ["precio.plan.pro", "funcion.agenda"] }),
        ],
      }),
      { editarBorrador: async () => respuestaDeEdicion("pasa") }
    );
    await cargar();
    await user.click(
      within(claves()).getByRole("button", { name: "Quitar precio.plan.pro" })
    );
    expect(
      within(claves()).queryByText("precio.plan.pro")
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );

    await waitFor(() => expect(cliente.editarBorrador).toHaveBeenCalled());
    expect(cliente.editarBorrador).toHaveBeenCalledWith("bo-1", {
      afirmaciones: ["funcion.agenda"],
    });
  });

  it("añadir una clave (con el botón o con Enter) la recorta y no admite repetidas ni vacías", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(
      detalle({
        borradores: [borrador({ afirmaciones: ["precio.plan.pro"] })],
      }),
      { editarBorrador: async () => respuestaDeEdicion("pasa") }
    );
    await cargar();
    const caja = within(claves()).getByLabelText(
      "Añadir una clave de afirmación"
    );
    const anadir = within(claves()).getByRole("button", {
      name: "Añadir clave",
    });
    expect(anadir).toBeDisabled();

    await user.type(caja, "  funcion.agenda  ");
    await user.click(anadir);
    await user.type(caja, "precio.plan.pro{Enter}");
    await user.type(caja, "sector.peluqueria{Enter}");

    expect(
      within(claves())
        .getAllByText(/^(precio|funcion|sector)\./)
        .map((e) => e.textContent)
    ).toEqual(["precio.plan.pro", "funcion.agenda", "sector.peluqueria"]);
    expect(caja).toHaveValue("");

    await user.click(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    );
    await waitFor(() => expect(cliente.editarBorrador).toHaveBeenCalled());
    expect(cliente.editarBorrador.mock.calls[0][1]).toEqual({
      afirmaciones: ["precio.plan.pro", "funcion.agenda", "sector.peluqueria"],
    });
  });

  it("quitar y volver a poner la misma clave deja el borrador sin cambios", async () => {
    const user = userEvent.setup();
    montar(
      detalle({ borradores: [borrador({ afirmaciones: ["precio.plan.pro"] })] })
    );
    await cargar();
    await user.click(
      within(claves()).getByRole("button", { name: "Quitar precio.plan.pro" })
    );
    expect(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    ).toBeEnabled();
    await user.type(
      within(claves()).getByLabelText("Añadir una clave de afirmación"),
      "precio.plan.pro{Enter}"
    );
    expect(
      screen.getByRole("button", { name: "Guardar y reevaluar" })
    ).toBeDisabled();
  });

  it("los borradores que no se pueden editar no enseñan el editor de claves", async () => {
    montar(aprobada());
    await cargar();
    expect(
      screen.queryByRole("group", { name: "Afirmaciones que cita" })
    ).not.toBeInTheDocument();
  });

  it("de punta a punta con la demo: una bloqueada por una clave cerrada y un término prohibido se corrige y se aprueba", async () => {
    const user = userEvent.setup();
    const demo = clienteDemo({ retardoMs: 0 });
    renderConCliente(<VistaDeRevision id="demo-op-07" />, demo);
    await cargar();
    expect(
      await screen.findByRole("button", { name: "Aprobar" })
    ).toBeDisabled();

    await user.click(
      within(claves()).getByRole("button", {
        name: "Quitar precio.plan.basico_antiguo",
      })
    );
    await reescribir(
      user,
      textoDelBorrador(),
      "Hola:\n\nOs escribo en nombre de Alhabla, una recepcionista de IA para negocios con cita previa. Nos encantaría estar en vuestra comparativa.\n\nUn saludo,\nEl equipo de Alhabla"
    );

    await user.click(
      screen.getByRole("button", { name: "Aprobar con ediciones" })
    );

    expect(
      await screen.findByRole("button", { name: "Marcar como gestionado" })
    ).toBeEnabled();
    const final = await demo.detalleDeOportunidad("demo-op-07");
    expect(final.estado).toBe("aprobada");
    expect(final.borradores[0].estado).toBe("aprobado");
    expect(final.borradores[0].editadoPorHumano).toBe(true);
  });

  it("si las reglas siguen bloqueando tras corregir a medias, NO se aprueba y se queda donde estaba", async () => {
    const user = userEvent.setup();
    const demo = clienteDemo({ retardoMs: 0 });
    renderConCliente(<VistaDeRevision id="demo-op-07" />, demo);
    await cargar();
    // Solo se quita la clave: el término prohibido sigue en el texto.
    await user.click(
      within(claves()).getByRole("button", {
        name: "Quitar precio.plan.basico_antiguo",
      })
    );
    await user.click(
      screen.getByRole("button", { name: "Aprobar con ediciones" })
    );

    expect(
      await screen.findByText(/Guardado, pero las reglas lo bloquean/)
    ).toBeInTheDocument();
    expect((await demo.detalleDeOportunidad("demo-op-07")).estado).toBe(
      "bloqueada"
    );
  });
});

// ---------------------------------------------------------------------------
// Aprobar con ediciones
// ---------------------------------------------------------------------------

describe("Revisión: Aprobar con ediciones", () => {
  it("al editar, «Aprobar» se sustituye por «Aprobar con ediciones»", async () => {
    const user = userEvent.setup();
    montar(limpio());
    await cargar();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Aprobar con ediciones" })
    ).not.toBeInTheDocument();

    await user.click(textoDelBorrador());
    await user.keyboard(" extra");

    expect(
      screen.getByRole("button", { name: "Aprobar con ediciones" })
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Aprobar" })
    ).not.toBeInTheDocument();
  });

  it("guarda primero (y reevalúa) y solo después aprueba, en ese orden", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio(), {
      editarBorrador: async () => respuestaDeEdicion("aviso"),
      decidir: async () => OK_DECISION,
    });
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" extra");

    await user.click(
      screen.getByRole("button", { name: "Aprobar con ediciones" })
    );

    await waitFor(() => expect(cliente.decidir).toHaveBeenCalledTimes(1));
    expect(cliente.editarBorrador).toHaveBeenCalledWith("bo-1", {
      texto: "Hola:\n\nSomos Alhabla.\n\nUn saludo. extra",
    });
    expect(cliente.decidir).toHaveBeenCalledWith("op-1", {
      accion: "aprobar",
      borradorId: "bo-1",
    });
    expect(cliente.editarBorrador.mock.invocationCallOrder[0]).toBeLessThan(
      cliente.decidir.mock.invocationCallOrder[0]
    );
  });

  it("si al guardar las reglas lo bloquean, NO se aprueba nada y se dice", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio(), {
      editarBorrador: async () => respuestaDeEdicion("bloquea"),
      decidir: async () => OK_DECISION,
    });
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" número 1");

    await user.click(
      screen.getByRole("button", { name: "Aprobar con ediciones" })
    );

    expect(
      await screen.findByText(/Guardado, pero las reglas lo bloquean/)
    ).toBeInTheDocument();
    expect(cliente.editarBorrador).toHaveBeenCalledTimes(1);
    expect(cliente.decidir).not.toHaveBeenCalled();
    // Lo escrito se queda.
    expect(textoDelBorrador()).toHaveValue(
      "Hola:\n\nSomos Alhabla.\n\nUn saludo. número 1"
    );
  });

  it("si falla el guardado, no se intenta aprobar y el error sale con lo escrito intacto", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio(), {
      editarBorrador: async () => {
        throw new SesionCaducada();
      },
    });
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" extra");
    await user.click(
      screen.getByRole("button", { name: "Aprobar con ediciones" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tu sesión ha caducado"
    );
    expect(cliente.decidir).not.toHaveBeenCalled();
    expect(textoDelBorrador()).toHaveValue(
      "Hola:\n\nSomos Alhabla.\n\nUn saludo. extra"
    );
  });

  it("si el guardado va bien y el 409 llega al aprobar, enseña las reglas", async () => {
    const user = userEvent.setup();
    montar(limpio(), {
      editarBorrador: async () => respuestaDeEdicion("pasa"),
      decidir: async () => {
        throw new ErrorDeCliente(409, "Has alcanzado el tope semanal.", {
          codigo: "tope_semanal",
        });
      },
    });
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" extra");
    await user.click(
      screen.getByRole("button", { name: "Aprobar con ediciones" })
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Has alcanzado el tope semanal."
    );
  });

  it("en una oportunidad bloqueada, corregir el borrador habilita «Aprobar con ediciones»", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(bloqueada(), {
      editarBorrador: async () => respuestaDeEdicion("pasa"),
      decidir: async () => OK_DECISION,
    });
    await cargar();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeDisabled();

    await user.click(textoDelBorrador());
    await user.keyboard(" corregido");
    await user.click(
      screen.getByRole("button", { name: "Aprobar con ediciones" })
    );

    await waitFor(() => expect(cliente.decidir).toHaveBeenCalled());
    expect(cliente.editarBorrador).toHaveBeenCalledTimes(1);
  });

  it("con un error de validación en el borrador, «Aprobar con ediciones» no se puede pulsar", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio());
    await cargar();
    await reescribir(user, enlaceDelBorrador(), "javascript:alert(1)");
    expect(
      screen.getByRole("button", { name: "Aprobar con ediciones" })
    ).toBeDisabled();
    expect(cliente.editarBorrador).not.toHaveBeenCalled();
  });

  it("un doble clic en «Aprobar con ediciones» guarda y aprueba una sola vez", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio(), {
      editarBorrador: async () => respuestaDeEdicion("pasa"),
      decidir: () => new Promise(() => {}),
    });
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" extra");
    await user.dblClick(
      screen.getByRole("button", { name: "Aprobar con ediciones" })
    );
    await waitFor(() => expect(cliente.decidir).toHaveBeenCalledTimes(1));
    expect(cliente.editarBorrador).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Versiones y solo lectura
// ---------------------------------------------------------------------------

describe("Revisión: versiones del borrador", () => {
  const dosVersiones = () =>
    detalle({
      borradores: [
        borrador({ id: "bo-2", version: 2, texto: "Texto de la versión dos" }),
        borrador({
          id: "bo-1",
          version: 1,
          estado: "descartado",
          texto: "Texto de la versión uno",
        }),
      ],
      borradorEditableId: "bo-2",
    });

  it("abre la editable y deja ver la anterior en solo lectura", async () => {
    const user = userEvent.setup();
    montar(dosVersiones());
    await cargar();
    expect(textoDelBorrador()).toHaveValue("Texto de la versión dos");

    await user.click(screen.getByRole("button", { name: /^v1/ }));

    expect(
      screen.queryByRole("textbox", { name: "Texto" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Texto de la versión uno")).toBeInTheDocument();
    expect(screen.getByText(/Versión descartada/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Borrador v1" })
    ).toBeInTheDocument();
    // Y «Copiar texto» copia la que ves.
    await user.click(screen.getByRole("button", { name: "Copiar texto" }));
    expect(await navigator.clipboard.readText()).toBe(
      "Texto de la versión uno"
    );
  });

  it("el enlace profundo ?borrador= abre ya esa versión", async () => {
    montar(dosVersiones(), {}, { borradorId: "bo-1" });
    expect(
      await screen.findByText("Texto de la versión uno")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Borrador v1" })
    ).toBeInTheDocument();
  });

  it("un ?borrador= que no existe cae en la versión por defecto", async () => {
    montar(dosVersiones(), {}, { borradorId: "no-existe" });
    await cargar();
    expect(textoDelBorrador()).toHaveValue("Texto de la versión dos");
  });

  it("las ediciones de una versión se conservan al mirar otra y volver", async () => {
    const user = userEvent.setup();
    montar(dosVersiones());
    await cargar();
    await user.click(textoDelBorrador());
    await user.keyboard(" EDITADO");
    await user.click(screen.getByRole("button", { name: /^v1/ }));
    await user.click(screen.getByRole("button", { name: /^v2/ }));
    expect(textoDelBorrador()).toHaveValue("Texto de la versión dos EDITADO");
  });

  it("un borrador aprobado es de solo lectura y explica por qué", async () => {
    montar(aprobada());
    await cargar();
    expect(
      screen.queryByRole("textbox", { name: "Texto" })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Aprobado: ya no se edita/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar texto" })).toBeEnabled();
  });

  it("de un gestionado enseña la gestión y el texto realmente enviado", async () => {
    const det = gestionada();
    det.borradores[0].textoFinal = "Lo que de verdad se envió.";
    montar(det);
    await cargar();
    expect(screen.getByText("Lo que de verdad se envió.")).toBeInTheDocument();
    expect(
      screen.getByText(/Formulario el .* · Pendiente/)
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Diálogos de decisión
// ---------------------------------------------------------------------------

describe("Revisión: Devolver con nota", () => {
  it("exige la nota", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio());
    await cargar();
    await user.click(screen.getByRole("button", { name: "Devolver con nota" }));
    const dialogo = screen.getByRole("dialog", { name: "Devolver con nota" });

    await user.click(within(dialogo).getByRole("button", { name: "Devolver" }));

    expect(
      within(dialogo).getByText("Escribe qué hay que cambiar.")
    ).toBeInTheDocument();
    expect(cliente.decidir).not.toHaveBeenCalled();
  });

  it("manda la nota (recortada) y cierra el diálogo", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio(), {
      decidir: async () => ({ id: "op-1", estado: "devuelta" }),
    });
    await cargar();
    await user.click(screen.getByRole("button", { name: "Devolver con nota" }));
    const dialogo = screen.getByRole("dialog");
    await user.type(
      within(dialogo).getByLabelText("Qué hay que cambiar"),
      "  Quita el precio.  "
    );
    await user.click(within(dialogo).getByRole("button", { name: "Devolver" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(cliente.decidir).toHaveBeenCalledWith("op-1", {
      accion: "devolver",
      motivo: "Quita el precio.",
    });
  });

  it("una nota de más de 500 caracteres no sale", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio());
    await cargar();
    await user.click(screen.getByRole("button", { name: "Devolver con nota" }));
    const dialogo = screen.getByRole("dialog");
    await user.click(within(dialogo).getByLabelText("Qué hay que cambiar"));
    await user.paste("n".repeat(501));
    await user.click(within(dialogo).getByRole("button", { name: "Devolver" }));
    expect(dialogo).toHaveTextContent("no puede pasar de 500 caracteres");
    expect(cliente.decidir).not.toHaveBeenCalled();
  });

  it("si el backend rechaza, el diálogo sigue abierto con el error y la nota escrita", async () => {
    const user = userEvent.setup();
    montar(limpio(), {
      decidir: async () => {
        throw new ErrorDeCliente(
          409,
          "Esa oportunidad ya no admite devolverse."
        );
      },
    });
    await cargar();
    await user.click(screen.getByRole("button", { name: "Devolver con nota" }));
    const dialogo = screen.getByRole("dialog");
    await user.type(
      within(dialogo).getByLabelText("Qué hay que cambiar"),
      "Mi nota"
    );
    await user.click(within(dialogo).getByRole("button", { name: "Devolver" }));
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(
      "Esa oportunidad ya no admite devolverse."
    );
    expect(within(dialogo).getByLabelText("Qué hay que cambiar")).toHaveValue(
      "Mi nota"
    );
  });

  it("un doble clic en el botón del diálogo manda una sola decisión", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio(), {
      decidir: () => new Promise(() => {}),
    });
    await cargar();
    await user.click(screen.getByRole("button", { name: "Devolver con nota" }));
    const dialogo = screen.getByRole("dialog");
    await user.type(
      within(dialogo).getByLabelText("Qué hay que cambiar"),
      "Nota"
    );
    await user.dblClick(
      within(dialogo).getByRole("button", { name: "Devolver" })
    );
    expect(cliente.decidir).toHaveBeenCalledTimes(1);
    expect(
      within(dialogo).getByRole("button", { name: "Devolviendo…" })
    ).toBeDisabled();
    expect(
      within(dialogo).getByRole("button", { name: "Cancelar" })
    ).toBeDisabled();
  });
});

describe("Revisión: Descartar", () => {
  it("exige el motivo", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio());
    await cargar();
    await user.click(screen.getByRole("button", { name: "Descartar" }));
    const dialogo = screen.getByRole("dialog", { name: "Descartar" });
    await user.click(
      within(dialogo).getByRole("button", { name: "Descartar" })
    );
    expect(
      within(dialogo).getByText("Escribe por qué la descartas.")
    ).toBeInTheDocument();
    expect(cliente.decidir).not.toHaveBeenCalled();
  });

  it("manda el motivo y el tipo de motivo (otro por defecto)", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(limpio(), {
      decidir: async () => ({ id: "op-1", estado: "descartada" }),
    });
    await cargar();
    await user.click(screen.getByRole("button", { name: "Descartar" }));
    const dialogo = screen.getByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Motivo"), "Es publicidad.");
    await user.selectOptions(
      within(dialogo).getByLabelText("Tipo de motivo"),
      "baja_calidad"
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Descartar" })
    );
    await waitFor(() => expect(cliente.decidir).toHaveBeenCalled());
    expect(cliente.decidir).toHaveBeenCalledWith("op-1", {
      accion: "descartar",
      motivo: "Es publicidad.",
      codigo: "baja_calidad",
    });
  });

  it("solo ofrece los tipos de motivo que tiene sentido elegir a mano", async () => {
    const user = userEvent.setup();
    montar(limpio());
    await cargar();
    await user.click(screen.getByRole("button", { name: "Descartar" }));
    const opciones = within(screen.getByLabelText("Tipo de motivo"))
      .getAllByRole("option")
      .map((o) => o.getAttribute("value"));
    expect(opciones).toContain("otro");
    expect(opciones).toContain("irrelevante");
    // Los pone el sistema, no la persona.
    expect(opciones).not.toContain("bajo_umbral");
    expect(opciones).not.toContain("dominio_propio");
    expect(opciones).not.toContain("dominio_en_enfriamiento");
  });
});

describe("Revisión: Marcar como gestionado", () => {
  async function abrir(
    user: ReturnType<typeof userEvent.setup>,
    sustitutos: Partial<ClienteGrowth> = {}
  ) {
    const montado = montar(aprobada(), sustitutos);
    await cargar();
    await user.click(
      screen.getByRole("button", { name: "Marcar como gestionado" })
    );
    const dialogo = screen.getByRole("dialog", {
      name: "Marcar como gestionado",
    });
    return { ...montado, dialogo };
  }

  it("exige el canal", async () => {
    const user = userEvent.setup();
    const { cliente, dialogo } = await abrir(user);
    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar como gestionado" })
    );
    expect(
      within(dialogo).getByText("Elige por qué canal lo enviaste.")
    ).toBeInTheDocument();
    expect(cliente.decidir).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("exige la fecha", async () => {
    const user = userEvent.setup();
    const { cliente, dialogo } = await abrir(user);
    await user.click(within(dialogo).getByRole("radio", { name: "Correo" }));
    fireEvent.change(within(dialogo).getByLabelText("Cuándo lo hiciste"), {
      target: { value: "" },
    });

    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar como gestionado" })
    );

    expect(
      within(dialogo).getByText("Indica cuándo lo hiciste.")
    ).toBeInTheDocument();
    expect(cliente.decidir).not.toHaveBeenCalled();
  });

  it("canal y fecha a la vez faltan: salen los dos errores", async () => {
    const user = userEvent.setup();
    const { dialogo } = await abrir(user);
    fireEvent.change(within(dialogo).getByLabelText("Cuándo lo hiciste"), {
      target: { value: "" },
    });
    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar como gestionado" })
    );
    expect(dialogo).toHaveTextContent("Elige por qué canal lo enviaste.");
    expect(dialogo).toHaveTextContent("Indica cuándo lo hiciste.");
  });

  it("no acepta fechas futuras ni de hace más de 30 días", async () => {
    const user = userEvent.setup();
    const { cliente, dialogo } = await abrir(user);
    await user.click(
      within(dialogo).getByRole("radio", { name: "Formulario" })
    );
    const campo = within(dialogo).getByLabelText("Cuándo lo hiciste");
    const local = (dias: number) => {
      const f = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
      const dos = (n: number) => String(n).padStart(2, "0");
      return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}T${dos(f.getHours())}:${dos(f.getMinutes())}`;
    };

    fireEvent.change(campo, { target: { value: local(2) } });
    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar como gestionado" })
    );
    expect(dialogo).toHaveTextContent("La fecha no puede estar en el futuro.");

    fireEvent.change(campo, { target: { value: local(-31) } });
    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar como gestionado" })
    );
    expect(dialogo).toHaveTextContent(
      "Solo se aceptan fechas de los últimos 30 días."
    );
    expect(cliente.decidir).not.toHaveBeenCalled();
  });

  it("con canal y fecha válidos manda la gestión con la fecha en ISO", async () => {
    const user = userEvent.setup();
    const { cliente, dialogo } = await abrir(user, {
      decidir: async () => ({ id: "op-1", estado: "gestionada" }),
    });
    await user.click(
      within(dialogo).getByRole("radio", { name: "Alta en directorio" })
    );
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dos = (n: number) => String(n).padStart(2, "0");
    fireEvent.change(within(dialogo).getByLabelText("Cuándo lo hiciste"), {
      target: {
        value: `${ayer.getFullYear()}-${dos(ayer.getMonth() + 1)}-${dos(ayer.getDate())}T10:30`,
      },
    });

    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar como gestionado" })
    );

    await waitFor(() => expect(cliente.decidir).toHaveBeenCalledTimes(1));
    const [id, decision] = cliente.decidir.mock.calls[0];
    expect(id).toBe("op-1");
    expect(decision).toMatchObject({
      accion: "marcar_gestionado",
      canal: "alta_directorio",
    });
    expect((decision as { hechaEn: string }).hechaEn).toBe(
      new Date(
        ayer.getFullYear(),
        ayer.getMonth(),
        ayer.getDate(),
        10,
        30
      ).toISOString()
    );
    expect(decision).not.toHaveProperty("textoFinal");
    expect(decision).not.toHaveProperty("notas");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("por defecto la fecha es ahora, así que basta con elegir el canal", async () => {
    const user = userEvent.setup();
    const { cliente, dialogo } = await abrir(user, {
      decidir: async () => ({ id: "op-1", estado: "gestionada" }),
    });
    await user.click(within(dialogo).getByRole("radio", { name: "Correo" }));
    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar como gestionado" })
    );
    await waitFor(() => expect(cliente.decidir).toHaveBeenCalled());
    const decision = cliente.decidir.mock.calls[0][1] as { hechaEn: string };
    expect(Math.abs(Date.parse(decision.hechaEn) - Date.now())).toBeLessThan(
      3 * 60 * 1000
    );
  });

  it("el texto realmente enviado y las notas son opcionales y, si se escriben, viajan", async () => {
    const user = userEvent.setup();
    const { cliente, dialogo } = await abrir(user, {
      decidir: async () => ({ id: "op-1", estado: "gestionada" }),
    });
    await user.click(within(dialogo).getByRole("radio", { name: "Correo" }));
    await user.type(
      within(dialogo).getByLabelText(/Texto que de verdad enviaste/),
      "Hola, versión que mandé"
    );
    await user.type(
      within(dialogo).getByLabelText(/^Notas/),
      "Por el formulario del pie"
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Marcar como gestionado" })
    );
    await waitFor(() => expect(cliente.decidir).toHaveBeenCalled());
    expect(cliente.decidir.mock.calls[0][1]).toMatchObject({
      textoFinal: "Hola, versión que mandé",
      notas: "Por el formulario del pie",
    });
  });

  it("elige canal con teclado: los radios son radios de verdad", async () => {
    const user = userEvent.setup();
    const { dialogo } = await abrir(user);
    const grupo = within(dialogo).getAllByRole("radio");
    expect(grupo.map((r) => r.getAttribute("name"))).toSatisfy(
      (nombres: string[]) => nombres.every((n) => n === nombres[0])
    );
    expect(grupo).toHaveLength(4);
  });

  it("un doble clic manda una sola gestión", async () => {
    const user = userEvent.setup();
    const { cliente, dialogo } = await abrir(user, {
      decidir: () => new Promise(() => {}),
    });
    await user.click(within(dialogo).getByRole("radio", { name: "Correo" }));
    await user.dblClick(
      within(dialogo).getByRole("button", { name: "Marcar como gestionado" })
    );
    expect(cliente.decidir).toHaveBeenCalledTimes(1);
  });

  it("si la oportunidad no tiene un borrador aprobado, el botón está apagado y dice por qué", async () => {
    montar(
      detalle({
        estado: "aprobada",
        borradores: [borrador({ estado: "aprobado" })],
        borradorEditableId: null,
        acciones: [
          {
            accion: "marcar_gestionado",
            habilitada: false,
            motivo: "No hay ningún borrador aprobado.",
          },
        ],
      })
    );
    await cargar();
    expect(
      screen.getByRole("button", { name: "Marcar como gestionado" })
    ).toBeDisabled();
    expect(
      screen.getByText("No hay ningún borrador aprobado.")
    ).toBeInTheDocument();
  });
});

describe("Revisión: Enlace conseguido y cierres", () => {
  it("«Enlace conseguido» exige una URL", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(gestionada());
    await cargar();
    await user.click(screen.getByRole("button", { name: "Enlace conseguido" }));
    const dialogo = screen.getByRole("dialog", { name: "Enlace conseguido" });
    await user.click(
      within(dialogo).getByRole("button", { name: "Registrar el enlace" })
    );
    expect(
      within(dialogo).getByText("Pega la dirección donde está el enlace.")
    ).toBeInTheDocument();
    expect(cliente.decidir).not.toHaveBeenCalled();
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hola",
    "revista.example/articulo",
    "ftp://x.example/a",
  ])("«Enlace conseguido» rechaza «%s»", async (direccion) => {
    const user = userEvent.setup();
    const { cliente } = montar(gestionada());
    await cargar();
    await user.click(screen.getByRole("button", { name: "Enlace conseguido" }));
    const dialogo = screen.getByRole("dialog");
    await user.type(
      within(dialogo).getByLabelText("Dirección de la página"),
      direccion
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Registrar el enlace" })
    );
    expect(dialogo).toHaveTextContent("empiece por http:// o https://");
    expect(cliente.decidir).not.toHaveBeenCalled();
  });

  it("con una URL https la manda", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(gestionada(), {
      decidir: async () => ({ id: "op-1", estado: "conseguida" }),
    });
    await cargar();
    await user.click(screen.getByRole("button", { name: "Enlace conseguido" }));
    const dialogo = screen.getByRole("dialog");
    await user.type(
      within(dialogo).getByLabelText("Dirección de la página"),
      " https://revista.example/listado-actualizado "
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Registrar el enlace" })
    );
    await waitFor(() => expect(cliente.decidir).toHaveBeenCalled());
    expect(cliente.decidir).toHaveBeenCalledWith("op-1", {
      accion: "conseguido",
      urlConseguida: "https://revista.example/listado-actualizado",
    });
  });

  it("una gestionada ofrece los tres cierres", async () => {
    montar(gestionada());
    await cargar();
    expect(
      screen.getByRole("button", { name: "Enlace conseguido" })
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sin respuesta" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Rechazado por el destino" })
    ).toBeEnabled();
    expect(
      screen.getByText("Ya la has contactado. Registra qué ha pasado.")
    ).toBeInTheDocument();
  });

  it("«Sin respuesta» manda la acción con las notas opcionales", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(gestionada(), {
      decidir: async () => ({ id: "op-1", estado: "sin_respuesta" }),
    });
    await cargar();
    await user.click(screen.getByRole("button", { name: "Sin respuesta" }));
    const dialogo = screen.getByRole("dialog", {
      name: "Cerrar sin respuesta",
    });
    expect(dialogo).toHaveTextContent("Cerrada sin éxito");
    await user.click(
      within(dialogo).getByRole("button", { name: "Cerrar sin respuesta" })
    );
    await waitFor(() => expect(cliente.decidir).toHaveBeenCalled());
    expect(cliente.decidir).toHaveBeenCalledWith("op-1", {
      accion: "sin_respuesta",
    });
  });

  it("«Rechazado por el destino» manda la acción rechazado con sus notas", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(gestionada(), {
      decidir: async () => ({ id: "op-1", estado: "sin_respuesta" }),
    });
    await cargar();
    await user.click(
      screen.getByRole("button", { name: "Rechazado por el destino" })
    );
    const dialogo = screen.getByRole("dialog", {
      name: "El destino ha dicho que no",
    });
    await user.type(
      within(dialogo).getByLabelText(/^Notas/),
      "Dicen que ya tienen proveedor"
    );
    await user.click(
      within(dialogo).getByRole("button", { name: "Registrar el rechazo" })
    );
    await waitFor(() => expect(cliente.decidir).toHaveBeenCalled());
    expect(cliente.decidir).toHaveBeenCalledWith("op-1", {
      accion: "rechazado",
      notas: "Dicen que ya tienen proveedor",
    });
  });

  it("un estado final no ofrece nada y lo dice", async () => {
    montar(
      detalle({
        estado: "conseguida",
        borradores: [borrador({ estado: "gestionado" })],
        borradorEditableId: null,
        acciones: [],
      })
    );
    await cargar();
    expect(
      screen.getByText("No hay acciones disponibles en este estado.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Aprobar" })
    ).not.toBeInTheDocument();
  });

  it("el diálogo se cierra con Escape y no manda nada", async () => {
    const user = userEvent.setup();
    const { cliente } = montar(gestionada());
    await cargar();
    await user.click(screen.getByRole("button", { name: "Sin respuesta" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(cliente.decidir).not.toHaveBeenCalled();
  });

  it("un error de una acción anterior no aparece en el diálogo siguiente", async () => {
    const user = userEvent.setup();
    const decidir = vi
      .fn()
      .mockRejectedValueOnce(new ErrorDeCliente(409, "Falló lo primero."))
      .mockResolvedValue({ id: "op-1", estado: "sin_respuesta" });
    montar(gestionada(), { decidir });
    await cargar();
    await user.click(screen.getByRole("button", { name: "Sin respuesta" }));
    await user.click(
      screen.getByRole("button", { name: "Cerrar sin respuesta" })
    );
    await within(screen.getByRole("dialog")).findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await user.click(
      screen.getByRole("button", { name: "Rechazado por el destino" })
    );
    expect(
      within(screen.getByRole("dialog")).queryByRole("alert")
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Carga y errores
// ---------------------------------------------------------------------------

describe("Revisión: carga y errores", () => {
  it("mientras carga hay un esqueleto, no una pantalla en blanco", () => {
    const cliente = clienteFalso({
      detalleDeOportunidad: () => new Promise(() => {}),
    });
    renderConCliente(<VistaDeRevision id="op-1" />, cliente);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
  });

  it("una oportunidad que no existe cuenta el error del backend", async () => {
    const cliente = clienteFalso({
      detalleDeOportunidad: async () => {
        throw new ErrorDeCliente(404, "La oportunidad no existe.");
      },
    });
    renderConCliente(<VistaDeRevision id="nada" />, cliente);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La oportunidad no existe."
    );
    expect(
      screen.getByRole("button", { name: "Reintentar" })
    ).toBeInTheDocument();
  });

  it("siempre hay un enlace para volver a la Bandeja", async () => {
    montar(limpio());
    expect(
      await screen.findByRole("link", { name: "Bandeja" })
    ).toHaveAttribute("href", "/bandeja");
  });

  it("la página de la ruta pasa el id y el ?borrador= a la vista", async () => {
    const elemento = await Pagina({
      params: Promise.resolve({ id: "op-9" }),
      searchParams: Promise.resolve({ borrador: "bo-3" }),
    });
    expect(elemento.props).toMatchObject({ id: "op-9", borradorId: "bo-3" });

    const sin = await Pagina({
      params: Promise.resolve({ id: "op-9" }),
      searchParams: Promise.resolve({}),
    });
    expect(sin.props.borradorId).toBeUndefined();

    const doble = await Pagina({
      params: Promise.resolve({ id: "op-9" }),
      searchParams: Promise.resolve({ borrador: ["a", "b"] }),
    });
    expect(doble.props.borradorId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// De punta a punta con el cliente de demostración
// ---------------------------------------------------------------------------

describe("Revisión con el cliente de demostración", () => {
  it("Bandeja → Revisión → Aprobar: la oportunidad por revisar se aprueba y pasa a «Aprobada»", async () => {
    const user = userEvent.setup();
    const demo = clienteDemo({ retardoMs: 0 });
    renderConCliente(<VistaDeRevision id="demo-op-06" />, demo);
    await cargar();
    await user.click(screen.getByRole("button", { name: "Aprobar" }));
    expect(
      await screen.findByRole("button", { name: "Marcar como gestionado" })
    ).toBeEnabled();
    expect((await demo.detalleDeOportunidad("demo-op-06")).estado).toBe(
      "aprobada"
    );
  });

  it("la bloqueada de la demo no se puede aprobar y enseña las reglas duras en rojo", async () => {
    renderConCliente(
      <VistaDeRevision id="demo-op-07" />,
      clienteDemo({ retardoMs: 0 })
    );
    await cargar();
    expect(
      await screen.findByRole("button", { name: "Aprobar" })
    ).toBeDisabled();
    const panel = screen
      .getByRole("heading", { name: "Cumplimiento" })
      .closest("section")!;
    expect(panel.querySelectorAll("li .text-error").length).toBeGreaterThan(0);
  });

  it("la de dos versiones de la demo enseña el aviso de que apenas cambió respecto a la anterior", async () => {
    renderConCliente(
      <VistaDeRevision id="demo-op-05" />,
      clienteDemo({ retardoMs: 0 })
    );
    await cargar();
    expect(
      await screen.findByText(/^Similitud con la versión anterior: \d+ %$/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Se parece un \d+ % a una versión anterior de esta misma oportunidad: apenas ha cambiado/
      )
    ).toBeInTheDocument();
  });
});
