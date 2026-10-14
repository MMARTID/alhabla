import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { cargarEnv, exigirUrlLocal, urlDeBdDeDev, variable } from "./entorno.js";
import { firmarComoRetell, firmarComoTelnyx } from "./firmas.js";
import { llamadaSimulada } from "./llamadasSimuladas.js";
import { pararProxy, urlDeBdDeProd } from "./prod.js";
import { ejecutarSoloLectura } from "./sqlDeSoloLectura.js";

/**
 * MCP de desarrollo de Alhabla (stdio, lo arranca Claude Code desde
 * `.mcp.json`). Herramientas:
 *
 * - consultar_bd_dev / consultar_bd_prod: SQL de solo lectura.
 * - generar_jwt_dev: sesión de un usuario de dev para probar rutas con curl.
 * - simular_webhook_telnyx / simular_webhook_retell: peticiones firmadas
 *   como las del proveedor contra el backend local.
 *
 * stdout es el canal del protocolo: todo log va a stderr.
 */

const servidor = new McpServer({ name: "alhabla-dev", version: "1.0.0" });

const BASE_TELNYX_SIMULACION = "http://localhost:3010";
const BASE_RETELL_DEV = "http://localhost:3000";

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

async function enviar(url: URL, cuerpo: string, cabeceras: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabeceras },
    body: cuerpo,
  });
  const texto = await res.text();
  let cuerpoDeRespuesta: unknown = texto;
  try {
    cuerpoDeRespuesta = JSON.parse(texto);
  } catch {
    // No es JSON: se devuelve el texto tal cual.
  }
  return { status: res.status, respuesta: cuerpoDeRespuesta };
}

servidor.registerTool(
  "simular_webhook_telnyx",
  {
    title: "Simular un webhook firmado de Telnyx",
    description:
      "POST firmado con Ed25519 (clave de simulación local) a una ruta /webhooks/telnyx… del backend de simulación (localhost:3010, servicio backend-sim de docker-compose, perfil sim). Para una tool de voz (ruta /webhooks/telnyx/tools/<tool>, cuerpo = argumentos de la tool) pasa businessId: crea o reutiliza una llamada simulada de ese negocio en la BD de dev y pone la cabecera x-alhabla-call-control-id. OJO: la tool se ejecuta de verdad (reserva en el calendario real del negocio, avisos por WhatsApp…).",
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
        .describe("Usa esta llamada en vez de crear una simulada"),
      cabeceras: z.record(z.string()).optional(),
      baseUrl: z.string().optional().describe(`Por defecto ${BASE_TELNYX_SIMULACION}`),
    },
  },
  ({ ruta, cuerpo, businessId, telefonoCliente, callControlId, cabeceras, baseUrl }) =>
    conErrores(async () => {
      if (!/^\/webhooks\/telnyx(\/|$)/.test(ruta)) {
        throw new Error("[MCP] La ruta tiene que empezar por /webhooks/telnyx");
      }
      const env = cargarEnv();
      const url = new URL(ruta, exigirUrlLocal(baseUrl ?? BASE_TELNYX_SIMULACION));

      let llamada: { callId: string; creada: boolean } | undefined;
      if (!callControlId && businessId) {
        llamada = await llamadaSimulada(urlDeBdDeDev(env), businessId, telefonoCliente);
      }
      const idDeLlamada = callControlId ?? llamada?.callId;

      const texto = JSON.stringify(cuerpo);
      const { firma, marcaDeTiempo } = firmarComoTelnyx(
        texto,
        variable(env, "TELNYX_PRIVATE_KEY_SIMULACION")
      );
      const resultado = await enviar(url, texto, {
        ...(idDeLlamada ? { "x-alhabla-call-control-id": idDeLlamada } : {}),
        ...cabeceras,
        "telnyx-signature-ed25519": firma,
        "telnyx-timestamp": marcaDeTiempo,
      });
      return { url: url.toString(), llamada: idDeLlamada ?? null, llamadaCreada: llamada?.creada ?? false, ...resultado };
    })
);

servidor.registerTool(
  "simular_webhook_retell",
  {
    title: "Simular un webhook firmado de Retell",
    description:
      "POST firmado como Retell (x-retell-signature con la RETELL_API_KEY de dev) a una ruta /webhooks/retell… del backend de dev (localhost:3000). Para tools: /webhooks/retell/tools/<retellAgentId>/<tool> con { call: { call_id }, args }.",
    inputSchema: {
      ruta: z.string().describe("Ej.: /webhooks/retell/inbound"),
      cuerpo: z.record(z.unknown()),
      baseUrl: z.string().optional().describe(`Por defecto ${BASE_RETELL_DEV}`),
    },
  },
  ({ ruta, cuerpo, baseUrl }) =>
    conErrores(async () => {
      if (!/^\/webhooks\/retell(\/|$)/.test(ruta)) {
        throw new Error("[MCP] La ruta tiene que empezar por /webhooks/retell");
      }
      const env = cargarEnv();
      const url = new URL(ruta, exigirUrlLocal(baseUrl ?? BASE_RETELL_DEV));
      const texto = JSON.stringify(cuerpo);
      const firma = await firmarComoRetell(texto, variable(env, "RETELL_API_KEY"));
      return { url: url.toString(), ...(await enviar(url, texto, { "x-retell-signature": firma })) };
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
