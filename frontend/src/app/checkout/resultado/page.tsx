"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Clock3, Loader2, RefreshCw } from "lucide-react";
import {
  getBillingSummary,
  getOnboardingState,
  getPhoneNumberInfo,
  reconcileCheckoutSession,
} from "@/lib/api";
import { formatPhone } from "@/lib/format";
import type { OnboardingState, PhoneNumberInfo } from "@/lib/types";
import { medirEvento } from "@/components/google-analytics";

/** Los pasos del desvío, abiertos en el panel (panel-inicio.tsx). */
const HREF_ACTIVAR_DESVIO = "/?desvio=abrir";

/** Sondeos del número tras el pago: cada 5 s durante 5 min como mucho, lo
 * mismo que la reconciliación de la suscripción. */
const SONDEO_MS = 5000;
const MAX_SONDEOS = 60;

type SiguientePaso = {
  texto: string;
  href: string;
  etiqueta: string;
  /** El número todavía se está comprando o aprobando. */
  activandoNumero?: boolean;
};

/**
 * Qué hacer al volver del pago (hallazgo 11 de la auditoría del 28-10): no
 * es configurar el agente, que el alta ya dejó listo, sino desviar el
 * teléfono y comprobarlo con una llamada de prueba. Sin desvío no entra
 * ninguna llamada.
 */
function siguientePaso(
  phone: PhoneNumberInfo | undefined,
  onboarding: OnboardingState | undefined
): SiguientePaso {
  if (phone?.status === "failed") {
    return {
      texto:
        "Tu plan ya está activo, pero no hemos podido asignarte el número. Desde el panel puedes reintentarlo; si vuelve a fallar, escríbenos a hola@alhabla.ai.",
      href: "/",
      etiqueta: "Ir al panel",
    };
  }

  const forwarding = onboarding?.forwarding;
  if (forwarding?.status === "done") {
    const numero = forwarding.customerLine ?? forwarding.phoneNumber;
    return {
      texto: `Tu plan ya está activo y las llamadas ya llegan a tu recepcionista. Haz una llamada de prueba${
        numero ? ` al ${formatPhone(numero) ?? numero}` : ""
      } desde otro teléfono para oírla.`,
      href: "/",
      etiqueta: "Ir al panel",
    };
  }

  const numeroPendiente =
    forwarding?.status === "waiting_number" ||
    phone?.status === "pending" ||
    phone?.status === "purchased";
  if (numeroPendiente) {
    return {
      texto:
        "Tu plan ya está activo. Estamos activando tu número, que tarda unos minutos. En cuanto esté listo, desvía tu teléfono a la recepcionista y pulsa «Comprobar desvío» para hacer una llamada de prueba.",
      href: HREF_ACTIVAR_DESVIO,
      etiqueta: "Ir al panel",
      activandoNumero: true,
    };
  }

  return {
    texto:
      "Tu plan ya está activo. Último paso: desvía tu teléfono a la recepcionista y pulsa «Comprobar desvío». Te haremos una llamada de prueba para confirmar que funciona.",
    href: HREF_ACTIVAR_DESVIO,
    etiqueta: "Activar el desvío",
  };
}

