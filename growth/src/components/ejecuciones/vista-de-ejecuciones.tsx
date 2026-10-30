"use client";

import { Activity, SearchX } from "lucide-react";
import { useState } from "react";
import { D2CampoSelector } from "@/components/comunes/d2-campos";
import { EncabezadoDePagina } from "@/components/encabezado-de-pagina";
import { EstadoDeConsulta } from "@/components/estado-de-consulta";
import { EstadoVacio } from "@/components/estado-vacio";
import { Paginacion } from "@/components/paginacion";
import { useEjecuciones } from "@/lib/consultas";
import { ETIQUETA_DE_ESTADO_DE_EJECUCION } from "@/lib/etiquetas";
import type { DisparadorDeEjecucion, EstadoDeEjecucion } from "@/lib/types";
import { FilaDeEjecucion } from "./fila-de-ejecucion";
import { ETIQUETA_DE_DISPARADOR } from "./utilidades";

export const EJECUCIONES_POR_PAGINA = 20;

const ESTADOS: readonly EstadoDeEjecucion[] = [
  "en_curso",
  "ok",
  "parcial",
  "error",
];
const DISPARADORES: readonly DisparadorDeEjecucion[] = ["programada", "manual"];

/**
 * Ejecuciones: la salud del sistema. Cada run del agente con su estado, su
 * duración, la versión de sus prompts y lo que dejó (candidatas, calificadas,
 * descartadas por motivo, borradores, bloqueadas), y un detalle con lo que
 * hizo cada módulo y el error si lo hubo.
 */
export function VistaDeEjecuciones() {
  const [estado, setEstado] = useState<EstadoDeEjecucion | "">("");
  const [disparador, setDisparador] = useState<DisparadorDeEjecucion | "">("");
  const [pagina, setPagina] = useState(1);

  const consulta = useEjecuciones({
    estado: estado || undefined,
    disparador: disparador || undefined,
    pagina,
    limite: EJECUCIONES_POR_PAGINA,
  });
  const hayFiltros = estado !== "" || disparador !== "";

  return (
    <>
      <EncabezadoDePagina
        titulo="Ejecuciones"
        descripcion="La salud del sistema: qué corrió, cuánto tardó, qué descartó y por qué."
      />

      <fieldset className="panel m-0 mb-5 min-w-0 p-4 sm:p-5">
        <legend className="sr-only">Filtros de las ejecuciones</legend>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <D2CampoSelector
            etiqueta="Estado"
            valor={estado}
            alCambiar={(valor) => {
              setEstado(valor as EstadoDeEjecucion | "");
              setPagina(1);
            }}
            opciones={ESTADOS.map((e) => ({
              valor: e,
              etiqueta: ETIQUETA_DE_ESTADO_DE_EJECUCION[e],
            }))}
            textoDeTodos="Todos"
          />
          <D2CampoSelector
            etiqueta="Cómo se lanzó"
            valor={disparador}
            alCambiar={(valor) => {
              setDisparador(valor as DisparadorDeEjecucion | "");
              setPagina(1);
            }}
            opciones={DISPARADORES.map((d) => ({
              valor: d,
              etiqueta: ETIQUETA_DE_DISPARADOR[d],
            }))}
            textoDeTodos="Todas"
          />
          {hayFiltros ? (
            <div className="flex items-end">
              <button
                type="button"
                className="btn-secondary h-11 px-4"
                onClick={() => {
                  setEstado("");
                  setDisparador("");
                  setPagina(1);
                }}
              >
                Quitar filtros
              </button>
            </div>
          ) : null}
        </div>
      </fieldset>

      <EstadoDeConsulta
        consulta={consulta}
        titulo="No se pudieron cargar las ejecuciones"
      >
        {(lista) => {
          if (lista.data.length === 0) {
            return hayFiltros ? (
              <EstadoVacio
                icono={SearchX}
                titulo="Ninguna ejecución coincide con estos filtros"
              >
                Prueba con otro estado o quita algún filtro.
              </EstadoVacio>
            ) : (
              <EstadoVacio icono={Activity} titulo="Aún no hay ejecuciones">
                Cuando el agente haga su primera ejecución aparecerá aquí, con
                lo que tardó, qué módulos corrieron y qué descartó y por qué.
              </EstadoVacio>
            );
          }
          return (
            <div aria-busy={consulta.isPlaceholderData}>
              <p className="mb-3 text-sm text-muted" aria-live="polite">
                {lista.total} {lista.total === 1 ? "ejecución" : "ejecuciones"}
                {hayFiltros ? " con estos filtros" : ""}
              </p>
              <ol
                aria-label="Ejecuciones"
                className={`space-y-3 ${consulta.isPlaceholderData ? "opacity-60" : ""}`}
              >
                {lista.data.map((ejecucion) => (
                  <FilaDeEjecucion key={ejecucion.id} ejecucion={ejecucion} />
                ))}
              </ol>
              <Paginacion
                pagina={lista.pagina}
                limite={lista.limite}
                total={lista.total}
                alCambiar={setPagina}
                cargando={consulta.isPlaceholderData}
              />
            </div>
          );
        }}
      </EstadoDeConsulta>
    </>
  );
}
