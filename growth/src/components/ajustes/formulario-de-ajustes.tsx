"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { mensajeDeError } from "@/lib/api-errors";
import { claves, useGuardarAjustes } from "@/lib/consultas";
import { etiquetaCortaDeObjetivo } from "@/lib/etiquetas";
import { formatearDistancia } from "@/lib/formato";
import { OBJETIVOS, type Ajustes } from "@/lib/types";
import { CampoDeAjuste } from "./campo-de-ajuste";
import {
  cambiosDe,
  camposDe,
  hayEdiciones,
  textoDePorcentaje,
  validarCampos,
  type CamposDeAjustes,
  type ClaveDeCampo,
} from "./validacion-de-ajustes";

function Bloque({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="text-base font-semibold text-tinta">{titulo}</h2>
      <p className="mt-1 text-sm text-muted">{descripcion}</p>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

/**
 * Umbrales de puntuación, tope semanal de contactos y umbral de similitud.
 * Valida los rangos como el backend (los límites vienen de la API) y manda
 * solo lo que cambió. Cambiar estos valores afloja o aprieta reglas duras: el
 * backend deja una fila en el Historial con el antes y el después.
 */
export function FormularioDeAjustes({ ajustes }: { ajustes: Ajustes }) {
  const queryClient = useQueryClient();
  const guardar = useGuardarAjustes();
  const [ediciones, setEdiciones] = useState<Partial<CamposDeAjustes>>({});
  const [recienGuardado, setRecienGuardado] = useState(false);

  const originales = camposDe(ajustes.valores);
  const actuales: CamposDeAjustes = { ...originales, ...ediciones };
  const errores = validarCampos(actuales, ajustes.limites);
  const hayErrores = Object.keys(errores).length > 0;
  const cambios = cambiosDe(ajustes.valores, actuales);
  const hayCambios = Object.keys(cambios).length > 0;
  const editado = hayEdiciones(originales, actuales);
  const inicial = camposDe(ajustes.porDefecto);
  const yaSonLosIniciales = !hayEdiciones(inicial, actuales);

  const [minimoSimilitud, maximoSimilitud] = ajustes.limites.umbralDeSimilitud;
  const [minimoTope, maximoTope] = ajustes.limites.topeSemanal;
  const [minimoUmbral, maximoUmbral] = ajustes.limites.umbralesPorObjetivo;

  function editar(campo: ClaveDeCampo, texto: string) {
    setEdiciones((previas) => ({ ...previas, [campo]: texto }));
    setRecienGuardado(false);
    if (guardar.isError) guardar.reset();
  }

  function descartar() {
    setEdiciones({});
    setRecienGuardado(false);
    guardar.reset();
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (hayErrores || !hayCambios || guardar.isPending) return;
    guardar.mutate(cambios, {
      onSuccess: (nuevos) => {
        // Se pinta ya lo que devolvió el backend, sin esperar al refresco.
        queryClient.setQueryData(claves.ajustes(), nuevos);
        setEdiciones({});
        setRecienGuardado(true);
      },
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      {/* Mientras guarda no se puede seguir editando: lo escrito después se perdería. */}
      <fieldset
        disabled={guardar.isPending}
        className="m-0 min-w-0 space-y-5 border-0 p-0"
      >
        <Bloque
          titulo="Puntuación mínima por objetivo"
          descripcion={`Una oportunidad calificada por debajo del umbral de su objetivo se descarta sola, con el motivo «Bajo el umbral de puntuación». Las URL que añades a mano no pasan por este umbral. Cada umbral va de ${minimoUmbral} a ${maximoUmbral}. Los 60 iniciales no están medidos: calíbralos mirando los descartes en Ejecuciones.`}
        >
          <div className="grid gap-5 sm:grid-cols-3">
            {OBJETIVOS.map((objetivo) => (
              <CampoDeAjuste
                key={objetivo}
                etiqueta={etiquetaCortaDeObjetivo(objetivo)}
                valor={actuales[objetivo]}
                alCambiar={(texto) => editar(objetivo, texto)}
                error={errores[objetivo]}
                unidad="/ 100"
              />
            ))}
          </div>
          <p className="text-xs text-muted">
            {ajustes.actualizadoEn.umbralesPorObjetivo
              ? `Último cambio ${formatearDistancia(ajustes.actualizadoEn.umbralesPorObjetivo)}.`
              : "Sin cambios desde los valores iniciales."}
          </p>
        </Bloque>

        <Bloque
          titulo="Contactos"
          descripcion={`Cuentan los contactos ya hechos y las oportunidades aprobadas que aún no has gestionado. Al aprobar, el backend avisa si ya se alcanzó el tope. Además, solo se contacta una vez por dominio cada ${ajustes.soloLectura.diasEntreContactosAlMismoDominio} días (fijo).`}
        >
          <CampoDeAjuste
            etiqueta="Contactos por semana"
            valor={actuales.topeSemanal}
            alCambiar={(texto) => editar("topeSemanal", texto)}
            error={errores.topeSemanal}
            ayuda={`De ${minimoTope} a ${maximoTope}. Con 0 no se puede aprobar ningún contacto.`}
            ultimoCambio={ajustes.actualizadoEn.topeSemanal ?? null}
          />
        </Bloque>

        <Bloque
          titulo="Parecido entre textos"
          descripcion={`A partir de este parecido con otro texto tuyo, el borrador se bloquea (regla anti-plantilla). Desde ${textoDePorcentaje(minimoSimilitud)} % ya avisa, sin bloquear.`}
        >
          <CampoDeAjuste
            etiqueta="Parecido que bloquea"
            valor={actuales.umbralDeSimilitud}
            alCambiar={(texto) => editar("umbralDeSimilitud", texto)}
            error={errores.umbralDeSimilitud}
            unidad="%"
            decimal
            ayuda={`De ${textoDePorcentaje(minimoSimilitud)} a ${textoDePorcentaje(maximoSimilitud)} %. Más alto es más permisivo.`}
            ultimoCambio={ajustes.actualizadoEn.umbralDeSimilitud ?? null}
          />
        </Bloque>
      </fieldset>

      <div className="space-y-3">
        {guardar.isError ? (
          <p
            role="alert"
            className="rounded-[10px] border border-error-borde bg-error-fondo p-3 text-sm text-error"
          >
            {mensajeDeError(
              guardar.error,
              "No se pudieron guardar los ajustes. Inténtalo de nuevo."
            )}
          </p>
        ) : null}
        <p className="min-h-5 text-sm text-exito" aria-live="polite">
          {recienGuardado
            ? "Ajustes guardados. El cambio queda en el Historial."
            : ""}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="submit"
            className="btn-primary"
            disabled={hayErrores || !hayCambios || guardar.isPending}
          >
            {guardar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {guardar.isPending ? "Guardando…" : "Guardar cambios"}
          </button>
          {editado ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={guardar.isPending}
              onClick={descartar}
            >
              Descartar cambios
            </button>
          ) : null}
          {!yaSonLosIniciales ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={guardar.isPending}
              onClick={() => {
                setEdiciones(inicial);
                setRecienGuardado(false);
              }}
            >
              Poner los valores iniciales
            </button>
          ) : null}
        </div>
        {editado ? (
          <p className="text-xs text-muted">Hay cambios sin guardar.</p>
        ) : null}
      </div>
    </form>
  );
}
