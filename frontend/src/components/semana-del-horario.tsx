"use client";

import { Copy, Plus, X } from "lucide-react";
import { DIAS_DEL_HORARIO, errorDeTramos } from "@/lib/horario";
import type { BusinessSchedule, ScheduleDay, WeekDay } from "@/lib/types";
import { Interruptor } from "@/components/movil/piezas";

function resumenDelDia(dia: ScheduleDay) {
  if (!dia.enabled) return "Cerrado";
  return dia.intervals.map((tramo) => `${tramo.start}–${tramo.end}`).join(" · ");
}

/** Cuántos días abiertos tienen tramos que el backend rechazaría. */
export function diasConErrores(horario: BusinessSchedule) {
  return DIAS_DEL_HORARIO.filter(({ key }) => errorDeTramos(horario.week[key])).length;
}

/**
 * La semana del horario, controlada: una tarjeta por día con su interruptor y
 * el selector de hora nativo, «Copiar el lunes a martes–viernes» y el error
 * de cada día bajo él. No guarda nada: lo usan Agente › Horario (que guarda
 * con su barra) y el alta del negocio (que guarda con el resto de datos).
 */
export function SemanaDelHorario({
  horario,
  onCambiar,
  zonaHoraria,
  claseDelDia = "panel",
}: {
  horario: BusinessSchedule;
  onCambiar: (cambio: (actual: BusinessSchedule) => BusinessSchedule) => void;
  zonaHoraria?: string;
  /** El marco de cada día: `panel` en Agente; en el alta, que ya va dentro de
   * un panel, una tarjeta más ligera. */
  claseDelDia?: string;
}) {
  const cambiarDia = (clave: WeekDay, cambio: (dia: ScheduleDay) => ScheduleDay) =>
    onCambiar((actual) => ({ ...actual, week: { ...actual.week, [clave]: cambio(actual.week[clave]) } }));

  const copiarLunes = () =>
    onCambiar((actual) => {
      const semana = { ...actual.week };
      for (const clave of ["tuesday", "wednesday", "thursday", "friday"] as const) {
        semana[clave] = { enabled: actual.week.monday.enabled, intervals: actual.week.monday.intervals.map((tramo) => ({ ...tramo })) };
      }
      return { ...actual, week: semana };
    });

  return (
    <div className="flex flex-col gap-2.5">
      <button type="button" onClick={copiarLunes} className="btn-secondary w-full">
        <Copy className="h-[18px] w-[18px]" aria-hidden="true" />
        Copiar el lunes a martes–viernes
      </button>
      {zonaHoraria ? <p className="mx-1 my-0.5 text-[13px] text-muted">Zona horaria: {zonaHoraria}</p> : null}

      {DIAS_DEL_HORARIO.map(({ key, nombre }) => {
        const dia = horario.week[key];
        const error = errorDeTramos(dia);
        return (
          <section key={key} className={`${claseDelDia} py-0.5 pl-4 pr-3`} aria-label={nombre}>
            <div className="flex min-h-[60px] items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-tinta">{nombre}</p>
                <p className="mt-px text-sm tabular-nums text-muted">{resumenDelDia(dia)}</p>
              </div>
              <Interruptor
                activo={dia.enabled}
                etiqueta={`${nombre} abierto`}
                onCambiar={(abierto) =>
                  cambiarDia(key, (actual) => ({
                    enabled: abierto,
                    intervals: abierto && actual.intervals.length === 0 ? [{ start: "09:00", end: "14:00" }] : actual.intervals,
                  }))
                }
              />
            </div>
            {dia.enabled ? (
              <div className="flex flex-col gap-2 pb-3">
                {dia.intervals.map((tramo, indice) => (
                  <div key={indice} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={tramo.start}
                      aria-label={`${nombre}, apertura del tramo ${indice + 1}`}
                      aria-invalid={Boolean(error)}
                      onChange={(evento) =>
                        cambiarDia(key, (actual) => ({
                          ...actual,
                          intervals: actual.intervals.map((t, i) => (i === indice ? { ...t, start: evento.target.value } : t)),
                        }))
                      }
                      className="field min-w-0 flex-1 px-1.5 text-center text-[15px] tabular-nums"
                    />
                    <span className="shrink-0 text-sm text-muted">a</span>
                    <input
                      type="time"
                      value={tramo.end}
                      aria-label={`${nombre}, cierre del tramo ${indice + 1}`}
                      aria-invalid={Boolean(error)}
                      onChange={(evento) =>
                        cambiarDia(key, (actual) => ({
                          ...actual,
                          intervals: actual.intervals.map((t, i) => (i === indice ? { ...t, end: evento.target.value } : t)),
                        }))
                      }
                      className="field min-w-0 flex-1 px-1.5 text-center text-[15px] tabular-nums"
                    />
                    {dia.intervals.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => cambiarDia(key, (actual) => ({ ...actual, intervals: actual.intervals.filter((_, i) => i !== indice) }))}
                        aria-label={`Quitar el tramo ${indice + 1} del ${nombre.toLowerCase()}`}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-apagado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
                      >
                        <X className="h-[18px] w-[18px]" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                ))}
                {error ? (
                  <p role="alert" className="text-[13px] leading-[1.45] text-error">
                    {error}
                  </p>
                ) : null}
                {dia.intervals.length < 3 ? (
                  <button
                    type="button"
                    onClick={() =>
                      cambiarDia(key, (actual) => {
                        const ultimo = actual.intervals[actual.intervals.length - 1];
                        const inicio = ultimo?.end ?? "09:00";
                        const [h, m] = inicio.split(":").map(Number);
                        const fin = Math.min(h * 60 + m + 120, 23 * 60 + 30);
                        const finTexto = `${String(Math.floor(fin / 60)).padStart(2, "0")}:${String(fin % 60).padStart(2, "0")}`;
                        return { ...actual, intervals: [...actual.intervals, { start: inicio, end: finTexto }] };
                      })
                    }
                    className="flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-morado-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Añadir tramo
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
