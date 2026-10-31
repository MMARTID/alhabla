import Link from "next/link";
import type { ReactNode } from "react";
import { Insignia } from "@/components/insignia";
import { formatearFecha } from "@/lib/formato";
import type { DatoDeCompetidor, FilaDelComparador } from "@/lib/types";
import { FuenteDeDato } from "./fuente-de-dato";
import {
  columnasDeDatos,
  conMiles,
  precioDeEntrada,
  situacionDelAnalisis,
  type PlanDeAlhabla,
} from "./utilidades-del-comparador";
import { formatearPrecio, rutaDeCompetidor } from "./utilidades";

/**
 * La tabla del comparador. Una sola estructura para los dos tamaños: desde
 * `lg` es una tabla de verdad (cabecera y columnas) y por debajo cada fila se
 * apila como una tarjeta, con el nombre de la columna encima de cada celda.
 * Todo lo que escribió un modelo que leyó páginas ajenas (nombres, etiquetas,
 * textos) va en nodos de texto; el dominio nunca es un enlace y la fuente de
 * cada dato solo lo es si es https.
 */

const COLUMNAS = {
  competidor: "Competidor",
  precios: "Planes y precios",
  limites: "Minutos y límites",
  etiquetas: "Integraciones, idiomas y canales",
} as const;

function Celda({
  etiqueta,
  children,
  columnas,
  className = "",
  titulo = false,
}: {
  etiqueta: string;
  children: ReactNode;
  columnas?: number;
  className?: string;
  /** La celda que abre la tarjeta en el móvil: el nombre ya es el título, no lleva etiqueta. */
  titulo?: boolean;
}) {
  return (
    <td
      colSpan={columnas}
      className={`block py-2 lg:table-cell lg:px-4 lg:py-4 lg:align-top ${className}`}
    >
      {titulo ? null : (
        <span className="mb-1.5 block text-xs font-semibold text-muted lg:hidden">
          {etiqueta}
        </span>
      )}
      {children}
    </td>
  );
}

function SinDatos({ children = "—" }: { children?: ReactNode }) {
  return <p className="text-sm text-tenue">{children}</p>;
}

/** Un plan o un precio de un competidor, con su fuente y el día que se leyó. */
function DatoDePrecio({ dato }: { dato: DatoDeCompetidor }) {
  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
        <span className="min-w-0 font-semibold text-tinta [overflow-wrap:anywhere]">
          {dato.etiqueta}
        </span>
        {dato.valor ? (
          <span className="font-semibold text-tinta">
            {formatearPrecio(dato.valor)}
          </span>
        ) : null}
      </p>
      {dato.texto ? (
        <p className="mt-0.5 whitespace-pre-line text-xs text-tinta-2 [overflow-wrap:anywhere]">
          {dato.texto}
        </p>
      ) : null}
      <FuenteDeDato dato={dato} className="mt-1" />
    </li>
  );
}

function DatoDeLimite({ dato }: { dato: DatoDeCompetidor }) {
  return (
    <li className="py-2.5 first:pt-0 last:pb-0">
      <p className="text-sm font-semibold text-tinta [overflow-wrap:anywhere]">
        {dato.etiqueta}
      </p>
      {dato.texto ? (
        <p className="mt-0.5 whitespace-pre-line text-xs text-tinta-2 [overflow-wrap:anywhere]">
          {dato.texto}
        </p>
      ) : null}
      <FuenteDeDato dato={dato} className="mt-1" />
    </li>
  );
}

