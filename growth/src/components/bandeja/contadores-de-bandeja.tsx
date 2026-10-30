import type { UseQueryResult } from "@tanstack/react-query";
import { Esqueleto } from "@/components/esqueleto";
import type { EstadoDeOportunidad, Resumen } from "@/lib/types";
import type { EstadoElegido } from "./estado-de-filtros";

type Ficha = {
  clave: string;
  etiqueta: string;
  valor: string;
  /** El estado al que lleva pulsarla, si es un atajo. */
  atajo?: EstadoDeOportunidad;
  aclaracion?: string;
};

function fichasDe(resumen: Resumen): Ficha[] {
  // `estaSemana` ya es lo que cuenta para el tope: las gestiones hechas
  // (`hechas`) MÁS las aprobadas sin gestionar. Sumarle las aprobadas otra vez
  // las contaría dos veces.
  const usados = resumen.contactos.estaSemana;
  return [
    {
      clave: "por-revisar",
      etiqueta: "Por revisar",
      valor: String(resumen.paraRevisar),
      atajo: "pendiente_aprobacion",
    },
    {
      clave: "bloqueadas",
      etiqueta: "Bloqueadas",
      valor: String(resumen.bloqueadas),
      atajo: "bloqueada",
    },
    {
      clave: "aprobadas",
      etiqueta: "Aprobadas sin gestionar",
      valor: String(resumen.aprobadasSinGestionar),
      atajo: "aprobada",
    },
    {
      clave: "contactos",
      etiqueta: "Contactos de la semana",
      valor: `${usados} de ${resumen.contactos.tope}`,
      aclaracion: "Hechos más aprobados sin enviar",
    },
  ];
}

const CLASES_DE_FICHA =
  "panel flex min-h-[4.5rem] flex-col justify-center rounded-2xl px-3.5 py-2.5 text-left sm:px-4 sm:py-3";

/**
 * Los cuatro números de la cabecera de la Bandeja. Tres son atajos al filtro
 * por estado; el cuarto (contactos de la semana frente al tope) es solo
 * informativo. Si el resumen falla, la lista de debajo sigue funcionando.
 */
export function ContadoresDeBandeja({
  resumen,
  estadoElegido,
  alElegir,
}: {
  resumen: UseQueryResult<Resumen, Error>;
  estadoElegido: EstadoElegido;
  alElegir: (estado: EstadoDeOportunidad) => void;
}) {
  if (resumen.isPending) {
    return (
      <div
        aria-hidden="true"
        className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Esqueleto key={i} className="h-[4.5rem]" />
        ))}
      </div>
    );
  }
  if (resumen.isError) {
    return (
      <p className="mb-5 text-sm text-muted">
        No se pudieron cargar los contadores. La lista de abajo sí funciona.
      </p>
    );
  }
  return (
    <ul
      aria-label="Resumen de la semana"
      className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      {fichasDe(resumen.data).map((ficha) => {
        const contenido = (
          <>
            <span className="text-xs font-semibold text-muted">
              {ficha.etiqueta}
            </span>
            <span className="text-2xl font-semibold leading-tight text-tinta">
              {ficha.valor}
            </span>
            {ficha.aclaracion ? (
              <span className="hidden text-xs text-muted sm:block">
                {ficha.aclaracion}
              </span>
            ) : null}
          </>
        );
        const atajo = ficha.atajo;
        return (
          <li key={ficha.clave} className="flex">
            {atajo ? (
              <button
                type="button"
                aria-pressed={estadoElegido === atajo}
                onClick={() => alElegir(atajo)}
                className={`${CLASES_DE_FICHA} w-full transition duration-150 hover:border-linea-fuerte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado aria-pressed:border-lavado-borde aria-pressed:bg-lavado`}
              >
                {contenido}
              </button>
            ) : (
              <div className={`${CLASES_DE_FICHA} w-full`}>{contenido}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
