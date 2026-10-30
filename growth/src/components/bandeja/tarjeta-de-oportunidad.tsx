import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { textoDeMenciones } from "@/components/competencia/utilidades";
import { ChipDeCaducidad } from "@/components/comunes/d1-caducidad";
import {
  Insignia,
  InsigniaDeEstado,
  InsigniaDeObjetivo,
  InsigniaDeResultado,
} from "@/components/insignia";
import { ETIQUETA_DE_TIPO_DE_DESTINO, etiquetaDeRegla } from "@/lib/etiquetas";
import { formatearDistancia } from "@/lib/formato";
import type { OportunidadResumen } from "@/lib/types";

/**
 * La razón por la que una oportunidad está parada, si la hay, en una frase
 * corta: la primera regla dura que falla en el borrador actual. Es el «porqué»
 * que evita abrir la Revisión solo para enterarse.
 */
function motivoDeBloqueo(oportunidad: OportunidadResumen): string | null {
  const actual = oportunidad.borradorActual;
  if (!actual) return null;
  const dura = actual.reglasFallidas.find((c) => c.dura && !c.ok);
  return dura ? `Bloquea: ${etiquetaDeRegla(dura.regla)}` : null;
}

/**
 * Una oportunidad de la Bandeja: toda la tarjeta es un enlace a su Revisión.
 * El título, el dominio y el extracto vienen de páginas ajenas: se pintan como
 * texto (React los escapa) y nunca llevan un `href` propio dentro de la
 * tarjeta.
 */
export function TarjetaDeOportunidad({
  oportunidad,
  ahora,
  nombresDeCompetidores,
}: {
  oportunidad: OportunidadResumen;
  ahora: number;
  /** dominio → nombre, para «Menciona a X»; sin él sale el dominio. */
  nombresDeCompetidores?: ReadonlyMap<string, string>;
}) {
  const bloqueo = motivoDeBloqueo(oportunidad);
  const borrador = oportunidad.borradorActual;
  const { puntuaciones } = oportunidad;
  const tipoDestino = oportunidad.datos?.tipoDestino;
  const menciones = oportunidad.datos?.competidoresMencionados ?? [];
  return (
    <li>
      <Link
        href={`/oportunidad/${encodeURIComponent(oportunidad.id)}`}
        className="panel group flex gap-4 p-4 transition duration-150 hover:border-linea-fuerte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado sm:p-5"
      >
        <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-lavado text-morado-tinta">
          <span className="sr-only">Puntuación </span>
          <span className="text-xl font-semibold leading-none">
            {oportunidad.puntuacion}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold leading-none opacity-80">
            /100
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold leading-snug text-tinta [overflow-wrap:anywhere]">
            {oportunidad.titulo}
          </span>
          <span className="mt-0.5 block text-xs text-muted [overflow-wrap:anywhere]">
            {oportunidad.dominio}
            {oportunidad.nicho ? ` · ${oportunidad.nicho.nombre}` : ""}
          </span>
          <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <InsigniaDeObjetivo objetivo={oportunidad.objetivoPrincipal} />
            <InsigniaDeEstado estado={oportunidad.estado} />
            <ChipDeCaducidad
              expiraEn={oportunidad.expiraEn}
              estado={oportunidad.estado}
              ahora={ahora}
            />
            {tipoDestino ? (
              <Insignia>{ETIQUETA_DE_TIPO_DE_DESTINO[tipoDestino]}</Insignia>
            ) : null}
            {borrador?.resultado ? (
              <InsigniaDeResultado resultado={borrador.resultado} />
            ) : null}
            {menciones.length > 0 ? (
              <Insignia tono="morado" envolver>
                Menciona a{" "}
                {textoDeMenciones(
                  menciones,
                  nombresDeCompetidores ?? new Map()
                )}
              </Insignia>
            ) : null}
          </span>
          {bloqueo ? (
            <span className="mt-2 block text-sm font-semibold text-error">
              {bloqueo}
            </span>
          ) : null}
          {oportunidad.extracto && !oportunidad.extractoPurgado ? (
            <span className="mt-2 line-clamp-2 block text-sm text-muted [overflow-wrap:anywhere]">
              {oportunidad.extracto}
            </span>
          ) : null}
          <span className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            <span>
              Por objetivo: A {puntuaciones.TRAFICO_MARCA} · B{" "}
              {puntuaciones.LEADS} · C {puntuaciones.BACKLINKS}
            </span>
            <span>Detectada {formatearDistancia(oportunidad.detectadaEn)}</span>
          </span>
        </span>
        <ChevronRight
          className="mt-4 hidden h-5 w-5 shrink-0 text-tenue group-hover:text-apagado sm:block"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
