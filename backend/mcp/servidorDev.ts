import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { avisosDeCuerpo, catalogoDeToolsDeVoz } from "./catalogoDeTools.js";
import { conErrores, entorno, mostrarTelefonos } from "./comun.js";
import { cargarEnv, urlDeBdDeDev, variable } from "./entorno.js";
import { leerEnviosSimulados } from "./enviosSimulados.js";
import { describirTabla } from "./esquema.js";
import { estadoDeProd } from "./estadoDeProd.js";
import {
  JOBS_QUE_NO,
  JOBS_QUE_SE_PUEDEN_LANZAR,
  lanzarJobDeProd,
} from "./jobsDeProd.js";
import { LIMITE_MAXIMO, leerLatenciasDeProd } from "./latenciasDeProd.js";
import { leerLogsDeProd, leerPeticionesDeProd } from "./logsDeProd.js";
import {
  borrarLlamadasSimuladas,
  crearLlamadaSimulada,
} from "./llamadasSimuladas.js";
import { pararProxy, urlDeBdDeProd } from "./prod.js";
import { resumenDeNegocio } from "./resumenDeNegocio.js";
import { saludDeLlamadas } from "./saludDeLlamadas.js";
import { ejecutarSoloLectura } from "./sqlDeSoloLectura.js";
import { urlDeBd, verAssistant, verConversacion } from "./telnyx.js";
import { estadoDelEntorno, verRamaEnDev } from "./panel/entornoDev.js";
import { trazaDeLlamada } from "./trazaDeLlamada.js";
import {
  BASE_DEV,
  BASE_TELNYX_SIMULACION,
  enviarWebhookTelnyx,
} from "./webhooks.js";

/**
 * MCP de desarrollo de Alhabla (stdio, lo arranca Claude Code desde
 * `.mcp.json`). Herramientas:
 *
 * - consultar_bd_dev / consultar_bd_prod: SQL de solo lectura.
 * - generar_jwt_dev: sesión de un usuario de dev para probar rutas con curl.
 * - simular_webhook_telnyx: peticiones firmadas como las de Telnyx contra el
 *   backend de simulación (webhooks.ts).
 * - borrar_llamadas_simuladas: limpia las llamadas que crean las anteriores.
 * - listar_tools_voz: las tools de voz con sus argumentos, sacadas del código
 *   que las registra en Telnyx.
 * - ver_envios_simulados: los WhatsApp/SMS/correos que backend-sim no envió.
 * - describir_tabla: tablas, columnas, índices y claves de dev o producción.
 * - ver_logs_prod / ver_peticiones_prod: Cloud Logging de alhabla-api.
 * - latencias_prod: las peticiones agregadas por ruta (estados, p50/p95/máx).
 * - salud_llamadas: por día, a qué llamadas les falta algo, webhooks que no
 *   acabaron bien, citas por canal y reservas pendientes por código.
 * - traza_llamada: todo lo que dejó una llamada, con sus logs.
 * - resumen_negocio: la foto de un negocio (o la lista para elegir uno).
 * - estado_prod: revisión, imagen, /health, colas, jobs y último deploy.
 * - ver_assistant_telnyx / ver_conversacion_telnyx: GET a Telnyx AI.
 * - lanzar_job_prod: solo los jobs del Scheduler que se pueden repetir.
 * - estado_dev / ver_en_dev: el entorno de desarrollo fijo
 *   (scripts/dev/entorno.sh): qué enseña y ponerlo en otra rama.
 *
 * Lo de producción y Telnyx enmascara los teléfonos salvo que se pida lo
 * contrario (privacidad.ts).
 *
 * stdout es el canal del protocolo: todo log va a stderr.
 */

