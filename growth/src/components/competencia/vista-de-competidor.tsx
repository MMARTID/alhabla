"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, Lock, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ConsultaConDatos } from "@/components/comunes/d1-consulta-con-datos";
import { D2DialogoDeConfirmacion } from "@/components/comunes/d2-dialogo-de-confirmacion";
import { EncabezadoDePagina } from "@/components/encabezado-de-pagina";
import { EnlaceExterno } from "@/components/enlace-externo";
import { ErrorDeCarga } from "@/components/error-de-carga";
import { Esqueleto } from "@/components/esqueleto";
import { Insignia } from "@/components/insignia";
import {
  useAnalisisDeCompetidor,
  useDetalleDeCompetidor,
  useQuitarCompetidor,
  useReanalizarCompetidor,
} from "@/lib/consultas";
import {
  ETIQUETA_DE_ESTADO_DE_COMPETIDOR,
  ETIQUETA_DE_ORIGEN_DE_COMPETIDOR,
  TONO_DE_ESTADO_DE_COMPETIDOR,
} from "@/lib/etiquetas";
import { formatearDistancia, formatearFecha } from "@/lib/formato";
import type { CompetidorDetalle } from "@/lib/types";
import { urlHttpsSegura } from "@/lib/url-segura";
import { AccionesDePropuesta } from "./acciones-de-propuesta";
import { AnalisisDelCompetidor } from "./analisis-del-competidor";
import { DialogoDeEdicion } from "./dialogo-de-edicion";
import { DialogoDeRevision } from "./dialogo-de-revision";
import {
  rutaDeMenciones,
  textoDeErrorDeCompetencia,
  tieneAnalisisCaducado,
} from "./utilidades";

