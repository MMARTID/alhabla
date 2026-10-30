"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { EstadoDeConsulta } from "@/components/estado-de-consulta";
import { Insignia, InsigniaDeEstado } from "@/components/insignia";
import { useDetalleDeEjecucion } from "@/lib/consultas";
import {
  ETIQUETA_DE_ESTADO,
  etiquetaCortaDeObjetivo,
  etiquetaDeCodigoDeDescarte,
} from "@/lib/etiquetas";
import { formatearDuracion, formatearPorcentaje } from "@/lib/formato";
import { ESTADOS_DE_OPORTUNIDAD, type DetalleDeEjecucion } from "@/lib/types";
import {
  ETIQUETA_DE_ESTADO_DE_MODULO,
  TONO_DE_ESTADO_DE_MODULO,
  etiquetaDeModulo,
  leerModulos,
  leerResumen,
  numeroOpcional,
} from "./utilidades";

/** Cuántas oportunidades devuelve el backend como máximo en este detalle. */
const TOPE_DE_OPORTUNIDADES = 200;

/**
 * El detalle de una ejecución: su error, lo que hizo cada módulo, lo que
 * cuenta el SERVIDOR (que sirve para calibrar los umbrales), el resumen que
 * quedó guardado al cerrarla y las oportunidades que salieron de ella. Los
 * nombres de módulo, los errores y las notas los escribe el agente: se pintan
 * como texto y se leen sin fiarse de su forma.
 */
export function DetalleDeEjecucionAbierto({ id }: { id: string }) {
  const consulta = useDetalleDeEjecucion(id);
  return (
    <EstadoDeConsulta
      consulta={consulta}
      titulo="No se pudo cargar el detalle de la ejecución"
      filas={2}
      alto="h-20"
    >
      {(detalle) => <Contenido detalle={detalle} />}
    </EstadoDeConsulta>
  );
}

