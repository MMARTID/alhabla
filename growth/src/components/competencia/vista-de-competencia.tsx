"use client";

import Link from "next/link";
import { Plus, Swords, X } from "lucide-react";
import { useState } from "react";
import { ConsultaConDatos } from "@/components/comunes/d1-consulta-con-datos";
import { EncabezadoDePagina } from "@/components/encabezado-de-pagina";
import { EstadoVacio } from "@/components/estado-vacio";
import { useCompetidores } from "@/lib/consultas";
import type { CompetidorDetalle, EstadoDeCompetidor } from "@/lib/types";
import { DialogoAnadirCompetidor } from "./dialogo-anadir-competidor";
import { TarjetaDeCompetidor } from "./tarjeta-de-competidor";
import { agruparCompetidores, rutaDeCompetidor } from "./utilidades";

/** Cómo se titula y se explica cada grupo de la lista. */
const TEXTO_DE_GRUPO: Record<
  EstadoDeCompetidor,
  { titulo: string; ayuda: string }
> = {
  propuesto: {
    titulo: "Propuestos por el agente",
    ayuda:
      "Los encontró en listas de «alternativas a». Hasta que los aceptes no aplican ninguna regla.",
  },
  por_analizar: {
    titulo: "Por analizar",
    ayuda: "El agente los leerá en su próxima ejecución.",
  },
  analizado: {
    titulo: "Analizados · pendientes de revisión",
    ayuda: "Léelos y márcalos como revisados.",
  },
  revisado: {
    titulo: "Revisados",
    ayuda: "Los diste por buenos. Pasados 90 días el agente los vuelve a leer.",
  },
};

function AvisoDeCompetidorAnadido({
  competidor,
  alCerrar,
}: {
  competidor: CompetidorDetalle;
  alCerrar: () => void;
}) {
  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-3 rounded-[10px] border border-lavado-borde bg-lavado p-4 text-sm text-tinta-2"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-morado-tinta">Competidor añadido</p>
        <p className="mt-1">
          El agente lo analizará en el siguiente run: hasta entonces la ficha
          estará vacía.
        </p>
        <Link
          href={rutaDeCompetidor(competidor.id)}
          className="mt-2 inline-flex min-h-11 items-center font-semibold text-morado-tinta underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
        >
          Ver la ficha de{" "}
          <span className="ml-1 [overflow-wrap:anywhere]">
            {competidor.nombre}
          </span>
        </Link>
      </div>
      <button
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar aviso"
        className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-apagado hover:bg-lavado-2 hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * La Competencia: quién compite contigo y qué se sabe de cada uno. Tarjetas
 * agrupadas por lo que piden de ti (aceptar a los propuestos, esperar al
 * agente, revisar un análisis) y «Añadir competidor» por URL. Es información
 * interna: no se puede citar en un borrador.
 */
export function VistaDeCompetencia() {
  const consulta = useCompetidores();
  const [anadiendo, setAnadiendo] = useState(false);
  const [anadido, setAnadido] = useState<CompetidorDetalle | null>(null);

  const boton = (
    <button
      type="button"
      onClick={() => setAnadiendo(true)}
      className="btn-primary h-11"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      Añadir competidor
    </button>
  );

  return (
    <>
      <EncabezadoDePagina
        titulo="Competencia"
        descripcion="Quién compite contigo, qué ofrece y cuánto cobra. Es información interna: no se puede citar en un borrador."
        acciones={boton}
      />

      {anadido ? (
        <AvisoDeCompetidorAnadido
          competidor={anadido}
          alCerrar={() => setAnadido(null)}
        />
      ) : null}

      <ConsultaConDatos
        consulta={consulta}
        titulo="No se pudieron cargar los competidores"
      >
        {({ data }) => {
          if (data.length === 0) {
            return (
              <EstadoVacio icono={Swords} titulo="Todavía no hay competidores">
                Pega la web de uno y el agente la leerá en su siguiente
                ejecución: su servicio, su producto y sus precios. También
                propondrá él los que encuentre en listas de «alternativas a».
              </EstadoVacio>
            );
          }
          const grupos = agruparCompetidores(data);
          return (
            <>
              <p className="mb-5 text-sm text-muted" aria-live="polite">
                {data.length === 1
                  ? "1 competidor"
                  : `${data.length} competidores`}
              </p>
              <div className="space-y-8">
                {grupos.map(({ estado, competidores }) => {
                  const idDelTitulo = `competencia-${estado}`;
                  const { titulo, ayuda } = TEXTO_DE_GRUPO[estado];
                  return (
                    <section key={estado} aria-labelledby={idDelTitulo}>
                      <h2
                        id={idDelTitulo}
                        className="text-base font-semibold text-tinta"
                      >
                        {titulo}{" "}
                        <span className="text-sm font-normal text-muted">
                          {competidores.length}
                        </span>
                      </h2>
                      <p className="mb-3 mt-0.5 text-sm text-muted">{ayuda}</p>
                      <ul className="space-y-3">
                        {competidores.map((competidor) => (
                          <TarjetaDeCompetidor
                            key={competidor.id}
                            competidor={competidor}
                          />
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </>
          );
        }}
      </ConsultaConDatos>

      {anadiendo ? (
        <DialogoAnadirCompetidor
          alCerrar={() => setAnadiendo(false)}
          alAnadir={(competidor) => {
            setAnadiendo(false);
            setAnadido(competidor);
          }}
        />
      ) : null}
    </>
  );
}