export default function CheckoutResultPage(props: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const searchParams = use(props.searchParams);
  const sessionId = searchParams.session_id ?? null;
  const [hasPlaceSchedule, setHasPlaceSchedule] = useState(false);
  // Si la confirmación tarda demasiado, la copia pasa a un segundo nivel con
  // contacto de soporte — sin esto, un usuario real puede quedarse mirando
  // "estamos confirmando" con sondeos cada 2,5s indefinidamente, sin ninguna
  // señal de que algo podría ir mal.
  const [isTakingLong, setIsTakingLong] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsTakingLong(true), 60_000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const imported = window.localStorage.getItem("alhabla_place_schedule_imported") === "true";
    setHasPlaceSchedule(imported);
    if (imported) {
      window.localStorage.removeItem("alhabla_place_schedule_imported");
    }
  }, []);

  const queryClient = useQueryClient();

  // Clave propia: ["billing-summary"] la monta AppShell con un GET, y esta
  // consulta hace un POST de reconciliación. Con la misma clave eran dos
  // observadores con funciones distintas pisándose la caché mutuamente.
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["checkout-reconcile", sessionId],
    queryFn: () => sessionId ? reconcileCheckoutSession(sessionId) : getBillingSummary(),
    // Cada 5 s: la reconciliación relee la sesión en Stripe y sincroniza la
    // suscripción; a 2,5 s superaba el límite del endpoint (30/min) en un
    // minuto de espera. Tras 5 min sin confirmación se deja de sondear (el
    // aviso de «está tardando» y el botón de reintentar siguen ahí).
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "ACTIVE" || status === "TRIALING") return false;
      return query.state.dataUpdateCount + query.state.errorUpdateCount >= 60 ? false : 5000;
    },
  });

  const confirmed = data?.status === "ACTIVE" || data?.status === "TRIALING";

  useEffect(() => {
    if (!confirmed) return;
    // El resumen que enseña el resto de la app (aviso de minutos del menú)
    // se queda obsoleto en cuanto Stripe confirma el plan.
    void queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
  }, [confirmed, queryClient]);

  // Con el plan confirmado, el backend compra el número (billing/service.ts):
  // se sondea hasta que esté activo o falle para decir el paso correcto.
  const phoneQuery = useQuery({
    queryKey: ["phone-number"],
    queryFn: getPhoneNumberInfo,
    enabled: confirmed,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "active" || status === "failed") return false;
      return query.state.dataUpdateCount + query.state.errorUpdateCount >= MAX_SONDEOS ? false : SONDEO_MS;
    },
  });
  const onboardingQuery = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: getOnboardingState,
    enabled: confirmed,
    refetchInterval: (query) =>
      query.state.data?.forwarding?.status === "waiting_number" &&
      query.state.dataUpdateCount + query.state.errorUpdateCount < MAX_SONDEOS
        ? SONDEO_MS
        : false,
  });
  const paso = siguientePaso(phoneQuery.data, onboardingQuery.data);

  const planConfirmado = confirmed ? (data?.planId ?? data?.effectivePlanId ?? null) : null;
  const enPrueba = data?.status === "TRIALING";

  useEffect(() => {
    // Solo al volver de Stripe (con `session_id`): entrar aquí sin él con un
    // plan ya activo no es un checkout completado.
    if (!planConfirmado || !sessionId) return;
    // Una vez por sesión de Stripe, aunque se recargue la página. La marca
    // se pone solo si el evento salió (sin medición aceptada no sale).
    const clave = `alhabla_checkout_medido:${sessionId}`;
    try {
      if (window.sessionStorage.getItem(clave)) return;
    } catch {
      // Sin sessionStorage (modo privado estricto) se mide igual.
    }
    const medido = medirEvento("checkout_completado", {
      plan: planConfirmado,
      estado: enPrueba ? "prueba" : "activa",
    });
    if (!medido) return;
    try {
      window.sessionStorage.setItem(clave, "1");
    } catch {
      // Ídem: como mucho se repetiría al recargar.
    }
  }, [planConfirmado, sessionId, enPrueba]);

  // Si la reconciliación falla no hay nada que sondear: sin esta rama el
  // usuario veía "Estamos confirmando tu suscripción" y un sondeo inútil.
  const sinRespuesta = isError && !data;

  const ctaParams = new URLSearchParams();
  if (confirmed) {
    ctaParams.set("from", "checkout");
    if (hasPlaceSchedule) {
      ctaParams.set("hasPlaceSchedule", "true");
    }
  }
  const configurarHref = `/agente?${ctaParams.toString()}`;
  const ctaHref = confirmed ? paso.href : "/ajustes/facturacion";
  const ctaLabel = confirmed ? paso.etiqueta : "Ver facturación";

  return (
    <section className="mx-auto max-w-2xl py-16 text-center">
      <div className="panel p-8 sm:p-12">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${confirmed ? "bg-exito-fondo text-exito" : sinRespuesta ? "bg-error-fondo text-error" : "bg-aviso-fondo text-aviso"}`}>
          {confirmed ? <CheckCircle2 className="h-8 w-8" /> : sinRespuesta ? <CircleAlert className="h-8 w-8" /> : <Clock3 className="h-8 w-8" />}
        </div>
        <div role="status">
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-tinta">
          {confirmed
            ? "Suscripción confirmada"
            : sinRespuesta
              ? "No hemos podido comprobar tu suscripción"
              : "Estamos confirmando tu suscripción"}
        </h1>
        <p className="mt-4 leading-7 text-muted">
          {confirmed
            ? paso.texto
            : sinRespuesta
              ? "Tu pago puede haberse completado igualmente: lo que ha fallado es la comprobación. Pulsa «Actualizar» para volver a comprobarlo."
              : "Stripe está procesando el pago. En unos segundos activamos tu plan automáticamente."}
        </p>
        </div>
        {!confirmed && isTakingLong ? (
          <p className="mt-3 text-sm leading-6 text-aviso">
            Esto está tardando más de lo normal. Si no se confirma en unos minutos, escríbenos a{" "}
            <a href="mailto:hola@alhabla.ai" className="font-semibold underline underline-offset-2">
              hola@alhabla.ai
            </a>{" "}
            y te ayudamos.
          </p>
        ) : null}
        {isLoading ? <p className="mt-4 text-sm text-muted">Consultando estado…</p> : null}
        {confirmed && paso.activandoNumero ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Activando tu número…
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {confirmed ? null : (
            <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-secondary">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          )}
          <Link href={ctaHref} className="btn-primary">
            {ctaLabel}
          </Link>
          {confirmed ? (
            <Link href={configurarHref} className="btn-secondary">
              Revisar mi negocio
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
