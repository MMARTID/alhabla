import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { REL_EXTERNO, urlSegura } from "@/lib/url-segura";

/**
 * Un enlace a una página ajena. Solo es enlace si la URL es http o https
 * (`esUrlWeb`); con cualquier otra cosa (`javascript:`, `data:`, relativa,
 * vacía) se pinta el texto sin `href`, como dato. Se abre en otra pestaña con
 * `noopener noreferrer nofollow`.
 */
export function EnlaceExterno({
  href,
  children,
  className = "",
  conIcono = false,
}: {
  href: string | null | undefined;
  children: ReactNode;
  className?: string;
  conIcono?: boolean;
}) {
  const seguro = urlSegura(href);
  if (!seguro) return <span className={className}>{children}</span>;
  return (
    <a
      href={seguro}
      target="_blank"
      rel={REL_EXTERNO}
      className={`inline-flex items-center gap-1 rounded-sm underline decoration-linea-fuerte underline-offset-2 hover:decoration-morado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado ${className}`}
    >
      {children}
      {conIcono ? (
        <>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </>
      ) : null}
    </a>
  );
}
