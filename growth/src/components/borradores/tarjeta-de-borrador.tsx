import Link from "next/link";
import { ChevronRight, CircleX, TriangleAlert } from "lucide-react";
import { ChipDeCaducidad } from "@/components/comunes/d1-caducidad";
import {
  Insignia,
  InsigniaDeEstadoDeBorrador,
  InsigniaDeObjetivo,
  InsigniaDeResultado,
} from "@/components/insignia";
import {
  ETIQUETA_DE_CANAL,
  ETIQUETA_DE_RESULTADO_DE_GESTION,
  ETIQUETA_DE_TIPO_DE_BORRADOR,
  etiquetaDeRegla,
} from "@/lib/etiquetas";
import { formatearDistancia, formatearFecha } from "@/lib/formato";
import type { BorradorResumen } from "@/lib/types";

/**
 * Un borrador de la lista de Borradores. Toda la tarjeta es el enlace profundo
 * a su Revisión (abre ya en esa versión). Lo que escribió el agente (asunto,
 * vista previa) y los detalles de las reglas se pintan como texto. En los
 * bloqueados, las reglas que fallan son el «porqué»: se ve sin abrir nada.
 */
export function TarjetaDeBorrador({
  borrador,
  ahora,
}: {
  borrador: BorradorResumen;
  ahora: number;
}) {
  const { oportunidad, gestion } = borrador;
  const duras = borrador.reglasFallidas.filter((c) => c.dura && !c.ok);
  const blandas = borrador.reglasFallidas.filter((c) => !c.dura && !c.ok);
  return (
    <li>
      <Link
        href={`/oportunidad/${encodeURIComponent(borrador.oportunidadId)}?borrador=${encodeURIComponent(borrador.id)}`}
        className="panel group flex gap-4 p-4 transition duration-150 hover:border-linea-fuerte focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado sm:p-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold leading-snug text-tinta [overflow-wrap:anywhere]">
            {borrador.asunto ?? ETIQUETA_DE_TIPO_DE_BORRADOR[borrador.tipo]}
          </span>
          <span className="mt-0.5 block text-xs text-muted [overflow-wrap:anywhere]">
            {oportunidad.dominio} · versión {borrador.version} ·{" "}
            {oportunidad.titulo}
          </span>
          <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <InsigniaDeEstadoDeBorrador estado={borrador.estado} />
            {borrador.resultado ? (
              <InsigniaDeResultado resultado={borrador.resultado} />
            ) : null}
            <InsigniaDeObjetivo objetivo={borrador.objetivo} />
            <Insignia>{ETIQUETA_DE_TIPO_DE_BORRADOR[borrador.tipo]}</Insignia>
            {borrador.editadoPorHumano ? (
              <Insignia tono="morado">Editado a mano</Insignia>
            ) : null}
            <ChipDeCaducidad
              expiraEn={oportunidad.expiraEn}
              estado={oportunidad.estado}
              ahora={ahora}
            />
          </span>

          {duras.length > 0 || blandas.length > 0 ? (
            <span className="mt-3 block space-y-1.5">
              {duras.map((c, i) => (
                <span
                  key={`dura-${c.regla}-${i}`}
                  className="flex items-start gap-2 text-sm text-error"
                >
                  <CircleX
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="font-semibold">
                      Bloquea: {etiquetaDeRegla(c.regla)}.
                    </span>{" "}
                    {c.detalle}
                  </span>
                </span>
              ))}
              {blandas.map((c, i) => (
                <span
                  key={`blanda-${c.regla}-${i}`}
                  className="flex items-start gap-2 text-sm text-aviso"
                >
                  <TriangleAlert
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="font-semibold">
                      Aviso: {etiquetaDeRegla(c.regla)}.
                    </span>{" "}
                    {c.detalle}
                  </span>
                </span>
              ))}
            </span>
          ) : null}

          {borrador.textoPreview ? (
            <span className="mt-3 line-clamp-3 block whitespace-pre-line text-sm text-muted [overflow-wrap:anywhere]">
              {borrador.textoPreview}
            </span>
          ) : null}

          <span className="mt-2.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            <span>{borrador.longitud.toLocaleString("es-ES")} caracteres</span>
            <span>Creado {formatearDistancia(borrador.creadoEn)}</span>
            {gestion ? (
              <span>
                {ETIQUETA_DE_CANAL[gestion.canal]} el{" "}
                {formatearFecha(gestion.hechaEn)} ·{" "}
                {ETIQUETA_DE_RESULTADO_DE_GESTION[gestion.resultado]}
              </span>
            ) : null}
          </span>
        </span>
        <ChevronRight
          className="mt-1 hidden h-5 w-5 shrink-0 text-tenue group-hover:text-apagado sm:block"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
