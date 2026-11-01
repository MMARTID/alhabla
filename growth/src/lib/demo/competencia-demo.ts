import { ErrorDeCliente } from "../api-errors";
import {
  DIAS_PARA_CADUCAR_UN_ANALISIS,
  LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR,
  LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR,
  LARGO_MAXIMO_DE_URL_DE_COMPETIDOR,
  TIPOS_DE_DATO_DEL_COMPARADOR,
  type AltaDeCompetidor,
  type AnalisisDeCompetidor,
  type CambioDeCompetidor,
  type CompetidorDetalle,
  type CompetidorResumen,
  type EstadoDeCompetidor,
  type FilaDelComparador,
  type RespuestaDelComparador,
  type RevisionDeAnalisis,
} from "../types";
import { urlSegura } from "../url-segura";
import type { AlmacenDeDemostracion, RegistroDeCompetidor } from "./datos";
import {
  dominioDe,
  esDominioPropio,
  esDominioPropioOInterno,
  limpiarUrl,
} from "./urls-demo";

/**
 * La competencia de la demostración: la misma lógica que el backend para las
 * transiciones de estado y los errores `409`/`400` con su `codigo`, sobre el
 * almacén en memoria. El agente no existe aquí (nadie escribe un análisis
 * nuevo): lo que se ve es la semilla de `datos.ts` y lo que haces tú.
 *
 * Transiciones (PLAN-GROWTH § 3.4 y el contrato de la Fase 2a):
 *
 * - `propuesto → por_analizar` al aceptarlo.
 * - `por_analizar → analizado` cuando el agente guarda un análisis (solo la
 *   escribe el agente: aquí no hay herramienta para ello).
 * - `analizado → revisado` al revisar el último análisis.
 * - `analizado | revisado → por_analizar` al pedir volver a analizarlo.
 * - Un `propuesto` se rechaza borrándolo.
 */
export const TRANSICIONES_DE_COMPETIDOR = {
  aceptar: { desde: ["propuesto"], hasta: "por_analizar" },
  reanalizar: { desde: ["analizado", "revisado"], hasta: "por_analizar" },
  revisar: { desde: ["analizado"], hasta: "revisado" },
} as const satisfies Record<
  string,
  { desde: readonly EstadoDeCompetidor[]; hasta: EstadoDeCompetidor }
>;

/** Los códigos de error que el backend manda en la competencia. */
export const CODIGOS_DE_ERROR_DE_COMPETENCIA = [
  "competidor_existente",
  "dominio_propio",
  "url_de_otro_dominio",
  "competidor_del_repositorio",
  "estado_incorrecto",
  "analisis_antiguo",
  "ya_revisado",
] as const;

const DIA = 24 * 60 * 60 * 1000;

export type DependenciasDeCompetencia = {
  almacen: AlmacenDeDemostracion;
  ahoraMs: () => number;
  ahoraIso: () => string;
  nuevoId: (prefijo: string) => string;
};

const MENSAJE_DE_URL =
  "La URL debe ser http o https y sin usuario ni contraseña.";

/** Como `validarUrlExterna` del backend: la IP, el host interno y el sin punto no valen. */
function esHostInterno(dominio: string): boolean {
  return (
    esDominioPropioOInterno(dominio) ||
    !dominio.includes(".") ||
    dominio.endsWith(".lan") ||
    dominio.endsWith(".localhost")
  );
}

function primeraEtiquetaConMayuscula(dominio: string): string {
  const etiqueta = dominio.split(".")[0] ?? dominio;
  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
}

/** Una URL de competidor válida para guardar: http(s), sin credenciales. */
function urlValida(valor: string): string {
  const texto = valor.trim();
  if (texto === "") {
    throw new ErrorDeCliente(400, "Escribe la dirección web del competidor.");
  }
  if (texto.length > LARGO_MAXIMO_DE_URL_DE_COMPETIDOR) {
    throw new ErrorDeCliente(
      400,
      `La dirección no puede pasar de ${LARGO_MAXIMO_DE_URL_DE_COMPETIDOR} caracteres.`
    );
  }
  const segura = urlSegura(texto);
  if (!segura) throw new ErrorDeCliente(400, MENSAJE_DE_URL);
  const url = new URL(segura);
  if (url.username !== "" || url.password !== "") {
    throw new ErrorDeCliente(400, MENSAJE_DE_URL);
  }
  return segura;
}

