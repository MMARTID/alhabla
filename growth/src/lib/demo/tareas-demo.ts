import { ErrorDeCliente } from "../api-errors";
import {
  CATEGORIAS_DE_TAREA,
  LARGO_MAXIMO_DE_NOTAS_DE_TAREA,
  LARGO_MAXIMO_DE_NOTA_DE_RESULTADO_DE_TAREA,
  LARGO_MAXIMO_DE_PASO_DE_TAREA,
  LARGO_MAXIMO_DE_TITULO_DE_TAREA,
  LARGO_MAXIMO_DE_URL_DE_TAREA,
  MAXIMO_DE_PASOS_DE_TAREA,
  RESULTADOS_DE_TAREA,
  type AltaDeTarea,
  type CambioDeTarea,
  type CategoriaDeTarea,
  type DescarteDeTarea,
  type MarcaDeTareaHecha,
  type ResultadoDeTarea,
  type Tarea,
} from "../types";
import { urlSegura } from "../url-segura";
import type { AlmacenDeDemostracion, RegistroDeTarea } from "./datos";
import { dominioDe } from "./urls-demo";

/**
 * Las tareas a mano de la demostración: la misma lógica que el backend para
 * la siembra perezosa e idempotente, las transiciones (pendiente → hecha →
 * reabrir, descartar) y los errores `400`/`404`/`409` con su `codigo`.
 * `tests/lib/paridad-de-tareas.test.ts` lee el backend y falla si se separan
 * las constantes, los topes, las rutas, los códigos o las tareas iniciales.
 */

/** El código de error que el backend manda al borrar una tarea del repositorio. */
export const CODIGOS_DE_ERROR_DE_TAREAS = ["tarea_del_repositorio"] as const;

type TareaInicial = {
  /** Identidad estable (`growth_tareas.siembra`): editar el dominio no la duplica. */
  siembra: string;
  titulo: string;
  dominio: string;
  url: string;
  categoria: CategoriaDeTarea;
  notas?: string;
  /** Solo la que ya se hizo antes de que existiera el panel. */
  hecha?: { resultado: ResultadoDeTarea; hechaEn: string; nota: string };
};

/** Los pasos genéricos de un alta: honestos, sin prometer una ruta no confirmada. */
export const PASOS_GENERICOS_DE_UNA_TAREA: readonly string[] = [
  "Abre la página.",
  "Busca «para proveedores», «añadir producto» o «sugerir herramienta».",
  "Pega la Ficha de Alhabla de esta página, campo a campo.",
  "Anota aquí si el alta es gratuita y si pide verificación.",
];

/**
 * Las tareas con las que arranca el panel (`origen: repo`), copia de
 * `backend/src/modules/growth/tareasIniciales.ts`. Lo que consta en las notas
 * se leyó por búsqueda y está SIN CONFIRMAR.
 */
export const TAREAS_INICIALES: readonly TareaInicial[] = [
  {
    siembra: "capterra",
    titulo: "Capterra (también GetApp y Software Advice)",
    dominio: "capterra.com",
    url: "https://www.capterra.com/",
    categoria: "directorio_software",
    notas:
      "Por búsqueda, sin confirmar: una sola alta de proveedor serviría para los tres (digital-markets.gartner.com/capterra-vendor-signup). El agente recibe 403.",
  },
  {
    siembra: "g2",
    titulo: "G2",
    dominio: "g2.com",
    url: "https://www.g2.com/",
    categoria: "directorio_software",
    notas:
      "Por búsqueda, sin confirmar: perfil gratuito en sell.g2.com/create-free-profile. El agente recibe 403.",
  },
  {
    siembra: "sourceforge",
    titulo: "SourceForge",
    dominio: "sourceforge.net",
    url: "https://sourceforge.net/",
    categoria: "directorio_software",
    notas: "Alta en /software/vendors/new; coste no publicado.",
  },
  {
    siembra: "softwaredoit",
    titulo: "SoftwareDoit.es",
    dominio: "softwaredoit.es",
    url: "https://softwaredoit.es/",
    categoria: "directorio_software",
    notas: "Formulario de Notion; coste sin indicar. Es español.",
  },
  {
    siembra: "alternativeto",
    titulo: "AlternativeTo",
    dominio: "alternativeto.net",
    url: "https://alternativeto.net/",
    categoria: "directorio_software",
    notas: "Solo se localizó registro de usuario.",
  },
  {
    siembra: "selecthub",
    titulo: "SelectHub",
    dominio: "selecthub.com",
    url: "https://www.selecthub.com/",
    categoria: "directorio_software",
  },
  {
    siembra: "stork",
    titulo: "Stork",
    dominio: "stork.ai",
    url: "https://www.stork.ai/",
    categoria: "directorio_ia",
  },
  {
    siembra: "aiagentsdirectory",
    titulo: "AI Agents Directory",
    dominio: "aiagentsdirectory.com",
    url: "https://aiagentsdirectory.com/",
    categoria: "directorio_ia",
  },
  {
    siembra: "toolradar",
    titulo: "Toolradar",
    dominio: "toolradar.com",
    url: "https://toolradar.com/",
    categoria: "directorio_ia",
  },
  {
    siembra: "topai-tools",
    titulo: "topai.tools",
    dominio: "topai.tools",
    url: "https://topai.tools/",
    categoria: "directorio_ia",
  },
  {
    siembra: "beautymarket",
    titulo: "Beautymarket",
    dominio: "beautymarket.es",
    url: "https://beautymarket.es/",
    categoria: "sector",
    hecha: {
      resultado: "en_revision",
      hechaEn: "2026-10-31T12:00:00.000Z",
      nota: "Ficha enviada por el fundador el 31-10-2026.",
    },
  },
];

