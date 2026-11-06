"use client";

import { useQuery } from "@tanstack/react-query";
import { getCalendarState, NOMBRE_AGENDA_DE_ALHABLA } from "@/lib/calendar-state";
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  Check,
  Clock3,
  HelpCircle,
  PhoneForwarded,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { getOnboardingState, getPhoneNumberInfo } from "@/lib/api";
import { formatPhone } from "@/lib/format";
import { horarioConfigurado } from "@/lib/horario";
import { suscripcionSinCobro } from "@/lib/suscripcion";
import type { Business, PhoneNumberInfo } from "@/lib/types";

/**
 * `unknown` no es un estado del negocio, sino de la comprobación: la consulta
 * falló y no sabemos nada. Se separó de `waiting` porque decir "Activándose"
 * de un número que lleva semanas funcionando es mentir al negocio.
 */
export type OperationalTone = "ok" | "warning" | "error" | "waiting" | "unknown";

export type OperationalStatusItem = {
  key: "agent" | "phone" | "forwarding" | "calendar";
  label: string;
  icon: LucideIcon;
  value: string;
  tone: OperationalTone;
  action?: { label: string; href: string } | { label: string; kind: "retry-phone" };
  /**
   * El problema ya lo cuenta otra señal: «Atiende, pero no reserva» por la
   * agenda es el mismo asunto que «Agenda: sin conectar», y el chip diría
   * «2 avisos» por una sola cosa que arreglar.
   */
  cubiertoPor?: OperationalStatusItem["key"];
};

export const OPERATIONAL_TONE: Record<OperationalTone, { icon: LucideIcon; text: string; dot: string }> = {
  ok: { icon: Check, text: "text-exito", dot: "bg-exito" },
  warning: { icon: AlertTriangle, text: "text-aviso", dot: "bg-aviso-icono" },
  error: { icon: AlertTriangle, text: "text-error", dot: "bg-error" },
  waiting: { icon: Clock3, text: "text-apagado", dot: "bg-tenue" },
  unknown: { icon: HelpCircle, text: "text-apagado", dot: "bg-tenue" },
};

const NO_COMPROBADO = "No se ha podido comprobar";

/** Estado intermedio de la recepcionista: coge el teléfono, informa y toma
 * recados, pero no puede reservar (sin horario, o sin agenda de Alhabla ni
 * calendario conectado). */
export const ATIENDE_SIN_RESERVAR = "Atiende, pero no reserva";

/**
 * Fuente única para las señales de salud operativa. Las pantallas deciden si
 * muestran las cuatro señales o una versión resumida, pero no reinterpretan
 * por su cuenta el estado de teléfono, desvío, agenda y recepcionista.
 */
