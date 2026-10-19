import Telnyx from "telnyx";
import { telnyxAiAdapter } from "./TelnyxAiAdapter.js";
import { callLabel, errorMessage } from "../../lib/logUtils.js";

/**
 * Contestar una llamada con el assistant, reintentando lo que se arregla
 * solo (docs/historico/PLAN-RETIRAR-RETELL.md, PR 4). Hasta el 17-10 cualquier fallo del
 * `answer` dejaba la llamada sonando hasta que el cliente colgaba: la ruta
 * respondía 404 y nadie se enteraba. Lo que sí pasa con Telnyx son 5xx
 * intermitentes de la API v2 (23-09, 2 h, status.telnyx.com), y un 5xx se
 * arregla repitiendo.
 *
 * Presupuesto: 3 s por intento (TelnyxAiAdapter, TIEMPO_PARA_CONTESTAR_MS)
 * y dos reintentos tras 300 y 800 ms, ~10 s en el peor caso, dentro de los
 * ~20 s que tiene un webhook de voz. En producción el `call.initiated`
 * entero, con BD y contexto, tarda 0,3-1,5 s.
 */
export const ESPERAS_ENTRE_REINTENTOS_MS = [300, 800] as const;

type OpcionesDeContestar = NonNullable<
  Parameters<typeof telnyxAiAdapter.answerCallWithAssistant>[2]
>;

/** ¿Se arregla repitiendo? Un 5xx, un 429 o un fallo de red (incluido el
 * timeout). Un 4xx no: la llamada ya colgó, el id caducó o Telnyx rechazó
 * algo de la petición, y repetirla da lo mismo. */
export function esFalloTransitorioDeTelnyx(error: unknown): boolean {
  if (error instanceof Telnyx.APIConnectionError) return true;
  if (error instanceof Telnyx.APIError) {
    const status = error.status;
    return status === 429 || (typeof status === "number" && status >= 500);
  }
  return false;
}

/**
 * El `answer` no salió. `quizaContestada`: un intento anterior agotó el
 * tiempo y el siguiente recibió un 4xx, así que Telnyx pudo ejecutar el
 * primero (un timeout no dice si llegó). Entonces no se cuelga: se cortaría
 * una llamada que está hablando con la recepcionista.
 */
export class NoSePudoContestar extends Error {
  constructor(
    readonly causa: unknown,
    readonly intentos: number,
    readonly quizaContestada: boolean
  ) {
    super(errorMessage(causa));
    this.name = "NoSePudoContestar";
  }
}

export async function contestarConReintentos(input: {
  callControlId: string;
  assistantId: string;
  businessId: string;
  opciones: OpcionesDeContestar;
  /** Las mismas opciones sin la voz de la llamada, cuando lleva una (la
   * cooficial de la zona): si Telnyx la rechaza, se contesta con la del
   * assistant y su saludo antes que dejar la llamada sin atender. */
  sinVoz?: { opciones: OpcionesDeContestar; voz: string } | null;
  esperar?: (ms: number) => Promise<void>;
}): Promise<void> {
  const esperar =
    input.esperar ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const etiqueta = callLabel(input.callControlId);
  let opciones = input.opciones;
  let sinVoz = input.sinVoz ?? null;
  let intentos = 0;
  let reintentos = 0;
  let huboTimeout = false;

  for (;;) {
    intentos += 1;
    try {
      await telnyxAiAdapter.answerCallWithAssistant(
        input.callControlId,
        input.assistantId,
        opciones
      );
      return;
    } catch (error) {
      if (esFalloTransitorioDeTelnyx(error)) {
        if (error instanceof Telnyx.APIConnectionTimeoutError) {
          huboTimeout = true;
        }
        if (reintentos < ESPERAS_ENTRE_REINTENTOS_MS.length) {
          const espera = ESPERAS_ENTRE_REINTENTOS_MS[reintentos];
          reintentos += 1;
          console.warn(
            `[Telnyx] ${etiqueta}: Telnyx falló al contestar (negocio ${input.businessId}); reintento ${reintentos} de ${ESPERAS_ENTRE_REINTENTOS_MS.length} en ${espera} ms: ${errorMessage(error)}`
          );
          await esperar(espera);
          continue;
        }
        throw new NoSePudoContestar(error, intentos, false);
      }
      if (huboTimeout) {
        throw new NoSePudoContestar(error, intentos, true);
      }
      if (sinVoz) {
        console.error(
          `[Telnyx] ${etiqueta}: Telnyx rechazó contestar con la voz ${sinVoz.voz} (negocio ${input.businessId}); se contesta con la del assistant y su saludo: ${errorMessage(error)}`
        );
        opciones = sinVoz.opciones;
        sinVoz = null;
        continue;
      }
      throw new NoSePudoContestar(error, intentos, false);
    }
  }
}
