"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { BotonCopiar, useHayJavascript } from "@/components/herramientas/boton-copiar";
import {
  aParametros,
  calcular,
  estadoInicial,
  LIMITES,
  leerDeLaUrl,
  SECTORES_DE_LA_CALCULADORA,
  type Campo,
  type Estado,
  type IdSector,
} from "@/components/herramientas/calculo-de-llamadas-perdidas";

/**
 * Calculadora de /herramientas/calculadora-de-llamadas-perdidas.
 *
 * No es la de las landings (revenue-loss-calculator.tsx, dos deslizadores y
 * «citas perdidas» a ojo): aquí la cuenta parte de las llamadas sin coger y
 * separa las dos incertidumbres que la gente suele mezclar (cuántas eran
 * para pedir cita y cuántas acabaron en otro sitio). La página explica el
 * método; aquí solo vive la cuenta.
 *
 * «Copiar enlace» mete las cifras en la URL (`?ticket=45&llamadas=10…`)
 * para guardarlas o mandarlas a un socio, y al abrir ese enlace se leen con
 * `useSyncExternalStore` (vacío en el servidor): el HTML estático sale con
 * los valores de partida y el cálculo ya hecho, también sin JavaScript.
 */

const EUROS = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const EUROS_CON_DECIMALES = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const UN_DECIMAL = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
const ENTERO = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

const suscribirAUrl = (aviso: () => void) => {
  window.addEventListener("popstate", aviso);
  return () => window.removeEventListener("popstate", aviso);
};

