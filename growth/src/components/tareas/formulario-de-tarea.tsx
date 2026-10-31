"use client";

import { Loader2 } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { Campo, describedByDeCampo } from "@/components/comunes/d1-campo";
import { Dialogo } from "@/components/comunes/d1-dialogo";
import { AvisoDeErrorDeAccion } from "@/components/comunes/d1-aviso-de-error";
import { ETIQUETA_DE_CATEGORIA_DE_TAREA } from "@/lib/etiquetas";
import {
  CATEGORIAS_DE_TAREA,
  LARGO_MAXIMO_DE_NOTAS_DE_TAREA,
  MAXIMO_DE_PASOS_DE_TAREA,
  type AltaDeTarea,
  type CambioDeTarea,
  type Tarea,
} from "@/lib/types";
import { useAnadirTarea, useEditarTarea } from "@/lib/consultas";
import {
  pasosDeTexto,
  textoDePasos,
  validarTarea,
  type ErroresDeTarea,
  type ValoresDeTarea,
} from "./utilidades";

/**
 * El formulario de «Añadir tarea» y de «Editar tarea»: título, dirección,
 * categoría, pasos (uno por línea) y notas. Quien lo monta decide qué hacer
 * con los valores ya validados (`alEnviar`); el formulario no toca la red.
 */
