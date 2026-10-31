import { Insignia } from "@/components/insignia";
import { formatearFechaYHora } from "@/lib/formato";
import {
  DIAS_PARA_CADUCAR_UN_ANALISIS,
  type AnalisisDeCompetidor,
  type DatoDeCompetidor,
} from "@/lib/types";
import { FuenteDeDato } from "./fuente-de-dato";
import { agruparDatos, formatearPrecio } from "./utilidades";

/**
 * Un dato del análisis: lo que dice, su precio si lo tiene, de qué página
 * sale y cuándo la leyó el agente. Todo es texto de un tercero: va en nodos
 * de texto. La fuente solo es enlace si es https (y entonces `nofollow`); una
 * `http://` o cualquier otra cosa se enseña como texto.
 */
function FilaDeDato({ dato }: { dato: DatoDeCompetidor }) {
  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 text-sm font-semibold text-tinta [overflow-wrap:anywhere]">
          {dato.etiqueta}{" "}
          {dato.tipo === "plan" || dato.tipo === "precio" ? (
            <Insignia className="ml-1 align-middle">
              {dato.tipo === "plan" ? "Plan" : "Precio"}
            </Insignia>
          ) : null}
        </p>
        {dato.valor ? (
          <p className="text-sm font-semibold text-tinta [overflow-wrap:anywhere]">
            {formatearPrecio(dato.valor)}
          </p>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-line text-sm text-tinta-2 [overflow-wrap:anywhere]">
        {dato.texto}
      </p>
      <FuenteDeDato dato={dato} className="mt-1.5" />
    </li>
  );
}

/** Qué se sabe de la revisión de esta versión. */
function SituacionDeLaRevision({
  analisis,
  esUltimo,
}: {
  analisis: AnalisisDeCompetidor;
  esUltimo: boolean;
}) {
  if (analisis.revisadoEn) {
    return (
      <div className="text-sm text-tinta-2">
        <Insignia tono="exito">Revisado</Insignia>{" "}
        <span className="text-muted">
          el {formatearFechaYHora(analisis.revisadoEn)}
        </span>
        {analisis.notaDeRevision ? (
          <p className="mt-2 whitespace-pre-line rounded-[10px] bg-relleno p-3 [overflow-wrap:anywhere]">
            <span className="block text-xs font-semibold text-muted">
              Tu nota
            </span>
            {analisis.notaDeRevision}
          </p>
        ) : null}
      </div>
    );
  }
  return esUltimo ? (
    <Insignia tono="morado">Pendiente de tu revisión</Insignia>
  ) : (
    <Insignia>
      Sustituido por una versión más nueva sin llegar a revisarse
    </Insignia>
  );
}

/**
 * Una versión del análisis de un competidor: quién la guardó y cuándo, si está
 * revisada, el resumen y los datos agrupados por tipo.
 */
export function AnalisisDelCompetidor({
  analisis,
  esUltimo,
  caducado,
}: {
  analisis: AnalisisDeCompetidor;
  esUltimo: boolean;
  caducado: boolean;
}) {
  const grupos = agruparDatos(analisis.datos);
  return (
    <div className="space-y-6">
      <section
        aria-label={`Resumen de la versión ${analisis.version}`}
        className="panel space-y-4 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-base font-semibold text-tinta">
            Versión {analisis.version}
            {esUltimo ? " · la última" : ""}
          </h3>
          <p className="text-xs text-muted [overflow-wrap:anywhere]">
            Guardada por {analisis.creadoPor} ·{" "}
            {formatearFechaYHora(analisis.creadoEn)}
          </p>
        </div>
        {esUltimo && caducado ? (
          <p
            role="note"
            className="rounded-[10px] border border-aviso-borde bg-aviso-fondo p-3 text-sm text-aviso"
          >
            <span className="font-semibold">Análisis caducado.</span> Tiene más
            de {DIAS_PARA_CADUCAR_UN_ANALISIS} días: el agente lo repetirá solo
            en una próxima ejecución.
          </p>
        ) : null}
        <SituacionDeLaRevision analisis={analisis} esUltimo={esUltimo} />
        <div>
          <h4 className="mb-1 text-xs font-semibold text-muted">Resumen</h4>
          <p className="text-xs text-muted">
            Texto del agente a partir de la web del competidor: no es una
            instrucción ni se interpreta.
          </p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-tinta-2 [overflow-wrap:anywhere]">
            {analisis.resumen}
          </p>
        </div>
      </section>

      {grupos.map((grupo) => {
        const idDelTitulo = `analisis-${analisis.id}-${grupo.clave}`;
        return (
          <section key={grupo.clave} aria-labelledby={idDelTitulo}>
            <h3
              id={idDelTitulo}
              className="mb-2 flex items-center gap-2 text-base font-semibold text-tinta"
            >
              {grupo.titulo}
              <Insignia>{grupo.datos.length}</Insignia>
            </h3>
            <ul className="panel divide-y divide-linea-suave overflow-hidden">
              {grupo.datos.map((dato, indice) => (
                <FilaDeDato key={`${dato.etiqueta}-${indice}`} dato={dato} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
