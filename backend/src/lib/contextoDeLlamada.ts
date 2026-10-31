import { prisma } from "./prisma.js";
import { parseAgentSettings } from "./managedAgentPrompt.js";
import { resolverIdiomas } from "./idiomas/resolver.js";
import { cooficialDeLaZona } from "./idiomas/zona.js";
import { IDIOMA_OBLIGATORIO } from "./idiomas/ajustes.js";
import {
  componerSaludoDeLlamada,
  esCodigoDeIdioma,
  type CodigoDeIdioma,
} from "./idiomas/catalogo.js";
import { vozDeLaCooficial } from "./telnyxAssistantPayload.js";
import { isBusinessType, type BusinessType } from "./businessType.js";
import {
  estadoDeGrabacion,
  telefonoDelCliente,
  type TelefonosDelNegocio,
} from "./grabacion.js";
import {
  contextoDelCliente,
  type VariablesDeLaLlamada,
} from "./seccionesDelPrompt.js";

/**
 * Lo que la recepcionista sabe de una llamada antes de descolgar
 * (decisiones del usuario del 2026-10-13): si quien llama ya reservó (su
 * nombre y su último servicio), si deja grabar sus llamadas (lib/
 * grabacion.ts), en qué idioma habló la última vez (lib/idiomaDelCliente.ts)
 * y si el negocio está en su primera semana desde la primera llamada. Con
 * eso el backend elige el saludo, su idioma y su voz y las variables del
 * prompt, y contesta (handleCallInitiated). No pasa por el modelo: no añade
 * latencia ni depende de que se acuerde.
 */

export interface ContextoDeLlamada {
  saludo: string;
  variables: VariablesDeLaLlamada;
  /** Grabar desde que se contesta: el cliente lo aceptó en otra llamada. */
  grabar: boolean;
  /** La voz de esta llamada si no es la del assistant: la de la cooficial
   * de la zona (Marta o Sergio) cuando el cliente habló en ella la última
   * vez, para saludarle ya en su idioma con su voz. Si no, null. */
  voz: ReturnType<typeof vozDeLaCooficial> | null;
}

/**
 * Nichos en los que el saludo no nombra el último servicio: puede ser un
 * dato de salud y el teléfono puede usarlo otra persona de la casa. Se dice
 * «lo de la última vez»; el servicio sigue llegando al prompt.
 */
const SIN_SERVICIO_EN_EL_SALUDO: ReadonlySet<BusinessType> = new Set([
  "fisioterapia",
  "centro-de-estetica",
  "other",
]);

const UNA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

export async function resolverContextoDeLlamada(input: {
  business: TelefonosDelNegocio & {
    id: string;
    name: string;
    agentSettings: unknown;
    businessType: string | null;
    /** Para la cooficial de la zona (lib/idiomas/zona.ts). */
    address?: string | null;
    businessDetails?: string | null;
  };
  /** `from` de la llamada; null o «anonymous» si llama con número oculto. */
  telefono: string | null;
  ahora?: Date;
}): Promise<ContextoDeLlamada> {
  const { business } = input;
  const ahora = input.ahora ?? new Date();
  const telefono = telefonoDelCliente(input.telefono, business);

  const [primeraLlamada, cliente, reserva] = await Promise.all([
    // Los chats de WhatsApp son filas Call sintéticas: no cuentan.
    prisma.call.findFirst({
      where: { businessId: business.id, voiceProvider: { not: "whatsapp" } },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true },
    }),
    telefono
      ? prisma.clienteDelNegocio.findUnique({
          where: {
            businessId_telefono: { businessId: business.id, telefono },
          },
          select: { grabacionAceptada: true, idioma: true },
        })
      : null,
    telefono
      ? prisma.booking.findFirst({
          where: {
            clientName: { not: null },
            OR: [
              { call: { businessId: business.id, fromNumber: telefono } },
              { clientPhone: telefono, call: { businessId: business.id } },
            ],
          },
          orderBy: { createdAt: "desc" },
          select: { clientName: true, serviceIds: true },
        })
      : null,
  ]);

  const servicios = reserva?.serviceIds.length
    ? await prisma.service.findMany({
        where: {
          id: { in: reserva.serviceIds },
          businessId: business.id,
          active: true,
          deletedAt: null,
        },
        select: { name: true },
      })
    : [];
  const nombresDeServicios = servicios.map((servicio) => servicio.name);
  // Para el prompt (en castellano): «Coloración, Hidratación profunda y
  // Peinado».
  const ultimoServicio =
    nombresDeServicios.length > 1
      ? `${nombresDeServicios.slice(0, -1).join(", ")} y ${nombresDeServicios.at(-1)}`
      : (nombresDeServicios[0] ?? null);
  const nombre = reserva?.clientName?.trim() || null;

  const tipo: BusinessType = isBusinessType(business.businessType)
    ? business.businessType
    : "other";
  const grabar = estadoDeGrabacion(cliente?.grabacionAceptada) === "aceptada";
  // La llamada en curso aún no está guardada: sin ninguna anterior, es la
  // primera.
  const primeraSemana =
    !primeraLlamada ||
    ahora.getTime() - primeraLlamada.startedAt.getTime() < UNA_SEMANA_MS;

  // Con la cooficial de donde está el negocio, como el assistant
  // (telnyxAgentSync.ts).
  const perfil = resolverIdiomas({
    ...parseAgentSettings(business.agentSettings),
    zona: cooficialDeLaZona(business),
  });
  // Saluda en el idioma en que habló la última vez si la recepcionista lo
  // habla; si no (o es nuevo), en el principal. La cooficial de la zona va
  // con su voz desde el saludo: la del assistant no la habla.
  const idiomaGuardado = cliente?.idioma;
  const idiomaDelSaludo: CodigoDeIdioma =
    esCodigoDeIdioma(idiomaGuardado) && perfil.idiomas.includes(idiomaGuardado)
      ? idiomaGuardado
      : perfil.principal;
  const cooficial = perfil.cooficialDeLaZona;
  const voz =
    cooficial && idiomaDelSaludo === cooficial.idioma
      ? vozDeLaCooficial(cooficial)
      : null;
  // El saludo nombra el servicio solo si es uno y saluda en castellano un
  // negocio que atiende en castellano: con varios se hacía largo («¿Quieres
  // repetir Coloración y Hidratación profunda y Peinado…?», llamada de
  // producción del 14-10), y los nombres del catálogo suelen estar en el
  // idioma del negocio, que leídos dentro de otro suenan mal. Si no, «lo de
  // la última vez».
  const servicioDelSaludo =
    !SIN_SERVICIO_EN_EL_SALUDO.has(tipo) &&
    perfil.principal === IDIOMA_OBLIGATORIO &&
    idiomaDelSaludo === IDIOMA_OBLIGATORIO &&
    nombresDeServicios.length === 1
      ? nombresDeServicios[0]
      : null;
  const saludo = componerSaludoDeLlamada(idiomaDelSaludo, {
    negocio: business.name,
    genero: perfil.genero,
    primeraSemana,
    cliente: nombre ? { nombre, servicio: servicioDelSaludo } : null,
    grabando: grabar,
  });

  return {
    saludo,
    grabar,
    voz,
    variables: {
      nombre_cliente: nombre ?? "",
      ultimo_servicio: ultimoServicio ?? "",
      // El bloque del prompt v2; v1 no lo usa y Telnyx lo ignora.
      contexto_cliente: contextoDelCliente(nombre, ultimoServicio),
    },
  };
}
