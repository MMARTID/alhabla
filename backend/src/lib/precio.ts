/**
 * El precio de un servicio como se escribe en España: «18 €», «12,50 €»
 * (sin «EUR» y sin «,00» si no tiene céntimos). Lo usan la recepcionista
 * (`get_catalog`) y el Gestor, para que los dos digan el mismo precio.
 *
 * Con céntimos enteros (`Service.priceCents`), sin pasar por coma flotante.
 * Los miles, como manda la RAE: «1500 €» y «15.000 €». null si el servicio
 * no tiene precio (`priceCents` null): quien lo usa decide qué decir.
 */
export function precioParaDecir(
  priceCents: number | null | undefined
): string | null {
  if (
    priceCents === null ||
    priceCents === undefined ||
    !Number.isFinite(priceCents)
  ) {
    return null;
  }
  const centimos = Math.round(priceCents);
  const conCentimos = centimos % 100 !== 0;
  const cifra = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: conCentimos ? 2 : 0,
    maximumFractionDigits: conCentimos ? 2 : 0,
  }).format(centimos / 100);
  return `${cifra} €`;
}
