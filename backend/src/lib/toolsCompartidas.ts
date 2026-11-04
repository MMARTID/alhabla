import { createHash } from "node:crypto";
import {
  telnyxAiAdapter,
  type TelnyxWebhookTool,
} from "../adapters/telnyx/TelnyxAiAdapter.js";
import { acquireLock, releaseLock } from "./bookingLock.js";

/**
 * Las tools de webhook de la recepcionista en la biblioteca de Telnyx
 * (`ai.tools`), creadas una vez y referenciadas por `tool_ids` desde los
 * assistants de voz y de chat de cada negocio. Hasta el 2026-11-04 cada
 * assistant las llevaba copiadas inline.
 *
 * Cada tool es inmutable: su `display_name` lleva el host del backend y un
 * hash de la definición entera (descripción, esquema, URL, cabeceras,
 * timeout y frase de espera). Si la definición cambia, se crea otra con otro
 * nombre y cada assistant pasa a la nueva cuando se sincroniza (su hash de
 * configuración cambia con los ids). Así nunca hay un assistant con el
 * prompt de antes y la tool de después, y no hace falta tabla en la BD: el
 * nombre ya dice si existe. Por el host, dev y producción tienen cada uno su
 * juego aunque compartan cuenta de Telnyx (URLs distintas).
 *
 * Las que dejan de usarse se quedan en la biblioteca: Telnyx no deja borrar
 * una tool que lleve un assistant, ni uno borrado en blando (comprobado el
 * 2026-11-04).
 */

const PREFIJO = "alhabla";

/** Lo que dura la lista de la biblioteca en memoria: la sincronización de
 * un negocio pide sus dos assistants seguidos, y el reconciliador, todos. */
const VIGENCIA_DE_LA_LISTA_MS = 10 * 60 * 1000;

/** Cerrojo contra dos sincronizaciones que creen a la vez la misma tool
 * (dos instancias de Cloud Run, o el reconciliador y un cambio de ajustes). */
const CERROJO_TTL_MS = 60_000;
const CERROJO_ESPERA_MS = 30_000;

let lista: { porNombre: Map<string, string>; leidaEn: number } | null = null;

/** El nombre con el que se guarda una tool en la biblioteca. */
export function nombreDeToolCompartida(tool: TelnyxWebhookTool): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(tool))
    .digest("hex")
    .slice(0, 12);
  const host = new URL(tool.webhook.url).host;
  return `${PREFIJO} ${host} ${tool.webhook.name} ${hash}`;
}

async function leerBiblioteca(forzar: boolean): Promise<Map<string, string>> {
  if (!forzar && lista && Date.now() - lista.leidaEn < VIGENCIA_DE_LA_LISTA_MS) {
    return lista.porNombre;
  }
  const porNombre = new Map<string, string>();
  for (const tool of await telnyxAiAdapter.listSharedTools()) {
    if (tool.displayName.startsWith(`${PREFIJO} `)) {
      porNombre.set(tool.displayName, tool.id);
    }
  }
  lista = { porNombre, leidaEn: Date.now() };
  return porNombre;
}

/**
 * Los ids de la biblioteca de estas tools, en el mismo orden, creando las
 * que falten. Lanza si Telnyx no responde: quien sincroniza guarda el error
 * en `telnyxSyncError` y deja el assistant como estaba.
 */
export async function idsDeToolsCompartidas(
  tools: TelnyxWebhookTool[]
): Promise<string[]> {
  const nombres = tools.map(nombreDeToolCompartida);
  let porNombre = await leerBiblioteca(false);
  if (nombres.every((nombre) => porNombre.has(nombre))) {
    return nombres.map((nombre) => porNombre.get(nombre)!);
  }

  const clave = "lock:telnyx:biblioteca-de-tools";
  const token = await acquireLock(clave, CERROJO_TTL_MS, CERROJO_ESPERA_MS);
  if (!token) {
    throw new Error(
      "No se pudo tomar el cerrojo de la biblioteca de tools de Telnyx"
    );
  }
  try {
    // Otra instancia pudo crearlas mientras se esperaba el cerrojo.
    porNombre = await leerBiblioteca(true);
    for (const [i, tool] of tools.entries()) {
      const nombre = nombres[i]!;
      if (porNombre.has(nombre)) continue;
      const creada = await telnyxAiAdapter.createSharedWebhookTool({
        displayName: nombre,
        tool,
      });
      porNombre.set(nombre, creada.id);
      console.log(
        `[Agent] Tool «${tool.webhook.name}» creada en la biblioteca de Telnyx: ${creada.id} (${nombre})`
      );
    }
  } finally {
    await releaseLock(clave, token);
  }
  return nombres.map((nombre) => porNombre.get(nombre)!);
}

/** Para los tests: olvida la lista leída. */
export function olvidarBibliotecaDeTools(): void {
  lista = null;
}
