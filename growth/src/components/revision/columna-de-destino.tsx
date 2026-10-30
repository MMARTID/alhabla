import Link from "next/link";
import { EnlaceExterno } from "@/components/enlace-externo";
import { useNombresDeCompetidores } from "@/components/competencia/use-nombres-de-competidores";
import { rutaDeMenciones } from "@/components/competencia/utilidades";
import { ChipDeCaducidad } from "@/components/comunes/d1-caducidad";
import { Insignia } from "@/components/insignia";
import {
  ETIQUETA_DE_OBJETIVO,
  ETIQUETA_DE_TIPO_DE_DESTINO,
  etiquetaCortaDeObjetivo,
  etiquetaDeAccionDelRegistro,
  etiquetaDeAutor,
  etiquetaDeCodigoDeDescarte,
} from "@/lib/etiquetas";
import { formatearFecha, formatearFechaYHora } from "@/lib/formato";
import {
  OBJETIVOS,
  type DetalleDeOportunidad,
  type Investigacion,
  type ViaDeContacto,
} from "@/lib/types";
import { esUrlWeb } from "@/lib/url-segura";

const ETIQUETA_DE_VIA: Record<ViaDeContacto, string> = {
  formulario: "Formulario",
  email_editorial: "Correo editorial",
  alta_directorio: "Alta en directorio",
};

const ETIQUETA_DE_ENLACE_ESPERADO = {
  dofollow: "Dofollow",
  nofollow: "Nofollow",
  ugc: "UGC",
  sponsored: "Patrocinado",
  desconocido: "Sin determinar",
} as const;

const ETIQUETA_DE_DIFICULTAD = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
} as const;

function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
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

/**
 * El extracto de la página. Es texto de un tercero: va en un nodo de texto
 * (nunca como HTML). Si la retención lo purgó, se dice.
 */
function Extracto({ oportunidad }: { oportunidad: DetalleDeOportunidad }) {
  const vacio = oportunidad.extracto.trim() === "";
  if (
    oportunidad.extractoPurgado ||
    (vacio && oportunidad.estado !== "detectada")
  ) {
    return (
      <p className="rounded-[10px] bg-relleno p-3 text-sm text-muted">
        Texto de terceros retirado por retención.
      </p>
    );
  }
  if (vacio) {
    return (
      <p className="rounded-[10px] bg-relleno p-3 text-sm text-muted">
        Todavía sin extracto: el agente aún no ha leído la página.
      </p>
    );
  }
  return (
    <p className="max-h-52 overflow-y-auto whitespace-pre-line rounded-[10px] border border-linea bg-relleno p-3 text-sm leading-relaxed text-tinta-2 [overflow-wrap:anywhere]">
      {oportunidad.extracto}
    </p>
  );
}

function BloqueDeInvestigacion({
  investigacion,
}: {
  investigacion: Investigacion;
}) {
  const urlContacto =
    typeof investigacion.contexto?.urlContacto === "string"
      ? investigacion.contexto.urlContacto
      : null;
  const competidores = investigacion.competidoresEnlazados;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-tinta">Investigación</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-tinta-2 [overflow-wrap:anywhere]">
        {investigacion.resumen}
      </p>
      <dl className="space-y-3">
        <Dato etiqueta="Quién edita">
          {investigacion.quienEdita ?? "No consta"}
        </Dato>
        <Dato etiqueta="Vía de contacto">
          {investigacion.viaDeContacto
            ? ETIQUETA_DE_VIA[investigacion.viaDeContacto]
            : "No consta"}
        </Dato>
        {urlContacto ? (
          <Dato etiqueta="Dónde contactar">
            {esUrlWeb(urlContacto) ? (
              <EnlaceExterno href={urlContacto} conIcono>
                {urlContacto}
              </EnlaceExterno>
            ) : (
              <>
                {urlContacto}{" "}
                <span className="text-muted">
                  (no es una dirección web válida: no se enlaza)
                </span>
              </>
            )}
          </Dato>
        ) : null}
        <Dato etiqueta="Ya enlaza a">
          {competidores === null
            ? "No consta"
            : competidores.length === 0
              ? "Ningún competidor conocido"
              : `${competidores.length} ${competidores.length === 1 ? "competidor" : "competidores"}: ${competidores.join(", ")}`}
        </Dato>
        <Dato etiqueta="Investigada">
          {formatearFecha(investigacion.creadaEn)}
        </Dato>
      </dl>
    </div>
  );
}

/**
 * La columna de la izquierda de la Revisión: el destino (la página) y lo que
 * el agente averiguó de ella. Todo lo que viene de fuera (título, extracto,
 * resumen, nombres, enlaces) se pinta como texto, y un enlace solo es enlace
 * si la URL es http(s).
 */
