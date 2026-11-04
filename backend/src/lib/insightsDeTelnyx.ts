import { telnyxAiAdapter } from "../adapters/telnyx/TelnyxAiAdapter.js";

/**
 * El grupo de insights de la recepcionista: vacío a propósito.
 *
 * A todo assistant sin grupo propio Telnyx le pone «Default» (también con
 * `insight_group_id: null`). Ese grupo lleva 6 insights que corren con el
 * modelo tras cada llamada y se pagan como inferencia; marcaban NO_ANSWER
 * por error, y con `pii_redaction` ven `<PII:name/>` en vez del nombre. Lo
 * que daban (resultado, motivo de escalada, fallo de una tool) lo rellena
 * ahora el informe de cada llamada (jobs/informeDeLlamada.ts) en el mismo
 * `Call`.
 *
 * Se busca por nombre y se crea si falta: vale igual en dev y en
 * producción, y en una cuenta de Telnyx nueva. Un grupo vacío no ejecuta
 * nada, así que compartirlo entre entornos no mezcla datos.
 */
export const GRUPO_DE_INSIGHTS_DE_LA_RECEPCIONISTA =
  "alhabla-recepcionista (sin insights)";

let enMemoria: string | null = null;

/** El id del grupo, creándolo si no existe. Lanza si Telnyx falla. */
export async function grupoDeInsightsDeLaRecepcionista(): Promise<string> {
  if (enMemoria) return enMemoria;
  const grupos = await telnyxAiAdapter.listInsightGroups();
  const existente = grupos.find(
    (grupo) => grupo.name === GRUPO_DE_INSIGHTS_DE_LA_RECEPCIONISTA
  );
  if (existente) {
    if (existente.insights > 0) {
      // Alguien le añadió insights a mano: se usan, pero que se sepa.
      console.warn(
        `[Agent] El grupo de insights «${GRUPO_DE_INSIGHTS_DE_LA_RECEPCIONISTA}» (${existente.id}) tiene ${existente.insights} insights: cada llamada los pagará`
      );
    }
    enMemoria = existente.id;
    return existente.id;
  }
  const creado = await telnyxAiAdapter.createInsightGroup({
    name: GRUPO_DE_INSIGHTS_DE_LA_RECEPCIONISTA,
    description:
      "Grupo vacío de los assistants de la recepcionista de Alhabla (lib/insightsDeTelnyx.ts): sin él Telnyx les pone el grupo Default y cada llamada corre sus insights. El informe de la llamada lo escribe el backend.",
  });
  console.log(
    `[Agent] Grupo de insights «${GRUPO_DE_INSIGHTS_DE_LA_RECEPCIONISTA}» creado en Telnyx: ${creado.id}`
  );
  enMemoria = creado.id;
  return creado.id;
}

/** Para los tests: olvida el id leído. */
export function olvidarGrupoDeInsights(): void {
  enMemoria = null;
}
