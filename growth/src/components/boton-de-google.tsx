"use client";

import { useEffect, useRef, useState } from "react";
import { config } from "@/lib/config";
import { pintarBotonDeGoogle } from "@/lib/gis";

/**
 * El botón «Iniciar sesión con Google» de Google Identity Services. La
 * credencial que entrega va a la sesión (src/lib/gis.ts), no a este
 * componente. Si el script no carga (bloqueador de anuncios, red caída) se
 * dice y se puede reintentar.
 */
export function BotonDeGoogle() {
  const contenedor = useRef<HTMLDivElement>(null);
  const [intento, setIntento] = useState(0);
  const [fallo, setFallo] = useState<string | null>(null);
  const clientId = config.googleClientId;

  useEffect(() => {
    const destino = contenedor.current;
    if (!clientId || !destino) return;
    let vigente = true;
    pintarBotonDeGoogle(clientId, destino).then(
      () => {
        if (vigente) setFallo(null);
      },
      (error: unknown) => {
        if (!vigente) return;
        console.warn("[Growth] No se pudo pintar el botón de Google:", error);
        setFallo("No se pudo cargar el inicio de sesión de Google.");
      }
    );
    return () => {
      vigente = false;
    };
  }, [clientId, intento]);

  if (!clientId) {
    // Solo en desarrollo: en producción `config.ts` ya habría fallado.
    return (
      <p
        role="alert"
        className="rounded-[10px] border border-aviso-borde bg-aviso-fondo p-3 text-sm text-aviso"
      >
        Falta NEXT_PUBLIC_GROWTH_GOOGLE_CLIENT_ID. Pon el ID de cliente de
        Google en growth/.env.local, o arranca la demostración con{" "}
        <code className="font-mono">npm run dev:demo</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={contenedor} className="flex min-h-11 justify-center" />
      {fallo ? (
        <div role="alert" className="text-center text-sm text-error">
          <p>{fallo}</p>
          <button
            type="button"
            onClick={() => {
              setFallo(null);
              setIntento((n) => n + 1);
            }}
            className="btn-secondary mt-3 h-11"
          >
            Reintentar
          </button>
        </div>
      ) : null}
    </div>
  );
}
