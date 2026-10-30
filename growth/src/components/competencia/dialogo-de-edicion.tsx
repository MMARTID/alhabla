"use client";

import { Loader2 } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { Campo, describedByDeCampo } from "@/components/comunes/d1-campo";
import { Dialogo } from "@/components/comunes/d1-dialogo";
import { useEditarCompetidor } from "@/lib/consultas";
import {
  LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR,
  type CambioDeCompetidor,
  type CompetidorDetalle,
} from "@/lib/types";
import { AvisoDeErrorDeCompetencia } from "./aviso-de-error";
import {
  validarEdicionDeCompetidor,
  type ErroresDeCompetidor,
} from "./utilidades";

/**
 * Edita el nombre, las notas y la URL de partida de un competidor. El dominio
 * no se puede cambiar: una dirección de otro sitio se rechaza aquí y, por si
 * acaso, en el backend. Solo se manda lo que de verdad has cambiado; vaciar la
 * URL o las notas las borra.
 */
export function DialogoDeEdicion({
  competidor,
  alCerrar,
}: {
  competidor: CompetidorDetalle;
  alCerrar: () => void;
}) {
  const id = useId();
  const editar = useEditarCompetidor(competidor.id);
  const [nombre, setNombre] = useState(competidor.nombre);
  const [url, setUrl] = useState(competidor.url ?? "");
  const [notas, setNotas] = useState(competidor.notas ?? "");
  const [errores, setErrores] = useState<ErroresDeCompetidor>({});
  const [errorDeApi, setErrorDeApi] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enCurso.current) return;
    const encontrados = validarEdicionDeCompetidor(
      { nombre, url, notas },
      competidor.dominio
    );
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    const cambios: CambioDeCompetidor = {};
    if (nombre.trim() !== competidor.nombre) cambios.nombre = nombre.trim();
    if (notas.trim() !== (competidor.notas ?? "")) {
      cambios.notas = notas.trim() === "" ? null : notas.trim();
    }
    if (url.trim() !== (competidor.url ?? "")) {
      cambios.url = url.trim() === "" ? null : url.trim();
    }
    if (Object.keys(cambios).length === 0) return alCerrar();

    enCurso.current = true;
    setEnviando(true);
    setErrorDeApi(null);
    try {
      await editar.mutateAsync(cambios);
      alCerrar();
    } catch (error) {
      setErrorDeApi(error);
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      titulo="Editar competidor"
      descripcion="El dominio no se puede cambiar. Si el competidor cambia de web, añade el nuevo y quita este."
      alCerrar={alCerrar}
      ocupado={enviando}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <Campo id={`${id}-nombre`} etiqueta="Nombre" error={errores.nombre}>
          <input
            id={`${id}-nombre`}
            data-autofocus
            type="text"
            autoComplete="off"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            aria-invalid={errores.nombre ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-nombre`, {
              error: errores.nombre,
            })}
            className="field w-full"
          />
        </Campo>
        <Campo
          id={`${id}-url`}
          etiqueta="Dirección de partida"
          opcional
          ayuda={
            <>
              La página por la que el agente empieza a leer. Tiene que ser de{" "}
              <span className="font-mono">{competidor.dominio}</span>.
            </>
          }
          error={errores.url}
        >
          <input
            id={`${id}-url`}
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
          id={`${id}-notas`}
          etiqueta="Notas"
          opcional
          ayuda={`${notas.length} de ${LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR}.`}
          error={errores.notas}
        >
          <textarea
            id={`${id}-notas`}
            rows={4}
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
          respaldo="No se pudo guardar. Inténtalo de nuevo."
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
            {enviando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
