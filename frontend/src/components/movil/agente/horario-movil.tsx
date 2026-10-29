"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarX2, Plus, Trash2 } from "lucide-react";
import { updateMyBusiness } from "@/lib/api";
import type { Business, BusinessSchedule } from "@/lib/types";
import { AvisoFlotante, useAviso } from "@/components/aviso-flotante";
import {
  DEFAULT_BUSINESS_SCHEDULE,
  formatExceptionDate,
  isBusinessSchedule,
  localDateString,
  upcomingExceptions,
} from "@/components/business-hours-editor";
import { AzulejoIcono, BarraGuardar } from "@/components/movil/piezas";
import { SemanaDelHorario, diasConErrores } from "@/components/semana-del-horario";
import { PantallaDeAjuste } from "@/components/movil/agente/pantalla-de-ajuste";

function clonar(horario: BusinessSchedule): BusinessSchedule {
  return JSON.parse(JSON.stringify(horario)) as BusinessSchedule;
}

/**
 * Horario en el móvil: una tarjeta por día con su interruptor y el selector
 * de hora nativo, «Copiar el lunes a martes–viernes» y los días cerrados.
 * Los errores se explican bajo el día y Guardar solo aparece con cambios.
 */
export function HorarioMovil({ business }: { business: Business }) {
  const queryClient = useQueryClient();
  const { aviso, avisar, cerrar } = useAviso();
  // Por contenido y no por objeto: el negocio se vuelve a pedir al volver a
  // la app, y un objeto nuevo con el mismo horario borraría lo que el dueño
  // estaba editando si mira otra cosa a mitad.
  const firmaGuardada = JSON.stringify(isBusinessSchedule(business.schedule) ? business.schedule : DEFAULT_BUSINESS_SCHEDULE);
  const guardado = useMemo(() => clonar(JSON.parse(firmaGuardada) as BusinessSchedule), [firmaGuardada]);
  const [horario, setHorario] = useState(guardado);
  useEffect(() => setHorario(guardado), [guardado]);

  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevoMotivo, setNuevoMotivo] = useState("");
  const [errorExcepcion, setErrorExcepcion] = useState<string | null>(null);

  const cambiado = JSON.stringify(horario) !== JSON.stringify(guardado);
  const errores = diasConErrores(horario);

  const guardar = useMutation({
    mutationFn: (nuevo: BusinessSchedule) => updateMyBusiness({ schedule: nuevo }),
    onSuccess: async (negocio) => {
      queryClient.setQueryData(["my-business"], negocio);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["booking-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["onboarding-state"] }),
      ]);
      avisar("Horario guardado y sincronizado con el agente.");
    },
    onError: () => avisar("No se pudo guardar. Revisa que los tramos no se solapen y que la apertura sea anterior al cierre.", "error"),
  });

  const añadirDiaCerrado = () => {
    if (!nuevaFecha) return setErrorExcepcion("Elige la fecha que quieres cerrar.");
    if (nuevaFecha < localDateString(new Date())) return setErrorExcepcion("Esa fecha ya ha pasado.");
    if ((horario.exceptions ?? []).some((dia) => dia.date === nuevaFecha)) return setErrorExcepcion("Ese día ya está en la lista.");
    setErrorExcepcion(null);
    setHorario((actual) => ({
      ...actual,
      exceptions: [
        ...(actual.exceptions ?? []),
        { date: nuevaFecha, closed: true, intervals: [], ...(nuevoMotivo.trim() ? { label: nuevoMotivo.trim() } : {}) },
      ],
    }));
    setNuevaFecha("");
    setNuevoMotivo("");
  };

  const excepciones = upcomingExceptions(horario);

  return (
    <PantallaDeAjuste
      titulo="Horario del negocio"
      subtitulo="El agente comprueba estos tramos antes de ofrecer o confirmar una cita."
    >
      <SemanaDelHorario
        horario={horario}
        onCambiar={setHorario}
        zonaHoraria={business.timezone || "Europe/Madrid"}
      />

      {/* Días sueltos que no siguen el horario semanal: sin ellos, el agente
          daba por abierto un festivo por ser jueves. */}
      <section className="mt-6" aria-labelledby="dias-cerrados">
        <div className="flex items-start gap-3">
          <AzulejoIcono icono={CalendarX2} />
          <div className="min-w-0">
            <h2 id="dias-cerrados" className="text-base font-bold text-tinta">
              Festivos y días cerrados
            </h2>
            <p className="mt-0.5 text-sm leading-6 text-muted">El agente no ofrecerá ni confirmará citas en esas fechas.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          <label className="text-sm font-semibold text-tinta-2">
            Fecha
            <input
              type="date"
              value={nuevaFecha}
              min={localDateString(new Date())}
              onChange={(evento) => setNuevaFecha(evento.target.value)}
              className="field mt-2 block w-full text-base font-normal"
            />
          </label>
          <label className="text-sm font-semibold text-tinta-2">
            Motivo (opcional)
            <input
              type="text"
              value={nuevoMotivo}
              maxLength={60}
              placeholder="Vacaciones, festivo local…"
              onChange={(evento) => setNuevoMotivo(evento.target.value)}
              className="field mt-2 block w-full text-base font-normal"
            />
          </label>
          {errorExcepcion ? (
            <p role="alert" className="text-sm text-error">
              {errorExcepcion}
            </p>
          ) : null}
          <button type="button" onClick={añadirDiaCerrado} className="btn-secondary w-full">
            <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
            Añadir día cerrado
          </button>
        </div>
        {excepciones.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {excepciones.map((excepcion) => (
              <li key={excepcion.date} className="flex items-center gap-3 rounded-2xl border border-linea bg-superficie py-2 pl-4 pr-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-tinta-2">{formatExceptionDate(excepcion.date)}</span>
                  <span className="block text-xs text-muted">
                    {excepcion.closed
                      ? excepcion.label || "Cerrado todo el día"
                      : excepcion.intervals.map((tramo) => `${tramo.start}–${tramo.end}`).join(" · ")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setHorario((actual) => ({
                      ...actual,
                      exceptions: (actual.exceptions ?? []).filter((dia) => dia.date !== excepcion.date),
                    }))
                  }
                  aria-label={`Quitar el día cerrado del ${formatExceptionDate(excepcion.date)}`}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <BarraGuardar
        visible={cambiado}
        etiqueta="Guardar horario"
        guardando={guardar.isPending}
        deshabilitado={errores > 0}
        onGuardar={() => guardar.mutate(horario)}
        onDescartar={() => {
          setHorario(guardado);
          setErrorExcepcion(null);
        }}
      />
      {aviso ? <AvisoFlotante aviso={aviso} onClose={cerrar} /> : null}
    </PantallaDeAjuste>
  );
}
