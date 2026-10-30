import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { telnyxAdapter } from "../src/adapters/telnyx/TelnyxAdapter.js";
import { telnyxAiAdapter } from "../src/adapters/telnyx/TelnyxAiAdapter.js";
import { whatsappAdapter } from "../src/adapters/whatsapp/WhatsAppAdapter.js";
import { cargarEnv, urlDeBdDeDev, variable } from "./entorno.js";
import {
  gcloud,
  leerSecreto,
  REGION,
  SERVICIO,
  type Gcloud,
} from "./gcloud.js";
import { urlDeBdDeProd } from "./prod.js";
import {
  buscarUsuarioDeDev,
  crearEnlaceDeEntradaDeDev,
  llamarApiDeDev,
} from "./sesionDeDev.js";
import { ejecutarSoloLectura } from "./sqlDeSoloLectura.js";

/**
 * Inventario del panel de desarrollo (http://localhost:3005/inventario):
 * cuentas, números y assistants de Telnyx de dev y de producción, sus
 * ediciones (por la API de la app, como el dueño de la cuenta) y los
 * fantasmas de la cuenta de Telnyx.
 *
 * La cuenta de Telnyx es UNA para dev y producción (comprobado el 30-10: la
 * clave de dev lee los assistants de producción). Por eso un fantasma se
 * decide cruzando la cuenta con las DOS bases de datos y con los ids que
 * fijan el `.env` y Cloud Run (Gestor y demos de la landing), con los números
 * registrados en el WABA y con los que llevan una etiqueta de WhatsApp en
 * Telnyx (los de sector en reserva, AGENTS.md § WhatsApp: no tienen fila en
 * ninguna BD y no se pueden borrar). Si falta
 * cualquiera de esas fuentes no se marca nada. Cruzar con una sola BD es lo
 * que en septiembre borró los agentes de seis negocios (PR #86).
 */
export type Entorno = "dev" | "prod";

/** Se lee en cada escritura: los tests lo cambian con ALHABLA_INVENTARIO_LOG. */
export function logDelInventario(): string {
  return (
    process.env.ALHABLA_INVENTARIO_LOG ??
    join(homedir(), "Library/Logs/alhabla-dev/inventario.log")
  );
}

const API_DE_PROD = "https://api.alhabla.ai";

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/** Solo lo que el inventario enseña: nada de Stripe, tokens, teléfonos del
 * local o del dueño, ni clientes finales. */
export const SQL_DE_CUENTAS = `SELECT id, name, plan, "subscriptionStatus", "phoneNumberStatus",
       "telnyxPhoneNumber", "telnyxPhoneNumberId", "telnyxPendingPhoneNumber", "createdAt"
  FROM businesses
 ORDER BY "createdAt"`;

export const SQL_DE_AGENTES = `SELECT id, "businessId", name, "telnyxAssistantId", active, "deletedAt",
       "promptManuallyEdited", "telnyxSyncError", "telnyxSyncedAt", "systemPrompt"
  FROM agents
 ORDER BY "createdAt"`;

export const SQL_DE_SENDERS = `SELECT audience, "phoneNumber", "telnyxPhoneNumberId", status, "displayName"
  FROM whatsapp_senders
 ORDER BY audience`;

export type AgenteDelInventario = {
  id: string;
  nombre: string;
  assistantId: string | null;
  activo: boolean;
  borrado: string | null;
  promptEditadoAMano: boolean;
  errorDeSync: string | null;
  sincronizado: string | null;
  systemPrompt: string;
};

export type CuentaDelInventario = {
  id: string;
  nombre: string;
  plan: string;
  estadoDeSuscripcion: string | null;
  estadoDelNumero: string | null;
  /** El número de Telnyx de la recepcionista (el destino del desvío). */
  numero: {
    numero: string | null;
    telnyxId: string | null;
    pendiente: string | null;
  } | null;
  creada: string;
  agentes: AgenteDelInventario[];
};

/** Los dos WhatsApp de Alhabla: no son de ninguna cuenta. */
export type NumeroDePlataforma = {
  tipo: "whatsapp_reservas" | "whatsapp_gestor" | "otro";
  audiencia: string;
  numero: string;
  telnyxId: string | null;
  estado: string;
  nombreVisible: string | null;
};

export type Inventario = {
  entorno: Entorno;
  cuentas: CuentaDelInventario[];
  numerosDePlataforma: NumeroDePlataforma[];
};

