"use client";

import {
  CircleCheck,
  ExternalLink,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { AvisoDeErrorDeAccion } from "@/components/comunes/d1-aviso-de-error";
import { D2DialogoDeConfirmacion } from "@/components/comunes/d2-dialogo-de-confirmacion";
import { Insignia } from "@/components/insignia";
import { useBorrarTarea, useReabrirTarea } from "@/lib/consultas";
import {
  ETIQUETA_DE_CATEGORIA_DE_TAREA,
  ETIQUETA_DE_ORIGEN_DE_TAREA,
  ETIQUETA_DE_RESULTADO_DE_TAREA,
  TONO_DE_RESULTADO_DE_TAREA,
} from "@/lib/etiquetas";
import { formatearFecha } from "@/lib/formato";
import type { Tarea } from "@/lib/types";
import { REL_EXTERNO, urlHttpsSegura } from "@/lib/url-segura";
import { DialogoDeCierreDeTarea } from "./dialogo-de-cierre";
import { DialogoEditarTarea } from "./formulario-de-tarea";
import { textoDeErrorDeTarea } from "./utilidades";

/**
 * El botón «Abrir»: solo es enlace si la dirección es https, y entonces se
 * abre en otra pestaña con `nofollow noopener noreferrer`. Una dirección
 * `http://` (o cualquier otra cosa) se enseña como texto, nunca como enlace.
 */
function Abrir({ tarea }: { tarea: Tarea }) {
  const enlace = urlHttpsSegura(tarea.url);
  if (!enlace) {
    return (
      <p className="min-w-0 text-xs text-muted [overflow-wrap:anywhere]">
        <span className="font-mono">{tarea.url}</span> (no se enlaza: no es una
        dirección https)
      </p>
    );
  }
  return (
    <a
      href={enlace}
      target="_blank"
      rel={REL_EXTERNO}
      className="btn-secondary h-11 hover:translate-y-0"
    >
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
      Abrir
      <span className="sr-only"> {tarea.titulo} (se abre en otra pestaña)</span>
    </a>
  );
}

function Pasos({ tarea }: { tarea: Tarea }) {
  if (tarea.pasos.length === 0) return null;
  const lista = (
    <ol className="list-decimal space-y-1 pl-5 text-sm text-tinta-2 [overflow-wrap:anywhere]">
      {tarea.pasos.map((paso, i) => (
        <li key={`${i}-${paso}`}>{paso}</li>
      ))}
    </ol>
  );
  // Lo que ya está cerrado no necesita ocupar sitio: los pasos, plegados.
  if (tarea.estado !== "pendiente") {
    return (
      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-morado-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado">
          Ver los {tarea.pasos.length} pasos
        </summary>
        <div className="mt-1">{lista}</div>
      </details>
    );
  }
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold text-muted">Pasos</h4>
      {lista}
    </div>
  );
}

