"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { bloquearHoras, crearCita, marcarAusencia } from "@/lib/api";
import { claveDeDia } from "@/lib/fechas-negocio";
import type { BookingProfessional, BookingService, BusinessSchedule, ResultadoDeNuevaCita } from "@/lib/types";
import { horasPosibles } from "@/components/escritorio/agenda/detalle-de-cita";
import { invalidarAgenda, mensajeDeLaRespuesta } from "@/components/escritorio/agenda/acciones-de-cita";

export type PestanaDeCreacion = "cita" | "bloqueo" | "ausencia";

const PESTANAS: Array<{ valor: PestanaDeCreacion; texto: string }> = [
  { valor: "cita", texto: "Nueva cita" },
  { valor: "bloqueo", texto: "Bloquear horas" },
  { valor: "ausencia", texto: "Ausencia" },
];

export type HechoEnLaAgenda = {
  mensaje: string;
  /** Día al que debe saltar la agenda. */
  dia: string;
  citaId?: string;
};

/**
 * «Nueva cita», «Bloquear horas» y «Ausencia» desde la agenda
 * (PLAN-AGENDA-ALHABLA.md, fase 2). Sin «Nueva cita», la agenda de Alhabla
 * acaba en dobles reservas: el dueño necesita apuntar lo que le entra por
 * otros canales. Son las acciones del Gestor por detrás, con las mismas
 * comprobaciones; el hueco de la cita se comprueba antes de dejar guardar,
 * como al mover. Lo usan el diálogo de escritorio y la hoja del móvil.
 */
