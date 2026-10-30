"use client";

import { Loader2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { AvisoDeErrorDeAccion } from "@/components/comunes/d1-aviso-de-error";
import { Campo, describedByDeCampo } from "@/components/comunes/d1-campo";
import { Dialogo } from "@/components/comunes/d1-dialogo";
import {
  ETIQUETA_DE_CANAL,
  ETIQUETA_DE_CODIGO_DE_DESCARTE,
} from "@/lib/etiquetas";
import {
  CANALES,
  type Canal,
  type CodigoDescarte,
  type Decision,
} from "@/lib/types";
import { esUrlWeb } from "@/lib/url-segura";
import type { AccionesDeRevision } from "./use-acciones-de-revision";

export const LARGO_MAXIMO_DE_MOTIVO = 500;
export const LARGO_MAXIMO_DE_NOTAS = 1_000;
export const LARGO_MAXIMO_DE_TEXTO_ENVIADO = 10_000;
/** El backend acepta fechas de hasta 30 días atrás y 5 minutos por delante. */
export const DIAS_HACIA_ATRAS = 30;
export const MINUTOS_HACIA_ADELANTE = 5;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const BOTON_DE_PELIGRO =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-peligro px-6 text-sm font-semibold text-white transition duration-200 hover:bg-peligro-hondo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

/** Los códigos que tiene sentido elegir a mano; el resto los pone el sistema. */
const CODIGOS_ELEGIBLES: readonly CodigoDescarte[] = [
  "otro",
  "irrelevante",
  "baja_calidad",
  "idioma",
  "competidor",
  "no_viva",
  "duplicada",
  "contenido_ilegal",
];

type PropiedadesComunes = {
  acciones: AccionesDeRevision;
  alCerrar: () => void;
};

/** Cancelar y confirmar: el confirmar se deshabilita mientras la acción vuela. */
function PieDeDialogo({
  ocupado,
  alCerrar,
  etiqueta,
  etiquetaOcupado,
  peligro = false,
}: {
  ocupado: boolean;
  alCerrar: () => void;
  etiqueta: string;
  etiquetaOcupado: string;
  peligro?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={alCerrar}
        disabled={ocupado}
        className="btn-secondary h-11"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={ocupado}
        className={peligro ? BOTON_DE_PELIGRO : "btn-primary h-11"}
      >
        {ocupado ? (
          <Loader2
            className="h-4 w-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        {ocupado ? etiquetaOcupado : etiqueta}
      </button>
    </div>
  );
}

/** Lanza la decisión y cierra el diálogo solo si el backend la aceptó. */
async function enviarDecision(
  acciones: AccionesDeRevision,
  decision: Decision,
  alCerrar: () => void
) {
  if (await acciones.decidir(decision)) alCerrar();
}

// ---------------------------------------------------------------------------
// Devolver con nota
// ---------------------------------------------------------------------------

export function DialogoDeDevolver({ acciones, alCerrar }: PropiedadesComunes) {
  const id = useId();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (acciones.ocupado) return;
    const texto = motivo.trim();
    if (texto === "") return setError("Escribe qué hay que cambiar.");
    if (texto.length > LARGO_MAXIMO_DE_MOTIVO)
      return setError(
        `La nota no puede pasar de ${LARGO_MAXIMO_DE_MOTIVO} caracteres.`
      );
    setError(null);
    void enviarDecision(
      acciones,
      { accion: "devolver", motivo: texto },
      alCerrar
    );
  }

  return (
    <Dialogo
      titulo="Devolver con nota"
      descripcion="El agente leerá tu nota en su próxima ejecución y preparará otra versión."
      alCerrar={alCerrar}
      ocupado={acciones.ocupado}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <Campo
          id={`${id}-motivo`}
          etiqueta="Qué hay que cambiar"
          ayuda={`${motivo.length} de ${LARGO_MAXIMO_DE_MOTIVO}`}
          error={error}
        >
          <textarea
            id={`${id}-motivo`}
            data-autofocus
            rows={4}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-motivo`, {
              ayuda: true,
              error,
            })}
            className="field h-auto w-full resize-y py-3"
          />
        </Campo>
        <AvisoDeErrorDeAccion
          error={acciones.errorDeDecision}
          respaldo="No se pudo devolver. Inténtalo de nuevo."
        />
        <PieDeDialogo
          ocupado={acciones.ocupado}
          alCerrar={alCerrar}
          etiqueta="Devolver"
          etiquetaOcupado="Devolviendo…"
        />
      </form>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------
// Descartar
// ---------------------------------------------------------------------------

export function DialogoDeDescartar({ acciones, alCerrar }: PropiedadesComunes) {
  const id = useId();
  const [motivo, setMotivo] = useState("");
  const [codigo, setCodigo] = useState<CodigoDescarte>("otro");
  const [error, setError] = useState<string | null>(null);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (acciones.ocupado) return;
    const texto = motivo.trim();
    if (texto === "") return setError("Escribe por qué la descartas.");
    if (texto.length > LARGO_MAXIMO_DE_MOTIVO)
      return setError(
        `El motivo no puede pasar de ${LARGO_MAXIMO_DE_MOTIVO} caracteres.`
      );
    setError(null);
    void enviarDecision(
      acciones,
      { accion: "descartar", motivo: texto, codigo },
      alCerrar
    );
  }

  return (
    <Dialogo
      titulo="Descartar"
      descripcion="La oportunidad se cierra y sus borradores se descartan. El motivo ayuda a calibrar al agente."
      alCerrar={alCerrar}
      ocupado={acciones.ocupado}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <Campo
          id={`${id}-motivo`}
          etiqueta="Motivo"
          ayuda={`${motivo.length} de ${LARGO_MAXIMO_DE_MOTIVO}`}
          error={error}
        >
          <textarea
            id={`${id}-motivo`}
            data-autofocus
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-motivo`, {
              ayuda: true,
              error,
            })}
            className="field h-auto w-full resize-y py-3"
          />
        </Campo>
        <Campo id={`${id}-codigo`} etiqueta="Tipo de motivo">
          <select
            id={`${id}-codigo`}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value as CodigoDescarte)}
            className="field w-full"
          >
            {CODIGOS_ELEGIBLES.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_DE_CODIGO_DE_DESCARTE[c]}
              </option>
            ))}
          </select>
        </Campo>
        <AvisoDeErrorDeAccion
          error={acciones.errorDeDecision}
          respaldo="No se pudo descartar. Inténtalo de nuevo."
        />
        <PieDeDialogo
          ocupado={acciones.ocupado}
          alCerrar={alCerrar}
          etiqueta="Descartar"
          etiquetaOcupado="Descartando…"
          peligro
        />
      </form>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------
