import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { avisosDeCuerpo, catalogoDeToolsDeVoz } from "./catalogoDeTools.js";
import { cargarEnv, urlDeBdDeDev, variable } from "./entorno.js";
import { leerEnviosSimulados } from "./enviosSimulados.js";
import { describirTabla } from "./esquema.js";
import { estadoDeProd } from "./estadoDeProd.js";
import {
  JOBS_QUE_NO,
  JOBS_QUE_SE_PUEDEN_LANZAR,
  lanzarJobDeProd,
} from "./jobsDeProd.js";
import { leerLogsDeProd, leerPeticionesDeProd } from "./logsDeProd.js";
import {
  borrarLlamadasSimuladas,
  crearLlamadaSimulada,
} from "./llamadasSimuladas.js";
import { pararProxy, urlDeBdDeProd } from "./prod.js";
import { ejecutarSoloLectura } from "./sqlDeSoloLectura.js";
import { urlDeBd, verAssistant, verConversacion } from "./telnyx.js";
import {
  BASE_RETELL_DEV,
  BASE_TELNYX_SIMULACION,
  enviarWebhookRetell,
  enviarWebhookTelnyx,
} from "./webhooks.js";

/**
 * MCP de desarrollo de Alhabla (stdio, lo arranca Claude Code desde
 * `.mcp.json`). Herramientas:
 *
 * - consultar_bd_dev / consultar_bd_prod: SQL de solo lectura.
 * - generar_jwt_dev: sesión de un usuario de dev para probar rutas con curl.
 * - simular_webhook_telnyx / simular_webhook_retell: peticiones firmadas
 *   como las del proveedor contra el backend local (webhooks.ts).
 * - borrar_llamadas_simuladas: limpia las llamadas que crean las anteriores.
 * - listar_tools_voz: las tools de voz con sus argumentos, sacadas del código
 *   que las registra en Telnyx.
 * - ver_envios_simulados: los WhatsApp/SMS/correos que backend-sim no envió.
 * - describir_tabla: tablas, columnas, índices y claves de dev o producción.
 * - ver_logs_prod / ver_peticiones_prod: Cloud Logging de alhabla-api.
 * - estado_prod: revisión, imagen, /health, colas, jobs y último deploy.
 * - ver_assistant_telnyx / ver_conversacion_telnyx: GET a Telnyx AI.
 * - lanzar_job_prod: solo los jobs del Scheduler que se pueden repetir.
 *
 * Lo de producción y Telnyx enmascara los teléfonos salvo que se pida lo
 * contrario (privacidad.ts).
 *
 * stdout es el canal del protocolo: todo log va a stderr.
 */

const servidor = new McpServer({ name: "alhabla-dev", version: "1.0.0" });

function respuesta(datos: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(datos, null, 2) }],
  };
}

function fallo(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: error instanceof Error ? error.message : String(error),
      },
    ],
  };
}

async function conErrores<T>(trabajo: () => Promise<T>) {
  try {
    return respuesta(await trabajo());
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error(mensaje.startsWith("[MCP]") ? mensaje : `[MCP] ${mensaje}`);
    return fallo(error);
  }
}

const esquemaDeConsulta = {
  sql: z
    .string()
    .min(1)
    .describe(
      'Una sola sentencia SQL (PostgreSQL). Las tablas son las de @@map en schema.prisma (users, businesses, calls, bookings…) y las columnas van entre comillas dobles: "businessId".'
    ),
  parametros: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .describe("Valores para $1, $2…"),
  limiteFilas: z.number().int().min(1).max(1000).optional(),
};

servidor.registerTool(
  "consultar_bd_dev",
  {
    title: "Consultar la BD de dev",
    description:
      "SQL de solo lectura contra la BD de desarrollo (botbook, en el Postgres de Docker). Una sentencia por llamada, en transacción READ ONLY que acaba en ROLLBACK.",
    inputSchema: esquemaDeConsulta,
    annotations: { readOnlyHint: true },
  },
  ({ sql, parametros, limiteFilas }) =>
    conErrores(() =>
      ejecutarSoloLectura(urlDeBdDeDev(cargarEnv()), sql, {
        parametros,
        limiteFilas,
      })
    )
);

