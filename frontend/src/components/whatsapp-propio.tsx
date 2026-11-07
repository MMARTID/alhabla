"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import {
  getWhatsappPropio,
  pedirEnlaceWhatsappPropio,
  registrarWhatsappPropio,
} from "@/lib/api";
import { describeApiError } from "@/lib/api-errors";
import { formatPhone } from "@/lib/format";
import {
  abrirAltaEnCoexistencia,
  cargarSdkDeFacebook,
  leerEventoDelAlta,
} from "@/lib/alta-whatsapp-meta";
import type { EstadoWhatsappPropio } from "@/lib/types";
import {
  FeedbackMessage,
  type Feedback,
} from "@/components/ajustes/marco-de-ajustes";

type Conexion = NonNullable<EstadoWhatsappPropio["conexion"]>;
type AltaPropia = NonNullable<EstadoWhatsappPropio["altaPropia"]>;

/** Mientras Telnyx y Meta trabajan, el panel pregunta cada 10 s. */
const ESTADOS_EN_CURSO = new Set([
  "esperando_alta",
  "registrando",
  "pending_onboarding",
  "sync_pending",
  "syncing",
  "sync_complete",
  "history_declined",
]);

export const AVISOS_ANTES_DE_CONECTAR = [
  "Sigues usando tu app de WhatsApp Business como siempre: tus chats, tus clientes y tu número no cambian.",
  "Al conectar, WhatsApp desvincula el WhatsApp Web y los demás dispositivos enlazados: tendrás que volver a vincularlos.",
  "Necesitas la app de WhatsApp Business al día en el móvil de ese número y entrar con el Facebook del negocio.",
];

const BADGES: Record<string, { texto: string; clases: string }> = {
  active: {
    texto: "Conectado",
    clases: "bg-exito-fondo text-exito ring-exito-borde",
  },
  en_curso: {
    texto: "Conectando",
    clases: "bg-aviso-fondo text-aviso ring-aviso-borde",
  },
  problema: {
    texto: "Sin conectar",
    clases: "bg-error-fondo text-error ring-error-borde",
  },
};

function badgeDe(estado: string) {
  if (estado === "active") return BADGES.active;
  if (ESTADOS_EN_CURSO.has(estado)) return BADGES.en_curso;
  return BADGES.problema;
}

/** Qué está pasando, en una frase para el dueño. */
export function explicacionDelEstado(conexion: Conexion): string {
  switch (conexion.estado) {
    case "esperando_alta":
      return "Termina la conexión en la pestaña de WhatsApp que se ha abierto: entra con el Facebook del negocio y elige conectar tu app de WhatsApp Business. Cuando acabes, vuelve aquí.";
    case "enlace_caducado":
      return "El enlace para conectar caducó sin usarse. Vuelve a empezar cuando quieras.";
    case "registrando":
    case "pending_onboarding":
      return "Estamos terminando la conexión con WhatsApp. Suele tardar unos minutos.";
    case "sync_pending":
    case "syncing":
    case "sync_complete":
    case "history_declined":
      return "WhatsApp está sincronizando tu cuenta. Puede tardar hasta 24 horas; no tienes que hacer nada y puedes seguir usando la app.";
    case "active":
      return "Tu WhatsApp Business está conectado. De momento, los mensajes a tus clientes siguen saliendo del WhatsApp de Alhabla Reservas; pronto podrán salir de tu número.";
    case "fallido":
      return "No se pudo terminar la conexión. Vuelve a intentarlo; si se repite, escríbenos.";
    case "sync_deadline_expired":
      return "La sincronización no empezó a tiempo. En la app, ve a Ajustes › Cuenta › Plataforma empresarial, desconecta Alhabla y vuelve a conectar aquí.";
    case "offboarded":
    case "disconnected":
      return "Tu WhatsApp se desconectó de Alhabla. Si fue sin querer, vuelve a conectarlo.";
    default:
      return "Estamos comprobando el estado de tu WhatsApp.";
  }
}

/** El estado de la conexión, compartido por el bloque y su contenido. */
export function useWhatsappPropio(hasToken: boolean | null) {
  return useQuery({
    queryKey: ["whatsapp-propio"],
    queryFn: getWhatsappPropio,
    enabled: hasToken === true,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const estado = query.state.data?.conexion?.estado;
      return estado && ESTADOS_EN_CURSO.has(estado) ? 10_000 : false;
    },
  });
}

