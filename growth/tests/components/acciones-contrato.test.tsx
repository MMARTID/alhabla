import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { VistaDeRevision } from "@/components/revision/vista-de-revision";
import { ORDEN_DE_ACCIONES } from "@/components/revision/acciones";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import { ESTADO_POR_ACCION, puedeTransicionar } from "@/lib/demo/estados-demo";
import { ETIQUETA_DE_ACCION } from "@/lib/etiquetas";
import type {
  AccionDisponible,
  DetalleDeOportunidad,
  EstadoDeOportunidad,
} from "@/lib/types";
import detalleRealCrudo from "../fixtures/detalle-real-094.json";
import { clienteFalso } from "../helpers/cliente-falso";
import { REGLA_DURA_ROTA, REGLAS_LIMPIAS, ahoraMas } from "../helpers/d1-datos";
import { renderConCliente } from "../helpers/render";
import { reiniciarTodo } from "../helpers/reiniciar";

/**
 * EL contrato de `acciones` del detalle de una oportunidad, ejecutado con el
 * MISMO caso contra dos orígenes:
 *
 * - el cliente de demostración (todas las oportunidades de los datos de prueba), y
 * - una respuesta con la FORMA REAL del backend (`tests/fixtures/detalle-real-094.json`
 *   es `GET /growth/admin/oportunidades/:id` de un servidor de verdad), con
 *   `acciones` ajustadas al contrato nuevo.
 *
 * El contrato: el backend manda SOLO las acciones alcanzables desde el estado
 * actual (un estado final manda una lista vacía); cada una lleva
 * `habilitada` y, si es `false` porque lo impide una regla, un `motivo` en
 * español. La Revisión pinta un botón por cada una, con su etiqueta humana, y
 * enseña el motivo junto al botón apagado: sin identificadores crudos ni «no
 * admite esta acción».
 */

beforeEach(() => {
  reiniciarTodo();
});

// ---------------------------------------------------------------------------
// El caso de contrato
// ---------------------------------------------------------------------------

/** Lo que nunca debe verse en la tarjeta de decisión. */
const IDENTIFICADORES_CRUDOS =
  /pendiente_aprobacion|con_borrador|marcar_gestionado|sin_respuesta|no admite/i;

function exigirContratoDeDatos(detalle: DetalleDeOportunidad) {
  const nombres = detalle.acciones.map((a) => a.accion);
  expect(new Set(nombres).size, "sin acciones repetidas").toBe(nombres.length);
  for (const accion of detalle.acciones) {
    expect(
      ORDEN_DE_ACCIONES,
      `${accion.accion} es una acción conocida`
    ).toContain(accion.accion);
    // Solo alcanzables desde el estado actual.
    expect(
      puedeTransicionar(
        detalle.estado,
        ESTADO_POR_ACCION[accion.accion],
        "admin"
      ),
      `«${accion.accion}» no es alcanzable desde ${detalle.estado}`
    ).toBe(true);
    if (accion.habilitada) {
      expect(accion.motivo).toBeUndefined();
    } else {
      // Apagada = lo impide una regla, y se dice cuál.
      expect(accion.motivo, `motivo de ${accion.accion}`).toEqual(
        expect.stringMatching(/\S/)
      );
      expect(accion.motivo).not.toMatch(IDENTIFICADORES_CRUDOS);
      expect(accion.motivo).not.toContain("_");
    }
  }
}

async function exigirContratoDeLaTarjeta(detalle: DetalleDeOportunidad) {
  const vista = renderConCliente(
    <VistaDeRevision id={detalle.id} />,
    clienteFalso({ detalleDeOportunidad: async () => detalle })
  );
  const tarjeta = (
    await screen.findByRole("heading", { name: "Decisión" })
  ).closest("section")!;
  const botones = within(tarjeta).queryAllByRole("button");
  const etiquetas = botones.map((b) => b.textContent?.trim());

  // Un botón por acción presente, con su etiqueta humana (y ninguno más). Única
  // excepción documentada: en una oportunidad con borrador editable «Aprobar»
  // sale aunque el estado no permita aprobar, apagado y explicando que hay que
  // editar (una bloqueada).
  const esperadas = detalle.acciones.map((a) => ETIQUETA_DE_ACCION[a.accion]);
  const hayAprobarDeCortesia =
    detalle.borradorEditableId !== null &&
    !detalle.acciones.some((a) => a.accion === "aprobar");
  if (hayAprobarDeCortesia) esperadas.push(ETIQUETA_DE_ACCION.aprobar);
  expect([...etiquetas].sort()).toEqual([...esperadas].sort());

  if (detalle.acciones.length === 0 && !hayAprobarDeCortesia) {
    expect(
      within(tarjeta).getByText("No hay acciones disponibles en este estado.")
    ).toBeVisible();
  }

  for (const accion of detalle.acciones) {
    const boton = within(tarjeta).getByRole("button", {
      name: ETIQUETA_DE_ACCION[accion.accion],
    });
    if (!accion.habilitada) {
      expect(boton, accion.accion).toBeDisabled();
      // El porqué, a la vista junto al botón.
      expect(tarjeta).toHaveTextContent(accion.motivo!);
    }
  }
  expect(tarjeta.textContent).not.toMatch(IDENTIFICADORES_CRUDOS);
  vista.unmount();
}

