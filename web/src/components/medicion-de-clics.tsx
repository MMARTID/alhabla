"use client";

import { useEffect } from "react";
import { medirEvento } from "@/components/google-analytics";

/**
 * Mide los clics en lo que lleva `data-evento` (con `data-ubicacion` si dice
 * de dónde viene): así un botón de un Server Component, como los «Probar» de
 * las landings, se marca con dos atributos sin volverse de cliente. Los
 * nombres, en docs/eventos-de-analitica.md. Escucha en `document` en fase de
 * captura, antes de que el `<Link>` navegue; como la navegación es dentro de
 * la propia web, la etiqueta sigue viva y el evento sale.
 */
export function MedicionDeClics() {
  useEffect(() => {
    const alPulsar = (evento: MouseEvent) => {
      const objetivo = evento.target;
      if (!(objetivo instanceof Element)) return;
      const marcado = objetivo.closest<HTMLElement>("[data-evento]");
      const nombre = marcado?.dataset.evento;
      if (!nombre) return;
      const ubicacion = marcado.dataset.ubicacion;
      medirEvento(nombre, ubicacion ? { ubicacion } : {});
    };
    document.addEventListener("click", alPulsar, { capture: true });
    return () =>
      document.removeEventListener("click", alPulsar, { capture: true });
  }, []);

  return null;
}
