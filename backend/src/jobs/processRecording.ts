import { pipeline, Readable, Transform } from "stream";
import { prisma } from "../lib/prisma.js";
import { uploadRecording } from "../lib/storage.js";
import { ProcessRecordingJob } from "../lib/jobTypes.js";
import { PermanentJobError } from "../lib/jobErrors.js";
import { telnyxAiAdapter } from "../adapters/telnyx/TelnyxAiAdapter.js";

// Un solo plazo para todo el job (descarga con sus redirects, la URL nueva
// de Telnyx y la subida a R2), por debajo de los 180 s con los que Cloud
// Tasks da la tarea por perdida y la repite (`dispatchDeadline` en
// lib/cloudTasks.ts). Con los 5 min de antes, la primera seguía bajando el
// audio mientras la segunda empezaba. Una llamada dura como mucho 10 min:
// ~2,4 MB en MP3, ~19 MB en el WAV de antes del issue #280.
const PLAZO_DEL_JOB_MS = 150_000;
const MAX_RECORDING_BYTES = 200 * 1024 * 1024;
const MAX_RECORDING_REDIRECTS = 5;

// Telnyx guarda el audio en S3 bajo `<conexión>/<fecha>/<call_leg_id>-<n>.mp3`
// (`.wav` en las grabaciones de antes del issue #280).
// Las grabaciones anteriores a esta versión no tienen `providerLegId` en la
// fila: el leg se rescata de esa ruta la primera vez y se persiste. Solo
// UUIDs v1 (tercer grupo empieza por 1), que es lo que emite Telnyx.
const LEG_EN_RUTA_DE_TELNYX =
  /\/([0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12})-\d+\.(?:wav|mp3)$/i;

function esRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400;
}

/** El origen contestó pero se negó a servir el audio (4xx/5xx). */
class DescargaRechazadaError extends Error {
  constructor(
    readonly status: number,
    statusText: string
  ) {
    super(`Failed to download recording: ${statusText || status}`);
    this.name = "DescargaRechazadaError";
  }
}

/**
 * Fallo que no se arregla repitiendo: el audio pasa del tamaño máximo o la
 * URL no se puede descargar (esquema o destino no permitidos). La grabación
 * se marca irrecuperable y la tarea sale de la cola; antes volvía cada
 * 15 min (retryStuckRecordings) durante los 30 días de retención.
 */
class GrabacionNoRecuperableError extends Error {
  constructor(
    message: string,
    readonly reason: "recording_too_large" | "recording_url_not_allowed"
  ) {
    super(message);
    this.name = "GrabacionNoRecuperableError";
  }
}

function demasiadoGrande(): GrabacionNoRecuperableError {
  return new GrabacionNoRecuperableError(
    "Recording exceeds the maximum accepted size",
    "recording_too_large"
  );
}

/**
 * Un 4xx al descargar no se arregla repitiendo la misma URL: la firma ha
 * caducado (S3 responde 403), el fichero ya no está (404/410) o la URL está
 * mal (400). O se consigue una URL nueva o la grabación es irrecuperable.
 */
function esUrlAgotada(status: number): boolean {
  return status === 400 || status === 403 || status === 404 || status === 410;
}

