import type { WhatsappNumeroNegocio } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { errorMessage } from "../../lib/logUtils.js";
import {
  whatsappAdapter,
  type NumeroEnCoexistencia,
} from "../../adapters/whatsapp/WhatsAppAdapter.js";

/**
 * «Conectar mi WhatsApp» (Beta, PLAN-WHATSAPP-COEXISTENCIA.md § 2): el
 * negocio conecta el número que ya usa en la app de WhatsApp Business y
 * Alhabla habla por la API en ese mismo número, con el dueño contestando a
 * la vez desde su app (coexistencia).
 *
 * Dos caminos, los dos de Tech Provider con nuestra app de Meta enlazada a
 * Telnyx:
 * - Alta alojada (el principal, decisión del 2026-11-06): Telnyx crea un
 *   enlace a su página de alta (`hosted_signups`, tipo `coexistence`) y se
 *   encarga de todo. El enlace no lleva el negocio, así que se guarda su id:
 *   es el de la sesión de alta que Telnyx abre cuando el dueño la termina
 *   (guía «Tech Provider Embedded Signup»), y por esa sesión se llega al WABA
 *   y al número.
 * - Alta propia (la alternativa, plegada en el panel): `FB.login()` dentro
 *   de la app; Meta devuelve `waba_id` y `phone_number_id` y aquí se
 *   registran en Telnyx con `customer_id` = negocio.
 *
 * De momento solo se conecta y se sigue el estado: los mensajes a los
 * clientes siguen saliendo de «Alhabla Reservas» (fase 2 del plan).
 */

/** Estados en los que el negocio puede (o tiene que) repetir el alta. */
const ESTADOS_PARA_REPETIR = new Set([
  "fallido",
  "enlace_caducado",
  "sync_deadline_expired",
  "offboarded",
  "disconnected",
]);
/** Mientras no esté conectado, el panel pregunta cada 10 s. */
const FRENO_DE_CONSULTA_MS = 8_000;
/** Ya conectado: basta con mirar de vez en cuando si se desconectó. */
const FRENO_DE_CONSULTA_ACTIVO_MS = 5 * 60_000;
/** El `solution_id` cambia solo si Telnyx rehace el enlace. */
const CACHE_DEL_ENLACE_MS = 10 * 60_000;
/** Un enlace de alta que caduca antes de esto no se vuelve a dar. */
const MARGEN_DEL_ENLACE_MS = 30 * 60_000;
/** Quien empezó el alta justo antes de caducar el enlace aún puede acabarla. */
const GRACIA_TRAS_CADUCAR_MS = 60 * 60_000;
/** Lo que dura un enlace de Telnyx si no dice otra cosa. */
const VIDA_DEL_ENLACE_MS = 24 * 60 * 60_000;

/** Lo que necesita el panel para abrir la ventana de Meta (alta propia). */
export interface DatosDelAlta {
  appId: string;
  configId: string;
  solutionId: string;
  graphVersion: string;
}

export type MotivoNoDisponible =
  "apagado" | "sin_configurar" | "sin_enlace_de_telnyx";

export interface ConexionWhatsappPropio {
  estado: string;
  origen: string;
  phoneNumber: string | null;
  syncDeadline: string | null;
  errores: string[];
  conectadoAt: string | null;
  puedeRepetir: boolean;
}

export interface EstadoWhatsappPropio {
  /** Si se puede conectar (alta alojada). */
  disponible: boolean;
  motivo: MotivoNoDisponible | null;
  /** La alternativa dentro de la app; `null` sin `META_WHATSAPP_CONFIG_ID`. */
  altaPropia: DatosDelAlta | null;
  conexion: ConexionWhatsappPropio | null;
}

export type ResultadoDelEnlace =
  | { outcome: "no_disponible"; motivo: MotivoNoDisponible }
  | { outcome: "ya_conectado" }
  | { outcome: "en_curso" }
  | { outcome: "error_de_telnyx"; mensaje: string }
  | { outcome: "enlace"; url: string; estado: EstadoWhatsappPropio };

export type ResultadoDelRegistro =
  | { outcome: "no_disponible"; motivo: MotivoNoDisponible }
  | { outcome: "ya_conectado" }
  | { outcome: "numero_ocupado" }
  | { outcome: "error_de_telnyx"; mensaje: string }
  | { outcome: "registrado"; estado: EstadoWhatsappPropio };