export function FormularioDeCreacion({
  timeZone,
  ahora,
  horario,
  profesionales,
  servicios,
  inicial,
  onHecho,
  onCancelar,
}: {
  timeZone: string;
  ahora: Date;
  horario: BusinessSchedule | null;
  profesionales: BookingProfessional[];
  servicios: BookingService[];
  /** Día (y hora, profesional) con los que abrir el formulario. */
  inicial?: { dia?: string; hora?: string; profesionalId?: string };
  onHecho: (hecho: HechoEnLaAgenda) => void;
  onCancelar: () => void;
}) {
  const [pestana, setPestana] = useState<PestanaDeCreacion>("cita");
  const hoy = claveDeDia(ahora, timeZone);
  const dia = inicial?.dia && inicial.dia >= hoy ? inicial.dia : hoy;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Qué apuntar" className="flex flex-wrap gap-1.5">
        {PESTANAS.map((opcion) => {
          const activa = opcion.valor === pestana;
          return (
            <button
              key={opcion.valor}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setPestana(opcion.valor)}
              className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado ${
                activa ? "border-lavado-borde bg-lavado text-morado-tinta" : "border-linea bg-superficie text-apagado hover:text-tinta"
              }`}
            >
              {opcion.texto}
            </button>
          );
        })}
      </div>
      {pestana === "cita" ? (
        <FormularioDeCita
          timeZone={timeZone}
          hoy={hoy}
          horario={horario}
          profesionales={profesionales}
          servicios={servicios}
          inicial={{ dia, hora: inicial?.hora, profesionalId: inicial?.profesionalId }}
          onHecho={onHecho}
          onCancelar={onCancelar}
        />
      ) : pestana === "bloqueo" ? (
        <FormularioDeBloqueo hoy={hoy} dia={dia} onHecho={onHecho} onCancelar={onCancelar} />
      ) : (
        <FormularioDeAusencia
          hoy={hoy}
          dia={dia}
          profesionales={profesionales}
          inicial={{ profesionalId: inicial?.profesionalId }}
          onHecho={onHecho}
          onCancelar={onCancelar}
        />
      )}
    </div>
  );
}

const CLASE_ETIQUETA = "block text-xs font-semibold text-muted";
const CLASE_CAMPO = "field mt-1 h-11 w-full px-3 text-sm text-tinta";

function Estado({
  cargando,
  error,
  ok,
  neutro,
}: {
  cargando?: boolean;
  error?: string | null;
  ok?: string | null;
  neutro?: string | null;
}) {
  return (
    <p className="flex min-h-6 items-start gap-1.5 text-sm leading-6" role="status">
      {cargando ? (
        <>
          <LoaderCircle className="mt-1 h-4 w-4 shrink-0 animate-spin text-morado" aria-hidden="true" />
          <span className="text-muted">Comprobando…</span>
        </>
      ) : error ? (
        <>
          <TriangleAlert className="mt-1 h-4 w-4 shrink-0 text-error" aria-hidden="true" />
          <span className="text-error">{error}</span>
        </>
      ) : ok ? (
        <>
          <Check className="mt-1 h-4 w-4 shrink-0 text-exito" aria-hidden="true" />
          <span className="font-semibold text-exito">{ok}</span>
        </>
      ) : neutro ? (
        <span className="text-muted">{neutro}</span>
      ) : null}
    </p>
  );
}

function Botones({
  onCancelar,
  guardando,
  deshabilitado,
  texto,
  textoGuardando,
}: {
  onCancelar: () => void;
  guardando: boolean;
  deshabilitado: boolean;
  texto: string;
  textoGuardando: string;
}) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={onCancelar} className="btn-secondary h-11 flex-none px-4">
        Cancelar
      </button>
      <button type="submit" disabled={deshabilitado || guardando} className="btn-primary h-11 flex-1 px-4">
        {guardando ? textoGuardando : texto}
      </button>
    </div>
  );
}

function FormularioDeCita({
  timeZone,
  hoy,
  horario,
  profesionales,
  servicios,
  inicial,
  onHecho,
  onCancelar,
}: {
  timeZone: string;
  hoy: string;
  horario: BusinessSchedule | null;
  profesionales: BookingProfessional[];
  servicios: BookingService[];
  inicial: { dia: string; hora?: string; profesionalId?: string };
  onHecho: (hecho: HechoEnLaAgenda) => void;
  onCancelar: () => void;
}) {
  const queryClient = useQueryClient();
  const activos = useMemo(() => servicios.filter((servicio) => servicio.active), [servicios]);
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [dia, setDia] = useState(inicial.dia);
  const [hora, setHora] = useState(inicial.hora ?? "");
  const [serviciosElegidos, setServiciosElegidos] = useState<string[]>(() =>
    activos.length === 1 ? [activos[0].id] : []
  );
  const [profesionalId, setProfesionalId] = useState(inicial.profesionalId ?? "");

  const duracion = activos
    .filter((servicio) => serviciosElegidos.includes(servicio.id))
    .reduce((total, servicio) => total + servicio.durationMinutes, 0);
  const horas = useMemo(() => horasPosibles(horario, dia, Math.max(duracion, 15)), [horario, dia, duracion]);
  const horaValida = horas.includes(hora) ? hora : null;
  const fechaHora = horaValida ? `${dia}T${horaValida}` : null;
  const nombre = cliente.trim();
  const listo = Boolean(fechaHora && nombre && serviciosElegidos.length > 0);

  // El hueco se comprueba en cuanto hay datos suficientes, como al mover:
  // horario, ausencias, otras citas y el calendario externo si lo hay.
  const hueco = useQuery({
    queryKey: ["hueco-nuevo", fechaHora, serviciosElegidos.join(","), profesionalId],
    queryFn: () =>
      crearCita({
        cliente: nombre || "Cliente",
        fechaHora: fechaHora!,
        servicios: serviciosElegidos,
        profesionalId: profesionalId || undefined,
        soloComprobar: true,
      }),
    enabled: Boolean(fechaHora) && serviciosElegidos.length > 0,
    retry: false,
    staleTime: 15_000,
  });

  const crear = useMutation({
    mutationFn: () =>
      crearCita({
        cliente: nombre,
        telefono: telefono.trim() || undefined,
        fechaHora: fechaHora!,
        servicios: serviciosElegidos,
        profesionalId: profesionalId || undefined,
      }) as Promise<ResultadoDeNuevaCita>,
    onSuccess: async (resultado) => {
      await invalidarAgenda(queryClient);
      onHecho({ mensaje: resultado.mensaje, dia, citaId: resultado.cita?.id });
    },
  });

  const alternar = (id: string) =>
    setServiciosElegidos((actuales) => (actuales.includes(id) ? actuales.filter((otro) => otro !== id) : [...actuales, id]));

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        if (listo && hueco.isSuccess && !crear.isPending) crear.mutate();
      }}
      className="space-y-3"
      aria-label="Nueva cita"
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
        <label className={CLASE_ETIQUETA}>
          Cliente
          <input
            type="text"
            value={cliente}
            onChange={(evento) => setCliente(evento.target.value)}
            placeholder="Nombre"
            autoComplete="off"
            required
            className={CLASE_CAMPO}
          />
        </label>
        <label className={CLASE_ETIQUETA}>
          Móvil (opcional)
          <input
            type="tel"
            value={telefono}
            onChange={(evento) => setTelefono(evento.target.value)}
            placeholder="6xx xxx xxx"
            autoComplete="off"
            className={CLASE_CAMPO}
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold text-muted">Servicios</legend>
        {activos.length === 0 ? (
          <p className="mt-1 text-sm text-aviso">Primero da de alta algún servicio en «Configurar agente».</p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {activos.map((servicio) => {
              const elegido = serviciosElegidos.includes(servicio.id);
              return (
                <button
                  key={servicio.id}
                  type="button"
                  aria-pressed={elegido}
                  onClick={() => alternar(servicio.id)}
                  className={`h-9 rounded-full border px-3 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado ${
                    elegido ? "border-lavado-borde bg-lavado text-morado-tinta" : "border-linea bg-superficie text-tinta-2 hover:text-tinta"
                  }`}
                >
                  {servicio.name} · {servicio.durationMinutes} min
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="grid grid-cols-[1fr_96px] gap-2">
        <label className={CLASE_ETIQUETA}>
          Día
          <input
            type="date"
            value={dia}
            min={hoy}
            onChange={(evento) => evento.target.value && setDia(evento.target.value)}
            className={CLASE_CAMPO}
          />
        </label>
        <label className={CLASE_ETIQUETA}>
          Hora
          <select
            value={horaValida ?? ""}
            onChange={(evento) => setHora(evento.target.value)}
            className="field mt-1 h-11 w-full px-2 text-sm tabular-nums text-tinta"
            disabled={horas.length === 0}
          >
            {horaValida ? null : <option value="">—</option>}
            {horas.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion}
              </option>
            ))}
          </select>
        </label>
      </div>

      {profesionales.length > 1 ? (
        <label className={CLASE_ETIQUETA}>
          Profesional
          <select
            value={profesionalId}
            onChange={(evento) => setProfesionalId(evento.target.value)}
            className="field mt-1 h-11 w-full px-2 text-sm text-tinta"
          >
            <option value="">Quien esté libre</option>
            {profesionales
              .filter((profesional) => profesional.active)
              .map((profesional) => (
                <option key={profesional.id} value={profesional.id}>
                  {profesional.name}
                </option>
              ))}
          </select>
        </label>
      ) : null}

      <Estado
        cargando={hueco.isFetching}
        error={
          crear.isError
            ? mensajeDeLaRespuesta(crear.error, "No se ha podido apuntar la cita. Inténtalo en un rato.")
            : hueco.isError
              ? mensajeDeLaRespuesta(hueco.error, "No se ha podido comprobar ese hueco.")
              : null
        }
        ok={hueco.isSuccess && fechaHora ? `Hueco libre${duracion ? ` (${duracion} min)` : ""}` : null}
        neutro={
          horas.length === 0
            ? "Ese día el negocio está cerrado."
            : serviciosElegidos.length === 0
              ? "Elige al menos un servicio."
              : !horaValida
                ? "Elige la hora."
                : null
        }
      />

      <Botones
        onCancelar={onCancelar}
        guardando={crear.isPending}
        deshabilitado={!listo || !hueco.isSuccess || hueco.isFetching}
        texto={horaValida ? `Apuntar a las ${horaValida}` : "Apuntar"}
        textoGuardando="Apuntando…"
      />
      <p className="text-xs leading-5 text-muted">La cita entra en tu agenda y, si tienes calendario conectado, también en él. Al cliente no se le avisa.</p>
    </form>
  );
}

const HORAS_DEL_DIA = Array.from({ length: 24 * 4 }, (_, indice) => {
  const minutos = indice * 15;
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
});

function SelectorDeHora({
  etiqueta,
  valor,
  onCambiar,
  desde,
}: {
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
  /** Solo horas posteriores a esta. */
  desde?: string;
}) {
  return (
    <label className={CLASE_ETIQUETA}>
      {etiqueta}
      <select
        value={valor}
        onChange={(evento) => onCambiar(evento.target.value)}
        className="field mt-1 h-11 w-full px-2 text-sm tabular-nums text-tinta"
      >
        {HORAS_DEL_DIA.filter((hora) => !desde || hora > desde).map((hora) => (
          <option key={hora} value={hora}>
            {hora}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormularioDeBloqueo({
  hoy,
  dia: diaInicial,
  onHecho,
  onCancelar,
}: {
  hoy: string;
  dia: string;
  onHecho: (hecho: HechoEnLaAgenda) => void;
  onCancelar: () => void;
}) {
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState(diaInicial);
  const [desde, setDesde] = useState("16:00");
  const [hasta, setHasta] = useState("20:00");
  const [motivo, setMotivo] = useState("");
  const valido = desde < hasta;

  const bloquear = useMutation({
    mutationFn: () => bloquearHoras({ fecha, desde, hasta, motivo: motivo.trim() || undefined }),
    onSuccess: async (resultado) => {
      await Promise.all([invalidarAgenda(queryClient), queryClient.invalidateQueries({ queryKey: ["my-business"] })]);
      onHecho({ mensaje: resultado.mensaje ?? "Tramo bloqueado.", dia: fecha });
    },
  });

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        if (valido && !bloquear.isPending) bloquear.mutate();
      }}
      className="space-y-3"
      aria-label="Bloquear horas"
    >
      <p className="text-sm leading-6 text-muted">
        Ese tramo deja de ofrecerse a los clientes ese día (el horario de ese día cambia; las citas ya reservadas se quedan).
      </p>
      <label className={CLASE_ETIQUETA}>
        Día
        <input
          type="date"
          value={fecha}
          min={hoy}
          onChange={(evento) => evento.target.value && setFecha(evento.target.value)}
          className={CLASE_CAMPO}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <SelectorDeHora etiqueta="Desde" valor={desde} onCambiar={setDesde} />
        <SelectorDeHora etiqueta="Hasta" valor={hasta} onCambiar={setHasta} desde={desde} />
      </div>
      <label className={CLASE_ETIQUETA}>
        Motivo (opcional, solo lo ves tú)
        <input
          type="text"
          value={motivo}
          maxLength={60}
          onChange={(evento) => setMotivo(evento.target.value)}
          placeholder="Médico, proveedor…"
          className={CLASE_CAMPO}
        />
      </label>
      <Estado
        error={bloquear.isError ? mensajeDeLaRespuesta(bloquear.error, "No se ha podido bloquear ese tramo.") : null}
        neutro={!valido ? "La hora final tiene que ser posterior a la inicial." : null}
      />
      <Botones
        onCancelar={onCancelar}
        guardando={bloquear.isPending}
        deshabilitado={!valido}
        texto={`Bloquear de ${desde} a ${hasta}`}
        textoGuardando="Bloqueando…"
      />
    </form>
  );
}

function FormularioDeAusencia({
  hoy,
  dia: diaInicial,
  profesionales,
  inicial,
  onHecho,
  onCancelar,
}: {
  hoy: string;
  dia: string;
  profesionales: BookingProfessional[];
  inicial: { profesionalId?: string };
  onHecho: (hecho: HechoEnLaAgenda) => void;
  onCancelar: () => void;
}) {
  const queryClient = useQueryClient();
  const activos = profesionales.filter((profesional) => profesional.active);
  const [profesionalId, setProfesionalId] = useState(inicial.profesionalId ?? activos[0]?.id ?? "");
  const [desde, setDesde] = useState(diaInicial);
  const [hasta, setHasta] = useState(diaInicial);
  const [diaEntero, setDiaEntero] = useState(true);
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [horaFin, setHoraFin] = useState("14:00");
  const [motivo, setMotivo] = useState("");
  const valido = Boolean(profesionalId) && hasta >= desde && (diaEntero || horaInicio < horaFin);

  const marcar = useMutation({
    mutationFn: () =>
      marcarAusencia({
        profesionalId,
        desde,
        hasta: hasta !== desde ? hasta : undefined,
        ...(diaEntero ? {} : { horaInicio, horaFin }),
        motivo: motivo.trim() || undefined,
      }),
    onSuccess: async (resultado) => {
      await Promise.all([invalidarAgenda(queryClient), queryClient.invalidateQueries({ queryKey: ["ausencias"] })]);
      onHecho({ mensaje: resultado.mensaje ?? "Ausencia marcada.", dia: desde });
    },
  });

  if (activos.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-6 text-aviso">Primero añade a alguien del equipo en «Configurar agente».</p>
        <button type="button" onClick={onCancelar} className="btn-secondary h-11 px-4">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        if (valido && !marcar.isPending) marcar.mutate();
      }}
      className="space-y-3"
      aria-label="Marcar ausencia"
    >
      <p className="text-sm leading-6 text-muted">Esa persona no se ofrece en esos días u horas: vacaciones, una baja, una mañana libre.</p>
      <label className={CLASE_ETIQUETA}>
        Quién
        <select
          value={profesionalId}
          onChange={(evento) => setProfesionalId(evento.target.value)}
          className="field mt-1 h-11 w-full px-2 text-sm text-tinta"
        >
          {activos.map((profesional) => (
            <option key={profesional.id} value={profesional.id}>
              {profesional.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className={CLASE_ETIQUETA}>
          Desde
          <input
            type="date"
            value={desde}
            min={hoy}
            onChange={(evento) => {
              if (!evento.target.value) return;
              setDesde(evento.target.value);
              if (hasta < evento.target.value) setHasta(evento.target.value);
            }}
            className={CLASE_CAMPO}
          />
        </label>
        <label className={CLASE_ETIQUETA}>
          Hasta
          <input
            type="date"
            value={hasta}
            min={desde}
            onChange={(evento) => evento.target.value && setHasta(evento.target.value)}
            className={CLASE_CAMPO}
          />
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm text-tinta">
        <input type="checkbox" checked={diaEntero} onChange={(evento) => setDiaEntero(evento.target.checked)} className="h-4 w-4 accent-[#8b5cf6]" />
        Todo el día
      </label>
      {!diaEntero ? (
        <div className="grid grid-cols-2 gap-2">
          <SelectorDeHora etiqueta="De" valor={horaInicio} onCambiar={setHoraInicio} />
          <SelectorDeHora etiqueta="A" valor={horaFin} onCambiar={setHoraFin} desde={horaInicio} />
        </div>
      ) : null}
      <label className={CLASE_ETIQUETA}>
        Motivo (opcional, solo lo ves tú)
        <input
          type="text"
          value={motivo}
          maxLength={60}
          onChange={(evento) => setMotivo(evento.target.value)}
          placeholder="Vacaciones, baja…"
          className={CLASE_CAMPO}
        />
      </label>
      <Estado
        error={marcar.isError ? mensajeDeLaRespuesta(marcar.error, "No se ha podido marcar la ausencia.") : null}
        neutro={!valido ? "Revisa las fechas y las horas." : null}
      />
      <Botones onCancelar={onCancelar} guardando={marcar.isPending} deshabilitado={!valido} texto="Marcar ausencia" textoGuardando="Guardando…" />
    </form>
  );
}
