"use client";

import { FileText } from "lucide-react";
import { AvisoDeErrorDeAccion } from "@/components/comunes/d1-aviso-de-error";
import { BotonDeEnlaceExterno } from "@/components/comunes/d1-boton-de-enlace";
import { EnlaceExterno } from "@/components/enlace-externo";
import { Insignia, InsigniaDeEstadoDeBorrador } from "@/components/insignia";
import {
  ETIQUETA_DE_CANAL,
  ETIQUETA_DE_ESTADO_DE_BORRADOR,
  ETIQUETA_DE_RESULTADO_DE_GESTION,
  ETIQUETA_DE_TIPO_DE_BORRADOR,
} from "@/lib/etiquetas";
import { formatearFechaYHora } from "@/lib/formato";
import type { BorradorDetallado, DetalleDeOportunidad } from "@/lib/types";
import { BotonCopiar } from "./boton-copiar";
import { EditorDeBorrador } from "./editor-de-borrador";
import type { ErroresDeEdicion, ValoresEditables } from "./edicion";
import type { AccionesDeRevision } from "./use-acciones-de-revision";

/** Por qué un borrador no se puede editar (solo se dice cuando hay un borrador). */
function motivoDeSoloLectura(
  borrador: BorradorDetallado,
  oportunidad: DetalleDeOportunidad
): string {
  if (borrador.estado === "descartado") {
    return "Versión descartada: se conserva solo para que la compares.";
  }
  if (borrador.estado === "aprobado") {
    return "Aprobado: ya no se edita. Si envías algo distinto, escríbelo al marcarlo como gestionado.";
  }
  if (borrador.estado === "gestionado") {
    return "Gestionado: este es el texto que se aprobó.";
  }
  if (oportunidad.borradorEditableId !== null) {
    return "Versión anterior: solo lectura. La editable es la última.";
  }
  return "Este borrador no se puede editar en el estado en el que está la oportunidad.";
}

