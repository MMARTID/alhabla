import Link from "next/link";
import { Pregunta } from "@/components/sector/pregunta";
import { ServiciosDelOficio } from "@/components/sector/servicios-del-oficio";
import type { NicheAccent } from "@/lib/niche-landings";
import type { SectorLanding } from "@/lib/sectores/tipos";

/**
 * «¿Sabe cómo funciona una…?»: la respuesta de dos líneas (las llamadas
 * típicas del oficio caben en ella) y, como prueba, sus servicios tal como
 * se ven en la app: duración y nivel por profesional. El reparto por
 * especialidad va debajo de la respuesta, en una línea, y en los oficios
 * con datos de salud, el límite que da confianza.
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
    >
      <p className="mt-6 max-w-md text-base font-semibold leading-7 text-tinta">
        {oficio.reparto}
      </p>
      {oficio.salud ? (
        <p className="mt-4 max-w-md text-sm leading-6 text-apagado">
          {oficio.salud.texto}{" "}
          <Link
            href={oficio.salud.enlace.href}
            className="font-semibold text-tinta underline decoration-linea-fuerte underline-offset-4 transition hover:decoration-tinta"
          >
            {oficio.salud.enlace.texto}
          </Link>
        </p>
      ) : null}
    </Pregunta>
  );
}
