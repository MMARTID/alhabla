"use client";

import { useState } from "react";
import { D2PanelDePestana, D2Pestanas } from "@/components/comunes/d2-pestanas";
import { EncabezadoDePagina } from "@/components/encabezado-de-pagina";
import { PanelDeDecisiones } from "./panel-de-decisiones";
import { PanelDeGestiones } from "./panel-de-gestiones";

type Pestana = "decisiones" | "gestiones";

const PESTANAS = [
  { valor: "decisiones", etiqueta: "Decisiones" },
  { valor: "gestiones", etiqueta: "Gestiones" },
] as const;

/**
 * Historial: qué hiciste y qué pasó. Dos caras de lo mismo: el registro de
 * decisiones (inmutable) y las gestiones (lo que hiciste a mano fuera del
 * panel, con su resultado).
 */
export function VistaDeHistorial() {
  const [pestana, setPestana] = useState<Pestana>("decisiones");
  return (
    <>
      <EncabezadoDePagina
        titulo="Historial"
        descripcion="Qué hiciste y qué pasó. El registro de decisiones no se edita ni se borra."
      />
      <D2Pestanas
        etiqueta="Secciones del historial"
        idBase="historial"
        opciones={PESTANAS}
        valor={pestana}
        alCambiar={setPestana}
      />
      <D2PanelDePestana idBase="historial" valor={pestana}>
        {pestana === "decisiones" ? (
          <PanelDeDecisiones />
        ) : (
          <PanelDeGestiones />
        )}
      </D2PanelDePestana>
    </>
  );
}
