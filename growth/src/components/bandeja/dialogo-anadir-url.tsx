"use client";

import { Loader2 } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { AvisoDeErrorDeAccion } from "@/components/comunes/d1-aviso-de-error";
import { Campo, describedByDeCampo } from "@/components/comunes/d1-campo";
import { Dialogo } from "@/components/comunes/d1-dialogo";
import { useAnadirUrl } from "@/lib/consultas";
import { etiquetaCortaDeObjetivo } from "@/lib/etiquetas";
import {
  OBJETIVOS,
  type NuevaUrl,
  type Objetivo,
  type RespuestaDeNuevaUrl,
} from "@/lib/types";
import { esUrlWeb } from "@/lib/url-segura";

export const LARGO_MAXIMO_DE_URL = 2000;
export const LARGO_MAXIMO_DE_NOTA = 500;

export const MENSAJE_DE_URL_INVALIDA =
  "Escribe una dirección web completa, que empiece por http:// o https://.";

type Errores = { url?: string; nota?: string };

/** Valida el formulario; devuelve los errores (vacío = todo bien). */
export function validarNuevaUrl(url: string, nota: string): Errores {
  const errores: Errores = {};
  const limpia = url.trim();
  if (limpia === "") errores.url = "Escribe la dirección de la página.";
  else if (limpia.length > LARGO_MAXIMO_DE_URL)
    errores.url = `La dirección no puede pasar de ${LARGO_MAXIMO_DE_URL} caracteres.`;
  else if (!esUrlWeb(limpia)) errores.url = MENSAJE_DE_URL_INVALIDA;
  if (nota.length > LARGO_MAXIMO_DE_NOTA) {
    errores.nota = `La nota no puede pasar de ${LARGO_MAXIMO_DE_NOTA} caracteres.`;
  }
  return errores;
}

/**
 * «Añadir URL»: una página que has encontrado tú y que el agente debe mirar.
 * La dirección se valida aquí (solo http y https: un `javascript:` ni sale) y
 * otra vez en el backend. El botón queda deshabilitado mientras la petición
 * vuela, y un segundo toque no la repite.
 */
export function DialogoAnadirUrl({
  alCerrar,
  alAnadir,
}: {
  alCerrar: () => void;
  alAnadir: (respuesta: RespuestaDeNuevaUrl) => void;
}) {
  const id = useId();
  const anadir = useAnadirUrl();
  const [url, setUrl] = useState("");
  const [objetivo, setObjetivo] = useState<Objetivo>("BACKLINKS");
  const [nota, setNota] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [errorDeApi, setErrorDeApi] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enCurso.current) return;
    const encontrados = validarNuevaUrl(url, nota);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    enCurso.current = true;
    setEnviando(true);
    setErrorDeApi(null);
    const nueva: NuevaUrl = {
      url: url.trim(),
      objetivoPrincipal: objetivo,
      ...(nota.trim() ? { nota: nota.trim() } : {}),
    };
    try {
      alAnadir(await anadir.mutateAsync(nueva));
    } catch (error) {
      setErrorDeApi(error);
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      titulo="Añadir URL"
      descripcion="Una página que quieres que el agente califique e investigue. El agente la leerá en su próxima ejecución; aquí no se descarga nada."
      alCerrar={alCerrar}
      ocupado={enviando}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <Campo
          id={`${id}-url`}
          etiqueta="Dirección de la página"
          error={errores.url}
        >
          <input
            id={`${id}-url`}
            data-autofocus
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={errores.url ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-url`, {
              error: errores.url,
            })}
            className="field w-full"
          />
        </Campo>
        <Campo id={`${id}-objetivo`} etiqueta="Objetivo">
          <select
            id={`${id}-objetivo`}
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value as Objetivo)}
            className="field w-full"
          >
            {OBJETIVOS.map((o) => (
              <option key={o} value={o}>
                {etiquetaCortaDeObjetivo(o)}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          id={`${id}-nota`}
          etiqueta="Nota"
          opcional
          ayuda={`Por qué te interesa. ${nota.length} de ${LARGO_MAXIMO_DE_NOTA}.`}
          error={errores.nota}
        >
          <textarea
            id={`${id}-nota`}
            rows={3}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            aria-invalid={errores.nota ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-nota`, {
              ayuda: true,
              error: errores.nota,
            })}
            className="field h-auto w-full resize-y py-3"
          />
        </Campo>
        <AvisoDeErrorDeAccion
          error={errorDeApi}
          respaldo="No se pudo añadir la URL. Inténtalo de nuevo."
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
            {enviando ? "Añadiendo…" : "Añadir URL"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
