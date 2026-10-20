"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Check, Copy } from "lucide-react";

/**
 * Tarjetas de códigos de desvío de las guías de /desvio-de-llamadas, con
 * botón de copiar y un campo opcional para escribir el número de Alhabla.
 *
 * Por qué así: el código que de verdad sirve es el que lleva el número de
 * destino dentro (`**61*600000000#`); copiar `**61*N#` no ayuda a nadie. Si
 * el visitante escribe su número, todos los códigos de la página salen ya
 * completos. El número no sale del navegador: ni se envía ni se guarda.
 *
 * En los códigos, `{N}` es el número de destino y `{T}` los segundos de
 * espera (solo en las filas que traen `segundos`). Sin número escrito, el
 * marcador se pinta como «número», que es como lo escriben los operadores.
 */

const MARCA_NUMERO = "{N}";
const MARCA_SEGUNDOS = "{T}";

type ContextoDelNumero = {
  /** Las 9 cifras ya limpias, o "" si aún no hay un número válido. */
  numero: string;
  campo: RefObject<HTMLInputElement | null> | null;
};

const NumeroDeAlhabla = createContext<ContextoDelNumero>({
  numero: "",
  campo: null,
});

const ContextoDelCampo = createContext<{
  valor: string;
  cambiar: (v: string) => void;
  campo: RefObject<HTMLInputElement | null>;
} | null>(null);

/** Deja solo las cifras y quita el prefijo de España: los operadores dan
 * sus ejemplos con las 9 cifras, sin +34 (3GPP lo admite, pero ninguno lo
 * documenta para el desvío). */
export function limpiarNumero(texto: string): string {
  let cifras = texto.replace(/\D/g, "");
  if (cifras.startsWith("0034")) cifras = cifras.slice(4);
  else if (cifras.length === 11 && cifras.startsWith("34"))
    cifras = cifras.slice(2);
  return cifras;
}

function esNumeroEspanol(cifras: string) {
  return /^[6-9]\d{8}$/.test(cifras);
}

/** Envuelve la página: todas las tarjetas de dentro comparten el número. */
export function ConNumeroDeAlhabla({ children }: { children: ReactNode }) {
  const [valor, setValor] = useState("");
  const campo = useRef<HTMLInputElement | null>(null);
  const cifras = limpiarNumero(valor);
  const numero = esNumeroEspanol(cifras) ? cifras : "";
  return (
    <ContextoDelCampo.Provider value={{ valor, cambiar: setValor, campo }}>
      <NumeroDeAlhabla.Provider value={{ numero, campo }}>
        {children}
      </NumeroDeAlhabla.Provider>
    </ContextoDelCampo.Provider>
  );
}

/** El campo del número. Va una vez por página, encima de la primera tarjeta. */
export function CampoNumeroDeAlhabla({ ayuda }: { ayuda?: ReactNode }) {
  const contexto = useContext(ContextoDelCampo);
  const id = useId();
  if (!contexto) return null;
  const { valor, cambiar, campo } = contexto;
  const cifras = limpiarNumero(valor);
  const incompleto = cifras.length > 0 && !esNumeroEspanol(cifras);
  return (
    <div className="panel p-5 sm:p-6">
      <label
        htmlFor={`${id}-numero`}
        className="text-sm font-semibold text-tinta"
      >
        Tu número de Alhabla
      </label>
      <div className="mt-1 text-sm leading-6 text-muted" id={`${id}-ayuda`}>
        {ayuda ??
          "Escríbelo y los códigos de esta página saldrán con él, listos para copiar. Se queda en tu navegador: no se envía a ningún sitio."}
      </div>
      <input
        ref={campo}
        id={`${id}-numero`}
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Las 9 cifras, sin espacios"
        value={valor}
        onChange={(e) => cambiar(e.target.value)}
        aria-describedby={`${id}-ayuda${incompleto ? ` ${id}-error` : ""}`}
        aria-invalid={incompleto || undefined}
        className="field mt-3 w-full max-w-xs font-mono"
      />
      {incompleto ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-aviso">
          Un número español tiene 9 cifras y empieza por 6, 7, 8 o 9.
        </p>
      ) : null}
    </div>
  );
}

export type FilaDeCodigos = {
  /** El tipo de desvío, con las palabras del operador. */
  tipo: string;
  detalle?: ReactNode;
  recomendado?: boolean;
  activar?: string;
  quitar?: string;
  consultar?: string;
  /** Segundos de espera que admite el operador; sustituyen a `{T}`. */
  segundos?: { opciones: number[]; inicial: number };
};

type Accion = {
  clave: "activar" | "quitar" | "consultar";
  etiqueta: string;
  codigo: string;
};

function completar(
  codigo: string,
  numero: string,
  segundos: number | undefined
) {
  let texto = codigo;
  if (segundos !== undefined)
    texto = texto.split(MARCA_SEGUNDOS).join(String(segundos));
  return numero ? texto.split(MARCA_NUMERO).join(numero) : texto;
}

