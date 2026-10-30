import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { crearClienteDeGrowth } from "./cliente.js";
import { crearCredenciales } from "./credenciales.js";
import { crearEstadoDeEjecucion } from "./ejecucion.js";
import { crearServidorDeGrowth } from "./herramientas.js";
import { crearGit, raizDelRepo } from "./repo.js";
import type { PrepararCarga } from "./sincronizar.js";

/**
 * MCP de Alhabla Growth (stdio; lo arranca Claude Code desde `.mcp.json` con
 * `backend/mcp/arrancar.sh growth/servidorGrowth`). Es la ÚNICA vía de
 * escritura de la tarea semanal de Growth, y solo habla con
 * `/growth/agente/*` de la API:
 *
 * - estado_growth / leer_contexto / leer_conocimiento: lo que hay que saber
 *   antes de buscar (API, token, repo, ajustes, afirmaciones vigentes).
 * - listar_oportunidades / ver_oportunidad: lo ya registrado (URL manuales,
 *   devueltas con su nota, bloqueadas con su motivo).
 * - abrir_ejecucion / cerrar_ejecucion: el registro del run.
 * - sincronizar_conocimiento: pone la base al día desde el repo (sin que el
 *   modelo aporte contenido).
 * - crear_oportunidad / calificar_oportunidad / descartar_oportunidad /
 *   guardar_investigacion: el embudo hasta «investigada».
 * - evaluar_borrador / crear_borrador / registrar_cumplimiento: el borrador y
 *   sus reglas de cumplimiento.
 * - listar_competidores / guardar_analisis_de_competidor / proponer_competidor:
 *   la competencia (análisis interno que revisa el fundador; los propuestos
 *   los acepta o rechaza él).
 *
 * No hay herramienta para aprobar, marcar como gestionado, cambiar un estado
 * a mano ni aceptar o quitar un competidor. El token (GROWTH_AGENT_TOKEN o el llavero de macOS) se lee
 * en la primera llamada, no al arrancar, y no sale nunca en una respuesta.
 * stdout es el canal del protocolo: todo log va a stderr.
 */

/**
 * El extractor de conocimiento se carga al usarlo: arrancar el MCP no depende
 * de él (ni de leer los ficheros de `web/`).
 */
const prepararCarga: PrepararCarga = async (opciones) => {
  let extractor: typeof import("./conocimiento/index.js");
  try {
    extractor = await import("./conocimiento/index.js");
  } catch (error) {
    const e = error as { code?: string };
    if (e.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(
        "El extractor de conocimiento (backend/mcp/growth/conocimiento/) no está en este checkout: actualiza la copia con `bash ~/.alhabla-mcp/scripts/dev/entorno.sh herramientas`.",
        { cause: error }
      );
    }
    throw error;
  }
  return extractor.prepararCarga(opciones);
};

const raiz = raizDelRepo();
const credenciales = crearCredenciales();

const servidor = crearServidorDeGrowth({
  cliente: crearClienteDeGrowth({ credenciales }),
  credenciales,
  ejecucion: crearEstadoDeEjecucion(),
  git: crearGit(raiz),
  raiz,
  prepararCarga,
});

await servidor.connect(new StdioServerTransport());
console.error("[MCP] alhabla-growth listo");