export function CalculadoraLlamadasPerdidas() {
  const hayJs = useHayJavascript();
  const busqueda = useSyncExternalStore(
    suscribirAUrl,
    () => window.location.search,
    () => ""
  );
  const [propio, setPropio] = useState<Estado | null>(null);
  const estado = propio ?? leerDeLaUrl(busqueda) ?? estadoInicial();
  const r = calcular(estado);
  const parametros = aParametros(estado);

  // La URL no se toca al escribir: con cada replaceState la analítica
  // registraría una visita nueva con las cifras dentro. Solo viajan en el
  // enlace que el usuario copia a propósito.
  const actualizar = (nuevo: Estado) => setPropio(nuevo);
  const cambiarCampo = (campo: Campo, valor: string) => actualizar({ ...estado, [campo]: valor });
  const cambiarSector = (sector: IdSector) => {
    const base = estadoInicial(sector);
    actualizar({ ...estado, sector, ticket: base.ticket, visitas: base.visitas });
  };

  const enlace = hayJs ? `${window.location.origin}${window.location.pathname}?${parametros}` : "";
  const idSector = useId();
  const idRecurrencia = useId();

  return (
    <div className="panel grid overflow-hidden p-2 sm:p-3 lg:grid-cols-[1.05fr_0.95fr]">
      <form className="p-4 sm:p-6" onSubmit={(e) => e.preventDefault()} aria-label="Datos de tu negocio">
        <div>
          <label htmlFor={idSector} className="text-sm font-semibold text-tinta">
            Tu sector
          </label>
          <select
            id={idSector}
            className="field mt-2 w-full"
            value={estado.sector}
            onChange={(e) => cambiarSector(e.target.value as IdSector)}
          >
            {SECTORES_DE_LA_CALCULADORA.map(({ id, nombre }) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs leading-5 text-muted">Pone un ticket y unas visitas al año de partida. Cámbialos por los tuyos.</p>
        </div>

        <fieldset className="mt-6 space-y-5 rounded-2xl border border-linea bg-relleno p-4 sm:p-5">
          <legend className="px-1 text-sm font-bold text-tinta">Las llamadas</legend>
          <CampoNumerico
            campo="llamadas"
            etiqueta="Llamadas que no coges a la semana"
            ayuda="Cuéntalas una semana en el registro de llamadas del móvil o del fijo."
            estado={estado}
            onCambio={cambiarCampo}
          />
          <CampoNumerico
            campo="cita"
            etiqueta="De esas, cuántas eran para pedir cita"
            ayuda="El resto: proveedores, publicidad, preguntas sueltas."
            sufijo="%"
            estado={estado}
            onCambio={cambiarCampo}
          />
          <CampoNumerico
            campo="otro"
            etiqueta="De las de cita, cuántas acaban reservando en otro sitio"
            ayuda="Las demás vuelven a llamar o te escriben. Es la cifra más incierta: prueba con 20 y con 50."
            sufijo="%"
            estado={estado}
            onCambio={cambiarCampo}
          />
          <CampoNumerico
            campo="ticket"
            etiqueta="Ticket medio de una cita"
            ayuda="Lo que factura de media una cita, sin IVA."
            sufijo="€"
            estado={estado}
            onCambio={cambiarCampo}
          />
        </fieldset>

        <fieldset className="mt-4 rounded-2xl border border-linea p-4 sm:p-5">
          <legend className="px-1 text-sm font-bold text-tinta">Las visitas que no vuelven (opcional)</legend>
          <div className="flex items-start gap-3">
            <input
              id={idRecurrencia}
              type="checkbox"
              checked={estado.recurrencia}
              onChange={(e) => actualizar({ ...estado, recurrencia: e.target.checked })}
              className="mt-1 h-4 w-4 accent-morado"
            />
            <label htmlFor={idRecurrencia} className="text-sm leading-6 text-tinta">
              Contar también las visitas siguientes de quien se queda en el otro negocio
            </label>
          </div>
          {estado.recurrencia ? (
            <div className="mt-4 space-y-5">
              <CampoNumerico
                campo="visitas"
                etiqueta="Visitas al año de un cliente habitual"
                estado={estado}
                onCambio={cambiarCampo}
              />
              <CampoNumerico
                campo="novuelve"
                etiqueta="De los que reservan fuera, cuántos ya no vuelven"
                sufijo="%"
                estado={estado}
                onCambio={cambiarCampo}
              />
            </div>
          ) : null}
        </fieldset>

        <fieldset className="mt-4 space-y-5 rounded-2xl border border-linea p-4 sm:p-5">
          <legend className="px-1 text-sm font-bold text-tinta">Para elegir plan</legend>
          <CampoNumerico
            campo="duracion"
            etiqueta="Minutos que dura una llamada para pedir cita"
            sufijo="min"
            estado={estado}
            onCambio={cambiarCampo}
          />
          <CampoNumerico campo="profesionales" etiqueta="Profesionales en tu agenda" estado={estado} onCambio={cambiarCampo} />
        </fieldset>
      </form>

      <section className="flex flex-col rounded-3xl bg-oscuro p-6 text-white sm:p-8" aria-labelledby="resultado-calculadora">
        <h3 id="resultado-calculadora" className="text-sm font-semibold text-white/70">
          Lo que se va por no coger el teléfono
        </h3>
        <p className="mt-3 text-5xl font-black tabular-nums tracking-[-0.03em] text-morado-claro" aria-live="polite">
          {EUROS.format(r.perdidaAlMes)}
          <span className="ml-2 text-lg font-semibold text-white/70">al mes</span>
        </p>
        <p className="mt-2 text-base tabular-nums text-white/80">{EUROS.format(r.perdidaAlAno)} al año</p>
        {estado.recurrencia ? (
          <p className="mt-2 text-sm leading-6 tabular-nums text-white/80">
            {EUROS.format(r.perdidaConRecurrencia)} al año contando las visitas de quien ya no vuelve
          </p>
        ) : null}

        <dl className="mt-6 grid gap-3 border-t border-white/10 pt-6 text-sm">
          <Linea termino="Llamadas sin coger al mes">{UN_DECIMAL.format(r.llamadasAlMes)}</Linea>
          <Linea termino="Citas que acaban en otro sitio">{UN_DECIMAL.format(r.citasAlMes)} al mes</Linea>
          <Linea termino="Minutos que atendería la recepcionista">{ENTERO.format(r.minutosAlMes)} al mes</Linea>
        </dl>

        {r.recomendado ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold text-white">
              Plan que lo cubriría: {r.recomendado.plan.name}, {EUROS.format(r.recomendado.plan.price)} al mes sin IVA
              {r.recomendado.minutosExtra > 0
                ? ` más ${ENTERO.format(r.recomendado.minutosExtra)} minutos extra (${EUROS_CON_DECIMALES.format(r.recomendado.minutosExtra * r.recomendado.plan.extraPerMinute)})`
                : ""}
              .
            </p>
            <p className="mt-1 text-sm leading-6 text-white/70">
              Incluye {ENTERO.format(r.recomendado.plan.minutes)} minutos.{" "}
              {r.citasParaCubrirlo !== null
                ? `Se paga con ${r.citasParaCubrirlo} ${r.citasParaCubrirlo === 1 ? "cita recuperada" : "citas recuperadas"} al mes.`
                : null}
            </p>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-3 pt-8 sm:flex-row sm:items-center">
          <Link href="/planes" className="btn-purple" data-evento="clic_probar" data-ubicacion="calculadora_llamadas_resultado">
            Ver los planes <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {hayJs ? <BotonCopiar texto={enlace} etiqueta="el enlace con tus cifras" className="[&_button]:h-12 [&_button]:px-4 [&_button]:text-sm" /> : null}
        </div>
        <p className="mt-3 text-xs leading-5 text-white/60">
          Estimación orientativa. Tus cifras no salen de tu navegador; si copias el enlace, van dentro de él.
        </p>
      </section>
    </div>
  );
}

function Linea({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-white/70">{termino}</dt>
      <dd className="font-semibold tabular-nums text-white">{children}</dd>
    </div>
  );
}

function CampoNumerico({
  campo,
  etiqueta,
  ayuda,
  sufijo,
  estado,
  onCambio,
}: {
  campo: Campo;
  etiqueta: string;
  ayuda?: string;
  sufijo?: string;
  estado: Estado;
  onCambio: (campo: Campo, valor: string) => void;
}) {
  const id = useId();
  const { min, max, paso } = LIMITES[campo];
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-tinta">
        {etiqueta}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={paso}
          value={estado[campo]}
          onChange={(e) => onCambio(campo, e.target.value)}
          aria-describedby={ayuda ? `${id}-ayuda` : undefined}
          className="field w-28 tabular-nums"
        />
        {sufijo ? <span className="text-sm text-muted">{sufijo}</span> : null}
      </div>
      {ayuda ? (
        <p id={`${id}-ayuda`} className="mt-1.5 text-xs leading-5 text-muted">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}