function FormularioDeTarea({
  titulo,
  descripcion,
  textoDelBoton,
  inicial,
  alEnviar,
  alCerrar,
}: {
  titulo: string;
  descripcion: string;
  textoDelBoton: string;
  inicial: ValoresDeTarea;
  alEnviar: (valores: ValoresDeTarea) => Promise<void>;
  alCerrar: () => void;
}) {
  const id = useId();
  const [valores, setValores] = useState(inicial);
  const [errores, setErrores] = useState<ErroresDeTarea>({});
  const [errorDeApi, setErrorDeApi] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const enCurso = useRef(false);
  const cambiar = (campo: keyof ValoresDeTarea) => (valor: string) =>
    setValores((previo) => ({ ...previo, [campo]: valor }));
  const pasos = pasosDeTexto(valores.pasos);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (enCurso.current) return;
    const encontrados = validarTarea(valores);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;
    enCurso.current = true;
    setEnviando(true);
    setErrorDeApi(null);
    try {
      await alEnviar(valores);
      alCerrar();
    } catch (error) {
      setErrorDeApi(error);
    } finally {
      enCurso.current = false;
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      titulo={titulo}
      descripcion={descripcion}
      alCerrar={alCerrar}
      ocupado={enviando}
    >
      <form onSubmit={enviar} noValidate className="space-y-4">
        <Campo id={`${id}-titulo`} etiqueta="Título" error={errores.titulo}>
          <input
            id={`${id}-titulo`}
            data-autofocus
            type="text"
            autoComplete="off"
            value={valores.titulo}
            onChange={(e) => cambiar("titulo")(e.target.value)}
            aria-invalid={errores.titulo ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-titulo`, {
              error: errores.titulo,
            })}
            className="field w-full"
          />
        </Campo>
        <Campo
          id={`${id}-url`}
          etiqueta="Dirección"
          ayuda="La página donde se hace la tarea. Solo se enlaza si es https."
          error={errores.url}
        >
          <input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://"
            value={valores.url}
            onChange={(e) => cambiar("url")(e.target.value)}
            aria-invalid={errores.url ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-url`, {
              ayuda: true,
              error: errores.url,
            })}
            className="field w-full"
          />
        </Campo>
        <Campo id={`${id}-categoria`} etiqueta="Categoría">
          <select
            id={`${id}-categoria`}
            value={valores.categoria}
            onChange={(e) => cambiar("categoria")(e.target.value)}
            className="field w-full"
          >
            {CATEGORIAS_DE_TAREA.map((categoria) => (
              <option key={categoria} value={categoria}>
                {ETIQUETA_DE_CATEGORIA_DE_TAREA[categoria]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          id={`${id}-pasos`}
          etiqueta="Pasos"
          opcional
          ayuda={`Uno por línea. ${pasos.length} de ${MAXIMO_DE_PASOS_DE_TAREA}.`}
          error={errores.pasos}
        >
          <textarea
            id={`${id}-pasos`}
            rows={5}
            value={valores.pasos}
            onChange={(e) => cambiar("pasos")(e.target.value)}
            aria-invalid={errores.pasos ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-pasos`, {
              ayuda: true,
              error: errores.pasos,
            })}
            className="field h-auto w-full resize-y py-3"
          />
        </Campo>
        <Campo
          id={`${id}-notas`}
          etiqueta="Notas"
          opcional
          ayuda={`${valores.notas.length} de ${LARGO_MAXIMO_DE_NOTAS_DE_TAREA}.`}
          error={errores.notas}
        >
          <textarea
            id={`${id}-notas`}
            rows={3}
            value={valores.notas}
            onChange={(e) => cambiar("notas")(e.target.value)}
            aria-invalid={errores.notas ? true : undefined}
            aria-describedby={describedByDeCampo(`${id}-notas`, {
              ayuda: true,
              error: errores.notas,
            })}
            className="field h-auto w-full resize-y py-3"
          />
        </Campo>
        <AvisoDeErrorDeAccion
          error={errorDeApi}
          respaldo="No se pudo guardar la tarea. Inténtalo de nuevo."
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={alCerrar}
            disabled={enviando}
            className="btn-secondary h-11"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="btn-primary h-11"
          >
            {enviando ? (
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : null}
            {enviando ? "Guardando…" : textoDelBoton}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}

const VALORES_VACIOS: ValoresDeTarea = {
  titulo: "",
  url: "",
  categoria: "otro",
  pasos: "",
  notas: "",
};

/** «Añadir tarea»: una tarea tuya (`origen: manual`). */
export function DialogoAnadirTarea({ alCerrar }: { alCerrar: () => void }) {
  const anadir = useAnadirTarea();
  return (
    <FormularioDeTarea
      titulo="Añadir tarea"
      descripcion="Un destino que quieres gestionar a mano: un directorio, una asociación, un formulario."
      textoDelBoton="Añadir tarea"
      inicial={VALORES_VACIOS}
      alCerrar={alCerrar}
      alEnviar={async (valores) => {
        const alta: AltaDeTarea = {
          titulo: valores.titulo.trim(),
          url: valores.url.trim(),
          categoria: valores.categoria as AltaDeTarea["categoria"],
        };
        const pasos = pasosDeTexto(valores.pasos);
        if (pasos.length > 0) alta.pasos = pasos;
        if (valores.notas.trim() !== "") alta.notas = valores.notas.trim();
        await anadir.mutateAsync(alta);
      }}
    />
  );
}

/**
 * «Editar tarea»: solo se manda lo que has cambiado. Vaciar las notas las
 * borra; si cambia la dirección a otro sitio, el backend recalcula el dominio.
 */
export function DialogoEditarTarea({
  tarea,
  alCerrar,
}: {
  tarea: Tarea;
  alCerrar: () => void;
}) {
  const editar = useEditarTarea(tarea.id);
  return (
    <FormularioDeTarea
      titulo="Editar tarea"
      descripcion="Cambia lo que haga falta; el estado y el resultado no se tocan."
      textoDelBoton="Guardar"
      inicial={{
        titulo: tarea.titulo,
        url: tarea.url,
        categoria: tarea.categoria,
        pasos: textoDePasos(tarea.pasos),
        notas: tarea.notas ?? "",
      }}
      alCerrar={alCerrar}
      alEnviar={async (valores) => {
        const cambios: CambioDeTarea = {};
        if (valores.titulo.trim() !== tarea.titulo) {
          cambios.titulo = valores.titulo.trim();
        }
        if (valores.url.trim() !== tarea.url) {
          cambios.url = valores.url.trim();
        }
        if (valores.categoria !== tarea.categoria) {
          cambios.categoria = valores.categoria as CambioDeTarea["categoria"];
        }
        const pasos = pasosDeTexto(valores.pasos);
        if (pasos.join("\n") !== tarea.pasos.join("\n")) cambios.pasos = pasos;
        if (valores.notas.trim() !== (tarea.notas ?? "")) {
          cambios.notas =
            valores.notas.trim() === "" ? null : valores.notas.trim();
        }
        // Sin cambios no hay petición (el backend pediría al menos un campo).
        if (Object.keys(cambios).length === 0) return;
        await editar.mutateAsync(cambios);
      }}
    />
  );
}
