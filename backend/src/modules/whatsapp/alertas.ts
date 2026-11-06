import { prisma } from "../../lib/prisma.js";
import { errorMessage } from "../../lib/logUtils.js";
import {
  enqueueEmailJob,
  enqueueRecordatorioDeCalendarioJob,
} from "../../lib/cloudTasks.js";
import {
  forwardingCheckedEmail,
  operationalAlertEmail,
} from "../../lib/emailTemplates.js";
import {
  avisarAlerta,
  RUTA_DE_ALERTA,
  type CausaDeAlerta,
  type ResultadoAviso,
} from "./avisosNegocio.js";
import * as mensajes from "./mensajes.js";

/**
 * Las cinco alertas operativas del plan (PLAN-CANAL-DUENO.md § 4, fila 5 y
 * § 12): calendario desconectado, número no activo, prueba que termina,
 * 80 % de minutos y pago fallido. Cada una se dispara desde el sitio donde
 * ocurre el hecho (calendar/conexion.ts, phone/service.ts, billing/
 * service.ts, jobs/processUsageReport.ts) y nunca lanza: una alerta que no
 * sale no puede romper lo que la origina. El email de facturación de
 * siempre (pago fallido, 80 % de minutos) se sigue mandando aparte; aquí el
 * email solo es el respaldo para dueños sin WhatsApp activo.
 */

