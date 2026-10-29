"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Estado = "quieto" | "esperando" | "desplegando";

/**
 * El único momento con movimiento de la landing de sector: la transcripción
 * de la llamada se escribe línea a línea, como en el panel, al entrar en
 * pantalla. Sin JS, o con movimiento reducido, se queda como llega del
 * servidor: entera y legible. Solo se esconden las líneas que todavía están
 * por debajo de la pantalla al hidratar (así nada visible parpadea), y un
 * IntersectionObserver sobre la primera de ellas las despliega una vez; no
 * lee el scroll.
 *
 * Cada `<li>` hijo pone su retraso con `--linea` y las clases de
 * `CLASES_DE_LINEA` (transcripcion-llamada.tsx: una constante exportada
 * desde aquí llegaría al servidor como referencia de cliente, no como
 * texto).
 */
export function DesplieguePorLineas({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLOListElement>(null);
  const [estado, setEstado] = useState<Estado>("quieto");

  useEffect(() => {
    const lista = ref.current;
    if (!lista || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Las líneas que ya se ven al hidratar se quedan (esconderlas
    // parpadearía); se escriben las de debajo, numeradas desde la primera
    // oculta para que el retraso empiece en cero.
    const lineas = Array.from(lista.children) as HTMLElement[];
    const primera = lineas.findIndex(
      (linea) => linea.getBoundingClientRect().top >= window.innerHeight
    );
    if (primera === -1) return;
    lineas.forEach((linea, i) => {
      if (i < primera) linea.dataset.vista = "";
      else linea.style.setProperty("--linea", String(i - primera));
    });

    setEstado("esperando");
    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((entrada) => entrada.isIntersecting)) return;
        setEstado("desplegando");
        observador.disconnect();
      },
      { rootMargin: "0px 0px -15% 0px" }
    );
    observador.observe(lineas[primera]);
    return () => observador.disconnect();
  }, []);

  return (
    <ol
      ref={ref}
      data-despliegue={estado}
      className={`group ${className ?? ""}`}
    >
      {children}
    </ol>
  );
}
