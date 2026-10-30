import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  SincronizarQuery,
  analizarCuerpoDeSincronizacion,
} from "./conocimiento/esquemas.js";
import { sincronizarConocimiento } from "./conocimiento/sincronizar.js";
import {
  ConocimientoDelAgenteConsulta,
  leerConocimientoDelAgente,
} from "./servicioAgente.js";
import { guardiaDePausa } from "./service.js";

/**
 * La guardia de pausa de la sincronización, salvo para `?simular=true`: una
 * simulación no escribe nada, y con Growth en pausa es justo cuando conviene
 * ver qué cambiaría (como `evaluar`, que también está exenta). Una consulta
 * que no se entiende no se exime: sigue la guardia y luego el 400 del handler.
 */
async function guardiaDePausaSalvoSimulacion(
  request: FastifyRequest
): Promise<void> {
  const consulta = SincronizarQuery.safeParse(request.query ?? {});
  if (consulta.success && consulta.data.simular) return;
  await guardiaDePausa();
}

/**
 * Rutas de la base de conocimiento.
 *
 * - `GET /growth/agente/conocimiento` (alcance `leer`): lo vigente, por tipo,
 *   prefijo de clave o texto, con cursor (`desde`) y el texto recortado
 *   (`leerConocimientoDelAgente`, servicioAgente.ts).
 * - `POST /growth/agente/conocimiento/sincronizar` (alcance `conocimiento`,
 *   más la guardia de pausa): recibe el conjunto DESEADO de afirmaciones que
 *   calcula el extractor del repo (backend/mcp/growth/conocimiento) y lo
 *   aplica. `?simular=true` devuelve el diff sin escribir y no exige la
 *   guardia de pausa (no escribe).
 *
 * El alcance `conocimiento` se da en un token propio: de esta base cuelgan las
 * reglas duras 1, 2 y 3, y quien redacta borradores no debe poder cambiarlas.
 */
export const growthRoutesConocimiento: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/growth/agente/conocimiento",
    { onRequest: fastify.autenticarAgenteGrowth("leer") },
    async (request) =>
      leerConocimientoDelAgente(
        ConocimientoDelAgenteConsulta.parse(request.query ?? {})
      )
  );

  fastify.post(
    "/growth/agente/conocimiento/sincronizar",
    {
      onRequest: fastify.autenticarAgenteGrowth("conocimiento"),
      preHandler: guardiaDePausaSalvoSimulacion,
    },
    async (request) => {
      const consulta = SincronizarQuery.parse(request.query ?? {});
      const { body, fuentes } = analizarCuerpoDeSincronizacion(
        request.body ?? {}
      );
      // `forzarCierres` no se pasa nunca desde aquí: saltar la guarda de
      // cierres masivos es cosa de un administrador, no de un token de agente.
      return sincronizarConocimiento(body, {
        agente: request.growthAgente!,
        simular: consulta.simular ?? false,
        fuentes,
      });
    }
  );
};
