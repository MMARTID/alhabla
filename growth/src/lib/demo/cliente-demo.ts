import { ErrorDeCliente } from "../api-errors";
import type { ClienteGrowth } from "../cliente";
import { CORREO_DE_DEMOSTRACION } from "../modo-demo";
import { urlSegura } from "../url-segura";
import {
  copiar,
  crearAlmacenDeDemostracion,
  type AlmacenDeDemostracion,
  type RegistroDeBorrador,
  type RegistroDeOportunidad,
} from "./datos";
import {
  ESTADO_POR_ACCION,
  puedeTransicionar,
  transicionesPosibles,
} from "./estados-demo";
import { crearCompetenciaDeDemostracion } from "./competencia-demo";
import { gruposDeBorrador } from "./grupos-de-borradores";
import {
  DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO,
  evaluarReglasDeDemo,
  fallosDelTexto,
  similitudDeTextos,
  terminosProhibidosDe,
  type ContextoDeReglas,
} from "./reglas-demo";
import { claveDeUrl, dominioDe, esDominioPropioOInterno } from "./urls-demo";
import {
  ESTADOS_DE_OPORTUNIDAD,
  GRUPOS_DE_BORRADORES,
  TIPOS_DE_AFIRMACION,
  type AccionDisponible,
  type Afirmacion,
  type Ajustes,
  type BorradorDetallado,
  type BorradorResumen,
  type CambiosDeAjustes,
  type CodigoDescarte,
  type Comprobacion,
  type Decision,
  type DetalleDeBorrador,
  type DetalleDeEjecucion,
  type DetalleDeOportunidad,
  type EdicionDeBorrador,
  type EstadoDeOportunidad,
  type FiltrosDeBorradores,
  type FiltrosDeDecisiones,
  type FiltrosDeEjecuciones,
  type FiltrosDeGestiones,
  type FiltrosDeOportunidades,
  type GrupoDeBorradores,
  type HistorialDeAfirmacion,
  type ListaDeBorradores,
  type ListaDeDecisiones,
  type ListaDeEjecuciones,
  type ListaDeGestiones,
  type ListaDeOportunidades,
  type NuevaUrl,
  type OportunidadResumen,
  type Pagina,
  type RespuestaDeConocimiento,
  type RespuestaDeDecision,
  type RespuestaDeEdicion,
  type RespuestaDeNuevaUrl,
  type Resultado,
  type Resumen,
  type Snapshot,
  type TipoDeAfirmacion,
} from "../types";

/**
 * El cliente de la demostración: implementa `ClienteGrowth` sobre un almacén
 * en memoria sembrado con datos de prueba (`./datos`). Las mutaciones aplican
 * la misma tabla de estados que el backend y dejan rastro en las decisiones,
 * así que se puede recorrer Bandeja → Revisión → Aprobar → Historial.
 *
 * Solo existe en desarrollo (`npm run dev:demo`): `crearCliente` es el único
 * que lo importa, tras una condición que el compilador elimina en producción.
 * Cada llamada a `clienteDemo()` crea un almacén nuevo; recargar la página
 * lo reinicia.
 */

const DIA = 24 * 60 * 60 * 1000;

export type OpcionesDeDemostracion = {
  /** Retraso simulado de cada llamada (ms). 0 en los tests. */
  retardoMs?: number;
  /** Reloj; por defecto, el real. */
  ahora?: () => Date;
  /** Sin nada en la bandeja. Por defecto, `?vacio=1` de la URL. */
  vacio?: boolean;
  /**
   * Un almacén ya montado (solo para los tests, que retocan los datos de
   * prueba para probar un caso que la semilla no tiene). Por defecto, la
   * semilla de `crearAlmacenDeDemostracion`.
   */
  almacen?: AlmacenDeDemostracion;
};

function vacioPorLaUrl(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("vacio") === "1";
  } catch {
    return false;
  }
}

// --- Utilidades --------------------------------------------------------------

function pagina<T>(
  elementos: T[],
  filtros: { pagina?: number; limite?: number },
  maximo = 200
): Pagina<T> {
  const limite = Math.min(
    Math.max(1, Math.trunc(filtros.limite ?? 50)),
    maximo
  );
  const numero = Math.max(1, Math.trunc(filtros.pagina ?? 1));
  const desde = (numero - 1) * limite;
  return {
    data: elementos.slice(desde, desde + limite),
    total: elementos.length,
    pagina: numero,
    limite,
  };
}

/**
 * Del más reciente al más antiguo. Si empatan (el reloj de un test está
 * parado), gana el que se añadió el último.
 */
function masRecientePrimero<T>(
  lista: readonly T[],
  fecha: (elemento: T) => string
): T[] {
  return lista
    .map((elemento, indice) => ({ elemento, indice }))
    .sort(
      (a, b) =>
        Date.parse(fecha(b.elemento)) - Date.parse(fecha(a.elemento)) ||
        b.indice - a.indice
    )
    .map(({ elemento }) => elemento);
}

function conteoPor<T>(elementos: T[], clave: (e: T) => string) {
  const conteo: Record<string, number> = {};
  for (const elemento of elementos) {
    const k = clave(elemento);
    conteo[k] = (conteo[k] ?? 0) + 1;
  }
  return conteo;
}

function porEstadoCompleto(
  oportunidades: RegistroDeOportunidad[]
): Record<EstadoDeOportunidad, number> {
  const base = Object.fromEntries(
    ESTADOS_DE_OPORTUNIDAD.map((estado) => [estado, 0])
  ) as Record<EstadoDeOportunidad, number>;
  for (const o of oportunidades) base[o.estado] += 1;
  return base;
}

/** El parecido entre textos es el del backend (`reglas-demo.ts`). */
export { similitudDeTextos };

const URL_HTTP = "La URL debe empezar por http:// o https://.";

// --- El cliente ------------------------------------------------------------------

