import Link from "next/link";
import { AvisoDeErrorDeAccion } from "@/components/comunes/d1-aviso-de-error";
import { codigoDeError, idDeLaRespuesta } from "@/lib/api-errors";
import { rutaDeCompetidor } from "./utilidades";

/**
 * El fallo de una acción sobre la competencia. Es `AvisoDeErrorDeAccion`
 * (el texto del backend y qué hacer ahora, según el `codigo`) y, en el `409
 * competidor_existente`, un enlace a la ficha del que ya estaba.
 */
export function AvisoDeErrorDeCompetencia({
  error,
  respaldo,
  className = "",
}: {
  error: unknown;
  respaldo: string;
  className?: string;
}) {
  if (error === null || error === undefined) return null;
  const idDelExistente =
    codigoDeError(error) === "competidor_existente"
      ? idDeLaRespuesta(error)
      : null;
  return (
    <div className={className}>
      <AvisoDeErrorDeAccion error={error} respaldo={respaldo} />
      {idDelExistente ? (
        <Link
          href={rutaDeCompetidor(idDelExistente)}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-morado-tinta underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
        >
          Ver el competidor que ya existe
        </Link>
      ) : null}
    </div>
  );
}
