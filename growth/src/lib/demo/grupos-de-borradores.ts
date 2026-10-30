import type {
  EstadoDeBorrador,
  EstadoDeOportunidad,
  GrupoDeBorradores,
} from "../types";

/**
 * En qué pestañas de Borradores sale un borrador, como el backend
 * (`dondeDeGrupoDeBorradores` en servicioAdmin.ts).
 *
 * «Caducados» se define SOLO por la oportunidad (`caducada`), sea cual sea el
 * estado del borrador: el borrador no tiene estado «caducado», y el job de
 * caducidad descarta los borradores abiertos de lo que caduca, así que mirar
 * el estado del borrador la dejaría siempre vacía. Lo que sale en «Caducados»
 * no sale en «Aprobados» ni en «Descartados».
 */
export function gruposDeBorrador(
  estadoDelBorrador: EstadoDeBorrador,
  estadoDeLaOportunidad: EstadoDeOportunidad | undefined
): GrupoDeBorradores[] {
  const caducada = estadoDeLaOportunidad === "caducada";
  const grupos: GrupoDeBorradores[] = [];
  if (estadoDelBorrador === "bloqueado") grupos.push("bloqueados");
  if (estadoDelBorrador === "pendiente_aprobacion") grupos.push("pendientes");
  if (estadoDelBorrador === "aprobado" && !caducada) grupos.push("aprobados");
  if (estadoDelBorrador === "gestionado") grupos.push("gestionados");
  if (estadoDelBorrador === "descartado" && !caducada) {
    grupos.push("descartados");
  }
  if (caducada) grupos.push("caducados");
  return grupos;
}
