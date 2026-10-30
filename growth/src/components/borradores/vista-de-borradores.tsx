"use client";

import { FileText, Search, SearchX, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useAhora } from "@/components/comunes/d1-ahora";
import { ConsultaConDatos } from "@/components/comunes/d1-consulta-con-datos";
import { EncabezadoDePagina } from "@/components/encabezado-de-pagina";
import { EstadoVacio } from "@/components/estado-vacio";
import { Paginacion } from "@/components/paginacion";
import { useBorradores } from "@/lib/consultas";
import {
  ETIQUETA_DE_GRUPO_DE_BORRADORES,
  ETIQUETA_DE_TIPO_DE_BORRADOR,
  etiquetaCortaDeObjetivo,
} from "@/lib/etiquetas";
import {
  GRUPOS_DE_BORRADORES,
  OBJETIVOS,
  TIPOS_DE_BORRADOR,
  type FiltrosDeBorradores,
  type GrupoDeBorradores,
  type Objetivo,
  type TipoDeBorrador,
} from "@/lib/types";
import { TarjetaDeBorrador } from "./tarjeta-de-borrador";

const LIMITE_DE_PAGINA = 20;

const TEXTO_DE_VACIO: Record<GrupoDeBorradores, string> = {
  bloqueados: "No hay borradores bloqueados.",
  pendientes: "No hay borradores por revisar.",
  aprobados: "No hay borradores aprobados pendientes de gestionar.",
  gestionados: "Todavía no has gestionado ningún borrador.",
  caducados: "Ninguna oportunidad con borrador ha caducado.",
  descartados: "No hay borradores descartados.",
};

type Estado = {
  grupo: GrupoDeBorradores;
  objetivo: Objetivo | "";
  tipo: TipoDeBorrador | "";
  /** Lo que se está buscando (ya aplicado a la consulta). */
  q: string;
  orden: "recientes" | "caducan";
  pagina: number;
};

const ESTADO_INICIAL: Estado = {
  grupo: "pendientes",
  objetivo: "",
  tipo: "",
  q: "",
  orden: "recientes",
  pagina: 1,
};

function aFiltrosDeApi(estado: Estado): FiltrosDeBorradores {
  return {
    grupo: estado.grupo,
    ...(estado.objetivo ? { objetivo: estado.objetivo } : {}),
    ...(estado.tipo ? { tipo: estado.tipo } : {}),
    ...(estado.q ? { q: estado.q } : {}),
    orden: estado.orden,
    pagina: estado.pagina,
    limite: LIMITE_DE_PAGINA,
  };
}

/**
 * Borradores: todo el trabajo en curso, por estado. Seis grupos con su
 * recuento (bloqueados con el porqué, por revisar, aprobados sin gestionar,
 * gestionados, caducados, descartados), filtros por objetivo y tipo, búsqueda
 * y cada tarjeta enlazada a su Revisión.
 */
