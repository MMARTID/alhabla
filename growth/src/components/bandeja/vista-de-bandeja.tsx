"use client";

import Link from "next/link";
import { Plus, SearchX, X } from "lucide-react";
import { useState } from "react";
import { useAhora } from "@/components/comunes/d1-ahora";
import { ConsultaConDatos } from "@/components/comunes/d1-consulta-con-datos";
import { EncabezadoDePagina } from "@/components/encabezado-de-pagina";
import { EstadoVacio } from "@/components/estado-vacio";
import { Paginacion } from "@/components/paginacion";
import { useOportunidades, useResumen } from "@/lib/consultas";
import { ETIQUETA_DE_ESTADO } from "@/lib/etiquetas";
import type {
  EstadoDeOportunidad,
  ListaDeOportunidades,
  RespuestaDeNuevaUrl,
} from "@/lib/types";
import { BandejaVacia } from "./bandeja-vacia";
import { ContadoresDeBandeja } from "./contadores-de-bandeja";
import { DialogoAnadirUrl } from "./dialogo-anadir-url";
import {
  FILTROS_POR_DEFECTO,
  aFiltrosDeApi,
  guardarFiltros,
  hayFiltrosActivos,
  leerFiltrosGuardados,
  type FiltrosDeBandeja,
} from "./estado-de-filtros";
import { BarraDeFiltros, type OpcionDeNicho } from "./filtros-de-bandeja";
import { TarjetaDeOportunidad } from "./tarjeta-de-oportunidad";

/**
 * Los nichos que han aparecido en alguna lista cargada, para ofrecerlos en el
 * filtro. No hay (aún) un endpoint de nichos en la API de la 1b, y filtrar por
 * un nicho deja la lista con solo ese: por eso se acumulan los vistos.
 */
