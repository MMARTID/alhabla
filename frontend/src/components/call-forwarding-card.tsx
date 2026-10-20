"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  CircleCheck,
  Copy,
  Loader2,
  PhoneCall,
  PhoneForwarded,
  Clock3,
  TriangleAlert,
} from "lucide-react";
import {
  TIPOS_CON_LINEA_PROPIA,
  TarjetasDeLinea,
} from "@/components/tarjetas-de-linea";
import {
  confirmForwarding,
  getForwardingCheck,
  startForwardingCheck,
  updateMyBusiness,
} from "@/lib/api";
import { apiErrorCode } from "@/lib/api-errors";
import {
  OPERADORES,
  RUTA_GUIA_DE_DESVIO,
  esOperador,
  guiaDeDesvio,
  type CodigoDeDesvio,
  type GrupoDeCodigos,
  type GuiaDeDesvio,
  type OperadorId,
} from "@/lib/desvio-por-operador";
import { formatPhone } from "@/lib/format";
import { webUrl } from "@/lib/web-url";
import type {
  CustomerLineType,
  ForwardingCheckErrorCode,
  ForwardingCheckFailureReason,
  OnboardingForwarding,
} from "@/lib/types";

/**
 * «Comprobar desvío» (docs/historico/PLAN-TELEFONIA-UX.md § 4): el panel
 * pregunta el
 * resultado cada 2 s. La llamada saliente espera hasta 35 s a que salte el
 * desvío y luego llega el webhook, así que 25 consultas (50 s) cubren el
 * caso más lento; pasado eso se da por no recibido y se ofrece repetir.
 */
export const INTERVALO_DE_CONSULTA_MS = 2000;
export const MAX_CONSULTAS = 25;

/** Qué hacer según por qué no ha funcionado (§ 4 punto 5 del plan). */
export const TEXTO_POR_MOTIVO: Record<ForwardingCheckFailureReason, { titulo: string; detalle: string }> = {
  la_has_cogido: {
    titulo: "Alguien ha cogido la llamada",
    detalle:
      "Puede que la hayas cogido tú por reflejo o que la tenga un contestador. Vuelve a comprobarlo y deja que suene sin cogerla; si esa línea tiene contestador, desactívalo antes.",
  },
  comunicando: {
    titulo: "Tu línea estaba comunicando o ha rechazado la llamada",
    detalle:
      "Cuelga lo que tengas en curso y vuelve a comprobarlo. Si quieres que las llamadas que entran mientras hablas también lleguen a tu recepcionista, activa además el desvío «cuando estás comunicando».",
  },
  sin_desvio: {
    titulo: "No ha saltado el desvío",
    detalle:
      "La llamada ha sonado hasta agotar el tiempo sin llegar a tu recepcionista. Revisa que marcaste bien el código desde el teléfono de esa línea. Si es un fijo con contestador, desactívalo (en Movistar, #10#) o se quedará él las llamadas.",
  },
  desconocido: {
    titulo: "No hemos podido completar la llamada",
    detalle:
      "Inténtalo otra vez en unos minutos. Si estás seguro de que el desvío está activo, marca «Ya lo he activado» y lo confirmaremos con la primera llamada real.",
  },
};

/**
 * Dónde está montado el bloque «Comprobar desvío»: en la tarjeta del panel
 * de inicio (con el respaldo «Ya lo he activado» al lado) o en Ajustes ›
 * Teléfono, donde ese botón no existe y la línea de clientes se edita
 * justo encima. Los textos que nombran una cosa u otra cambian con él.
 */
export type ContextoDeComprobacion = "panel" | "ajustes";

/** Lo que cambia en Ajustes respecto a `TEXTO_POR_MOTIVO`. */
export const TEXTO_POR_MOTIVO_EN_AJUSTES: Partial<
  Record<ForwardingCheckFailureReason, { titulo: string; detalle: string }>
> = {
  desconocido: {
    titulo: TEXTO_POR_MOTIVO.desconocido.titulo,
    detalle:
      "Inténtalo otra vez en unos minutos. Si estás seguro de que el desvío está activo, lo confirmaremos con la primera llamada real.",
  },
};