export function buildOperationalStatus({
  business,
  agentActive,
  phone,
  forwardingStatus,
  phoneUnavailable = false,
  forwardingUnavailable = false,
}: {
  business: Business;
  agentActive: boolean;
  phone: PhoneNumberInfo | undefined;
  forwardingStatus: string | null | undefined;
  /** La consulta del teléfono falló: no hay dato, no es que esté en curso. */
  phoneUnavailable?: boolean;
  /** La consulta del onboarding falló: no sabemos si el desvío está puesto. */
  forwardingUnavailable?: boolean;
}): OperationalStatusItem[] {
  const hasPlan = business.subscriptionStatus === "ACTIVE" || business.subscriptionStatus === "TRIALING";
  const calendarState = getCalendarState(business);
  const sinHorario = !horarioConfigurado(business.schedule);

  // Sin horario no hay huecos (BUSINESS_HOURS_NOT_CONFIGURED): la
  // recepcionista contesta, toma nota y avisa al dueño, pero no da hora.
  // La agenda ya no es motivo (PLAN-AGENDA-PRINCIPAL.md): la de Alhabla viene
  // puesta y reserva aunque el calendario conectado no se vea.
  const sinReservas: OperationalStatusItem | null = sinHorario
    ? {
        key: "agent",
        label: "Recepcionista",
        icon: Bot,
        value: `${ATIENDE_SIN_RESERVAR}: falta el horario`,
        tone: "warning",
        action: { label: "Configurar horario", href: "/agente?section=business-hours" },
      }
    : null;

  const agent: OperationalStatusItem = business.callsSuspendedAt
    ? { key: "agent", label: "Recepcionista", icon: Bot, value: "Suspendida por impago", tone: "error", action: { label: "Regularizar el pago", href: "/ajustes/facturacion" } }
    : suscripcionSinCobro(business.subscriptionStatus)
      ? { key: "agent", label: "Recepcionista", icon: Bot, value: "No contesta: sin plan activo", tone: "error", action: { label: "Elegir plan", href: "/ajustes/facturacion" } }
      : !business.active || !agentActive
        ? { key: "agent", label: "Recepcionista", icon: Bot, value: "Inactiva", tone: "warning", action: { label: "Revisar agente", href: "/agente?section=agent-settings" } }
        : sinReservas ?? { key: "agent", label: "Recepcionista", icon: Bot, value: "Atendiendo llamadas", tone: "ok" };

  const phoneItem: OperationalStatusItem = phone?.status === "active" && phone.phoneNumber
    ? { key: "phone", label: "Tu número", icon: Smartphone, value: formatPhone(phone.phoneNumber) ?? phone.phoneNumber, tone: "ok" }
    : !hasPlan
      ? { key: "phone", label: "Tu número", icon: Smartphone, value: "Necesita un plan activo", tone: "warning", action: { label: "Elegir plan", href: "/ajustes/facturacion" } }
      : phone?.status === "failed"
        ? { key: "phone", label: "Tu número", icon: Smartphone, value: "No se pudo asignar", tone: "error", action: { label: "Reintentar", kind: "retry-phone" } }
        : phoneUnavailable
          ? { key: "phone", label: "Tu número", icon: Smartphone, value: NO_COMPROBADO, tone: "unknown" }
          : { key: "phone", label: "Tu número", icon: Smartphone, value: "Activándose", tone: "waiting" };

  const forwarding: OperationalStatusItem = forwardingStatus === "done"
    ? { key: "forwarding", label: "Desvío de llamadas", icon: PhoneForwarded, value: "Activo", tone: "ok" }
    : forwardingStatus === "ready"
      ? { key: "forwarding", label: "Desvío de llamadas", icon: PhoneForwarded, value: "Sin activar", tone: "error", action: { label: "Activarlo ahora", href: "/?desvio=abrir" } }
      : forwardingUnavailable
        ? { key: "forwarding", label: "Desvío de llamadas", icon: PhoneForwarded, value: NO_COMPROBADO, tone: "unknown" }
        : { key: "forwarding", label: "Desvío de llamadas", icon: PhoneForwarded, value: "Esperando al número", tone: "waiting" };

  // La agenda es siempre la de Alhabla; el calendario conectado es un
  // complemento y solo avisa si dejó de verse (las citas siguen entrando).
  const calendar: OperationalStatusItem =
    calendarState.calendario === "sin_ver"
      ? { key: "calendar", label: "Agenda", icon: CalendarDays, value: `Reservando · sin ver ${calendarState.label}`, tone: "warning", action: { label: "Reconectar", href: "/agente?section=calendar-section" } }
      : calendarState.calendario === "al_dia"
        ? { key: "calendar", label: "Agenda", icon: CalendarDays, value: `${NOMBRE_AGENDA_DE_ALHABLA} · con ${calendarState.label}`, tone: "ok" }
        : { key: "calendar", label: "Agenda", icon: CalendarDays, value: NOMBRE_AGENDA_DE_ALHABLA, tone: "ok" };

  return [agent, phoneItem, forwarding, calendar];
}

export function useOperationalStatus(business: Business | undefined, agentActive = true) {
  const phoneQuery = useQuery({ queryKey: ["phone-number"], queryFn: getPhoneNumberInfo, enabled: Boolean(business) });
  const onboardingQuery = useQuery({ queryKey: ["onboarding-state"], queryFn: getOnboardingState, enabled: Boolean(business) });

  return {
    items: business
      ? buildOperationalStatus({
          business,
          agentActive,
          phone: phoneQuery.data,
          forwardingStatus: onboardingQuery.data?.forwarding?.status,
          phoneUnavailable: phoneQuery.isError,
          forwardingUnavailable: onboardingQuery.isError,
        })
      : [],
    phoneQuery,
    onboardingQuery,
    isLoading: phoneQuery.isLoading || onboardingQuery.isLoading,
  };
}