/** Separación entre las `orden` de las sembradas: deja hueco para intercalar a mano. */
export const SEPARACION_DE_ORDEN = 10;

const MENSAJE_DE_URL =
  "La URL debe ser http o https y sin usuario ni contraseña.";

export type DependenciasDeTareas = {
  almacen: AlmacenDeDemostracion;
  ahoraIso: () => string;
  nuevoId: (prefijo: string) => string;
};

function tituloValido(valor: string): string {
  const titulo = valor.trim();
  if (titulo === "") {
    throw new ErrorDeCliente(400, "El título no puede estar vacío.");
  }
  if (titulo.length > LARGO_MAXIMO_DE_TITULO_DE_TAREA) {
    throw new ErrorDeCliente(
      400,
      `El título no puede pasar de ${LARGO_MAXIMO_DE_TITULO_DE_TAREA} caracteres.`
    );
  }
  return titulo;
}

function urlValida(valor: string): string {
  const texto = valor.trim();
  if (texto === "") {
    throw new ErrorDeCliente(400, "Escribe la dirección web de la tarea.");
  }
  if (texto.length > LARGO_MAXIMO_DE_URL_DE_TAREA) {
    throw new ErrorDeCliente(
      400,
      `La dirección no puede pasar de ${LARGO_MAXIMO_DE_URL_DE_TAREA} caracteres.`
    );
  }
  const segura = urlSegura(texto);
  if (!segura) throw new ErrorDeCliente(400, MENSAJE_DE_URL);
  const url = new URL(segura);
  if (url.username !== "" || url.password !== "") {
    throw new ErrorDeCliente(400, MENSAJE_DE_URL);
  }
  // Se guarda tal cual la escribiste, sin quitar `utm_`, `ref` ni el ancla:
  // pueden ser parte del enlace de alta.
  return texto;
}

function categoriaValida(valor: string): CategoriaDeTarea {
  if (!(CATEGORIAS_DE_TAREA as readonly string[]).includes(valor)) {
    throw new ErrorDeCliente(400, "La categoría no es una de las conocidas.");
  }
  return valor as CategoriaDeTarea;
}

function pasosValidos(valor: readonly string[]): string[] {
  if (valor.length > MAXIMO_DE_PASOS_DE_TAREA) {
    throw new ErrorDeCliente(
      400,
      `Una tarea no puede tener más de ${MAXIMO_DE_PASOS_DE_TAREA} pasos.`
    );
  }
  return valor.map((paso) => {
    const limpio = paso.trim();
    if (limpio === "") {
      throw new ErrorDeCliente(400, "Un paso no puede estar vacío.");
    }
    if (limpio.length > LARGO_MAXIMO_DE_PASO_DE_TAREA) {
      throw new ErrorDeCliente(
        400,
        `Un paso no puede pasar de ${LARGO_MAXIMO_DE_PASO_DE_TAREA} caracteres.`
      );
    }
    return limpio;
  });
}

function notasValidas(valor: string): string | null {
  const notas = valor.trim();
  if (notas.length > LARGO_MAXIMO_DE_NOTAS_DE_TAREA) {
    throw new ErrorDeCliente(
      400,
      `Las notas no pueden pasar de ${LARGO_MAXIMO_DE_NOTAS_DE_TAREA} caracteres.`
    );
  }
  return notas === "" ? null : notas;
}

