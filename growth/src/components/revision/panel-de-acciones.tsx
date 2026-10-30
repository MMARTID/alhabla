"use client";

import { CircleCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { AvisoDeErrorDeAccion } from "@/components/comunes/d1-aviso-de-error";
import {
  calcularCaducidad,
  ESTADOS_CON_PLAZO,
  textoDeCaducidadCalculada,
} from "@/components/comunes/d1-caducidad";
import { ETIQUETA_DE_ACCION } from "@/lib/etiquetas";
import { formatearFecha } from "@/lib/formato";
import type {
  AccionDeDecision,
  AccionDisponible,
  BorradorDetallado,
  DetalleDeOportunidad,
  EstadoDeOportunidad,
} from "@/lib/types";
import {
  DialogoDeConseguido,
  DialogoDeCierre,
  DialogoDeDescartar,
  DialogoDeDevolver,
  DialogoDeGestionado,
} from "./dialogos-de-accion";
import { ORDEN_DE_ACCIONES, accionesVisibles } from "./acciones";
import { reglasDurasFallidas } from "./edicion";
import type { AccionesDeRevision } from "./use-acciones-de-revision";

/** Qué toca hacer en cada estado: una frase, para no tener que adivinarlo. */
const PISTA_POR_ESTADO: Record<EstadoDeOportunidad, string> = {
  detectada: "El agente todavía no la ha calificado.",
  calificada: "El agente aún la está investigando.",
  investigada: "El agente aún está preparando el borrador.",
  con_borrador: "El borrador está pendiente de que se evalúen las reglas.",
  pendiente_aprobacion:
    "Revisa el borrador. Si te convence, apruébalo; si no, devuélvelo con una nota o descártalo.",
  bloqueada:
    "Las reglas bloquean este borrador. Edítalo para corregirlo, o descarta la oportunidad.",
  aprobada:
    "Aprobada. Copia el texto, envíalo tú y vuelve aquí a marcarla como gestionada.",
  gestionada: "Ya la has contactado. Registra qué ha pasado.",
  conseguida: "Enlace conseguido.",
  sin_respuesta: "Cerrada sin éxito.",
  devuelta:
    "La nota que dejaste la leerá el agente en su próxima ejecución para preparar otra versión.",
  descartada: "Descartada.",
  caducada: "Caducó antes de gestionarse.",
};

/** Lo que se dice junto a una acción apagada cuando el backend no da motivo. */
const MOTIVO_POR_DEFECTO = "No disponible ahora mismo.";

type DialogoAbierto = Exclude<AccionDeDecision, "aprobar"> | null;

/** El borrador que `aprobar` aprobaría: el pendiente de aprobación. */
function borradorPendiente(
  oportunidad: DetalleDeOportunidad
): BorradorDetallado | null {
  return (
    oportunidad.borradores.find((b) => b.estado === "pendiente_aprobacion") ??
    null
  );
}

/**
 * Por qué «Aprobar» no se puede pulsar ahora, o `null` si se puede. La última
 * palabra la tiene el backend (reevalúa al aprobar y devuelve 409): esto solo
 * evita ofrecer lo que ya se sabe que va a fallar, y dice por qué. Si el
 * backend manda su propio motivo (`habilitada: false`), va primero.
 */
function motivoDeAprobarDeshabilitado({
  oportunidad,
  accion,
  pendiente,
  ahora,
}: {
  oportunidad: DetalleDeOportunidad;
  accion: AccionDisponible | undefined;
  pendiente: BorradorDetallado | null;
  ahora: number;
}): string | null {
  const delBackend =
    accion && !accion.habilitada
      ? (accion.motivo ?? "No se puede aprobar ahora mismo.")
      : null;
  if (!pendiente) {
    return (
      delBackend ??
      (oportunidad.estado === "bloqueada"
        ? "Las reglas bloquean el borrador: edítalo para poder aprobarlo."
        : "No hay ningún borrador pendiente de aprobación.")
    );
  }
  const fallidas = reglasDurasFallidas(pendiente);
  if (fallidas.length > 0) {
    const propio = `Hay ${fallidas.length === 1 ? "una regla dura" : `${fallidas.length} reglas duras`} sin cumplir: edita el borrador para corregirla${fallidas.length === 1 ? "" : "s"}.`;
    return delBackend ? `${delBackend} ${propio}` : propio;
  }
  if (delBackend) return delBackend;
  if (!accion) return "En este estado no se puede aprobar.";
  if (calcularCaducidad(oportunidad.expiraEn, ahora)?.tipo === "vencida") {
    return `Esta oportunidad caducó el ${formatearFecha(oportunidad.expiraEn)}: ya no se puede aprobar.`;
  }
  return null;
}

/**
 * La tarjeta de decisión de la Revisión (columna derecha). Pinta un botón por
 * cada acción que el backend manda en `oportunidad.acciones` (solo las
 * alcanzables desde el estado actual; ver `AccionDisponible`), con su etiqueta
 * humana, y si alguna viene apagada (`habilitada: false`) enseña su `motivo`
 * junto al botón.
 *
 * - «Aprobar» aprueba el borrador pendiente tal como está guardado. Si hay
 *   ediciones sin guardar, se sustituye por «Aprobar con ediciones», que
 *   guarda (y reevalúa las reglas) y solo después aprueba.
 * - Devolver, Descartar, Marcar como gestionado, Enlace conseguido y los cierres
 *   piden sus datos en un diálogo.
 * - Todo botón queda deshabilitado mientras hay una escritura en vuelo.
 */
export function PanelDeAcciones({
  oportunidad,
  acciones,
  hayCambios,
  alAprobarConEdiciones,
  ahora,
}: {
  oportunidad: DetalleDeOportunidad;
  acciones: AccionesDeRevision;
  /** Hay ediciones del borrador editable sin guardar. */
  hayCambios: boolean;
  /** Guarda y aprueba; `null` si no se puede (hay errores de validación). */
  alAprobarConEdiciones: (() => void) | null;
  ahora: number;
}) {
  const [dialogo, setDialogo] = useState<DialogoAbierto>(null);
  const porAccion = new Map(
    accionesVisibles(oportunidad.acciones).map((a) => [a.accion, a])
  );
  const pendiente = borradorPendiente(oportunidad);
  const editable =
    oportunidad.borradorEditableId !== null &&
    oportunidad.borradores.some((b) => b.id === oportunidad.borradorEditableId);

  const motivoSinAprobar = motivoDeAprobarDeshabilitado({
    oportunidad,
    accion: porAccion.get("aprobar"),
    pendiente,
    ahora,
  });
  const caducidad = ESTADOS_CON_PLAZO.has(oportunidad.estado)
    ? calcularCaducidad(oportunidad.expiraEn, ahora)
    : null;
  const caducaPronto = caducidad?.tipo === "pronto";

  function abrir(siguiente: DialogoAbierto) {
    acciones.limpiarError();
    setDialogo(siguiente);
  }
  function cerrar() {
    acciones.limpiarError();
    setDialogo(null);
  }

  const mostrarAprobar =
    porAccion.has("aprobar") || pendiente !== null || editable;
  const aprobarConEdiciones = hayCambios && editable;
  const sinNadaQueHacer =
    !mostrarAprobar && ORDEN_DE_ACCIONES.every((a) => !porAccion.has(a));

  return (
    <section
      aria-labelledby="revision-acciones"
      className="panel space-y-4 p-5"
    >
      <h2 id="revision-acciones" className="text-sm font-semibold text-tinta">
        Decisión
      </h2>
      <p className="text-sm text-muted">
        {PISTA_POR_ESTADO[oportunidad.estado]}
      </p>

      {caducaPronto && caducidad ? (
        <p className="rounded-[10px] border border-aviso-borde bg-aviso-fondo p-3 text-sm font-semibold text-aviso">
          {textoDeCaducidadCalculada(caducidad)}: si no la gestionas a tiempo se
          perderá.
        </p>
      ) : null}

      {sinNadaQueHacer ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <CircleCheck className="h-4 w-4 text-exito" aria-hidden="true" />
          No hay acciones disponibles en este estado.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {mostrarAprobar ? (
            aprobarConEdiciones ? (
              <button
                type="button"
                disabled={acciones.ocupado || alAprobarConEdiciones === null}
                onClick={() => alAprobarConEdiciones?.()}
                className="btn-primary h-11"
              >
                {acciones.ocupado ? (
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : null}
                Aprobar con ediciones
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={acciones.ocupado || motivoSinAprobar !== null}
                  aria-describedby={
                    motivoSinAprobar ? "motivo-aprobar" : undefined
                  }
                  onClick={() =>
                    pendiente
                      ? void acciones.decidir({
                          accion: "aprobar",
                          borradorId: pendiente.id,
                        })
                      : undefined
                  }
                  className="btn-primary h-11"
                >
                  {acciones.ocupado ? (
                    <Loader2
                      className="h-4 w-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : null}
                  {ETIQUETA_DE_ACCION.aprobar}
                </button>
                {motivoSinAprobar ? (
                  <p id="motivo-aprobar" className="text-xs text-muted">
                    {motivoSinAprobar}
                  </p>
                ) : null}
              </>
            )
          ) : null}

          {ORDEN_DE_ACCIONES.filter(
            (a) => a !== "aprobar" && porAccion.has(a)
          ).map((accion) => {
            const datos = porAccion.get(accion);
            const apagada = datos ? !datos.habilitada : false;
            return (
              <div key={accion}>
                <button
                  type="button"
                  disabled={acciones.ocupado || apagada}
                  aria-describedby={apagada ? `motivo-${accion}` : undefined}
                  onClick={() =>
                    abrir(accion as Exclude<AccionDeDecision, "aprobar">)
                  }
                  className="btn-secondary h-11 w-full"
                >
                  {ETIQUETA_DE_ACCION[accion]}
                </button>
                {apagada ? (
                  <p
                    id={`motivo-${accion}`}
                    className="mt-1.5 text-xs text-muted"
                  >
                    {datos?.motivo ?? MOTIVO_POR_DEFECTO}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {dialogo === null ? (
        <AvisoDeErrorDeAccion
          error={acciones.errorDeDecision}
          cambiosGuardados={acciones.cambiosGuardadosAlFallar}
          respaldo="No se pudo completar la acción. Inténtalo de nuevo."
        />
      ) : null}

      {dialogo === "devolver" ? (
        <DialogoDeDevolver acciones={acciones} alCerrar={cerrar} />
      ) : null}
      {dialogo === "descartar" ? (
        <DialogoDeDescartar acciones={acciones} alCerrar={cerrar} />
      ) : null}
      {dialogo === "marcar_gestionado" ? (
        <DialogoDeGestionado acciones={acciones} alCerrar={cerrar} />
      ) : null}
      {dialogo === "conseguido" ? (
        <DialogoDeConseguido acciones={acciones} alCerrar={cerrar} />
      ) : null}
      {dialogo === "sin_respuesta" || dialogo === "rechazado" ? (
        <DialogoDeCierre acciones={acciones} alCerrar={cerrar} tipo={dialogo} />
      ) : null}
    </section>
  );
}