servidor.registerTool(
  "consultar_bd_prod",
  {
    title: "Consultar la BD de PRODUCCIÓN",
    description:
      "SQL de solo lectura contra la BD de producción (Cloud SQL alhabla-db, BD alhabla) con el usuario alhabla_lectura, por Cloud SQL Auth Proxy y las credenciales de gcloud del Mac. Datos reales: pide solo lo necesario y no copies datos personales fuera.",
    inputSchema: esquemaDeConsulta,
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  ({ sql, parametros, limiteFilas }) =>
    conErrores(async () =>
      ejecutarSoloLectura(await urlDeBdDeProd(), sql, {
        parametros,
        limiteFilas,
      })
    )
);

servidor.registerTool(
  "generar_jwt_dev",
  {
    title: "Generar un JWT de dev",
    description:
      "Firma una sesión (el mismo JWT que emite /auth) de un usuario de la BD de dev, por email o por negocio (el usuario más antiguo del negocio). Devuelve el token y un curl de ejemplo contra localhost:3000.",
    inputSchema: {
      email: z.string().optional(),
      businessId: z.string().optional(),
      expiraEn: z
        .string()
        .optional()
        .describe('Formato de jsonwebtoken: "1h" (por defecto), "30m", "7d"'),
    },
  },
  ({ email, businessId, expiraEn }) =>
    conErrores(async () => {
      if (!email && !businessId) {
        throw new Error("[MCP] Indica email o businessId");
      }
      const env = cargarEnv();
      const { filas } = await ejecutarSoloLectura(
        urlDeBdDeDev(env),
        `SELECT id, email, "businessId", "tokenVersion"
           FROM users
          WHERE ($1::text IS NULL OR email = $1)
            AND ($2::text IS NULL OR "businessId" = $2)
          ORDER BY "createdAt"
          LIMIT 1`,
        { parametros: [email ?? null, businessId ?? null] }
      );
      const usuario = filas[0] as
        | { id: string; email: string; businessId: string; tokenVersion: number }
        | undefined;
      if (!usuario) {
        throw new Error("[MCP] No hay ningún usuario así en la BD de dev");
      }
      // Mismo payload que createToken (modules/auth/routes.ts): `tv` tiene
      // que coincidir con tokenVersion o plugins/auth.ts lo rechaza.
      const token = jwt.sign(
        { id: usuario.id, businessId: usuario.businessId, tv: usuario.tokenVersion },
        variable(env, "JWT_SECRET"),
        { expiresIn: (expiraEn ?? "1h") as jwt.SignOptions["expiresIn"] }
      );
      return {
        usuario: { id: usuario.id, email: usuario.email, businessId: usuario.businessId },
        token,
        ejemplo: `curl -s -H "Authorization: Bearer ${token}" ${BASE_RETELL_DEV}/business/me`,
      };
    })
);

servidor.registerTool(
  "simular_webhook_telnyx",
  {
    title: "Simular un webhook firmado de Telnyx",
    description:
      "POST firmado con Ed25519 (clave de simulación local) a una ruta /webhooks/telnyx… del backend de simulación (localhost:3010; se levanta con scripts/backend-sim.sh). Para una tool de voz (ruta /webhooks/telnyx/tools/<tool>, cuerpo = argumentos de la tool) pasa businessId: crea una llamada simulada NUEVA de ese negocio y pone la cabecera x-alhabla-call-control-id. Para seguir la misma conversación (check_availability y luego book_appointment) pasa en callControlId la `llamada` que devolvió la primera: una cita por llamada. La tool se ejecuta de verdad (la cita va al calendario real del negocio), pero backend-sim NO manda WhatsApp, SMS ni correos (ENVIOS_SIMULADOS): solo los registra en su log. Los argumentos de cada tool salen en listar_tools_voz; si al cuerpo le falta alguno obligatorio o sobra uno, la respuesta trae `avisos`. Lo que backend-sim no envió se ve con ver_envios_simulados. Al acabar, borrar_llamadas_simuladas.",
    inputSchema: {
      ruta: z
        .string()
        .describe("Ej.: /webhooks/telnyx/tools/check_availability"),
      cuerpo: z.record(z.unknown()).describe("Cuerpo JSON de la petición"),
      businessId: z.string().optional(),
      telefonoCliente: z
        .string()
        .optional()
        .describe("fromNumber de la llamada simulada, en E.164"),
      callControlId: z
        .string()
        .optional()
        .describe("Sigue esta llamada en vez de crear una simulada"),
      cabeceras: z.record(z.string()).optional(),
      baseUrl: z.string().optional().describe(`Por defecto ${BASE_TELNYX_SIMULACION}`),
    },
  },
  ({ ruta, cuerpo, businessId, telefonoCliente, callControlId, cabeceras, baseUrl }) =>
    conErrores(async () => {
      const env = cargarEnv();
      const resultado = await enviarWebhookTelnyx({
        ruta,
        cuerpo,
        baseUrl,
        cabeceras,
        callControlId,
        clavePrivada: variable(env, "TELNYX_PRIVATE_KEY_SIMULACION"),
        crearLlamada: businessId
          ? () => crearLlamadaSimulada(urlDeBdDeDev(env), businessId, telefonoCliente)
          : undefined,
      });
      // Solo si hay algo que avisar: no ensucia las respuestas buenas.
      const avisos = avisosDeCuerpo(new URL(ruta, "http://x").pathname, cuerpo);
      return avisos.length > 0 ? { ...resultado, avisos } : resultado;
    })
);

servidor.registerTool(
  "listar_tools_voz",
  {
    title: "Listar las tools de voz",
    description:
      "Las tools que el assistant de Telnyx llama por webhook (get_catalog, check_availability, book_appointment…) con su ruta, sus argumentos, cuáles son obligatorios y un cuerpo de ejemplo. Salen del mismo código que las registra en Telnyx. Úsalo antes de simular_webhook_telnyx para no adivinar los nombres de los argumentos.",
    inputSchema: {
      nombre: z
        .string()
        .optional()
        .describe("Solo esta tool (p. ej. check_availability)"),
    },
    annotations: { readOnlyHint: true },
  },
  ({ nombre }) =>
    conErrores(async () => {
      const catalogo = catalogoDeToolsDeVoz();
      const tools = nombre
        ? catalogo.filter((tool) => tool.nombre === nombre)
        : catalogo;
      if (nombre && tools.length === 0) {
        throw new Error(
          `[MCP] No hay ninguna tool de voz «${nombre}»; las hay: ${catalogo.map((tool) => tool.nombre).join(", ")}`
        );
      }
      return tools;
    })
);

servidor.registerTool(
  "ver_envios_simulados",
  {
    title: "Ver los envíos simulados",
    description:
      "Los WhatsApp, SMS y correos que backend-sim NO envió (ENVIOS_SIMULADOS=1) y solo registró en su log: canal, destino y detalle. Sirve para comprobar que una tool simulada (book_appointment, notify_when_available…) avisó a quien tocaba. Lee `docker logs` de alhabla_backend_sim.",
    inputSchema: {
      desde: z
        .string()
        .optional()
        .describe('Ventana de tiempo: "10m", "2h", "30s" o fecha ISO. Por defecto 30m'),
      canal: z.enum(["WhatsApp", "SMS", "Correo"]).optional(),
      destino: z
        .string()
        .optional()
        .describe("Filtra por destino (contiene este texto)"),
      limite: z.number().int().min(1).max(500).optional(),
    },
    annotations: { readOnlyHint: true },
  },
  ({ desde, canal, destino, limite }) =>
    conErrores(() => leerEnviosSimulados({ desde, canal, destino, limite }))
);

servidor.registerTool(
  "simular_webhook_retell",
  {
    title: "Simular un webhook firmado de Retell",
    description:
      "POST firmado como Retell (x-retell-signature con la RETELL_API_KEY de dev) a una ruta /webhooks/retell… del backend de dev (localhost:3000). Para tools: /webhooks/retell/tools/<retellAgentId>/<tool> con { call: { call_id }, args }. Ojo: el backend de dev SÍ manda los WhatsApp, SMS y correos.",
    inputSchema: {
      ruta: z.string().describe("Ej.: /webhooks/retell/inbound"),
      cuerpo: z.record(z.unknown()),
      baseUrl: z.string().optional().describe(`Por defecto ${BASE_RETELL_DEV}`),
    },
  },
  ({ ruta, cuerpo, baseUrl }) =>
    conErrores(async () =>
      enviarWebhookRetell({
        ruta,
        cuerpo,
        baseUrl,
        apiKey: variable(cargarEnv(), "RETELL_API_KEY"),
      })
    )
);

servidor.registerTool(
  "borrar_llamadas_simuladas",
  {
    title: "Borrar las llamadas simuladas",
    description:
      "Borra de la BD de dev las llamadas que creó simular_webhook_telnyx (callId sim-mcp-…), de un negocio o de todos, para que no salgan en el historial del panel. Conserva las que tienen una cita viva en el calendario (borrarla dejaría el evento huérfano) y las devuelve: cancélalas antes y vuelve a llamar.",
    inputSchema: { businessId: z.string().optional() },
    annotations: { destructiveHint: true },
  },
  ({ businessId }) =>
    conErrores(() => borrarLlamadasSimuladas(urlDeBdDeDev(cargarEnv()), businessId))
);

const entorno = z
  .enum(["dev", "prod"])
  .describe(
    "dev: Postgres de Docker y la clave de Telnyx del .env; prod: Cloud SQL y Secret Manager"
  );
const mostrarTelefonos = z
  .boolean()
  .optional()
  .describe(
    "Por defecto los teléfonos +34… salen enmascarados (las 3 últimas cifras)"
  );

servidor.registerTool(
  "describir_tabla",
  {
    title: "Describir una tabla",
    description:
      "Sin tabla: todas las tablas de la BD (dev o prod) con su modelo de Prisma y las filas aproximadas. Con tabla (nombre real como bookings o modelo de Prisma como Booking): columnas con tipo, si admite NULL y valor por defecto, índices y claves foráneas. Es el esquema REAL de esa BD, útil antes de escribir SQL para consultar_bd_*.",
    inputSchema: { entorno, tabla: z.string().optional() },
    annotations: { readOnlyHint: true },
  },
  ({ entorno: cual, tabla }) =>
    conErrores(async () => describirTabla(await urlDeBd(cual), tabla))
);

servidor.registerTool(
  "ver_logs_prod",
  {
    title: "Ver los logs de producción",
    description:
      "Cloud Logging de alhabla-api, de la más vieja a la más nueva. Busca el texto en console.* (textPayload) y en el logger de Fastify (jsonPayload.msg y err.message) a la vez, y quita el ruido de «incoming request»/«request completed» y del log de peticiones. soloErrores mira stderr y el nivel de pino, porque console.error no trae severity. Devuelve también el filtro usado, por si hay que afinarlo. Para peticiones HTTP: ver_peticiones_prod.",
    inputSchema: {
      texto: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe("Texto a buscar (p. ej. «[Gestor]»); con varios, basta uno"),
      desde: z
        .string()
        .optional()
        .describe('"30m", "2h", "1d" o fecha ISO. Por defecto 1h'),
      hasta: z.string().optional().describe("Igual que desde"),
      soloErrores: z.boolean().optional(),
      revision: z.string().optional().describe("p. ej. alhabla-api-00251-xz7"),
      incluirRuido: z.boolean().optional(),
      limite: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .optional()
        .describe("Por defecto 100"),
      mostrarTelefonos,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  (opciones) => conErrores(() => leerLogsDeProd(opciones))
);

servidor.registerTool(
  "ver_peticiones_prod",
  {
    title: "Ver las peticiones HTTP de producción",
    description:
      "Peticiones a alhabla-api (método, estado, ruta, latencia, revisión), de la más vieja a la más nueva. Por defecto sin /health, /internal/ ni OPTIONS. Sirve para saber qué hizo el panel (p. ej. ruta «/booking-settings/professionals» y metodo PATCH) o qué falló (estadoMinimo 400).",
    inputSchema: {
      ruta: z.string().optional().describe("Texto que contiene la URL"),
      metodo: z.string().optional(),
      estadoMinimo: z.number().int().optional(),
      desde: z
        .string()
        .optional()
        .describe('"30m", "2h", "1d" o fecha ISO. Por defecto 1h'),
      hasta: z.string().optional(),
      incluirInternas: z.boolean().optional(),
      limite: z.number().int().min(1).max(1000).optional(),
      mostrarTelefonos,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  (opciones) => conErrores(() => leerPeticionesDeProd(opciones))
);

servidor.registerTool(
  "estado_prod",
  {
    title: "Estado de producción",
    description:
      "Foto de producción: revisión que sirve y su tráfico, imagen (commit), máximo de instancias del servicio y de la plantilla (tiene que ser 11), condiciones que no están bien, /health, tareas por cola de Cloud Tasks, jobs del Scheduler cuyo último intento falló o en pausa, los 3 últimos deploys del backend y si producción sirve el último que salió bien. Para comprobar un merge o un «¿va todo bien?».",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  () => conErrores(() => estadoDeProd())
);

servidor.registerTool(
  "ver_assistant_telnyx",
  {
    title: "Ver un assistant de Telnyx",
    description:
      "GET de un assistant de Telnyx AI por su id o por el negocio (el de su agente). Por defecto un resumen: modelo, saludo, tamaño de las instrucciones, tools con su URL y timeout, voz, transcripción, variables dinámicas, nodos del flujo, grabación… Con buscar, además, dónde aparece ese texto en TODA la configuración (p. ej. el nombre de un profesional). completo devuelve el JSON entero con las cadenas largas recortadas.",
    inputSchema: {
      entorno,
      assistantId: z.string().optional(),
      businessId: z.string().optional(),
      buscar: z.string().optional(),
      completo: z.boolean().optional(),
      mostrarTelefonos,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  (opciones) => conErrores(() => verAssistant(opciones))
);

servidor.registerTool(
  "ver_conversacion_telnyx",
  {
    title: "Ver una conversación de Telnyx",
    description:
      "Mensajes de una conversación de Telnyx AI en orden, con las tools que llamó el modelo (nombre y argumentos) y lo que devolvieron. Se elige con conversationId, con llamada (id de la Call, su callId o el id del proveedor: la conversación de esa llamada de voz), con businessId (la del dueño con el Gestor) o con businessId + telefonoCliente (el chat de WhatsApp de ese cliente). ultimos limita a los N más recientes (60 por defecto); buscar filtra los mensajes que contienen un texto.",
    inputSchema: {
      entorno,
      conversationId: z.string().optional(),
      llamada: z.string().optional(),
      businessId: z.string().optional(),
      telefonoCliente: z.string().optional().describe("E.164, con businessId"),
      ultimos: z.number().int().min(1).max(1000).optional(),
      buscar: z.string().optional(),
      conResultadosDeTools: z
        .boolean()
        .optional()
        .describe("Por defecto true: incluye lo que devolvió cada tool"),
      mostrarTelefonos,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  (opciones) => conErrores(() => verConversacion(opciones))
);

servidor.registerTool(
  "lanzar_job_prod",
  {
    title: "Lanzar un job de producción",
    description: `Ejecuta YA un job del Cloud Scheduler de producción (gcloud scheduler jobs run), espera a que termine (hasta 2 min) y devuelve su resultado y sus logs. Solo los que se pueden repetir sin efectos: ${Object.entries(
      JOBS_QUE_SE_PUEDEN_LANZAR
    )
      .map(([job, { queHace }]) => `${job} (${queHace})`)
      .join("; ")}. No se lanzan: ${Object.entries(JOBS_QUE_NO)
      .map(([job, motivo]) => `${job} (${motivo})`)
      .join("; ")}.`,
    inputSchema: {
      job: z.enum(
        Object.keys(JOBS_QUE_SE_PUEDEN_LANZAR) as [string, ...string[]]
      ),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  ({ job }) => conErrores(() => lanzarJobDeProd(job))
);

process.on("exit", pararProxy);
for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.on(senal, () => {
    pararProxy();
    process.exit(0);
  });
}

await servidor.connect(new StdioServerTransport());
console.error("[MCP] alhabla-dev listo");