export type Ejecutor = (
  sql: string,
  opciones?: { maxCaracteresPorValor?: number }
) => Promise<{ filas: Record<string, unknown>[] }>;

type Fila = Record<string, unknown>;
const texto = (valor: unknown) => (valor == null ? null : String(valor));

export function montarInventario(
  entorno: Entorno,
  cuentas: Fila[],
  agentes: Fila[],
  senders: Fila[]
): Inventario {
  const porCuenta = new Map<string, AgenteDelInventario[]>();
  for (const a of agentes) {
    const lista = porCuenta.get(String(a.businessId)) ?? [];
    lista.push({
      id: String(a.id),
      nombre: String(a.name ?? ""),
      assistantId: texto(a.telnyxAssistantId),
      activo: Boolean(a.active),
      borrado: texto(a.deletedAt),
      promptEditadoAMano: Boolean(a.promptManuallyEdited),
      errorDeSync: texto(a.telnyxSyncError),
      sincronizado: texto(a.telnyxSyncedAt),
      systemPrompt: String(a.systemPrompt ?? ""),
    });
    porCuenta.set(String(a.businessId), lista);
  }
  return {
    entorno,
    cuentas: cuentas.map((c) => ({
      id: String(c.id),
      nombre: String(c.name ?? ""),
      plan: String(c.plan ?? ""),
      estadoDeSuscripcion: texto(c.subscriptionStatus),
      estadoDelNumero: texto(c.phoneNumberStatus),
      numero:
        c.telnyxPhoneNumber ||
        c.telnyxPhoneNumberId ||
        c.telnyxPendingPhoneNumber
          ? {
              numero: texto(c.telnyxPhoneNumber),
              telnyxId: texto(c.telnyxPhoneNumberId),
              pendiente: texto(c.telnyxPendingPhoneNumber),
            }
          : null,
      creada: String(c.createdAt ?? ""),
      agentes: porCuenta.get(String(c.id)) ?? [],
    })),
    numerosDePlataforma: senders.map((s) => ({
      tipo:
        s.audience === "client"
          ? "whatsapp_reservas"
          : s.audience === "owner"
            ? "whatsapp_gestor"
            : "otro",
      audiencia: String(s.audience ?? ""),
      numero: String(s.phoneNumber ?? ""),
      telnyxId: texto(s.telnyxPhoneNumberId),
      estado: String(s.status ?? ""),
      nombreVisible: texto(s.displayName),
    })),
  };
}

export async function urlDeBdDelEntorno(entorno: Entorno): Promise<string> {
  return entorno === "dev" ? urlDeBdDeDev(cargarEnv()) : urlDeBdDeProd();
}

export async function leerInventario(
  entorno: Entorno,
  ejecutar?: Ejecutor
): Promise<Inventario> {
  const ejecutor: Ejecutor =
    ejecutar ??
    (async (sql, opciones) => {
      const url = await urlDeBdDelEntorno(entorno);
      return ejecutarSoloLectura(url, sql, {
        limiteFilas: 1_000,
        ...opciones,
      });
    });
  // Una tras otra: el rol de lectura de producción admite 2 conexiones.
  const cuentas = await ejecutor(SQL_DE_CUENTAS);
  const agentes = await ejecutor(SQL_DE_AGENTES, {
    maxCaracteresPorValor: 200_000,
  });
  const senders = await ejecutor(SQL_DE_SENDERS);
  return montarInventario(entorno, cuentas.filas, agentes.filas, senders.filas);
}

// ---------------------------------------------------------------------------
// Fantasmas
// ---------------------------------------------------------------------------

export type AssistantDeTelnyx = {
  id: string;
  name: string;
  createdAt: string | null;
};
export type NumeroDeTelnyx = {
  id: string;
  phoneNumber: string;
  status: string;
  connectionId: string | null;
  tags: string[];
  createdAt: string | null;
};

/** Quién usa un assistant o un número: «dev · agente X de la cuenta Y». */
export type Referencias = {
  assistants: Map<string, string[]>;
  numeros: Map<string, string[]>;
  /** Assistants que solo apuntan agentes borrados: siguen siendo fantasmas. */
  deAgentesBorrados: Map<string, string[]>;
};

export function referenciasVacias(): Referencias {
  return {
    assistants: new Map(),
    numeros: new Map(),
    deAgentesBorrados: new Map(),
  };
}

