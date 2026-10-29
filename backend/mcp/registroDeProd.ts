import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MAX_CUERPOS, MAX_POR_COLA, verColasDeProd } from "./colasDeProd.js";
import { conErrores, entorno, mostrarTelefonos } from "./comun.js";
import { LIMITE_MAXIMO, leerErroresDeProd } from "./erroresDeProd.js";
import { panoramaDePlataforma } from "./panoramaDePlataforma.js";
import { urlDeBd } from "./telnyx.js";
import {
  DIMENSIONES_DE_VERCEL,
  PROYECTOS_DE_VERCEL,
  visitasWeb,
} from "./visitasWeb.js";

/**
 * Herramientas de PRODUCCIÓN de solo lectura que no están en servidorDev.ts:
 *
 * - errores_prod: errores y avisos de Cloud Logging agrupados por mensaje.
 * - ver_cola_prod: las tareas que esperan en Cloud Tasks.
 * - visitas_web: visitas a alhabla.ai (log del API y Vercel Web Analytics).
 * - panorama_plataforma: las cifras de Alhabla como negocio (solo recuentos).
 */
export function registrarHerramientasDeProd(servidor: McpServer): void {
  servidor.registerTool(
    "errores_prod",
    {
      title: "Errores de producción agrupados",
      description:
        "Los errores y avisos de alhabla-api en Cloud Logging (console.error en stderr sin severity, logger de Fastify con nivel warn o más, severity >= WARNING) AGRUPADOS por mensaje: los ids (cuid, UUID, call_control_id de Telnyx), teléfonos, emails, fechas y números largos se cambian por marcadores para que el mismo error cuente junto. Por grupo: veces, primera y última vez, revisiones en las que salió y un ejemplo recortado; de más a menos veces. Para «¿qué está fallando?» o «¿desde qué revisión sale este error?». Las líneas sueltas de un grupo, con ver_logs_prod (texto del mensaje y soloErrores); las de una llamada, con traza_llamada. Lee las más recientes hasta limiteEntradas: truncado=true si se llegó al tope.",
      inputSchema: {
        desde: z
          .string()
          .optional()
          .describe('"30m", "2h", "7d" o fecha ISO. Por defecto 24h'),
        hasta: z.string().optional().describe("Igual que desde"),
        texto: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe(
            "Solo las líneas que contienen este texto (p. ej. «[WhatsApp]»)"
          ),
        revision: z
          .string()
          .optional()
          .describe("p. ej. alhabla-api-00251-xz7"),
        limiteEntradas: z
          .number()
          .int()
          .min(1)
          .max(LIMITE_MAXIMO)
          .optional()
          .describe("Por defecto 1000"),
        mostrarTelefonos,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    (opciones) => conErrores(() => leerErroresDeProd(opciones))
  );

  servidor.registerTool(
    "ver_cola_prod",
    {
      title: "Ver las tareas de Cloud Tasks",
      description: `Las tareas que esperan en las colas de Cloud Tasks de producción (send-whatsapp, send-email, send-sms, process-recording, retry-failed-booking, report-usage; sin cola, todas): id, cola, ruta de destino, para cuándo está programada, cuándo se creó, intentos y cómo fue el último (código, equivalente HTTP y mensaje). Cada una sale como programada (aún no le toca, p. ej. un recordatorio de cita), en_cola, atascada (le tocaba hace más de 10 min y no se intentó) o reintentando (falló y Cloud Tasks la repetirá). Para saber si una tarea está atascada o es un recordatorio programado; estado_prod solo da cuántas hay por cola. conCuerpo lee además el cuerpo de las ${MAX_CUERPOS} primeras (decodificado, recortado y con los teléfonos enmascarados). Los logs del job que la ejecuta, con ver_logs_prod.`,
      inputSchema: {
        cola: z
          .string()
          .optional()
          .describe("p. ej. send-whatsapp. Sin cola, todas"),
        conCuerpo: z.boolean().optional(),
        limitePorCola: z
          .number()
          .int()
          .min(1)
          .max(MAX_POR_COLA)
          .optional()
          .describe("Por defecto 100"),
        mostrarTelefonos,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    (opciones) => conErrores(() => verColasDeProd(opciones))
  );

  servidor.registerTool(
    "visitas_web",
    {
      title: "Visitas a la web pública",
      description: `Visitas a alhabla.ai de dos fuentes. api: cada carga de una página con precios (portada, sectores, planes) pide GET /billing/fundadores, así que el log de peticiones de Cloud Run da TODAS las visitas, acepten o no las cookies: una a una (hora de Madrid, IP enmascarada salvo mostrarIps, navegador, sistema, dispositivo y el host del referer, que no trae la página) y resumidas por día y por IP, sin bots (Googlebot, bingbot, facebookexternalhit, meta-externalads, HeadlessChrome…) ni, salvo incluirDesarrollo, las del equipo (localhost, previews *.vercel.app, navegador de la app de Claude). vercel: Vercel Web Analytics por la CLI (solo quien acepta cookies; visitor_id cambia cada día): visitantes únicos y páginas vistas por día y por la dimensión agruparPor (${DIMENSIONES_DE_VERCEL.join(", ")}). proyecto: web (${PROYECTOS_DE_VERCEL.web}, por defecto) o app (${PROYECTOS_DE_VERCEL.app}). Si la CLI de Vercel no está o no tiene sesión, esa parte dice el comando para arreglarlo y la otra sale igual.`,
      inputSchema: {
        fuente: z
          .enum(["api", "vercel", "ambas"])
          .optional()
          .describe("Por defecto ambas"),
        desde: z
          .string()
          .optional()
          .describe('"24h", "7d", "30d" o fecha ISO. Por defecto 7d'),
        hasta: z.string().optional(),
        mostrarIps: z
          .boolean()
          .optional()
          .describe(
            "Por defecto la IP sale sin el último octeto (IPv6: su primera mitad)"
          ),
        incluirDesarrollo: z.boolean().optional(),
        proyecto: z.enum(["web", "app"]).optional().describe("Solo vercel"),
        agruparPor: z
          .enum(DIMENSIONES_DE_VERCEL)
          .optional()
          .describe("Solo vercel. Por defecto request_path"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    (opciones) => conErrores(() => visitasWeb(opciones))
  );

  servidor.registerTool(
    "panorama_plataforma",
    {
      title: "Panorama de la plataforma",
      description:
        "Las cifras de Alhabla como negocio en una llamada, solo recuentos (sin datos personales): negocios totales; embudo de alta (cuenta → suscripción activa o en prueba → número de teléfono → calendario conectado o agenda de Alhabla → al menos una llamada de voz), con los que pasan cada etapa y las anteriores y los que la cumplen sin mirar las anteriores; suscripciones por plan y estado; minutos de voz del mes en curso; y por día de Madrid (los últimos `dias`, 14 por defecto) altas, llamadas de voz y sus minutos, chats de WhatsApp nuevos, mensajes de WhatsApp recibidos por quién escribe y citas creadas por canal, con los totales de la ventana. Llamadas de voz = sin WhatsApp ni simuladas (sim-mcp-…). Para un negocio concreto, resumen_negocio; para la salud técnica de las llamadas, salud_llamadas.",
      inputSchema: {
        entorno,
        dias: z
          .number()
          .int()
          .min(1)
          .max(366)
          .optional()
          .describe("Por defecto 14"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ entorno: cual, dias }) =>
      conErrores(async () =>
        panoramaDePlataforma(await urlDeBd(cual), { dias })
      )
  );
}
