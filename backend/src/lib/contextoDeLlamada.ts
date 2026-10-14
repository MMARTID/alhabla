import { prisma } from "./prisma.js";
import { parseAgentSettings } from "./managedAgentPrompt.js";
import { resolverIdiomas } from "./idiomas/resolver.js";
import { componerSaludoDeLlamada } from "./idiomas/catalogo.js";
import { isBusinessType, type BusinessType } from "./businessType.js";
import {
  estadoDeGrabacion,
  telefonoDelCliente,
  type TelefonosDelNegocio,
} from "./grabacion.js";
import type { VariablesDeLaLlamada } from "./seccionesDelPrompt.js";

/**
 * Lo que la recepcionista sabe de una llamada antes de descolgar
 * (decisiones del usuario del 2026-10-13): si quien llama ya reservó (su
 * nombre y su último servicio), si deja grabar sus llamadas (lib/
 * grabacion.ts) y si el negocio está en su primera semana desde la primera
 * llamada. Con eso el backend elige el saludo y las variables del prompt y
 * contesta (handleCallInitiated). No pasa por el modelo: no añade latencia
 * ni depende de que se acuerde.
 */

export interface ContextoDeLlamada {
  saludo: string;
  variables: VariablesDeLaLlamada;
  /** Grabar desde que se contesta: el cliente lo aceptó en otra llamada. */
  grabar: boolean;
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
          select: { grabacionAceptada: true },
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
  const ultimoServicio =
    servicios.map((servicio) => servicio.name).join(" y ") || null;
  const nombre = reserva?.clientName?.trim() || null;

  const tipo: BusinessType = isBusinessType(business.businessType)
    ? business.businessType
    : "other";
  const grabacion = estadoDeGrabacion(cliente?.grabacionAceptada);
  const grabar = grabacion === "aceptada";
  // La llamada en curso aún no está guardada: sin ninguna anterior, es la
  // primera.
  const primeraSemana =
    !primeraLlamada ||
    ahora.getTime() - primeraLlamada.startedAt.getTime() < UNA_SEMANA_MS;

  const perfil = resolverIdiomas(parseAgentSettings(business.agentSettings));
  const saludo = componerSaludoDeLlamada(perfil.principal, {
    negocio: business.name,
    genero: perfil.genero,
    primeraSemana,
    cliente: nombre
      ? {
          nombre,
          servicio: SIN_SERVICIO_EN_EL_SALUDO.has(tipo) ? null : ultimoServicio,
        }
      : null,
    grabando: grabar,
  });

  return {
    saludo,
    grabar,
    variables: {
      nombre_cliente: nombre ?? "",
      ultimo_servicio: ultimoServicio ?? "",
      grabacion,
    },
  };
}