const TEXTO_POR_CODIGO_DE_ERROR: Record<ForwardingCheckErrorCode, string> = {
  sin_numero: "Tu número de Alhabla todavía no está activo. Espera unos minutos y vuelve a probar.",
  linea_de_clientes_invalida:
    "Necesitamos el teléfono al que te llaman tus clientes, distinto del número de Alhabla. Revísalo en Ajustes.",
  linea_no_admitida:
    "Solo podemos comprobar el desvío de un fijo o un móvil de España. Revisa el teléfono de tus clientes en Ajustes.",
  comprobacion_en_curso: "Ya hay una comprobación en marcha. Espera un minuto y vuelve a probar.",
  limite_alcanzado: "Has agotado las tres comprobaciones de esta hora. Puedes volver a intentarlo más tarde.",
  telefonia_no_configurada: "No hemos podido llamar a tu línea. Inténtalo en unos minutos.",
  no_se_pudo_llamar: "No hemos podido llamar a tu línea. Inténtalo en unos minutos.",
};

/** En Ajustes la línea se corrige en el bloque de arriba, no «en Ajustes». */
const TEXTO_POR_CODIGO_DE_ERROR_EN_AJUSTES: Partial<Record<ForwardingCheckErrorCode, string>> = {
  linea_de_clientes_invalida:
    "Necesitamos el teléfono al que te llaman tus clientes, distinto del número de Alhabla. Revísalo arriba, en «Línea de clientes».",
  linea_no_admitida:
    "Solo podemos comprobar el desvío de un fijo o un móvil de España. Revisa arriba el número al que te llaman tus clientes.",
};

function textoDeErrorAlComprobar(error: unknown, contexto: ContextoDeComprobacion): string {
  const code = apiErrorCode(error) as ForwardingCheckErrorCode | null;
  const enAjustes = contexto === "ajustes" && code ? TEXTO_POR_CODIGO_DE_ERROR_EN_AJUSTES[code] : undefined;
  return enAjustes ||
    (code && TEXTO_POR_CODIGO_DE_ERROR[code]) ||
    "No hemos podido iniciar la comprobación. Inténtalo otra vez en unos segundos.";
}

function textoDeMotivo(motivo: ForwardingCheckFailureReason, contexto: ContextoDeComprobacion) {
  return (contexto === "ajustes" && TEXTO_POR_MOTIVO_EN_AJUSTES[motivo]) || TEXTO_POR_MOTIVO[motivo];
}

type CallForwardingCardProps = {
  forwarding: OnboardingForwarding;
  /**
   * Tipo de la línea de clientes (`Business.customerLineType`): decide qué
   * códigos y qué avisos se enseñan. null o ausente = negocio anterior a la
   * fase 1 del plan de telefonía: se enseña todo y se pregunta aquí mismo.
   */
  customerLineType?: CustomerLineType | null;
};

