"use client";

import { Loader2 } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { Campo, describedByDeCampo } from "@/components/comunes/d1-campo";
import { Dialogo } from "@/components/comunes/d1-dialogo";
import { useAnadirCompetidor } from "@/lib/consultas";
import {
  LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR,
  LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR,
  type AltaDeCompetidor,
  type CompetidorDetalle,
} from "@/lib/types";
import { AvisoDeErrorDeCompetencia } from "./aviso-de-error";
import {
  validarAltaDeCompetidor,
  type ErroresDeCompetidor,
} from "./utilidades";

/**
 * «Añadir competidor»: pegas la web de uno y el agente la lee en su siguiente
 * ejecución (servicio, producto y precios). La dirección se valida aquí (solo
 * http y https) y otra vez en el backend, que además rechaza el dominio de
 * Alhabla y los que ya tienes. Un segundo toque no repite la petición.
 */
export function DialogoAnadirCompetidor({
  alCerrar,
  alAnadir,
}: {
  alCerrar: () => void;
  alAnadir: (competidor: CompetidorDetalle) => void;
}) {
  const id = useId();
  const anadir = useAnadirCompetidor();
  const [url, setUrl] = useState("");
  const [nombre, setNombre] = useState("");
  const [notas, setNotas] = useState("");
  const [errores, setErrores] = useState<ErroresDeCompetidor>({});
  const [errorDeApi, setErrorDeApi] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enCurso.current) return;
    const encontrados = validarAltaDeCompetidor(url, nombre, notas);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    enCurso.current = true;
    setEnviando(true);
    setErrorDeApi(null);
    const alta: AltaDeCompetidor = {
      url: url.trim(),
      ...(nombre.trim() ? { nombre: nombre.trim() } : {}),
      ...(notas.trim() ? { notas: notas.trim() } : {}),
    };
    try {
      alAnadir(await anadir.mutateAsync(alta));
    } catch (error) {
      setErrorDeApi(error);
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      titulo="Añadir competidor"
      descripcion="Pega la web del competidor. El agente la leerá en el siguiente run y guardará su servicio, su producto y sus precios en la ficha. Aquí no se descarga nada."
      alCerrar={alCerrar}
      ocupado={enviando}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <Campo
          id={`${id}-url`}
          etiqueta="Dirección de su web"
          ayuda="De ella sale su dominio, que no se podrá cambiar."
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
              ayuda: true,
              error: errores.url,
            })}
            className="field w-full"
          />
        </Campo>
        <Campo
          id={`${id}-nombre`}
          etiqueta="Nombre"
          opcional
          ayuda="Si lo dejas vacío, se usa el principio de su dominio."
          error={errores.nombre}
        >
          <input
            id={`${id}-nombre`}
            type="text"
            autoComplete="off"
            maxLength={LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR + 40}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            aria-invalid={errores.nombre ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-nombre`, {
              ayuda: true,
              error: errores.nombre,
            })}
            className="field w-full"
          />
        </Campo>
        <Campo
          id={`${id}-notas`}
          etiqueta="Notas"
          opcional
          ayuda={`Por qué te interesa. ${notas.length} de ${LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR}.`}
          error={errores.notas}
        >
          <textarea
            id={`${id}-notas`}
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            aria-invalid={errores.notas ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-notas`, {
              ayuda: true,
              error: errores.notas,
            })}
            className="field h-auto w-full resize-y py-3"
          />
        </Campo>
        <AvisoDeErrorDeCompetencia
          error={errorDeApi}
          respaldo="No se pudo añadir el competidor. Inténtalo de nuevo."
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
            {enviando ? "Añadiendo…" : "Añadir competidor"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
