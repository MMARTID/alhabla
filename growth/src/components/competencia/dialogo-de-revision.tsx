"use client";

import { Loader2 } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { Campo, describedByDeCampo } from "@/components/comunes/d1-campo";
import { Dialogo } from "@/components/comunes/d1-dialogo";
import { useRevisarAnalisis } from "@/lib/consultas";
import {
  LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR,
  type AnalisisDeCompetidor,
} from "@/lib/types";
import { AvisoDeErrorDeCompetencia } from "./aviso-de-error";

/**
 * «Marcar como revisado»: das por bueno el último análisis, con una nota si
 * quieres dejar constancia de algo. No cambia nada fuera del panel (el
 * análisis sigue siendo información interna); solo evita que el competidor
 * siga saliendo como pendiente.
 */
export function DialogoDeRevision({
  competidorId,
  analisis,
  alCerrar,
}: {
  competidorId: string;
  analisis: AnalisisDeCompetidor;
  alCerrar: () => void;
}) {
  const id = useId();
  const revisar = useRevisarAnalisis(competidorId, analisis.id);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorDeApi, setErrorDeApi] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enCurso.current) return;
    if (nota.trim().length > LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR) {
      return setError(
        `La nota no puede pasar de ${LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR} caracteres.`
      );
    }
    setError(null);
    enCurso.current = true;
    setEnviando(true);
    setErrorDeApi(null);
    try {
      await revisar.mutateAsync(nota.trim() ? { nota: nota.trim() } : {});
      alCerrar();
    } catch (fallo) {
      setErrorDeApi(fallo);
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      titulo="Marcar como revisado"
      descripcion={`Das por bueno el análisis versión ${analisis.version}. Sigue siendo información interna: no se puede citar en un borrador.`}
      alCerrar={alCerrar}
      ocupado={enviando}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <Campo
          id={`${id}-nota`}
          etiqueta="Nota"
          opcional
          ayuda={`Algo que quieras recordar de esta revisión. ${nota.length} de ${LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR}.`}
          error={error}
        >
          <textarea
            id={`${id}-nota`}
            data-autofocus
            rows={4}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-nota`, {
              ayuda: true,
              error,
            })}
            className="field h-auto w-full resize-y py-3"
          />
        </Campo>
        <AvisoDeErrorDeCompetencia
          error={errorDeApi}
          respaldo="No se pudo marcar como revisado. Inténtalo de nuevo."
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={alCerrar}
            disabled={enviando}
            className="btn-secondary h-11"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="btn-primary h-11"
          >
            {enviando ? (
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            {enviando ? "Guardando…" : "Marcar como revisado"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
