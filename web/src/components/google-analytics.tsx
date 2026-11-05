"use client";

// Copia compartida: este fichero es idéntico, byte a byte, en
// frontend/src/components/ (la app) y web/src/components/ (la web), y CI lo
// comprueba con scripts/comprobar-copias-compartidas.sh. Lo que cambia entre
// las dos llega por props (la web lo monta en su layout.tsx; la app, a través
// de analitica-de-la-app.tsx), así que un cambio aquí se copia tal cual a la
// otra.
//
// Además de Google Analytics y Vercel (finalidad «medición»), lleva el píxel
// de Meta (finalidad «publicidad») cuando hay NEXT_PUBLIC_META_PIXEL_ID. Cada
// finalidad se acepta o se rechaza por separado (docs/eventos-de-analitica.md).

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { Cookie } from "lucide-react";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

const ID_MEDICION = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-Z3RT28K0ZJ";
// Sin valor por defecto: solo producción lo tiene, para que ni el desarrollo
// ni las vistas previas manden eventos al píxel de verdad. Sin píxel no hay
// finalidad de publicidad y el aviso se queda en «Aceptar / Rechazar».
const ID_PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
const HAY_PIXEL = /^\d{6,20}$/.test(ID_PIXEL);
const NOMBRE_COOKIE = "alhabla_cookies";
// La cookie de antes de separar las finalidades: «aceptada» o «rechazada»,
// que solo hablaba de medición. Se lee mientras no haya una elección nueva.
const COOKIE_ANTERIOR = "alhabla_analitica";
const UN_ANO = 365 * 24 * 60 * 60;
const EVENTO_PREFERENCIAS = "alhabla:preferencias-cookies";
// Valor por defecto fuera del componente: un `[]` en la firma sería un array
// nuevo en cada render y los useMemo de abajo se recalcularían siempre.
const SIN_RUTAS: readonly string[] = [];
const SIN_EVENTOS_DE_RUTA: Readonly<Record<string, string>> = {};

type Finalidad = "medicion" | "publicidad";
/** Lo elegido por finalidad; una que falta es que aún no se ha preguntado. */
type Consentimiento = Partial<Record<Finalidad, boolean>>;

const FINALIDADES: readonly Finalidad[] = HAY_PIXEL
  ? ["medicion", "publicidad"]
  : ["medicion"];

/** Reabre el aviso de cookies desde otro sitio (la hoja «Más» del panel). */
export function abrirPreferenciasDeCookies() {
  window.dispatchEvent(new Event(EVENTO_PREFERENCIAS));
}

/** Parámetros de un evento: de qué botón u opción se trata, nunca datos de
 * la persona (ni nombre, ni email, ni teléfono). */
export type ParametrosDeEvento = Record<string, string | number | boolean>;

/** Lo más que se hace esperar a una navegación para que salga su evento. */
const ESPERA_MAXIMA_DEL_EVENTO = 1500;
/** Meta no avisa cuando ha enviado: margen para que salga antes de navegar. */
const ESPERA_DE_META = 300;

/** Eventos propios (los de GA4) que también van a Meta, con su nombre
 * estándar. `checkout_completado` se resuelve aparte, según el estado. */
const EVENTOS_DE_META: Readonly<Record<string, string>> = {
  ver_planes: "ViewContent",
  generate_lead: "Lead",
  clic_whatsapp: "Contact",
  sign_up: "CompleteRegistration",
  begin_checkout: "InitiateCheckout",
};

/** Parámetros de URL que pueden llegar a Meta. El píxel envía la URL entera
 * (y la de procedencia), así que una con cualquier otro parámetro, que podría
 * ser un pase de entrada o el `session_id` de Stripe, no le manda nada. */
const PARAMETROS_PARA_META = /^(plan|alta|niche|fbclid|utm_[a-z]+)$/;

function enviarEvento(
  nombre: string,
  parametros: Record<string, unknown>
): boolean {
  if (
    leerConsentimiento().medicion !== true ||
    !window.alhablaGtagConfigurado ||
    !window.gtag
  ) {
    return false;
  }
  window.gtag("event", nombre, {
    ...parametros,
    // Sin query string, como el `page_view`: puede llevar tokens.
    page_location: `${window.location.origin}${window.location.pathname}`,
  });
  return true;
}