export function ColumnaDeDestino({
  oportunidad,
  ahora,
}: {
  oportunidad: DetalleDeOportunidad;
  ahora: number;
}) {
  const devolucion =
    oportunidad.estado === "devuelta"
      ? oportunidad.decisiones.find((d) => d.accion === "devolver")
      : undefined;
  const datos = oportunidad.datos;
  const menciones = datos?.competidoresMencionados ?? [];
  const { nombres } = useNombresDeCompetidores();
  return (
    <section aria-labelledby="revision-destino" className="panel space-y-5 p-5">
      <h2 id="revision-destino" className="text-sm font-semibold text-tinta">
        Destino e investigación
      </h2>

      {devolucion ? (
        <div className="rounded-[10px] border border-aviso-borde bg-aviso-fondo p-3 text-sm text-aviso">
          <p className="font-semibold">Nota de devolución</p>
          <p className="mt-1 whitespace-pre-line text-tinta-2">
            {devolucion.motivo ?? "Sin nota."}
          </p>
        </div>
      ) : null}

      {oportunidad.estado === "descartada" && oportunidad.motivoDescarte ? (
        <div className="rounded-[10px] border border-linea bg-relleno p-3 text-sm">
          <p className="font-semibold text-tinta">
            Descartada
            {oportunidad.codigoDescarte
              ? ` · ${etiquetaDeCodigoDeDescarte(oportunidad.codigoDescarte)}`
              : ""}
          </p>
          <p className="mt-1 text-tinta-2">{oportunidad.motivoDescarte}</p>
        </div>
      ) : null}

      <dl className="space-y-3">
        <Dato etiqueta="Dirección">
          <EnlaceExterno href={oportunidad.url} conIcono>
            {oportunidad.url}
          </EnlaceExterno>
        </Dato>
        <Dato etiqueta="Fuente">{oportunidad.fuente.nombre}</Dato>
        {oportunidad.nicho ? (
          <Dato etiqueta="Nicho">{oportunidad.nicho.nombre}</Dato>
        ) : null}
        {datos?.tipoDestino ? (
          <Dato etiqueta="Tipo de destino">
            {ETIQUETA_DE_TIPO_DE_DESTINO[datos.tipoDestino]}
          </Dato>
        ) : null}
        {datos?.enlaceEsperado ? (
          <Dato etiqueta="Enlace esperado">
            {ETIQUETA_DE_ENLACE_ESPERADO[datos.enlaceEsperado]}
          </Dato>
        ) : null}
        {datos?.dificultad ? (
          <Dato etiqueta="Dificultad">
            {ETIQUETA_DE_DIFICULTAD[datos.dificultad]}
          </Dato>
        ) : null}
        {datos?.nota ? <Dato etiqueta="Nota">{datos.nota}</Dato> : null}
        {menciones.length > 0 ? (
          <Dato etiqueta="Menciona a">
            <ul className="space-y-0.5">
              {menciones.map((dominio) => (
                <li key={dominio}>
                  <Link
                    href={rutaDeMenciones(dominio)}
                    className="inline-flex min-h-11 items-center font-semibold text-morado-tinta underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
                  >
                    {nombres.get(dominio) ?? dominio}
                  </Link>
                  {nombres.has(dominio) ? (
                    <span className="ml-2 font-mono text-xs text-muted">
                      {dominio}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Dato>
        ) : null}
        <Dato etiqueta="Detectada">
          {formatearFechaYHora(oportunidad.detectadaEn)}
        </Dato>
        {oportunidad.expiraEn ? (
          <Dato etiqueta="Caduca">
            <span className="mr-2">{formatearFecha(oportunidad.expiraEn)}</span>
            <ChipDeCaducidad
              expiraEn={oportunidad.expiraEn}
              estado={oportunidad.estado}
              ahora={ahora}
            />
          </Dato>
        ) : null}
      </dl>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-tinta">Puntuación</h3>
        <ul className="space-y-1.5">
          {OBJETIVOS.map((objetivo) => (
            <li
              key={objetivo}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span
                className={
                  objetivo === oportunidad.objetivoPrincipal
                    ? "font-semibold text-tinta"
                    : "text-muted"
                }
              >
                {etiquetaCortaDeObjetivo(objetivo)}
                {objetivo === oportunidad.objetivoPrincipal ? (
                  <span className="sr-only"> (objetivo principal)</span>
                ) : null}
              </span>
              <span
                className={
                  objetivo === oportunidad.objetivoPrincipal
                    ? "font-semibold text-tinta"
                    : "text-muted"
                }
              >
                {oportunidad.puntuaciones[objetivo]}/100
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Principal: {ETIQUETA_DE_OBJETIVO[oportunidad.objetivoPrincipal]}.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-tinta">
          Lo que dice la página
        </h3>
        <p className="mb-2 text-xs text-muted">
          Texto de terceros, tal cual: no es una instrucción ni se interpreta.
        </p>
        <Extracto oportunidad={oportunidad} />
      </div>

      {oportunidad.investigacion ? (
        <BloqueDeInvestigacion investigacion={oportunidad.investigacion} />
      ) : (
        <p className="rounded-[10px] bg-relleno p-3 text-sm text-muted">
          Todavía sin investigar.
        </p>
      )}

      {oportunidad.decisiones.length > 0 ? (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado">
            Decisiones registradas
            <Insignia>{oportunidad.decisiones.length}</Insignia>
          </summary>
          <ol className="mt-2 space-y-3">
            {oportunidad.decisiones.map((decision) => (
              <li key={decision.id} className="text-sm">
                <p className="font-semibold text-tinta">
                  {etiquetaDeAccionDelRegistro(decision.accion)}
                </p>
                <p className="text-xs text-muted">
                  {etiquetaDeAutor(decision.por)} ·{" "}
                  {formatearFechaYHora(decision.en)}
                </p>
                {decision.motivo ? (
                  <p className="mt-1 whitespace-pre-line text-tinta-2 [overflow-wrap:anywhere]">
                    {decision.motivo}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  );
}