// ---------------------------------------------------------------------------
// Los dos orígenes
// ---------------------------------------------------------------------------

/** La respuesta real del backend, con fechas relativas a ahora (para no caducar nunca). */
function detalleReal(
  parcial: Partial<DetalleDeOportunidad> = {}
): DetalleDeOportunidad {
  const copia = structuredClone(
    detalleRealCrudo
  ) as unknown as DetalleDeOportunidad;
  return {
    ...copia,
    expiraEn: ahoraMas(40),
    diasParaCaducar: 40,
    ...parcial,
  };
}

const acc = (
  nombre: AccionDisponible["accion"],
  motivo?: string
): AccionDisponible =>
  motivo === undefined
    ? { accion: nombre, habilitada: true }
    : { accion: nombre, habilitada: false, motivo };

/** `acciones` del contrato nuevo para cada estado (lo que mandará el backend). */
const ACCIONES_POR_ESTADO: Partial<
  Record<EstadoDeOportunidad, AccionDisponible[]>
> = {
  pendiente_aprobacion: [acc("aprobar"), acc("devolver"), acc("descartar")],
  bloqueada: [acc("descartar")],
  aprobada: [acc("marcar_gestionado"), acc("descartar")],
  gestionada: [acc("conseguido"), acc("sin_respuesta"), acc("rechazado")],
  devuelta: [acc("descartar")],
  // Estados finales: nada que ofrecer.
  conseguida: [],
  sin_respuesta: [],
  descartada: [],
  caducada: [],
};

/** En qué estado está el borrador de cada estado de la oportunidad. */
const BORRADOR_POR_ESTADO: Partial<
  Record<
    EstadoDeOportunidad,
    DetalleDeOportunidad["borradores"][number]["estado"]
  >
> = {
  pendiente_aprobacion: "pendiente_aprobacion",
  bloqueada: "bloqueado",
  aprobada: "aprobado",
  gestionada: "gestionado",
  conseguida: "gestionado",
  sin_respuesta: "gestionado",
  devuelta: "descartado",
  descartada: "descartado",
  caducada: "descartado",
};

/** La respuesta real (094), puesta en otro estado con sus acciones y su borrador. */
function detalleRealEn(estado: EstadoDeOportunidad): DetalleDeOportunidad {
  const base = detalleReal();
  const estadoDelBorrador = BORRADOR_POR_ESTADO[estado]!;
  const editable =
    estadoDelBorrador === "pendiente_aprobacion" ||
    estadoDelBorrador === "bloqueado";
  return detalleReal({
    estado,
    acciones: ACCIONES_POR_ESTADO[estado],
    borradores: base.borradores.map((b) => ({
      ...b,
      estado: estadoDelBorrador,
    })),
    borradorEditableId: editable ? base.borradores[0].id : null,
  });
}

const casosDeFormaReal: Array<[string, DetalleDeOportunidad]> = [
  ...(Object.keys(ACCIONES_POR_ESTADO) as EstadoDeOportunidad[]).map(
    (estado): [string, DetalleDeOportunidad] => [
      `la respuesta real en «${estado}»`,
      detalleRealEn(estado),
    ]
  ),
  [
    "la respuesta real con «Aprobar» apagado por una regla dura fallida",
    detalleReal({
      acciones: [
        acc("aprobar", "El borrador está bloqueado por las reglas."),
        acc("devolver"),
        acc("descartar"),
      ],
      borradores: detalleReal().borradores.map((b) => ({
        ...b,
        revisiones: [
          {
            ...b.revisiones[b.revisiones.length - 1],
            resultado: "bloquea" as const,
            comprobaciones: [REGLA_DURA_ROTA, ...REGLAS_LIMPIAS],
          },
        ],
      })),
    }),
  ],
  [
    "la respuesta real con «Marcar como gestionado» apagado por falta de borrador aprobado",
    {
      ...detalleRealEn("aprobada"),
      // Una aprobada sin ningún borrador aprobado (no debería pasar, pero la
      // regla existe y el backend la explica).
      borradores: detalleReal().borradores.map((b) => ({
        ...b,
        estado: "descartado" as const,
      })),
      acciones: [
        acc("marcar_gestionado", "No hay ningún borrador aprobado."),
        acc("descartar"),
      ],
    },
  ],
];