function anotar(
  mapa: Map<string, string[]>,
  clave: string | null,
  quien: string
) {
  if (!clave) return;
  mapa.set(clave, [...(mapa.get(clave) ?? []), quien]);
}

export function anotarInventario(ref: Referencias, inventario: Inventario) {
  const e = inventario.entorno;
  for (const cuenta of inventario.cuentas) {
    const de = `${e} · cuenta «${cuenta.nombre}» (${cuenta.id})`;
    anotar(ref.numeros, cuenta.numero?.numero ?? null, `${de}: número de voz`);
    anotar(
      ref.numeros,
      cuenta.numero?.telnyxId ?? null,
      `${de}: número de voz`
    );
    anotar(
      ref.numeros,
      cuenta.numero?.pendiente ?? null,
      `${de}: número a medio comprar`
    );
    for (const agente of cuenta.agentes) {
      anotar(
        agente.borrado ? ref.deAgentesBorrados : ref.assistants,
        agente.assistantId,
        `${de}: agente ${agente.id}${agente.borrado ? " (borrado)" : ""}`
      );
    }
  }
  for (const sender of inventario.numerosDePlataforma) {
    const quien = `${e} · WhatsApp de plataforma (${sender.audiencia})`;
    anotar(ref.numeros, sender.numero, quien);
    anotar(ref.numeros, sender.telnyxId, quien);
  }
}

/** Los ids que fija la configuración: el Gestor, los demos de la landing y
 * el número de WhatsApp desde el que se envía. */
export function anotarVariables(
  ref: Referencias,
  origen: string,
  variables: Record<string, string>
) {
  for (const [nombre, valor] of Object.entries(variables)) {
    if (/^assistant-[\w-]+$/.test(valor)) {
      anotar(ref.assistants, valor, `${origen}: ${nombre}`);
    } else if (/TELNYX|WHATSAPP/.test(nombre) && /^\+\d{6,15}$/.test(valor)) {
      anotar(ref.numeros, valor, `${origen}: ${nombre}`);
    }
  }
}

/** `whatsapp-sector` y similares: números de WhatsApp de Alhabla en reserva. */
function etiquetaDeWhatsapp(numero: NumeroDeTelnyx): string | undefined {
  return numero.tags.find((tag) => /whatsapp/i.test(tag));
}

export type Fantasmas = {
  assistants: (AssistantDeTelnyx & { nota?: string[] })[];
  numeros: NumeroDeTelnyx[];
  enLaCuenta: { assistants: number; numeros: number };
};

export function cruzarFantasmas(
  assistants: AssistantDeTelnyx[],
  numeros: NumeroDeTelnyx[],
  ref: Referencias
): Fantasmas {
  return {
    assistants: assistants
      .filter((a) => !ref.assistants.has(a.id))
      .map((a) =>
        ref.deAgentesBorrados.has(a.id)
          ? { ...a, nota: ref.deAgentesBorrados.get(a.id) }
          : a
      ),
    numeros: numeros.filter(
      (n) => !ref.numeros.has(n.phoneNumber) && !ref.numeros.has(n.id)
    ),
    enLaCuenta: { assistants: assistants.length, numeros: numeros.length },
  };
}

/** De dónde sale todo lo que decide qué es fantasma (se inyecta en los tests). */
export type Fuentes = {
  listarAssistants: () => Promise<AssistantDeTelnyx[]>;
  listarNumeros: () => Promise<NumeroDeTelnyx[]>;
  /** Los números registrados en el WABA (WhatsApp), estén o no en una BD. */
  numerosDelWaba: () => Promise<string[]>;
  inventario: (entorno: Entorno) => Promise<Inventario>;
  variablesDeDev: () => Promise<Record<string, string>>;
  variablesDeProd: () => Promise<Record<string, string>>;
};

/** Las variables de entorno del servicio de Cloud Run (solo las de valor
 * literal: los secretos no son ids de Telnyx). */