const servidor = new McpServer({ name: "alhabla-dev", version: "1.0.0" });

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
        ejemplo: `curl -s -H "Authorization: Bearer ${token}" ${BASE_DEV}/business/me`,
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
  "latencias_prod",
  {
    title: "Latencias de producción por ruta",
    description:
      "Las peticiones a alhabla-api AGREGADAS por método y ruta (ids cambiados por :id, sin query string): cuántas, por familia de estado (2xx, 4xx, 5xx) y latencia p50/p95/máxima en ms, ordenadas de más a menos peticiones. Para «¿cuánto tarda book_appointment?» o «¿qué ruta da 5xx?» sin leer las peticiones una a una (eso es ver_peticiones_prod). porRevision separa por revisión (antes/después de un deploy). Lee las más recientes hasta limitePeticiones; truncado=true si se llegó al tope.",
    inputSchema: {
      ruta: z.string().optional().describe("Texto que contiene la URL, p. ej. /webhooks/telnyx/tools/"),
      metodo: z.string().optional(),
      estadoMinimo: z.number().int().optional(),
      desde: z.string().optional().describe('"30m", "2h", "7d" o fecha ISO. Por defecto 24h'),
      hasta: z.string().optional(),
      incluirInternas: z.boolean().optional().describe("Incluye /internal/, /health y OPTIONS"),
      porRevision: z.boolean().optional(),
      limitePeticiones: z
        .number()
        .int()
        .min(1)
        .max(LIMITE_MAXIMO)
        .optional()
        .describe("Por defecto 2000"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  (opciones) => conErrores(() => leerLatenciasDeProd(opciones))
);

servidor.registerTool(
  "salud_llamadas",
  {
    title: "Salud de las llamadas",
    description:
      "Por día (hora de Madrid): llamadas de voz por estado y cuántas se quedaron sin alguna pieza (zombi abierta, sin transcripción, sin conversación, sin duración, sin coste, sin grabación o sin copiar a R2, sin resultado; la leyenda explica cada una; las de Telnyx con coste 0, que colgaron antes de contestar, no cuentan como rotas). Además: eventos de webhook de voz/WhatsApp que no acabaron bien (de toda la plataforma), citas creadas por canal (y las que no tienen evento en el calendario) y reservas pendientes por código de fallo. ejemplos da las llamadas más recientes con algún problema, para seguir con traza_llamada. Sin chats de WhatsApp ni llamadas simuladas.",
    inputSchema: {
      entorno,
      desde: z.string().optional().describe('"1d", "7d" (por defecto), "30d" o fecha ISO'),
      businessId: z.string().optional(),
      ejemplos: z.number().int().min(0).max(50).optional().describe("Por defecto 10"),
    },
    annotations: { readOnlyHint: true },
  },
  ({ entorno: cual, desde, businessId, ejemplos }) =>
    conErrores(async () =>
      saludDeLlamadas(await urlDeBd(cual), { desde, businessId, ejemplos })
    )
);

servidor.registerTool(
  "traza_llamada",
  {
    title: "Traza de una llamada",
    description:
      "Todo lo que dejó UNA llamada (por id de la Call, callId/call_control_id, providerCallId o providerConversationId): su fila (estado, resultado, duración, coste, grabación pedida/rechazada), la cita con su calendario, profesional y servicios, las reservas que se quedaron pendientes y su código de fallo, si hay transcripción y grabación copiada, cuántas llamadas de la plataforma se solaparon (si hay alguna, las peticiones a tools pueden ser de otra) y sus logs en la ventana de la llamada (prod: Cloud Logging + las peticiones a las tools mientras duró, con su latencia; dev: docker logs del backend de dev, o de backend-sim si es sim-mcp-…). Para saber qué rama tomó una tool sin leer el código. Las tools que llamó el modelo, con ver_conversacion_telnyx.",
    inputSchema: {
      entorno,
      llamada: z.string().min(1),
      conLogs: z.boolean().optional().describe("Por defecto true"),
      limiteLogs: z.number().int().min(1).max(1000).optional().describe("Por defecto 150"),
      mostrarTelefonos,
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  ({ entorno: cual, ...opciones }) =>
    conErrores(async () => trazaDeLlamada(cual, await urlDeBd(cual), opciones))
);

servidor.registerTool(
  "resumen_negocio",
  {
    title: "Resumen de un negocio",
    description:
      "La foto de un negocio: suscripción y suspensiones, número y orquestador, WhatsApp del dueño, calendarios (proveedor, conectado, si hay credenciales —nunca su valor—, último error), agentes y su sincronización con Telnyx, profesionales/servicios/ausencias y actividad de 30 días (llamadas, chats, citas creadas y por delante, reservas pendientes sin resolver). Sin businessId lista los negocios (buscar filtra por nombre, id o teléfono); si solo uno coincide, lo resume. Teléfonos y emails enmascarados salvo mostrarTelefonos.",
    inputSchema: {
      entorno,
      businessId: z.string().optional(),
      buscar: z.string().optional().describe("Parte del nombre, id o un teléfono E.164"),
      mostrarTelefonos,
    },
    annotations: { readOnlyHint: true },
  },
  ({ entorno: cual, ...opciones }) =>
    conErrores(async () => resumenDeNegocio(await urlDeBd(cual), opciones))
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

servidor.registerTool(
  "estado_dev",
  {
    title: "Estado del entorno de desarrollo fijo",
    description:
      "Qué rama enseña el entorno de desarrollo fijo (~/.alhabla-dev: backend :3000, app :3001, web :3002), su commit, si va por detrás de main, si se está cambiando de rama, si cada pieza responde y si el backend de dev sigue montado donde debe (backendFueraDeSitio: otra sesión lo levantó desde su worktree). Lo mismo que el panel http://localhost:3005.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  () => conErrores(() => estadoDelEntorno())
);

servidor.registerTool(
  "ver_en_dev",
  {
    title: "Enseñar una rama en el entorno de desarrollo",
    description:
      "Pone el entorno de desarrollo fijo en una rama YA SUBIDA a origin (o «main», o el número de un PR) para que el usuario la vea en http://localhost:3001 antes de fusionar: cambia la carpeta fija, instala dependencias si cambiaron, aplica las migraciones a la BD de dev y reinicia backend, app y web. Va en segundo plano (uno o dos minutos): sigue con estado_dev. Es el único entorno de dev: al acabar, vuelve a «main». Nunca levantes backend-dev desde tu worktree.",
    inputSchema: {
      rama: z.string().describe("Rama de origin, «main» o número de PR"),
    },
    annotations: { readOnlyHint: false, destructiveHint: false },
  },
  ({ rama }) =>
    conErrores(async () => {
      verRamaEnDev(rama);
      return {
        mensaje: `Poniendo el entorno de desarrollo en ${rama}. Tarda uno o dos minutos; sigue con estado_dev y luego da al usuario http://localhost:3001.`,
      };
    })
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
