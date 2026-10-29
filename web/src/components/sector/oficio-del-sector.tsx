import Link from "next/link";
import { Users } from "lucide-react";
import { Pregunta } from "@/components/sector/pregunta";
import { ServiciosDelOficio } from "@/components/sector/servicios-del-oficio";
import type { NicheAccent } from "@/lib/niche-landings";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * «¿Sabe cómo funciona una…?»: la respuesta de dos líneas (las llamadas
 * típicas del oficio caben en ella) y, como prueba, sus servicios tal como
 * se ven en la app: duración y nivel por profesional. El reparto por
 * especialidad cierra el bloque a todo el ancho y, en los oficios con datos
 * de salud, el límite que da confianza.
 */
export function OficioDelSector({
  oficio,
  acento,
}: {
  oficio: SectorLanding["oficio"];
  acento: NicheAccent;
}) {
  return (
    <Pregunta
      id="oficio"
      pregunta={oficio.pregunta}
      respuesta={oficio.respuesta}
      lado="izquierda"
      prueba={
        <figure>
          <ServiciosDelOficio
            equipo={oficio.equipo}
            servicios={oficio.servicios}
            acento={acento}
          />
          <figcaption className="mt-3 px-1 text-xs leading-5 text-apagado">
            Ejemplo con nombres inventados.
          </figcaption>
        </figure>
      }
      pie={
        <div className="flex items-start gap-4 border-t border-linea-fuerte pt-8">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: acento.soft, color: acento.strong }}
          >
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="max-w-3xl pt-1">
            <p className="text-lg font-semibold leading-8 text-tinta">
              {oficio.reparto}
            </p>
            {oficio.salud ? (
              <p className="mt-3 text-base leading-7 text-apagado">
                {oficio.salud.texto}{" "}
                <Link
                  href={oficio.salud.enlace.href}
                  className="font-semibold text-tinta underline decoration-linea-fuerte underline-offset-4 transition hover:decoration-tinta"
                >
                  {oficio.salud.enlace.texto}
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      }
    />
  );
}
