"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PasoDelAlta } from "@/components/paso-del-alta";
import { CalendarDays, ChevronDown, ChevronRight, LoaderCircle, NotebookPen } from "lucide-react";
import { SiApple, SiGooglecalendar } from "@icons-pack/react-simple-icons";
import { AppleCalendarConnect } from "@/components/apple-calendar-connect";
import { BetaPill } from "@/components/beta-pill";
import { MicrosoftLogo } from "@/components/brand-icons";
import { getGoogleCalendarAuthUrl, getMicrosoftCalendarAuthUrl } from "@/lib/api";
import { consumePendingPlan, isPlanId } from "@/lib/billing-navigation";
import { saveRegistrationNextStep } from "@/lib/registration-next-step";
import { BUSINESS_TYPE_ONBOARDING_TEXTS, isBusinessType } from "@/lib/business-type";
import type { BusinessType } from "@/lib/types";

export default function RegisterBusinessCalendarPage() {
  const router = useRouter();
  const [businessType, setBusinessType] = useState<BusinessType>("other");
  const [loading, setLoading] = useState<"google" | "outlook" | null>(null);
  const [error, setError] = useState("");
  const [hasPlaceSchedule, setHasPlaceSchedule] = useState(false);
  // Vuelta de Google/Microsoft con el calendario ya conectado: se redirige
  // al pago, y mientras tanto no se vuelven a ofrecer las opciones de
  // conectar, que parecían decir que no había funcionado.
  const [redirigiendo, setRedirigiendo] = useState(false);
  // iCloud no sale de la página: Apple ID + contraseña de aplicación en un
  // formulario que se despliega bajo su tarjeta (el mismo que en /agente).
  const [formularioApple, setFormularioApple] = useState(false);
  // «Tu agenda ya está lista» (PLAN-AGENDA-PRINCIPAL.md): el paso ya no elige
  // dónde se reserva. Pregunta si hay citas apuntadas en otro sitio: en un
  // calendario que se puede conectar, en papel u otro programa, o en ninguno.
  const [donde, setDonde] = useState<"calendario" | "papel" | null>(null);

  useEffect(() => {
    const token =
      window.localStorage.getItem("alhabla_token") ??
      window.localStorage.getItem("token") ??
      window.localStorage.getItem("jwt");
    if (!token) {
      router.replace("/login");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const typeFromUrl = params.get("businessType");
    setHasPlaceSchedule(params.get("hasPlaceSchedule") === "true");

    if (typeFromUrl && isBusinessType(typeFromUrl)) {
      setBusinessType(typeFromUrl);
    }
  }, [router]);

  const redirectToFinalStep = () => {
    const params = new URLSearchParams(window.location.search);
    const planFromUrl = params.get("plan");
    const pendingPlan = consumePendingPlan();
    const plan = isPlanId(planFromUrl) ? planFromUrl : pendingPlan;

    if (plan) {
      window.location.href = `/checkout?plan=${plan}`;
      return;
    }

    const redirectParams = new URLSearchParams();
    redirectParams.set("from", "register");
    if (businessType) {
      redirectParams.set("businessType", businessType);
    }
    if (hasPlaceSchedule) {
      redirectParams.set("hasPlaceSchedule", "true");
    }
    window.location.href = `/planes?${redirectParams.toString()}`;
  };

  const startOAuth = async (provider: "google" | "outlook") => {
    setLoading(provider);
    setError("");

    try {
      saveRegistrationNextStep(
        `/bienvenida/calendar?completed=true&businessType=${businessType}${hasPlaceSchedule ? "&hasPlaceSchedule=true" : ""}`
      );

      const url =
        provider === "google"
          ? await getGoogleCalendarAuthUrl()
          : await getMicrosoftCalendarAuthUrl();

      window.location.href = url;
    } catch {
      setLoading(null);
      setError("No se pudo iniciar la conexión. Inténtalo de nuevo.");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("completed") === "true") {
      setRedirigiendo(true);
      redirectToFinalStep();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const texts = BUSINESS_TYPE_ONBOARDING_TEXTS[businessType];

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="panel w-full max-w-lg p-6 sm:p-8">
        <PasoDelAlta paso={5} />
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-lavado text-morado">
            <CalendarDays className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-tinta">
            {texts.calendar.heading}
          </h1>
          <p className="mx-auto max-w-md text-sm leading-6 text-muted">
            {texts.calendar.subheading}
          </p>
        </div>

        {redirigiendo ? (
          <p role="status" className="mt-8 flex items-center justify-center gap-2 rounded-2xl border border-exito-borde bg-exito-fondo px-4 py-4 text-sm font-medium text-exito">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            Te llevamos al siguiente paso…
          </p>
        ) : donde === "calendario" ? (
        <>
        <div className="mt-8 space-y-4">
          <button
            type="button"
            onClick={() => startOAuth("google")}
            disabled={loading !== null}
            className="relative flex w-full items-center gap-4 rounded-2xl border border-linea bg-superficie p-5 text-left transition duration-200 hover:border-morado hover:bg-relleno focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <BetaPill />
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-linea bg-superficie">
              <SiGooglecalendar className="h-6 w-6" color="#4285F4" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-tinta">Google Calendar</p>
              <p className="text-sm text-muted">Cada cita aparece en tu Google, y lo que apuntes allí cuenta como ocupado.</p>
            </div>
            {loading === "google" ? (
              <LoaderCircle className="h-5 w-5 animate-spin text-muted" aria-label="Conectando" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => startOAuth("outlook")}
            disabled={loading !== null}
            className="flex w-full items-center gap-4 rounded-2xl border border-linea bg-superficie p-5 text-left transition duration-200 hover:border-morado hover:bg-relleno focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-linea bg-superficie">
              <MicrosoftLogo className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-tinta">Outlook / Microsoft 365</p>
              <p className="text-sm text-muted">Cada cita aparece en tu Outlook, y lo que apuntes allí cuenta como ocupado.</p>
            </div>
            {loading === "outlook" ? (
              <LoaderCircle className="h-5 w-5 animate-spin text-muted" aria-label="Conectando" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setFormularioApple((actual) => !actual)}
            disabled={loading !== null}
            aria-expanded={formularioApple}
            className="relative flex w-full items-center gap-4 rounded-2xl border border-linea bg-superficie p-5 text-left transition duration-200 hover:border-morado hover:bg-relleno focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <BetaPill />
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-linea bg-superficie">
              <SiApple className="h-6 w-6 text-tinta" color="currentColor" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-tinta">Apple / iCloud</p>
              <p className="text-sm text-muted">Si llevas la agenda en el iPhone, conéctala con tu Apple ID y una contraseña de aplicación.</p>
            </div>
            {formularioApple ? (
              <ChevronDown className="h-5 w-5 text-muted" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted" aria-hidden="true" />
            )}
          </button>
          {formularioApple ? (
            <AppleCalendarConnect
              onCancel={() => setFormularioApple(false)}
              onConnected={() => {
                setRedirigiendo(true);
                redirectToFinalStep();
              }}
            />
          ) : null}
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}

        <div className="mt-8 space-y-3">
          <button type="button" onClick={() => setDonde(null)} disabled={loading !== null} className="btn-secondary w-full">
            Volver
          </button>
          <button
            type="button"
            onClick={() => redirectToFinalStep()}
            disabled={loading !== null}
            className="w-full text-center text-sm font-semibold text-muted underline-offset-4 hover:underline"
          >
            Lo conecto más tarde
          </button>
        </div>
        </>
        ) : donde === "papel" ? (
          <div className="mt-8 space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-linea bg-relleno p-5">
              <NotebookPen className="mt-0.5 h-5 w-5 shrink-0 text-morado" aria-hidden="true" />
              <p className="text-sm leading-6 text-tinta-2">{texts.calendar.sinCalendario}</p>
            </div>
            <button type="button" onClick={() => redirectToFinalStep()} className="btn-primary w-full">
              {texts.calendar.cta}
            </button>
            <button type="button" onClick={() => setDonde(null)} className="btn-secondary w-full">
              Volver
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <OpcionDelAlta
              icono={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
              titulo="En Google Calendar, Outlook o el iPhone"
              texto="Lo conectas en un minuto y verás ahí cada cita."
              onClick={() => setDonde("calendario")}
            />
            <OpcionDelAlta
              icono={<NotebookPen className="h-6 w-6" aria-hidden="true" />}
              titulo="En papel o en otro programa"
              texto="Te contamos cómo pasar a tu agenda lo que ya tienes."
              onClick={() => setDonde("papel")}
            />
            <OpcionDelAlta
              icono={<ChevronRight className="h-6 w-6" aria-hidden="true" />}
              titulo="No, empiezo aquí"
              texto="Tus citas entrarán en tu agenda desde la primera llamada."
              onClick={() => redirectToFinalStep()}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function OpcionDelAlta({
  icono,
  titulo,
  texto,
  onClick,
}: {
  icono: React.ReactNode;
  titulo: string;
  texto: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border border-linea bg-superficie p-5 text-left transition duration-200 hover:border-morado hover:bg-relleno focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lavado text-morado">{icono}</div>
      <div className="flex-1">
        <p className="font-semibold text-tinta">{titulo}</p>
        <p className="text-sm text-muted">{texto}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted" aria-hidden="true" />
    </button>
  );
}
