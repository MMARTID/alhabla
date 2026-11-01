"use client";

import Link from "next/link";
import { Info, Scale } from "lucide-react";
import { useMemo, useState } from "react";
import { ConsultaConDatos } from "@/components/comunes/d1-consulta-con-datos";
import { D2CasillaDeVerificacion } from "@/components/comunes/d2-campos";
import { EncabezadoDePagina } from "@/components/encabezado-de-pagina";
import { EstadoVacio } from "@/components/estado-vacio";
import { formatearFechaYHora } from "@/lib/formato";
import { useComparador, useConocimiento } from "@/lib/consultas";
import { PestanasDeCompetencia } from "./pestanas-de-competencia";
import { TablaDelComparador } from "./tabla-del-comparador";
import {
  ordenarPorPrecioDeEntrada,
  planesDeAlhabla,
} from "./utilidades-del-comparador";

/** El aviso fijo del comparador: se enseña siempre, también sin datos. */
export const AVISO_DEL_COMPARADOR =
  "Información interna: no se puede citar en un borrador. Los precios están en la moneda en que se publican (sin convertir) y puede que no sean comparables plan a plan.";

/**
 * El comparador de precios: Alhabla en la primera fila (de las afirmaciones
 * `precio.*` vigentes) y debajo cada competidor con los planes, precios y
 * límites de su último análisis, cada precio con su fuente y el día que el
 * agente lo leyó. Filtra por «Solo revisados» y ordena por precio de entrada.
 * No llama a ningún modelo: son datos ya guardados.
 */
export function VistaDelComparador() {
  const consulta = useComparador();
  const precios = useConocimiento("precio");
  const [soloRevisados, setSoloRevisados] = useState(false);

  const planes = useMemo(
    () =>
      precios.data ? planesDeAlhabla(precios.data.porTipo.precio ?? []) : null,
    [precios.data]
  );
  const estadoDeAlhabla = precios.data
    ? "listo"
    : precios.isError
      ? "error"
      : "cargando";

  return (
    <>
      <EncabezadoDePagina
        titulo="Competencia"
        descripcion="Planes, precios y límites de cada competidor frente a los de Alhabla, con la fuente y el día en que se leyó cada uno."
      />
      <PestanasDeCompetencia activa="/competencia/comparador" />

      <p
        role="note"
        className="mb-5 flex items-start gap-3 rounded-[10px] border border-lavado-borde bg-lavado p-3 text-sm text-tinta-2"
      >
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-morado-tinta"
          aria-hidden="true"
        />
        <span>{AVISO_DEL_COMPARADOR}</span>
      </p>

      <ConsultaConDatos
        consulta={consulta}
        titulo="No se pudo cargar el comparador"
        filas={3}
        alto="h-40"
      >
        {({ data, generadoEn }) => {
          if (data.length === 0) {
            return (
              <EstadoVacio
                icono={Scale}
                titulo="Todavía no hay nada que comparar"
                accion={
                  <Link
                    href="/competencia"
                    className="btn-secondary h-11 hover:translate-y-0"
                  >
                    Ir a los competidores
                  </Link>
                }
              >
                El comparador usa los análisis que el agente guarda de cada
                competidor. Añade uno o acepta los que propone y, cuando lo haya
                leído, aquí saldrán sus planes y precios.
              </EstadoVacio>
            );
          }
          const revisados = data.filter((f) => f.estado === "revisado").length;
          const visibles = ordenarPorPrecioDeEntrada(
            soloRevisados ? data.filter((f) => f.estado === "revisado") : data
          );
          return (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
                <D2CasillaDeVerificacion
                  etiqueta="Solo revisados"
                  marcada={soloRevisados}
                  alCambiar={setSoloRevisados}
                />
                <p className="text-sm text-muted" aria-live="polite">
                  {visibles.length === data.length
                    ? `${data.length} ${data.length === 1 ? "competidor" : "competidores"}`
                    : `${visibles.length} de ${data.length} competidores`}{" "}
                  · {revisados} {revisados === 1 ? "revisado" : "revisados"} ·
                  de menor a mayor precio de entrada
                </p>
              </div>

              {visibles.length === 0 ? (
                <EstadoVacio
                  icono={Scale}
                  titulo="Ningún competidor está revisado todavía"
                  accion={
                    <button
                      type="button"
                      onClick={() => setSoloRevisados(false)}
                      className="btn-secondary h-11 hover:translate-y-0"
                    >
                      Ver todos
                    </button>
                  }
                >
                  Léelos en su ficha y márcalos como revisados para que salgan
                  aquí.
                </EstadoVacio>
              ) : (
                <TablaDelComparador
                  filas={visibles}
                  planesDeAlhabla={planes}
                  estadoDeAlhabla={estadoDeAlhabla}
                />
              )}

              <p className="mt-4 text-xs text-muted">
                Datos de {formatearFechaYHora(generadoEn)}. Los análisis caducan
                a los 90 días y el agente los repite solo.
              </p>
            </>
          );
        }}
      </ConsultaConDatos>
    </>
  );
}
