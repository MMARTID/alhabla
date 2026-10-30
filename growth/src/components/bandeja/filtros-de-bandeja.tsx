"use client";

import { useId } from "react";
import {
  ESTADOS_DE_LA_BANDEJA,
  ETIQUETA_DE_ESTADO,
  ETIQUETA_DE_TIPO_DE_DESTINO,
  etiquetaCortaDeObjetivo,
} from "@/lib/etiquetas";
import {
  ESTADOS_DE_OPORTUNIDAD,
  OBJETIVOS,
  TIPOS_DE_DESTINO,
  type EstadoDeOportunidad,
  type Objetivo,
  type OrdenDeOportunidades,
  type TipoDeDestino,
} from "@/lib/types";
import {
  hayFiltrosActivos,
  type EstadoElegido,
  type FiltrosDeBandeja,
} from "./estado-de-filtros";

export type OpcionDeNicho = { slug: string; nombre: string };

/** Un competidor al que se puede filtrar por «Menciona a». */
export type OpcionDeCompetidor = { dominio: string; nombre: string };

const ETIQUETA_DE_ORDEN: Record<OrdenDeOportunidades, string> = {
  puntuacion: "Mejor puntuación",
  recientes: "Más recientes",
  caducan: "Caducan antes",
};

function Selector({
  etiqueta,
  valor,
  alCambiar,
  children,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-semibold text-muted"
      >
        {etiqueta}
      </label>
      <select
        id={id}
        className="field w-full"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

/**
 * Los filtros de la Bandeja: objetivo (A/B/C) como control segmentado, y
 * estado, nicho, tipo de destino y orden como selectores nativos (en el móvil
 * abren el selector del sistema). Todos con objetivos táctiles de 44 px.
 */
export function BarraDeFiltros({
  filtros,
  nichos,
  competidores = [],
  conteos,
  alCambiar,
  alQuitar,
}: {
  filtros: FiltrosDeBandeja;
  nichos: readonly OpcionDeNicho[];
  /** Los competidores que se pueden mencionar; vacío = no hay filtro «Menciona a». */
  competidores?: readonly OpcionDeCompetidor[];
  /** Con los mismos filtros salvo el estado; `undefined` mientras carga. */
  conteos?: Record<EstadoDeOportunidad, number>;
  alCambiar: (cambios: Partial<FiltrosDeBandeja>) => void;
  alQuitar: () => void;
}) {
  const grupo = useId();
  const sumaDeBandeja = conteos
    ? ESTADOS_DE_LA_BANDEJA.reduce((total, e) => total + (conteos[e] ?? 0), 0)
    : null;
  const conRecuento = (texto: string, n: number | null | undefined) =>
    n === null || n === undefined ? texto : `${texto} (${n})`;
  // Si el filtro viene de un enlace y el competidor ya no está (o aún no ha
  // cargado), se sigue pudiendo ver y quitar.
  const opcionesDeCompetidor =
    filtros.menciona !== "" &&
    !competidores.some((c) => c.dominio === filtros.menciona)
      ? [
          ...competidores,
          { dominio: filtros.menciona, nombre: filtros.menciona },
        ]
      : competidores;

  const opcionesDeObjetivo: Array<{ valor: Objetivo | ""; etiqueta: string }> =
    [
      { valor: "", etiqueta: "Todos" },
      ...OBJETIVOS.map((o) => ({
        valor: o,
        etiqueta: etiquetaCortaDeObjetivo(o),
      })),
    ];

  return (
    <section aria-label="Filtros" className="mb-5 space-y-4">
      <fieldset>
        <legend className="mb-1 text-xs font-semibold text-muted">
          Objetivo
        </legend>
        <div className="flex flex-wrap gap-2">
          {opcionesDeObjetivo.map((opcion) => {
            const id = `${grupo}-${opcion.valor || "todos"}`;
            return (
              <div key={id}>
                <input
                  id={id}
                  type="radio"
                  name={`${grupo}-objetivo`}
                  className="peer sr-only"
                  checked={filtros.objetivo === opcion.valor}
                  onChange={() => alCambiar({ objetivo: opcion.valor })}
                />
                <label
                  htmlFor={id}
                  className="flex min-h-11 cursor-pointer items-center rounded-full border border-linea bg-superficie px-4 text-sm font-semibold text-tinta-3 transition duration-150 hover:bg-relleno peer-checked:border-lavado-borde peer-checked:bg-lavado peer-checked:text-morado-tinta peer-focus-visible:ring-2 peer-focus-visible:ring-morado"
                >
                  {opcion.etiqueta}
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div
        className={`grid grid-cols-2 gap-3 ${opcionesDeCompetidor.length > 0 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
      >
        <Selector
          etiqueta="Estado"
          valor={filtros.estado}
          alCambiar={(valor) => alCambiar({ estado: valor as EstadoElegido })}
        >
          <option value="bandeja">
            {conRecuento("Para mirar", sumaDeBandeja)}
          </option>
          <option value="todas">Todas</option>
          {ESTADOS_DE_OPORTUNIDAD.map((estado) => (
            <option key={estado} value={estado}>
              {conRecuento(ETIQUETA_DE_ESTADO[estado], conteos?.[estado])}
            </option>
          ))}
        </Selector>
        <Selector
          etiqueta="Nicho"
          valor={filtros.nicho}
          alCambiar={(valor) => alCambiar({ nicho: valor })}
        >
          <option value="">Todos los nichos</option>
          {nichos.map((nicho) => (
            <option key={nicho.slug} value={nicho.slug}>
              {nicho.nombre}
            </option>
          ))}
        </Selector>
        <Selector
          etiqueta="Tipo de destino"
          valor={filtros.tipoDestino}
          alCambiar={(valor) =>
            alCambiar({ tipoDestino: valor as TipoDeDestino | "" })
          }
        >
          <option value="">Todos los tipos</option>
          {TIPOS_DE_DESTINO.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ETIQUETA_DE_TIPO_DE_DESTINO[tipo]}
            </option>
          ))}
        </Selector>
        {opcionesDeCompetidor.length > 0 ? (
          <Selector
            etiqueta="Menciona a"
            valor={filtros.menciona}
            alCambiar={(valor) => alCambiar({ menciona: valor })}
          >
            <option value="">Cualquiera</option>
            {opcionesDeCompetidor.map((competidor) => (
              <option key={competidor.dominio} value={competidor.dominio}>
                {competidor.nombre}
              </option>
            ))}
          </Selector>
        ) : null}
        <Selector
          etiqueta="Ordenar por"
          valor={filtros.orden}
          alCambiar={(valor) =>
            alCambiar({ orden: valor as OrdenDeOportunidades })
          }
        >
          {(Object.keys(ETIQUETA_DE_ORDEN) as OrdenDeOportunidades[]).map(
            (orden) => (
              <option key={orden} value={orden}>
                {ETIQUETA_DE_ORDEN[orden]}
              </option>
            )
          )}
        </Selector>
      </div>

      {hayFiltrosActivos(filtros) ? (
        <button
          type="button"
          onClick={alQuitar}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-morado-tinta underline underline-offset-2 hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
        >
          Quitar filtros
        </button>
      ) : null}
    </section>
  );
}
