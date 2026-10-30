import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { REL_EXTERNO, urlSegura } from "@/lib/url-segura";

/**
 * Un enlace a una página ajena con aspecto de botón secundario («Abrir
 * página»). Solo es un `<a href>` si la URL es http o https; con cualquier
 * otra cosa (`javascript:`, `data:`, vacía) se pinta un botón apagado, sin
 * `href`, y se dice por qué. Se abre en otra pestaña con
 * `noopener noreferrer nofollow`.
 */
export function BotonDeEnlaceExterno({
  href,
  children,
  className = "",
}: {
  href: string | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  const seguro = urlSegura(href);
  if (!seguro) {
    return (
      <span
        aria-disabled="true"
        className={`btn-secondary h-11 cursor-not-allowed opacity-60 hover:translate-y-0 ${className}`}
      >
        {children}
        <span className="sr-only"> (la dirección no es una web válida)</span>
      </span>
    );
  }
  return (
    <a
      href={seguro}
      target="_blank"
      rel={REL_EXTERNO}
      className={`btn-secondary h-11 ${className}`}
    >
      {children}
      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </a>
  );
}