export async function variablesDeCloudRun(
  gcloudFn: Gcloud = gcloud
): Promise<Record<string, string>> {
  const salida = await gcloudFn([
    "run",
    "services",
    "describe",
    SERVICIO,
    `--region=${REGION}`,
    "--format=json(spec.template.spec.containers)",
  ]);
  const servicio = JSON.parse(salida) as {
    spec?: {
      template?: {
        spec?: { containers?: { env?: { name: string; value?: string }[] }[] };
      };
    };
  };
  const variables: Record<string, string> = {};
  for (const contenedor of servicio.spec?.template?.spec?.containers ?? []) {
    for (const { name, value } of contenedor.env ?? []) {
      if (typeof value === "string") variables[name] = value;
    }
  }
  if (Object.keys(variables).length === 0) {
    throw new Error("Cloud Run no devolvió ninguna variable de entorno");
  }
  return variables;
}

/** Los adaptadores leen la clave de process.env: la del `.env` de dev, que es
 * de la misma cuenta que la de producción. */
function conClaveDeTelnyx<T>(trabajo: () => Promise<T>): Promise<T> {
  process.env.TELNYX_API_KEY ??= variable(cargarEnv(), "TELNYX_API_KEY");
  return trabajo();
}

export const FUENTES: Fuentes = {
  listarAssistants: () =>
    conClaveDeTelnyx(() => telnyxAiAdapter.listAssistants()),
  listarNumeros: () => conClaveDeTelnyx(() => telnyxAdapter.listNumbers()),
  numerosDelWaba: () =>
    conClaveDeTelnyx(async () =>
      (await whatsappAdapter.listWabaPhoneNumbers()).map((n) => n.phoneNumber)
    ),
  inventario: (entorno) => leerInventario(entorno),
  variablesDeDev: async () => cargarEnv(),
  variablesDeProd: () => variablesDeCloudRun(),
};

async function fuente<T>(
  nombre: string,
  trabajo: () => Promise<T>
): Promise<T> {
  try {
    return await trabajo();
  } catch (error) {
    throw new Error(
      `No se puede decidir qué es fantasma sin ${nombre}: ${(error as Error).message.replace(/^\[MCP\] /, "")}`,
      { cause: error }
    );
  }
}

/**
 * Lee la cuenta de Telnyx y TODAS las fuentes que pueden usar algo de ella.
 * Si una falla, lanza: un fantasma a medias es un borrado a ciegas.
 */
export async function buscarFantasmas(fuentes: Fuentes = FUENTES) {
  // Una tras otra las de producción (el proxy y el rol de lectura).
  const assistants = await fuente(
    "la lista de assistants de Telnyx",
    fuentes.listarAssistants
  );
  const numeros = await fuente(
    "la lista de números de Telnyx",
    fuentes.listarNumeros
  );
  const delWaba = await fuente(
    "los números del WABA de WhatsApp",
    fuentes.numerosDelWaba
  );
  const dev = await fuente("la BD de dev", () => fuentes.inventario("dev"));
  const prod = await fuente("la BD de producción", () =>
    fuentes.inventario("prod")
  );
  const variablesDeDev = await fuente("el .env de dev", fuentes.variablesDeDev);
  const variablesDeProd = await fuente(
    "las variables de Cloud Run",
    fuentes.variablesDeProd
  );

  const ref = referenciasVacias();
  anotarInventario(ref, dev);
  anotarInventario(ref, prod);
  anotarVariables(ref, "dev · .env", variablesDeDev);
  anotarVariables(ref, "prod · Cloud Run", variablesDeProd);
  for (const numero of delWaba) {
    anotar(ref.numeros, numero, "Telnyx · registrado en el WABA de WhatsApp");
  }
  for (const numero of numeros) {
    const etiqueta = etiquetaDeWhatsapp(numero);
    if (etiqueta) {
      anotar(
        ref.numeros,
        numero.id,
        `Telnyx · etiqueta ${etiqueta} (WhatsApp en reserva)`
      );
    }
  }
  return {
    ...cruzarFantasmas(assistants, numeros, ref),
    cruzadoCon: [
      `BD de dev: ${dev.cuentas.length} cuentas`,
      `BD de producción: ${prod.cuentas.length} cuentas`,
      ".env de dev (Gestor, demos, WhatsApp)",
      "Cloud Run alhabla-api (Gestor, demos, WhatsApp)",
      `WABA de WhatsApp: ${delWaba.length} números`,
      "etiquetas de WhatsApp en Telnyx",
    ],
    referencias: ref,
  };
}

export type PlanDeBorrado =
  | {
      esFantasma: true;
      tipo: "assistant" | "numero";
      id: string;
      descripcion: string;
      seLibera: string[];
      aviso: string;
    }
  | { esFantasma: false; id: string; motivo: string[] };

