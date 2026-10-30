"use client";

import { Loader2, Plus, Save, Undo2, X } from "lucide-react";
import { useId, useState } from "react";
import { Campo, describedByDeCampo } from "@/components/comunes/d1-campo";
import { ETIQUETA_DE_RESULTADO } from "@/lib/etiquetas";
import type { Resultado } from "@/lib/types";
import { BotonCopiar } from "./boton-copiar";
import {
  LARGO_MAXIMO_DE_CLAVE,
  LARGO_MAXIMO_DE_TEXTO,
  anadirClave,
  enlaceSinUtmSource,
  type ErroresDeEdicion,
  type ValoresEditables,
} from "./edicion";

/**
 * El borrador editable: asunto, texto y enlace, con el contador de caracteres,
 * el aviso de `utm_source` y «Guardar y reevaluar». Es un componente de
 * presentación: los valores y el estado de lo escrito viven en la Revisión, de
 * modo que un fallo de red, una sesión caducada o un refresco de los datos no
 * pueden borrar lo que la persona tiene en la pantalla.
 */
export function EditorDeBorrador({
  valores,
  errores,
  hayCambios,
  ocupado,
  guardado,
  alCambiar,
  alGuardar,
  alDescartarCambios,
}: {
  valores: ValoresEditables;
  errores: ErroresDeEdicion;
  hayCambios: boolean;
  ocupado: boolean;
  /** El resultado de las reglas tras el último guardado, si lo hubo. */
  guardado: Resultado | null;
  alCambiar: <K extends keyof ValoresEditables>(
    campo: K,
    valor: ValoresEditables[K]
  ) => void;
  alGuardar: () => void;
  alDescartarCambios: () => void;
}) {
  const id = useId();
  const [nuevaClave, setNuevaClave] = useState("");
  const sinUtm = enlaceSinUtmSource(valores.enlaceUrl);
  const largo = valores.texto.length;
  const pasado = largo > LARGO_MAXIMO_DE_TEXTO;
  const hayErrores = Object.keys(errores).length > 0;

  return (
    <div className="space-y-4">
      <Campo
        id={`${id}-asunto`}
        etiqueta="Asunto"
        opcional
        error={errores.asunto}
      >
        <div className="flex gap-2">
          <input
            id={`${id}-asunto`}
            type="text"
            value={valores.asunto}
            onChange={(e) => alCambiar("asunto", e.target.value)}
            aria-invalid={errores.asunto ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-asunto`, {
              error: errores.asunto,
            })}
            className="field min-w-0 flex-1"
          />
          <BotonCopiar
            texto={valores.asunto}
            etiqueta="Copiar asunto"
            soloIcono
            deshabilitado={valores.asunto.trim() === ""}
            className="btn-secondary h-11 w-11 shrink-0 px-0"
          />
        </div>
      </Campo>

      <Campo
        id={`${id}-texto`}
        etiqueta="Texto"
        ayuda={
          <span className={pasado ? "font-semibold text-error" : undefined}>
            {largo.toLocaleString("es-ES")} de{" "}
            {LARGO_MAXIMO_DE_TEXTO.toLocaleString("es-ES")} caracteres
          </span>
        }
        error={errores.texto}
      >
        <textarea
          id={`${id}-texto`}
          rows={12}
          value={valores.texto}
          onChange={(e) => alCambiar("texto", e.target.value)}
          aria-invalid={errores.texto ? true : undefined}
          aria-describedby={describedByDeCampo(`${id}-texto`, {
            ayuda: true,
            error: errores.texto,
          })}
          className="field h-auto w-full resize-y py-3 leading-relaxed"
        />
      </Campo>

      <Campo
        id={`${id}-enlace`}
        etiqueta="Enlace a Alhabla"
        opcional
        error={errores.enlaceUrl}
      >
        <div className="flex gap-2">
          <input
            id={`${id}-enlace`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={valores.enlaceUrl}
            onChange={(e) => alCambiar("enlaceUrl", e.target.value)}
            aria-invalid={errores.enlaceUrl ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-enlace`, {
              error: errores.enlaceUrl,
            })}
            className="field min-w-0 flex-1"
          />
          <BotonCopiar
            texto={valores.enlaceUrl.trim()}
            etiqueta="Copiar enlace"
            soloIcono
            deshabilitado={valores.enlaceUrl.trim() === ""}
            className="btn-secondary h-11 w-11 shrink-0 px-0"
          />
        </div>
        {sinUtm ? (
          <p className="mt-1.5 text-xs font-semibold text-aviso">
            Este enlace no lleva utm_source: las visitas que lleguen por este
            contacto no se podrán atribuir.
          </p>
        ) : null}
      </Campo>

      <fieldset aria-describedby={`${id}-claves-ayuda`}>
        <legend className="mb-1.5 text-sm font-semibold text-tinta">
          Afirmaciones que cita
        </legend>
        {valores.afirmaciones.length === 0 ? (
          <p className="text-sm text-muted">No cita ninguna.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {valores.afirmaciones.map((clave) => (
              <li
                key={clave}
                className="flex min-h-11 items-center gap-1 rounded-full border border-linea bg-relleno pl-3.5 pr-1"
              >
                <code className="text-xs text-tinta [overflow-wrap:anywhere]">
                  {clave}
                </code>
                <button
                  type="button"
                  aria-label={`Quitar ${clave}`}
                  onClick={() =>
                    alCambiar(
                      "afirmaciones",
                      valores.afirmaciones.filter((c) => c !== clave)
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full text-apagado hover:bg-relleno-fuerte hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            aria-label="Añadir una clave de afirmación"
            placeholder="precio.plan.pro"
            autoComplete="off"
            spellCheck={false}
            maxLength={LARGO_MAXIMO_DE_CLAVE}
            value={nuevaClave}
            onChange={(e) => setNuevaClave(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              alCambiar("afirmaciones", [
                ...anadirClave(valores.afirmaciones, nuevaClave),
              ]);
              setNuevaClave("");
            }}
            className="field min-w-0 flex-1"
          />
          <button
            type="button"
            disabled={nuevaClave.trim() === ""}
            onClick={() => {
              alCambiar("afirmaciones", [
                ...anadirClave(valores.afirmaciones, nuevaClave),
              ]);
              setNuevaClave("");
            }}
            className="btn-secondary h-11 shrink-0 px-3"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Añadir clave
          </button>
        </div>
        <p id={`${id}-claves-ayuda`} className="mt-1.5 text-xs text-muted">
          Cada dato sobre Alhabla que cita el texto necesita su clave vigente.
          Quitar una clave no quita la frase del texto: las reglas lo comprueban
          al guardar.
        </p>
        {errores.afirmaciones ? (
          <p role="alert" className="mt-1.5 text-xs font-semibold text-error">
            {errores.afirmaciones}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={alGuardar}
          disabled={!hayCambios || hayErrores || ocupado}
          className="btn-secondary h-11"
        >
          {ocupado ? (
            <Loader2
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          Guardar y reevaluar
        </button>
        {hayCambios ? (
          <button
            type="button"
            onClick={alDescartarCambios}
            disabled={ocupado}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-apagado hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado disabled:opacity-60"
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Descartar cambios
          </button>
        ) : null}
      </div>

      {hayCambios ? (
        <p className="text-xs font-semibold text-aviso">
          Tienes cambios sin guardar. Las reglas de la derecha son las del texto
          guardado.
        </p>
      ) : null}
      {guardado ? (
        <p
          role="status"
          className={`text-sm font-semibold ${guardado === "bloquea" ? "text-error" : guardado === "aviso" ? "text-aviso" : "text-exito"}`}
        >
          {guardado === "bloquea"
            ? "Guardado, pero las reglas lo bloquean: corrige lo que sale en rojo."
            : `Guardado. Resultado de las reglas: ${ETIQUETA_DE_RESULTADO[guardado].toLowerCase()}.`}
        </p>
      ) : null}
    </div>
  );
}
