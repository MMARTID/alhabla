import { BookOpen, ShieldAlert, TriangleAlert } from "lucide-react";
import { InsigniaDeResultado } from "@/components/insignia";
import { ListaDeComprobaciones } from "@/components/lista-de-comprobaciones";
import {
  formatearFecha,
  formatearFechaYHora,
  formatearPorcentaje,
  commitCorto,
  formatearDistancia,
} from "@/lib/formato";
import type {
  AfirmacionDetallada,
  BorradorDetallado,
  DetalleDeOportunidad,
} from "@/lib/types";
import { esBloqueo, ordenarComprobaciones, revisionDeReglas } from "./edicion";

function FilaDeAfirmacion({ afirmacion }: { afirmacion: AfirmacionDetallada }) {
  const problema = !afirmacion.existe
    ? "No existe en la base de conocimiento."
    : !afirmacion.vigente
      ? `Cerrada el ${formatearFecha(afirmacion.vigenteHasta)}: ya no está vigente.`
      : null;
  return (
    <li className="text-sm">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <code className="rounded bg-relleno-fuerte px-1.5 py-0.5 text-xs text-tinta [overflow-wrap:anywhere]">
          {afirmacion.clave}
        </code>
        {problema ? (
          <span className="text-xs font-semibold text-error">{problema}</span>
        ) : null}
      </p>
      {afirmacion.texto ? (
        <p className="mt-1 text-tinta-2 [overflow-wrap:anywhere]">
          {afirmacion.texto}
        </p>
      ) : null}
      {afirmacion.existe ? (
        <p className="mt-0.5 text-xs text-muted [overflow-wrap:anywhere]">
          Fuente: {afirmacion.fuente ?? "—"} · commit{" "}
          {commitCorto(afirmacion.commitSha)}
        </p>
      ) : null}
    </li>
  );
}

/**
 * El panel de cumplimiento: lo que dijeron las reglas del borrador que estás
 * viendo. Lo que bloquea sale en rojo, los avisos en ámbar y lo correcto en
 * verde; después, las afirmaciones sobre Alhabla que usa el texto con su
 * fuente y su commit, el parecido con la versión anterior y los topes de
 * contacto. Las reglas se evalúan en el backend: aquí solo se leen.
 */
export function PanelDeCumplimiento({
  borrador,
  oportunidad,
}: {
  borrador: BorradorDetallado | null;
  oportunidad: DetalleDeOportunidad;
}) {
  const { contacto } = oportunidad;
  const revision = borrador ? revisionDeReglas(borrador) : null;
  const comprobaciones = revision?.comprobaciones ?? [];
  const bloqueos = comprobaciones.filter(esBloqueo).length;
  const avisos = comprobaciones.filter((c) => !c.ok && !c.dura).length;
  const correctas = comprobaciones.filter((c) => c.ok).length;
  const consultivas = borrador
    ? borrador.revisiones.filter((r) => r.revisor !== "reglas")
    : [];
  const consultiva = consultivas[0] ?? null;
  const parecido = borrador?.similitudConVersionAnterior ?? null;
  // El umbral lo pone el backend (ajustable en Ajustes): aquí no se inventa
  // otro. Es un aviso cuando la regla blanda de la última revisión falla.
  const parecidoAlto = comprobaciones.some(
    (c) => c.regla === "similitud_con_version_anterior" && !c.ok
  );
  const enfriamiento = contacto.dominioEnEnfriamientoHasta;

  return (
    <section
      aria-labelledby="revision-cumplimiento"
      className="panel space-y-5 p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="revision-cumplimiento"
          className="text-sm font-semibold text-tinta"
        >
          Cumplimiento
        </h2>
        {revision ? (
          <InsigniaDeResultado resultado={revision.resultado} />
        ) : null}
      </div>

      {!borrador ? (
        <p className="text-sm text-muted">
          Sin borrador no hay nada que evaluar.
        </p>
      ) : !revision ? (
        <p className="rounded-[10px] bg-relleno p-3 text-sm text-muted">
          Este borrador aún no se ha evaluado. Las reglas corren cuando lo crea
          el agente y cada vez que guardas un cambio.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Reglas del servidor · {formatearDistancia(revision.creadaEn)} ·{" "}
            {bloqueos} {bloqueos === 1 ? "bloquea" : "bloquean"} · {avisos}{" "}
            {avisos === 1 ? "aviso" : "avisos"} · {correctas}{" "}
            {correctas === 1 ? "correcta" : "correctas"}
          </p>
          <ListaDeComprobaciones
            comprobaciones={ordenarComprobaciones(comprobaciones)}
          />
        </div>
      )}

      {parecido !== null ? (
        <div
          className={`flex items-start gap-2.5 rounded-[10px] border p-3 text-sm ${parecidoAlto ? "border-aviso-borde bg-aviso-fondo" : "border-linea bg-relleno"}`}
        >
          {parecidoAlto ? (
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-aviso"
              aria-hidden="true"
            />
          ) : null}
          <p className={parecidoAlto ? "text-aviso" : "text-tinta-2"}>
            <span className="font-semibold">
              Similitud con la versión anterior: {formatearPorcentaje(parecido)}
            </span>
            {parecidoAlto
              ? ". Comprueba que esta versión cambia de verdad lo que había que cambiar."
              : "."}
          </p>
        </div>
      ) : null}

      {consultiva ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-tinta">
            Revisión consultiva
          </h3>
          <p className="text-xs text-muted">
            La hace un modelo y no bloquea: es una segunda opinión.
          </p>
          <ListaDeComprobaciones
            comprobaciones={ordenarComprobaciones(consultiva.comprobaciones)}
          />
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-tinta">
          <BookOpen className="h-4 w-4 text-morado" aria-hidden="true" />
          Afirmaciones usadas
        </h3>
        {!borrador || borrador.afirmacionesDetalle.length === 0 ? (
          <p className="text-sm text-muted">
            {borrador
              ? "Este borrador no cita ninguna afirmación sobre Alhabla."
              : "—"}
          </p>
        ) : (
          <ul className="space-y-3">
            {borrador.afirmacionesDetalle.map((afirmacion) => (
              <FilaDeAfirmacion
                key={afirmacion.clave}
                afirmacion={afirmacion}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1.5 border-t border-linea-suave pt-4 text-sm">
        <h3 className="flex items-center gap-2 font-semibold text-tinta">
          <ShieldAlert className="h-4 w-4 text-morado" aria-hidden="true" />
          Topes de contacto
        </h3>
        <p className="text-tinta-2">
          Esta semana: {contacto.contactosEstaSemana} de {contacto.topeSemanal}{" "}
          contactos.
        </p>
        <p
          className={enfriamiento ? "font-semibold text-aviso" : "text-tinta-2"}
        >
          {enfriamiento
            ? `${oportunidad.dominio} está en enfriamiento hasta el ${formatearFechaYHora(enfriamiento)}.`
            : `${oportunidad.dominio} no se ha contactado en los últimos 90 días.`}
        </p>
      </div>
    </section>
  );
}