/** El código tal cual se marca, con «número» en cursiva si falta. */
function CodigoPintado({ codigo, numero }: { codigo: string; numero: string }) {
  const trozos = codigo.split(MARCA_NUMERO);
  return (
    <code className="break-all font-mono text-sm font-semibold text-tinta">
      {trozos.map((trozo, i) => (
        <span key={i}>
          {trozo}
          {i < trozos.length - 1 ? (
            numero ? (
              numero
            ) : (
              <span className="font-sans font-medium italic text-morado-tinta">
                número
              </span>
            )
          ) : null}
        </span>
      ))}
    </code>
  );
}

async function copiarAlPortapapeles(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Safari antiguo o un iframe sin permiso: el truco del textarea.
    try {
      const area = document.createElement("textarea");
      area.value = texto;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export function TablaDeCodigos({
  titulo,
  subtitulo,
  filas,
  nota,
  etiquetas,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  filas: FilaDeCodigos[];
  nota?: ReactNode;
  /** Cómo llama el operador a cada acción; por defecto Activar, Quitar, Comprobar. */
  etiquetas?: Partial<Record<Accion["clave"], string>>;
}) {
  const { numero, campo } = useContext(NumeroDeAlhabla);
  const id = useId();
  const [segundos, setSegundos] = useState<Record<number, number>>(() =>
    Object.fromEntries(
      filas.flatMap((f, i) => (f.segundos ? [[i, f.segundos.inicial]] : []))
    )
  );
  const [copiado, setCopiado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    []
  );

  async function copiar(clave: string, codigo: string, i: number) {
    if (codigo.includes(MARCA_NUMERO) && !numero) {
      setAviso(
        "Escribe primero tu número de Alhabla para copiar el código completo."
      );
      campo?.current?.focus();
      return;
    }
    const texto = completar(codigo, numero, segundos[i]);
    const ok = await copiarAlPortapapeles(texto);
    setAviso(
      ok
        ? `Copiado: ${texto}`
        : `No se ha podido copiar. Márcalo a mano: ${texto}`
    );
    if (ok) {
      setCopiado(clave);
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setCopiado(null), 2000);
    }
  }

  const nombres = {
    activar: "Activar",
    quitar: "Quitar",
    consultar: "Comprobar",
    ...etiquetas,
  };

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-linea px-5 py-4 sm:px-6">
        <h3 className="text-lg font-bold text-tinta">{titulo}</h3>
        {subtitulo ? (
          <div className="mt-1 text-sm leading-6 text-muted">{subtitulo}</div>
        ) : null}
      </div>
      <ul className="divide-y divide-linea-suave">
        {filas.map((fila, i) => {
          const acciones = (["activar", "quitar", "consultar"] as const)
            .filter((clave) => fila[clave])
            .map((clave): Accion => ({
              clave,
              etiqueta: nombres[clave],
              codigo: fila[clave] as string,
            }));
          return (
            <li
              key={fila.tipo}
              className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,15rem)_1fr] lg:gap-6"
            >
              <div>
                <p className="flex flex-wrap items-center gap-2 font-semibold text-tinta">
                  {fila.tipo}
                  {fila.recomendado ? (
                    <span className="badge-soft">Recomendado</span>
                  ) : null}
                </p>
                {fila.detalle ? (
                  <div className="mt-1 text-sm leading-6 text-muted">
                    {fila.detalle}
                  </div>
                ) : null}
                {fila.segundos ? (
                  <label className="mt-2 flex items-center gap-2 text-sm text-apagado">
                    Segundos de espera
                    <select
                      value={segundos[i]}
                      onChange={(e) =>
                        setSegundos((s) => ({
                          ...s,
                          [i]: Number(e.target.value),
                        }))
                      }
                      className="field h-9 w-20 px-2"
                    >
                      {fila.segundos.opciones.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <dl className="grid gap-2 sm:grid-cols-3">
                {acciones.map(({ clave, etiqueta, codigo }) => {
                  const marca = `${i}-${clave}`;
                  const completo = completar(codigo, numero, segundos[i]);
                  return (
                    <div
                      key={clave}
                      className="rounded-2xl border border-linea bg-relleno px-3 py-2"
                    >
                      <dt className="text-xs font-medium text-muted">
                        {etiqueta}
                      </dt>
                      <dd className="mt-1 flex items-center justify-between gap-2">
                        <CodigoPintado
                          codigo={completar(codigo, "", segundos[i])}
                          numero={numero}
                        />
                        <button
                          type="button"
                          onClick={() => copiar(marca, codigo, i)}
                          aria-label={
                            codigo.includes(MARCA_NUMERO) && !numero
                              ? `Copiar el código para ${etiqueta.toLowerCase()} (${fila.tipo}): falta tu número`
                              : `Copiar ${completo}`
                          }
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-linea bg-superficie text-apagado transition hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
                        >
                          {copiado === marca ? (
                            <Check
                              className="h-4 w-4 text-exito"
                              aria-hidden="true"
                            />
                          ) : (
                            <Copy className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </li>
          );
        })}
      </ul>
      {nota ? (
        <div className="border-t border-linea px-5 py-3 text-xs leading-5 text-muted sm:px-6">
          {nota}
        </div>
      ) : null}
      <p
        id={`${id}-aviso`}
        aria-live="polite"
        role="status"
        className="sr-only"
      >
        {aviso}
      </p>
    </div>
  );
}