type Disponibilidad =
  | { appId: string; propia: DatosDelAlta | null }
  | { motivo: MotivoNoDisponible };

export function whatsappPropioEncendido(): boolean {
  return process.env.WHATSAPP_PROPIO_ENABLED === "true";
}

let enlaceEnCache: {
  appId: string;
  solutionId: string | null;
  hasta: number;
} | null = null;

/** Solo para los tests. */
export function olvidarEnlaceEnCache() {
  enlaceEnCache = null;
}

/**
 * Si se puede conectar y con qué. Los dos caminos necesitan la app de Meta
 * enlazada a Telnyx; el `solution_id` del enlace se toma de
 * `TELNYX_WA_SOLUTION_ID` o, si no está, de Telnyx (`foreign_apps`), que es
 * la fuente de verdad. La ventana de Meta pide además `META_WHATSAPP_CONFIG_ID`.
 */
export async function disponibilidad(): Promise<Disponibilidad> {
  if (!whatsappPropioEncendido()) return { motivo: "apagado" };
  const appId = process.env.META_WHATSAPP_APP_ID?.trim();
  const configId = process.env.META_WHATSAPP_CONFIG_ID?.trim();
  const graphVersion = process.env.META_GRAPH_VERSION?.trim() || "v21.0";
  if (!appId) return { motivo: "sin_configurar" };

  let solutionId = process.env.TELNYX_WA_SOLUTION_ID?.trim() || null;
  if (!solutionId) {
    if (
      enlaceEnCache &&
      enlaceEnCache.appId === appId &&
      enlaceEnCache.hasta > Date.now()
    ) {
      solutionId = enlaceEnCache.solutionId;
    } else {
      try {
        const app = await whatsappAdapter.appEnlazada(appId);
        solutionId = app?.enabled ? app.solutionId : null;
        enlaceEnCache = {
          appId,
          solutionId,
          hasta: Date.now() + CACHE_DEL_ENLACE_MS,
        };
      } catch (error) {
        console.error(
          `[WhatsApp] No se pudo consultar en Telnyx el enlace de la app ${appId}: ${errorMessage(error)}`
        );
        solutionId = null;
      }
    }
  }
  if (!solutionId) return { motivo: "sin_enlace_de_telnyx" };
  return {
    appId,
    propia: configId ? { appId, configId, solutionId, graphVersion } : null,
  };
}

function aConexion(fila: WhatsappNumeroNegocio): ConexionWhatsappPropio {
  return {
    estado: fila.estado,
    origen: fila.origen,
    phoneNumber: fila.phoneNumber,
    syncDeadline: fila.syncDeadline?.toISOString() ?? null,
    errores: fila.errores,
    conectadoAt: fila.conectadoAt?.toISOString() ?? null,
    puedeRepetir: ESTADOS_PARA_REPETIR.has(fila.estado),
  };
}

function aEstado(
  datos: Disponibilidad,
  fila: WhatsappNumeroNegocio | null
): EstadoWhatsappPropio {
  return {
    disponible: "appId" in datos,
    motivo: "motivo" in datos ? datos.motivo : null,
    altaPropia: "appId" in datos ? datos.propia : null,
    conexion: fila ? aConexion(fila) : null,
  };
}

/** De los números de un WABA, el que vive en la app de WhatsApp Business. */
function numeroEnLaApp(
  numeros: NumeroEnCoexistencia[]
): NumeroEnCoexistencia | null {
  return (
    numeros.find((numero) => numero.isOnBizApp) ??
    numeros.find((numero) => numero.coexistenceState !== null) ??
    numeros[0] ??
    null
  );
}

/**
 * Pone la fila al día contra Telnyx: primero la sesión de alta (en la
 * alojada, la del id del enlace, que no existe hasta que el dueño acaba) y,
 * cuando el número aparece en la cuenta, su `coexistence_state`. Con freno,
 * para que el sondeo del panel no se convierta en una petición a Telnyx cada
 * vez. Nunca lanza: si Telnyx falla, se queda lo guardado.
 */