export function VistaDeBorradores() {
  const id = useId();
  const [estado, setEstado] = useState<Estado>(ESTADO_INICIAL);
  const [busqueda, setBusqueda] = useState("");
  const ahora = useAhora();
  const consulta = useBorradores(aFiltrosDeApi(estado));

  function cambiar(cambios: Partial<Estado>) {
    setEstado((previo) => ({ ...previo, pagina: 1, ...cambios }));
  }

  function buscar(evento: FormEvent) {
    evento.preventDefault();
    const q = busqueda.trim().slice(0, 100);
    cambiar({ q });
  }

  function limpiarBusqueda() {
    setBusqueda("");
    cambiar({ q: "" });
  }

  const conteos = consulta.data?.conteos;
  const conFiltros =
    estado.objetivo !== "" || estado.tipo !== "" || estado.q !== "";

  return (
    <>
      <EncabezadoDePagina
        titulo="Borradores"
        descripcion="Todo el trabajo en curso, por estado."
      />

      <div
        role="group"
        aria-label="Estado de los borradores"
        className="mb-5 flex flex-wrap gap-2"
      >
        {GRUPOS_DE_BORRADORES.map((grupo) => (
          <button
            key={grupo}
            type="button"
            aria-pressed={estado.grupo === grupo}
            onClick={() => cambiar({ grupo })}
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-linea bg-superficie px-4 text-sm font-semibold text-tinta-3 transition duration-150 hover:bg-relleno focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado aria-pressed:border-lavado-borde aria-pressed:bg-lavado aria-pressed:text-morado-tinta"
          >
            {ETIQUETA_DE_GRUPO_DE_BORRADORES[grupo]}
            {conteos ? (
              <>
                {" "}
                <span className="text-xs font-normal">({conteos[grupo]})</span>
              </>
            ) : null}
          </button>
        ))}
      </div>

      <section aria-label="Filtros" className="mb-5 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="min-w-0">
            <label
              htmlFor={`${id}-objetivo`}
              className="mb-1 block text-xs font-semibold text-muted"
            >
              Objetivo
            </label>
            <select
              id={`${id}-objetivo`}
              className="field w-full"
              value={estado.objetivo}
              onChange={(e) =>
                cambiar({ objetivo: e.target.value as Objetivo | "" })
              }
            >
              <option value="">Todos los objetivos</option>
              {OBJETIVOS.map((o) => (
                <option key={o} value={o}>
                  {etiquetaCortaDeObjetivo(o)}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label
              htmlFor={`${id}-tipo`}
              className="mb-1 block text-xs font-semibold text-muted"
            >
              Tipo de borrador
            </label>
            <select
              id={`${id}-tipo`}
              className="field w-full"
              value={estado.tipo}
              onChange={(e) =>
                cambiar({ tipo: e.target.value as TipoDeBorrador | "" })
              }
            >
              <option value="">Todos los tipos</option>
              {TIPOS_DE_BORRADOR.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_DE_TIPO_DE_BORRADOR[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label
              htmlFor={`${id}-orden`}
              className="mb-1 block text-xs font-semibold text-muted"
            >
              Ordenar por
            </label>
            <select
              id={`${id}-orden`}
              className="field w-full"
              value={estado.orden}
              onChange={(e) =>
                cambiar({ orden: e.target.value as Estado["orden"] })
              }
            >
              <option value="recientes">Más recientes</option>
              <option value="caducan">Caducan antes</option>
            </select>
          </div>
        </div>
        <form role="search" onSubmit={buscar} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <label htmlFor={`${id}-q`} className="sr-only">
              Buscar por asunto, texto o dominio
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tenue"
              aria-hidden="true"
            />
            <input
              id={`${id}-q`}
              type="search"
              maxLength={100}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por asunto, texto o dominio"
              className="field w-full pl-10"
            />
          </div>
          <button type="submit" className="btn-secondary h-11 shrink-0">
            Buscar
          </button>
          {estado.q ? (
            <button
              type="button"
              onClick={limpiarBusqueda}
              aria-label="Quitar la búsqueda"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-apagado hover:bg-relleno hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
        </form>
      </section>

      <ConsultaConDatos
        consulta={consulta}
        titulo="No se pudieron cargar los borradores"
      >
        {(lista) => {
          if (lista.data.length === 0 && lista.total > 0) {
            return (
              <EstadoVacio
                icono={SearchX}
                titulo="Esta página ya no tiene nada"
              >
                <button
                  type="button"
                  className="btn-secondary h-11"
                  onClick={() => cambiar({ pagina: 1 })}
                >
                  Volver a la primera página
                </button>
              </EstadoVacio>
            );
          }
          if (lista.data.length === 0) {
            return (
              <EstadoVacio
                icono={conFiltros ? SearchX : FileText}
                titulo={
                  conFiltros
                    ? "Ningún borrador encaja con estos filtros"
                    : TEXTO_DE_VACIO[estado.grupo]
                }
              />
            );
          }
          return (
            <div aria-busy={consulta.isPlaceholderData || undefined}>
              <p className="mb-3 text-sm text-muted" aria-live="polite">
                {lista.total === 1 ? "1 borrador" : `${lista.total} borradores`}
              </p>
              <ul
                className={`space-y-3 transition-opacity duration-150 ${consulta.isPlaceholderData ? "opacity-60" : ""}`}
              >
                {lista.data.map((borrador) => (
                  <TarjetaDeBorrador
                    key={borrador.id}
                    borrador={borrador}
                    ahora={ahora}
                  />
                ))}
              </ul>
              <Paginacion
                pagina={lista.pagina}
                limite={lista.limite}
                total={lista.total}
                cargando={consulta.isPlaceholderData}
                alCambiar={(pagina) => cambiar({ pagina })}
              />
            </div>
          );
        }}
      </ConsultaConDatos>
    </>
  );
}