/** Cómo terminó: el resultado, el día y la nota. Solo texto. */
function Cierre({ tarea }: { tarea: Tarea }) {
  if (tarea.estado === "pendiente") return null;
  return (
    <div className="mt-3 rounded-[10px] bg-relleno p-3 text-sm text-tinta-2">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {tarea.resultado ? (
          <Insignia tono={TONO_DE_RESULTADO_DE_TAREA[tarea.resultado]}>
            {ETIQUETA_DE_RESULTADO_DE_TAREA[tarea.resultado]}
          </Insignia>
        ) : null}
        <span className="text-muted">
          {tarea.estado === "hecha"
            ? `Hecha el ${formatearFecha(tarea.hechaEn)}`
            : "Descartada"}
        </span>
      </p>
      {tarea.notaDeResultado ? (
        <p className="mt-2 whitespace-pre-line [overflow-wrap:anywhere]">
          {tarea.notaDeResultado}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Una tarea a mano. El título, el dominio, los pasos y las notas pueden ser
 * texto de terceros (o tuyo): se pintan siempre como texto; el dominio nunca
 * es un enlace. Las del repositorio se descartan, no se borran.
 */
export function TarjetaDeTarea({ tarea }: { tarea: Tarea }) {
  const [editando, setEditando] = useState(false);
  const [cerrando, setCerrando] = useState<"hecha" | "descartada" | null>(null);
  const [borrando, setBorrando] = useState(false);
  const reabrir = useReabrirTarea(tarea.id);
  const borrar = useBorrarTarea(tarea.id);
  const pendiente = tarea.estado === "pendiente";

  function cancelarBorrado() {
    borrar.reset();
    setBorrando(false);
  }

  return (
    <li className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-tinta [overflow-wrap:anywhere]">
            {tarea.titulo}
          </h3>
          {tarea.dominio ? (
            <p className="mt-0.5 font-mono text-xs text-muted [overflow-wrap:anywhere]">
              {tarea.dominio}
            </p>
          ) : null}
          <p className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Insignia tono="morado">
              {ETIQUETA_DE_CATEGORIA_DE_TAREA[tarea.categoria]}
            </Insignia>
            <Insignia>{ETIQUETA_DE_ORIGEN_DE_TAREA[tarea.origen]}</Insignia>
          </p>
        </div>
        <Abrir tarea={tarea} />
      </div>

      {/* Las notas y los pasos, lado a lado cuando caben: la lista es larga. */}
      <div
        className={`mt-3 grid gap-3 ${
          tarea.notas && pendiente && tarea.pasos.length > 0
            ? "md:grid-cols-2"
            : ""
        }`}
      >
        {tarea.notas ? (
          <p className="whitespace-pre-line rounded-[10px] border border-linea-suave bg-relleno p-3 text-sm text-tinta-2 [overflow-wrap:anywhere]">
            <span className="mb-0.5 block text-xs font-semibold text-muted">
              Notas
            </span>
            {tarea.notas}
          </p>
        ) : null}
        <Pasos tarea={tarea} />
      </div>
      <Cierre tarea={tarea} />

      <AvisoDeErrorDeAccion
        className="mt-3"
        error={reabrir.error}
        respaldo="No se pudo reabrir la tarea. Inténtalo de nuevo."
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {pendiente ? (
          <>
            <button
              type="button"
              onClick={() => setCerrando("hecha")}
              className="btn-primary h-11"
            >
              <CircleCheck className="h-4 w-4" aria-hidden="true" />
              Marcar hecha
              <span className="sr-only"> {tarea.titulo}</span>
            </button>
            <button
              type="button"
              onClick={() => setCerrando("descartada")}
              className="btn-secondary h-11"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Descartar
              <span className="sr-only"> {tarea.titulo}</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => reabrir.mutate()}
            disabled={reabrir.isPending}
            className="btn-secondary h-11"
          >
            {reabrir.isPending ? (
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            )}
            Reabrir
            <span className="sr-only"> {tarea.titulo}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="btn-secondary h-11"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Editar
          <span className="sr-only"> {tarea.titulo}</span>
        </button>
        {tarea.origen === "manual" ? (
          <button
            type="button"
            onClick={() => setBorrando(true)}
            className="btn-secondary h-11"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Borrar
            <span className="sr-only"> {tarea.titulo}</span>
          </button>
        ) : null}
      </div>

      {editando ? (
        <DialogoEditarTarea tarea={tarea} alCerrar={() => setEditando(false)} />
      ) : null}
      {cerrando ? (
        <DialogoDeCierreDeTarea
          tarea={tarea}
          modo={cerrando}
          alCerrar={() => setCerrando(null)}
        />
      ) : null}
      <D2DialogoDeConfirmacion
        abierto={borrando}
        titulo="¿Borrar esta tarea?"
        etiquetaDeConfirmar="Borrar tarea"
        guardando={borrar.isPending}
        error={
          borrar.error
            ? textoDeErrorDeTarea(
                borrar.error,
                "No se pudo borrar la tarea. Inténtalo de nuevo."
              )
            : null
        }
        alConfirmar={() =>
          borrar.mutate(undefined, { onSuccess: () => setBorrando(false) })
        }
        alCancelar={cancelarBorrado}
      >
        <p>
          Se borra «{tarea.titulo}» del panel. No se puede deshacer; si solo
          quieres quitarla de en medio, descártala.
        </p>
      </D2DialogoDeConfirmacion>
    </li>
  );
}