export async function refrescarConexion(
  fila: WhatsappNumeroNegocio,
  ahora: Date = new Date()
): Promise<WhatsappNumeroNegocio> {
  const freno =
    fila.estado === "active"
      ? FRENO_DE_CONSULTA_ACTIVO_MS
      : FRENO_DE_CONSULTA_MS;
  if (
    fila.consultadoAt &&
    ahora.getTime() - fila.consultadoAt.getTime() < freno
  ) {
    return fila;
  }
  // Un alta que falló o un enlace caducado no cambian solos: el dueño tiene
  // que repetirla (un alta alojada tardía la recoge el webhook).
  if (fila.estado === "fallido" || fila.estado === "enlace_caducado") {
    return fila;
  }

  const cambios: Partial<WhatsappNumeroNegocio> = { consultadoAt: ahora };
  let estado = fila.estado;
  let wabaId = fila.metaWabaId;
  try {
    const sesionId =
      fila.signupId ?? (estado === "esperando_alta" ? fila.enlaceId : null);
    if ((estado === "esperando_alta" || estado === "registrando") && sesionId) {
      const sesion = await whatsappAdapter.estadoDeAlta(sesionId);
      if (!sesion) {
        const caducado =
          estado === "esperando_alta" &&
          fila.enlaceCaducaAt !== null &&
          ahora.getTime() - fila.enlaceCaducaAt.getTime() >
            GRACIA_TRAS_CADUCAR_MS;
        if (caducado) {
          estado = cambios.estado = "enlace_caducado";
          console.log(
            `[WhatsApp] Caducó sin usar el enlace de alta del negocio ${fila.businessId} (${fila.enlaceId})`
          );
        }
      } else {
        if (!fila.signupId) cambios.signupId = sesionId;
        if (sesion.wabaId && !wabaId)
          wabaId = cambios.metaWabaId = sesion.wabaId;
        if (sesion.status === "FAILURE") {
          estado = cambios.estado = "fallido";
          cambios.errores = sesion.errores;
          console.error(
            `[WhatsApp] Falló el alta en coexistencia del negocio ${fila.businessId} (sesión ${sesionId}, paso ${sesion.state ?? "?"}): ${sesion.errores.join("; ") || "sin motivo"}`
          );
        } else if (estado === "esperando_alta") {
          estado = cambios.estado = "registrando";
          console.log(
            `[WhatsApp] El negocio ${fila.businessId} terminó el alta alojada (sesión ${sesionId}, WABA ${wabaId ?? "?"})`
          );
        }
      }
    }

    if (
      estado !== "fallido" &&
      estado !== "esperando_alta" &&
      estado !== "enlace_caducado"
    ) {
      const numero = fila.metaPhoneNumberId
        ? await whatsappAdapter.numeroPorIdDeMeta(fila.metaPhoneNumberId)
        : wabaId
          ? numeroEnLaApp(await whatsappAdapter.numerosDelWaba(wabaId))
          : null;
      if (numero) {
        const nuevo = numero.coexistenceState ?? "pending_onboarding";
        cambios.phoneNumber = numero.phoneNumber;
        cambios.syncDeadline = numero.syncDeadline;
        cambios.estado = nuevo;
        if (!fila.metaPhoneNumberId && numero.phoneNumberId) {
          cambios.metaPhoneNumberId = numero.phoneNumberId;
        }
        if (nuevo === "active" && !fila.conectadoAt) {
          cambios.conectadoAt = ahora;
        }
        if (nuevo !== fila.estado) {
          console.log(
            `[WhatsApp] El WhatsApp propio del negocio ${fila.businessId} pasa de ${fila.estado} a ${nuevo}`
          );
        }
      }
    }
  } catch (error) {
    console.error(
      `[WhatsApp] No se pudo refrescar el WhatsApp propio del negocio ${fila.businessId}: ${errorMessage(error)}`
    );
  }
  try {
    return await prisma.whatsappNumeroNegocio.update({
      where: { id: fila.id },
      data: cambios,
    });
  } catch (error) {
    // Otro negocio ya tiene ese número (no debería): se deja ruido en el
    // log y se enseña lo guardado.
    console.error(
      `[WhatsApp] No se pudo guardar el estado del WhatsApp propio del negocio ${fila.businessId}: ${errorMessage(error)}`
    );
    return fila;
  }
}

