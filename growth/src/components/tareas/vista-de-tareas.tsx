"use client";

import { ListChecks, Plus } from "lucide-react";
import { useState } from "react";
import { ConsultaConDatos } from "@/components/comunes/d1-consulta-con-datos";
import { EncabezadoDePagina } from "@/components/encabezado-de-pagina";
import { EstadoVacio } from "@/components/estado-vacio";
import { useTareas } from "@/lib/consultas";
import type { EstadoDeTarea } from "@/lib/types";
import { DialogoAnadirTarea } from "./formulario-de-tarea";
import { FichaDeAlhabla } from "./ficha-de-alhabla";
import { TarjetaDeTarea } from "./tarjeta-de-tarea";
import { agruparTareas } from "./utilidades";

/** Cómo se titula y se explica cada grupo de tareas. */
const TEXTO_DE_GRUPO: Record<EstadoDeTarea, { titulo: string; ayuda: string }> =
  {
    pendiente: {
      titulo: "Pendientes",
      ayuda: "Lo que te queda por hacer a mano, con su enlace y sus pasos.",
    },
    hecha: {
      titulo: "Hechas",
      ayuda: "Lo que ya gestionaste, con el resultado que anotaste.",
    },
    descartada: {
      titulo: "Descartadas",
      ayuda: "Lo que decidiste no hacer. Puedes reabrirlas.",
    },
  };

/**
 * Las Tareas: lo que el agente no puede abrir (G2, Capterra y otros le dan
 * 403) o que sale mejor a mano. Arriba, la Ficha de Alhabla con los textos
 * para pegar; debajo, cada tarea con su enlace, sus pasos y lo que pasó al
 * hacerla. No hay agente ni modelo detrás: es una lista tuya.
 */
export function VistaDeTareas() {
  const consulta = useTareas();
  const [anadiendo, setAnadiendo] = useState(false);

  return (
    <>
      <EncabezadoDePagina
        titulo="Tareas"
        descripcion="Altas y gestiones que se hacen mejor a mano o que el agente no puede abrir. Cada una lleva su enlace y sus pasos, y la ficha de Alhabla te da el texto para pegar."
        acciones={
          <button
            type="button"
            onClick={() => setAnadiendo(true)}
            className="btn-primary h-11"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Añadir tarea
          </button>
        }
      />

      <FichaDeAlhabla />

      <ConsultaConDatos
        consulta={consulta}
        titulo="No se pudieron cargar las tareas"
      >
        {({ data }) => {
          if (data.length === 0) {
            return (
              <EstadoVacio icono={ListChecks} titulo="Todavía no hay tareas">
                Añade un directorio, una asociación o un formulario que quieras
                gestionar a mano y aquí tendrás su enlace, sus pasos y qué pasó.
              </EstadoVacio>
            );
          }
          const grupos = agruparTareas(data);
          return (
            <div className="space-y-8">
              {grupos.map(({ estado, tareas }) => {
                const { titulo, ayuda } = TEXTO_DE_GRUPO[estado];
                const idDelTitulo = `tareas-${estado}`;
                if (tareas.length === 0 && estado !== "pendiente") return null;
                return (
                  <section key={estado} aria-labelledby={idDelTitulo}>
                    <h2
                      id={idDelTitulo}
                      className="text-base font-semibold text-tinta"
                    >
                      {titulo}{" "}
                      <span className="text-sm font-normal text-muted">
                        {tareas.length}
                      </span>
                    </h2>
                    <p className="mb-3 mt-0.5 text-sm text-muted">{ayuda}</p>
                    {tareas.length === 0 ? (
                      <p className="panel px-5 py-6 text-center text-sm text-muted">
                        No te queda nada pendiente.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {tareas.map((tarea) => (
                          <TarjetaDeTarea key={tarea.id} tarea={tarea} />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          );
        }}
      </ConsultaConDatos>

      {anadiendo ? (
        <DialogoAnadirTarea alCerrar={() => setAnadiendo(false)} />
      ) : null}
    </>
  );
}
