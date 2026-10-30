import type { ReactNode } from "react";
import {
  ETIQUETA_DE_ESTADO,
  ETIQUETA_DE_ESTADO_DE_BORRADOR,
  ETIQUETA_DE_ESTADO_DE_EJECUCION,
  ETIQUETA_DE_RESULTADO,
  TONO_DE_ESTADO,
  TONO_DE_ESTADO_DE_BORRADOR,
  TONO_DE_ESTADO_DE_EJECUCION,
  TONO_DE_RESULTADO,
  etiquetaCortaDeObjetivo,
  type Tono,
} from "@/lib/etiquetas";
import type {
  EstadoDeBorrador,
  EstadoDeEjecucion,
  EstadoDeOportunidad,
  Objetivo,
  Resultado,
} from "@/lib/types";

/** Fondo, borde y texto de la misma familia: nunca un hex en la clase. */
const CLASES_POR_TONO: Record<Tono, string> = {
  neutro: "border-linea bg-relleno text-apagado",
  morado: "border-lavado-borde bg-lavado text-morado-tinta",
  exito: "border-exito-borde bg-exito-fondo text-exito",
  aviso: "border-aviso-borde bg-aviso-fondo text-aviso",
  error: "border-error-borde bg-error-fondo text-error",
};

/** La pastilla de estado del panel. `rounded-full` es solo para esto. */
export function Insignia({
  tono = "neutro",
  children,
  className = "",
  envolver = false,
}: {
  tono?: Tono;
  children: ReactNode;
  className?: string;
  /**
   * Deja que un texto largo (los nombres de varios competidores) pase a otra
   * línea en vez de salirse de la tarjeta en el móvil. Lo normal es una sola.
   */
  envolver?: boolean;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${envolver ? "text-left [overflow-wrap:anywhere]" : "whitespace-nowrap"} ${CLASES_POR_TONO[tono]} ${className}`}
    >
      {children}
    </span>
  );
}

export function InsigniaDeEstado({ estado }: { estado: EstadoDeOportunidad }) {
  return (
    <Insignia tono={TONO_DE_ESTADO[estado]}>
      {ETIQUETA_DE_ESTADO[estado]}
    </Insignia>
  );
}

export function InsigniaDeEstadoDeBorrador({
  estado,
}: {
  estado: EstadoDeBorrador;
}) {
  return (
    <Insignia tono={TONO_DE_ESTADO_DE_BORRADOR[estado]}>
      {ETIQUETA_DE_ESTADO_DE_BORRADOR[estado]}
    </Insignia>
  );
}

export function InsigniaDeResultado({ resultado }: { resultado: Resultado }) {
  return (
    <Insignia tono={TONO_DE_RESULTADO[resultado]}>
      {ETIQUETA_DE_RESULTADO[resultado]}
    </Insignia>
  );
}

export function InsigniaDeEstadoDeEjecucion({
  estado,
}: {
  estado: EstadoDeEjecucion;
}) {
  return (
    <Insignia tono={TONO_DE_ESTADO_DE_EJECUCION[estado]}>
      {ETIQUETA_DE_ESTADO_DE_EJECUCION[estado]}
    </Insignia>
  );
}

/** «C · Backlinks». */
export function InsigniaDeObjetivo({ objetivo }: { objetivo: Objetivo }) {
  return <Insignia>{etiquetaCortaDeObjetivo(objetivo)}</Insignia>;
}
