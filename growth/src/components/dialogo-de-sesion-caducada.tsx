"use client";

import { Clock } from "lucide-react";
import { useEffect, useRef } from "react";
import { BotonDeGoogle } from "@/components/boton-de-google";

/**
 * Se abre cuando el ID token de Google (dura una hora) ya no vale. NO
 * redirige ni desmonta nada: la pantalla de debajo, con el borrador que
 * estabas editando, se queda como estaba (`PuertaDeSesion` la marca como
 * `inert`). Al volver a entrar con Google el diálogo se cierra solo; lo que
 * no llegó a guardarse hay que repetirlo, y el panel no reintenta por su
 * cuenta ninguna decisión.
 */
export function DialogoDeSesionCaducada() {
  const dialogo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogo.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-oscuro/60 p-4 sm:items-center">
      <div
        ref={dialogo}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sesion-caducada-titulo"
        aria-describedby="sesion-caducada-texto"
        tabIndex={-1}
        className="panel w-full max-w-md bg-elevada p-6 shadow-lg focus:outline-none"
      >
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-lavado text-morado">
          <Clock className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2
          id="sesion-caducada-titulo"
          className="text-lg font-semibold text-tinta"
        >
          Tu sesión ha caducado
        </h2>
        <p id="sesion-caducada-texto" className="mt-2 text-sm text-muted">
          Vuelve a iniciar sesión con Google para seguir. Lo que tenías en
          pantalla, incluido el borrador que estabas editando, se queda como
          está. Lo último que hiciste puede no haberse guardado: repítelo cuando
          entres.
        </p>
        <div className="mt-6">
          <BotonDeGoogle />
        </div>
      </div>
    </div>
  );
}
