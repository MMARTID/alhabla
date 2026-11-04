"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentProps } from "react";

import type { DemoVoiceCall as DemoVoiceCallReal } from "@/components/demo-voice-call";

// La demo trae axios, el cliente de Places y ~25 iconos, y solo hace falta si
// alguien pulsa «Escuchar cómo atiende»: fuera del JS inicial de la página
// (medido el 2026-11-04: ~35 KB comprimidos que el móvil descargaba y evaluaba
// antes de pintar el titular).
const DemoVoiceCall = dynamic(
  () =>
    import("@/components/demo-voice-call").then((m) => ({
      default: m.DemoVoiceCall,
    })),
  { ssr: false }
);

/**
 * `DemoVoiceCall` cargada bajo demanda: no se descarga hasta la primera vez
 * que `open` es true y, una vez montada, se queda para que la animación de
 * cierre y el estado de la llamada sigan como siempre.
 */
export function DemoVoiceCallDiferida(
  props: ComponentProps<typeof DemoVoiceCallReal>
) {
  const [pedida, setPedida] = useState(props.open);
  if (props.open && !pedida) setPedida(true);
  if (!pedida) return null;
  return <DemoVoiceCall {...props} />;
}
