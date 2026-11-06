"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ArrowUpRight, CalendarDays, Check, CircleCheckBig, TriangleAlert } from "lucide-react";
import { SiApple, SiGooglecalendar } from "@icons-pack/react-simple-icons";
import { getCalendarList, getGoogleCalendarAuthUrl, getMicrosoftCalendarAuthUrl, quitarCalendarioConectado, selectCalendar } from "@/lib/api";
import { getCalendarState, NOMBRE_AGENDA_DE_ALHABLA, providerFromReconnectCode } from "@/lib/calendar-state";
import type { Business, CalendarProviderId } from "@/lib/types";
import { AppleCalendarConnect } from "@/components/apple-calendar-connect";
import { AvisoFlotante, useAviso } from "@/components/aviso-flotante";
import { BetaPill } from "@/components/beta-pill";
import { MicrosoftLogo } from "@/components/brand-icons";
import { PantallaDeAjuste } from "@/components/movil/agente/pantalla-de-ajuste";
import { FeedDeAgenda } from "@/components/movil/agente/feed-de-agenda";

type Mensaje = { type: "success" | "error"; message: string } | null;

/**
 * Calendario en el móvil (PLAN-AGENDA-PRINCIPAL.md): arriba, la agenda de
 * Alhabla, que es la del negocio y no se elige; debajo, el calendario
 * conectado como complemento (recibe cada cita y avisa de lo que el dueño
 * apunta en él): conectarlo, cambiar de cuenta o de calendario, reconectarlo
 * si dejó de verse o quitarlo. OAuth para Google y Outlook, Apple ID y
 * contraseña de aplicación para Apple.
 */