// Marcar como gestionado
// ---------------------------------------------------------------------------

/** `2026-10-30T09:15` en hora local, el formato de `<input type="datetime-local">`. */
export function aValorLocal(instante: number): string {
  const fecha = new Date(instante);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

type ErroresDeGestion = {
  canal?: string;
  fecha?: string;
  textoFinal?: string;
  notas?: string;
};

/**
 * Valida el formulario de «Marcar como gestionado». El canal y la fecha son
 * obligatorios (la fecha alimenta la regla de un contacto por dominio cada 90
 * días: una errata dejaría pasar un segundo contacto).
 */
export function validarGestion(
  entrada: {
    canal: Canal | null;
    fecha: string;
    textoFinal: string;
    notas: string;
  },
  ahora: number
): ErroresDeGestion {
  const errores: ErroresDeGestion = {};
  if (entrada.canal === null)
    errores.canal = "Elige por qué canal lo enviaste.";
  if (entrada.fecha.trim() === "") {
    errores.fecha = "Indica cuándo lo hiciste.";
  } else {
    const instante = Date.parse(entrada.fecha);
    if (Number.isNaN(instante)) errores.fecha = "La fecha no es válida.";
    else if (instante > ahora + MINUTOS_HACIA_ADELANTE * 60_000)
      errores.fecha = "La fecha no puede estar en el futuro.";
    else if (instante < ahora - DIAS_HACIA_ATRAS * MS_POR_DIA)
      errores.fecha = `Solo se aceptan fechas de los últimos ${DIAS_HACIA_ATRAS} días.`;
  }
  if (entrada.textoFinal.length > LARGO_MAXIMO_DE_TEXTO_ENVIADO) {
    errores.textoFinal = `El texto no puede pasar de ${LARGO_MAXIMO_DE_TEXTO_ENVIADO} caracteres.`;
  }
  if (entrada.notas.length > LARGO_MAXIMO_DE_NOTAS) {
    errores.notas = `Las notas no pueden pasar de ${LARGO_MAXIMO_DE_NOTAS} caracteres.`;
  }
  return errores;
}

export function DialogoDeGestionado({
  acciones,
  alCerrar,
}: PropiedadesComunes) {
  const id = useId();
  const [canal, setCanal] = useState<Canal | null>(null);
  const [fecha, setFecha] = useState(() => aValorLocal(Date.now()));
  const [textoFinal, setTextoFinal] = useState("");
  const [notas, setNotas] = useState("");
  const [errores, setErrores] = useState<ErroresDeGestion>({});
  // Los límites del selector de fecha, fijados al abrir.
  const [limites] = useState(() => ({
    minimo: aValorLocal(Date.now() - DIAS_HACIA_ATRAS * MS_POR_DIA),
    maximo: aValorLocal(Date.now() + MINUTOS_HACIA_ADELANTE * 60_000),
  }));

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (acciones.ocupado) return;
    const encontrados = validarGestion(
      { canal, fecha, textoFinal, notas },
      Date.now()
    );
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0 || canal === null) return;
    void enviarDecision(
      acciones,
      {
        accion: "marcar_gestionado",
        canal,
        hechaEn: new Date(fecha).toISOString(),
        ...(textoFinal.trim() ? { textoFinal: textoFinal.trim() } : {}),
        ...(notas.trim() ? { notas: notas.trim() } : {}),
      },
      alCerrar
    );
  }

  return (
    <Dialogo
      titulo="Marcar como gestionado"
      descripcion="Registra que ya has contactado con el destino. Cuenta para el tope semanal y para el enfriamiento de 90 días del dominio."
      alCerrar={alCerrar}
      ocupado={acciones.ocupado}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <fieldset
          aria-describedby={errores.canal ? `${id}-canal-error` : undefined}
        >
          <legend className="mb-1.5 text-sm font-semibold text-tinta">
            Canal
          </legend>
          <div className="flex flex-wrap gap-2">
            {CANALES.map((opcion) => {
              const idOpcion = `${id}-canal-${opcion}`;
              return (
                <div key={opcion}>
                  <input
                    id={idOpcion}
                    type="radio"
                    name={`${id}-canal`}
                    className="peer sr-only"
                    checked={canal === opcion}
                    onChange={() => setCanal(opcion)}
                  />
                  <label
                    htmlFor={idOpcion}
                    className="flex min-h-11 cursor-pointer items-center rounded-full border border-linea bg-superficie px-4 text-sm font-semibold text-tinta-3 transition duration-150 hover:bg-relleno peer-checked:border-lavado-borde peer-checked:bg-lavado peer-checked:text-morado-tinta peer-focus-visible:ring-2 peer-focus-visible:ring-morado"
                  >
                    {ETIQUETA_DE_CANAL[opcion]}
                  </label>
                </div>
              );
            })}
          </div>
          {errores.canal ? (
            <p
              id={`${id}-canal-error`}
              role="alert"
              className="mt-1.5 text-xs font-semibold text-error"
            >
              {errores.canal}
            </p>
          ) : null}
        </fieldset>
        <Campo
          id={`${id}-fecha`}
          etiqueta="Cuándo lo hiciste"
          error={errores.fecha}
        >
          <input
            id={`${id}-fecha`}
            type="datetime-local"
            min={limites.minimo}
            max={limites.maximo}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            aria-invalid={errores.fecha ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-fecha`, {
              error: errores.fecha,
            })}
            className="field w-full"
          />
        </Campo>
        <Campo
          id={`${id}-texto`}
          etiqueta="Texto que de verdad enviaste"
          opcional
          ayuda="Solo si lo cambiaste respecto al texto aprobado. Si lo enviaste tal cual, déjalo vacío."
          error={errores.textoFinal}
        >
          <textarea
            id={`${id}-texto`}
            rows={4}
            value={textoFinal}
            onChange={(e) => setTextoFinal(e.target.value)}
            aria-invalid={errores.textoFinal ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-texto`, {
              ayuda: true,
              error: errores.textoFinal,
            })}
            className="field h-auto w-full resize-y py-3"
          />
        </Campo>
        <Campo
          id={`${id}-notas`}
          etiqueta="Notas"
          opcional
          error={errores.notas}
        >
          <textarea
            id={`${id}-notas`}
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            aria-invalid={errores.notas ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-notas`, {
              error: errores.notas,
            })}
            className="field h-auto w-full resize-y py-3"
          />
        </Campo>
        <AvisoDeErrorDeAccion
          error={acciones.errorDeDecision}
          respaldo="No se pudo registrar. Inténtalo de nuevo."
        />
        <PieDeDialogo
          ocupado={acciones.ocupado}
          alCerrar={alCerrar}
          etiqueta="Marcar como gestionado"
          etiquetaOcupado="Registrando…"
        />
      </form>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------
// Enlace conseguido
// ---------------------------------------------------------------------------

export function DialogoDeConseguido({
  acciones,
  alCerrar,
}: PropiedadesComunes) {
  const id = useId();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (acciones.ocupado) return;
    const limpia = url.trim();
    if (limpia === "")
      return setError("Pega la dirección donde está el enlace.");
    if (limpia.length > 2000)
      return setError("La dirección no puede pasar de 2000 caracteres.");
    if (!esUrlWeb(limpia))
      return setError(
        "Escribe una dirección web completa, que empiece por http:// o https://."
      );
    setError(null);
    void enviarDecision(
      acciones,
      { accion: "conseguido", urlConseguida: limpia },
      alCerrar
    );
  }

  return (
    <Dialogo
      titulo="Enlace conseguido"
      descripcion="Pega la página donde ha aparecido el enlace a Alhabla."
      alCerrar={alCerrar}
      ocupado={acciones.ocupado}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <Campo id={`${id}-url`} etiqueta="Dirección de la página" error={error}>
          <input
            id={`${id}-url`}
            data-autofocus
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-url`, { error })}
            className="field w-full"
          />
        </Campo>
        <AvisoDeErrorDeAccion
          error={acciones.errorDeDecision}
          respaldo="No se pudo registrar el enlace. Inténtalo de nuevo."
        />
        <PieDeDialogo
          ocupado={acciones.ocupado}
          alCerrar={alCerrar}
          etiqueta="Registrar el enlace"
          etiquetaOcupado="Registrando…"
        />
      </form>
    </Dialogo>
  );
}

