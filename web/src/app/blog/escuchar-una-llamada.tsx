"use client";

import { useState } from "react";
import { Headphones } from "lucide-react";
import { DemoVoiceCallDiferida } from "@/components/demo-voice-call-diferida";

/**
 * El botón del cierre del blog: abre la demo de voz en la misma página, que
 * es lo que promete el titular («oír cómo atiende»), en vez de mandar a
 * precios.
 */
export function EscucharUnaLlamada() {
  const [abierta, setAbierta] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="btn-primary px-6"
      >
        <Headphones className="h-4 w-4" aria-hidden="true" />
        Escuchar una llamada
      </button>
      <DemoVoiceCallDiferida open={abierta} onClose={() => setAbierta(false)} />
    </>
  );
}
