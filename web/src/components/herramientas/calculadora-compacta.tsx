"use client";

import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { useId, useState, type CSSProperties } from "react";
import { RangeSlider } from "@/components/range-slider";
import {
  aParametros,
  calcular,
  estadoInicial,
  ID_DE_LA_CALCULADORA,
  SECTORES_DE_LA_CALCULADORA,
  TAMANOS_DE_EQUIPO,
  type Estado,
  type IdSector,
} from "@/components/herramientas/calculo-de-llamadas-perdidas";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * La calculadora de llamadas perdidas en pequeño, para la portada (entre los
 * sectores y el precio) y para cada landing de sector (justo antes del
 * precio). La cuenta es la de /herramientas/calculadora-de-llamadas-perdidas
 * (`calcular` en calculo-de-llamadas-perdidas.ts), no otra: aquí solo se
 * tocan las llamadas, el precio de la cita y el tamaño del equipo, y el resto
 * de supuestos se ven en «De dónde sale la cuenta» y se cambian en la
 * completa, que abre con estos números ya puestos.
 *
 * Nunca dice «pierdes X»: son los números de quien la usa, con los
 * supuestos a la vista.
 *
 * En la portada lleva un selector de oficio (cambia el precio de partida) y
 * el morado de la marca; en un sector, el oficio fijo y su acento.
 */

const EUROS = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const EUROS_CON_DECIMALES = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

/** «45 €» si es redondo; «12,60 €» si lleva céntimos. */
function euros(cantidad: number) {
  return Number.isInteger(cantidad)
    ? EUROS.format(cantidad)
    : EUROS_CON_DECIMALES.format(cantidad);
}
const UN_DECIMAL = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

/** Los deslizadores van por debajo de los límites de la completa: es lo que
 * cabe en un vistazo; quien no coge más de 60 a la semana usa la completa. */
const LLAMADAS = { min: 0, max: 60, paso: 1 };
const TICKET = { min: 10, max: 200, paso: 5 };

/** Sin sector, el acento de la marca, en tokens. */
const MORADO: CSSProperties = {
  ["--acento" as string]: "rgb(var(--morado))",
  ["--acento-suave" as string]: "rgb(var(--lavado))",
  ["--acento-tinta" as string]: "rgb(var(--morado-tinta))",
};

type Sector = Pick<SectorLanding, "slug" | "paraQuien" | "clientes" | "acento">;