/** Si el bloque se enseña: con el alta disponible o una conexión que contar. */
export function mostrarWhatsappPropio(datos: EstadoWhatsappPropio | undefined) {
  return datos !== undefined && (datos.disponible || datos.conexion !== null);
}

/**
 * Ajustes › Teléfono › Tu WhatsApp Business (Beta): conectar el número que
 * el negocio ya usa en la app de WhatsApp Business para que Alhabla y el
 * dueño lo usen a la vez (coexistencia). El botón abre la página de alta de
 * Telnyx en otra pestaña; la ventana de Meta dentro de la app queda plegada
 * como alternativa. Solo se pinta si el alta está disponible o ya hay una
 * conexión que enseñar.
 */
export function WhatsappPropio({ hasToken }: { hasToken: boolean | null }) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [enlace, setEnlace] = useState<string | null>(null);
  const [otraForma, setOtraForma] = useState(false);

  const datos = useWhatsappPropio(hasToken).data;
  const enlaceMutation = useMutation({ mutationFn: pedirEnlaceWhatsappPropio });

  if (!datos || !mostrarWhatsappPropio(datos)) return null;

  const conexion = datos.conexion;
  const esperando = conexion?.estado === "esperando_alta";
  const puedeConectar =
    datos.disponible &&
    (conexion === null || conexion.puedeRepetir || esperando);
  const altaPropia = puedeConectar ? datos.altaPropia : null;

  const conectar = () => {
    setFeedback(null);
    // La pestaña se abre ya, en el clic: abierta tras la respuesta del
    // backend, el navegador la bloquearía.
    const pestana = window.open("", "_blank");
    enlaceMutation.mutate(undefined, {
      onSuccess: ({ url, estado }) => {
        queryClient.setQueryData(["whatsapp-propio"], estado);
        setEnlace(url);
        if (pestana && !pestana.closed) {
          pestana.opener = null;
          pestana.location.href = url;
        }
      },
      onError: (error) => {
        pestana?.close();
        setFeedback({
          type: "error",
          message: describeApiError(
            error,
            "No hemos podido preparar la conexión. Inténtalo de nuevo en unos minutos."
          ),
        });
      },
    });
  };

  return (
    <div className="space-y-4">
      {conexion ? (
        <div className="rounded-[10px] border border-linea p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${badgeDe(conexion.estado).clases}`}
            >
              {badgeDe(conexion.estado).texto}
            </span>
            {conexion.phoneNumber ? (
              <span className="text-sm font-semibold text-tinta">
                {formatPhone(conexion.phoneNumber)}
              </span>
            ) : null}
            {ESTADOS_EN_CURSO.has(conexion.estado) ? (
              <Loader2
                className="h-4 w-4 animate-spin text-morado"
                aria-hidden="true"
              />
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-apagado">
            {explicacionDelEstado(conexion)}
          </p>
          {conexion.estado === "active" ? (
            <p className="mt-2 text-xs leading-5 text-muted">
              Para desconectarlo, en la app de WhatsApp Business ve a Ajustes ›
              Cuenta › Plataforma empresarial.
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2 text-sm leading-6 text-apagado">
          {AVISOS_ANTES_DE_CONECTAR.map((aviso) => (
            <li key={aviso} className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-morado"
              />
              <span>{aviso}</span>
            </li>
          ))}
        </ul>
      )}

      {puedeConectar ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="btn-primary inline-flex min-h-11 items-center gap-2"
              onClick={conectar}
              disabled={enlaceMutation.isPending}
            >
              {enlaceMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : esperando ? (
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              ) : conexion ? (
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              ) : (
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
              )}
              {esperando
                ? "Abrir la conexión otra vez"
                : conexion
                  ? "Volver a conectar"
                  : "Conectar mi WhatsApp"}
            </button>
            <FeedbackMessage value={feedback} />
          </div>
          {enlace ? (
            <p className="text-xs leading-5 text-muted">
              ¿No se ha abierto?{" "}
              <a
                href={enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-morado-tinta underline underline-offset-2"
              >
                Abre la conexión con WhatsApp
              </a>
            </p>
          ) : null}
        </div>
      ) : (
        <FeedbackMessage value={feedback} />
      )}

      {altaPropia ? (
        <details
          className="group"
          onToggle={(evento) => setOtraForma(evento.currentTarget.open)}
        >
          <summary className="cursor-pointer select-none text-xs font-semibold text-muted hover:text-apagado">
            Otra forma de conectar
          </summary>
          {otraForma ? (
            <ConectarDesdeLaApp alta={altaPropia} conexion={conexion} />
          ) : null}
        </details>
      ) : null}
    </div>
  );
}

/**
 * La alternativa: la ventana de Meta (`FB.login()`) abierta aquí mismo, sin
 * cambiar de pestaña. El SDK de Facebook solo se carga al desplegarla.
 */
function ConectarDesdeLaApp({
  alta,
  conexion,
}: {
  alta: AltaPropia;
  conexion: Conexion | null;
}) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [sdkListo, setSdkListo] = useState(false);
  const [abierta, setAbierta] = useState(false);
  // El evento de Meta y el callback de FB.login llegan en cualquier orden:
  // si ya llegó el evento, el cierre de la ventana no es una cancelación.
  const eventoRecibido = useRef(false);

  const registroMutation = useMutation({
    mutationFn: registrarWhatsappPropio,
    onSuccess: (estado) => {
      queryClient.setQueryData(["whatsapp-propio"], estado);
      setFeedback({
        type: "success",
        message: "¡Hecho! Estamos terminando la conexión.",
      });
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: describeApiError(
          error,
          "No hemos podido terminar la conexión. Inténtalo de nuevo en unos minutos."
        ),
      });
    },
  });
  const registrar = registroMutation.mutate;

  // El SDK se carga al desplegar y no al pulsar: FB.login tiene que salir
  // del clic para que el navegador no bloquee la ventana.
  useEffect(() => {
    let vigente = true;
    cargarSdkDeFacebook(alta.appId, alta.graphVersion)
      .then(() => {
        if (vigente) setSdkListo(true);
      })
      .catch(() => {
        if (vigente) {
          setFeedback({
            type: "error",
            message:
              "No se pudo cargar la ventana de Facebook. Si usas un bloqueador de anuncios, desactívalo en esta página.",
          });
        }
      });
    return () => {
      vigente = false;
    };
  }, [alta.appId, alta.graphVersion]);

  useEffect(() => {
    if (!abierta) return;
    const alRecibir = (mensaje: MessageEvent) => {
      const evento = leerEventoDelAlta(mensaje.origin, mensaje.data);
      if (!evento) return;
      eventoRecibido.current = true;
      setAbierta(false);
      if (evento.tipo === "terminada") {
        setFeedback(null);
        registrar({
          wabaId: evento.wabaId,
          phoneNumberId: evento.phoneNumberId,
        });
      } else if (evento.tipo === "sin_coexistencia") {
        setFeedback({
          type: "error",
          message:
            "Has elegido crear una cuenta nueva. Para conectar el número que ya usas, vuelve a empezar y elige conectar tu app de WhatsApp Business.",
        });
      } else if (evento.tipo === "cancelada") {
        setFeedback({
          type: "error",
          message:
            "Has cerrado la ventana antes de terminar. Puedes volver a empezar cuando quieras.",
        });
      } else {
        setFeedback({
          type: "error",
          message:
            "WhatsApp no pudo terminar la conexión. Vuelve a intentarlo.",
        });
      }
    };
    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
  }, [abierta, registrar]);

  const conectar = () => {
    if (!window.FB) return;
    setFeedback(null);
    eventoRecibido.current = false;
    setAbierta(true);
    abrirAltaEnCoexistencia(window.FB, alta, (sinPermiso) => {
      // El evento de Meta suele llegar antes; si no llegó nada y no hubo
      // permiso, la persona cerró la ventana.
      window.setTimeout(() => {
        if (eventoRecibido.current) return;
        setAbierta(false);
        if (sinPermiso) {
          setFeedback({
            type: "error",
            message:
              "Has cerrado la ventana antes de terminar. Puedes volver a empezar cuando quieras.",
          });
        }
      }, 1_500);
    });
  };

  return (
    <div className="mt-3 space-y-3 border-l-2 border-linea pl-3">
      <p className="text-xs leading-5 text-muted">
        Si la pestaña de WhatsApp no se abre o no termina, puedes hacer la
        conexión en una ventana de Facebook sin salir de aquí.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="btn-secondary inline-flex min-h-11 items-center gap-2"
          onClick={conectar}
          disabled={!sdkListo || abierta || registroMutation.isPending}
        >
          {abierta || registroMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          )}
          {conexion ? "Conectar desde aquí otra vez" : "Conectar desde aquí"}
        </button>
        <FeedbackMessage value={feedback} />
      </div>
    </div>
  );
}