/** «20 de septiembre de 2026» en la zona del negocio. */
function fechaLarga(fecha: Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone || "Europe/Madrid",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

function diaDeHoy(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");
}

/** Construye asunto y cuerpo del email de respaldo; por defecto, el de
 * alerta operativa («Necesita tu atención»). */
type PlantillaDeEmail = (input: {
  businessName: string;
  texto: string;
  panelUrl: string;
}) => { subject: string; html: string };

async function emailDeAlerta(input: {
  businessId: string;
  businessName: string;
  causa: CausaDeAlerta;
  texto: string;
  recursoId: string;
  plantillaDeEmail?: PlantillaDeEmail;
}): Promise<void> {
  const usuario = await prisma.user.findFirst({
    where: { businessId: input.businessId },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });
  if (!usuario?.email) {
    throw new Error("el negocio no tiene ningún correo");
  }
  const plantilla = input.plantillaDeEmail ?? operationalAlertEmail;
  const { subject, html } = plantilla({
    businessName: input.businessName,
    texto: input.texto,
    panelUrl: mensajes.panelUrl(`/ajustes/${RUTA_DE_ALERTA[input.causa]}`),
  });
  await enqueueEmailJob(
    { fromAlias: "support", toAddress: usuario.email, subject, html },
    `alerta-${input.recursoId.replace(/[^A-Za-z0-9_-]/g, "-")}`
  );
}

type Negocio = { name: string; timezone: string };

async function alertar(input: {
  businessId: string;
  causa: CausaDeAlerta;
  recursoId: (negocio: Negocio) => string;
  texto: (negocio: Negocio) => string;
  /** Las alertas de facturación ya tienen su email: no hace falta respaldo. */
  conEmailDeRespaldo: boolean;
  /** Email distinto del de alerta operativa (p. ej. una buena noticia). */
  plantillaDeEmail?: PlantillaDeEmail;
}): Promise<ResultadoAviso> {
  let recursoId = `${input.causa}:${input.businessId}`;
  try {
    const negocio = await prisma.business.findUnique({
      where: { id: input.businessId },
      select: { name: true, timezone: true },
    });
    if (!negocio) {
      return { via: "ninguna", motivo: "negocio inexistente" };
    }
    recursoId = input.recursoId(negocio);
    const texto = input.texto(negocio);
    return await avisarAlerta({
      businessId: input.businessId,
      businessName: negocio.name,
      causa: input.causa,
      texto,
      recursoId,
      email: input.conEmailDeRespaldo
        ? () =>
            emailDeAlerta({
              businessId: input.businessId,
              businessName: negocio.name,
              causa: input.causa,
              texto,
              recursoId,
              plantillaDeEmail: input.plantillaDeEmail,
            })
        : undefined,
    });
  } catch (error) {
    console.error(
      `[WhatsApp] No se pudo enviar la alerta ${input.causa} (${recursoId}) del negocio ${input.businessId}: ${errorMessage(error)}`
    );
    return { via: "ninguna", motivo: errorMessage(error) };
  }
}

/** Días sin reconectar tras los que se recuerda, una vez. */
const DIAS_HASTA_EL_RECORDATORIO = 7;

/** Calendario desconectado: una vez al día por proveedor. Con
 * `desconectadoEn`, deja programado el recordatorio de los 7 días (una
 * tarea diferida de Cloud Tasks: no hace falta un job del Scheduler). */
export async function alertarCalendarioDesconectado(input: {
  businessId: string;
  proveedor: string;
  providerId: string;
  desconectadoEn?: Date;
}): Promise<ResultadoAviso> {
  const resultado = await alertar({
    businessId: input.businessId,
    causa: "calendario",
    recursoId: (negocio) =>
      `calendario:${input.businessId}:${input.providerId}:${diaDeHoy(negocio.timezone)}`,
    texto: () => mensajes.alertaCalendario({ proveedor: input.proveedor }),
    conEmailDeRespaldo: true,
  });
  if (input.desconectadoEn) {
    try {
      await enqueueRecordatorioDeCalendarioJob(
        {
          businessId: input.businessId,
          provider: input.providerId,
          desconectadoEn: input.desconectadoEn.toISOString(),
        },
        `recordatorio-calendario-${input.businessId}-${input.providerId}-${input.desconectadoEn.getTime()}`,
        new Date(
          input.desconectadoEn.getTime() +
            DIAS_HASTA_EL_RECORDATORIO * 24 * 60 * 60 * 1000
        )
      );
    } catch (error) {
      console.error(
        `[WhatsApp] No se pudo programar el recordatorio del calendario desconectado del negocio ${input.businessId} (${input.providerId}): ${errorMessage(error)}`
      );
    }
  }
  return resultado;
}

/** Job `recordar-calendario-desconectado`: a los 7 días, si sigue
 * desconectado desde la misma vez, se le pregunta si lo sigue usando. Si
 * reconectó (o se volvió a caer después), no se dice nada. */
export async function recordarCalendarioDesconectado(input: {
  businessId: string;
  provider: string;
  desconectadoEn: string;
}): Promise<ResultadoAviso> {
  const fila = await prisma.calendarConnection.findFirst({
    where: { businessId: input.businessId, provider: input.provider },
    select: { connected: true, disconnectedAt: true },
  });
  const mismaDesconexion =
    fila &&
    !fila.connected &&
    fila.disconnectedAt?.toISOString() === input.desconectadoEn;
  if (!mismaDesconexion) {
    return {
      via: "ninguna",
      motivo: "ya no está desconectado desde entonces",
      deliberado: true,
    };
  }
  const { DESCRIPTORES_DE_PROVEEDOR, normalizarProveedorDeCalendario } =
    await import("../../adapters/calendar/CalendarProvider.js");
  const proveedor =
    DESCRIPTORES_DE_PROVEEDOR[normalizarProveedorDeCalendario(input.provider)]
      .nombre;
  return alertar({
    businessId: input.businessId,
    causa: "calendario",
    recursoId: () =>
      `calendario-recordatorio:${input.businessId}:${input.provider}:${input.desconectadoEn}`,
    texto: () => mensajes.recordatorioCalendario({ proveedor }),
    conEmailDeRespaldo: true,
  });
}

/** Copias que no entran en el calendario tras varios intentos: una vez al
 * día por negocio (calendar/copiaDeLaCita.ts). */
export async function alertarCopiasPendientes(input: {
  businessId: string;
  proveedor: string;
}): Promise<ResultadoAviso> {
  return alertar({
    businessId: input.businessId,
    causa: "calendario",
    recursoId: (negocio) =>
      `calendario-copias:${input.businessId}:${diaDeHoy(negocio.timezone)}`,
    texto: () =>
      mensajes.alertaCopiasPendientes({ proveedor: input.proveedor }),
    conEmailDeRespaldo: true,
  });
}

/** La compra o activación del número falló: una vez al día. */
export async function alertarNumeroNoActivo(input: {
  businessId: string;
}): Promise<ResultadoAviso> {
  return alertar({
    businessId: input.businessId,
    causa: "telefono",
    recursoId: (negocio) =>
      `telefono:${input.businessId}:${diaDeHoy(negocio.timezone)}`,
    texto: () => mensajes.alertaTelefono(),
    conEmailDeRespaldo: true,
  });
}

/**
 * Mensaje del día 1 sobre el desvío (docs/historico/PLAN-TELEFONIA-UX.md § 5,
 * fase 5), en
 * su variante negativa: «aún no has comprobado el desvío». Lo manda
 * jobs/recordarDesvioSinComprobar.ts entre 24 y 48 h después de comprar el
 * número. La idempotencia de verdad está en
 * `Business.forwardingReminderSentAt`; el recursoId lleva el instante del
 * intento (`intento`, el `ahora` con el que el job reclamó la marca) para
 * que, si el aviso no sale por ninguna vía y el job retira la marca, la
 * pasada siguiente pueda reintentarlo de verdad: con un recursoId fijo la
 * fila de `sent_messages` que crea `reclamarEnvio` haría que todo reintento
 * devolviese «ya enviado» y el dueño no recibiría nunca el mensaje.
 */
export async function alertarDesvioSinComprobar(input: {
  businessId: string;
  intento: Date;
}): Promise<ResultadoAviso> {
  return alertar({
    businessId: input.businessId,
    causa: "telefono",
    recursoId: () =>
      `desvio:${input.businessId}:${input.intento.toISOString()}`,
    texto: () => mensajes.alertaDesvioSinComprobar(),
    conEmailDeRespaldo: true,
  });
}

/**
 * Mensaje del día 1 en su variante positiva: «tu desvío está comprobado».
 * Mismo job, misma marca y mismo recursoId por intento que la negativa; sale
 * por la cascada de alertas (interactivo → plantilla `alerta_operativa_negocio`
 * → email), pero el email es `forwardingCheckedEmail`, no el de «Necesita tu
 * atención».
 */
export async function alertarDesvioComprobado(input: {
  businessId: string;
  intento: Date;
}): Promise<ResultadoAviso> {
  return alertar({
    businessId: input.businessId,
    causa: "telefono",
    recursoId: () =>
      `desvio-ok:${input.businessId}:${input.intento.toISOString()}`,
    texto: () => mensajes.alertaDesvioComprobado(),
    conEmailDeRespaldo: true,
    plantillaDeEmail: forwardingCheckedEmail,
  });
}

/** Stripe avisa tres días antes de que termine la prueba. */
export async function alertarPruebaTermina(input: {
  businessId: string;
  subscriptionId: string;
  trialEnd: Date;
}): Promise<ResultadoAviso> {
  return alertar({
    businessId: input.businessId,
    causa: "prueba",
    recursoId: () => `prueba:${input.subscriptionId}`,
    texto: (negocio) =>
      mensajes.alertaPruebaTermina({
        fecha: fechaLarga(input.trialEnd, negocio.timezone),
      }),
    conEmailDeRespaldo: true,
  });
}

/** 80 % de los minutos del plan consumidos (el email ya sale aparte). */
export async function alertarMinutos(input: {
  businessId: string;
  periodId: string;
  consumidos: number;
  incluidos: number;
  extraMinuteCents: number;
}): Promise<ResultadoAviso> {
  return alertar({
    businessId: input.businessId,
    causa: "minutos",
    recursoId: () => `minutos:${input.periodId}`,
    texto: () =>
      mensajes.alertaMinutos({
        consumidos: input.consumidos,
        incluidos: input.incluidos,
        precioExtra: `${(input.extraMinuteCents / 100).toFixed(2).replace(".", ",")} € + IVA`,
      }),
    conEmailDeRespaldo: false,
  });
}

/** Cobro fallido (el email ya sale aparte). */
export async function alertarPagoFallido(input: {
  businessId: string;
  invoiceId: string;
  suspensionAt: Date;
}): Promise<ResultadoAviso> {
  return alertar({
    businessId: input.businessId,
    causa: "pago",
    recursoId: () => `pago:${input.invoiceId}`,
    texto: (negocio) =>
      mensajes.alertaPagoFallido({
        fecha: fechaLarga(input.suspensionAt, negocio.timezone),
      }),
    conEmailDeRespaldo: false,
  });
}
