"use client";

import { guardarCredencial, marcarCaducada, tokenGuardado } from "./sesion";

/**
 * Google Identity Services (GIS) para obtener el ID token del administrador.
 * No hay dependencia de tipos: se declara aquí lo mínimo que se usa.
 *
 * Por qué no se reutiliza `google-auth-button` de la app y la web: ese botón
 * es un flujo por redirección que acaba en el JWT propio de Alhabla, y
 * `/growth/admin/*` exige un ID token de Google con `audience` igual a
 * `GROWTH_GOOGLE_CLIENT_ID`.
 */

export type RespuestaDeCredencial = {
  /** El ID token (JWT). */
  credential: string;
  select_by?: string;
};

type OpcionesDeInicio = {
  client_id: string;
  callback: (respuesta: RespuestaDeCredencial) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  itp_support?: boolean;
};

type OpcionesDeBoton = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
};

export type GoogleId = {
  initialize: (opciones: OpcionesDeInicio) => void;
  renderButton: (padre: HTMLElement, opciones: OpcionesDeBoton) => void;
  prompt: (alNotificar?: (momento: unknown) => void) => void;
  cancel: () => void;
  disableAutoSelect: () => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

export const URL_DE_GIS = "https://accounts.google.com/gsi/client";

/** Se pide renovar cuando faltan 5 minutos para que expire el token. */
export const ANTELACION_DE_RENOVACION_MS = 5 * 60_000;

let cargaEnCurso: Promise<GoogleId> | null = null;
let inicializado = false;
let recuperacionIntentada = false;

function googleId(): GoogleId | undefined {
  return window.google?.accounts?.id;
}

/**
 * Carga el script de GIS una sola vez (la promesa se guarda a nivel de
 * módulo). Sin `next/script`: así un test puede falsear `window.google`.
 */
export function cargarGis(): Promise<GoogleId> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google solo se carga en el navegador."));
  }
  const yaCargado = googleId();
  if (yaCargado) return Promise.resolve(yaCargado);
  if (cargaEnCurso) return cargaEnCurso;

  cargaEnCurso = new Promise<GoogleId>((resolver, rechazar) => {
    const script = document.createElement("script");
    script.src = URL_DE_GIS;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const id = googleId();
      if (id) {
        resolver(id);
      } else {
        cargaEnCurso = null;
        script.remove();
        rechazar(
          new Error("El script de Google no ofrece el inicio de sesión.")
        );
      }
    };
    script.onerror = () => {
      // Se puede reintentar: un bloqueador de anuncios o la red caída no
      // deben dejar la promesa rota para siempre.
      cargaEnCurso = null;
      script.remove();
      rechazar(new Error("No se pudo cargar el inicio de sesión de Google."));
    };
    document.head.appendChild(script);
  });
  return cargaEnCurso;
}

/**
 * Carga GIS y llama a `initialize` una sola vez por carga de página. La
 * credencial que Google entregue (botón, One Tap o inicio automático) va a la
 * sesión; no se hace nada más con ella aquí.
 */
export async function iniciarGis(clientId: string): Promise<GoogleId> {
  const id = await cargarGis();
  if (!inicializado) {
    id.initialize({
      client_id: clientId,
      callback: ({ credential }) => {
        guardarCredencial(credential);
      },
      auto_select: true,
      cancel_on_tap_outside: false,
      itp_support: true,
    });
    inicializado = true;
  }
  return id;
}

/** Pinta el botón de Google dentro de `contenedor`. */
export async function pintarBotonDeGoogle(
  clientId: string,
  contenedor: HTMLElement,
  ancho = 320
) {
  const id = await iniciarGis(clientId);
  contenedor.replaceChildren();
  id.renderButton(contenedor, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "rectangular",
    logo_alignment: "left",
    width: ancho,
    locale: "es",
  });
}

/**
 * Un intento por carga de página de recuperar la sesión sin interacción:
 * con `auto_select`, si Google la recuerda, entrega la credencial sola. No se
 * basa nada en los avisos de momento de `prompt()` (obsoletos con FedCM).
 */
export async function recuperarSesionSilenciosa(clientId: string) {
  if (recuperacionIntentada) return;
  recuperacionIntentada = true;
  try {
    const id = await iniciarGis(clientId);
    id.prompt();
  } catch (error) {
    // Mejor esfuerzo: el botón sigue a la vista.
    console.warn(
      "[Growth] No se pudo intentar el inicio de sesión automático:",
      error
    );
  }
}

/**
 * Pide a Google una credencial nueva (renovación). Mejor esfuerzo: con FedCM
 * hay un silencio de 10 minutos entre inicios automáticos y no se sabe por
 * qué falla, así que nadie debe depender de que llegue.
 */
export async function renovarCredencial(clientId: string) {
  try {
    const id = await iniciarGis(clientId);
    id.prompt();
  } catch (error) {
    console.warn(
      "[Growth] No se pudo pedir una credencial nueva a Google:",
      error
    );
  }
}

/** Al cerrar sesión o cambiar de cuenta: que Google no vuelva a entrar solo. */
export function olvidarCuentaDeGoogle() {
  if (typeof window === "undefined") return;
  try {
    googleId()?.disableAutoSelect();
  } catch (error) {
    console.warn("[Growth] No se pudo desactivar el inicio automático:", error);
  }
}

/** El máximo que admite `setTimeout` (unos 24 días). */
const RETARDO_MAXIMO_MS = 2 ** 31 - 1;

/** Un minuto antes de la hora real: la petición ya se negaría a salir. */
const MARGEN_DE_CORTE_MS = 60_000;

/**
 * Programa lo que hay que hacer con un token activo cuya caducidad es
 * `exp` (segundos):
 *
 * - Pedir una credencial nueva 5 minutos antes (y al volver a la pestaña si
 *   quedan menos de 5 minutos: los temporizadores de una pestaña oculta se
 *   retrasan).
 * - Si al llegar el margen de seguridad no ha llegado una nueva, marcar la
 *   sesión como caducada: un diálogo, no una redirección.
 *
 * Devuelve la función que lo cancela todo.
 */
export function programarRenovacion(
  clientId: string | null,
  exp: number,
  ahora: () => number = Date.now
): () => void {
  const caduca = exp * 1000;
  const temporizadores: ReturnType<typeof setTimeout>[] = [];
  const retardo = (ms: number) => Math.min(Math.max(0, ms), RETARDO_MAXIMO_MS);

  const pedirRenovacion = () => {
    if (clientId) void renovarCredencial(clientId);
  };
  const cortar = () => {
    if (tokenGuardado()) marcarCaducada();
  };

  temporizadores.push(
    setTimeout(
      pedirRenovacion,
      retardo(caduca - ANTELACION_DE_RENOVACION_MS - ahora())
    )
  );
  temporizadores.push(
    setTimeout(cortar, retardo(caduca - MARGEN_DE_CORTE_MS - ahora()))
  );

  const alVolverALaPestana = () => {
    if (document.visibilityState !== "visible") return;
    const restante = caduca - ahora();
    if (restante <= MARGEN_DE_CORTE_MS) cortar();
    else if (restante < ANTELACION_DE_RENOVACION_MS) pedirRenovacion();
  };
  document.addEventListener("visibilitychange", alVolverALaPestana);

  return () => {
    temporizadores.forEach(clearTimeout);
    document.removeEventListener("visibilitychange", alVolverALaPestana);
  };
}

/** Solo para los tests: deja el módulo como recién cargado. */
export function reiniciarGisParaPruebas() {
  cargaEnCurso = null;
  inicializado = false;
  recuperacionIntentada = false;
}
