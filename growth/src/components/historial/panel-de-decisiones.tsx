"use client";

import { History, SearchX } from "lucide-react";
import { useId, useMemo, useState } from "react";
import {
  D2CampoDeFecha,
  D2CampoSelector,
  D2CasillaDeVerificacion,
  type OpcionDeSelector,
} from "@/components/comunes/d2-campos";
import { EstadoDeConsulta } from "@/components/estado-de-consulta";
import { EstadoVacio } from "@/components/estado-vacio";
import { Paginacion } from "@/components/paginacion";
import { useDecisiones } from "@/lib/consultas";
import { etiquetaDeAccionDelRegistro } from "@/lib/etiquetas";
import { FilaDeDecision } from "./fila-de-decision";
import { rangoDeFechas } from "./filtros-de-historial";

export const DECISIONES_POR_PAGINA = 20;

type Filtros = {
  accion: string;
  soloSistema: boolean;
  desde: string;
  hasta: string;
};

const SIN_FILTROS: Filtros = {
  accion: "",
  soloSistema: false,
  desde: "",
  hasta: "",
};

/**
 * El registro de decisiones: acción, motivo, quién, cuándo y a qué
 * oportunidad. De solo lectura; paginado y filtrable por acción, por fecha y
 * por «sin oportunidad» (ajustes y sincronizaciones).
 */
export function PanelDeDecisiones() {
  const idErrorDeFechas = useId();
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [pagina, setPagina] = useState(1);
  const rango = rangoDeFechas(filtros.desde, filtros.hasta);

  const consulta = useDecisiones({
    accion: filtros.accion || undefined,
    soloSistema: filtros.soloSistema ? true : undefined,
    fechaDesde: rango.desde,
    fechaHasta: rango.hasta,
    pagina,
    limite: DECISIONES_POR_PAGINA,
  });

  function cambiar(parcial: Partial<Filtros>) {
    setFiltros((actuales) => ({ ...actuales, ...parcial }));
    setPagina(1);
  }

  // Las acciones que hay en el registro con los mismos filtros salvo la acción
  // (el backend cuenta así), más la elegida por si ya no queda ninguna.
  const porAccion = consulta.data?.conteos.porAccion;
  const opcionesDeAccion = useMemo<OpcionDeSelector[]>(() => {
    const cuentas: Record<string, number | undefined> = { ...porAccion };
    if (filtros.accion && !(filtros.accion in cuentas)) {
      cuentas[filtros.accion] = 0;
    }
    return Object.entries(cuentas)
      .map(([accion, n]) => ({
        valor: accion,
        etiqueta: `${etiquetaDeAccionDelRegistro(accion)} (${n ?? 0})`,
      }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, "es"));
  }, [porAccion, filtros.accion]);

  const hayFiltros =
    filtros.accion !== "" ||
    filtros.soloSistema ||
    filtros.desde !== "" ||
    filtros.hasta !== "";

  return (
    <div>
      <fieldset className="panel m-0 mb-5 min-w-0 p-4 sm:p-5">
        <legend className="sr-only">Filtros de las decisiones</legend>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <D2CampoSelector
            className="col-span-2 lg:col-span-1"
            etiqueta="Acción"
            valor={filtros.accion}
            alCambiar={(accion) => cambiar({ accion })}
            opciones={opcionesDeAccion}
            textoDeTodos="Todas las acciones"
          />
          <D2CampoDeFecha
            etiqueta="Desde"
            valor={filtros.desde}
            alCambiar={(desde) => cambiar({ desde })}
            invalido={rango.invalido}
            descripcionDelErrorId={idErrorDeFechas}
          />
          <D2CampoDeFecha
            etiqueta="Hasta"
            valor={filtros.hasta}
            alCambiar={(hasta) => cambiar({ hasta })}
            invalido={rango.invalido}
            descripcionDelErrorId={idErrorDeFechas}
          />
        </div>
        {rango.invalido ? (
          <p
            id={idErrorDeFechas}
            className="mt-2 text-sm text-error"
            role="alert"
          >
            «Desde» es posterior a «Hasta»: no se aplica ninguna de las dos
            fechas.
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4">
          <D2CasillaDeVerificacion
            etiqueta="Solo ajustes y tareas del sistema (sin oportunidad)"
            marcada={filtros.soloSistema}
            alCambiar={(soloSistema) => cambiar({ soloSistema })}
          />
          {hayFiltros ? (
            <button
              type="button"
              className="btn-secondary h-11 px-4"
              onClick={() => {
                setFiltros(SIN_FILTROS);
                setPagina(1);
              }}
            >
              Quitar filtros
            </button>
          ) : null}
        </div>
      </fieldset>

      <EstadoDeConsulta
        consulta={consulta}
        titulo="No se pudo cargar el historial de decisiones"
      >
        {(lista) => {
          if (lista.data.length === 0) {
            return hayFiltros ? (
              <EstadoVacio
                icono={SearchX}
                titulo="Ninguna decisión coincide con estos filtros"
              >
                Prueba con otras fechas o quita algún filtro.
              </EstadoVacio>
            ) : (
              <EstadoVacio icono={History} titulo="Todavía no hay decisiones">
                Cada vez que apruebes, devuelvas o descartes algo, o que cambie
                un ajuste, quedará aquí con su fecha y su autor.
              </EstadoVacio>
            );
          }
          return (
            <div aria-busy={consulta.isPlaceholderData}>
              <p className="mb-3 text-sm text-muted" aria-live="polite">
                {lista.total} {lista.total === 1 ? "decisión" : "decisiones"}
                {hayFiltros ? " con estos filtros" : ""}
              </p>
              <ol
                aria-label="Decisiones"
                className={`space-y-3 ${consulta.isPlaceholderData ? "opacity-60" : ""}`}
              >
                {lista.data.map((decision) => (
                  <FilaDeDecision key={decision.id} decision={decision} />
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
    </div>
  );
}