function notaDeResultadoValida(
  valor: string | null | undefined
): string | null {
  if (valor === undefined || valor === null) return null;
  const nota = valor.trim();
  if (nota.length > LARGO_MAXIMO_DE_NOTA_DE_RESULTADO_DE_TAREA) {
    throw new ErrorDeCliente(
      400,
      `La nota no puede pasar de ${LARGO_MAXIMO_DE_NOTA_DE_RESULTADO_DE_TAREA} caracteres.`
    );
  }
  return nota === "" ? null : nota;
}

function resultadoValido(
  valor: string | null | undefined
): ResultadoDeTarea | null {
  if (valor === undefined || valor === null) return null;
  if (!(RESULTADOS_DE_TAREA as readonly string[]).includes(valor)) {
    throw new ErrorDeCliente(400, "El resultado no es uno de los conocidos.");
  }
  return valor as ResultadoDeTarea;
}

const HOST =
  /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** El dominio como lo valida el backend: minúsculas, sin `www.`, un host con punto. */
function dominioNormalizado(valor: string): string {
  const dominio = valor
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  if (dominio.length > 253 || !HOST.test(dominio)) {
    throw new ErrorDeCliente(
      400,
      "Indica solo el dominio (por ejemplo, ejemplo.com)."
    );
  }
  return dominio;
}

const ORDEN_DE_ESTADO: Record<Tarea["estado"], number> = {
  pendiente: 0,
  hecha: 1,
  descartada: 2,
};

const COLACION = new Intl.Collator("es", { sensitivity: "base" });

/** ¿Es `url` del sitio `dominio` (o de un subdominio suyo)? */
function urlEsDelDominio(url: string, dominio: string | null): boolean {
  if (!dominio) return false;
  const host = dominioDe(url);
  return host === dominio || host.endsWith(`.${dominio}`);
}