export function CalendarioMovil({ business }: { business: Business }) {
  const queryClient = useQueryClient();
  const { aviso, avisar, cerrar } = useAviso();
  const estado = getCalendarState(business);
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const [reconectar, setReconectar] = useState(false);
  const [autorizando, setAutorizando] = useState<"google" | "outlook" | null>(null);
  const [selector, setSelector] = useState(false);
  const [formularioApple, setFormularioApple] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);
  const conectado = estado.connected && !reconectar;
  const sinVer = !conectado && (estado.expired || reconectar);
  const quitar = useMutation({
    mutationFn: quitarCalendarioConectado,
    onSuccess: async (negocio) => {
      queryClient.setQueryData(["my-business"], negocio);
      await queryClient.invalidateQueries({ queryKey: ["calendar-list"] });
      setConfirmarQuitar(false);
      setReconectar(false);
      setMensaje(null);
      avisar("Calendario quitado. Tus citas siguen en tu agenda.");
    },
    onError: () => avisar("No se pudo quitar el calendario.", "error"),
  });

  const calendarios = useQuery({
    queryKey: ["calendar-list"],
    queryFn: getCalendarList,
    enabled: selector,
    retry: false,
  });

  useEffect(() => {
    const error = calendarios.error;
    if (!error || !axios.isAxiosError(error)) return;
    const codigo = error.response?.data?.code;
    if (typeof codigo === "string" && codigo.endsWith("_CALENDAR_RECONNECT_REQUIRED")) {
      const proveedor: CalendarProviderId = providerFromReconnectCode(codigo);
      setReconectar(true);
      setSelector(false);
      setMensaje({
        type: "error",
        message:
          proveedor === "caldav"
            ? "Apple ha dejado de aceptar la contraseña de aplicación (¿la anulaste?). Genera una nueva y vuelve a conectar el calendario."
            : `La conexión con ${proveedor === "outlook" ? "Outlook Calendar" : "Google Calendar"} ha caducado. Vuelve a conectarla para continuar.`,
      });
    }
  }, [calendarios.error]);

  const elegir = useMutation({
    mutationFn: selectCalendar,
    onSuccess: async (negocio) => {
      queryClient.setQueryData(["my-business"], negocio);
      await queryClient.invalidateQueries({ queryKey: ["calendar-list"] });
      setSelector(false);
      avisar("Calendario actualizado.");
    },
    onError: () => avisar("No se pudo cambiar de calendario.", "error"),
  });

  const autorizar = async (proveedor: "google" | "outlook") => {
    setAutorizando(proveedor);
    setMensaje(null);
    try {
      const url = proveedor === "google" ? await getGoogleCalendarAuthUrl() : await getMicrosoftCalendarAuthUrl();
      if (url) window.location.href = url;
    } catch {
      setMensaje({ type: "error", message: "No se pudo obtener la URL de conexión." });
      setAutorizando(null);
    }
  };

  const alConectarApple = async (negocio: Business) => {
    queryClient.setQueryData(["my-business"], negocio);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["calendar-list"] }),
      queryClient.invalidateQueries({ queryKey: ["onboarding-state"] }),
    ]);
    setFormularioApple(false);
    setReconectar(false);
    setMensaje({ type: "success", message: "El calendario de Apple está conectado correctamente." });
  };

  const reconectarProveedor = () => {
    if (estado.provider === "caldav") {
      setMensaje(null);
      setFormularioApple(true);
      return;
    }
    void autorizar(estado.provider);
  };

  return (
    <PantallaDeAjuste
      titulo="Calendario"
      subtitulo="Tus citas viven en tu agenda. Conecta tu calendario si quieres verlas también allí."
    >
      <div className="flex flex-col gap-3">
        {mensaje ? (
          <p
            role="status"
            className={`rounded-[14px] border px-4 py-3 text-sm font-medium ${
              mensaje.type === "success" ? "border-exito-borde bg-exito-fondo text-exito" : "border-error-borde bg-error-fondo text-error"
            }`}
          >
            {mensaje.message}
          </p>
        ) : null}

        {/* La agenda: viene puesta y no se elige. */}
        <div className="flex items-start gap-3 rounded-[20px] border border-linea bg-superficie px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lavado text-morado">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-tinta">{NOMBRE_AGENDA_DE_ALHABLA}</p>
            <p className="text-[13px] leading-5 text-muted">
              Aquí entran todas tus citas: las de las llamadas, las de WhatsApp y las que apuntas tú.
            </p>
          </div>
        </div>

        <p className="mt-2 px-1 text-[13px] font-bold uppercase tracking-wide text-tenue">También en tu calendario</p>

        {conectado ? (
          <>
            <div className="flex items-center gap-3 rounded-[20px] border border-exito-borde bg-exito-fondo px-4 py-3.5">
              <CircleCheckBig className="h-6 w-6 shrink-0 text-exito" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-exito">{estado.label} conectado</p>
                <p className="truncate text-[13px] text-exito">{estado.accountEmail ?? `Cuenta de ${estado.shortLabel}`}</p>
              </div>
            </div>
            <p className="px-1 text-sm leading-6 text-muted">
              Recibe cada cita, y lo que apuntes allí cuenta como ocupado para no pisarlo.
            </p>
            {estado.provider === "caldav" ? (
              <button type="button" onClick={() => setFormularioApple((actual) => !actual)} className="btn-secondary w-full">
                {formularioApple ? "Cerrar" : "Cambiar de cuenta"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void autorizar(estado.provider as "google" | "outlook")}
                disabled={autorizando !== null}
                className="btn-secondary w-full"
              >
                {autorizando ? "Conectando…" : "Cambiar de cuenta"}
              </button>
            )}
            {formularioApple ? <AppleCalendarConnect onCancel={() => setFormularioApple(false)} onConnected={alConectarApple} /> : null}
            <button
              type="button"
              onClick={() => setSelector((actual) => !actual)}
              aria-expanded={selector}
              className="btn-secondary w-full"
            >
              {selector ? "Cerrar el selector" : "Cambiar de calendario"}
            </button>
            {selector ? (
              <div className="flex flex-col gap-2">
                {calendarios.isLoading ? <p className="px-1 text-sm text-muted">Cargando calendarios…</p> : null}
                {calendarios.isError && !reconectar ? (
                  <p className="px-1 text-sm text-error">No se pudo obtener la lista de calendarios. Inténtalo de nuevo en unos segundos.</p>
                ) : null}
                {calendarios.data?.calendars.length === 0 ? (
                  <p className="px-1 text-sm text-muted">No hay calendarios disponibles en esta cuenta.</p>
                ) : null}
                {calendarios.data?.calendars.map((calendario) => {
                  const elegido = calendario.id === calendarios.data?.selectedCalendarId;
                  return (
                    <button
                      key={calendario.id}
                      type="button"
                      aria-pressed={elegido}
                      disabled={elegir.isPending}
                      onClick={() => elegir.mutate(calendario.id)}
                      className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado disabled:opacity-60 ${
                        elegido ? "border-morado bg-lavado" : "border-linea bg-superficie"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-tinta">{calendario.name}</span>
                        {calendario.primary ? <span className="block text-[13px] text-muted">Calendario principal</span> : null}
                      </span>
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${elegido ? "bg-morado text-white" : "bg-relleno-fuerte text-transparent"}`}
                        aria-hidden="true"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <QuitarCalendario
              etiqueta={estado.shortLabel}
              confirmando={confirmarQuitar}
              pendiente={quitar.isPending}
              onPedir={() => setConfirmarQuitar(true)}
              onCancelar={() => setConfirmarQuitar(false)}
              onConfirmar={() => quitar.mutate()}
            />
          </>
        ) : sinVer ? (
          <>
            <div className="flex items-start gap-3 rounded-[20px] border border-aviso-borde bg-aviso-fondo px-4 py-3.5">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-aviso" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-tinta">Sin ver {estado.label}</p>
                <p className="text-[13px] leading-5 text-tinta-2">
                  Tus citas siguen entrando en tu agenda, pero no veo lo que apuntas en {estado.shortLabel}. Reconéctalo y te copio las que hayan entrado.
                </p>
              </div>
            </div>
            <button type="button" onClick={reconectarProveedor} disabled={autorizando !== null} className="btn-primary w-full">
              {autorizando ? "Conectando…" : `Reconectar ${estado.shortLabel}`}
            </button>
            {formularioApple ? <AppleCalendarConnect onCancel={() => setFormularioApple(false)} onConnected={alConectarApple} /> : null}
            <QuitarCalendario
              etiqueta={estado.shortLabel}
              confirmando={confirmarQuitar}
              pendiente={quitar.isPending}
              onPedir={() => setConfirmarQuitar(true)}
              onCancelar={() => setConfirmarQuitar(false)}
              onConfirmar={() => quitar.mutate()}
            />
          </>
        ) : (
          <>
            <p className="px-1 text-sm leading-6 text-muted">
              ¿Llevas las citas en Google, Outlook o el iPhone? Conéctalo y verás ahí cada cita.
            </p>
            <TarjetaDeProveedor
              icono={<SiGooglecalendar className="h-[18px] w-[18px] shrink-0" color="#4285F4" />}
              titulo="Conecta Google Calendar"
              texto="Cada cita aparece en tu Google, y lo que apuntes allí cuenta como ocupado."
              accion={autorizando === "google" ? "Conectando…" : "Conectar"}
              beta
              disabled={autorizando !== null}
              onClick={() => void autorizar("google")}
            />
            <TarjetaDeProveedor
              icono={<MicrosoftLogo className="h-[18px] w-[18px] shrink-0" />}
              titulo="Conecta Outlook"
              texto="Cada cita aparece en tu Outlook, y lo que apuntes allí cuenta como ocupado."
              accion={autorizando === "outlook" ? "Conectando…" : "Conectar"}
              disabled={autorizando !== null}
              onClick={() => void autorizar("outlook")}
            />
            <TarjetaDeProveedor
              icono={<SiApple className="h-[18px] w-[18px] shrink-0 text-tinta" color="currentColor" />}
              titulo="Conecta el calendario de Apple"
              texto="Si llevas la agenda en el iPhone o en iCloud, conéctala con tu Apple ID y una contraseña de aplicación."
              accion={formularioApple ? "Cerrar" : "Conectar"}
              beta
              expandida={formularioApple}
              disabled={autorizando !== null}
              onClick={() => {
                setMensaje(null);
                setFormularioApple((actual) => !actual);
              }}
            />
            {formularioApple ? <AppleCalendarConnect onCancel={() => setFormularioApple(false)} onConnected={alConectarApple} /> : null}
          </>
        )}
      </div>
      <div className="mt-4">
        <FeedDeAgenda avisar={avisar} />
      </div>
      {aviso ? <AvisoFlotante aviso={aviso} onClose={cerrar} /> : null}
    </PantallaDeAjuste>
  );
}

function TarjetaDeProveedor({
  icono,
  titulo,
  texto,
  accion,
  beta = false,
  expandida,
  disabled,
  onClick,
}: {
  icono: React.ReactNode;
  titulo: string;
  texto: string;
  accion: string;
  beta?: boolean;
  expandida?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={expandida}
      className="relative mt-1.5 flex min-h-24 w-full flex-col gap-1.5 rounded-2xl border border-lavado-borde bg-lavado p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {/* Beta: la app de Google sigue en revisión y Apple es nuevo. */}
      {beta ? <BetaPill /> : null}
      <span className="flex items-center gap-2 text-base font-bold text-tinta">
        {icono}
        {titulo}
      </span>
      <span className="text-sm leading-6 text-muted">{texto}</span>
      <span className="inline-flex items-center gap-1 text-sm font-bold text-morado-tinta">
        {accion}
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </button>
  );
}

/**
 * Quitar el calendario conectado, con una confirmación en línea: las citas
 * siguen en la agenda de Alhabla y lo que ya se copió se queda en él.
 */
function QuitarCalendario({
  etiqueta,
  confirmando,
  pendiente,
  onPedir,
  onCancelar,
  onConfirmar,
}: {
  etiqueta: string;
  confirmando: boolean;
  pendiente: boolean;
  onPedir: () => void;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  if (!confirmando) {
    return (
      <button type="button" onClick={onPedir} className="btn-secondary w-full">
        Quitar {etiqueta}
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-[20px] border border-linea bg-relleno px-4 py-3.5" role="group" aria-label={`Quitar ${etiqueta}`}>
      <p className="text-[15px] font-bold text-tinta">¿Quitar {etiqueta}?</p>
      <p className="text-sm leading-6 text-tinta-2">
        Tus citas siguen en tu agenda. Lo que ya se copió se queda en {etiqueta}, y lo que apuntes allí dejará de contar como ocupado.
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={onConfirmar} disabled={pendiente} className="btn-primary flex-1">
          {pendiente ? "Quitando…" : "Sí, quitarlo"}
        </button>
        <button type="button" onClick={onCancelar} disabled={pendiente} className="btn-secondary flex-1">
          Cancelar
        </button>
      </div>
    </div>
  );
}
