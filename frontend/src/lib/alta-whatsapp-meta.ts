/**
 * El alta de Meta para conectar el WhatsApp Business del negocio en
 * coexistencia (integración propia de Tech Provider, guía «Tech Provider
 * Embedded Signup» de Telnyx). Se abre con `FB.login()` y la configuración
 * de WhatsApp de nuestra app de Meta; al acabar, Meta manda por
 * `postMessage` el evento FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING con
 * `waba_id` y `phone_number_id`, que el backend registra en Telnyx.
 *
 * El SDK de Facebook se carga solo en Ajustes › Teléfono y solo si el alta
 * está disponible: nada de Facebook en el resto de la app.
 */

type RespuestaDeLogin = { authResponse?: { code?: string } | null };

type SdkDeFacebook = {
  init: (opciones: {
    appId: string;
    autoLogAppEvents?: boolean;
    xfbml?: boolean;
    version: string;
  }) => void;
  login: (
    callback: (respuesta: RespuestaDeLogin) => void,
    opciones: Record<string, unknown>
  ) => void;
};

declare global {
  interface Window {
    FB?: SdkDeFacebook;
    fbAsyncInit?: () => void;
  }
}

const URL_DEL_SDK = "https://connect.facebook.net/es_ES/sdk.js";
const ORIGENES_DE_META = new Set([
  "https://www.facebook.com",
  "https://web.facebook.com",
]);

let carga: Promise<SdkDeFacebook> | null = null;
let iniciadoCon: string | null = null;

/** Carga el SDK una vez y lo inicia con nuestra app. */
export function cargarSdkDeFacebook(
  appId: string,
  graphVersion: string
): Promise<SdkDeFacebook> {
  const iniciar = (fb: SdkDeFacebook) => {
    const clave = `${appId}:${graphVersion}`;
    if (iniciadoCon !== clave) {
      fb.init({
        appId,
        autoLogAppEvents: true,
        xfbml: false,
        version: graphVersion,
      });
      iniciadoCon = clave;
    }
    return fb;
  };
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Sin navegador"));
  }
  if (window.FB) return Promise.resolve(iniciar(window.FB));
  if (!carga) {
    carga = new Promise<SdkDeFacebook>((resolve, reject) => {
      window.fbAsyncInit = () => {
        if (window.FB) resolve(iniciar(window.FB));
        else reject(new Error("El SDK de Facebook no se inició"));
      };
      const script = document.createElement("script");
      script.src = URL_DEL_SDK;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.onerror = () => {
        carga = null;
        reject(new Error("No se pudo cargar el SDK de Facebook"));
      };
      document.body.appendChild(script);
    });
  }
  return carga;
}

export type EventoDelAlta =
  | { tipo: "terminada"; wabaId: string; phoneNumberId: string }
  | { tipo: "cancelada"; paso: string | null }
  | { tipo: "error"; mensaje: string | null }
  /** Terminó el alta normal (FINISH), no la de coexistencia. */
  | { tipo: "sin_coexistencia" };

/**
 * Lee un mensaje de `postMessage` del alta de Meta. `null` si no es de
 * Meta o no es del alta: hay que ignorarlo.
 */
export function leerEventoDelAlta(
  origen: string,
  datos: unknown
): EventoDelAlta | null {
  if (!ORIGENES_DE_META.has(origen)) return null;
  let sesion: unknown = datos;
  if (typeof datos === "string") {
    try {
      sesion = JSON.parse(datos);
    } catch {
      return null;
    }
  }
  if (typeof sesion !== "object" || sesion === null) return null;
  const { type, event, data } = sesion as {
    type?: unknown;
    event?: unknown;
    data?: Record<string, unknown>;
  };
  if (type !== "WA_EMBEDDED_SIGNUP") return null;
  const texto = (valor: unknown) =>
    typeof valor === "string" && valor.length > 0 ? valor : null;
  if (event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
    const wabaId = texto(data?.waba_id);
    const phoneNumberId = texto(data?.phone_number_id);
    if (!wabaId || !phoneNumberId) {
      return { tipo: "error", mensaje: "Meta no devolvió el número" };
    }
    return { tipo: "terminada", wabaId, phoneNumberId };
  }
  if (event === "FINISH" || event === "FINISH_ONLY_WABA") {
    return { tipo: "sin_coexistencia" };
  }
  if (event === "CANCEL") {
    return { tipo: "cancelada", paso: texto(data?.current_step) };
  }
  if (event === "ERROR") {
    return { tipo: "error", mensaje: texto(data?.error_message) };
  }
  return null;
}

/** Abre el alta de Meta en modo coexistencia (WhatsApp Business app). */
export function abrirAltaEnCoexistencia(
  fb: SdkDeFacebook,
  alta: { configId: string; solutionId: string },
  alCerrar: (sinPermiso: boolean) => void
) {
  fb.login(
    (respuesta) => {
      alCerrar(!respuesta.authResponse);
    },
    {
      config_id: alta.configId,
      response_type: "code",
      override_default_response_type: true,
      extras: {
        setup: { solutionID: alta.solutionId },
        featureType: "whatsapp_business_app_onboarding",
        sessionInfoVersion: "3",
      },
    }
  );
}
