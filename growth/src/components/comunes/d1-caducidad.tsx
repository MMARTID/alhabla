import { Insignia } from "@/components/insignia";
import type { EstadoDeOportunidad } from "@/lib/types";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** A partir de cuántos días restantes el plazo pasa a ser un aviso. */
export const DIAS_DE_AVISO_DE_CADUCIDAD = 7;

/**
 * Los estados en los que el plazo importa: en los demás la oportunidad ya está
 * cerrada (gestionada, descartada, caducada…) y una fecha vieja no es noticia.
 */
export const ESTADOS_CON_PLAZO: ReadonlySet<EstadoDeOportunidad> = new Set([
  "detectada",
  "calificada",
  "investigada",
  "con_borrador",
  "pendiente_aprobacion",
  "aprobada",
  "devuelta",
  "bloqueada",
]);

export type Caducidad =
  | { tipo: "vencida" }
  | { tipo: "pronto"; dias: number }
  | { tipo: "plazo"; dias: number };

/**
 * La caducidad calculada con `expiraEn` contra AHORA, no la que el servidor
 * mandó (`diasParaCaducar` envejece en cuanto se deja la pantalla abierta).
 * `vencida` = la fecha ya pasó pero la oportunidad sigue abierta: el job de
 * caducidad todavía no la ha cerrado.
 */
export function calcularCaducidad(
  expiraEn: string | null | undefined,
  ahora: number
): Caducidad | null {
  if (!expiraEn) return null;
  const instante = Date.parse(expiraEn);
  if (Number.isNaN(instante)) return null;
  const diferencia = instante - ahora;
  if (diferencia < 0) return { tipo: "vencida" };
  const dias = Math.floor(diferencia / MS_POR_DIA);
  return {
    tipo: dias <= DIAS_DE_AVISO_DE_CADUCIDAD ? "pronto" : "plazo",
    dias,
  };
}

export function textoDeCaducidadCalculada(caducidad: Caducidad): string {
  if (caducidad.tipo === "vencida") return "Vencida";
  if (caducidad.dias === 0) return "Caduca hoy";
  return `Caduca en ${caducidad.dias} d`;
}

/**
 * El chip de plazo de una oportunidad: «Vencida» en rojo, «Caduca en 3 d» en
 * ámbar cuando queda una semana o menos y en neutro si hay margen. No pinta
 * nada si la oportunidad ya está cerrada o no tiene plazo.
 */
export function ChipDeCaducidad({
  expiraEn,
  estado,
  ahora,
}: {
  expiraEn: string | null | undefined;
  estado?: EstadoDeOportunidad;
  ahora: number;
}) {
  if (estado && !ESTADOS_CON_PLAZO.has(estado)) return null;
  const caducidad = calcularCaducidad(expiraEn, ahora);
  if (!caducidad) return null;
  const tono =
    caducidad.tipo === "vencida"
      ? "error"
      : caducidad.tipo === "pronto"
        ? "aviso"
        : "neutro";
  return (
    <Insignia tono={tono}>{textoDeCaducidadCalculada(caducidad)}</Insignia>
  );
}
