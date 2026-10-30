import Link from "next/link";
import { EnlaceExterno } from "@/components/enlace-externo";
import { Insignia } from "@/components/insignia";
import {
  ETIQUETA_DE_CANAL,
  ETIQUETA_DE_RESULTADO_DE_GESTION,
  ETIQUETA_DE_TIPO_DE_BORRADOR,
  etiquetaCortaDeObjetivo,
  type Tono,
} from "@/lib/etiquetas";
import { formatearFechaYHora } from "@/lib/formato";
import type { GestionDelHistorial, ResultadoDeGestion } from "@/lib/types";
import { esUrlWeb, urlSegura } from "@/lib/url-segura";

export const TONO_DE_RESULTADO_DE_GESTION: Record<ResultadoDeGestion, Tono> = {
  pendiente: "morado",
  aceptado: "exito",
  // Que el destino diga que no no es un fallo del sistema: aviso, no error.
  rechazado: "aviso",
  sin_respuesta: "neutro",
};

/** `https://revista.example/listado/` → `revista.example/listado`. */
function direccionLegible(url: string): string {
  return (urlSegura(url) ?? url).replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Una gestión: lo que hiciste a mano tras aprobar. La URL conseguida solo es
 * un enlace si es http(s) (`esUrlWeb`); cualquier otra cosa se enseña como
 * texto, sin `href`.
 */
export function FilaDeGestion({ gestion }: { gestion: GestionDelHistorial }) {
  const { oportunidad, borrador } = gestion;
  const resultado = gestion.resultado;
  return (
    <li className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <p className="min-w-0 break-words text-sm font-semibold text-tinta">
          {ETIQUETA_DE_CANAL[gestion.canal] ?? gestion.canal}
          <span className="font-normal text-muted"> · {gestion.dominio}</span>
        </p>
        <Insignia tono={TONO_DE_RESULTADO_DE_GESTION[resultado] ?? "neutro"}>
          {ETIQUETA_DE_RESULTADO_DE_GESTION[resultado] ?? resultado}
        </Insignia>
      </div>

      <p className="mt-1 text-xs text-muted">
        Hecha el{" "}
        <time dateTime={gestion.hechaEn}>
          {formatearFechaYHora(gestion.hechaEn)}
        </time>
        {gestion.respuestaEn ? (
          <>
            {" "}
            · Respuesta el{" "}
            <time dateTime={gestion.respuestaEn}>
              {formatearFechaYHora(gestion.respuestaEn)}
            </time>
          </>
        ) : null}
      </p>

      <p className="mt-3 text-sm">
        <Link
          href={`/oportunidad/${encodeURIComponent(oportunidad.id)}`}
          className="rounded-sm font-medium text-tinta underline decoration-linea-fuerte underline-offset-2 hover:decoration-morado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
        >
          {oportunidad.titulo || gestion.dominio}
        </Link>
        <span className="text-muted">
          {" "}
          · {etiquetaCortaDeObjetivo(oportunidad.objetivoPrincipal)} · Borrador
          v{borrador.version} (
          {ETIQUETA_DE_TIPO_DE_BORRADOR[borrador.tipo] ?? borrador.tipo})
          {borrador.editadoPorHumano ? " · editado por ti" : ""}
        </span>
      </p>

      {gestion.urlConseguida ? (
        <p className="mt-3 break-all text-sm">
          <span className="text-muted">Enlace conseguido: </span>
          {esUrlWeb(gestion.urlConseguida) ? (
            <EnlaceExterno
              href={gestion.urlConseguida}
              conIcono
              className="font-medium text-tinta"
            >
              {direccionLegible(gestion.urlConseguida)}
            </EnlaceExterno>
          ) : (
            <span className="text-tinta-2">
              {gestion.urlConseguida}{" "}
              <span className="text-muted">(no es una dirección web)</span>
            </span>
          )}
        </p>
      ) : null}

      {gestion.notas ? (
        <p className="mt-3 whitespace-pre-line break-words border-l-2 border-linea pl-3 text-sm text-tinta-2">
          {gestion.notas}
        </p>
      ) : null}

      {borrador.textoFinal ? (
        <details className="mt-3 text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-apagado hover:text-tinta">
            Texto que enviaste
          </summary>
          <p className="mt-1 whitespace-pre-wrap break-words rounded-[10px] bg-relleno p-3 text-tinta-2">
            {borrador.textoFinal}
          </p>
        </details>
      ) : null}
    </li>
  );
}