const AVISO_SIN_VUELTA_ATRAS =
  "No tiene vuelta atrás. La cuenta de Telnyx es la de dev y producción a la vez.";

/** El dry-run: qué se borraría y por qué es fantasma, sin tocar nada. */
export async function simularBorrado(
  id: string,
  fuentes: Fuentes = FUENTES
): Promise<PlanDeBorrado> {
  const { assistants, numeros, referencias } = await buscarFantasmas(fuentes);
  const assistant = assistants.find((a) => a.id === id);
  if (assistant) {
    return {
      esFantasma: true,
      tipo: "assistant",
      id,
      descripcion: `Assistant «${assistant.name}»${assistant.createdAt ? `, creado el ${assistant.createdAt.slice(0, 10)}` : ""}`,
      seLibera: [
        `El assistant ${id} (deleteAssistant)`,
        `Su app TeXML «ai-${id}», si existe (deleteTexmlAppOfAssistant)`,
      ],
      aviso: [
        AVISO_SIN_VUELTA_ATRAS,
        ...(assistant.nota
          ? [`Solo lo apuntan agentes borrados: ${assistant.nota.join("; ")}.`]
          : []),
      ].join(" "),
    };
  }
  const numero = numeros.find((n) => n.id === id || n.phoneNumber === id);
  if (numero) {
    return {
      esFantasma: true,
      tipo: "numero",
      id: numero.id,
      descripcion: `Número ${numero.phoneNumber} (${numero.status || "sin estado"})${numero.createdAt ? `, comprado el ${numero.createdAt.slice(0, 10)}` : ""}`,
      seLibera: [
        `El número ${numero.phoneNumber} vuelve a Telnyx (releaseNumber ${numero.id}); deja de facturarse y otro cliente de Telnyx puede comprarlo`,
      ],
      aviso: AVISO_SIN_VUELTA_ATRAS,
    };
  }
  const motivo = [
    ...(referencias.assistants.get(id) ?? []),
    ...(referencias.numeros.get(id) ?? []),
  ];
  return {
    esFantasma: false,
    id,
    motivo: motivo.length
      ? motivo
      : ["No está en la cuenta de Telnyx (o ya se borró)"],
  };
}

export function anotarEnElLog(entrada: Record<string, unknown>): void {
  const log = logDelInventario();
  mkdirSync(dirname(log), { recursive: true });
  appendFileSync(
    log,
    `${JSON.stringify({ momento: new Date().toISOString(), ...entrada })}\n`
  );
}

export type Borrador = {
  borrarAssistant: (id: string) => Promise<void>;
  borrarAppTexml: (id: string) => Promise<number>;
  liberarNumero: (id: string) => Promise<void>;
};

const BORRADOR: Borrador = {
  borrarAssistant: (id) =>
    conClaveDeTelnyx(() => telnyxAiAdapter.deleteAssistant(id)),
  borrarAppTexml: (id) =>
    conClaveDeTelnyx(() => telnyxAiAdapter.deleteTexmlAppOfAssistant(id)),
  liberarNumero: (id) =>
    conClaveDeTelnyx(() => telnyxAdapter.releaseNumber(id)),
};

/**
 * Borra un fantasma con la misma secuencia que la baja de cuenta
 * (accountService.ts): releaseNumber, o deleteAssistant y su app TeXML.
 * Exige el id escrito y la marca de cuenta compartida, y vuelve a
 * comprobar que sigue siendo fantasma justo antes.
 */