export function CallForwardingCard({
  forwarding,
  customerLineType,
}: CallForwardingCardProps) {
  const queryClient = useQueryClient();
  const [copiado, setCopiado] = useState<string | null>(null);
  const [operador, setOperador] = useState<OperadorId | null>(null);
  const tipoDeLinea = customerLineType ?? null;

  const confirmMutation = useMutation({
    mutationFn: confirmForwarding,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["onboarding-state"] });
    },
  });

  const copiar = async (valor: string, id: string) => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(id);
      window.setTimeout(() => setCopiado((actual) => (actual === id ? null : actual)), 2000);
    } catch {
      // Portapapeles bloqueado (permisos del navegador): el código está a la
      // vista, así que se puede copiar a mano; no hace falta alarmar.
      setCopiado(null);
    }
  };

  // Con el número de Alhabla como teléfono del negocio no hay nada que
  // desviar: el paso se da por hecho (el backend lo marca como tal).
  if (tipoDeLinea === "alhabla") return null;

  if (forwarding.status === "waiting_number") {
    return (
      <section id="desvio" className="panel scroll-mt-32 border-linea bg-relleno p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-superficie text-morado">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-tinta sm:text-lg">
              Estamos activando tu número
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Tu número español tarda unos minutos en quedar aprobado. En cuanto lo esté, aquí mismo te
              diremos cómo desviar tu línea de siempre para empezar a recibir llamadas. Mientras tanto,
              completa la configuración: es lo que tu recepcionista necesita para poder reservar citas.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const numero = forwarding.phoneNumber;
  if (!numero) return null;

  const esMovil =
    tipoDeLinea === "movil_trabajo" || tipoDeLinea === "movil_personal";
  const esFijo = tipoDeLinea === "fijo";

  return (
    <section
      id="desvio"
      className="panel scroll-mt-32 border-lavado-borde bg-lavado p-4 sm:p-5"
      aria-labelledby="desvio-title"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-superficie text-morado">
          <PhoneForwarded className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="desvio-title" className="text-base font-semibold text-tinta sm:text-lg">
            Activa el desvío para empezar a recibir llamadas
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Tus clientes siguen llamando a tu número de siempre. El desvío es lo que hace que las
            llamadas que no puedes coger lleguen a tu recepcionista, sin cambiar de número ni avisar a
            nadie.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-superficie p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted">Tu número de Alhabla</p>
          <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-tinta">
            {formatPhone(numero)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => copiar(numero, "numero")}
          className="btn-secondary h-11 shrink-0 px-4"
        >
          {copiado === "numero" ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copiar número
            </>
          )}
        </button>
      </div>

      {tipoDeLinea === null && forwarding.customerLine ? (
        <PreguntaTipoDeLinea customerLine={forwarding.customerLine} />
      ) : null}

      <SelectorDeOperador
        id="desvio-operador"
        value={operador}
        onChange={setOperador}
      />

      {esFijo ? (
        <>
          <h3 className="mt-5 text-sm font-semibold text-tinta">Desde el fijo del local</h3>
          <GuiaDeCodigos
            guia={guiaDeDesvio("fijo", operador)}
            numero={numero}
            copiado={copiado}
            onCopiar={copiar}
          />
        </>
      ) : null}

      {esMovil || tipoDeLinea === null ? (
        <>
          <h3 className="mt-5 text-sm font-semibold text-tinta">
            {esMovil ? "Desde tu móvil" : "Desde un móvil"}
          </h3>
          {/* También sin tipo confirmado: si la línea resulta ser un móvil,
              conviene saber que el buzón de voz deja de saltar. */}
          <GuiaDeCodigos
            guia={guiaDeDesvio("movil", operador)}
            numero={numero}
            copiado={copiado}
            onCopiar={copiar}
          />
        </>
      ) : null}

      {tipoDeLinea === null ? (
        <>
          <h3 className="mt-5 text-sm font-semibold text-tinta">Desde un fijo</h3>
          <GuiaDeCodigos
            guia={guiaDeDesvio("fijo", operador)}
            numero={numero}
            copiado={copiado}
            onCopiar={copiar}
          />
        </>
      ) : null}

      <EnlaceAGuiaDeDesvio />

      <ComprobarDesvio customerLine={forwarding.customerLine} />

      <div className="mt-5 flex flex-col gap-3 border-t border-lavado-borde pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Si prefieres no comprobarlo, en cuanto entre la primera llamada lo damos por hecho automáticamente.
        </p>
        <button
          type="button"
          onClick={() => confirmMutation.mutate()}
          disabled={confirmMutation.isPending}
          className="btn-primary h-11 shrink-0 px-5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {confirmMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          Ya lo he activado
        </button>
      </div>

      {confirmMutation.isError ? (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          No se pudo guardar la confirmación. Inténtalo otra vez en unos segundos.
        </p>
      ) : null}
    </section>
  );
}