function DatoDeLectura({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{etiqueta}</dt>
      <dd className="mt-1 text-sm text-tinta [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

/** El borrador tal cual está guardado, sin formulario (aprobado, gestionado, descartado, versiones viejas). */
function BorradorDeSoloLectura({ borrador }: { borrador: BorradorDetallado }) {
  const { gestion } = borrador;
  return (
    <dl className="space-y-4">
      {borrador.asunto ? (
        <DatoDeLectura etiqueta="Asunto">{borrador.asunto}</DatoDeLectura>
      ) : null}
      <DatoDeLectura etiqueta="Texto">
        <p className="whitespace-pre-wrap rounded-[10px] border border-linea bg-relleno p-4 leading-relaxed">
          {borrador.texto}
        </p>
      </DatoDeLectura>
      {borrador.enlaceUrl ? (
        <DatoDeLectura etiqueta="Enlace a Alhabla">
          <EnlaceExterno href={borrador.enlaceUrl} conIcono>
            {borrador.enlaceUrl}
          </EnlaceExterno>
        </DatoDeLectura>
      ) : null}
      {borrador.textoFinal ? (
        <DatoDeLectura etiqueta="Texto que de verdad se envió">
          <p className="whitespace-pre-wrap rounded-[10px] border border-linea bg-relleno p-4 leading-relaxed">
            {borrador.textoFinal}
          </p>
        </DatoDeLectura>
      ) : null}
      {gestion ? (
        <DatoDeLectura etiqueta="Gestión">
          {ETIQUETA_DE_CANAL[gestion.canal]} el{" "}
          {formatearFechaYHora(gestion.hechaEn)} ·{" "}
          {ETIQUETA_DE_RESULTADO_DE_GESTION[gestion.resultado]}
          {gestion.urlConseguida ? (
            <>
              {" · "}
              <EnlaceExterno href={gestion.urlConseguida} conIcono>
                Enlace conseguido
              </EnlaceExterno>
            </>
          ) : null}
          {gestion.notas ? (
            <span className="mt-1 block text-muted">{gestion.notas}</span>
          ) : null}
        </DatoDeLectura>
      ) : null}
    </dl>
  );
}

/**
 * La columna del medio de la Revisión: el borrador. Editable cuando lo permite
 * el backend (`borradorEditableId`); en cualquier otro caso, de solo lectura.
 * Lleva el selector de versiones, «Copiar texto» y «Abrir página».
 */
export function ColumnaDeBorrador({
  oportunidad,
  borrador,
  alElegirVersion,
  valores,
  errores,
  hayCambios,
  acciones,
  alCambiar,
  alGuardar,
  alDescartarCambios,
}: {
  oportunidad: DetalleDeOportunidad;
  borrador: BorradorDetallado | null;
  alElegirVersion: (id: string) => void;
  valores: ValoresEditables | null;
  errores: ErroresDeEdicion;
  hayCambios: boolean;
  acciones: AccionesDeRevision;
  alCambiar: <K extends keyof ValoresEditables>(
    campo: K,
    valor: ValoresEditables[K]
  ) => void;
  alGuardar: () => void;
  alDescartarCambios: () => void;
}) {
  const editable =
    borrador !== null &&
    valores !== null &&
    borrador.id === oportunidad.borradorEditableId;

  return (
    <section
      aria-labelledby="revision-borrador"
      className="panel space-y-5 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="revision-borrador" className="text-sm font-semibold text-tinta">
          {borrador ? `Borrador v${borrador.version}` : "Borrador"}
        </h2>
        {borrador ? (
          <>
            <InsigniaDeEstadoDeBorrador estado={borrador.estado} />
            <Insignia>{ETIQUETA_DE_TIPO_DE_BORRADOR[borrador.tipo]}</Insignia>
            {borrador.editadoPorHumano ? (
              <Insignia tono="morado">Editado a mano</Insignia>
            ) : null}
          </>
        ) : null}
      </div>

      {oportunidad.borradores.length > 1 ? (
        <div
          role="group"
          aria-label="Versión del borrador"
          className="flex flex-wrap gap-2"
        >
          {oportunidad.borradores.map((version) => (
            <button
              key={version.id}
              type="button"
              aria-pressed={borrador?.id === version.id}
              onClick={() => alElegirVersion(version.id)}
              className="flex min-h-11 items-center gap-1.5 rounded-full border border-linea bg-superficie px-3.5 text-sm font-semibold text-tinta-3 transition duration-150 hover:bg-relleno focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado aria-pressed:border-lavado-borde aria-pressed:bg-lavado aria-pressed:text-morado-tinta"
            >
              v{version.version}
              <span className="text-xs font-normal">
                {ETIQUETA_DE_ESTADO_DE_BORRADOR[version.estado]}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {borrador && valores ? (
        <>
          {editable ? (
            <>
              <EditorDeBorrador
                valores={valores}
                errores={errores}
                hayCambios={hayCambios}
                ocupado={acciones.ocupado}
                guardado={acciones.guardado}
                alCambiar={alCambiar}
                alGuardar={alGuardar}
                alDescartarCambios={alDescartarCambios}
              />
              <AvisoDeErrorDeAccion
                error={acciones.errorDeEdicion}
                respaldo="No se pudo guardar el borrador. Lo que escribiste sigue aquí."
              />
            </>
          ) : (
            <>
              <p className="rounded-[10px] bg-relleno p-3 text-xs text-muted">
                {motivoDeSoloLectura(borrador, oportunidad)}
              </p>
              <BorradorDeSoloLectura borrador={borrador} />
            </>
          )}
          <div className="flex flex-wrap gap-2 border-t border-linea-suave pt-4">
            <BotonCopiar texto={valores.texto} etiqueta="Copiar texto" />
            <BotonDeEnlaceExterno href={oportunidad.url}>
              Abrir página
            </BotonDeEnlaceExterno>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center px-2 py-6 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-lavado text-morado">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-tinta">
            Todavía no hay borrador
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Lo escribirá el agente cuando haya investigado esta oportunidad.
          </p>
          <div className="mt-4">
            <BotonDeEnlaceExterno href={oportunidad.url}>
              Abrir página
            </BotonDeEnlaceExterno>
          </div>
        </div>
      )}
    </section>
  );
}