export function CalculadoraCompacta({ sector }: { sector?: Sector }) {
  const [estado, setEstado] = useState<Estado>(() =>
    estadoInicial(sector ? ID_DE_LA_CALCULADORA[sector.slug] : "peluqueria")
  );
  const idOficio = useId();
  const idLlamadas = useId();
  const idTicket = useId();
  const grupoEquipo = useId();

  const r = calcular(estado);
  const llamadas = acotar(Number(estado.llamadas), LLAMADAS);
  const ticket = acotar(Number(estado.ticket), TICKET);
  const nombreDelOficio = (
    SECTORES_DE_LA_CALCULADORA.find((s) => s.id === estado.sector)?.nombre ?? ""
  ).toLocaleLowerCase("es-ES");

  const cambiar = (cambios: Partial<Estado>) =>
    setEstado((antes) => ({ ...antes, ...cambios }));
  const cambiarOficio = (id: IdSector) => {
    const base = estadoInicial(id);
    cambiar({ sector: id, ticket: base.ticket, visitas: base.visitas });
  };

  const planHref = r.recomendado
    ? `/planes?plan=${r.recomendado.plan.id}${
        sector ? `&niche=${encodeURIComponent(sector.slug)}` : ""
      }`
    : "/planes";
  const completaHref = `/herramientas/calculadora-de-llamadas-perdidas?${aParametros(estado)}`;
  const estilo: CSSProperties = sector
    ? {
        ["--acento" as string]: sector.acento.strong,
        ["--acento-suave" as string]: sector.acento.soft,
        ["--acento-tinta" as string]: sector.acento.deep,
      }
    : MORADO;

  return (
    <section
      id="cuenta"
      aria-labelledby="cuenta-titulo"
      className="scroll-m-20 py-14 sm:py-20 lg:py-24"
      style={estilo}
    >
      <div
        className={`mx-auto px-4 sm:px-6 lg:px-8 ${
          sector ? "max-w-6xl" : "max-w-7xl"
        }`}
      >
        <div className="max-w-2xl">
          <h2
            id="cuenta-titulo"
            className="text-balance text-3xl font-black leading-[1.1] tracking-[-0.02em] text-tinta sm:text-4xl"
          >
            ¿Cuánto me cuestan las llamadas que no cojo?
          </h2>
          <p className="mt-4 text-lg leading-8 text-apagado">
            {sector
              ? `El precio de partida es orientativo para ${sector.paraQuien}: cámbialo por el tuyo.`
              : "Pon tus números; el precio de partida es orientativo, cámbialo por el tuyo."}
          </p>
        </div>

        {/* Un solo panel partido, sin tarjeta dentro de tarjeta: los números
            y los supuestos a la izquierda, la cuenta en negro a sangre a la
            derecha (en el móvil, la cuenta justo debajo de los números y los
            supuestos al final). */}
        <div className="mt-8 grid overflow-hidden rounded-3xl border border-linea bg-superficie sm:mt-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:grid-rows-[auto_1fr]">
          <div className="p-5 sm:p-6 lg:col-start-1 lg:row-start-1 lg:p-7 lg:pb-2">
            <form
              className="grid gap-6"
              onSubmit={(e) => e.preventDefault()}
              aria-label="Tus números"
            >
              <div
                className={`grid gap-5 ${sector ? "" : "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"}`}
              >
                {sector ? null : (
                  <div>
                    <label
                      htmlFor={idOficio}
                      className="text-sm font-semibold leading-5 text-tinta-2"
                    >
                      Tu oficio
                    </label>
                    <select
                      id={idOficio}
                      className="field mt-2 w-full"
                      value={estado.sector}
                      onChange={(e) =>
                        cambiarOficio(e.target.value as IdSector)
                      }
                    >
                      {SECTORES_DE_LA_CALCULADORA.map(({ id, nombre }) => (
                        <option key={id} value={id}>
                          {nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <fieldset>
                  <legend className="text-sm font-semibold leading-5 text-tinta-2">
                    ¿Cuántos sois?
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TAMANOS_DE_EQUIPO.map((tramo) => (
                      <label
                        key={tramo.etiqueta}
                        className="relative inline-flex h-11 cursor-pointer select-none items-center rounded-full border border-linea bg-superficie px-4 text-sm font-semibold text-tinta-2 transition duration-200 hover:bg-relleno has-[:checked]:border-[color:color-mix(in_srgb,var(--acento)_35%,transparent)] has-[:checked]:bg-[color:var(--acento-suave)] has-[:checked]:text-[color:var(--acento-tinta)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--acento)] has-[:focus-visible]:ring-offset-2"
                      >
                        <input
                          type="radio"
                          name={grupoEquipo}
                          value={tramo.profesionales}
                          checked={estado.profesionales === tramo.profesionales}
                          onChange={() =>
                            cambiar({ profesionales: tramo.profesionales })
                          }
                          aria-label={tramo.nombre}
                          className="sr-only"
                        />
                        <span aria-hidden="true">{tramo.etiqueta}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 sm:gap-5">
                <RangeSlider
                  id={idLlamadas}
                  label="Llamadas que no coges a la semana"
                  value={llamadas}
                  min={LLAMADAS.min}
                  max={LLAMADAS.max}
                  step={LLAMADAS.paso}
                  onChange={(v) => cambiar({ llamadas: String(v) })}
                  ariaValueText={`${llamadas} llamadas a la semana`}
                  displayValue={String(llamadas)}
                  minLabel={String(LLAMADAS.min)}
                  maxLabel={String(LLAMADAS.max)}
                  hint="Cuéntalas una semana en el registro de llamadas del móvil."
                  accent={sector?.acento}
                  bare
                  compact
                />
                <RangeSlider
                  id={idTicket}
                  label="Precio medio de una cita"
                  value={ticket}
                  min={TICKET.min}
                  max={TICKET.max}
                  step={TICKET.paso}
                  onChange={(v) => cambiar({ ticket: String(v) })}
                  ariaValueText={`${ticket} euros`}
                  displayValue={EUROS.format(ticket)}
                  minLabel={EUROS.format(TICKET.min)}
                  maxLabel={EUROS.format(TICKET.max)}
                  hint={
                    sector
                      ? `Sin IVA. Lo que cobras de media por una cita de ${nombreDelOficio}.`
                      : "Sin IVA."
                  }
                  accent={sector?.acento}
                  bare
                  compact
                />
              </div>
            </form>
          </div>

          <div className="flex flex-col bg-oscuro p-6 text-white sm:p-7 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:justify-center lg:p-8">
            {llamadas > 0 ? (
              <div>
                <p aria-live="polite" aria-atomic="true">
                  <span className="block text-sm text-white/70">
                    Con estos números, unos
                  </span>{" "}
                  <span className="mt-1 block text-5xl font-black tabular-nums tracking-[-0.03em] text-white sm:text-6xl">
                    {EUROS.format(r.perdidaAlMes)}{" "}
                    <span className="ml-1 text-lg font-semibold tracking-normal text-white/70">
                      al mes
                    </span>
                  </span>{" "}
                  <span className="mt-2 block text-base leading-6 text-white/85">
                    en citas que acaban en otro sitio.
                  </span>
                </p>
                <p className="mt-2 text-sm leading-6 tabular-nums text-white/70">
                  Son unas {UN_DECIMAL.format(r.citasAlMes)} citas al mes, a{" "}
                  {EUROS.format(ticket)} cada una.
                </p>
              </div>
            ) : (
              <p
                className="text-base leading-7 text-white/85"
                aria-live="polite"
              >
                Pon cuántas llamadas no coges para ver la cuenta.
              </p>
            )}

            <div className="mt-6 border-t border-white/10 pt-6">
              {r.recomendado ? (
                <p className="text-base font-semibold leading-6 tabular-nums text-white">
                  {lineaDelPlan(r)}
                </p>
              ) : null}
              <div className="mt-5 flex flex-col items-start gap-2">
                <Link
                  href={planHref}
                  className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[color:var(--acento-suave)] px-6 text-sm font-semibold text-[color:var(--acento-tinta)] transition duration-200 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-oscuro sm:w-auto"
                  data-evento="clic_probar"
                  data-ubicacion={
                    sector ? "sector_calculadora" : "portada_calculadora"
                  }
                >
                  Probar 7 días gratis
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <p className="text-xs leading-5 text-white/60">
                  Sin permanencia. Cancela cuando quieras.
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 pb-3 pt-3 sm:px-6 lg:col-start-1 lg:row-start-2 lg:self-end lg:px-7 lg:pb-4 lg:pt-0">
            <div className="border-t border-linea pt-1">
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-[10px] text-sm font-semibold text-tinta-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--acento)] [&::-webkit-details-marker]:hidden">
                  De dónde sale la cuenta
                  <Plus
                    className="h-4 w-4 shrink-0 text-[color:var(--acento)] transition-transform duration-200 group-open:rotate-45"
                    aria-hidden="true"
                  />
                </summary>
                <p className="pb-2 text-sm leading-6 text-apagado">
                  De partida contamos que el {estado.cita} % de las llamadas que
                  no coges{sector ? ` a tus ${sector.clientes}` : ""} eran para
                  pedir cita y que el {estado.otro} % de esas acaba reservando
                  en otro negocio. Es un supuesto para que lo cambies, no una
                  estadística. Para elegir plan, {estado.duracion} minutos por
                  llamada.
                </p>
              </details>
              <Link
                href={completaHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-[10px] text-sm font-medium text-apagado underline decoration-linea-fuerte underline-offset-4 transition hover:text-tinta hover:decoration-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--acento)]"
              >
                Ajusta los supuestos en la calculadora completa
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function acotar(n: number, { min, max }: { min: number; max: number }) {
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

/**
 * «Inicio cuesta 59 € + IVA al mes: se paga con 2 de esas citas.» Si hacen
 * falta más citas de las que se van, no se dice «de esas»: sería prometer
 * con citas que no existen.
 */
export function lineaDelPlan(r: ReturnType<typeof calcular>): string {
  const recomendado = r.recomendado;
  if (!recomendado) return "";
  const n = r.citasParaCubrirlo ?? 0;
  const extra =
    recomendado.minutosExtra > 0
      ? ` y ${euros(
          Math.round(
            recomendado.minutosExtra * recomendado.plan.extraPerMinute * 100
          ) / 100
        )} en minutos extra`
      : "";
  const base = `${recomendado.plan.name} cuesta ${EUROS.format(
    recomendado.plan.price
  )} + IVA al mes${extra}`;
  if (n > r.citasAlMes) {
    return `${base}, lo que cobras por ${n === 1 ? "una cita" : `${n} citas`}.`;
  }
  if (n === 1) return `${base}: se paga con una sola de esas citas.`;
  return `${base}: se paga con ${n} de esas citas.`;
}