function useNichosVistos(
  lista: ListaDeOportunidades | undefined,
  seleccionado: string
): OpcionDeNicho[] {
  const [vistos, setVistos] = useState<Record<string, string>>({});
  const [ultimaLista, setUltimaLista] = useState<
    ListaDeOportunidades | undefined
  >(undefined);
  // Ajuste de estado durante el render (el patrón que React recomienda en vez
  // de un efecto): solo cuando llega una lista nueva.
  if (lista && lista !== ultimaLista) {
    setUltimaLista(lista);
    const nuevos = { ...vistos };
    let cambia = false;
    for (const oportunidad of lista.data) {
      const nicho = oportunidad.nicho;
      if (nicho && nuevos[nicho.slug] !== nicho.nombre) {
        nuevos[nicho.slug] = nicho.nombre;
        cambia = true;
      }
    }
    if (cambia) setVistos(nuevos);
  }
  const opciones = Object.entries(vistos).map(([slug, nombre]) => ({
    slug,
    nombre,
  }));
  if (seleccionado && !vistos[seleccionado]) {
    opciones.push({ slug: seleccionado, nombre: seleccionado });
  }
  return opciones.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function AvisoDeUrlAnadida({
  respuesta,
  alCerrar,
}: {
  respuesta: RespuestaDeNuevaUrl;
  alCerrar: () => void;
}) {
  const nueva = respuesta.creada;
  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-3 rounded-[10px] border border-lavado-borde bg-lavado p-4 text-sm text-tinta-2"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-morado-tinta">
          {nueva
            ? "URL añadida"
            : `Esa URL ya estaba registrada (${ETIQUETA_DE_ESTADO[respuesta.estado]})`}
        </p>
        <p className="mt-1">
          {nueva
            ? "El agente la calificará en su próxima ejecución; hasta entonces no sale en esta lista."
            : (respuesta.motivoDescarte ??
              "No se ha creado otra: se queda como estaba.")}
        </p>
        <Link
          href={`/oportunidad/${encodeURIComponent(respuesta.id)}`}
          className="mt-2 inline-flex min-h-11 items-center font-semibold text-morado-tinta underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
        >
          Ver la oportunidad
        </Link>
      </div>
      <button
        type="button"
        onClick={alCerrar}
        aria-label="Cerrar aviso"
        className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-apagado hover:bg-lavado-2 hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * La Bandeja: lo que merece tu tiempo esta semana. Tarjetas ordenadas por
 * puntuación (el servidor ordena y pagina), filtros por objetivo, estado,
 * nicho y tipo, contadores de la semana y «Añadir URL». Con la lista vacía
 * cuenta la verdad: cuántas candidatas se descartaron y por qué.
 */
export function VistaDeBandeja() {
  const [filtros, setFiltros] =
    useState<FiltrosDeBandeja>(leerFiltrosGuardados);
  const [anadiendo, setAnadiendo] = useState(false);
  const [anadida, setAnadida] = useState<RespuestaDeNuevaUrl | null>(null);
  const ahora = useAhora();

  const consulta = useOportunidades(aFiltrosDeApi(filtros));
  const resumen = useResumen();
  const nichos = useNichosVistos(consulta.data, filtros.nicho);

  function cambiar(cambios: Partial<FiltrosDeBandeja>) {
    // Cualquier cambio de filtro vuelve a la primera página.
    const siguiente = { ...filtros, pagina: 1, ...cambios };
    setFiltros(siguiente);
    guardarFiltros(siguiente);
  }

  function quitarFiltros() {
    const siguiente = {
      ...FILTROS_POR_DEFECTO,
      orden: filtros.orden,
    };
    setFiltros(siguiente);
    guardarFiltros(siguiente);
  }

  const conFiltros = hayFiltrosActivos(filtros);
  const buscando = consulta.isPlaceholderData;

  return (
    <>
      <EncabezadoDePagina
        titulo="Bandeja"
        descripcion="Lo que merece tu tiempo esta semana."
        acciones={
          <button
            type="button"
            onClick={() => setAnadiendo(true)}
            className="btn-primary h-11"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Añadir URL
          </button>
        }
      />

      {resumen.data?.pausa ? (
        <p className="mb-5 rounded-[10px] border border-aviso-borde bg-aviso-fondo p-4 text-sm text-aviso">
          <span className="font-semibold">Growth está en pausa.</span> El agente
          no crea ni modifica nada hasta que lo reactives en{" "}
          <Link
            href="/ajustes"
            className="font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
          >
            Ajustes
          </Link>
          .
        </p>
      ) : null}

      {anadida ? (
        <AvisoDeUrlAnadida
          respuesta={anadida}
          alCerrar={() => setAnadida(null)}
        />
      ) : null}

      <ContadoresDeBandeja
        resumen={resumen}
        estadoElegido={filtros.estado}
        alElegir={(estado: EstadoDeOportunidad) =>
          cambiar({ estado: filtros.estado === estado ? "bandeja" : estado })
        }
      />

      <BarraDeFiltros
        filtros={filtros}
        nichos={nichos}
        conteos={consulta.data?.conteos.porEstado}
        alCambiar={cambiar}
        alQuitar={quitarFiltros}
      />

      <ConsultaConDatos
        consulta={consulta}
        titulo="No se pudo cargar la bandeja"
      >
        {(lista) => {
          if (lista.data.length === 0 && lista.total > 0) {
            // Se vació la página en la que estabas (aprobaste lo último de ella).
            return (
              <EstadoVacio
                icono={SearchX}
                titulo="Esta página ya no tiene nada"
              >
                <button
                  type="button"
                  className="btn-secondary h-11"
                  onClick={() => cambiar({ pagina: 1 })}
                >
                  Volver a la primera página
                </button>
              </EstadoVacio>
            );
          }
          if (lista.data.length === 0) {
            return conFiltros ? (
              <EstadoVacio
                icono={SearchX}
                titulo="Ninguna oportunidad encaja con estos filtros"
                accion={
                  <button
                    type="button"
                    className="btn-secondary h-11"
                    onClick={quitarFiltros}
                  >
                    Quitar filtros
                  </button>
                }
              />
            ) : (
              <BandejaVacia resumen={resumen} />
            );
          }
          return (
            <div aria-busy={buscando || undefined}>
              <p className="mb-3 text-sm text-muted" aria-live="polite">
                {lista.total === 1
                  ? "1 oportunidad"
                  : `${lista.total} oportunidades`}
              </p>
              <ul
                className={`space-y-3 transition-opacity duration-150 ${buscando ? "opacity-60" : ""}`}
              >
                {lista.data.map((oportunidad) => (
                  <TarjetaDeOportunidad
                    key={oportunidad.id}
                    oportunidad={oportunidad}
                    ahora={ahora}
                  />
                ))}
              </ul>
              <Paginacion
                pagina={lista.pagina}
                limite={lista.limite}
                total={lista.total}
                cargando={buscando}
                alCambiar={(pagina) => cambiar({ pagina })}
              />
            </div>
          );
        }}
      </ConsultaConDatos>

      {anadiendo ? (
        <DialogoAnadirUrl
          alCerrar={() => setAnadiendo(false)}
          alAnadir={(respuesta) => {
            setAnadiendo(false);
            setAnadida(respuesta);
          }}
        />
      ) : null}
    </>
  );
}