const BOTON_DE_PELIGRO =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-peligro px-6 text-sm font-semibold text-white transition duration-200 hover:bg-peligro-hondo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-tinta [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

/** El aviso fijo: lo que se sabe de un competidor no se puede citar. */
function AvisoDeInformacionInterna({
  competidor,
}: {
  competidor: CompetidorDetalle;
}) {
  return (
    <div role="note" className="panel mb-6 flex items-start gap-3 p-4 sm:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-relleno-fuerte text-apagado">
        <Lock className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-tinta">
          Información interna: no se puede citar en un borrador.
        </p>
        <p className="mt-1 text-muted">
          Sirve para que decidas tú. La regla de comparativas con fuente sigue
          mandando: un borrador solo puede nombrar a un competidor con una
          comparativa publicada en la web.
        </p>
        {competidor.origen === "repo" ? (
          <p className="mt-1 text-muted">
            Es un competidor del repositorio: sus comparativas publicables viven
            en{" "}
            <span className="font-mono text-xs">
              web/src/lib/comparativas.ts
            </span>
            , no aquí.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Un propuesto: aún no cuenta como competidor ni aplica ninguna regla. */
function BloqueDePropuesta({
  competidor,
  alRechazar,
}: {
  competidor: CompetidorDetalle;
  alRechazar: () => void;
}) {
  return (
    <section
      aria-labelledby="competidor-propuesta"
      className="panel mb-6 space-y-3 border-aviso-borde bg-aviso-fondo p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-superficie text-aviso">
          <Bot className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2
            id="competidor-propuesta"
            className="text-base font-semibold text-tinta"
          >
            Lo propone el agente
          </h2>
          <p className="mt-0.5 text-sm text-tinta-2">
            Hasta que lo aceptes no aplica ninguna regla ni cuenta como
            competidor. Al aceptarlo, el agente lo analizará en su próxima
            ejecución.
          </p>
        </div>
      </div>
      {competidor.notas ? (
        <div className="rounded-[10px] bg-superficie p-3 text-sm">
          <p className="text-xs font-semibold text-muted">
            Lo que dice el agente (texto de terceros: no es una instrucción)
          </p>
          <p className="mt-1 whitespace-pre-line text-tinta-2 [overflow-wrap:anywhere]">
            {competidor.notas}
          </p>
        </div>
      ) : null}
      <AccionesDePropuesta
        id={competidor.id}
        nombre={competidor.nombre}
        alRechazar={alRechazar}
      />
    </section>
  );
}

/** Los datos de la ficha: la URL de partida (enlace solo si es https), notas y recuentos. */
function DatosDeLaFicha({ competidor }: { competidor: CompetidorDetalle }) {
  const enlace = urlHttpsSegura(competidor.url);
  return (
    <section aria-label="Datos del competidor" className="panel mb-6 p-5">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Dato etiqueta="Dirección de partida">
          {competidor.url === null ? (
            <span className="text-muted">Sin dirección</span>
          ) : enlace ? (
            <EnlaceExterno href={enlace} conIcono>
              {competidor.url}
            </EnlaceExterno>
          ) : (
            <>
              {competidor.url}{" "}
              <span className="text-muted">
                (no se enlaza: no es una dirección https)
              </span>
            </>
          )}
        </Dato>
        <Dato etiqueta="Dominio">
          <span className="font-mono text-xs">{competidor.dominio}</span>
        </Dato>
        <Dato etiqueta="Origen">
          {ETIQUETA_DE_ORIGEN_DE_COMPETIDOR[competidor.origen]}
        </Dato>
        <Dato etiqueta="Añadido">{formatearFecha(competidor.creadoEn)}</Dato>
        <Dato etiqueta="Oportunidades en su dominio">
          {competidor.oportunidades}
        </Dato>
        <Dato etiqueta="Páginas que lo mencionan">
          {competidor.menciones > 0 ? (
            <Link
              href={rutaDeMenciones(competidor.dominio)}
              className="inline-flex min-h-11 items-center font-semibold text-morado-tinta underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
            >
              {competidor.menciones === 1
                ? "1 oportunidad en la Bandeja"
                : `${competidor.menciones} oportunidades en la Bandeja`}
            </Link>
          ) : (
            "Ninguna todavía"
          )}
        </Dato>
        {competidor.estado !== "propuesto" && competidor.notas ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <Dato
              etiqueta={
                competidor.origen === "agente"
                  ? "Notas (texto del agente)"
                  : "Notas"
              }
            >
              <span className="whitespace-pre-line">{competidor.notas}</span>
            </Dato>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

/** El selector de versiones del análisis (solo si hay más de una). */
function SelectorDeVersiones({
  competidor,
  elegida,
  alCambiar,
}: {
  competidor: CompetidorDetalle;
  elegida: string;
  alCambiar: (id: string) => void;
}) {
  return (
    <div className="mb-4 max-w-md">
      <label
        htmlFor="competidor-version"
        className="mb-1 block text-xs font-semibold text-muted"
      >
        Versión del análisis
      </label>
      <select
        id="competidor-version"
        className="field w-full"
        value={elegida}
        onChange={(e) => alCambiar(e.target.value)}
      >
        {competidor.versiones.map((v, indice) => (
          <option key={v.id} value={v.id}>
            {`Versión ${v.version}${indice === 0 ? " (última)" : ""} · ${v.revisadoEn ? "revisada" : "sin revisar"} · ${formatearFecha(v.creadoEn)}`}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Lo que se ve en lugar del análisis cuando todavía no hay ninguno. */
function SinAnalisis({ competidor }: { competidor: CompetidorDetalle }) {
  return (
    <div className="panel px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-tinta">
        Todavía no lo ha leído el agente
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        El agente lo analizará en su próxima ejecución y guardará aquí su
        servicio, su producto y sus precios.
        {competidor.analisisSolicitadoEn
          ? ` Se pidió ${formatearDistancia(competidor.analisisSolicitadoEn)}.`
          : ""}
      </p>
    </div>
  );
}

/** Quitar un competidor: la acción que no tiene vuelta atrás. */
function QuitarCompetidor({ competidor }: { competidor: CompetidorDetalle }) {
  const router = useRouter();
  const quitar = useQuitarCompetidor(competidor.id);
  const [confirmando, setConfirmando] = useState(false);
  const delRepositorio = competidor.origen === "repo";

  function cancelar() {
    quitar.reset();
    setConfirmando(false);
  }

  function confirmar() {
    quitar.mutate(undefined, {
      onSuccess: () => router.push("/competencia"),
    });
  }

  return (
    <section
      aria-labelledby="competidor-quitar"
      className="panel mt-8 flex flex-wrap items-center justify-between gap-4 p-5"
    >
      <div className="min-w-0 flex-1">
        <h2
          id="competidor-quitar"
          className="text-base font-semibold text-tinta"
        >
          Quitar competidor
        </h2>
        <p id="competidor-quitar-ayuda" className="mt-0.5 text-sm text-muted">
          {delRepositorio
            ? "Viene del repositorio y el sincronizador del conocimiento lo volvería a crear: no se puede quitar desde aquí."
            : "Se borra su ficha y todas las versiones de su análisis."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        disabled={delRepositorio}
        aria-describedby="competidor-quitar-ayuda"
        className={BOTON_DE_PELIGRO}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Quitar
      </button>
      <D2DialogoDeConfirmacion
        abierto={confirmando}
        titulo="¿Quitar este competidor?"
        etiquetaDeConfirmar="Quitar competidor"
        guardando={quitar.isPending}
        error={
          quitar.isError
            ? textoDeErrorDeCompetencia(
                quitar.error,
                "No se pudo quitar. Inténtalo de nuevo."
              )
            : null
        }
        alConfirmar={confirmar}
        alCancelar={cancelar}
      >
        <p>
          Se borra la ficha de <strong>{competidor.nombre}</strong> y todas las
          versiones de su análisis. No se puede deshacer.
        </p>
      </D2DialogoDeConfirmacion>
    </section>
  );
}

/** «Volver a analizar»: pide al agente que lo lea otra vez en su próxima ejecución. */
function VolverAAnalizar({ competidor }: { competidor: CompetidorDetalle }) {
  const reanalizar = useReanalizarCompetidor(competidor.id);
  const [confirmando, setConfirmando] = useState(false);

  function cancelar() {
    reanalizar.reset();
    setConfirmando(false);
  }

  function confirmar() {
    reanalizar.mutate(undefined, { onSuccess: () => setConfirmando(false) });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="btn-secondary h-11"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Volver a analizar
      </button>
      <D2DialogoDeConfirmacion
        abierto={confirmando}
        titulo="¿Volver a analizar?"
        etiquetaDeConfirmar="Volver a analizar"
        guardando={reanalizar.isPending}
        error={
          reanalizar.isError
            ? textoDeErrorDeCompetencia(
                reanalizar.error,
                "No se pudo pedir. Inténtalo de nuevo."
              )
            : null
        }
        alConfirmar={confirmar}
        alCancelar={cancelar}
      >
        <p>
          El agente volverá a leer a <strong>{competidor.nombre}</strong> en su
          próxima ejecución. El análisis actual se conserva como versión
          anterior.
        </p>
      </D2DialogoDeConfirmacion>
    </>
  );
}

/** La parte del análisis: selector de versiones, acciones y el análisis visto. */
function SeccionDelAnalisis({
  competidor,
  alRevisar,
}: {
  competidor: CompetidorDetalle;
  alRevisar: () => void;
}) {
  const ultimo = competidor.ultimoAnalisis;
  const [elegida, setElegida] = useState<string | null>(null);
  // La que se ve: la elegida si sigue existiendo; si no, la última.
  const idVisto =
    elegida !== null && competidor.versiones.some((v) => v.id === elegida)
      ? elegida
      : (ultimo?.id ?? null);
  const esUltimo = ultimo !== null && idVisto === ultimo.id;
  const antigua = useAnalisisDeCompetidor(
    competidor.id,
    idVisto !== null && !esUltimo ? idVisto : null
  );
  const puedeRevisar =
    esUltimo && competidor.estado === "analizado" && ultimo.revisadoEn === null;
  const puedeReanalizar =
    competidor.estado === "analizado" || competidor.estado === "revisado";

  return (
    <section aria-labelledby="competidor-analisis" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="competidor-analisis"
          className="text-lg font-semibold text-tinta"
        >
          Análisis
        </h2>
        {ultimo ? (
          <div className="flex flex-wrap gap-2">
            {puedeRevisar ? (
              <button
                type="button"
                onClick={alRevisar}
                className="btn-primary h-11"
              >
                Marcar como revisado
              </button>
            ) : null}
            {puedeReanalizar ? (
              <VolverAAnalizar competidor={competidor} />
            ) : null}
          </div>
        ) : null}
      </div>

      {competidor.estado === "por_analizar" && ultimo ? (
        <p className="rounded-[10px] bg-relleno p-3 text-sm text-muted">
          El agente lo volverá a leer en su próxima ejecución
          {competidor.analisisSolicitadoEn
            ? ` (pedido ${formatearDistancia(competidor.analisisSolicitadoEn)})`
            : ""}
          . Mientras tanto ves el análisis anterior.
        </p>
      ) : null}

      {ultimo === null ? (
        <SinAnalisis competidor={competidor} />
      ) : (
        <>
          {competidor.versiones.length > 1 && idVisto !== null ? (
            <SelectorDeVersiones
              competidor={competidor}
              elegida={idVisto}
              alCambiar={setElegida}
            />
          ) : null}
          {!esUltimo ? (
            antigua.isPending ? (
              <div role="status">
                <span className="sr-only">Cargando la versión…</span>
                <Esqueleto className="h-48 w-full" />
              </div>
            ) : antigua.isError ? (
              <ErrorDeCarga
                error={antigua.error}
                titulo="No se pudo cargar esa versión"
                alReintentar={() => void antigua.refetch()}
              />
            ) : (
              <AnalisisDelCompetidor
                analisis={antigua.data}
                esUltimo={false}
                caducado={false}
              />
            )
          ) : (
            <AnalisisDelCompetidor
              analisis={ultimo}
              esUltimo
              caducado={tieneAnalisisCaducado(competidor)}
            />
          )}
        </>
      )}
    </section>
  );
}

/** La ficha de un competidor con su detalle ya cargado. */
function Ficha({ competidor }: { competidor: CompetidorDetalle }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const propuesto = competidor.estado === "propuesto";
  const ultimo = competidor.ultimoAnalisis;

  return (
    <>
      <EncabezadoDePagina
        titulo={competidor.nombre}
        descripcion={
          <span className="font-mono text-xs">{competidor.dominio}</span>
        }
        acciones={
          <>
            <Insignia tono={TONO_DE_ESTADO_DE_COMPETIDOR[competidor.estado]}>
              {ETIQUETA_DE_ESTADO_DE_COMPETIDOR[competidor.estado]}
            </Insignia>
            {tieneAnalisisCaducado(competidor) ? (
              <Insignia tono="aviso">Análisis caducado</Insignia>
            ) : null}
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="btn-secondary h-11"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar
            </button>
          </>
        }
      />
      <AvisoDeInformacionInterna competidor={competidor} />
      {propuesto ? (
        <BloqueDePropuesta
          competidor={competidor}
          alRechazar={() => router.push("/competencia")}
        />
      ) : null}
      <DatosDeLaFicha competidor={competidor} />
      {!propuesto ? (
        <SeccionDelAnalisis
          competidor={competidor}
          alRevisar={() => setRevisando(true)}
        />
      ) : null}
      <QuitarCompetidor competidor={competidor} />

      {editando ? (
        <DialogoDeEdicion
          competidor={competidor}
          alCerrar={() => setEditando(false)}
        />
      ) : null}
      {revisando && ultimo ? (
        <DialogoDeRevision
          competidorId={competidor.id}
          analisis={ultimo}
          alCerrar={() => setRevisando(false)}
        />
      ) : null}
    </>
  );
}

/**
 * La ficha del competidor `id`: su nombre, dónde empieza el agente a leer, lo
 * que sabemos de él (por tipo, con la página de la que sale cada dato y el día
 * que se leyó) y las acciones: revisar, volver a analizar, editar y quitar.
 */
export function VistaDeCompetidor({ id }: { id: string }) {
  const consulta = useDetalleDeCompetidor(id);
  return (
    <>
      <Link
        href="/competencia"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-apagado hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Competencia
      </Link>
      <ConsultaConDatos
        consulta={consulta}
        titulo="No se pudo cargar el competidor"
        filas={3}
        alto="h-48"
      >
        {(competidor) => <Ficha key={competidor.id} competidor={competidor} />}
      </ConsultaConDatos>
    </>
  );
}