function CeldaDeCompetidor({ fila }: { fila: FilaDelComparador }) {
  const situacion = situacionDelAnalisis(fila);
  const entrada = precioDeEntrada(fila.datos);
  return (
    <Celda titulo etiqueta={COLUMNAS.competidor} className="lg:w-[22%]">
      <h3 className="text-base font-semibold leading-snug text-tinta [overflow-wrap:anywhere]">
        <Link
          href={rutaDeCompetidor(fila.competidorId)}
          className="rounded-sm underline decoration-linea-fuerte underline-offset-2 hover:decoration-morado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
        >
          {fila.nombre}
        </Link>
      </h3>
      <p className="mt-0.5 font-mono text-xs text-muted [overflow-wrap:anywhere]">
        {fila.dominio}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-1.5">
        <Insignia tono={situacion.tono}>{situacion.etiqueta}</Insignia>
        {situacion.caducado ? <Insignia tono="aviso">Caducado</Insignia> : null}
      </p>
      {fila.analisis ? (
        <p className="mt-2 text-xs text-muted">
          Análisis v{fila.analisis.version} ·{" "}
          {formatearFecha(fila.analisis.creadoEn)}
        </p>
      ) : null}
      {entrada ? (
        <p className="mt-1 text-xs font-semibold text-tinta-2">
          {entrada.texto}
        </p>
      ) : null}
    </Celda>
  );
}

function FilaDeCompetidor({ fila }: { fila: FilaDelComparador }) {
  const columnas = columnasDeDatos(fila.datos);
  const base =
    "block max-lg:rounded-3xl max-lg:border max-lg:border-linea max-lg:bg-superficie max-lg:p-4 lg:table-row lg:border-t lg:border-linea-suave";
  if (!fila.analisis) {
    return (
      <tr className={base}>
        <CeldaDeCompetidor fila={fila} />
        <Celda etiqueta="Análisis" columnas={3}>
          <SinDatos>
            Todavía no hay análisis: el agente lo leerá en su próxima ejecución
            y aquí saldrán sus planes y precios.
          </SinDatos>
        </Celda>
      </tr>
    );
  }
  return (
    <tr className={base}>
      <CeldaDeCompetidor fila={fila} />
      <Celda etiqueta={COLUMNAS.precios} className="lg:w-[34%]">
        {columnas.precios.length > 0 ? (
          <ul className="divide-y divide-linea-suave">
            {columnas.precios.map((dato, i) => (
              <DatoDePrecio key={`${dato.etiqueta}-${i}`} dato={dato} />
            ))}
          </ul>
        ) : (
          <SinDatos>El análisis no recoge precios.</SinDatos>
        )}
      </Celda>
      <Celda etiqueta={COLUMNAS.limites} className="lg:w-[22%]">
        {columnas.limites.length > 0 ? (
          <ul className="divide-y divide-linea-suave">
            {columnas.limites.map((dato, i) => (
              <DatoDeLimite key={`${dato.etiqueta}-${i}`} dato={dato} />
            ))}
          </ul>
        ) : (
          <SinDatos />
        )}
      </Celda>
      <Celda etiqueta={COLUMNAS.etiquetas} className="lg:w-[22%]">
        {columnas.etiquetas.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {columnas.etiquetas.map((dato, i) => (
              <li key={`${dato.etiqueta}-${i}`}>
                <Insignia envolver className="font-medium">
                  <span title={dato.texto || undefined}>{dato.etiqueta}</span>
                </Insignia>
              </li>
            ))}
          </ul>
        ) : (
          <SinDatos />
        )}
      </Celda>
    </tr>
  );
}

/** El importe de una cuota de Alhabla, siempre «+ IVA al mes». */
function cuotaDeAlhabla(plan: PlanDeAlhabla): string | null {
  return plan.cuota === null
    ? null
    : formatearPrecio({
        importe: plan.cuota,
        moneda: "EUR",
        periodo: "mes",
        ivaIncluido: false,
      });
}

/** «0,30 € por minuto extra · IVA no incluido». */
function minutoExtraDeAlhabla(importe: number): string {
  const porMinuto = formatearPrecio({
    importe,
    moneda: "EUR",
    periodo: "uso",
    unidad: "minuto",
  });
  return `${porMinuto} extra · IVA no incluido`;
}

