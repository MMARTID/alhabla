"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useAhora } from "@/components/comunes/d1-ahora";
import { ChipDeCaducidad } from "@/components/comunes/d1-caducidad";
import { ConsultaConDatos } from "@/components/comunes/d1-consulta-con-datos";
import { EncabezadoDePagina } from "@/components/encabezado-de-pagina";
import { InsigniaDeEstado, InsigniaDeObjetivo } from "@/components/insignia";
import { useDetalleDeOportunidad } from "@/lib/consultas";
import type { BorradorDetallado, DetalleDeOportunidad } from "@/lib/types";
import { ColumnaDeBorrador } from "./columna-de-borrador";
import { ColumnaDeDestino } from "./columna-de-destino";
import {
  cambiosParaApi,
  hayCambios as hayCambiosEn,
  mismoValor,
  validarEdicion,
  valoresActuales,
  valoresBase,
  type EdicionParcial,
  type ValoresEditables,
} from "./edicion";
import { PanelDeAcciones } from "./panel-de-acciones";
import { PanelDeCumplimiento } from "./panel-de-cumplimiento";
import { useAccionesDeRevision } from "./use-acciones-de-revision";

/**
 * El borrador que se enseña al abrir: el que se puede editar; si no hay, el
 * que sigue vivo (aprobado o gestionado); y si no, el más reciente.
 */
function borradorPorDefecto(
  oportunidad: DetalleDeOportunidad
): BorradorDetallado | null {
  const { borradores, borradorEditableId } = oportunidad;
  return (
    borradores.find((b) => b.id === borradorEditableId) ??
    borradores.find(
      (b) => b.estado === "aprobado" || b.estado === "gestionado"
    ) ??
    borradores[0] ??
    null
  );
}

/**
 * La Revisión de una oportunidad, con su detalle ya cargado. Tres columnas
 * desde `lg` (destino e investigación · borrador · cumplimiento y decisión) y
 * apiladas en el móvil.
 *
 * Lo que la persona escribe en el borrador vive AQUÍ, en el estado de esta
 * pantalla, no en la caché de consultas ni en un formulario que se vuelva a
 * montar: ni un refresco de los datos, ni un error de red, ni una sesión
 * caducada (que solo pone un diálogo encima) pueden borrarlo. Se guarda por
 * campo tocado, así que un cambio del servidor en un campo que no has tocado
 * sí se ve.
 */
function Revision({
  oportunidad,
  borradorInicial,
}: {
  oportunidad: DetalleDeOportunidad;
  borradorInicial: string | null;
}) {
  const ahora = useAhora();
  const [eleccion, setEleccion] = useState<string | null>(borradorInicial);
  const [ediciones, setEdiciones] = useState<Record<string, EdicionParcial>>(
    {}
  );
  const acciones = useAccionesDeRevision({
    oportunidadId: oportunidad.id,
    borradorEditableId: oportunidad.borradorEditableId,
  });

  const borrador =
    oportunidad.borradores.find((b) => b.id === eleccion) ??
    borradorPorDefecto(oportunidad);
  const parcial = borrador ? ediciones[borrador.id] : undefined;
  const valores: ValoresEditables | null = borrador
    ? valoresActuales(borrador, parcial)
    : null;
  const hayCambios = borrador ? hayCambiosEn(borrador, parcial) : false;
  const errores = valores && hayCambios ? validarEdicion(valores) : {};
  const sePuedeGuardar = hayCambios && Object.keys(errores).length === 0;
  const esElEditable =
    borrador !== null && borrador.id === oportunidad.borradorEditableId;

  function cambiarCampo<K extends keyof ValoresEditables>(
    campo: K,
    valor: ValoresEditables[K]
  ) {
    if (!borrador) return;
    const base = valoresBase(borrador);
    setEdiciones((previo) => {
      const siguiente: EdicionParcial = { ...(previo[borrador.id] ?? {}) };
      if (mismoValor(valor, base[campo])) delete siguiente[campo];
      else siguiente[campo] = valor;
      const todas = { ...previo };
      if (Object.keys(siguiente).length === 0) delete todas[borrador.id];
      else todas[borrador.id] = siguiente;
      return todas;
    });
  }

  function descartarCambios() {
    if (!borrador) return;
    setEdiciones((previo) => {
      const todas = { ...previo };
      delete todas[borrador.id];
      return todas;
    });
  }

  function guardar() {
    if (!borrador || !sePuedeGuardar) return;
    void acciones.guardar(cambiosParaApi(borrador, parcial));
  }

  function aprobarConEdiciones() {
    if (!borrador || !sePuedeGuardar) return;
    void acciones.aprobarConEdiciones(cambiosParaApi(borrador, parcial));
  }

  return (
    <>
      <EncabezadoDePagina
        titulo={oportunidad.titulo}
        descripcion={
          <>
            {oportunidad.dominio}
            {oportunidad.nicho ? ` · ${oportunidad.nicho.nombre}` : ""}
          </>
        }
        acciones={
          <>
            <InsigniaDeObjetivo objetivo={oportunidad.objetivoPrincipal} />
            <InsigniaDeEstado estado={oportunidad.estado} />
            <ChipDeCaducidad
              expiraEn={oportunidad.expiraEn}
              estado={oportunidad.estado}
              ahora={ahora}
            />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        {/* En el móvil el orden visual es borrador, cumplimiento y decisión, y al
            final el destino (material de consulta); desde `lg`, las tres columnas
            de siempre. El orden del DOM es el de lectura de las columnas. */}
        <div className="order-3 min-w-0 lg:order-1">
          <ColumnaDeDestino oportunidad={oportunidad} ahora={ahora} />
        </div>
        <div className="order-1 min-w-0 lg:order-2">
          <ColumnaDeBorrador
            oportunidad={oportunidad}
            borrador={borrador}
            alElegirVersion={setEleccion}
            valores={valores}
            errores={errores}
            hayCambios={hayCambios && esElEditable}
            acciones={acciones}
            alCambiar={cambiarCampo}
            alGuardar={guardar}
            alDescartarCambios={descartarCambios}
          />
        </div>
        <div className="order-2 min-w-0 space-y-6 lg:order-3">
          <PanelDeCumplimiento borrador={borrador} oportunidad={oportunidad} />
          <PanelDeAcciones
            oportunidad={oportunidad}
            acciones={acciones}
            hayCambios={hayCambios && esElEditable}
            alAprobarConEdiciones={sePuedeGuardar ? aprobarConEdiciones : null}
            ahora={ahora}
          />
        </div>
      </div>
    </>
  );
}

/**
 * La Revisión de la oportunidad `id`. `borradorId` (de `?borrador=` en la URL,
 * el enlace profundo de Borradores) abre ya la versión que se le pasa.
 */
export function VistaDeRevision({
  id,
  borradorId,
}: {
  id: string;
  borradorId?: string;
}) {
  const consulta = useDetalleDeOportunidad(id);
  return (
    <>
      <Link
        href="/bandeja"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-apagado hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Bandeja
      </Link>
      <ConsultaConDatos
        consulta={consulta}
        titulo="No se pudo cargar la oportunidad"
        filas={3}
        alto="h-48"
      >
        {(oportunidad) => (
          <Revision
            key={oportunidad.id}
            oportunidad={oportunidad}
            borradorInicial={borradorId ?? null}
          />
        )}
      </ConsultaConDatos>
    </>
  );
}
