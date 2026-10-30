"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Copia con un `<textarea>` temporal cuando el portapapeles moderno no está (HTTP, WebViews). */
function copiarConRespaldo(texto: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copiado = document.execCommand("copy");
    document.body.removeChild(area);
    return copiado;
  } catch {
    return false;
  }
}

/**
 * Copia un texto al portapapeles y lo dice («Copiado») un par de segundos. El
 * texto se copia tal cual está en pantalla en ese momento, incluidas las
 * ediciones sin guardar: lo que vas a pegar es lo que ves.
 */
export function BotonCopiar({
  texto,
  etiqueta = "Copiar texto",
  className = "btn-secondary h-11",
  deshabilitado = false,
  soloIcono = false,
}: {
  texto: string;
  etiqueta?: string;
  className?: string;
  deshabilitado?: boolean;
  /** Solo el icono (la etiqueta queda para lectores de pantalla): para filas estrechas. */
  soloIcono?: boolean;
}) {
  const [estado, setEstado] = useState<"reposo" | "copiado" | "fallo">(
    "reposo"
  );
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    []
  );

  async function copiar() {
    let copiado = false;
    try {
      await navigator.clipboard.writeText(texto);
      copiado = true;
    } catch {
      copiado = copiarConRespaldo(texto);
    }
    setEstado(copiado ? "copiado" : "fallo");
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEstado("reposo"), 2500);
  }

  const Icono = estado === "copiado" ? Check : Copy;
  const rotulo =
    estado === "copiado"
      ? "Copiado"
      : estado === "fallo"
        ? "No se pudo copiar"
        : etiqueta;
  return (
    <button
      type="button"
      onClick={() => void copiar()}
      disabled={deshabilitado}
      title={soloIcono ? etiqueta : undefined}
      className={className}
    >
      <Icono className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className={soloIcono ? "sr-only" : undefined}>{rotulo}</span>
    </button>
  );
}