function FilaDeAlhabla({
  planes,
  estado,
}: {
  planes: PlanDeAlhabla[] | null;
  estado: "cargando" | "error" | "listo";
}) {
  const base =
    "block max-lg:rounded-3xl max-lg:border max-lg:border-lavado-borde max-lg:bg-lavado max-lg:p-4 lg:table-row lg:bg-lavado";
  const aviso =
    estado === "cargando"
      ? "Cargando los precios de Alhabla…"
      : estado === "error"
        ? "No se pudieron cargar los precios de Alhabla. Recarga la página."
        : "No hay planes vigentes en la base de conocimiento. Sincronízala desde Conocimiento.";
  return (
    <tr className={base}>
      <Celda titulo etiqueta={COLUMNAS.competidor} className="lg:w-[22%]">
        <h3 className="text-base font-semibold leading-snug text-tinta">
          Alhabla
        </h3>
        <p className="mt-0.5 font-mono text-xs text-muted">alhabla.ai</p>
        <p className="mt-2">
          <Insignia tono="morado">Tu precio</Insignia>
        </p>
        <p className="mt-2 text-xs text-muted">Base de conocimiento vigente</p>
      </Celda>
      {planes && planes.length > 0 ? (
        <>
          <Celda etiqueta={COLUMNAS.precios} className="lg:w-[34%]">
            <ul className="divide-y divide-lavado-borde">
              {planes.map((plan) => (
                <li key={plan.clave} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="font-semibold text-tinta">
                      {plan.nombre}
                    </span>
                    <span className="font-semibold text-tinta">
                      {cuotaDeAlhabla(plan) ?? plan.texto}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted [overflow-wrap:anywhere]">
                    Fuente: <span className="font-mono">{plan.fuente}</span> ·
                    vigente desde el {formatearFecha(plan.vigenteDesde)}
                  </p>
                </li>
              ))}
            </ul>
          </Celda>
          <Celda etiqueta={COLUMNAS.limites} className="lg:w-[22%]">
            <ul className="divide-y divide-lavado-borde">
              {planes.map((plan) => (
                <li key={plan.clave} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-sm font-semibold text-tinta">
                    {plan.nombre}
                  </p>
                  <p className="mt-0.5 text-xs text-tinta-2">
                    {plan.minutosIncluidos !== null
                      ? `${conMiles(plan.minutosIncluidos)} minutos incluidos`
                      : "Minutos incluidos: ver el texto del plan"}
                    {plan.minutoExtra !== null
                      ? ` · ${minutoExtraDeAlhabla(plan.minutoExtra)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          </Celda>
          <Celda etiqueta={COLUMNAS.etiquetas} className="lg:w-[22%]">
            <SinDatos />
          </Celda>
        </>
      ) : (
        <Celda etiqueta={COLUMNAS.precios} columnas={3}>
          <SinDatos>{aviso}</SinDatos>
        </Celda>
      )}
    </tr>
  );
}

export function TablaDelComparador({
  filas,
  planesDeAlhabla,
  estadoDeAlhabla,
}: {
  filas: readonly FilaDelComparador[];
  planesDeAlhabla: PlanDeAlhabla[] | null;
  estadoDeAlhabla: "cargando" | "error" | "listo";
}) {
  return (
    <div className="lg:panel lg:overflow-hidden">
      <table className="block w-full text-left lg:table">
        <caption className="sr-only">
          Planes, precios y límites de Alhabla y de sus competidores, ordenados
          por precio de entrada
        </caption>
        <thead className="hidden lg:table-header-group">
          <tr className="border-b border-linea bg-relleno text-xs text-muted">
            <th scope="col" className="px-4 py-3 font-semibold">
              {COLUMNAS.competidor}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {COLUMNAS.precios}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {COLUMNAS.limites}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {COLUMNAS.etiquetas}
            </th>
          </tr>
        </thead>
        <tbody className="block space-y-3 lg:table-row-group lg:space-y-0">
          <FilaDeAlhabla planes={planesDeAlhabla} estado={estadoDeAlhabla} />
          {filas.map((fila) => (
            <FilaDeCompetidor key={fila.competidorId} fila={fila} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
