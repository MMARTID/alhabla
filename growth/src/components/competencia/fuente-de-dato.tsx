import { EnlaceExterno } from "@/components/enlace-externo";
import { formatearFecha } from "@/lib/formato";
import type { DatoDeCompetidor } from "@/lib/types";
import { urlHttpsSegura } from "@/lib/url-segura";
import { fuenteLegible } from "./utilidades";

/**
 * «Fuente: página · Consultado el día» de un dato de un competidor. La fuente
 * solo es enlace si es https (y entonces `nofollow`, en otra pestaña); una
 * `http://` o cualquier otra cosa se enseña como texto, nunca como enlace.
 */
export function FuenteDeDato({
  dato,
  className = "",
}: {
  dato: Pick<DatoDeCompetidor, "urlFuente" | "consultadoEn">;
  className?: string;
}) {
  const enlace = urlHttpsSegura(dato.urlFuente);
  return (
    <p className={`text-xs text-muted [overflow-wrap:anywhere] ${className}`}>
      Fuente:{" "}
      {enlace ? (
        <EnlaceExterno href={enlace} conIcono className="text-morado-tinta">
          {fuenteLegible(dato.urlFuente)}
        </EnlaceExterno>
      ) : (
        <span>{dato.urlFuente} (no se enlaza: no es una dirección https)</span>
      )}{" "}
      · Consultado el {formatearFecha(dato.consultadoEn)}
    </p>
  );
}
