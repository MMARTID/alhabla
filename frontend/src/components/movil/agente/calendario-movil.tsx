"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ArrowUpRight, CalendarDays, Check, CircleCheckBig } from "lucide-react";
import { SiApple, SiGooglecalendar } from "@icons-pack/react-simple-icons";
import { cambiarModoDeAgenda, getCalendarList, getGoogleCalendarAuthUrl, getMicrosoftCalendarAuthUrl, selectCalendar } from "@/lib/api";
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
 * Calendario en el móvil: el estado de la conexión arriba y, debajo, cada
 * acción por separado (cambiar de cuenta, de calendario). Sin conectar, los
 * tres proveedores en tarjetas. La lógica es la de escritorio: OAuth para
 * Google y Outlook, Apple ID y contraseña de aplicación para Apple.
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
  const conectado = estado.connected && !reconectar;
  // Modo de agenda (PLAN-AGENDA-ALHABLA.md): elegir la agenda de Alhabla pide
  // una confirmación en línea, porque desde ese momento la recepcionista solo
  // ve lo que hay en Alhabla. `verExternos` abre las tarjetas de proveedor
  // desde el modo alhabla: conectar uno pasa el negocio a `externo` solo.
  const [confirmarAlhabla, setConfirmarAlhabla] = useState(false);
  const [verExternos, setVerExternos] = useState(false);
  const cambiarModo = useMutation({
    mutationFn: cambiarModoDeAgenda,
    onSuccess: async (negocio, modo) => {
      queryClient.setQueryData(["my-business"], negocio);
      await queryClient.invalidateQueries({ queryKey: ["onboarding-state"] });
      setConfirmarAlhabla(false);
      setVerExternos(false);
      avisar(
        modo === "alhabla"
          ? "Tu recepcionista reserva ya en la agenda de Alhabla."
          : "Tu recepcionista vuelve a reservar en tu calendario."
      );
    },
    onError: (error) => {
      const codigo = axios.isAxiosError(error) ? error.response?.data?.code : undefined;
      avisar(
        codigo === "CALENDAR_NOT_OPERATIVE"
          ? "Para volver a tu calendario primero tienes que conectarlo."
          : "No se pudo cambiar el modo de agenda.",
        "error"
      );
    },
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

  return (
    <PantallaDeAjuste
      titulo="Calendario"
      subtitulo="Tu agenda real: de ahí sale la disponibilidad y ahí se guardan las citas."
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

        {estado.alhabla && !verExternos ? (
          <>
            <div className="flex items-center gap-3 rounded-[20px] border border-exito-borde bg-exito-fondo px-4 py-3.5">
              <CircleCheckBig className="h-6 w-6 shrink-0 text-exito" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-exito">{NOMBRE_AGENDA_DE_ALHABLA} activa</p>
                <p className="text-[13px] text-exito">Las citas se guardan solo en Alhabla, sin calendario externo.</p>
              </div>
            </div>
            <p className="px-1 text-sm leading-6 text-muted">
              Tu recepcionista solo ve las citas que hay en Alhabla. Si apuntas citas en otro sitio, añádelas aquí o bloquea esas horas para que no las ofrezca.
            </p>
            <button type="button" onClick={() => setVerExternos(true)} className="btn-secondary w-full">
              Usar un calendario externo
            </button>
          </>
        ) : conectado ? (
          <>
            <div className="flex items-center gap-3 rounded-[20px] border border-exito-borde bg-exito-fondo px-4 py-3.5">
              <CircleCheckBig className="h-6 w-6 shrink-0 text-exito" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-exito">{estado.label} conectado</p>
                <p className="truncate text-[13px] text-exito">{estado.accountEmail ?? `Cuenta de ${estado.shortLabel}`}</p>
              </div>
            </div>
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
            <ElegirAgendaDeAlhabla
              variante="boton"
              confirmando={confirmarAlhabla}
              pendiente={cambiarModo.isPending}
              onPedir={() => setConfirmarAlhabla(true)}
              onCancelar={() => setConfirmarAlhabla(false)}
              onConfirmar={() => cambiarModo.mutate("alhabla")}
            />
          </>
        ) : (
          <>
            {estado.alhabla ? (
              <button type="button" onClick={() => setVerExternos(false)} className="btn-secondary w-full">
                Volver a la agenda de Alhabla
              </button>
            ) : (
              <ElegirAgendaDeAlhabla
                variante="tarjeta"
                confirmando={confirmarAlhabla}
                pendiente={cambiarModo.isPending}
                onPedir={() => setConfirmarAlhabla(true)}
                onCancelar={() => setConfirmarAlhabla(false)}
                onConfirmar={() => cambiarModo.mutate("alhabla")}
              />
            )}
            <TarjetaDeProveedor
              icono={<SiGooglecalendar className="h-[18px] w-[18px] shrink-0" color="#4285F4" />}
              titulo="Conecta Google Calendar"
              texto="Reservas automáticas, disponibilidad real y la agenda en el panel."
              accion={autorizando === "google" ? "Conectando…" : "Conectar"}
              beta
              disabled={autorizando !== null}
              onClick={() => void autorizar("google")}
            />
            <TarjetaDeProveedor
              icono={<MicrosoftLogo className="h-[18px] w-[18px] shrink-0" />}
              titulo="Conecta Outlook"
              texto="Usa Outlook Calendar para sincronizar la agenda del negocio."
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
 * Elegir la agenda de Alhabla (PLAN-AGENDA-ALHABLA.md, decisión D1/D6) con
 * una confirmación en línea: desde ese momento la recepcionista solo ve las
 * citas que hay en Alhabla, y el dueño tiene que saberlo antes de pulsar.
 * Como tarjeta (sin calendario conectado) o como botón discreto (con uno).
 */
function ElegirAgendaDeAlhabla({
  variante,
  confirmando,
  pendiente,
  onPedir,
  onCancelar,
  onConfirmar,
}: {
  variante: "tarjeta" | "boton";
  confirmando: boolean;
  pendiente: boolean;
  onPedir: () => void;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  if (confirmando) {
    return (
      <div className="space-y-3 rounded-[20px] border border-aviso-borde bg-aviso-fondo px-4 py-3.5" role="group" aria-label="Confirmar la agenda de Alhabla">
        <p className="text-[15px] font-bold text-tinta">¿Reservar solo en la agenda de Alhabla?</p>
        <p className="text-sm leading-6 text-tinta-2">
          Tu recepcionista solo verá las citas que haya en Alhabla. Si apuntas citas en otro sitio (una libreta, otro programa), tendrás que añadirlas aquí o bloquear esas horas; si no, podría dar una hora que ya tienes ocupada.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onConfirmar} disabled={pendiente} className="btn-primary flex-1">
            {pendiente ? "Guardando…" : "Sí, usar la agenda de Alhabla"}
          </button>
          <button type="button" onClick={onCancelar} disabled={pendiente} className="btn-secondary flex-1">
            Cancelar
          </button>
        </div>
      </div>
    );
  }
  if (variante === "boton") {
    return (
      <button type="button" onClick={onPedir} className="btn-secondary w-full">
        Reservar solo en la agenda de Alhabla
      </button>
    );
  }
  return (
    <TarjetaDeProveedor
      icono={<CalendarDays className="h-[18px] w-[18px] shrink-0 text-morado" aria-hidden="true" />}
      titulo={`Usar la ${NOMBRE_AGENDA_DE_ALHABLA}`}
      texto="Sin conectar ningún calendario: tu recepcionista reserva aquí y tú ves y apuntas las citas en el panel o por WhatsApp."
      accion="Elegir"
      disabled={false}
      onClick={onPedir}
    />
  );
}