/** Aviso corto bajo los códigos (contestador, buzón de voz). */
export function NotaDeLinea({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-aviso-borde bg-aviso-fondo px-4 py-3 text-sm leading-6 text-aviso">
      <TriangleAlert className="mt-1 h-4 w-4 shrink-0 text-aviso-icono" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Los códigos de marcar que aparecen dentro de un texto (`*21*`, `#10#`,
 * `#9998`), en monoespaciada como en las filas de códigos.
 */
export function conCodigos(texto: string): ReactNode[] {
  return texto.split(/([*#][*#\d]*\d[*#\d]*)/).map((trozo, indice) =>
    indice % 2 === 1 ? (
      <span key={indice} className="whitespace-nowrap font-mono text-tinta-2">
        {trozo}
      </span>
    ) : (
      trozo
    )
  );
}

/**
 * Con qué compañía está la línea: cambia los códigos (sobre todo en el fijo)
 * y los avisos. Sin elegir, los más habituales. No se guarda: solo sirve
 * para esta guía.
 */
export function SelectorDeOperador({
  id,
  value,
  onChange,
}: {
  id: string;
  value: OperadorId | null;
  onChange: (operador: OperadorId | null) => void;
}) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block text-sm font-semibold text-tinta">
        ¿Con qué compañía tienes esta línea?
      </label>
      <p id={`${id}-hint`} className="mt-0.5 text-xs leading-5 text-muted">
        Los códigos y lo que cobra cada una no son iguales.
      </p>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) =>
          onChange(esOperador(event.target.value) ? event.target.value : null)
        }
        aria-describedby={`${id}-hint`}
        className="field mt-2 w-full sm:max-w-xs"
      >
        <option value="">Otra o no lo sé</option>
        {OPERADORES.map((operador) => (
          <option key={operador.id} value={operador.id}>
            {operador.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Cómo marcar, los códigos y los avisos de una compañía. En el panel solo
 * el recomendado queda a la vista (elegir entre varios modos de desvío es
 * una decisión que no hace falta tomar para empezar); en Ajustes, dentro de
 * su propio desplegable, van todos.
 */
export function GuiaDeCodigos({
  guia,
  numero,
  copiado,
  onCopiar,
  plegarOtros = true,
}: {
  guia: GuiaDeDesvio;
  numero: string;
  copiado: string | null;
  onCopiar: (valor: string, id: string) => void;
  plegarOtros?: boolean;
}) {
  return (
    <>
      <p className="mt-1 text-sm leading-6 text-muted">{conCodigos(guia.comoMarcar)}</p>
      {guia.grupos.map((grupo) => (
        <GrupoDeCodigosFilas
          key={grupo.codigos[0]?.id}
          grupo={grupo}
          numero={numero}
          copiado={copiado}
          onCopiar={onCopiar}
          plegarOtros={plegarOtros}
        />
      ))}
      {guia.avisos.length === 1 ? (
        <NotaDeLinea>{conCodigos(guia.avisos[0])}</NotaDeLinea>
      ) : guia.avisos.length > 1 ? (
        <NotaDeLinea>
          <ul className="space-y-2">
            {guia.avisos.map((aviso) => (
              <li key={aviso}>{conCodigos(aviso)}</li>
            ))}
          </ul>
        </NotaDeLinea>
      ) : null}
    </>
  );
}

function GrupoDeCodigosFilas({
  grupo,
  numero,
  copiado,
  onCopiar,
  plegarOtros,
}: {
  grupo: GrupoDeCodigos;
  numero: string;
  copiado: string | null;
  onCopiar: (valor: string, id: string) => void;
  plegarOtros: boolean;
}) {
  const [recomendado, ...otros] = grupo.codigos;
  const titulo = grupo.titulo ? (
    <h4 className="mt-4 text-sm font-semibold text-tinta-2">{grupo.titulo}</h4>
  ) : null;

  if (!plegarOtros) {
    return (
      <>
        {titulo}
        <ul className="mt-2 space-y-2">
          {grupo.codigos.map((codigo) => (
            <li key={codigo.id}>
              <CodigoFila codigo={codigo} numero={numero} copiado={copiado} onCopiar={onCopiar} />
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <>
      {titulo}
      <div className="mt-3">
        <CodigoFila codigo={recomendado} numero={numero} copiado={copiado} onCopiar={onCopiar} />
      </div>
      {otros.length > 0 ? (
        <details className="group mt-2">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-[10px] px-1 text-sm font-semibold text-morado-tinta underline-offset-2 transition duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado [&::-webkit-details-marker]:hidden">
            Otras formas de desviar
            <ChevronDown className="h-4 w-4 transition duration-200 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="mt-2 space-y-2">
            {otros.map((codigo) => (
              <li key={codigo.id}>
                <CodigoFila codigo={codigo} numero={numero} copiado={copiado} onCopiar={onCopiar} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

/** La guía pública, con el paso a paso y las fuentes de cada compañía. */
export function EnlaceAGuiaDeDesvio() {
  return (
    <p className="mt-3 text-sm leading-6 text-muted">
      Paso a paso y con la ayuda oficial de cada compañía:{" "}
      <a
        href={webUrl(RUTA_GUIA_DE_DESVIO)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-morado-tinta underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
      >
        guía del desvío de llamadas
      </a>
      .
    </p>
  );
}

/**
 * Negocio anterior a la fase 1 del plan de telefonía: no dijo de qué tipo
 * es su línea. Se pregunta aquí, una vez, y se guarda al elegir; el negocio
 * en caché se sustituye por el que devuelve el PATCH para que la tarjeta
 * cambie de códigos al instante.
 */
function PreguntaTipoDeLinea({ customerLine }: { customerLine: string }) {
  const queryClient = useQueryClient();
  const guardarMutation = useMutation({
    mutationFn: (tipo: CustomerLineType) =>
      updateMyBusiness({ customerLineType: tipo }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["my-business"], updated);
      void queryClient.invalidateQueries({ queryKey: ["onboarding-state"] });
    },
  });

  return (
    <div className="mt-4 rounded-2xl border border-linea bg-superficie p-4">
      <h3 id="desvio-tipo-de-linea-title" className="text-sm font-semibold text-tinta">
        ¿De qué tipo es esta línea?
      </h3>
      <p className="mt-1 text-sm leading-6 text-muted">
        Tus clientes te llaman al {formatPhone(customerLine)}. Dinos qué es y te enseñamos solo los
        códigos que le corresponden.
      </p>
      <div className="mt-3">
        {/* Si el PATCH falla, la tarjeta se suelta: un radio que sigue marcado
            no vuelve a disparar onChange y no se podría reintentar la misma. */}
        <TarjetasDeLinea
          name="desvio-tipo-de-linea"
          value={guardarMutation.isError ? null : (guardarMutation.variables ?? null)}
          onChange={(tipo) => guardarMutation.mutate(tipo)}
          tipos={TIPOS_CON_LINEA_PROPIA}
          disabled={guardarMutation.isPending}
          aria-labelledby="desvio-tipo-de-linea-title"
        />
      </div>
      {guardarMutation.isError ? (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          No se pudo guardar el tipo de línea. Inténtalo otra vez en unos segundos.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Estados: inactiva → aviso («te vamos a llamar, no lo cojas») → en curso
 * (polling) → ok / fallo con motivo / sin respuesta. El resultado ok no
 * cierra la tarjeta solo: el mensaje se queda a la vista hasta que la
 * persona pulsa «Continuar», que refresca la guía (y la tarjeta desaparece
 * porque el paso ya está hecho).
 *
 * Se comparte con Ajustes › Teléfono (fase 2 del plan): mismo bloque, misma
 * conversación con el backend. Allí el bloque no desaparece al terminar,
 * así que «Hecho» lo devuelve al estado inicial (el estado «Comprobado
 * el …» lo pinta el bloque de arriba al refrescarse).
 */
export function ComprobarDesvio({
  customerLine,
  contexto = "panel",
}: {
  customerLine: string | null | undefined;
  contexto?: ContextoDeComprobacion;
}) {
  const queryClient = useQueryClient();
  const [fase, setFase] = useState<"inactiva" | "aviso" | "en_curso">("inactiva");
  const [checkId, setCheckId] = useState<string | null>(null);
  const consultas = useRef(0);

  const startMutation = useMutation({
    mutationFn: startForwardingCheck,
    onSuccess: (check) => {
      consultas.current = 0;
      setCheckId(check.id);
      setFase("en_curso");
    },
  });

  const checkQuery = useQuery({
    queryKey: ["forwarding-check", checkId],
    queryFn: () => {
      consultas.current += 1;
      return getForwardingCheck(checkId!);
    },
    enabled: checkId !== null,
    staleTime: 0,
    refetchInterval: (query) => {
      if (query.state.data?.resultado || consultas.current >= MAX_CONSULTAS) return false;
      return INTERVALO_DE_CONSULTA_MS;
    },
  });

  // Desestructurado a propósito: TanStack solo vuelve a renderizar por las
  // propiedades leídas en el render, y `isFetching` tiene que contar aunque
  // el dato (sin resultado) no cambie entre consultas.
  const {
    data: comprobacionActual,
    isFetching: consultando,
    isError: consultaFallida,
  } = checkQuery;
  const resultado = comprobacionActual?.resultado ?? null;
  const sinRespuesta =
    fase === "en_curso" && !resultado && consultas.current >= MAX_CONSULTAS && !consultando;
  const fallo = resultado?.estado === "fallo" ? resultado : null;

  const empezar = () => {
    setCheckId(null);
    startMutation.mutate();
  };

  const reiniciar = () => {
    setCheckId(null);
    startMutation.reset();
    setFase("aviso");
  };

  const continuar = () => {
    void queryClient.invalidateQueries({ queryKey: ["onboarding-state"] });
    if (contexto === "ajustes") {
      setCheckId(null);
      startMutation.reset();
      setFase("inactiva");
    }
  };

  // `undefined` = backend anterior a la fase 3 (Vercel puede publicar esta
  // interfaz unos minutos antes que Cloud Run): sin el bloque, sin ruido.
  if (customerLine === undefined) return null;

  if (customerLine === null) {
    return (
      <div className="mt-5 rounded-2xl border border-linea bg-superficie p-4">
        <h3 className="text-sm font-semibold text-tinta">Comprueba que funciona</h3>
        <p className="mt-1 text-sm leading-6 text-muted">
          Para comprobar el desvío necesitamos el teléfono al que te llaman tus clientes.{" "}
          <Link
            href="/ajustes/telefono"
            className="font-semibold text-morado-tinta underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
          >
            Añádelo en Ajustes
          </Link>{" "}
          y vuelve aquí.
        </p>
      </div>
    );
  }

  const lineaLegible = formatPhone(customerLine);

  return (
    <div className="mt-5 rounded-2xl border border-linea bg-superficie p-4">
      <h3 className="text-sm font-semibold text-tinta">Comprueba que funciona</h3>

      {fase === "inactiva" ? (
        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-muted">
            Te llamamos a tu línea de clientes desde tu número de Alhabla y vemos si la llamada
            vuelve a tu recepcionista. Tarda menos de un minuto.
          </p>
          <button
            type="button"
            onClick={() => setFase("aviso")}
            className={`${contexto === "ajustes" ? "btn-secondary" : "btn-purple"} h-11 shrink-0 px-5`}
          >
            <PhoneCall className="h-4 w-4" aria-hidden="true" />
            Comprobar desvío
          </button>
        </div>
      ) : null}

      {fase === "aviso" ? (
        <div className="mt-2 rounded-2xl border border-lavado-borde bg-lavado p-4">
          <p className="text-sm font-semibold text-tinta">
            Vamos a llamar al {lineaLegible}. No lo cojas.
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">
            Deja que suene: si has activado el desvío «cuando no contestas», tardará unos segundos
            en saltar a tu recepcionista. Si lo coges, la comprobación no vale.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={empezar}
              disabled={startMutation.isPending}
              className="btn-purple h-11 px-5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {startMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <PhoneCall className="h-4 w-4" aria-hidden="true" />
              )}
              Llamar ahora
            </button>
            <button
              type="button"
              onClick={() => {
                startMutation.reset();
                setFase("inactiva");
              }}
              disabled={startMutation.isPending}
              className="btn-secondary h-11 px-5"
            >
              Cancelar
            </button>
          </div>
          {startMutation.isError ? (
            <p role="alert" className="mt-3 text-sm font-medium text-error">
              {textoDeErrorAlComprobar(startMutation.error, contexto)}
            </p>
          ) : null}
        </div>
      ) : null}

      {fase === "en_curso" && !resultado && !sinRespuesta ? (
        <div role="status" className="mt-2 flex items-start gap-3 rounded-2xl border border-lavado-borde bg-lavado p-4">
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-morado" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-tinta">Llamando al {lineaLegible}… no lo cojas</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              Estamos esperando a que la llamada llegue a tu recepcionista. Puede tardar hasta un minuto.
            </p>
          </div>
        </div>
      ) : null}

      {resultado?.estado === "ok" ? (
        <div className="mt-2 rounded-2xl border border-exito-borde bg-exito-fondo p-4" role="status">
          <p className="flex items-center gap-2 text-sm font-semibold text-exito">
            <CircleCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
            Desvío funcionando
          </p>
          <p className="mt-1 text-sm leading-6 text-exito">
            La llamada al {lineaLegible} ha llegado a tu recepcionista. Tus clientes ya pueden reservar
            aunque no cojas el teléfono.
          </p>
          <button type="button" onClick={continuar} className="btn-primary mt-3 h-11 px-5">
            <Check className="h-4 w-4" aria-hidden="true" />
            {contexto === "ajustes" ? "Hecho" : "Continuar"}
          </button>
        </div>
      ) : null}

      {fallo || sinRespuesta ? (
        <div className="mt-2 rounded-2xl border border-linea bg-superficie p-4" role="alert">
          <p className="flex items-center gap-2 text-sm font-semibold text-tinta">
            <TriangleAlert className="h-5 w-5 shrink-0 text-urgente" aria-hidden="true" />
            {fallo ? textoDeMotivo(fallo.motivo, contexto).titulo : "No hemos recibido respuesta"}
          </p>
          <p className="mt-1 text-sm leading-6 text-apagado">
            {fallo
              ? textoDeMotivo(fallo.motivo, contexto).detalle
              : "La comprobación no ha terminado a tiempo. Espera un minuto y vuelve a intentarlo."}
          </p>
          <button type="button" onClick={reiniciar} className="btn-secondary mt-3 h-11 px-5">
            <PhoneCall className="h-4 w-4" aria-hidden="true" />
            Volver a comprobar
          </button>
        </div>
      ) : null}

      {fase === "en_curso" && consultaFallida ? (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          Hemos perdido el hilo de la comprobación. Vuelve a intentarlo en un minuto.{" "}
          <button type="button" onClick={reiniciar} className="zona-tactil rounded-[10px] font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado">
            Volver a comprobar
          </button>
        </p>
      ) : null}
    </div>
  );
}

export function CodigoFila({
  codigo,
  numero,
  copiado,
  onCopiar,
}: {
  codigo: CodigoDeDesvio;
  numero: string;
  copiado: string | null;
  onCopiar: (valor: string, id: string) => void;
}) {
  const valor = codigo.activar(numero);

  return (
    <div className="rounded-2xl border border-linea bg-superficie p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-tinta">
            {codigo.titulo}
            {codigo.recomendado ? <span className="badge-soft">Recomendado</span> : null}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">{codigo.descripcion}</p>
        </div>
        <button
          type="button"
          onClick={() => onCopiar(valor, codigo.id)}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[10px] border border-linea bg-superficie px-4 font-mono text-sm text-tinta transition duration-200 hover:border-tinta hover:bg-relleno focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
          aria-label={copiado === codigo.id ? "Código copiado" : `Copiar el código ${valor}`}
        >
          {copiado === codigo.id ? (
            <Check className="h-4 w-4 shrink-0 text-exito" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          )}
          {valor}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Para anularlo más adelante, marca{" "}
        <span className="font-mono text-tinta-2">{codigo.desactivar}</span>.
      </p>
    </div>
  );
}