export async function estadoWhatsappPropio(
  businessId: string
): Promise<EstadoWhatsappPropio> {
  const datos = await disponibilidad();
  const fila = await prisma.whatsappNumeroNegocio.findUnique({
    where: { businessId },
  });
  // Con el interruptor apagado no se pregunta a Telnyx, pero si hubo una
  // conexión se sigue enseñando lo último que se supo.
  const actual =
    fila && whatsappPropioEncendido() ? await refrescarConexion(fila) : fila;
  return aEstado(datos, actual);
}

/**
 * El enlace a la página de alta de Telnyx para este negocio. Si ya hay uno
 * esperando y no está a punto de caducar, el mismo (abrirlo dos veces no
 * crea dos altas); si no, uno nuevo, y la fila vuelve a «esperando_alta».
 */
export async function pedirEnlaceDeAlta(
  businessId: string,
  ahora: Date = new Date()
): Promise<ResultadoDelEnlace> {
  const datos = await disponibilidad();
  if ("motivo" in datos) {
    return { outcome: "no_disponible", motivo: datos.motivo };
  }
  const fila = await prisma.whatsappNumeroNegocio.findUnique({
    where: { businessId },
  });
  if (fila?.estado === "active") return { outcome: "ya_conectado" };
  if (
    fila &&
    fila.estado !== "esperando_alta" &&
    !ESTADOS_PARA_REPETIR.has(fila.estado)
  ) {
    return { outcome: "en_curso" };
  }

  try {
    const vigente =
      fila?.estado === "esperando_alta" &&
      fila.enlaceId &&
      fila.enlaceCaducaAt &&
      fila.enlaceCaducaAt.getTime() - ahora.getTime() > MARGEN_DEL_ENLACE_MS
        ? await whatsappAdapter.enlaceDeAlta(fila.enlaceId)
        : null;
    if (vigente && fila) {
      return {
        outcome: "enlace",
        url: vigente.url,
        estado: aEstado(datos, fila),
      };
    }

    const enlace = await whatsappAdapter.crearEnlaceDeAlta(datos.appId);
    const datosDeLaFila = {
      origen: "alojada",
      enlaceId: enlace.id,
      enlaceCaducaAt:
        enlace.caducaAt ?? new Date(ahora.getTime() + VIDA_DEL_ENLACE_MS),
      metaPhoneNumberId: null,
      metaWabaId: null,
      signupId: null,
      estado: "esperando_alta",
      errores: [],
      phoneNumber: null,
      syncDeadline: null,
      consultadoAt: null,
      conectadoAt: null,
    };
    const nueva = await prisma.whatsappNumeroNegocio.upsert({
      where: { businessId },
      create: { businessId, ...datosDeLaFila },
      update: datosDeLaFila,
    });
    console.log(
      `[WhatsApp] Enlace de alta en coexistencia creado para el negocio ${businessId} (${enlace.id})`
    );
    return {
      outcome: "enlace",
      url: enlace.url,
      estado: aEstado(datos, nueva),
    };
  } catch (error) {
    const mensaje = errorMessage(error);
    console.error(
      `[WhatsApp] Telnyx no dio el enlace de alta del negocio ${businessId}: ${mensaje}`
    );
    return { outcome: "error_de_telnyx", mensaje };
  }
}

/**
 * `whatsapp.waba_added`: Telnyx avisa de que terminó una sesión de alta.
 * `event_id` es el id de la sesión, que en el alta alojada es el del enlace.
 * Así una alta queda atada a su negocio aunque el dueño haya cerrado el
 * panel. Un WABA de otro origen (el portal de Telnyx) no tiene fila: se
 * deja en el log y ya.
 */
