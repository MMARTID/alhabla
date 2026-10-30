import {
  Ban,
  BadgeEuro,
  FileText,
  ListChecks,
  OctagonAlert,
  Scale,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";
import { ETIQUETA_DE_TIPO_DE_AFIRMACION } from "@/lib/etiquetas";
import type { Afirmacion, TipoDeAfirmacion } from "@/lib/types";
import { FilaDeAfirmacion } from "./fila-de-afirmacion";

const ICONO_DE_TIPO: Record<TipoDeAfirmacion, LucideIcon> = {
  precio: BadgeEuro,
  funcion: ListChecks,
  limite: OctagonAlert,
  sector: Store,
  comparativa: Scale,
  pagina: FileText,
  prohibida: Ban,
};

/** Lo que cada grupo le dice a quien revisa un borrador. */
const DESCRIPCION_DE_TIPO: Partial<Record<TipoDeAfirmacion, string>> = {
  prohibida:
    "Si un borrador contiene alguno de estos términos, el backend lo bloquea.",
  limite:
    "Lo que Alhabla no hace o tiene acotado. Un borrador no puede prometer lo contrario.",
  precio: "Cada cifra, con la fuente de la que sale.",
  comparativa:
    "Datos de otras plataformas, con la fecha en que se consultaron.",
};

/** Las dos familias que piden cautela llevan su color de estado; el resto, el acento. */
const CLASES_DEL_AZULEJO: Partial<Record<TipoDeAfirmacion, string>> = {
  prohibida: "bg-error-fondo text-error",
  limite: "bg-aviso-fondo text-aviso",
};

/**
 * Un grupo de afirmaciones vigentes del mismo tipo. `total` es cuántas hay en
 * el tipo; `afirmaciones` las que pasan la búsqueda.
 */
export function GrupoDeAfirmaciones({
  tipo,
  afirmaciones,
  total,
}: {
  tipo: TipoDeAfirmacion;
  afirmaciones: readonly Afirmacion[];
  total: number;
}) {
  const idTitulo = useId();
  const Icono = ICONO_DE_TIPO[tipo];
  const descripcion = DESCRIPCION_DE_TIPO[tipo];
  return (
    <section aria-labelledby={idTitulo} className="panel overflow-hidden">
      <header className="flex items-start gap-3 border-b border-linea p-4 sm:p-5">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${CLASES_DEL_AZULEJO[tipo] ?? "bg-lavado text-morado"}`}
        >
          <Icono className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={idTitulo} className="text-base font-semibold text-tinta">
            {ETIQUETA_DE_TIPO_DE_AFIRMACION[tipo]}{" "}
            <span className="font-normal text-muted">
              {afirmaciones.length === total
                ? total
                : `${afirmaciones.length} de ${total}`}
            </span>
          </h2>
          {descripcion ? (
            <p className="mt-0.5 text-sm text-muted">{descripcion}</p>
          ) : null}
        </div>
      </header>
      <ul className="divide-y divide-linea-suave">
        {afirmaciones.map((afirmacion) => (
          <FilaDeAfirmacion key={afirmacion.id} afirmacion={afirmacion} />
        ))}
      </ul>
    </section>
  );
}
