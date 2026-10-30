import {
  construirAfirmaciones,
  type AfirmacionAEnviar,
  type PaginaAEnviar,
} from "./construir.js";
import { cargarEntrada } from "./entrada.js";
import {
  blobsDe,
  comprobarGuardasDeGit,
  comprobarGuardasPrevias,
  raizDelRepo,
} from "./git.js";
import type { TipoDeAfirmacion } from "../../../src/modules/growth/esquemas.js";

export type { AfirmacionAEnviar, PaginaAEnviar };
export { ErroresDeExtraccion } from "./construir.js";

/**
 * Lo que el MCP `alhabla-growth` y el CLI mandan al servidor: el conjunto
 * DESEADO de afirmaciones leído del repo, con el commit que lo respalda y el
 * rastro de los ficheros leídos.
 */
export type CargaDeConocimiento = {
  /** Último commit que tocó alguna de las fuentes. */
  commitSha: string;
  afirmaciones: AfirmacionAEnviar[];
  /**
   * Los tipos de los que `afirmaciones` es la lista COMPLETA. Va SIEMPRE en el
   * cuerpo (`cuerpoDeSincronizacion`): sin él, el servidor solo cubre los tipos
   * que aparecen en el lote y un tipo vaciado en el repo no se retira de la
   * base ni se detecta como avería.
   */
  tipos: TipoDeAfirmacion[];
  competidores: { nombre: string; dominio: string }[];
  nichos: { slug: string; nombre: string }[];
  fuentesLeidas: { ruta: string; blobSha: string }[];
  avisos: string[];
  /**
   * Registro de páginas (growth_paginas). Opcional para quien solo conozca los
   * campos de arriba: el servidor lo siembra si viene.
   */
  paginas?: PaginaAEnviar[];
};

/**
 * Lee el repo en `raiz` y lo deja listo para mandar. Falla (con el motivo) si:
 * el mapa no cubre algo de PRODUCT.md o plans.ts, algún dato se contradice,
 * el clon es superficial o, fuera de `permitirRamaLocal`, no hay red hacia
 * origin/main o HEAD o las fuentes no son los de `origin/main`.
 *
 * `permitirRamaLocal: true` es para dev: se sincroniza la rama y el árbol que
 * haya. Con `false` (producción) hace falta un árbol limpio e idéntico a main.
 *
 * Las guardas de git van ANTES de leer nada: `web/` es TypeScript que se
 * ejecuta en un proceso hijo, y en producción no debe ejecutarse si no es el
 * de `origin/main`.
 */
export async function prepararCarga(opciones: {
  raiz: string;
  permitirRamaLocal: boolean;
}): Promise<CargaDeConocimiento> {
  const raiz = await raizDelRepo(opciones.raiz);
  const previas = await comprobarGuardasPrevias(raiz, {
    permitirRamaLocal: opciones.permitirRamaLocal,
  });
  const entrada = await cargarEntrada(raiz);
  const resultado = construirAfirmaciones(entrada);

  const guardas = await comprobarGuardasDeGit(raiz, resultado.fuentes, {
    permitirRamaLocal: opciones.permitirRamaLocal,
    // Ya se trajo en las guardas previas.
    omitirFetch: true,
  });
  return {
    commitSha: guardas.commitSha,
    afirmaciones: resultado.afirmaciones,
    tipos: resultado.tipos,
    competidores: resultado.competidores,
    nichos: resultado.nichos,
    fuentesLeidas: await blobsDe(raiz, resultado.fuentes),
    avisos: [...resultado.avisos, ...previas.avisos, ...guardas.avisos],
    paginas: resultado.paginas,
  };
}

/**
 * El cuerpo de `POST /growth/agente/conocimiento/sincronizar`. `fuentes` es el
 * rastro (ruta + SHA) que el servidor guarda en el snapshot.
 */
export function cuerpoDeSincronizacion(carga: CargaDeConocimiento) {
  return {
    commitSha: carga.commitSha,
    tipos: carga.tipos,
    afirmaciones: carga.afirmaciones,
    competidores: carga.competidores,
    nichos: carga.nichos,
    ...(carga.paginas ? { paginas: carga.paginas } : {}),
    fuentes: carga.fuentesLeidas,
  };
}
