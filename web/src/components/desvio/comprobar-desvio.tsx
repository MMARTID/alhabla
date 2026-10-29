import type { ReactNode } from "react";
import { ArrowUpRight, MessageCircle, PhoneIncoming } from "lucide-react";
import { appUrl } from "@/lib/app-url";

/**
 * El paso que sigue al código en cada ficha de desvío: probar con una llamada
 * de verdad que el desvío salta, y una línea de lo que pasa a partir de ahí.
 * Lo propio del operador (qué código de consulta publica, o que su fijo no
 * tiene) va en `children`; lo común es corto a propósito, porque se repite en
 * las quince fichas y el detalle vive en /desvio-de-llamadas#comprobar.
 */
export function ComprobarDesvio({ children }: { children?: ReactNode }) {
  return (
    <div className="panel flex h-full flex-col p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lavado text-morado">
          <PhoneIncoming className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="text-lg font-bold text-tinta">Comprueba que salta</h3>
      </div>
      <div className="mt-3 space-y-3 text-sm leading-6 text-muted [&_strong]:font-semibold [&_strong]:text-tinta">
        {children}
        <p>
          Luego, en tu panel, <strong>«Comprobar desvío»</strong>: Alhabla
          llama a tu línea, tú no la coges y te dice si ha entrado por la
          recepcionista o por qué no.
        </p>
      </div>
      <a
        href={appUrl("/ajustes/telefono")}
        className="mt-3 inline-flex w-fit items-center gap-1 text-sm font-semibold text-morado-tinta underline underline-offset-4 hover:text-tinta"
      >
        Abrir Ajustes › Teléfono
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
      <div className="mt-auto pt-5">
        <p className="flex gap-2.5 border-t border-linea pt-4 text-sm leading-6 text-tinta">
          <MessageCircle
            className="mt-1 h-4 w-4 shrink-0 text-morado"
            aria-hidden="true"
          />
          <span>
            Desde ese momento, lo que no coges lo atiende la recepcionista, y
            tú lo ves por WhatsApp o en el panel.
          </span>
        </p>
      </div>
    </div>
  );
}
