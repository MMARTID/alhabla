"use client";

import { useRef, useState } from "react";
import { useDecidir, useEditarBorrador } from "@/lib/consultas";
import type { Decision, EdicionDeBorrador, Resultado } from "@/lib/types";

/**
 * Las escrituras de la Revisión (guardar, aprobar, devolver, descartar…) con
 * tres garantías:
 *
 * 1. **Una a la vez.** Un guarda con `useRef` rechaza el segundo toque en el
 *    mismo instante, antes de que React llegue a repintar el botón como
 *    deshabilitado (en el móvil el doble toque es lo normal).
 * 2. **Sin reintentos.** Si falla, el error se queda a la vista y la persona
 *    decide. El panel no repite una decisión por su cuenta.
 * 3. **No tocan lo escrito.** Un fallo (incluida la sesión caducada) solo
 *    guarda el error: el texto del borrador es estado de la pantalla y sigue
 *    donde estaba.
 */
export function useAccionesDeRevision({
  oportunidadId,
  borradorEditableId,
}: {
  oportunidadId: string;
  borradorEditableId: string | null;
}) {
  const decidirMutacion = useDecidir(oportunidadId);
  const editarMutacion = useEditarBorrador(borradorEditableId ?? "");
  const enCurso = useRef(false);
  /** Esta acción ya guardó las ediciones (y lo que falló fue lo siguiente). */
  const edicionGuardada = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState<{
    error: unknown;
    origen: "edicion" | "decision";
    cambiosGuardados: boolean;
  } | null>(null);
  /** Lo que dijeron las reglas tras el último guardado, hasta que algo lo cambia. */
  const [guardado, setGuardado] = useState<Resultado | null>(null);

  async function ejecutar(
    origen: "edicion" | "decision",
    tarea: () => Promise<boolean>
  ): Promise<boolean> {
    if (enCurso.current) return false;
    enCurso.current = true;
    edicionGuardada.current = false;
    setOcupado(true);
    setFallo(null);
    try {
      return await tarea();
    } catch (error) {
      setFallo({
        error,
        origen,
        cambiosGuardados: edicionGuardada.current,
      });
      return false;
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }

  /** Una decisión (devolver, descartar, aprobar…). `true` si el backend la aceptó. */
  function decidir(decision: Decision): Promise<boolean> {
    return ejecutar("decision", async () => {
      setGuardado(null);
      await decidirMutacion.mutateAsync(decision);
      return true;
    });
  }

  /** PATCH del borrador: guarda y reevalúa. Un resultado `bloquea` también es un guardado correcto. */
  function guardar(cambios: EdicionDeBorrador): Promise<boolean> {
    return ejecutar("edicion", async () => {
      if (!borradorEditableId) return false;
      // Un resultado de un guardado anterior no se queda si este falla.
      setGuardado(null);
      const respuesta = await editarMutacion.mutateAsync(cambios);
      setGuardado(respuesta.resultado);
      return true;
    });
  }

  /**
   * «Aprobar con ediciones»: guarda (lo que reevalúa las reglas duras) y solo
   * si siguen sin bloquear, aprueba. Si el guardado sale bloqueado, no se
   * aprueba nada: se enseña el resultado y la persona corrige.
   */
  function aprobarConEdiciones(cambios: EdicionDeBorrador): Promise<boolean> {
    return ejecutar("decision", async () => {
      if (!borradorEditableId) return false;
      setGuardado(null);
      const respuesta = await editarMutacion.mutateAsync(cambios);
      edicionGuardada.current = true;
      setGuardado(respuesta.resultado);
      if (respuesta.resultado === "bloquea") return false;
      await decidirMutacion.mutateAsync({
        accion: "aprobar",
        borradorId: borradorEditableId,
      });
      setGuardado(null);
      return true;
    });
  }

  return {
    ocupado,
    /** El fallo del último guardado (se enseña junto al editor). */
    errorDeEdicion: fallo?.origen === "edicion" ? fallo.error : null,
    /** El fallo de la última decisión (se enseña junto a los botones). */
    errorDeDecision: fallo?.origen === "decision" ? fallo.error : null,
    /**
     * «Aprobar con ediciones» guardó las ediciones y falló al aprobar: el
     * aviso lo dice (los cambios sí están guardados).
     */
    cambiosGuardadosAlFallar: fallo?.cambiosGuardados ?? false,
    guardado,
    limpiarError: () => setFallo(null),
    decidir,
    guardar,
    aprobarConEdiciones,
  };
}

export type AccionesDeRevision = ReturnType<typeof useAccionesDeRevision>;
