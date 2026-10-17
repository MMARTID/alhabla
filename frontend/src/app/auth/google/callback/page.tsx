"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { consumeGoogleSession } from "@/lib/api";
import { consumePendingPlan } from "@/lib/billing-navigation";
import { BrandMark } from "@/components/brand-mark";
import { webUrl } from "@/lib/web-url";
import { medirEventoYSeguir } from "@/components/google-analytics";

const GOOGLE_ERRORS: Record<string, string> = {
  access_denied: "Se canceló el acceso con Google.",
  invalid_state: "La solicitud de acceso ha caducado. Inténtalo de nuevo.",
  unverified_email: "Google no pudo confirmar tu dirección de correo.",
  authentication_failed: "No se pudo completar el acceso con Google.",
  account_not_found: "No encontramos ninguna cuenta de Alhabla con ese correo de Google.",
  terms_required: "Tienes que aceptar los Términos y la Política de privacidad para crear la cuenta.",
};

export default function GoogleCallbackPage() {
  const started = useRef(false);
  const [error, setError] = useState("");
  const [accountNotFound, setAccountNotFound] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const query = new URLSearchParams(window.location.search);
    const providerError = query.get("error");
    if (providerError) {
      setError(GOOGLE_ERRORS[providerError] ?? "No se pudo completar el acceso con Google.");
      setAccountNotFound(providerError === "account_not_found");
      return;
    }

    consumeGoogleSession()
      .then((token) => {
        window.localStorage.setItem("alhabla_token", token);
        const selectedPlan = consumePendingPlan();
        const planParam = selectedPlan ? `?plan=${selectedPlan}` : "";
        const irABienvenida = () => window.location.replace(`/bienvenida${planParam}`);
        // `alta=1` lo pone el backend cuando el callback acaba de crear la
        // cuenta: es el alta completada con Google (con email la mide la web).
        if (query.get("alta") === "1") {
          medirEventoYSeguir("sign_up", { method: "google" }, irABienvenida);
        } else {
          irABienvenida();
        }
      })
      .catch(() => {
        setError("La sesión de Google ha caducado. Vuelve a intentarlo.");
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-superficie px-4">
      <div className="panel w-full max-w-md p-6 text-center sm:p-8">
        <BrandMark className="mx-auto h-14 w-14" />
        {error ? (
          <>
            <h1 className="mt-6 text-2xl font-black tracking-tight text-tinta">No pudimos iniciar sesión</h1>
            <p className="mt-3 text-sm leading-6 text-muted">{error}</p>
            {accountNotFound ? (
              <a href={webUrl("/register")} className="btn-primary mt-6 w-full">
                Crear una cuenta
              </a>
            ) : (
              <Link href="/login" className="btn-primary mt-6 w-full">
                Volver a iniciar sesión
              </Link>
            )}
          </>
        ) : (
          <div role="status">
            <LoaderCircle className="mx-auto mt-7 h-7 w-7 animate-spin text-morado" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-black tracking-tight text-tinta">Completando el acceso</h1>
            <p className="mt-3 text-sm text-muted">Estamos preparando tu cuenta de Alhabla.</p>
          </div>
        )}
      </div>
    </div>
  );
}