function nombreValido(valor: string): string {
  const nombre = valor.trim();
  if (nombre === "") {
    throw new ErrorDeCliente(400, "El nombre no puede estar vacío.");
  }
  if (nombre.length > LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR) {
    throw new ErrorDeCliente(
      400,
      `El nombre no puede pasar de ${LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR} caracteres.`
    );
  }
  return nombre;
}

function notasValidas(valor: string, que = "Las notas"): string | null {
  const notas = valor.trim();
  if (notas.length > LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR) {
    throw new ErrorDeCliente(
      400,
      `${que} no pueden pasar de ${LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR} caracteres.`
    );
  }
  return notas === "" ? null : notas;
}

export function crearCompetenciaDeDemostracion(
  deps: DependenciasDeCompetencia
) {
  const { almacen, ahoraMs, ahoraIso, nuevoId } = deps;

  function obligatorio(id: string): RegistroDeCompetidor {
    const encontrado = almacen.competidores.find((c) => c.id === id);
    if (!encontrado) throw new ErrorDeCliente(404, "El competidor no existe.");
    return encontrado;
  }

  function resumen(c: RegistroDeCompetidor): CompetidorResumen {
    const ultimo = c.analisis[c.analisis.length - 1] ?? null;
    return {
      id: c.id,
      nombre: c.nombre,
      dominio: c.dominio,
      url: c.url,
      notas: c.notas,
      origen: c.origen,
      estado: c.estado,
      creadoEn: c.creadoEn,
      analisisSolicitadoEn: c.analisisSolicitadoEn,
      // En su dominio o en un subdominio, como la puerta dura al calificar.
      oportunidades: almacen.oportunidades.filter(
        (o) => o.dominio === c.dominio || o.dominio.endsWith(`.${c.dominio}`)
      ).length,
      menciones: almacen.oportunidades.filter((o) =>
        o.datos?.competidoresMencionados?.includes(c.dominio)
      ).length,
      analisis: ultimo
        ? {
            id: ultimo.id,
            version: ultimo.version,
            creadoEn: ultimo.creadoEn,
            revisadoEn: ultimo.revisadoEn,
            numDatos: ultimo.datos.length,
            caducado:
              ahoraMs() - Date.parse(ultimo.creadoEn) >
              DIAS_PARA_CADUCAR_UN_ANALISIS * DIA,
          }
        : null,
    };
  }

  function detalle(c: RegistroDeCompetidor): CompetidorDetalle {
    const versiones = [...c.analisis]
      .sort((a, b) => b.version - a.version)
      .map((a) => ({
        id: a.id,
        version: a.version,
        creadoEn: a.creadoEn,
        revisadoEn: a.revisadoEn,
        numDatos: a.datos.length,
      }));
    return {
      ...resumen(c),
      ultimoAnalisis: c.analisis[c.analisis.length - 1] ?? null,
      versiones,
    };
  }

  function listar(): CompetidorResumen[] {
    return [...almacen.competidores]
      .sort(
        (a, b) =>
          a.nombre.localeCompare(b.nombre, "es") || a.id.localeCompare(b.id)
      )
      .map(resumen);
  }

  /**
   * El comparador: todos menos los propuestos, por nombre, con los datos de
   * comparación del ÚLTIMO análisis. Sin análisis, la fila sale con `datos`
   * vacío. Como el backend, una sola pasada y sin tocar nada.
   */
  function comparador(): RespuestaDelComparador {
    const tipos: readonly string[] = TIPOS_DE_DATO_DEL_COMPARADOR;
    const data = [...almacen.competidores]
      .filter((c) => c.estado !== "propuesto")
      .sort(
        (a, b) =>
          a.nombre.localeCompare(b.nombre, "es") || a.id.localeCompare(b.id)
      )
      .map((c): FilaDelComparador => {
        const ultimo = c.analisis[c.analisis.length - 1] ?? null;
        return {
          competidorId: c.id,
          nombre: c.nombre,
          dominio: c.dominio,
          url: c.url,
          origen: c.origen,
          estado: c.estado as FilaDelComparador["estado"],
          analisis: ultimo
            ? {
                id: ultimo.id,
                version: ultimo.version,
                creadoEn: ultimo.creadoEn,
                revisadoEn: ultimo.revisadoEn,
                caducado:
                  ahoraMs() - Date.parse(ultimo.creadoEn) >
                  DIAS_PARA_CADUCAR_UN_ANALISIS * DIA,
              }
            : null,
          datos: ultimo
            ? ultimo.datos.filter((d) => tipos.includes(d.tipo))
            : [],
        };
      });
    return { data, generadoEn: ahoraIso() };
  }

  function analisisDe(id: string, analisisId: string): AnalisisDeCompetidor {
    const c = obligatorio(id);
    const encontrado = c.analisis.find((a) => a.id === analisisId);
    if (!encontrado) throw new ErrorDeCliente(404, "El análisis no existe.");
    return encontrado;
  }

  /** Lo que comprueba `validarUrlExterna` del backend sobre una URL ya bien formada. */
  function comprobarQueEsExterna(segura: string): string {
    const dominio = dominioDe(segura);
    if (esDominioPropio(dominio)) {
      throw new ErrorDeCliente(
        400,
        "Esa página es de Alhabla: Growth busca páginas de terceros.",
        { codigo: "dominio_propio" }
      );
    }
    if (esHostInterno(dominio)) {
      throw new ErrorDeCliente(
        400,
        "La URL apunta a un host interno o a una IP: indica la página pública."
      );
    }
    return dominio;
  }

  function anadir(alta: AltaDeCompetidor): CompetidorDetalle {
    // Primero lo que valida el esquema (Zod en el backend), luego el servicio.
    const segura = urlValida(alta.url);
    const nombre = alta.nombre !== undefined ? nombreValido(alta.nombre) : null;
    const notas =
      alta.notas !== undefined ? notasValidas(alta.notas, "Las notas") : null;
    const dominio = comprobarQueEsExterna(segura);
    const existente = almacen.competidores.find((c) => c.dominio === dominio);
    if (existente) {
      throw new ErrorDeCliente(
        409,
        "Ya existe un competidor con ese dominio.",
        {
          codigo: "competidor_existente",
          id: existente.id,
        }
      );
    }
    const ahora = ahoraIso();
    const nuevo: RegistroDeCompetidor = {
      id: nuevoId("competidor"),
      nombre: nombre ?? primeraEtiquetaConMayuscula(dominio),
      dominio,
      url: limpiarUrl(segura),
      notas,
      origen: "manual",
      estado: "por_analizar",
      creadoEn: ahora,
      analisisSolicitadoEn: ahora,
      analisis: [],
    };
    almacen.competidores.push(nuevo);
    return detalle(nuevo);
  }

  function editar(id: string, cambios: CambioDeCompetidor): CompetidorDetalle {
    const c = obligatorio(id);
    const tocados = Object.entries(cambios).filter(([, v]) => v !== undefined);
    if (tocados.length === 0) {
      throw new ErrorDeCliente(400, "Indica al menos un campo que cambiar.");
    }
    // Se valida todo antes de tocar nada: un cambio a medias no existe.
    const nombre =
      cambios.nombre !== undefined ? nombreValido(cambios.nombre) : undefined;
    const notas =
      cambios.notas === undefined
        ? undefined
        : cambios.notas === null
          ? null
          : notasValidas(cambios.notas);
    let url: string | null | undefined;
    let dominio: string | undefined;
    if (cambios.url === null) url = null;
    else if (cambios.url !== undefined) {
      const segura = urlValida(cambios.url);
      comprobarQueEsExterna(segura);
      const dominioNuevo = dominioDe(segura);
      if (dominioNuevo !== c.dominio) {
        if (!cambios.cambiarDominio) {
          throw new ErrorDeCliente(
            400,
            `La URL es de otro dominio que ${c.dominio}. Si el competidor cambió de web, confirma el cambio de dominio.`,
            { codigo: "url_de_otro_dominio" }
          );
        }
        if (almacen.competidores.some((x) => x.dominio === dominioNuevo)) {
          throw new ErrorDeCliente(
            409,
            "Ya existe un competidor con ese dominio.",
            { codigo: "competidor_existente" }
          );
        }
        dominio = dominioNuevo;
      }
      url = limpiarUrl(segura);
    }
    if (nombre !== undefined) c.nombre = nombre;
    if (notas !== undefined) c.notas = notas;
    if (url !== undefined) c.url = url;
    if (dominio !== undefined) c.dominio = dominio;
    return detalle(c);
  }

  function quitar(id: string): void {
    const c = obligatorio(id);
    if (c.origen === "repo") {
      throw new ErrorDeCliente(
        409,
        "Este competidor viene del repositorio y no se puede quitar desde aquí.",
        { codigo: "competidor_del_repositorio" }
      );
    }
    almacen.competidores = almacen.competidores.filter((x) => x.id !== id);
  }

  function estadoIncorrecto(mensaje: string): ErrorDeCliente {
    return new ErrorDeCliente(409, mensaje, { codigo: "estado_incorrecto" });
  }

  function aceptar(id: string): CompetidorDetalle {
    const c = obligatorio(id);
    if (
      !(TRANSICIONES_DE_COMPETIDOR.aceptar.desde as readonly string[]).includes(
        c.estado
      )
    ) {
      throw estadoIncorrecto(
        `Solo se puede aceptar un competidor propuesto (este está ${c.estado}).`
      );
    }
    c.estado = TRANSICIONES_DE_COMPETIDOR.aceptar.hasta;
    c.analisisSolicitadoEn = ahoraIso();
    return detalle(c);
  }

  function reanalizar(id: string): CompetidorDetalle {
    const c = obligatorio(id);
    if (c.estado === "por_analizar") return detalle(c); // idempotente
    if (
      !(
        TRANSICIONES_DE_COMPETIDOR.reanalizar.desde as readonly string[]
      ).includes(c.estado)
    ) {
      throw estadoIncorrecto(
        "Un competidor propuesto primero se acepta; después se analiza."
      );
    }
    c.estado = TRANSICIONES_DE_COMPETIDOR.reanalizar.hasta;
    c.analisisSolicitadoEn = ahoraIso();
    return detalle(c);
  }

  function revisar(
    id: string,
    analisisId: string,
    revision: RevisionDeAnalisis
  ): CompetidorDetalle {
    const c = obligatorio(id);
    const analisis = c.analisis.find((a) => a.id === analisisId);
    if (!analisis) throw new ErrorDeCliente(404, "El análisis no existe.");
    const nota =
      revision.nota !== undefined
        ? notasValidas(revision.nota, "La nota")
        : null;
    const ultimo = c.analisis[c.analisis.length - 1];
    if (analisis !== ultimo) {
      throw new ErrorDeCliente(
        409,
        "Ese análisis ya no es el último: revisa el más reciente.",
        { codigo: "analisis_antiguo" }
      );
    }
    if (analisis.revisadoEn !== null) {
      throw new ErrorDeCliente(409, "Ese análisis ya está revisado.", {
        codigo: "ya_revisado",
      });
    }
    if (
      !(TRANSICIONES_DE_COMPETIDOR.revisar.desde as readonly string[]).includes(
        c.estado
      )
    ) {
      throw estadoIncorrecto(
        `Solo se revisa un competidor analizado (este está ${c.estado}).`
      );
    }
    analisis.revisadoEn = ahoraIso();
    analisis.notaDeRevision = nota;
    c.estado = TRANSICIONES_DE_COMPETIDOR.revisar.hasta;
    return detalle(c);
  }

  return {
    listar,
    comparador,
    detalle: (id: string) => detalle(obligatorio(id)),
    analisis: analisisDe,
    anadir,
    editar,
    quitar,
    aceptar,
    reanalizar,
    revisar,
  };
}