export function crearTareasDeDemostracion(deps: DependenciasDeTareas) {
  const { almacen, ahoraIso, nuevoId } = deps;

  function obligatoria(id: string): RegistroDeTarea {
    const encontrada = almacen.tareas.find((t) => t.id === id);
    if (!encontrada) throw new ErrorDeCliente(404, "La tarea no existe.");
    return encontrada;
  }

  /** La tarea como la devuelve la API: sin la identidad interna de la siembra. */
  function aTarea(registro: RegistroDeTarea): Tarea {
    const { siembra: _siembra, ...tarea } = registro;
    void _siembra;
    return { ...tarea, pasos: [...tarea.pasos] };
  }

  /**
   * Siembra las iniciales que falten, sin pisar las que ya estén (aunque las
   * hayas descartado o editado): la clave es `siembra`, que no cambia aunque
   * edites el dominio. Pedirla dos veces no duplica nada.
   */
  function sembrar(): void {
    TAREAS_INICIALES.forEach((inicial, indice) => {
      if (almacen.tareas.some((t) => t.siembra === inicial.siembra)) return;
      almacen.tareas.push({
        id: nuevoId("tarea"),
        siembra: inicial.siembra,
        titulo: inicial.titulo,
        dominio: inicial.dominio,
        url: inicial.url,
        categoria: inicial.categoria,
        pasos: [...PASOS_GENERICOS_DE_UNA_TAREA],
        notas: inicial.notas ?? null,
        origen: "repo",
        estado: inicial.hecha ? "hecha" : "pendiente",
        resultado: inicial.hecha?.resultado ?? null,
        notaDeResultado: inicial.hecha?.nota ?? null,
        hechaEn: inicial.hecha?.hechaEn ?? null,
        creadoEn: ahoraIso(),
        orden: (indice + 1) * SEPARACION_DE_ORDEN,
      });
    });
  }

  function listar(): Tarea[] {
    sembrar();
    return [...almacen.tareas]
      .sort(
        (a, b) =>
          ORDEN_DE_ESTADO[a.estado] - ORDEN_DE_ESTADO[b.estado] ||
          a.orden - b.orden ||
          COLACION.compare(a.titulo, b.titulo) ||
          a.id.localeCompare(b.id)
      )
      .map(aTarea);
  }

  function anadir(alta: AltaDeTarea): Tarea {
    // Primero lo que valida el esquema (Zod en el backend), luego el servicio.
    const titulo = tituloValido(alta.titulo);
    const url = urlValida(alta.url);
    const categoria =
      alta.categoria !== undefined ? categoriaValida(alta.categoria) : "otro";
    const pasos = alta.pasos !== undefined ? pasosValidos(alta.pasos) : [];
    const notas =
      alta.notas !== undefined && alta.notas !== null
        ? notasValidas(alta.notas)
        : null;
    const dominio =
      alta.dominio !== undefined && alta.dominio !== null && alta.dominio !== ""
        ? dominioNormalizado(alta.dominio)
        : dominioDe(url);
    const nueva: RegistroDeTarea = {
      id: nuevoId("tarea"),
      siembra: null,
      titulo,
      dominio,
      url,
      categoria,
      pasos,
      notas,
      origen: "manual",
      estado: "pendiente",
      resultado: null,
      notaDeResultado: null,
      hechaEn: null,
      creadoEn: ahoraIso(),
      orden: 0,
    };
    almacen.tareas.push(nueva);
    return aTarea(nueva);
  }

  function editar(id: string, cambios: CambioDeTarea): Tarea {
    const t = obligatoria(id);
    const tocados = Object.entries(cambios).filter(([, v]) => v !== undefined);
    if (tocados.length === 0) {
      throw new ErrorDeCliente(400, "Indica al menos un campo que cambiar.");
    }
    // Se valida todo antes de tocar nada: un cambio a medias no existe.
    const titulo =
      cambios.titulo !== undefined ? tituloValido(cambios.titulo) : undefined;
    const url = cambios.url !== undefined ? urlValida(cambios.url) : undefined;
    const categoria =
      cambios.categoria !== undefined
        ? categoriaValida(cambios.categoria)
        : undefined;
    const pasos =
      cambios.pasos !== undefined ? pasosValidos(cambios.pasos) : undefined;
    const notas =
      cambios.notas === undefined
        ? undefined
        : cambios.notas === null
          ? null
          : notasValidas(cambios.notas);
    // Un dominio explícito manda (`null` o en blanco lo quita). Sin él, una URL
    // de otro sitio lo recalcula y una del mismo sitio lo deja como está.
    const dominio =
      cambios.dominio !== undefined
        ? cambios.dominio === null || cambios.dominio === ""
          ? null
          : dominioNormalizado(cambios.dominio)
        : url !== undefined && !urlEsDelDominio(url, t.dominio)
          ? dominioDe(url)
          : undefined;
    if (titulo !== undefined) t.titulo = titulo;
    if (url !== undefined) t.url = url;
    if (categoria !== undefined) t.categoria = categoria;
    if (pasos !== undefined) t.pasos = pasos;
    if (notas !== undefined) t.notas = notas;
    if (dominio !== undefined) t.dominio = dominio;
    return aTarea(t);
  }

  /**
   * Desde `pendiente` o `descartada` la marca y fecha el momento. Idempotente:
   * si ya estaba hecha no cambia `hechaEn` y solo completa el resultado o la
   * nota que lleguen ahora.
   */
  function marcarHecha(id: string, marca: MarcaDeTareaHecha): Tarea {
    const t = obligatoria(id);
    const resultado = resultadoValido(marca.resultado);
    const nota = notaDeResultadoValida(marca.nota);
    if (t.estado === "hecha") {
      if (resultado !== null) t.resultado = resultado;
      if (nota !== null) t.notaDeResultado = nota;
      return aTarea(t);
    }
    t.estado = "hecha";
    t.resultado = resultado;
    t.notaDeResultado = nota;
    t.hechaEn = ahoraIso();
    return aTarea(t);
  }

  /** Idempotente; la nota (por qué no) se completa si llega. */
  function descartar(id: string, descarte: DescarteDeTarea): Tarea {
    const t = obligatoria(id);
    const nota = notaDeResultadoValida(descarte.nota);
    if (t.estado === "descartada") {
      if (nota !== null) t.notaDeResultado = nota;
      return aTarea(t);
    }
    t.estado = "descartada";
    t.resultado = null;
    t.notaDeResultado = nota;
    t.hechaEn = null;
    return aTarea(t);
  }

  /** Vuelve a pendiente y limpia resultado y fecha; la nota se conserva. */
  function reabrir(id: string): Tarea {
    const t = obligatoria(id);
    t.estado = "pendiente";
    t.resultado = null;
    t.hechaEn = null;
    return aTarea(t);
  }

  function borrar(id: string): void {
    const t = obligatoria(id);
    if (t.origen === "repo") {
      throw new ErrorDeCliente(
        409,
        "Esta tarea viene del repositorio y no se puede borrar: descártala.",
        { codigo: "tarea_del_repositorio" }
      );
    }
    almacen.tareas = almacen.tareas.filter((x) => x.id !== id);
  }

  return { listar, anadir, editar, marcarHecha, descartar, reabrir, borrar };
}