function legIdDesdeUrl(url: string): string | null {
  try {
    return new URL(url).pathname.match(LEG_EN_RUTA_DE_TELNYX)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Pide a Telnyx una URL de descarga fresca para la grabación de esta llamada.
 * Devuelve null si no hay leg con el que preguntar o Telnyx ya no la tiene.
 * Solo Telnyx: sus URLs firmadas caducan a los 10 minutos, y si el primer
 * intento no llegó a tiempo (webhook con el backend caído, cola atascada)
 * la grabación seguía en Telnyx pero nosotros la dábamos por perdida y la
 * reintentábamos cada 15 minutos contra la misma URL muerta. Retell no
 * necesita esto: sus URLs no caducan.
 */
async function pedirUrlNuevaATelnyx(
  callId: string,
  legConocido: string | null,
  urlAntigua: string
): Promise<string | null> {
  const legId = legConocido ?? legIdDesdeUrl(urlAntigua);
  if (!legId) return null;

  const [grabacion] = await telnyxAiAdapter.listRecordingsByCallLegId(legId);
  const urlNueva = grabacion?.downloadUrls?.mp3 ?? grabacion?.downloadUrls?.wav;
  if (!urlNueva) return null;

  await prisma.recording.update({
    where: { callId },
    data: { providerLegId: legId, externalUrl: urlNueva },
  });
  return urlNueva;
}

async function marcarIrrecuperable(callId: string, motivo: string): Promise<void> {
  await prisma.recording.update({
    where: { callId },
    data: { processingFailedAt: new Date(), processingError: motivo },
  });
}

/**
 * Descarga la grabación desde Retell/Telnyx y la sube a R2/S3. Invocado desde
 * POST /internal/jobs/process-recording (Cloud Tasks) o en línea en dev.
 */
export async function processRecordingJob(data: ProcessRecordingJob): Promise<void> {
  console.log(`[Job] Processing recording for call ${data.callId}`);
  const plazo = AbortSignal.timeout(PLAZO_DEL_JOB_MS);

  try {
    const { callId, externalUrl } = data;

    const [call, pendingRecording] = await Promise.all([
      prisma.call.findUnique({ where: { id: callId } }),
      // storageKey: null en el filtro — es la marca de "todavía sin subir".
      // Cloud Tasks entrega al menos una vez, así que sin esto una segunda
      // entrega repetía la descarga completa desde el proveedor y el PUT a
      // R2 de un fichero que ya estaba guardado.
      prisma.recording.findFirst({
        where: { callId, deletedAt: null, storageKey: null },
        select: { id: true, providerLegId: true, processingFailedAt: true },
      }),
    ]);
    if (!call) {
      throw new Error(`Call ${callId} not found`);
    }
    if (!pendingRecording) {
      console.log(
        `[Job] La grabación de ${callId} ya está subida o fue retirada; nada que hacer`
      );
      return;
    }
    if (pendingRecording.processingFailedAt) {
      // Ya se dio por irrecuperable en un intento anterior; una tarea rezagada
      // de Cloud Tasks no tiene por qué volver a preguntarle a Telnyx.
      console.log(`[Job] La grabación de ${callId} ya está marcada como irrecuperable`);
      return;
    }
    if (call.grabacionRechazadaAt) {
      // Quien llama pidió no grabar después de que la grabación entrase en
      // la cola (lib/grabacion.ts): no se sube y se retira para que
      // retryStuckRecordings no la vuelva a encolar.
      await prisma.recording.update({
        where: { id: pendingRecording.id },
        data: { deletedAt: new Date() },
      });
      console.log(
        `[Job] Grabación de ${callId} descartada sin subir: quien llama pidió no grabar (negocio ${call.businessId})`
      );
      return;
    }

    console.log(`[Job] Downloading recording from: ${externalUrl}`);
    try {
      await copiarAR2(call, pendingRecording.providerLegId, externalUrl, plazo);
    } catch (error) {
      if (!(error instanceof GrabacionNoRecuperableError)) {
        throw error;
      }
      await marcarIrrecuperable(callId, error.message);
      throw new PermanentJobError(
        `[Job] Grabación de ${callId} irrecuperable (negocio ${call.businessId}): ${error.message}`,
        error.reason
      );
    }

    console.log(`[Job] Recording successfully processed for call ${callId}`);
  } catch (error) {
    if (error instanceof PermanentJobError) {
      // Ya está marcada en la BD; la ruta interna responde 200 y Cloud Tasks
      // no la repite. Es un aviso, no un error que investigar.
      console.warn(error.message);
    } else {
      console.error(`[Job] Error processing recording for call ${data.callId}:`, error);
    }
    throw error;
  }
}

/**
 * Descarga el audio (con una URL nueva de Telnyx si la guardada caducó), lo
 * sube a R2 y anota la clave. Todo dentro de `plazo`.
 */
async function copiarAR2(
  call: { id: string; businessId: string; voiceProvider: string | null },
  providerLegId: string | null,
  externalUrl: string,
  plazo: AbortSignal
): Promise<void> {
  const callId = call.id;
  let recording: Awaited<ReturnType<typeof downloadRecording>>;
  try {
    recording = await downloadRecording(externalUrl, plazo);
  } catch (error) {
    if (!(error instanceof DescargaRechazadaError) || !esUrlAgotada(error.status)) {
      throw error;
    }
    const urlNueva =
      call.voiceProvider === "telnyx"
        ? await pedirUrlNuevaATelnyx(callId, providerLegId, externalUrl)
        : null;
    if (!urlNueva) {
      const motivo = `El proveedor respondió ${error.status} al descargar y no hay grabación que volver a pedir`;
      await marcarIrrecuperable(callId, motivo);
      throw new PermanentJobError(
        `[Job] Grabación de ${callId} irrecuperable: ${motivo}`,
        "recording_unavailable"
      );
    }
    console.log(`[Job] URL caducada (${error.status}); Telnyx ha dado una nueva para ${callId}`);
    recording = await downloadRecording(urlNueva, plazo);
  }

  // El negocio sale de la fila Call, no del payload del job: si ambos no
  // coincidieran, guardar bajo el prefijo del payload dejaría el audio de
  // un negocio colgando del espacio de otro.
  const storageKey = `recordings/${call.businessId}/${callId}.mp3`;
  console.log(`[Job] Uploading to storage with key: ${storageKey}`);

  // El SDK de S3 hace `body.pipe(peticion)`, que no le pasa los errores
  // del audio: si el límite de tamaño corta a mitad de la subida, el PUT
  // se quedaba esperando bytes y el error, sin nadie que lo escuchara,
  // tumbaba el proceso. Se escucha aquí y aborta la subida.
  const falloDelAudio = new AbortController();
  recording.stream.on("error", (error) => falloDelAudio.abort(error));
  let storageUrl: string;
  try {
    storageUrl = await uploadRecording(
      storageKey,
      recording.stream,
      recording.contentType,
      recording.contentLength,
      AbortSignal.any([plazo, falloDelAudio.signal])
    );
  } catch (error) {
    throw falloDelAudio.signal.aborted ? falloDelAudio.signal.reason : error;
  }

  await prisma.recording.update({
    where: { callId },
    data: { storageKey, storageUrl },
  });
}

/**
 * La URL de la grabación llega dentro de webhooks firmados de Retell/Telnyx,
 * pero este job la descarga desde dentro de la red de Cloud Run: si alguna
 * vez llegara una URL manipulada, un `fetch` sin filtro sería una vía directa
 * al servidor de metadatos de GCP (169.254.169.254) o a cualquier servicio
 * interno. Exigimos https y descartamos destinos que no pueden ser un CDN
 * público.
 */
function assertDescargaPermitida(url: string): URL {
  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    throw new GrabacionNoRecuperableError(
      "La URL de la grabación no es válida",
      "recording_url_not_allowed"
    );
  }

  if (destino.protocol !== "https:") {
    throw new GrabacionNoRecuperableError(
      `Esquema no permitido para descargar la grabación: ${destino.protocol}`,
      "recording_url_not_allowed"
    );
  }

  const host = destino.hostname.toLowerCase();
  const esIpPrivada =
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host === "[::1]" ||
    host.startsWith("[fd") ||
    host.startsWith("[fe80");
  if (esIpPrivada) {
    throw new GrabacionNoRecuperableError(
      `Destino no permitido para descargar la grabación: ${host}`,
      "recording_url_not_allowed"
    );
  }

  return destino;
}

async function downloadRecording(url: string, plazo: AbortSignal): Promise<{
  stream: Readable;
  contentType: string;
  contentLength?: number;
}> {
  // Seguimos los redirects a mano porque las URLs de Retell y Telnyx suelen
  // saltar a un bucket firmado: cada salto tiene que pasar el mismo filtro,
  // o un 302 hacia una IP interna anularía la comprobación inicial.
  let destino = assertDescargaPermitida(url);
  let response = await fetch(destino, {
    redirect: "manual",
    signal: plazo,
  });
  for (let salto = 0; salto < MAX_RECORDING_REDIRECTS && esRedirect(response); salto += 1) {
    const location = response.headers.get("location");
    if (!location) {
      throw new Error("La descarga de la grabación devolvió un redirect sin destino");
    }
    destino = assertDescargaPermitida(new URL(location, destino).toString());
    response = await fetch(destino, {
      redirect: "manual",
      signal: plazo,
    });
  }
  if (esRedirect(response)) {
    throw new Error("La descarga de la grabación encadenó demasiados redirects");
  }
  if (!response.ok) {
    throw new DescargaRechazadaError(response.status, response.statusText);
  }
  if (!response.body) {
    throw new Error("Recording download returned an empty body");
  }

  const declaredLength = Number(response.headers.get("content-length"));
  const hasDeclaredLength = Number.isFinite(declaredLength) && declaredLength > 0;
  if (hasDeclaredLength && declaredLength > MAX_RECORDING_BYTES) {
    throw demasiadoGrande();
  }

  let downloadedBytes = 0;
  const sizeLimiter = new Transform({
    transform(chunk, _encoding, callback) {
      downloadedBytes += Buffer.byteLength(chunk);
      if (downloadedBytes > MAX_RECORDING_BYTES) {
        callback(demasiadoGrande());
        return;
      }
      callback(null, chunk);
    },
  });

  const source = Readable.fromWeb(response.body as import("stream/web").ReadableStream);
  // `pipeline` y no `pipe`: un corte a mitad de la descarga (red o plazo)
  // llega al limitador como error, que copiarAR2 escucha. Con `pipe` el
  // error del origen no tenía quien lo escuchara y tumbaba el proceso.
  pipeline(source, sizeLimiter, () => undefined);
  return {
    stream: sizeLimiter,
    contentType: response.headers.get("content-type") || "audio/mpeg",
    // Sin esto, uploadRecording() no puede fijar ContentLength en el PUT a
    // R2 y la carga en streaming falla (ver storage.ts) — no se pasa
    // cuando el origen no declaró un content-length real.
    contentLength: hasDeclaredLength ? declaredLength : undefined,
  };
}