export function clienteDemo(
  opciones: OpcionesDeDemostracion = {}
): ClienteGrowth {
  const retardoMs = opciones.retardoMs ?? 140;
  const reloj = opciones.ahora ?? (() => new Date());
  const almacen: AlmacenDeDemostracion =
    opciones.almacen ??
    crearAlmacenDeDemostracion({
      ahora: reloj(),
      vacio: opciones.vacio ?? vacioPorLaUrl(),
    });
  let siguiente = 1;
  const nuevoId = (prefijo: string) => `demo-nuevo-${prefijo}-${siguiente++}`;
  const ahoraMs = () => reloj().getTime();
  const ahoraIso = () => reloj().toISOString();

  const esperar = () =>
    retardoMs > 0
      ? new Promise<void>((resolver) => setTimeout(resolver, retardoMs))
      : Promise.resolve();

  /** Toda respuesta es una copia: la interfaz no puede mutar el almacén. */
  async function responder<T>(calcular: () => T): Promise<T> {
    await esperar();
    return copiar(calcular());
  }

  // --- Piezas ----------------------------------------------------------------

  const oportunidadPorId = (id: string) =>
    almacen.oportunidades.find((o) => o.id === id);

  function oportunidadObligatoria(id: string): RegistroDeOportunidad {
    const encontrada = oportunidadPorId(id);
    if (!encontrada) throw new ErrorDeCliente(404, "La oportunidad no existe.");
    return encontrada;
  }

  const fuenteDe = (o: RegistroDeOportunidad) =>
    almacen.fuentes.find((f) => f.id === o.fuenteId) ?? {
      id: o.fuenteId,
      tipo: "web" as const,
      nombre: "Búsqueda web",
    };

  const nichoDe = (o: RegistroDeOportunidad) => {
    const nicho = almacen.nichos.find((n) => n.slug === o.nichoSlug);
    return nicho
      ? { id: nicho.id, slug: nicho.slug, nombre: nicho.nombre }
      : null;
  };

  function diasParaCaducar(expiraEn: string | null): number | null {
    return expiraEn === null
      ? null
      : Math.ceil((Date.parse(expiraEn) - ahoraMs()) / DIA);
  }

  /**
   * `datos` tal como los enseña el backend: sin el código de descarte, que va
   * aparte (`codigoDescarte`).
   */
  const datosVisibles = (o: RegistroDeOportunidad) => {
    if (o.datos === null) return null;
    const { codigoDescarte: _aparte, ...resto } = o.datos;
    void _aparte;
    return resto;
  };

  const codigoDeDescarte = (o: RegistroDeOportunidad): CodigoDescarte | null =>
    o.datos?.codigoDescarte ?? null;

  const puntuaciones = (o: RegistroDeOportunidad) => ({
    TRAFICO_MARCA: o.puntTrafico,
    LEADS: o.puntLeads,
    BACKLINKS: o.puntBacklinks,
  });

  const puntuacionDe = (o: RegistroDeOportunidad) =>
    puntuaciones(o)[o.objetivoPrincipal];

  const borradoresDe = (oportunidadId: string) =>
    almacen.borradores
      .filter((b) => b.oportunidadId === oportunidadId)
      .sort((a, b) => b.version - a.version);

  const revisionesDe = (borradorId: string) =>
    masRecientePrimero(
      almacen.revisiones.filter((r) => r.borradorId === borradorId),
      (r) => r.creadaEn
    );

  /** La última revisión del motor de reglas (la que manda). */
  const ultimaRevision = (borradorId: string) => {
    const todas = revisionesDe(borradorId);
    return todas.find((r) => r.revisor === "reglas") ?? todas[0] ?? null;
  };

  const gestionDe = (borradorId: string) =>
    almacen.gestiones.find((g) => g.borradorId === borradorId) ?? null;

  const afirmacionesVigentes = () =>
    almacen.afirmaciones.filter((a) => a.vigenteHasta === null);

  function resumenDeBorradorActual(o: RegistroDeOportunidad) {
    const actual = borradoresDe(o.id)[0];
    if (!actual) return null;
    const revision = ultimaRevision(actual.id);
    return {
      id: actual.id,
      version: actual.version,
      tipo: actual.tipo,
      estado: actual.estado,
      editadoPorHumano: actual.editadoPorHumano,
      resultado: revision?.resultado ?? null,
      reglasFallidas: (revision?.comprobaciones ?? []).filter((c) => !c.ok),
    };
  }

  function aResumen(o: RegistroDeOportunidad): OportunidadResumen {
    const fuente = fuenteDe(o);
    return {
      id: o.id,
      url: o.url,
      dominio: o.dominio,
      titulo: o.titulo,
      extracto: o.extracto,
      extractoPurgado: false,
      idioma: o.idioma,
      objetivoPrincipal: o.objetivoPrincipal,
      estado: o.estado,
      puntuacion: puntuacionDe(o),
      puntuaciones: puntuaciones(o),
      datos: datosVisibles(o),
      detectadaEn: o.detectadaEn,
      expiraEn: o.expiraEn,
      diasParaCaducar: diasParaCaducar(o.expiraEn),
      motivoDescarte: o.motivoDescarte,
      codigoDescarte: codigoDeDescarte(o),
      ejecucionId: o.ejecucionId,
      fuente: { id: fuente.id, tipo: fuente.tipo, nombre: fuente.nombre },
      nicho: nichoDe(o),
      borradorActual: resumenDeBorradorActual(o),
    };
  }

  function aDetalleDeBorrador(b: RegistroDeBorrador): BorradorDetallado {
    const { similitudConVersionAnterior, ...resto } = b;
    return {
      ...resto,
      similitudConVersionAnterior,
      afirmacionesDetalle: b.afirmaciones.map((clave) => {
        const filas = almacen.afirmaciones
          .filter((a) => a.clave === clave)
          .sort(
            (x, y) => Date.parse(y.vigenteDesde) - Date.parse(x.vigenteDesde)
          );
        const fila = filas.find((a) => a.vigenteHasta === null) ?? filas[0];
        if (!fila) {
          return {
            clave,
            existe: false,
            tipo: null,
            texto: null,
            valor: null,
            fuente: null,
            commitSha: null,
            vigente: false,
            vigenteDesde: null,
            vigenteHasta: null,
          };
        }
        return {
          clave,
          existe: true,
          tipo: fila.tipo,
          texto: fila.texto,
          valor: fila.valor,
          fuente: fila.fuente,
          commitSha: fila.commitSha,
          vigente: fila.vigenteHasta === null,
          vigenteDesde: fila.vigenteDesde,
          vigenteHasta: fila.vigenteHasta,
        };
      }),
      // Como el backend, cada revisión y la gestión llevan su `borradorId`.
      revisiones: revisionesDe(b.id),
      gestion: gestionDe(b.id),
    };
  }

  function esEditable(
    b: RegistroDeBorrador,
    o: RegistroDeOportunidad
  ): boolean {
    const esLaUltima = borradoresDe(o.id)[0]?.id === b.id;
    return (
      esLaUltima &&
      (b.estado === "bloqueado" || b.estado === "pendiente_aprobacion") &&
      (o.estado === "bloqueada" || o.estado === "pendiente_aprobacion")
    );
  }

  function registrarDecision(
    oportunidadId: string | null,
    borradorId: string | null,
    accion: string,
    motivo: string | null,
    por: string = CORREO_DE_DEMOSTRACION
  ) {
    almacen.decisiones.push({
      id: nuevoId("decision"),
      oportunidadId,
      borradorId,
      accion,
      motivo,
      por,
      en: ahoraIso(),
    });
  }

  // La competencia vive en su propio módulo; aquí solo se le da el reloj y los
  // ids. Como en el backend, no deja rastro en el Historial.
  const competencia = crearCompetenciaDeDemostracion({
    almacen,
    ahoraMs,
    ahoraIso,
    nuevoId,
  });

  // --- Topes y contactos ---------------------------------------------------------

  const gestionesDeLaSemana = () =>
    almacen.gestiones.filter(
      (g) => Date.parse(g.hechaEn) >= ahoraMs() - 7 * DIA
    );

  const aprobadasSinGestionar = (excluirId?: string) =>
    almacen.oportunidades.filter(
      (o) => o.estado === "aprobada" && o.id !== excluirId
    );

  /**
   * Lo que cuenta para el tope semanal, como el backend: las gestiones hechas
   * en los últimos 7 días MÁS las oportunidades aprobadas sin gestionar.
   */
  function contactosDeLaSemana(excluirId?: string) {
    const hechas = gestionesDeLaSemana().length;
    const aprobadas = aprobadasSinGestionar(excluirId).length;
    return {
      hechas,
      aprobadasSinGestionar: aprobadas,
      total: hechas + aprobadas,
    };
  }

  /** La fecha de la última gestión con ese dominio dentro de los 90 días, si la hay. */
  function ultimoContactoReciente(dominio: string): Date | null {
    const limite = ahoraMs() - DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO * DIA;
    const fechas = almacen.gestiones
      .filter((g) => g.dominio === dominio)
      .map((g) => Date.parse(g.hechaEn))
      .filter((t) => t > limite)
      .sort((a, b) => b - a);
    return fechas.length > 0 ? new Date(fechas[0]) : null;
  }

  function dominioEnEnfriamientoHasta(dominio: string): string | null {
    const ultima = almacen.gestiones
      .filter((g) => g.dominio === dominio)
      .map((g) => Date.parse(g.hechaEn))
      .sort((a, b) => b - a)[0];
    if (ultima === undefined) return null;
    const hasta = ultima + 90 * DIA;
    return hasta > ahoraMs() ? new Date(hasta).toISOString() : null;
  }

  // --- Cumplimiento (el motor del backend, copiado en `reglas-demo.ts`) ----------

  const textosDe = (borradores: RegistroDeBorrador[]) =>
    borradores.flatMap((b) =>
      b.textoFinal ? [b.texto, b.textoFinal] : [b.texto]
    );

  /** El contexto de las reglas, con el almacén en memoria en lugar de Prisma. */
  function contextoDeReglas(
    b: Pick<RegistroDeBorrador, "id" | "oportunidadId" | "afirmaciones">,
    dominio: string,
    opciones: { incluirAprobadas: boolean }
  ): ContextoDeReglas {
    const vigentes = afirmacionesVigentes();
    const citadas = new Set(b.afirmaciones);
    const contactos = contactosDeLaSemana(b.oportunidadId);
    const gestiones = almacen.gestiones
      .filter(
        (g) =>
          g.dominio === dominio &&
          ahoraMs() - Date.parse(g.hechaEn) <
            DIAS_ENTRE_CONTACTOS_AL_MISMO_DOMINIO * DIA
      )
      .map((g) => new Date(g.hechaEn));
    return {
      clavesVigentes: new Set(vigentes.map((a) => a.clave)),
      afirmacionesCitadas: vigentes
        .filter((a) => citadas.has(a.clave))
        .map((a) => ({ clave: a.clave, tipo: a.tipo, valor: a.valor })),
      terminosProhibidos: vigentes
        .filter((a) => a.tipo === "prohibida")
        .flatMap(terminosProhibidosDe),
      // Un competidor `propuesto` no aplica ninguna regla hasta que lo aceptas.
      competidores: almacen.competidores.filter(
        (c) => c.estado !== "propuesto"
      ),
      // Como el backend: los 30 borradores más recientes de OTRAS oportunidades.
      textosAnteriores: textosDe(
        almacen.borradores
          .filter((x) => x.oportunidadId !== b.oportunidadId)
          .sort((x, y) => Date.parse(y.creadoEn) - Date.parse(x.creadoEn))
          .slice(0, 30)
      ),
      textosDeLaMismaOportunidad: textosDe(
        almacen.borradores.filter(
          (x) => x.oportunidadId === b.oportunidadId && x.id !== b.id
        )
      ),
      gestionesDelDominio: gestiones,
      aprobadasDelDominio: opciones.incluirAprobadas
        ? almacen.oportunidades.filter(
            (x) =>
              x.estado === "aprobada" &&
              x.dominio === dominio &&
              x.id !== b.oportunidadId
          ).length
        : 0,
      contactosEstaSemana: opciones.incluirAprobadas
        ? contactos.total
        : contactos.hechas,
      topeSemanal: almacen.ajustes.valores.topeSemanal,
      umbralDeSimilitud: almacen.ajustes.valores.umbralDeSimilitud,
      ahora: reloj(),
    };
  }

  /** Evalúa un borrador con las reglas del backend y el contexto de ahora. */
  function evaluar(
    b: Pick<
      RegistroDeBorrador,
      | "asunto"
      | "texto"
      | "enlaceUrl"
      | "afirmaciones"
      | "tipo"
      | "objetivo"
      | "id"
      | "oportunidadId"
    >,
    dominio: string,
    opciones: { incluirAprobadas?: boolean; agendaComoAviso?: boolean } = {}
  ): {
    resultado: Resultado;
    comprobaciones: Comprobacion[];
    similitud: number | null;
  } {
    const contexto = contextoDeReglas(b, dominio, {
      incluirAprobadas: opciones.incluirAprobadas ?? true,
    });
    const { resultado, comprobaciones } = evaluarReglasDeDemo(b, contexto, {
      agendaComoAviso: opciones.agendaComoAviso,
    });
    const anteriores = contexto.textosDeLaMismaOportunidad;
    const similitud =
      anteriores.length > 0
        ? Math.max(...anteriores.map((t) => similitudDeTextos(b.texto, t)))
        : null;
    return { resultado, comprobaciones, similitud };
  }

  /**
   * Una regla de agenda que falla no dice nada del texto: se responde 409 con
   * su código y NO se cambia nada (ni borrador, ni oportunidad, ni revisión).
   * Mismo orden y mismos mensajes que el backend.
   */
  function errorDeAgenda(
    dominio: string,
    oportunidadId: string
  ): ErrorDeCliente | null {
    const reciente = ultimoContactoReciente(dominio);
    if (reciente) {
      return new ErrorDeCliente(
        409,
        `Ya se contactó con este dominio el ${reciente.toISOString().slice(0, 10)}: espera 90 días.`,
        { codigo: "dominio_en_enfriamiento" }
      );
    }
    if (
      almacen.oportunidades.some(
        (x) =>
          x.id !== oportunidadId &&
          x.dominio === dominio &&
          x.estado === "aprobada"
      )
    ) {
      return new ErrorDeCliente(
        409,
        "Ya hay otra oportunidad aprobada de este dominio pendiente de gestionar.",
        { codigo: "dominio_ya_aprobado" }
      );
    }
    const tope = almacen.ajustes.valores.topeSemanal;
    if (contactosDeLaSemana(oportunidadId).total >= tope) {
      return new ErrorDeCliente(
        409,
        `Se ha llegado al tope de ${tope} contactos esta semana (hechos o aprobados).`,
        { codigo: "tope_semanal" }
      );
    }
    return null;
  }

  function guardarRevision(
    borradorId: string,
    resultado: Resultado,
    comprobaciones: Comprobacion[]
  ) {
    almacen.revisiones.push({
      id: nuevoId("revision"),
      borradorId,
      resultado,
      comprobaciones,
      revisor: "reglas",
      creadaEn: ahoraIso(),
    });
  }

  // --- Acciones de la Revisión ---------------------------------------------------

  /**
   * Las acciones que ofrece la Revisión, con el contrato del backend: SOLO las
   * alcanzables desde el estado actual (un estado final no ofrece ninguna) y,
   * entre ellas, `habilitada: false` con su `motivo` cuando lo impide una regla.
   * Los motivos son los del backend (`accionesDisponibles` en service.ts).
   */
  function accionesDe(o: RegistroDeOportunidad): AccionDisponible[] {
    const destinos = new Set(transicionesPosibles(o.estado, "admin"));
    const borradores = borradoresDe(o.id);
    const lista: AccionDisponible[] = [];

    if (destinos.has("aprobada")) {
      const ultima = borradores[0];
      const pendiente =
        ultima?.estado === "pendiente_aprobacion" ? ultima : undefined;
      const revision = pendiente ? ultimaRevision(pendiente.id) : null;
      const vencida = o.expiraEn !== null && Date.parse(o.expiraEn) < ahoraMs();
      if (!pendiente) {
        lista.push({
          accion: "aprobar",
          habilitada: false,
          motivo: "No hay ningún borrador pendiente de aprobación.",
        });
      } else if (revision?.resultado === "bloquea") {
        lista.push({
          accion: "aprobar",
          habilitada: false,
          motivo: "El borrador está bloqueado por las reglas.",
        });
      } else if (vencida) {
        lista.push({
          accion: "aprobar",
          habilitada: false,
          motivo: "La oportunidad ha caducado.",
        });
      } else {
        // Las reglas de agenda también apagan «Aprobar» (con su motivo), como
        // el backend: aprobar daría un 409 y no hay por qué ofrecerlo.
        const enfriamiento = dominioEnEnfriamientoHasta(o.dominio);
        const tope = almacen.ajustes.valores.topeSemanal;
        const otraAprobada = almacen.oportunidades.some(
          (x) =>
            x.id !== o.id && x.dominio === o.dominio && x.estado === "aprobada"
        );
        const motivo = enfriamiento
          ? `Ya se contactó con este dominio: no se puede volver a escribir hasta el ${enfriamiento.slice(0, 10)}.`
          : otraAprobada
            ? "Ya hay otra oportunidad aprobada de este dominio pendiente de gestionar."
            : contactosDeLaSemana(o.id).total >= tope
              ? `Se ha llegado al tope de ${tope} contactos esta semana.`
              : null;
        lista.push(
          motivo
            ? { accion: "aprobar", habilitada: false, motivo }
            : { accion: "aprobar", habilitada: true }
        );
      }
    }
    if (destinos.has("devuelta"))
      lista.push({ accion: "devolver", habilitada: true });
    if (destinos.has("descartada"))
      lista.push({ accion: "descartar", habilitada: true });
    if (destinos.has("gestionada")) {
      const aprobado = borradores.find((b) => b.estado === "aprobado");
      lista.push(
        aprobado
          ? { accion: "marcar_gestionado", habilitada: true }
          : {
              accion: "marcar_gestionado",
              habilitada: false,
              motivo: "No hay ningún borrador aprobado.",
            }
      );
    }
    if (destinos.has("conseguida"))
      lista.push({ accion: "conseguido", habilitada: true });
    if (destinos.has("sin_respuesta")) {
      lista.push({ accion: "sin_respuesta", habilitada: true });
      lista.push({ accion: "rechazado", habilitada: true });
    }
    return lista;
  }

  function aDetalle(o: RegistroDeOportunidad): DetalleDeOportunidad {
    const resumen = aResumen(o);
    const fuente = fuenteDe(o);
    const ejecucion = almacen.ejecuciones.find((e) => e.id === o.ejecucionId);
    const borradores = borradoresDe(o.id);
    const editable = borradores.find((b) => esEditable(b, o));
    return {
      id: o.id,
      claveExterna: `demo-${claveDeUrl(o.url)}`,
      fuenteId: o.fuenteId,
      nichoId: resumen.nicho?.id ?? null,
      url: o.url,
      dominio: o.dominio,
      titulo: o.titulo,
      extracto: o.extracto,
      idioma: o.idioma,
      detectadaEn: o.detectadaEn,
      objetivoPrincipal: o.objetivoPrincipal,
      puntTrafico: o.puntTrafico,
      puntLeads: o.puntLeads,
      puntBacklinks: o.puntBacklinks,
      estado: o.estado,
      motivoDescarte: o.motivoDescarte,
      datos: datosVisibles(o),
      codigoDescarte: codigoDeDescarte(o),
      expiraEn: o.expiraEn,
      retencionHasta: new Date(
        Date.parse(o.detectadaEn) + 180 * DIA
      ).toISOString(),
      ejecucionId: o.ejecucionId,
      puntuacion: resumen.puntuacion,
      puntuaciones: resumen.puntuaciones,
      extractoPurgado: false,
      diasParaCaducar: resumen.diasParaCaducar,
      fuente: { id: fuente.id, tipo: fuente.tipo, nombre: fuente.nombre },
      nicho: resumen.nicho,
      ejecucion: ejecucion
        ? {
            id: ejecucion.id,
            disparador: ejecucion.disparador,
            estado: ejecucion.estado,
            inicio: ejecucion.inicio,
          }
        : null,
      investigacion:
        almacen.investigaciones.find((i) => i.oportunidadId === o.id) ?? null,
      borradores: borradores.map(aDetalleDeBorrador),
      decisiones: masRecientePrimero(
        almacen.decisiones.filter((d) => d.oportunidadId === o.id),
        (d) => d.en
      ).map(({ oportunidadId: _omitido, ...d }) => {
        void _omitido;
        return d;
      }),
      borradorEditableId: editable?.id ?? null,
      acciones: accionesDe(o),
      contacto: {
        dominioEnEnfriamientoHasta: dominioEnEnfriamientoHasta(o.dominio),
        // Como el backend: lo hecho más lo aprobado sin gestionar.
        contactosEstaSemana: contactosDeLaSemana().total,
        topeSemanal: almacen.ajustes.valores.topeSemanal,
      },
    };
  }

  // --- Lecturas de listas ---------------------------------------------------------

  function filtrarOportunidades(
    filtros: FiltrosDeOportunidades,
    conEstado: boolean
  ): RegistroDeOportunidad[] {
    const q = filtros.q?.trim().toLowerCase();
    return almacen.oportunidades.filter((o) => {
      if (filtros.objetivo && o.objetivoPrincipal !== filtros.objetivo)
        return false;
      if (filtros.nicho && o.nichoSlug !== filtros.nicho) return false;
      if (filtros.tipoDestino && o.datos?.tipoDestino !== filtros.tipoDestino)
        return false;
      if (filtros.fuente && fuenteDe(o).tipo !== filtros.fuente) return false;
      if (filtros.ejecucionId && o.ejecucionId !== filtros.ejecucionId)
        return false;
      if (filtros.dominio && o.dominio !== filtros.dominio) return false;
      if (
        filtros.menciona &&
        !o.datos?.competidoresMencionados?.includes(
          filtros.menciona
            .trim()
            .toLowerCase()
            .replace(/^www\./, "")
        )
      ) {
        return false;
      }
      if (
        q &&
        ![o.titulo, o.dominio, o.url].some((t) => t.toLowerCase().includes(q))
      ) {
        return false;
      }
      if (
        conEstado &&
        filtros.estado?.length &&
        !filtros.estado.includes(o.estado)
      ) {
        return false;
      }
      return true;
    });
  }

  function ordenar(
    lista: RegistroDeOportunidad[],
    orden: FiltrosDeOportunidades["orden"] = "recientes"
  ) {
    const porRecientes = (a: RegistroDeOportunidad, b: RegistroDeOportunidad) =>
      Date.parse(b.detectadaEn) - Date.parse(a.detectadaEn) ||
      b.id.localeCompare(a.id);
    return [...lista].sort((a, b) => {
      if (orden === "puntuacion") {
        return puntuacionDe(b) - puntuacionDe(a) || porRecientes(a, b);
      }
      if (orden === "caducan") {
        const ea = a.expiraEn ? Date.parse(a.expiraEn) : Infinity;
        const eb = b.expiraEn ? Date.parse(b.expiraEn) : Infinity;
        return ea === eb ? porRecientes(a, b) : ea - eb;
      }
      return porRecientes(a, b);
    });
  }

  function aResumenDeBorrador(
    b: RegistroDeBorrador,
    o: RegistroDeOportunidad
  ): BorradorResumen {
    const revision = ultimaRevision(b.id);
    const gestion = gestionDe(b.id);
    return {
      id: b.id,
      oportunidadId: b.oportunidadId,
      version: b.version,
      tipo: b.tipo,
      objetivo: b.objetivo,
      asunto: b.asunto,
      textoPreview: b.texto.slice(0, 200),
      longitud: b.texto.length,
      enlaceUrl: b.enlaceUrl,
      afirmaciones: b.afirmaciones,
      estado: b.estado,
      editadoPorHumano: b.editadoPorHumano,
      creadoEn: b.creadoEn,
      resultado: revision?.resultado ?? null,
      reglasFallidas: (revision?.comprobaciones ?? []).filter((c) => !c.ok),
      oportunidad: {
        id: o.id,
        titulo: o.titulo,
        dominio: o.dominio,
        url: o.url,
        estado: o.estado,
        objetivoPrincipal: o.objetivoPrincipal,
        expiraEn: o.expiraEn,
        diasParaCaducar: diasParaCaducar(o.expiraEn),
      },
      gestion: gestion
        ? {
            canal: gestion.canal,
            hechaEn: gestion.hechaEn,
            resultado: gestion.resultado,
          }
        : null,
    };
  }

  function snapshotActual(): Snapshot {
    const vigentes = afirmacionesVigentes();
    const antiguedadMs =
      ahoraMs() - Date.parse(almacen.snapshot.sincronizadoEn);
    const porTipo = Object.fromEntries(
      TIPOS_DE_AFIRMACION.map((tipo) => [
        tipo,
        vigentes.filter((a) => a.tipo === tipo).length,
      ])
    ) as Record<TipoDeAfirmacion, number>;
    return {
      commitSha: almacen.snapshot.commitSha,
      sincronizadoEn: almacen.snapshot.sincronizadoEn,
      antiguedadHoras: Math.floor(antiguedadMs / (60 * 60 * 1000)),
      obsoleto: antiguedadMs > 8 * DIA,
      vigentes: vigentes.length,
      porTipo,
    };
  }

  function descartesDe(oportunidades: RegistroDeOportunidad[]) {
    const conteo = conteoPor(
      oportunidades.filter((o) => o.estado === "descartada"),
      (o) => o.datos?.codigoDescarte ?? "otro"
    );
    return Object.entries(conteo)
      .map(([codigo, n]) => ({ codigo, n }))
      .sort((a, b) => b.n - a.n || a.codigo.localeCompare(b.codigo));
  }

  function aAjustes(): Ajustes {
    return {
      valores: almacen.ajustes.valores,
      porDefecto: {
        topeSemanal: 5,
        umbralDeSimilitud: 0.6,
        umbralesPorObjetivo: { TRAFICO_MARCA: 60, LEADS: 60, BACKLINKS: 60 },
        pausa: false,
      },
      actualizadoEn: almacen.ajustes.actualizadoEn,
      limites: {
        topeSemanal: [0, 20],
        umbralDeSimilitud: [0.4, 0.9],
        umbralesPorObjetivo: [0, 100],
      },
      soloLectura: { retencionDias: 180, diasEntreContactosAlMismoDominio: 90 },
    };
  }

  // --- Decidir ------------------------------------------------------------------------

  function decidirAhora(id: string, decision: Decision): RespuestaDeDecision {
    const o = oportunidadObligatoria(id);
    const destino = ESTADO_POR_ACCION[decision.accion];
    if (!puedeTransicionar(o.estado, destino, "admin")) {
      throw new ErrorDeCliente(
        409,
        `Una oportunidad ${o.estado} no admite «${decision.accion}».`
      );
    }
    const borradores = borradoresDe(o.id);
    let borradorId: string | null = null;
    let motivo: string | null = null;

    switch (decision.accion) {
      case "aprobar": {
        const borrador = borradores.find((b) => b.id === decision.borradorId);
        if (!borrador || borrador.estado !== "pendiente_aprobacion") {
          throw new ErrorDeCliente(
            409,
            "Ese borrador no está pendiente de aprobación."
          );
        }
        if (borradores[0]?.id !== borrador.id) {
          throw new ErrorDeCliente(
            409,
            "Solo se puede aprobar la última versión del borrador."
          );
        }
        // Un borrador cuya última revisión de las reglas bloquea no se aprueba.
        const ultima = ultimaRevision(borrador.id);
        if (ultima?.resultado === "bloquea") {
          throw new ErrorDeCliente(
            409,
            "El borrador está bloqueado por las reglas.",
            {
              codigo: "cumplimiento",
              comprobaciones: ultima.comprobaciones,
            }
          );
        }
        if (o.expiraEn !== null && Date.parse(o.expiraEn) < ahoraMs()) {
          throw new ErrorDeCliente(409, "La oportunidad ha caducado.", {
            codigo: "caducada",
          });
        }
        // Se reevalúa al aprobar: entre crear y aprobar pueden pasar semanas.
        // Las reglas de agenda salen como avisos: tienen abajo su propio 409
        // y no bloquean el texto, que no tiene la culpa.
        const nueva = evaluar(borrador, o.dominio, { agendaComoAviso: true });
        const delTexto = fallosDelTexto(nueva.comprobaciones);
        if (delTexto.length > 0) {
          guardarRevision(borrador.id, "bloquea", nueva.comprobaciones);
          borrador.estado = "bloqueado";
          o.estado = "bloqueada";
          registrarDecision(
            o.id,
            borrador.id,
            "bloquear_por_reglas",
            `Al aprobar: ${delTexto.map((c) => c.regla).join(", ")}`,
            "sistema"
          );
          throw new ErrorDeCliente(
            409,
            "El borrador ya no cumple las reglas y ha quedado bloqueado.",
            { codigo: "cumplimiento", comprobaciones: nueva.comprobaciones }
          );
        }
        // La agenda: 409 con su código, sin cambiar nada.
        const deAgenda = errorDeAgenda(o.dominio, o.id);
        if (deAgenda) throw deAgenda;
        borradorId = borrador.id;
        borrador.estado = "aprobado";
        break;
      }
      case "devolver":
      case "descartar": {
        const texto = decision.motivo.trim();
        if (texto === "" || texto.length > 500) {
          throw new ErrorDeCliente(
            400,
            "Escribe un motivo de hasta 500 caracteres."
          );
        }
        motivo = texto;
        for (const b of borradores) {
          if (
            [
              "borrador",
              "bloqueado",
              "pendiente_aprobacion",
              "aprobado",
            ].includes(b.estado)
          ) {
            b.estado = "descartado";
          }
        }
        if (decision.accion === "descartar") {
          o.motivoDescarte = texto;
          const codigo: CodigoDescarte = decision.codigo ?? "otro";
          o.datos = { ...(o.datos ?? {}), codigoDescarte: codigo };
        }
        break;
      }
      case "marcar_gestionado": {
        const aprobado = borradores.find((b) => b.estado === "aprobado");
        if (!aprobado)
          throw new ErrorDeCliente(409, "No hay ningún borrador aprobado.");
        const hechaEn = decision.hechaEn
          ? Date.parse(decision.hechaEn)
          : ahoraMs();
        if (
          Number.isNaN(hechaEn) ||
          hechaEn < ahoraMs() - 30 * DIA ||
          hechaEn > ahoraMs() + 5 * 60_000
        ) {
          throw new ErrorDeCliente(
            400,
            "La fecha tiene que estar entre hace 30 días y ahora."
          );
        }
        borradorId = aprobado.id;
        motivo = decision.notas?.trim() || `Canal: ${decision.canal}`;
        almacen.gestiones.push({
          id: nuevoId("gestion"),
          borradorId: aprobado.id,
          canal: decision.canal,
          dominio: o.dominio,
          hechaEn: new Date(hechaEn).toISOString(),
          respuestaEn: null,
          resultado: "pendiente",
          urlConseguida: null,
          notas: decision.notas?.trim() || null,
        });
        const textoFinal = decision.textoFinal?.trim();
        if (textoFinal && textoFinal !== aprobado.texto) {
          aprobado.textoFinal = textoFinal;
          aprobado.editadoPorHumano = true;
        }
        aprobado.estado = "gestionado";
        break;
      }
      case "conseguido":
      case "sin_respuesta":
      case "rechazado": {
        const gestionado = borradores.find(
          (b) => b.estado === "gestionado" && gestionDe(b.id)
        );
        const gestion = gestionado ? gestionDe(gestionado.id) : null;
        if (!gestionado || !gestion) {
          throw new ErrorDeCliente(409, "No hay ninguna gestión registrada.");
        }
        borradorId = gestionado.id;
        if (decision.accion === "conseguido") {
          const segura = urlSegura(decision.urlConseguida);
          if (!segura) throw new ErrorDeCliente(400, URL_HTTP);
          gestion.resultado = "aceptado";
          gestion.urlConseguida = segura;
          gestion.respuestaEn = ahoraIso();
        } else {
          gestion.resultado =
            decision.accion === "rechazado" ? "rechazado" : "sin_respuesta";
          // Como el backend, solo «rechazado» marca cuándo contestó el destino:
          // «sin_respuesta» es justo que no hubo respuesta.
          if (decision.accion === "rechazado") gestion.respuestaEn = ahoraIso();
          motivo = decision.notas?.trim() || null;
          // Las notas del cierre se SUMAN a las que pusiste al marcarla como
          // gestionada: no las pisan.
          if (motivo) {
            gestion.notas = gestion.notas
              ? `${gestion.notas}\n${motivo}`
              : motivo;
          }
        }
        break;
      }
    }

    o.estado = destino;
    registrarDecision(o.id, borradorId, decision.accion, motivo);
    return { id: o.id, estado: destino };
  }

  // --- Editar un borrador ----------------------------------------------------------------

  function editarAhora(
    id: string,
    cambios: EdicionDeBorrador
  ): RespuestaDeEdicion {
    const borrador = almacen.borradores.find((b) => b.id === id);
    if (!borrador) throw new ErrorDeCliente(404, "El borrador no existe.");
    const o = oportunidadObligatoria(borrador.oportunidadId);
    if (!esEditable(borrador, o)) {
      throw new ErrorDeCliente(
        409,
        "Este borrador ya no se puede editar: solo la última versión, mientras está bloqueada o por revisar."
      );
    }
    const campos = (
      ["asunto", "texto", "enlaceUrl", "afirmaciones"] as const
    ).filter((campo) => cambios[campo] !== undefined);
    if (campos.length === 0) {
      throw new ErrorDeCliente(400, "Cambia al menos un campo del borrador.");
    }
    if (cambios.texto !== undefined && cambios.texto.trim() === "") {
      throw new ErrorDeCliente(400, "El texto no puede quedar vacío.");
    }
    if (cambios.enlaceUrl && !urlSegura(cambios.enlaceUrl)) {
      throw new ErrorDeCliente(400, URL_HTTP);
    }

    const antes = JSON.stringify({
      asunto: borrador.asunto,
      texto: borrador.texto,
      enlaceUrl: borrador.enlaceUrl,
      afirmaciones: borrador.afirmaciones,
    });
    const nuevo = {
      asunto: cambios.asunto !== undefined ? cambios.asunto : borrador.asunto,
      texto: cambios.texto !== undefined ? cambios.texto : borrador.texto,
      enlaceUrl:
        cambios.enlaceUrl !== undefined
          ? cambios.enlaceUrl
          : borrador.enlaceUrl,
      afirmaciones:
        cambios.afirmaciones !== undefined
          ? cambios.afirmaciones
          : borrador.afirmaciones,
    };
    const despues = JSON.stringify(nuevo);

    // Si no cambia nada, se devuelve el estado actual sin revisión ni decisión.
    if (antes !== despues) {
      // Se evalúa ANTES de guardar nada: las reglas de agenda (tope, un
      // contacto por dominio) no dicen nada del texto y no lo bloquean. Si el
      // texto pasa pero la agenda no, es un 409 y no se cambia NADA.
      const evaluacion = evaluar({ ...borrador, ...nuevo }, o.dominio, {
        agendaComoAviso: true,
      });
      const bloquea = fallosDelTexto(evaluacion.comprobaciones).length > 0;
      if (!bloquea) {
        const deAgenda = errorDeAgenda(o.dominio, o.id);
        if (deAgenda) throw deAgenda;
      }
      Object.assign(borrador, nuevo);
      borrador.editadoPorHumano = true;
      borrador.similitudConVersionAnterior = evaluacion.similitud;
      guardarRevision(
        borrador.id,
        evaluacion.resultado,
        evaluacion.comprobaciones
      );
      borrador.estado = bloquea ? "bloqueado" : "pendiente_aprobacion";
      o.estado = bloquea ? "bloqueada" : "pendiente_aprobacion";
      registrarDecision(
        o.id,
        borrador.id,
        "editar",
        [campos.join(", "), cambios.nota?.trim()].filter(Boolean).join(" · ")
      );
    }

    const revision = ultimaRevision(borrador.id);
    return {
      borrador: {
        id: borrador.id,
        oportunidadId: borrador.oportunidadId,
        version: borrador.version,
        tipo: borrador.tipo,
        objetivo: borrador.objetivo,
        asunto: borrador.asunto,
        texto: borrador.texto,
        enlaceUrl: borrador.enlaceUrl,
        utm: borrador.utm,
        afirmaciones: borrador.afirmaciones,
        estado: borrador.estado,
        textoFinal: borrador.textoFinal,
        editadoPorHumano: borrador.editadoPorHumano,
        creadoEn: borrador.creadoEn,
      },
      resultado: revision?.resultado ?? "pasa",
      comprobaciones: revision?.comprobaciones ?? [],
      oportunidad: { id: o.id, estado: o.estado },
    };
  }

  // --- Añadir una URL ---------------------------------------------------------------------

  function anadirUrlAhora(nueva: NuevaUrl): RespuestaDeNuevaUrl {
    const segura = urlSegura(nueva.url);
    if (!segura) throw new ErrorDeCliente(400, URL_HTTP);
    const dominio = dominioDe(segura);
    if (esDominioPropioOInterno(dominio)) {
      throw new ErrorDeCliente(
        400,
        "Esa dirección es de Alhabla o interna: no sirve como oportunidad."
      );
    }
    if (
      nueva.nichoSlug &&
      !almacen.nichos.some((n) => n.slug === nueva.nichoSlug)
    ) {
      throw new ErrorDeCliente(400, "Ese nicho no existe.");
    }
    if (nueva.nota && nueva.nota.length > 500) {
      throw new ErrorDeCliente(400, "La nota admite hasta 500 caracteres.");
    }
    const clave = claveDeUrl(segura);
    const existente = almacen.oportunidades.find(
      (o) => claveDeUrl(o.url) === clave
    );
    if (existente) {
      return {
        creada: false,
        id: existente.id,
        estado: existente.estado,
        motivoDescarte: existente.motivoDescarte,
      };
    }
    const id = nuevoId("oportunidad");
    almacen.oportunidades.push({
      id,
      url: segura,
      dominio,
      titulo: nueva.titulo?.trim() || dominio,
      extracto: "",
      idioma: "es",
      detectadaEn: ahoraIso(),
      objetivoPrincipal: nueva.objetivoPrincipal ?? "BACKLINKS",
      puntTrafico: 0,
      puntLeads: 0,
      puntBacklinks: 0,
      estado: "detectada",
      motivoDescarte: null,
      datos: nueva.nota?.trim() ? { nota: nueva.nota.trim() } : null,
      expiraEn: nueva.expiraEn ?? null,
      ejecucionId: null,
      fuenteId: "fuente_manual",
      nichoSlug: nueva.nichoSlug ?? null,
    });
    registrarDecision(id, null, "anadir_url", null);
    return { creada: true, id, estado: "detectada" };
  }

  // --- Ajustes ---------------------------------------------------------------------------------

  function guardarAjustesAhora(cambios: CambiosDeAjustes): Ajustes {
    const claves = Object.keys(cambios) as (keyof CambiosDeAjustes)[];
    if (claves.length === 0)
      throw new ErrorDeCliente(400, "Cambia al menos un ajuste.");
    const { topeSemanal, umbralDeSimilitud, umbralesPorObjetivo, pausa } =
      cambios;
    if (
      topeSemanal !== undefined &&
      (!Number.isInteger(topeSemanal) || topeSemanal < 0 || topeSemanal > 20)
    ) {
      throw new ErrorDeCliente(400, "El tope semanal va de 0 a 20 contactos.");
    }
    if (
      umbralDeSimilitud !== undefined &&
      (!(umbralDeSimilitud >= 0.4) || !(umbralDeSimilitud <= 0.9))
    ) {
      throw new ErrorDeCliente(400, "El umbral de similitud va de 0,4 a 0,9.");
    }
    if (umbralesPorObjetivo !== undefined) {
      const valores = [
        umbralesPorObjetivo.TRAFICO_MARCA,
        umbralesPorObjetivo.LEADS,
        umbralesPorObjetivo.BACKLINKS,
      ];
      if (valores.some((v) => !Number.isInteger(v) || v < 0 || v > 100)) {
        throw new ErrorDeCliente(
          400,
          "Cada umbral va de 0 a 100 y hay que dar los tres."
        );
      }
    }
    const antes = copiar(almacen.ajustes.valores);
    const ahora = ahoraIso();
    const cambiados: string[] = [];
    if (topeSemanal !== undefined) {
      almacen.ajustes.valores.topeSemanal = topeSemanal;
      cambiados.push(`topeSemanal: ${antes.topeSemanal} -> ${topeSemanal}`);
      almacen.ajustes.actualizadoEn.topeSemanal = ahora;
    }
    if (umbralDeSimilitud !== undefined) {
      almacen.ajustes.valores.umbralDeSimilitud = umbralDeSimilitud;
      cambiados.push(
        `umbralDeSimilitud: ${antes.umbralDeSimilitud} -> ${umbralDeSimilitud}`
      );
      almacen.ajustes.actualizadoEn.umbralDeSimilitud = ahora;
    }
    if (umbralesPorObjetivo !== undefined) {
      almacen.ajustes.valores.umbralesPorObjetivo = { ...umbralesPorObjetivo };
      cambiados.push(
        `umbralesPorObjetivo: ${JSON.stringify(antes.umbralesPorObjetivo)} -> ${JSON.stringify(umbralesPorObjetivo)}`
      );
      almacen.ajustes.actualizadoEn.umbralesPorObjetivo = ahora;
    }
    if (pausa !== undefined) {
      almacen.ajustes.valores.pausa = pausa;
      cambiados.push(`pausa: ${antes.pausa} -> ${pausa}`);
      almacen.ajustes.actualizadoEn.pausa = ahora;
    }
    registrarDecision(null, null, "ajustes", cambiados.join("; "));
    return aAjustes();
  }

  // --- La interfaz ------------------------------------------------------------------------------

  return {
    yo: () => responder(() => ({ email: CORREO_DE_DEMOSTRACION })),

    resumen: () =>
      responder((): Resumen => {
        const oportunidades = almacen.oportunidades;
        const sieteDias = ahoraMs() - 7 * DIA;
        const descartes = almacen.decisiones.filter(
          (d) => d.accion === "descartar" && Date.parse(d.en) >= sieteDias
        );
        const descartadas = descartes
          .map((d) => oportunidadPorId(d.oportunidadId ?? ""))
          .filter((o): o is RegistroDeOportunidad => o !== undefined);
        const porMotivo = Object.entries(
          conteoPor(descartadas, (o) => o.datos?.codigoDescarte ?? "otro")
        )
          .map(([codigo, n]) => ({ codigo, n }))
          .sort((a, b) => b.n - a.n || a.codigo.localeCompare(b.codigo));
        const ultima = [...almacen.ejecuciones].sort(
          (a, b) => Date.parse(b.inicio) - Date.parse(a.inicio)
        )[0];
        const porCaducar = oportunidades
          .filter(
            (o) =>
              (o.estado === "aprobada" ||
                o.estado === "pendiente_aprobacion") &&
              o.expiraEn !== null &&
              Date.parse(o.expiraEn) > ahoraMs() &&
              Date.parse(o.expiraEn) <= ahoraMs() + 7 * DIA
          )
          .sort((a, b) => Date.parse(a.expiraEn!) - Date.parse(b.expiraEn!))
          .slice(0, 5)
          .map((o) => ({
            id: o.id,
            titulo: o.titulo,
            dominio: o.dominio,
            estado: o.estado,
            expiraEn: o.expiraEn!,
            diasParaCaducar: diasParaCaducar(o.expiraEn) ?? 0,
          }));
        const porEstado = porEstadoCompleto(oportunidades);
        const contactos = contactosDeLaSemana();
        return {
          pausa: almacen.ajustes.valores.pausa,
          ajustes: almacen.ajustes.valores,
          porEstado,
          paraRevisar: porEstado.pendiente_aprobacion,
          aprobadasSinGestionar: porEstado.aprobada,
          bloqueadas: porEstado.bloqueada,
          devueltas: porEstado.devuelta,
          porCaducar,
          contactos: {
            // Como el backend: `estaSemana` = hechas + aprobadas sin gestionar.
            estaSemana: contactos.total,
            hechas: contactos.hechas,
            aprobadasSinGestionar: contactos.aprobadasSinGestionar,
            tope: almacen.ajustes.valores.topeSemanal,
          },
          descartesUltimos7Dias: { total: descartes.length, porMotivo },
          ultimaEjecucion: ultima
            ? {
                id: ultima.id,
                disparador: ultima.disparador,
                estado: ultima.estado,
                inicio: ultima.inicio,
                fin: ultima.fin,
              }
            : null,
          conocimiento: snapshotActual(),
          tokens: {
            activos: 1,
            ultimoUso: almacen.ejecuciones[0]?.fin ?? null,
          },
        };
      }),

    listarOportunidades: (filtros = {}) =>
      responder((): ListaDeOportunidades => {
        if (
          filtros.q !== undefined &&
          (filtros.q.length < 1 || filtros.q.length > 100)
        ) {
          throw new ErrorDeCliente(
            400,
            "La búsqueda admite de 1 a 100 caracteres."
          );
        }
        const sinEstado = filtrarOportunidades(filtros, false);
        const conEstado = filtrarOportunidades(filtros, true);
        const ordenadas = ordenar(conEstado, filtros.orden);
        const { data, ...resto } = pagina(ordenadas, filtros);
        return {
          data: data.map(aResumen),
          ...resto,
          conteos: { porEstado: porEstadoCompleto(sinEstado) },
        };
      }),

    anadirUrl: (nueva) => responder(() => anadirUrlAhora(nueva)),

    detalleDeOportunidad: (id) =>
      responder(() => aDetalle(oportunidadObligatoria(id))),

    decidir: (id, decision) => responder(() => decidirAhora(id, decision)),

    listarBorradores: (filtros: FiltrosDeBorradores = {}) =>
      responder((): ListaDeBorradores => {
        const oportunidad = (b: RegistroDeBorrador) =>
          oportunidadPorId(b.oportunidadId);
        const q = filtros.q?.trim().toLowerCase();
        const base = almacen.borradores.filter((b) => {
          const o = oportunidad(b);
          if (!o) return false;
          if (filtros.objetivo && b.objetivo !== filtros.objetivo) return false;
          if (filtros.tipo && b.tipo !== filtros.tipo) return false;
          if (
            q &&
            ![b.asunto ?? "", b.texto, o.dominio].some((t) =>
              t.toLowerCase().includes(q)
            )
          ) {
            return false;
          }
          return true;
        });
        const grupo = filtros.grupo ?? "pendientes";
        const conteos = Object.fromEntries(
          GRUPOS_DE_BORRADORES.map((g) => [
            g,
            base.filter((b) =>
              gruposDeBorrador(b.estado, oportunidad(b)?.estado).includes(g)
            ).length,
          ])
        ) as Record<GrupoDeBorradores, number>;
        const delGrupo = base.filter((b) =>
          gruposDeBorrador(b.estado, oportunidad(b)?.estado).includes(grupo)
        );
        const ordenados = [...delGrupo].sort((a, b) => {
          if (filtros.orden === "caducan") {
            const ea = oportunidad(a)?.expiraEn;
            const eb = oportunidad(b)?.expiraEn;
            const va = ea ? Date.parse(ea) : Infinity;
            const vb = eb ? Date.parse(eb) : Infinity;
            if (va !== vb) return va - vb;
          }
          return Date.parse(b.creadoEn) - Date.parse(a.creadoEn);
        });
        const { data, ...resto } = pagina(ordenados, filtros);
        return {
          data: data.map((b) => aResumenDeBorrador(b, oportunidad(b)!)),
          ...resto,
          conteos,
        };
      }),

    detalleDeBorrador: (id) =>
      responder((): DetalleDeBorrador => {
        const borrador = almacen.borradores.find((b) => b.id === id);
        if (!borrador) throw new ErrorDeCliente(404, "El borrador no existe.");
        const o = oportunidadObligatoria(borrador.oportunidadId);
        return {
          ...aDetalleDeBorrador(borrador),
          oportunidad: {
            id: o.id,
            titulo: o.titulo,
            dominio: o.dominio,
            url: o.url,
            estado: o.estado,
            objetivoPrincipal: o.objetivoPrincipal,
            expiraEn: o.expiraEn,
          },
          esEditable: esEditable(borrador, o),
        };
      }),

    editarBorrador: (id, cambios) => responder(() => editarAhora(id, cambios)),

    listarDecisiones: (filtros: FiltrosDeDecisiones = {}) =>
      responder((): ListaDeDecisiones => {
        const desde = filtros.fechaDesde
          ? Date.parse(filtros.fechaDesde)
          : null;
        const hasta = filtros.fechaHasta
          ? Date.parse(filtros.fechaHasta)
          : null;
        const coincide = (
          d: (typeof almacen.decisiones)[number],
          conAccion: boolean
        ) => {
          if (conAccion && filtros.accion && d.accion !== filtros.accion)
            return false;
          if (
            filtros.oportunidadId &&
            d.oportunidadId !== filtros.oportunidadId
          )
            return false;
          if (filtros.borradorId && d.borradorId !== filtros.borradorId)
            return false;
          if (filtros.por && d.por !== filtros.por) return false;
          if (filtros.soloSistema && d.oportunidadId !== null) return false;
          if (desde !== null && Date.parse(d.en) < desde) return false;
          if (hasta !== null && Date.parse(d.en) > hasta) return false;
          return true;
        };
        const ordenadas = masRecientePrimero(
          almacen.decisiones.filter((d) => coincide(d, true)),
          (d) => d.en
        );
        const { data, ...resto } = pagina(ordenadas, filtros);
        return {
          data: data.map((d) => {
            const o = d.oportunidadId
              ? oportunidadPorId(d.oportunidadId)
              : undefined;
            const b = d.borradorId
              ? almacen.borradores.find((x) => x.id === d.borradorId)
              : undefined;
            return {
              id: d.id,
              accion: d.accion,
              motivo: d.motivo,
              por: d.por,
              en: d.en,
              oportunidad: o
                ? {
                    id: o.id,
                    titulo: o.titulo,
                    dominio: o.dominio,
                    url: o.url,
                    estado: o.estado,
                  }
                : null,
              borrador: b
                ? { id: b.id, version: b.version, tipo: b.tipo }
                : null,
            };
          }),
          ...resto,
          conteos: {
            porAccion: conteoPor(
              almacen.decisiones.filter((d) => coincide(d, false)),
              (d) => d.accion
            ),
          },
        };
      }),

    listarGestiones: (filtros: FiltrosDeGestiones = {}) =>
      responder((): ListaDeGestiones => {
        const desde = filtros.fechaDesde
          ? Date.parse(filtros.fechaDesde)
          : null;
        const hasta = filtros.fechaHasta
          ? Date.parse(filtros.fechaHasta)
          : null;
        const coincide = (
          g: (typeof almacen.gestiones)[number],
          conResultado: boolean
        ) => {
          if (
            conResultado &&
            filtros.resultado &&
            g.resultado !== filtros.resultado
          ) {
            return false;
          }
          if (filtros.canal && g.canal !== filtros.canal) return false;
          if (filtros.dominio && g.dominio !== filtros.dominio) return false;
          if (desde !== null && Date.parse(g.hechaEn) < desde) return false;
          if (hasta !== null && Date.parse(g.hechaEn) > hasta) return false;
          return true;
        };
        const ordenadas = masRecientePrimero(
          almacen.gestiones.filter((g) => coincide(g, true)),
          (g) => g.hechaEn
        );
        const { data, ...resto } = pagina(ordenadas, filtros);
        return {
          data: data.flatMap((g) => {
            const b = almacen.borradores.find((x) => x.id === g.borradorId);
            const o = b ? oportunidadPorId(b.oportunidadId) : undefined;
            if (!b || !o) return [];
            return [
              {
                id: g.id,
                canal: g.canal,
                dominio: g.dominio,
                hechaEn: g.hechaEn,
                respuestaEn: g.respuestaEn,
                resultado: g.resultado,
                urlConseguida: g.urlConseguida,
                notas: g.notas,
                borrador: {
                  id: b.id,
                  version: b.version,
                  tipo: b.tipo,
                  asunto: b.asunto,
                  textoFinal: b.textoFinal,
                  editadoPorHumano: b.editadoPorHumano,
                },
                oportunidad: {
                  id: o.id,
                  titulo: o.titulo,
                  url: o.url,
                  estado: o.estado,
                  objetivoPrincipal: o.objetivoPrincipal,
                },
              },
            ];
          }),
          ...resto,
          conteos: {
            porResultado: conteoPor(
              almacen.gestiones.filter((g) => coincide(g, false)),
              (g) => g.resultado
            ),
          },
        };
      }),

    conocimiento: (tipo) =>
      responder((): RespuestaDeConocimiento => {
        const vigentes = afirmacionesVigentes();
        const aAfirmacion = (a: (typeof vigentes)[number]): Afirmacion => ({
          id: a.id,
          clave: a.clave,
          tipo: a.tipo,
          texto: a.texto,
          valor: a.valor,
          fuente: a.fuente,
          commitSha: a.commitSha,
          nichoSlug: a.nichoSlug,
          vigenteDesde: a.vigenteDesde,
        });
        const porTipo = Object.fromEntries(
          TIPOS_DE_AFIRMACION.map((t) => [
            t,
            !tipo || tipo === t
              ? vigentes
                  .filter((a) => a.tipo === t)
                  .sort((a, b) => a.clave.localeCompare(b.clave))
                  .map(aAfirmacion)
              : [],
          ])
        ) as Record<TipoDeAfirmacion, Afirmacion[]>;
        const conteos = Object.fromEntries(
          TIPOS_DE_AFIRMACION.map((t) => [
            t,
            vigentes.filter((a) => a.tipo === t).length,
          ])
        ) as Record<TipoDeAfirmacion, number>;
        const treintaDias = ahoraMs() - 30 * DIA;
        const cambios = almacen.afirmaciones.flatMap((a) => {
          const eventos: RespuestaDeConocimiento["cambiosRecientes"] = [];
          if (Date.parse(a.vigenteDesde) >= treintaDias) {
            eventos.push({
              clave: a.clave,
              tipo: a.tipo,
              cambio: "alta",
              en: a.vigenteDesde,
              commitSha: a.commitSha,
            });
          }
          if (a.vigenteHasta && Date.parse(a.vigenteHasta) >= treintaDias) {
            eventos.push({
              clave: a.clave,
              tipo: a.tipo,
              cambio: "cierre",
              en: a.vigenteHasta,
              commitSha: a.commitSha,
            });
          }
          return eventos;
        });
        return {
          snapshot: snapshotActual(),
          conteos,
          porTipo,
          cambiosRecientes: cambios
            .sort((a, b) => Date.parse(b.en) - Date.parse(a.en))
            .slice(0, 50),
          truncado: false,
        };
      }),

    historialDeAfirmacion: (clave) =>
      responder((): HistorialDeAfirmacion => {
        const versiones = almacen.afirmaciones
          .filter((a) => a.clave === clave)
          .sort(
            (a, b) => Date.parse(b.vigenteDesde) - Date.parse(a.vigenteDesde)
          )
          .map((a) => ({
            id: a.id,
            tipo: a.tipo,
            texto: a.texto,
            valor: a.valor,
            fuente: a.fuente,
            commitSha: a.commitSha,
            vigenteDesde: a.vigenteDesde,
            vigenteHasta: a.vigenteHasta,
          }));
        if (versiones.length === 0) {
          throw new ErrorDeCliente(404, "Esa afirmación no existe.");
        }
        return { clave, versiones };
      }),

    listarEjecuciones: (filtros: FiltrosDeEjecuciones = {}) =>
      responder((): ListaDeEjecuciones => {
        const ordenadas = almacen.ejecuciones
          .filter(
            (e) =>
              (!filtros.estado || e.estado === filtros.estado) &&
              (!filtros.disparador || e.disparador === filtros.disparador)
          )
          .sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio));
        const { data, ...resto } = pagina(ordenadas, filtros);
        return {
          data: data.map((e) => ({
            ...e,
            duracionSegundos: e.fin
              ? Math.round((Date.parse(e.fin) - Date.parse(e.inicio)) / 1000)
              : null,
            oportunidades: almacen.oportunidades.filter(
              (o) => o.ejecucionId === e.id
            ).length,
          })),
          ...resto,
        };
      }),

    detalleDeEjecucion: (id) =>
      responder((): DetalleDeEjecucion => {
        const ejecucion = almacen.ejecuciones.find((e) => e.id === id);
        if (!ejecucion)
          throw new ErrorDeCliente(404, "La ejecución no existe.");
        const suyas = almacen.oportunidades.filter((o) => o.ejecucionId === id);
        return {
          ...ejecucion,
          duracionSegundos: ejecucion.fin
            ? Math.round(
                (Date.parse(ejecucion.fin) - Date.parse(ejecucion.inicio)) /
                  1000
              )
            : null,
          oportunidadesPorEstado: Object.fromEntries(
            Object.entries(porEstadoCompleto(suyas)).filter(([, n]) => n > 0)
          ),
          descartesPorMotivo: descartesDe(suyas),
          oportunidades: suyas.slice(0, 200).map((o) => ({
            id: o.id,
            titulo: o.titulo,
            dominio: o.dominio,
            estado: o.estado,
            objetivoPrincipal: o.objetivoPrincipal,
            codigoDescarte: o.datos?.codigoDescarte ?? null,
          })),
        };
      }),

    ajustes: () => responder(aAjustes),

    guardarAjustes: (cambios) => responder(() => guardarAjustesAhora(cambios)),

    competidores: () => responder(() => ({ data: competencia.listar() })),
    detalleDeCompetidor: (id) => responder(() => competencia.detalle(id)),
    analisisDeCompetidor: (id, analisisId) =>
      responder(() => competencia.analisis(id, analisisId)),
    anadirCompetidor: (alta) => responder(() => competencia.anadir(alta)),
    editarCompetidor: (id, cambios) =>
      responder(() => competencia.editar(id, cambios)),
    // 204 sin cuerpo: no hay nada que copiar.
    quitarCompetidor: async (id) => {
      await esperar();
      competencia.quitar(id);
    },
    aceptarCompetidor: (id) => responder(() => competencia.aceptar(id)),
    reanalizarCompetidor: (id) => responder(() => competencia.reanalizar(id)),
    revisarAnalisis: (id, analisisId, revision) =>
      responder(() => competencia.revisar(id, analisisId, revision)),
  };
}