// ---------------------------------------------------------------------------
// Cerrada sin éxito: sin respuesta o rechazo del destino
// ---------------------------------------------------------------------------

export function DialogoDeCierre({
  acciones,
  alCerrar,
  tipo,
}: PropiedadesComunes & { tipo: "sin_respuesta" | "rechazado" }) {
  const id = useId();
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rechazo = tipo === "rechazado";

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (acciones.ocupado) return;
    if (notas.length > LARGO_MAXIMO_DE_NOTAS)
      return setError(
        `Las notas no pueden pasar de ${LARGO_MAXIMO_DE_NOTAS} caracteres.`
      );
    setError(null);
    void enviarDecision(
      acciones,
      { accion: tipo, ...(notas.trim() ? { notas: notas.trim() } : {}) },
      alCerrar
    );
  }

  return (
    <Dialogo
      titulo={rechazo ? "El destino ha dicho que no" : "Cerrar sin respuesta"}
      descripcion={
        rechazo
          ? "La oportunidad pasa a «Cerrada sin éxito» y la gestión queda como rechazada."
          : "La oportunidad pasa a «Cerrada sin éxito» y la gestión queda como sin respuesta."
      }
      alCerrar={alCerrar}
      ocupado={acciones.ocupado}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <Campo id={`${id}-notas`} etiqueta="Notas" opcional error={error}>
          <textarea
            id={`${id}-notas`}
            data-autofocus
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-notas`, { error })}
            className="field h-auto w-full resize-y py-3"
          />
        </Campo>
        <AvisoDeErrorDeAccion
          error={acciones.errorDeDecision}
          respaldo="No se pudo registrar. Inténtalo de nuevo."
        />
        <PieDeDialogo
          ocupado={acciones.ocupado}
          alCerrar={alCerrar}
          etiqueta={rechazo ? "Registrar el rechazo" : "Cerrar sin respuesta"}
          etiquetaOcupado="Registrando…"
        />
      </form>
    </Dialogo>
  );
}