function Seccion({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-tinta">{titulo}</h3>
      {ayuda ? <p className="mt-0.5 text-xs text-muted">{ayuda}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Contador({ n, texto }: { n: number; texto: string }) {
  return (
    <li className="rounded-[10px] border border-linea bg-relleno px-3 py-1.5 text-sm">
      <span className="font-semibold text-tinta">{n}</span>{" "}
      <span className="text-muted">{texto}</span>
    </li>
  );
}

function Contenido({ detalle }: { detalle: DetalleDeEjecucion }) {
  const modulos = leerModulos(detalle.modulos);
  const resumen = leerResumen(detalle.resumen);
  const porEstado = ESTADOS_DE_OPORTUNIDAD.flatMap((estado) => {
    const n = detalle.oportunidadesPorEstado?.[estado];
    return typeof n === "number" && n > 0 ? [{ estado, n }] : [];
  });
  const totalDeOportunidades = porEstado.reduce((suma, e) => suma + e.n, 0);
  const descartes = detalle.descartesPorMotivo ?? [];
  const totalDeDescartes = descartes.reduce((suma, d) => suma + d.n, 0);
  const borradores = numeroOpcional(detalle, "borradores");
  const oportunidades = detalle.oportunidades ?? [];
  // Lo que el agente declaró y no coincide con lo que se midió.
  const medidos = new Map(resumen.contadores.map((c) => [c.clave, c.n]));

  return (
    <div className="space-y-5 border-t border-linea p-4 sm:p-5">
      {detalle.error ? (
        <div className="rounded-[10px] border border-error-borde bg-error-fondo p-3">
          <p className="text-sm font-semibold text-error">
            Error de la ejecución
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-sm text-tinta-2">
            {detalle.error}
          </p>
        </div>
      ) : null}

      <Seccion titulo="Módulos">
        {modulos.length === 0 ? (
          <p className="text-sm text-muted">
            El agente no declaró qué módulos corrieron.
          </p>
        ) : (
          <ul className="divide-y divide-linea-suave">
            {modulos.map((modulo) => (
              <li key={modulo.clave} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 break-words text-sm font-medium text-tinta">
                    {etiquetaDeModulo(modulo.clave)}
                    {modulo.duracion !== null ? (
                      <span className="font-normal text-muted">
                        {" "}
                        · {formatearDuracion(modulo.duracion)}
                      </span>
                    ) : null}
                  </p>
                  <Insignia
                    tono={
                      modulo.estado
                        ? TONO_DE_ESTADO_DE_MODULO[modulo.estado]
                        : "neutro"
                    }
                  >
                    {modulo.estado
                      ? ETIQUETA_DE_ESTADO_DE_MODULO[modulo.estado]
                      : "Sin estado"}
                  </Insignia>
                </div>
                {modulo.error ? (
                  <p className="mt-1 whitespace-pre-line break-words text-sm text-error">
                    {modulo.error}
                  </p>
                ) : null}
                {modulo.notas ? (
                  <p className="mt-1 whitespace-pre-line break-words text-sm text-muted">
                    {modulo.notas}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion
        titulo="Lo que cuenta el servidor"
        ayuda="Sale de las oportunidades enlazadas a esta ejecución, no de lo que cuente el agente. Úsalo para calibrar los umbrales."
      >
        {porEstado.length === 0 ? (
          <p className="text-sm text-muted">
            Ninguna oportunidad quedó enlazada a esta ejecución.
          </p>
        ) : (
          <>
            <ul
              aria-label="Oportunidades por estado"
              className="flex flex-wrap gap-2"
            >
              {porEstado.map(({ estado, n }) => (
                <Contador
                  key={estado}
                  n={n}
                  texto={ETIQUETA_DE_ESTADO[estado]}
                />
              ))}
              {borradores !== null && borradores > 0 ? (
                <Contador
                  n={borradores}
                  texto={borradores === 1 ? "borrador" : "borradores"}
                />
              ) : null}
            </ul>
            <p className="mt-2 text-xs text-muted">
              {totalDeOportunidades}{" "}
              {totalDeOportunidades === 1 ? "oportunidad" : "oportunidades"} en
              total.
            </p>
          </>
        )}

        {descartes.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-tinta">
              Descartes por motivo
            </p>
            <ul className="mt-1 divide-y divide-linea-suave">
              {descartes.map(({ codigo, n }) => (
                <li
                  key={codigo}
                  className="flex items-baseline justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0 break-words text-tinta-2">
                    {etiquetaDeCodigoDeDescarte(codigo)}
                  </span>
                  <span className="shrink-0 text-tinta">
                    <span className="font-semibold">{n}</span>
                    <span className="text-muted">
                      {" "}
                      · {formatearPorcentaje(n / totalDeDescartes)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Seccion>

      {resumen.contadores.length > 0 || resumen.notas ? (
        <Seccion
          titulo="Resumen guardado al cerrarla"
          ayuda="Es el resumen que quedó registrado cuando terminó la ejecución."
        >
          {resumen.contadores.length > 0 ? (
            <ul aria-label="Resumen guardado" className="flex flex-wrap gap-2">
              {resumen.contadores.map((c) => (
                <Contador key={c.clave} n={c.n} texto={c.texto} />
              ))}
            </ul>
          ) : null}
          {resumen.notas ? (
            <p className="mt-2 whitespace-pre-line break-words border-l-2 border-linea pl-3 text-sm text-tinta-2">
              {resumen.notas}
            </p>
          ) : null}
        </Seccion>
      ) : null}

      {resumen.declarado ? (
        <Seccion
          titulo="Lo que declaró el agente"
          ayuda="Informativo. Si no coincide con lo que midió el servidor, fíate del servidor."
        >
          <ul aria-label="Declarado por el agente" className="space-y-1">
            {resumen.declarado.map((c) => {
              const medido = medidos.get(c.clave);
              const difiere = medido !== undefined && medido !== c.n;
              return (
                <li key={c.clave} className="text-sm text-tinta-2">
                  <span className="font-semibold text-tinta">{c.n}</span>{" "}
                  {c.texto}
                  {difiere ? (
                    <span className="text-aviso">
                      {" "}
                      · el servidor midió {medido}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Seccion>
      ) : null}

      {oportunidades.length > 0 ? (
        <Seccion
          titulo="Oportunidades de esta ejecución"
          ayuda={
            oportunidades.length >= TOPE_DE_OPORTUNIDADES
              ? `Se enseñan las primeras ${TOPE_DE_OPORTUNIDADES}.`
              : undefined
          }
        >
          <ul className="divide-y divide-linea-suave">
            {oportunidades.map((oportunidad) => (
              <li
                key={oportunidad.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5"
              >
                <div className="min-w-0">
                  <Link
                    href={`/oportunidad/${encodeURIComponent(oportunidad.id)}`}
                    className="break-words rounded-sm text-sm font-medium text-tinta underline decoration-linea-fuerte underline-offset-2 hover:decoration-morado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
                  >
                    {oportunidad.titulo || oportunidad.dominio}
                  </Link>
                  <p className="break-all text-xs text-muted">
                    {oportunidad.dominio} ·{" "}
                    {etiquetaCortaDeObjetivo(oportunidad.objetivoPrincipal)}
                    {oportunidad.codigoDescarte
                      ? ` · ${etiquetaDeCodigoDeDescarte(oportunidad.codigoDescarte)}`
                      : ""}
                  </p>
                </div>
                <InsigniaDeEstado estado={oportunidad.estado} />
              </li>
            ))}
          </ul>
        </Seccion>
      ) : null}
    </div>
  );
}
