"use client";

import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";
import { EstadoDeConsulta } from "@/components/estado-de-consulta";
import { EstadoVacio } from "@/components/estado-vacio";
import { useCompetidores } from "@/lib/consultas";
import type { CompetidorResumen } from "@/lib/types";

function cuenta(
  competidores: readonly CompetidorResumen[],
  esDeLaCuenta: (c: CompetidorResumen) => boolean
): number {
  return competidores.filter(esDeLaCuenta).length;
}

function Cifra({
  etiqueta,
  valor,
  llama = false,
}: {
  etiqueta: string;
  valor: number;
  /** Pide algo de ti (un propuesto sin aceptar, un análisis sin revisar). */
  llama?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-tinta-2">{etiqueta}</dt>
      <dd
        className={`font-semibold ${llama && valor > 0 ? "text-aviso" : "text-tinta"}`}
      >
        {valor}
      </dd>
    </div>
  );
}

/**
 * La competencia en Ajustes: solo un resumen y el enlace a su vista
 * (`/competencia`), donde se añaden, aceptan, revisan y quitan. Antes era una
 * lista de solo lectura. Cuenta lo que pide algo de ti: propuestos sin aceptar
 * y análisis sin revisar.
 */
export function ResumenDeCompetencia() {
  const consulta = useCompetidores();
  return (
    <section aria-labelledby="ajustes-competencia" className="mt-5">
      <h2
        id="ajustes-competencia"
        className="text-base font-semibold text-tinta"
      >
        Competencia
      </h2>
      <p className="mb-3 mt-1 text-sm text-muted">
        Los competidores se usan para descartar solas las páginas de un
        competidor y para exigir una comparativa con fuente cuando un borrador
        los nombra. Se gestionan en su propia vista.
      </p>
      <EstadoDeConsulta
        consulta={consulta}
        titulo="No se pudieron cargar los competidores"
        filas={1}
        alto="h-28"
      >
        {({ data }) =>
          data.length === 0 ? (
            <EstadoVacio icono={Swords} titulo="Todavía no hay competidores">
              Mientras la lista esté vacía, la regla de comparativas con fuente
              no tiene con qué comparar. Añade el primero desde la vista de
              Competencia.
              <div className="mt-4">
                <Link
                  href="/competencia"
                  className="btn-secondary h-11 no-underline"
                >
                  Ir a Competencia
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </EstadoVacio>
          ) : (
            <div className="panel p-5 sm:p-6">
              <dl className="divide-y divide-linea-suave text-sm">
                <Cifra etiqueta="Competidores" valor={data.length} />
                <Cifra
                  etiqueta="Propuestos por el agente, sin aceptar"
                  valor={cuenta(data, (c) => c.estado === "propuesto")}
                  llama
                />
                <Cifra
                  etiqueta="Por analizar"
                  valor={cuenta(data, (c) => c.estado === "por_analizar")}
                />
                <Cifra
                  etiqueta="Análisis pendientes de revisión"
                  valor={cuenta(data, (c) => c.estado === "analizado")}
                  llama
                />
                <Cifra
                  etiqueta="Con el análisis caducado"
                  valor={cuenta(data, (c) => c.analisis?.caducado === true)}
                />
              </dl>
              <div className="mt-4">
                <Link
                  href="/competencia"
                  className="btn-secondary h-11 no-underline"
                >
                  Gestionar la competencia
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )
        }
      </EstadoDeConsulta>
    </section>
  );
}
