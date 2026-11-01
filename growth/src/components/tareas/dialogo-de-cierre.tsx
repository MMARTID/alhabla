"use client";

import { Loader2 } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { AvisoDeErrorDeAccion } from "@/components/comunes/d1-aviso-de-error";
import { Campo, describedByDeCampo } from "@/components/comunes/d1-campo";
import { Dialogo } from "@/components/comunes/d1-dialogo";
import { useDescartarTarea, useMarcarTareaHecha } from "@/lib/consultas";
import { ETIQUETA_DE_RESULTADO_DE_TAREA } from "@/lib/etiquetas";
import {
  LARGO_MAXIMO_DE_NOTA_DE_RESULTADO_DE_TAREA,
  RESULTADOS_DE_TAREA,
  type ResultadoDeTarea,
  type Tarea,
} from "@/lib/types";
import { errorDeNotaDeResultado } from "./utilidades";

/**
 * «Marcar hecha» y «Descartar» una tarea. Hecha pide el resultado (opcional:
 * si el alta es gratuita, si quedó en revisión…) y una nota; descartar, solo
 * el motivo. Ninguno cambia nada fuera del panel: tú ya hiciste la gestión.
 */
export function DialogoDeCierreDeTarea({
  tarea,
  modo,
  alCerrar,
}: {
  tarea: Tarea;
  modo: "hecha" | "descartada";
  alCerrar: () => void;
}) {
  const id = useId();
  const hecha = useMarcarTareaHecha(tarea.id);
  const descartar = useDescartarTarea(tarea.id);
  const [resultado, setResultado] = useState<ResultadoDeTarea | "">("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorDeApi, setErrorDeApi] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);
  const esHecha = modo === "hecha";

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enCurso.current) return;
    const fallo = errorDeNotaDeResultado(nota);
    setError(fallo);
    if (fallo) return;
    enCurso.current = true;
    setEnviando(true);
    setErrorDeApi(null);
    try {
      const notaLimpia = nota.trim() === "" ? undefined : nota.trim();
      if (esHecha) {
        await hecha.mutateAsync({
          ...(resultado ? { resultado } : {}),
          ...(notaLimpia ? { nota: notaLimpia } : {}),
        });
      } else {
        await descartar.mutateAsync(notaLimpia ? { nota: notaLimpia } : {});
      }
      alCerrar();
    } catch (fallido) {
      setErrorDeApi(fallido);
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      titulo={esHecha ? "Marcar hecha" : "Descartar tarea"}
      descripcion={
        esHecha
          ? "Anota cómo ha ido para no repetirla: lo que pasó y si pidió algo más."
          : "Deja de salir entre las pendientes. Puedes reabrirla cuando quieras."
      }
      alCerrar={alCerrar}
      ocupado={enviando}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <p className="rounded-[10px] bg-relleno p-3 text-sm font-semibold text-tinta [overflow-wrap:anywhere]">
          {tarea.titulo}
        </p>
        {esHecha ? (
          <Campo id={`${id}-resultado`} etiqueta="Resultado" opcional>
            <select
              id={`${id}-resultado`}
              data-autofocus
              value={resultado}
              onChange={(e) =>
                setResultado(e.target.value as ResultadoDeTarea | "")
              }
              className="field w-full"
            >
              <option value="">Sin indicar</option>
              {RESULTADOS_DE_TAREA.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {ETIQUETA_DE_RESULTADO_DE_TAREA[opcion]}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
        <Campo
          id={`${id}-nota`}
          etiqueta={esHecha ? "Nota" : "Motivo"}
          opcional
          ayuda={`${nota.length} de ${LARGO_MAXIMO_DE_NOTA_DE_RESULTADO_DE_TAREA}.`}
          error={error}
        >
          <textarea
            id={`${id}-nota`}
            data-autofocus={esHecha ? undefined : true}
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
        <AvisoDeErrorDeAccion
          error={errorDeApi}
          respaldo={
            esHecha
              ? "No se pudo marcar como hecha. Inténtalo de nuevo."
              : "No se pudo descartar. Inténtalo de nuevo."
          }
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
            {enviando
              ? "Guardando…"
              : esHecha
                ? "Marcar hecha"
                : "Descartar tarea"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
