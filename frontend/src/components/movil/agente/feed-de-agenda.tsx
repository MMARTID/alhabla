"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Smartphone } from "lucide-react";
import { activarFeedDeAgenda, desactivarFeedDeAgenda, getFeedDeAgenda, type FeedDeAgenda } from "@/lib/api";

/**
 * «Ver tu agenda en el móvil» (PLAN-AGENDA-ALHABLA.md, fase 3): un enlace
 * iCal de solo lectura al que el dueño se suscribe desde el calendario del
 * iPhone, de Android o de Google, sin conectar nada. Lo que apunte en su
 * móvil NO vuelve a Alhabla, y el enlace equivale a una contraseña: lleva
 * nombres de clientes (nunca teléfonos) y se puede cambiar en cualquier
 * momento.
 */
export function FeedDeAgenda({ avisar }: { avisar: (mensaje: string, tipo?: "success" | "error") => void }) {
  const queryClient = useQueryClient();
  const [copiado, setCopiado] = useState(false);
  const [confirmarCambio, setConfirmarCambio] = useState(false);
  const feed = useQuery({ queryKey: ["feed-de-agenda"], queryFn: getFeedDeAgenda });

  const alCambiar = (datos: FeedDeAgenda, mensaje: string) => {
    queryClient.setQueryData(["feed-de-agenda"], datos);
    setConfirmarCambio(false);
    setCopiado(false);
    avisar(mensaje);
  };
  const activar = useMutation({
    mutationFn: (renovar: boolean) => activarFeedDeAgenda(renovar),
    onSuccess: (datos, renovar) => alCambiar(datos, renovar ? "Enlace cambiado. El anterior ya no vale." : "Enlace activado."),
    onError: () => avisar("No se pudo activar el enlace.", "error"),
  });
  const desactivar = useMutation({
    mutationFn: desactivarFeedDeAgenda,
    onSuccess: (datos) => alCambiar(datos, "Enlace desactivado."),
    onError: () => avisar("No se pudo desactivar el enlace.", "error"),
  });

  const copiar = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      avisar("No se pudo copiar. Mantén pulsado el enlace para copiarlo.", "error");
    }
  };

  const activo = feed.data?.activo === true;
  const url = feed.data?.url ?? null;
  const ocupado = activar.isPending || desactivar.isPending;

  return (
    <section aria-labelledby="feed-de-agenda-titulo" className="space-y-3 rounded-[20px] border border-linea bg-superficie px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lavado text-morado" aria-hidden="true">
          <Smartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 id="feed-de-agenda-titulo" className="text-[15px] font-bold text-tinta">
            Ver tu agenda en el móvil
          </h3>
          <p className="mt-0.5 text-sm leading-6 text-muted">
            Un enlace para suscribirte desde el calendario del iPhone, de Android o de Google. Solo lectura: lo que apuntes allí no vuelve a Alhabla.
          </p>
        </div>
      </div>

      {feed.isLoading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : feed.isError ? (
        <p className="text-sm text-error" role="alert">
          No se pudo comprobar el enlace.
        </p>
      ) : !activo ? (
        <button type="button" onClick={() => activar.mutate(false)} disabled={ocupado} className="btn-primary w-full">
          {activar.isPending ? "Activando…" : "Activar el enlace"}
        </button>
      ) : (
        <>
          {url ? (
            <>
              <div className="flex items-center gap-2 rounded-[12px] border border-linea bg-relleno px-3 py-2">
                <code className="min-w-0 flex-1 truncate text-xs text-tinta-2" title={url}>
                  {url}
                </code>
                <button
                  type="button"
                  onClick={() => void copiar(url)}
                  aria-label="Copiar el enlace"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-linea bg-superficie text-tinta-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
                >
                  {copiado ? <Check className="h-4 w-4 text-exito" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {feed.data?.webcal ? (
                  <a href={feed.data.webcal} className="btn-secondary w-full">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    Añadir al iPhone
                  </a>
                ) : null}
                <button type="button" onClick={() => void copiar(url)} className="btn-secondary w-full">
                  {copiado ? "Copiado" : "Copiar para Google"}
                </button>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-muted">
                <li>
                  <strong className="font-semibold text-tinta-2">iPhone:</strong> «Añadir al iPhone» abre Calendario y te pide suscribirte.
                </li>
                <li>
                  <strong className="font-semibold text-tinta-2">Google Calendar:</strong> en el ordenador, «Otros calendarios» › «+» › «Desde URL» y pega el enlace. Google lo refresca cada varias horas, no al momento.
                </li>
              </ol>
            </>
          ) : (
            <p className="text-sm text-aviso">El enlace está activo, pero falta la dirección pública del servidor para mostrarlo.</p>
          )}
          <p className="text-xs leading-5 text-muted">
            Trata el enlace como una contraseña: quien lo tenga ve los nombres de tus clientes (nunca sus teléfonos). Si lo compartiste donde no debías, cámbialo.
          </p>
          {confirmarCambio ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => activar.mutate(true)} disabled={ocupado} className="btn-primary flex-1">
                {activar.isPending ? "Cambiando…" : "Sí, cambiar el enlace"}
              </button>
              <button type="button" onClick={() => setConfirmarCambio(false)} disabled={ocupado} className="btn-secondary flex-1">
                No
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmarCambio(true)} disabled={ocupado} className="btn-secondary flex-1">
                Cambiar enlace
              </button>
              <button type="button" onClick={() => desactivar.mutate()} disabled={ocupado} className="btn-secondary flex-1">
                {desactivar.isPending ? "Desactivando…" : "Desactivar"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