export async function alAnadirseUnWaba(
  cuerpo: unknown
): Promise<{ success: boolean }> {
  const payload = (
    cuerpo as { data?: { payload?: Record<string, unknown> } } | null
  )?.data?.payload;
  const sesionId =
    typeof payload?.event_id === "string" ? payload.event_id : null;
  const wabaId = typeof payload?.waba_id === "string" ? payload.waba_id : null;
  if (!sesionId) {
    console.error("[WhatsApp] whatsapp.waba_added sin event_id; se ignora");
    return { success: true };
  }
  const fila =
    (await prisma.whatsappNumeroNegocio.findUnique({
      where: { enlaceId: sesionId },
    })) ??
    (await prisma.whatsappNumeroNegocio.findFirst({
      where: { signupId: sesionId },
    }));
  if (!fila) {
    console.log(
      `[WhatsApp] WABA ${wabaId ?? "?"} añadido en Telnyx sin alta de ningún negocio (sesión ${sesionId})`
    );
    return { success: true };
  }
  if (
    !["esperando_alta", "enlace_caducado", "registrando"].includes(fila.estado)
  ) {
    return { success: true };
  }
  const fallo = payload?.status === "FAILURE";
  const errores = Array.isArray(payload?.errors)
    ? payload.errors.filter((e): e is string => typeof e === "string")
    : [];
  await prisma.whatsappNumeroNegocio.update({
    where: { id: fila.id },
    data: {
      signupId: sesionId,
      ...(wabaId ? { metaWabaId: wabaId } : {}),
      estado: fallo ? "fallido" : "registrando",
      errores: fallo ? errores : [],
      // Que la próxima consulta del panel busque ya el número.
      consultadoAt: null,
    },
  });
  if (fallo) {
    console.error(
      `[WhatsApp] Falló el alta en coexistencia del negocio ${fila.businessId} (sesión ${sesionId}): ${errores.join("; ") || "sin motivo"}`
    );
  } else {
    console.log(
      `[WhatsApp] Telnyx añadió el WABA ${wabaId ?? "?"} del negocio ${fila.businessId} (sesión ${sesionId})`
    );
  }
  return { success: true };
}

/**
 * Alta propia (la alternativa): registra en Telnyx lo que devolvió la
 * ventana de Meta abierta desde la app. El negocio sale
 * siempre del JWT; `wabaId` y `phoneNumberId` vienen del navegador y solo
 * sirven para que Telnyx dé de alta ese WABA, que Meta ya ha puesto en
 * nuestra solución con el consentimiento del dueño.
 */
export async function registrarWhatsappPropio(
  businessId: string,
  input: { wabaId: string; phoneNumberId: string }
): Promise<ResultadoDelRegistro> {
  const datos = await disponibilidad();
  if ("motivo" in datos) {
    return { outcome: "no_disponible", motivo: datos.motivo };
  }
  if (!datos.propia) {
    return { outcome: "no_disponible", motivo: "sin_configurar" };
  }
  const appId = datos.propia.appId;

  const [propia, delNumero, deAlhabla] = await Promise.all([
    prisma.whatsappNumeroNegocio.findUnique({ where: { businessId } }),
    prisma.whatsappNumeroNegocio.findUnique({
      where: { metaPhoneNumberId: input.phoneNumberId },
    }),
    prisma.whatsappSender.findFirst({
      where: { metaPhoneNumberId: input.phoneNumberId },
      select: { id: true },
    }),
  ]);
  if (deAlhabla || (delNumero && delNumero.businessId !== businessId)) {
    return { outcome: "numero_ocupado" };
  }
  if (propia?.estado === "active") return { outcome: "ya_conectado" };

  let sesion: { sessionId: string | null; status: string | null };
  try {
    sesion = await whatsappAdapter.registrarAltaEnCoexistencia({
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      appId,
      customerId: businessId,
    });
  } catch (error) {
    const mensaje = errorMessage(error);
    console.error(
      `[WhatsApp] Telnyx no aceptó el alta en coexistencia del negocio ${businessId} (WABA ${input.wabaId}): ${mensaje}`
    );
    return { outcome: "error_de_telnyx", mensaje };
  }

  const datosDeLaFila = {
    origen: "propia",
    enlaceId: null,
    enlaceCaducaAt: null,
    metaPhoneNumberId: input.phoneNumberId,
    metaWabaId: input.wabaId,
    signupId: sesion.sessionId,
    estado: sesion.status === "FAILURE" ? "fallido" : "registrando",
    errores: [],
    phoneNumber: null,
    syncDeadline: null,
    consultadoAt: null,
    conectadoAt: null,
  };
  const fila = await prisma.whatsappNumeroNegocio.upsert({
    where: { businessId },
    create: { businessId, ...datosDeLaFila },
    update: datosDeLaFila,
  });
  console.log(
    `[WhatsApp] Alta en coexistencia registrada para el negocio ${businessId} (WABA ${input.wabaId}, sesión ${sesion.sessionId ?? "?"}, ${sesion.status ?? "sin estado"})`
  );

  return { outcome: "registrado", estado: aEstado(datos, fila) };
}