export async function borrarFantasma(
  {
    id,
    confirmacion,
    cuentaCompartida,
  }: { id: string; confirmacion: string; cuentaCompartida: boolean },
  fuentes: Fuentes = FUENTES,
  borrador: Borrador = BORRADOR
) {
  if (confirmacion.trim() !== id) {
    throw new ErrorDeInventario("Escribe el id exacto para confirmar", 400);
  }
  if (!cuentaCompartida) {
    throw new ErrorDeInventario(
      "Marca que sabes que la cuenta de Telnyx es la de producción",
      400
    );
  }
  const plan = await simularBorrado(id, fuentes);
  if (!plan.esFantasma) {
    anotarEnElLog({
      operacion: "borrar_fantasma",
      id,
      resultado: "rechazado",
      motivo: plan.motivo,
    });
    throw new ErrorDeInventario(
      `No es un fantasma: ${plan.motivo.join("; ")}`,
      409
    );
  }
  anotarEnElLog({
    operacion: "borrar_fantasma",
    tipo: plan.tipo,
    id: plan.id,
    descripcion: plan.descripcion,
    resultado: "empieza",
  });
  const hecho: string[] = [];
  try {
    if (plan.tipo === "numero") {
      await borrador.liberarNumero(plan.id);
      hecho.push(`Número ${plan.id} liberado`);
    } else {
      try {
        await borrador.borrarAssistant(plan.id);
        hecho.push(`Assistant ${plan.id} borrado`);
      } catch (error) {
        // Como en accountService: un 404 es que ya no estaba; la app TeXML
        // se intenta igual.
        if ((error as { status?: number }).status !== 404) throw error;
        hecho.push(`Assistant ${plan.id} ya no existía`);
      }
      const apps = await borrador.borrarAppTexml(plan.id);
      hecho.push(
        `${apps} app${apps === 1 ? "" : "s"} TeXML borrada${apps === 1 ? "" : "s"}`
      );
    }
  } catch (error) {
    anotarEnElLog({
      operacion: "borrar_fantasma",
      id: plan.id,
      resultado: "fallo",
      hecho,
      error: (error as Error).message,
    });
    throw error;
  }
  anotarEnElLog({
    operacion: "borrar_fantasma",
    id: plan.id,
    resultado: "hecho",
    hecho,
  });
  return { id: plan.id, hecho };
}

// ---------------------------------------------------------------------------
// Ediciones: por la API de la app, como el dueño de la cuenta
// ---------------------------------------------------------------------------

export class ErrorDeInventario extends Error {
  constructor(
    mensaje: string,
    readonly codigo: number
  ) {
    super(mensaje);
  }
}

const IdSchema = z.string().regex(/^[a-z0-9]{10,40}$/, "id no válido");

export const EdicionSchema = z
  .discriminatedUnion("tipo", [
    z.object({
      tipo: z.literal("cuenta"),
      entorno: z.enum(["dev", "prod"]),
      businessId: IdSchema,
      nombre: z.string().trim().min(1).max(200),
      confirmacion: z.string().optional(),
    }),
    z.object({
      tipo: z.literal("agente"),
      entorno: z.enum(["dev", "prod"]),
      businessId: IdSchema,
      agenteId: IdSchema,
      activo: z.boolean().optional(),
      systemPrompt: z.string().min(1).max(100_000).optional(),
      confirmacion: z.string().optional(),
    }),
  ])
  .refine(
    (e) =>
      e.tipo === "cuenta" ||
      e.activo !== undefined ||
      e.systemPrompt !== undefined,
    { message: "Nada que cambiar" }
  );
export type Edicion = z.infer<typeof EdicionSchema>;

/** La ruta de la app que hace ese cambio, con su lógica (PATCH /agents/:id
 * marca promptManuallyEdited y sincroniza con Telnyx). */
export function peticionDeLaEdicion(edicion: Edicion): {
  ruta: string;
  cuerpo: Record<string, unknown>;
  objetivo: string;
} {
  if (edicion.tipo === "cuenta") {
    return {
      ruta: "/business/me",
      cuerpo: { name: edicion.nombre },
      objetivo: edicion.businessId,
    };
  }
  return {
    ruta: `/agents/${edicion.agenteId}`,
    cuerpo: {
      ...(edicion.activo !== undefined ? { active: edicion.activo } : {}),
      ...(edicion.systemPrompt !== undefined
        ? { systemPrompt: edicion.systemPrompt }
        : {}),
    },
    objetivo: edicion.agenteId,
  };
}

export type LlamadorDeApi = (
  entorno: Entorno,
  peticion: {
    metodo: string;
    ruta: string;
    cuerpo: unknown;
    businessId: string;
  }
) => Promise<{ status: number; respuesta: unknown }>;

/** En producción, con un JWT firmado con el JWT_SECRET de producción para el
 * usuario más antiguo de la cuenta (el mismo payload que createToken). */