function urlSinDatosParaMeta(url: URL): boolean {
  for (const clave of url.searchParams.keys()) {
    if (!PARAMETROS_PARA_META.test(clave)) return false;
  }
  return /^(#[\w-]*)?$/.test(url.hash);
}

function puedeIrAMeta(): boolean {
  if (!urlSinDatosParaMeta(new URL(window.location.href))) return false;
  try {
    // De otro origen solo llega el origen (la política por defecto del
    // navegador); del mismo, la URL entera.
    const procedencia = document.referrer ? new URL(document.referrer) : null;
    if (
      procedencia &&
      procedencia.origin === window.location.origin &&
      !urlSinDatosParaMeta(procedencia)
    ) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

function enviarAMeta(nombre: string, parametros: ParametrosDeEvento): boolean {
  const estandar =
    nombre === "checkout_completado"
      ? parametros.estado === "prueba"
        ? "StartTrial"
        : "Subscribe"
      : EVENTOS_DE_META[nombre];
  if (
    !estandar ||
    leerConsentimiento().publicidad !== true ||
    !window.alhablaPixelConfigurado ||
    !window.fbq ||
    !puedeIrAMeta()
  ) {
    return false;
  }
  window.fbq(
    "track",
    estandar,
    typeof parametros.plan === "string" ? { content_name: parametros.plan } : {}
  );
  return true;
}

/**
 * Evento de conversión en Google Analytics y, si tiene equivalente, en Meta
 * (los nombres, en docs/eventos-de-analitica.md). A cada uno solo le llega si
 * la visita aceptó su finalidad y la etiqueta ya está configurada; si no, no
 * hace nada. Devuelve si salió a alguno.
 */
export function medirEvento(
  nombre: string,
  parametros: ParametrosDeEvento = {}
): boolean {
  const enMeta = enviarAMeta(nombre, parametros);
  return enviarEvento(nombre, parametros) || enMeta;
}

/**
 * Para el evento justo antes de salir de la página (`location.assign` o
 * `replace`, a otro dominio o no): espera a que Google confirme el envío,
 * como mucho ESPERA_MAXIMA_DEL_EVENTO, y sigue. Sin Google, si salió a Meta
 * le da ESPERA_DE_META; sin ninguno, sigue al momento. El temporizador propio
 * cubre que gtag.js no llegue a cargar (un bloqueador), porque entonces nadie
 * llama a `event_callback`.
 */
export function medirEventoYSeguir(
  nombre: string,
  parametros: ParametrosDeEvento,
  seguir: () => void
) {
  let hecho = false;
  const continuar = () => {
    if (hecho) return;
    hecho = true;
    seguir();
  };
  const enMeta = enviarAMeta(nombre, parametros);
  const enviado = enviarEvento(nombre, {
    ...parametros,
    event_callback: continuar,
    event_timeout: ESPERA_MAXIMA_DEL_EVENTO,
  });
  if (!enviado) {
    if (enMeta) window.setTimeout(continuar, ESPERA_DE_META);
    else continuar();
    return;
  }
  window.setTimeout(continuar, ESPERA_MAXIMA_DEL_EVENTO);
}

type FuncionFbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: FuncionFbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    alhablaGtagConfigurado?: boolean;
    fbq?: FuncionFbq;
    _fbq?: FuncionFbq;
    alhablaPixelConfigurado?: boolean;
  }
}

function leerCookie(nombre: string): string | undefined {
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${nombre}=`))
    ?.slice(nombre.length + 1);
}

/** «medicion:1|publicidad:0». Solo las finalidades que se han preguntado. */
function leerConsentimiento(): Consentimiento {
  const valor = leerCookie(NOMBRE_COOKIE);
  if (valor !== undefined) {
    const consentimiento: Consentimiento = {};
    for (const parte of valor.split("|")) {
      const [finalidad, elegida] = parte.split(":");
      if (
        (finalidad === "medicion" || finalidad === "publicidad") &&
        (elegida === "1" || elegida === "0")
      ) {
        consentimiento[finalidad] = elegida === "1";
      }
    }
    return consentimiento;
  }
  const anterior = leerCookie(COOKIE_ANTERIOR);
  // La publicidad no existía: quien eligió antes no ha contestado a eso.
  if (anterior === "aceptada") return { medicion: true };
  if (anterior === "rechazada") return { medicion: false };
  return {};
}

function dominioCompartido(): string {
  const host = window.location.hostname;
  return host === "alhabla.ai" || host.endsWith(".alhabla.ai")
    ? "; Domain=.alhabla.ai"
    : "";
}

function borrarCookie(nombre: string) {
  document.cookie = `${nombre}=; Path=/; Max-Age=0; SameSite=Lax`;
  if (dominioCompartido()) {
    document.cookie = `${nombre}=; Path=/; Max-Age=0; SameSite=Lax; Domain=.alhabla.ai`;
  }
}

function guardarConsentimiento(consentimiento: Consentimiento) {
  const seguro = window.location.protocol === "https:" ? "; Secure" : "";
  const valor = FINALIDADES.filter(
    (finalidad) => consentimiento[finalidad] !== undefined
  )
    .map((finalidad) => `${finalidad}:${consentimiento[finalidad] ? 1 : 0}`)
    .join("|");
  borrarCookie(COOKIE_ANTERIOR);
  document.cookie = `${NOMBRE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${NOMBRE_COOKIE}=${valor}; Path=/; Max-Age=${UN_ANO}; SameSite=Lax${dominioCompartido()}${seguro}`;
}

function referenteSeguro(): string {
  try {
    return document.referrer ? new URL(document.referrer).origin : "";
  } catch {
    return "";
  }
}

function borrarCookiesQueEmpiezanPor(patron: RegExp) {
  const nombres = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((nombre) => patron.test(nombre));
  for (const nombre of nombres) borrarCookie(nombre);
}

function configurarGoogle(grupoDeContenido: string | undefined) {
  Reflect.set(window, `ga-disable-${ID_MEDICION}`, false);
  window.dataLayer ??= [];
  window.gtag ??= (...args: unknown[]) => window.dataLayer?.push(args);
  if (!window.alhablaGtagConfigurado) {
    // Consentimiento básico: la etiqueta se carga únicamente tras aceptar.
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", ID_MEDICION, {
      send_page_view: false,
      page_location: `${window.location.origin}${window.location.pathname}`,
      page_referrer: referenteSeguro(),
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      // Va en la configuración para que también lo lleven los eventos
      // automáticos de Google, no solo el `page_view` que se envía a mano.
      ...(grupoDeContenido ? { content_group: grupoDeContenido } : {}),
    });
    window.alhablaGtagConfigurado = true;
  } else {
    window.gtag("consent", "update", { analytics_storage: "granted" });
  }
}

function detenerGoogle() {
  Reflect.set(window, `ga-disable-${ID_MEDICION}`, true);
  window.gtag?.("consent", "update", { analytics_storage: "denied" });
  borrarCookiesQueEmpiezanPor(/^(_ga(?:_|$)|_gid$|_gat(?:_|$))/);
}

/** La cola de `fbq` del fragmento oficial de Meta, sin el `<script>`, que lo
 * pone `next/script`. Lo que se llame antes de que cargue espera en la cola. */
function configurarMeta() {
  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    }) as FuncionFbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    // Las páginas vistas las manda el componente, con su filtro de URL: sin
    // esto, el píxel enviaría una por cada cambio de ruta él solo.
    fbq.disablePushState = true;
    window.fbq = fbq;
    window._fbq ??= fbq;
  }
  if (!window.alhablaPixelConfigurado) {
    // Ni eventos automáticos ni lectura de botones y metadatos de la página.
    window.fbq("set", "autoConfig", false, ID_PIXEL);
    window.fbq("init", ID_PIXEL);
    window.alhablaPixelConfigurado = true;
  }
  window.fbq("consent", "grant");
}

function detenerMeta() {
  window.fbq?.("consent", "revoke");
  borrarCookiesQueEmpiezanPor(/^_fb[cp]$/);
}

/** Primer segmento de la ruta: «/auth/entrar» → «auth»; «/» → «». */
function primerSegmento(ruta: string): string {
  return ruta.split("/")[1] ?? "";
}

function rutaMedible(ruta: string, rutasSinMedir: readonly string[]): boolean {
  return !rutasSinMedir.includes(primerSegmento(ruta));
}

function crearFiltroDeVercel(rutasSinMedir: readonly string[]) {
  return (evento: BeforeSendEvent): BeforeSendEvent | null => {
    if (leerConsentimiento().medicion !== true) return null;
    const url = new URL(evento.url, window.location.origin);
    if (!rutaMedible(url.pathname, rutasSinMedir)) return null;
    return { ...evento, url: `${url.origin}${url.pathname}` };
  };
}

const DESCRIPCIONES: Readonly<
  Record<Finalidad, { titulo: string; texto: string }>
> = {
  medicion: {
    titulo: "Medición",
    texto:
      "Google Analytics y Vercel Analytics: qué páginas se visitan y en qué paso se deja el registro.",
  },
  publicidad: {
    titulo: "Publicidad",
    texto:
      "Píxel de Meta: saber si una visita o un alta llega por un anuncio de Facebook o Instagram, y enseñar anuncios a quien ya nos visitó.",
  },
};

function Interruptor({
  activo,
  onCambiar,
  etiqueta,
}: {
  activo: boolean;
  onCambiar: (activo: boolean) => void;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onCambiar(!activo)}
      className="group flex h-11 w-[52px] shrink-0 items-center justify-end focus-visible:outline-none"
    >
      <span
        className={`relative h-8 w-[52px] rounded-full transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-morado group-focus-visible:ring-offset-2 ${activo ? "bg-tinta" : "bg-linea-fuerte"}`}
      >
        <span
          className={`absolute top-[3px] h-[26px] w-[26px] rounded-full bg-superficie shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-[left] duration-200 ${activo ? "left-[23px]" : "left-[3px]"}`}
        />
      </span>
    </button>
  );
}

// Solo props serializables: la web lo monta directamente en su layout.tsx, que
// es un Server Component y no puede pasarle funciones.
type PropiedadesDeAnalitica = {
  /** Destino de «Más información»: la política de privacidad vive en la web. */
  enlaceDePrivacidad: string;
  /** Primer segmento de ruta, sin barra («auth» cubre /auth y /auth/…), donde
   * no se envía `page_view` ni evento de Vercel (la URL lleva tokens), aunque
   * el aviso de cookies sí puede salir. */
  rutasSinMedicion?: readonly string[];
  /** Primer segmento de ruta, sin barra, donde no se carga nada: ni scripts
   * ni aviso. */
  rutasSinAnalitica?: readonly string[];
  /** Hay armazón del panel (barra lateral en escritorio, barra inferior en
   * móvil) y el aviso y el botón no pueden taparlo. */
  dentroDelPanel?: boolean;
  /** El aviso de la primera visita espera al primer scroll: en la web tapaba
   * las señales de confianza del hero en el primer viewport (revisión de
   * diseño del 24-09, P1). Nada se mide mientras tanto: Google, Vercel y Meta
   * solo se cargan tras aceptar. */
  aplazarAvisoHastaScroll?: boolean;
  /** «web» o «app»: viaja como `content_group` en cada evento de Google para
   * que las visitas de captación y el uso del panel se puedan ver por
   * separado aunque compartan ID de medición. La separación completa (un
   * flujo de datos por dominio) se hace con NEXT_PUBLIC_GA_MEASUREMENT_ID
   * en cada proyecto de Vercel. */
  grupoDeContenido?: string;
  /** Evento propio que acompaña al `page_view` de una ruta, por su primer
   * segmento («planes» → `ver_planes`). Sale con el `page_view`, con el mismo
   * consentimiento y sin carrera con la carga de la etiqueta, y se puede
   * marcar como evento clave en GA4 sin una condición sobre la URL. Si tiene
   * equivalente en Meta, también sale allí. */
  eventosDeRuta?: Readonly<Record<string, string>>;
  /** Manda a Meta un `PageView` por página (la web, para las audiencias). La
   * app solo le manda las conversiones. */
  paginasVistasEnMeta?: boolean;
};

/** Comparte la elección entre la app y la web, mide solo páginas sin
 * parámetros y permite cambiar la elección en cualquier momento. */
export function GoogleAnalytics({
  enlaceDePrivacidad,
  rutasSinMedicion = SIN_RUTAS,
  rutasSinAnalitica = SIN_RUTAS,
  dentroDelPanel = false,
  aplazarAvisoHastaScroll = false,
  grupoDeContenido,
  eventosDeRuta = SIN_EVENTOS_DE_RUTA,
  paginasVistasEnMeta = false,
}: PropiedadesDeAnalitica) {
  const pathname = usePathname();
  const [consentimiento, setConsentimiento] = useState<Consentimiento>({});
  const [hidratado, setHidratado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  // El panel con una casilla por finalidad, y lo que lleva marcado.
  const [configurando, setConfigurando] = useState(false);
  const [borrador, setBorrador] = useState<Record<Finalidad, boolean>>({
    medicion: false,
    publicidad: false,
  });
  const [puedeCargar, setPuedeCargar] = useState(false);
  const [listo, setListo] = useState(false);
  const [pixelListo, setPixelListo] = useState(false);
  const [huboScroll, setHuboScroll] = useState(false);
  const medicion = consentimiento.medicion === true;
  const publicidad = HAY_PIXEL && consentimiento.publicidad === true;
  const hayVariasFinalidades = FINALIDADES.length > 1;
  // Las rutas internas (en la web, el editor del blog y las vistas previa):
  // ni medición ni aviso de cookies, aunque la visita hubiera aceptado en
  // otra página.
  const conAnalitica = !rutasSinAnalitica.includes(primerSegmento(pathname));
  // Donde no hay analítica tampoco se mide, ni en Google ni en Vercel.
  const rutasSinMedir = useMemo(
    () => [...rutasSinMedicion, ...rutasSinAnalitica],
    [rutasSinMedicion, rutasSinAnalitica]
  );
  const medible = rutaMedible(pathname, rutasSinMedir);
  // Un texto, no el objeto: como dependencia del efecto del `page_view`, un
  // objeto nuevo en otro render lo volvería a enviar.
  const eventoDeRuta = eventosDeRuta[primerSegmento(pathname)];
  // Misma referencia mientras no cambien las listas: `<Analytics>` vuelve a
  // registrar `beforeSend` cada vez que cambia.
  const filtrarEventoDeVercel = useMemo(
    () => crearFiltroDeVercel(rutasSinMedir),
    [rutasSinMedir]
  );

  useEffect(() => {
    if (!conAnalitica) return;
    const sincronizar = () => {
      if (document.visibilityState === "hidden") return;
      setConsentimiento(leerConsentimiento());
      setHidratado(true);
    };
    sincronizar();
    window.addEventListener("focus", sincronizar);
    window.addEventListener("pageshow", sincronizar);
    document.addEventListener("visibilitychange", sincronizar);
    return () => {
      window.removeEventListener("focus", sincronizar);
      window.removeEventListener("pageshow", sincronizar);
      document.removeEventListener("visibilitychange", sincronizar);
    };
  }, [conAnalitica]);

  useEffect(() => {
    const abrir = () => {
      const actual = leerConsentimiento();
      setBorrador({
        medicion: actual.medicion === true,
        publicidad: actual.publicidad === true,
      });
      // Con varias finalidades se reabre en el panel: es donde se cambia una
      // sin tocar la otra.
      setConfigurando(FINALIDADES.length > 1);
      setAbierto(true);
    };
    window.addEventListener(EVENTO_PREFERENCIAS, abrir);
    return () => window.removeEventListener(EVENTO_PREFERENCIAS, abrir);
  }, []);

  useEffect(() => {
    if (!aplazarAvisoHastaScroll || huboScroll) return;
    const alDesplazar = () => {
      if (window.scrollY > 0) setHuboScroll(true);
    };
    // Una recarga a media página ya viene desplazada.
    alDesplazar();
    window.addEventListener("scroll", alDesplazar, { passive: true });
    return () => window.removeEventListener("scroll", alDesplazar);
  }, [aplazarAvisoHastaScroll, huboScroll]);

  useEffect(() => {
    if (!conAnalitica || !hidratado || !/^G-[A-Z0-9]+$/.test(ID_MEDICION))
      return;
    if (medicion) {
      configurarGoogle(grupoDeContenido);
      setPuedeCargar(true);
    } else {
      detenerGoogle();
      setPuedeCargar(false);
      setListo(false);
    }
  }, [medicion, hidratado, conAnalitica, grupoDeContenido]);

  useEffect(() => {
    if (!conAnalitica || !hidratado || !HAY_PIXEL) return;
    if (publicidad) {
      configurarMeta();
      setPixelListo(true);
    } else {
      detenerMeta();
      setPixelListo(false);
    }
  }, [publicidad, hidratado, conAnalitica]);

  useEffect(() => {
    if (!listo || !medicion || !medible) return;
    // Nunca se envían query strings: contienen tokens de registro o campañas.
    window.gtag?.("event", "page_view", {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_referrer: referenteSeguro(),
      page_title: document.title,
      ...(grupoDeContenido ? { content_group: grupoDeContenido } : {}),
    });
    if (eventoDeRuta) {
      window.gtag?.("event", eventoDeRuta, {
        page_location: `${window.location.origin}${pathname}`,
        ...(grupoDeContenido ? { content_group: grupoDeContenido } : {}),
      });
    }
  }, [listo, medicion, pathname, medible, grupoDeContenido, eventoDeRuta]);

  useEffect(() => {
    if (!pixelListo || !publicidad || !medible || !puedeIrAMeta()) return;
    if (paginasVistasEnMeta) window.fbq?.("track", "PageView");
    const estandar = eventoDeRuta ? EVENTOS_DE_META[eventoDeRuta] : undefined;
    if (estandar) {
      window.fbq?.("track", estandar, {
        content_name: primerSegmento(pathname),
      });
    }
  }, [
    pixelListo,
    publicidad,
    pathname,
    medible,
    eventoDeRuta,
    paginasVistasEnMeta,
  ]);

  if (!conAnalitica) return null;
  if (!/^G-[A-Z0-9]+$/.test(ID_MEDICION)) return null;

  const decidir = (nuevo: Consentimiento) => {
    guardarConsentimiento(nuevo);
    if (nuevo.medicion !== true) detenerGoogle();
    if (nuevo.publicidad !== true) detenerMeta();
    setConsentimiento(nuevo);
    setAbierto(false);
    setConfigurando(false);
  };
  const todas = (aceptadas: boolean): Consentimiento =>
    Object.fromEntries(FINALIDADES.map((finalidad) => [finalidad, aceptadas]));
  const configurar = () => {
    setBorrador({ medicion, publicidad });
    setConfigurando(true);
  };

  // Falta alguna respuesta: la primera visita o, si se añadió la publicidad
  // después, quien solo eligió sobre la medición.
  const pendiente = FINALIDADES.some(
    (finalidad) => consentimiento[finalidad] === undefined
  );
  const mostrarAviso =
    hidratado &&
    (abierto || (pendiente && (!aplazarAvisoHastaScroll || huboScroll)));
  // El botón solo cuando ya hay una elección que cambiar.
  const mostrarBoton = hidratado && !mostrarAviso && !pendiente;

  // Dentro del panel hay barra lateral (escritorio) y barra inferior (móvil):
  // el botón flotante no puede taparlas. En móvil la opción vive en la hoja
  // «Más»; en escritorio el botón pasa a la esquina derecha. El aviso, en
  // móvil, se apoya encima de la barra inferior.
  const colocacionDelAviso = dentroDelPanel
    ? "bottom-[calc(5.5rem_+_env(safe-area-inset-bottom))] lg:bottom-4"
    : "bottom-4";
  const colocacionDelBoton = dentroDelPanel
    ? "right-4 hidden lg:inline-flex"
    : "left-4 inline-flex";
  const enlace =
    "rounded font-medium text-tinta-2 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado";

  return (
    <>
      {puedeCargar && medicion ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ID_MEDICION}`}
            strategy="afterInteractive"
            onReady={() => setListo(true)}
          />
          <Analytics beforeSend={filtrarEventoDeVercel} />
        </>
      ) : null}
      {pixelListo && publicidad ? (
        <Script
          id="pixel-de-meta"
          src="https://connect.facebook.net/en_US/fbevents.js"
          strategy="afterInteractive"
        />
      ) : null}
      {mostrarAviso ? (
        <aside
          className={`fixed inset-x-4 z-[65] mx-auto max-w-md rounded-2xl border border-linea bg-superficie p-4 shadow-[0_16px_40px_rgba(0,0,0,0.16)] ${colocacionDelAviso}`}
          aria-labelledby="titulo-cookies"
        >
          {configurando ? (
            <>
              <h2
                id="titulo-cookies"
                className="text-sm font-semibold text-tinta"
              >
                Preferencias de cookies
              </h2>
              <ul className="mt-2 divide-y divide-linea-suave">
                <li className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-tinta">Técnicas</p>
                    <p className="text-xs leading-5 text-muted">
                      Mantienen la sesión y guardan esta elección.
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-tenue">
                    Siempre activas
                  </span>
                </li>
                {FINALIDADES.map((finalidad) => (
                  <li
                    key={finalidad}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-tinta">
                        {DESCRIPCIONES[finalidad].titulo}
                      </p>
                      <p className="text-xs leading-5 text-muted">
                        {DESCRIPCIONES[finalidad].texto}
                      </p>
                    </div>
                    <Interruptor
                      activo={borrador[finalidad]}
                      onCambiar={(activo) =>
                        setBorrador((anterior) => ({
                          ...anterior,
                          [finalidad]: activo,
                        }))
                      }
                      etiqueta={`Cookies de ${DESCRIPCIONES[finalidad].titulo.toLowerCase()}`}
                    />
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={() =>
                    decidir(
                      Object.fromEntries(
                        FINALIDADES.map((finalidad) => [
                          finalidad,
                          borrador[finalidad],
                        ])
                      )
                    )
                  }
                  className="btn-secondary h-11 px-5"
                >
                  Guardar selección
                </button>
                <a href={enlaceDePrivacidad} className={`text-sm ${enlace}`}>
                  Más información
                </a>
              </div>
            </>
          ) : (
            <>
              {/* Título real para quien usa lector de pantalla (puede saltar a
                  él), pero oculto a la vista: el aviso tiene que ser compacto
                  para no tapar el contenido de la primera pantalla. */}
              <h2 id="titulo-cookies" className="sr-only">
                Preferencias de cookies
              </h2>
              <p className="text-sm leading-5 text-muted">
                {hayVariasFinalidades
                  ? "Cookies opcionales de medición (Google Analytics y Vercel) y de publicidad (Meta): solo se activan si aceptas."
                  : "Cookies opcionales de medición (Google Analytics y Vercel): solo se activan si aceptas."}{" "}
                <a href={enlaceDePrivacidad} className={enlace}>
                  Más información
                </a>
                .
              </p>
              {/* Etiquetas cortas para que los botones quepan en una fila en
                  móvil; el nombre accesible completo empieza por el texto
                  visible (WCAG 2.5.3). Aceptar y Rechazar, iguales; Configurar,
                  visible pero sin competir con ellos (guía de la AEPD). */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => decidir(todas(true))}
                  aria-label="Aceptar cookies"
                  className="btn-secondary h-11 px-5"
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  onClick={() => decidir(todas(false))}
                  aria-label="Rechazar cookies"
                  className="btn-secondary h-11 px-5"
                >
                  Rechazar
                </button>
                {hayVariasFinalidades ? (
                  <button
                    type="button"
                    onClick={configurar}
                    aria-label="Configurar por finalidad"
                    className={`h-11 px-2 text-sm ${enlace}`}
                  >
                    Configurar
                  </button>
                ) : null}
              </div>
            </>
          )}
        </aside>
      ) : mostrarBoton ? (
        // `data-relato` lo pone en <html> el relato con scroll de la portada
        // de la web (llamada-scroll.tsx): mientras el escenario está fijo el
        // botón se esconde, porque tapaba la barra de pasos en móvil.
        // Solo el icono: una pastilla con texto ocupaba media esquina en
        // móvil. El nombre accesible y el `title` dicen lo que hace.
        <button
          type="button"
          onClick={abrirPreferenciasDeCookies}
          aria-label="Configurar cookies"
          title="Configurar cookies"
          className={`fixed bottom-4 z-40 h-11 w-11 items-center justify-center rounded-full border border-linea bg-superficie text-tinta-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition duration-200 hover:bg-relleno hover:text-morado [html[data-relato]_&]:pointer-events-none [html[data-relato]_&]:opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado ${colocacionDelBoton}`}
        >
          <Cookie className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
    </>
  );
}
