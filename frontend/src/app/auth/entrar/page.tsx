"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { redeemPass } from "@/lib/api";
import { isPlanId, savePendingPlan } from "@/lib/billing-navigation";
import { normalizeBusinessType } from "@/lib/business-type";
import { rutaInterna } from "@/lib/login-next";
import { BrandMark } from "@/components/brand-mark";
import { webUrl } from "@/lib/web-url";

const REGISTRATION_NICHE_KEY = "alhabla_registration_niche";

// En desarrollo React monta los efectos dos veces: el segundo canje del mismo
// pase llegaba cuando el primero ya lo había gastado y la página decía «ya se
// ha usado». Mientras un canje está en curso, el mismo pase lo reutiliza; al
// terminar se suelta (el resultado no se guarda).
const canjesEnCurso = new Map<string, Promise<string>>();
function canjearUnaVez(pase: string): Promise<string> {
  let canje = canjesEnCurso.get(pase);
  if (!canje) {
    canje = redeemPass(pase);
    canjesEnCurso.set(pase, canje);
    const soltar = () => canjesEnCurso.delete(pase);
    canje.then(soltar, soltar);
  }
  return canje;
}

/**
 * Llegada desde la web pública tras crear la cuenta
 * (docs/historico/PLAN-APP-DOMINIO.md
 * § 3): canjea el pase de un solo uso por la sesión y sigue con el asistente
 * del negocio. El plan y el sector vienen en la query porque el
 * localStorage de alhabla.ai no se ve desde aquí; se guardan donde
 * /bienvenida los espera. `destino` (solo rutas de la app) lleva a otra
 * pantalla: lo usa el enlace de entrada a dev del MCP alhabla-dev, para
 * abrir la app como un negocio que ya terminó el alta.
 */
function EntrarContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pase = searchParams.get("pase");
    if (!pase) {
      setError("Falta el pase de entrada.");
      return;
    }
    let cancelado = false;
    canjearUnaVez(pase)
      .then((token) => {
        if (cancelado) return;
        window.localStorage.setItem("alhabla_token", token);
        const plan = searchParams.get("plan");
        if (isPlanId(plan)) savePendingPlan(plan);
        const sector = searchParams.get("sector");
        if (sector) window.localStorage.setItem(REGISTRATION_NICHE_KEY, normalizeBusinessType(sector));
        const destino = rutaInterna(searchParams.get("destino"));
        window.location.replace(
          destino ?? (isPlanId(plan) ? `/bienvenida?plan=${plan}` : "/bienvenida")
        );
      })
      .catch(() => {
        if (!cancelado) setError("El pase ha caducado o ya se ha usado.");
      });
    return () => {
      cancelado = true;
    };
  }, [searchParams]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div role="alert" className="panel w-full max-w-md p-6 text-center sm:p-8">
          <BrandMark className="mx-auto h-14 w-14" />
          <h1 className="mt-6 text-2xl font-black tracking-tight text-tinta">No hemos podido abrir tu sesión</h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {error} Tu cuenta está creada: entra con tu email y contraseña.
          </p>
          <div className="mt-6 grid gap-3">
            <a href="/login" className="btn-primary w-full">
              Entrar
            </a>
            <a href={webUrl("/register")} className="btn-secondary w-full">
              Volver al registro
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-sm text-muted" role="status">
      <Loader2 className="mr-2 h-4 w-4 animate-spin text-morado" aria-hidden="true" />
      Abriendo tu cuenta…
    </div>
  );
}

export default function EntrarPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center px-4 text-sm text-muted" role="status">Abriendo tu cuenta…</div>}>
      <EntrarContent />
    </Suspense>
  );
}