describe("contrato de «acciones»: el cliente de demostración", () => {
  it("cada oportunidad de los datos de prueba lo cumple, en los datos y en la tarjeta de decisión", async () => {
    const cliente = clienteDemo({ retardoMs: 0 });
    const { data } = await cliente.listarOportunidades({ limite: 200 });
    expect(data.length).toBeGreaterThanOrEqual(13);
    const estadosVistos = new Set<EstadoDeOportunidad>();
    for (const resumen of data) {
      const detalle = await cliente.detalleDeOportunidad(resumen.id);
      exigirContratoDeDatos(detalle);
      await exigirContratoDeLaTarjeta(detalle);
      estadosVistos.add(detalle.estado);
    }
    // Y de verdad se han recorrido estados con y sin acciones.
    expect(estadosVistos.size).toBeGreaterThanOrEqual(10);
  });

  it("una bloqueada solo ofrece descartar y una caducada, nada", async () => {
    const cliente = clienteDemo({ retardoMs: 0 });
    // La bloqueada solo admite descartar: «aprobar» no es alcanzable y no viene.
    const bloqueada = await cliente.detalleDeOportunidad("demo-op-07");
    expect(bloqueada.acciones).toEqual([acc("descartar")]);
    // Una caducada es un estado final: no ofrece nada.
    expect((await cliente.detalleDeOportunidad("demo-op-14")).acciones).toEqual(
      []
    );
  });
});

describe("contrato de «acciones»: una respuesta con la forma real del backend", () => {
  it("la fixture es de verdad una respuesta del servidor (forma, no maqueta)", () => {
    const real = detalleReal();
    expect(real.id).toMatch(/^c[a-z0-9]{24}$/);
    expect(real.acciones.map((a) => a.accion)).toEqual(
      ORDEN_DE_ACCIONES.slice()
    );
    expect(real).toHaveProperty("codigoDescarte", null);
    expect(real.borradores[0].revisiones[0]).toHaveProperty("borradorId");
  });

  it.each(casosDeFormaReal)(
    "%s cumple el contrato, en los datos y en la tarjeta de decisión",
    async (_nombre, detalle) => {
      exigirContratoDeDatos(detalle);
      await exigirContratoDeLaTarjeta(detalle);
    }
  );

  it("el contrato antiguo (las siete acciones, las que no tocan apagadas con «no admite») no pinta botones inalcanzables", async () => {
    // Tal cual la devolvió el servidor de la fixture, sin ajustar.
    const antiguo = detalleReal({
      acciones: structuredClone(
        detalleRealCrudo.acciones
      ) as unknown as AccionDisponible[],
    });
    expect(antiguo.acciones).toHaveLength(7);
    renderConCliente(
      <VistaDeRevision id={antiguo.id} />,
      clienteFalso({ detalleDeOportunidad: async () => antiguo })
    );
    const tarjeta = (
      await screen.findByRole("heading", { name: "Decisión" })
    ).closest("section")!;
    expect(
      within(tarjeta)
        .getAllByRole("button")
        .map((b) => b.textContent?.trim())
    ).toEqual(["Aprobar", "Devolver con nota", "Descartar"]);
    expect(tarjeta.textContent).not.toMatch(IDENTIFICADORES_CRUDOS);
  });

  it("una acción apagada sin motivo sale con una frase genérica, nunca vacía", async () => {
    const sinMotivo = detalleReal({
      acciones: [
        { accion: "aprobar", habilitada: true },
        { accion: "descartar", habilitada: false },
      ],
    });
    renderConCliente(
      <VistaDeRevision id={sinMotivo.id} />,
      clienteFalso({ detalleDeOportunidad: async () => sinMotivo })
    );
    const tarjeta = (
      await screen.findByRole("heading", { name: "Decisión" })
    ).closest("section")!;
    expect(
      within(tarjeta).getByRole("button", { name: "Descartar" })
    ).toBeDisabled();
    expect(
      within(tarjeta).getByText("No disponible ahora mismo.")
    ).toBeVisible();
  });

  it("un identificador de acción que la interfaz no conoce no se pinta", async () => {
    const raro = detalleReal({
      acciones: [
        { accion: "aprobar", habilitada: true },
        { accion: "teletransportar" as never, habilitada: true },
      ],
    });
    renderConCliente(
      <VistaDeRevision id={raro.id} />,
      clienteFalso({ detalleDeOportunidad: async () => raro })
    );
    const tarjeta = (
      await screen.findByRole("heading", { name: "Decisión" })
    ).closest("section")!;
    expect(tarjeta.textContent).not.toContain("teletransportar");
    expect(
      within(tarjeta)
        .getAllByRole("button")
        .map((b) => b.textContent?.trim())
    ).toEqual(["Aprobar"]);
  });
});