async function llamarApiDeProd(peticion: {
  metodo: string;
  ruta: string;
  cuerpo: unknown;
  businessId: string;
}) {
  const { filas } = await ejecutarSoloLectura(
    await urlDeBdDeProd(),
    `SELECT id, "businessId", "tokenVersion" FROM users
      WHERE "businessId" = $1 ORDER BY "createdAt" LIMIT 1`,
    { parametros: [peticion.businessId] }
  );
  const usuario = filas[0] as
    { id: string; businessId: string; tokenVersion: number } | undefined;
  if (!usuario) throw new ErrorDeInventario("Esa cuenta no tiene usuario", 404);
  const token = jwt.sign(
    {
      id: usuario.id,
      businessId: usuario.businessId,
      tv: usuario.tokenVersion,
    },
    await leerSecreto("JWT_SECRET"),
    { expiresIn: "2m" }
  );
  const res = await fetch(new URL(peticion.ruta, API_DE_PROD), {
    method: peticion.metodo,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(peticion.cuerpo),
    signal: AbortSignal.timeout(60_000),
  });
  const texto = await res.text();
  let respuesta: unknown = texto;
  try {
    respuesta = JSON.parse(texto);
  } catch {
    // Se devuelve el texto.
  }
  return { status: res.status, respuesta };
}

export const LLAMADOR: LlamadorDeApi = async (entorno, peticion) => {
  if (entorno === "prod") return llamarApiDeProd(peticion);
  const env = cargarEnv();
  const url = urlDeBdDeDev(env);
  // Sin usuario no hay sesión con la que entrar en la app: no es un fallo
  // del panel, es que esa cuenta no se puede editar desde la app.
  await buscarUsuarioDeDev(url, { businessId: peticion.businessId }).catch(
    () => {
      throw new ErrorDeInventario(
        "Esta cuenta no tiene usuario: la app no deja editarla",
        409
      );
    }
  );
  return llamarApiDeDev({
    env,
    urlDeBdDeDev: url,
    metodo: peticion.metodo,
    ruta: peticion.ruta,
    cuerpo: peticion.cuerpo,
    businessId: peticion.businessId,
  });
};

/** Lo que se anota de una edición: el prompt, solo su tamaño. */
function resumenDelCambio(cuerpo: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(cuerpo).map(([campo, valor]) => [
      campo,
      campo === "systemPrompt" ? `${String(valor).length} caracteres` : valor,
    ])
  );
}

export async function editar(
  cuerpo: unknown,
  llamador: LlamadorDeApi = LLAMADOR
) {
  const resultado = EdicionSchema.safeParse(cuerpo);
  if (!resultado.success) {
    throw new ErrorDeInventario(
      resultado.error.errors.map((e) => e.message).join("; "),
      400
    );
  }
  const edicion = resultado.data;
  const { ruta, cuerpo: cambio, objetivo } = peticionDeLaEdicion(edicion);
  if (edicion.entorno === "prod" && edicion.confirmacion?.trim() !== objetivo) {
    throw new ErrorDeInventario(
      `En producción, escribe el id (${objetivo}) para confirmar`,
      400
    );
  }
  const anotacion = {
    operacion: `editar_${edicion.tipo}`,
    entorno: edicion.entorno,
    businessId: edicion.businessId,
    objetivo,
    cambio: resumenDelCambio(cambio),
  };
  const { status, respuesta } = await llamador(edicion.entorno, {
    metodo: "PATCH",
    ruta,
    cuerpo: cambio,
    businessId: edicion.businessId,
  }).catch((error: Error) => {
    anotarEnElLog({ ...anotacion, resultado: "fallo", error: error.message });
    throw error;
  });
  if (status >= 400) {
    const error = (respuesta as { error?: unknown })?.error ?? `HTTP ${status}`;
    anotarEnElLog({ ...anotacion, resultado: "rechazado", status, error });
    throw new ErrorDeInventario(
      `La app respondió ${status}: ${typeof error === "string" ? error : JSON.stringify(error)}`,
      status
    );
  }
  anotarEnElLog({ ...anotacion, resultado: "hecho", status });
  return {
    mensaje: `Guardado en ${edicion.entorno === "prod" ? "producción" : "dev"}`,
    status,
  };
}

/** «Entrar como esta cuenta» en la app de dev (el pase de entrar_en_app_dev). */
export async function enlaceDeEntrada(businessId: string) {
  if (!IdSchema.safeParse(businessId).success) {
    throw new ErrorDeInventario("id no válido", 400);
  }
  const url = urlDeBdDeDev(cargarEnv());
  const usuario = await buscarUsuarioDeDev(url, { businessId });
  return crearEnlaceDeEntradaDeDev(url, usuario, "/");
}
