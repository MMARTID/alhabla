import type { AfirmacionSincronizada, TipoDeAfirmacion } from "../esquemas.js";
import { normalizarTermino } from "./terminos.js";

/**
 * El diff de la sincronización del conocimiento (PLAN-GROWTH.md § 3.1). Es
 * PURO: sin Prisma ni reloj, para poder probarlo con tablas de casos. Lo usa
 * `sincronizar.ts` dentro de la transacción y también la simulación
 * (`?simular=true`), así lo que se ve antes de aplicar es lo que se aplica.
 */

/** Una afirmación vigente (`vigenteHasta` nulo) tal como está en la base. */
export type AfirmacionVigente = {
  id: string;
  clave: string;
  tipo: string;
  texto: string;
  valor: unknown;
  fuente: string;
  commitSha: string;
  nichoSlug: string | null;
  vigenteDesde: Date;
};

export type CampoQueCambia =
  "tipo" | "texto" | "valor" | "fuente" | "nichoSlug";

export type Reemplazo = {
  vigente: AfirmacionVigente;
  nueva: AfirmacionSincronizada;
  campos: CampoQueCambia[];
  /**
   * Cambia lo que dice (tipo, texto o valor). Si solo cambia la fuente o el
   * nicho la afirmación se versiona igual, pero los borradores que la citan
   * siguen siendo ciertos y no se bloquean.
   */
  semantico: boolean;
};

export type PlanDeSincronizacion = {
  crear: AfirmacionSincronizada[];
  reemplazar: Reemplazo[];
  /** Vigentes cuya clave ya no está en el lote. */
  cerrar: AfirmacionVigente[];
  /**
   * Vigentes que comparten clave con otra (el invariante «una vigente por
   * clave» lo garantiza el algoritmo, no la base). Se cierran siempre y se
   * avisa; no cuentan para la guarda de cierres masivos.
   */
  sobrantes: AfirmacionVigente[];
  iguales: AfirmacionVigente[];
};

/**
 * JSON con las claves ordenadas, tras el viaje por `JSON` que hace `jsonb`
 * (reordena claves y normaliza números). `null` y `undefined` son lo mismo.
 */
export function canonico(valor: unknown): string {
  if (valor === undefined || valor === null) return "null";
  const ordenar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(ordenar);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([, x]) => x !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => [k, ordenar(x)])
      );
    }
    return v;
  };
  return JSON.stringify(ordenar(JSON.parse(JSON.stringify(valor))));
}

/** Los campos en los que `nueva` difiere de `vigente` (`commitSha` no cuenta). */
export function camposQueCambian(
  vigente: AfirmacionVigente,
  nueva: AfirmacionSincronizada
): CampoQueCambia[] {
  const campos: CampoQueCambia[] = [];
  if (vigente.tipo !== nueva.tipo) campos.push("tipo");
  if (vigente.texto !== nueva.texto) campos.push("texto");
  if (canonico(vigente.valor) !== canonico(nueva.valor)) campos.push("valor");
  if (vigente.fuente !== nueva.fuente) campos.push("fuente");
  if ((vigente.nichoSlug ?? null) !== (nueva.nichoSlug ?? null)) {
    campos.push("nichoSlug");
  }
  return campos;
}

const CAMPOS_SEMANTICOS: readonly CampoQueCambia[] = ["tipo", "texto", "valor"];

export function planificar(
  vigentes: readonly AfirmacionVigente[],
  nuevas: readonly AfirmacionSincronizada[],
  tiposCubiertos: readonly TipoDeAfirmacion[]
): PlanDeSincronizacion {
  const cubiertos = new Set<string>(tiposCubiertos);
  // Más reciente primero: de las repetidas se queda la última.
  const ordenadas = [...vigentes]
    .filter((v) => cubiertos.has(v.tipo))
    .sort(
      (a, b) =>
        b.vigenteDesde.getTime() - a.vigenteDesde.getTime() ||
        (a.id < b.id ? -1 : 1)
    );

  const porClave = new Map<string, AfirmacionVigente>();
  const sobrantes: AfirmacionVigente[] = [];
  for (const v of ordenadas) {
    if (porClave.has(v.clave)) sobrantes.push(v);
    else porClave.set(v.clave, v);
  }

  const plan: PlanDeSincronizacion = {
    crear: [],
    reemplazar: [],
    cerrar: [],
    sobrantes,
    iguales: [],
  };

  const clavesNuevas = new Set<string>();
  for (const nueva of nuevas) {
    clavesNuevas.add(nueva.clave);
    const vigente = porClave.get(nueva.clave);
    if (!vigente) {
      plan.crear.push(nueva);
      continue;
    }
    const campos = camposQueCambian(vigente, nueva);
    if (campos.length === 0) {
      plan.iguales.push(vigente);
    } else {
      plan.reemplazar.push({
        vigente,
        nueva,
        campos,
        semantico: campos.some((c) => CAMPOS_SEMANTICOS.includes(c)),
      });
    }
  }

  for (const [clave, vigente] of porClave) {
    if (!clavesNuevas.has(clave)) plan.cerrar.push(vigente);
  }
  plan.cerrar.sort((a, b) => (a.clave < b.clave ? -1 : 1));
  return plan;
}

/** Las claves cuyo significado cambió o desapareció: las que dejan obsoleto un borrador. */
export function clavesAfectadas(plan: PlanDeSincronizacion): string[] {
  return [
    ...new Set([
      ...plan.cerrar.map((v) => v.clave),
      ...plan.reemplazar.filter((r) => r.semantico).map((r) => r.vigente.clave),
    ]),
  ].sort();
}

/** Una sincronización que no cambia ninguna afirmación. */
export function planSinCambios(plan: PlanDeSincronizacion): boolean {
  return (
    plan.crear.length === 0 &&
    plan.reemplazar.length === 0 &&
    plan.cerrar.length === 0 &&
    plan.sobrantes.length === 0
  );
}

// ── Guardas ──────────────────────────────────────────────────────────────
//
// Un token con alcance `conocimiento` es de quien sincroniza, no de quien
// redacta, pero el servidor no puede saber qué hay detrás de un lote: se
// protege de lo que un extractor roto o un token mal usado haría con las
// reglas duras 1, 2 y 3, que cuelgan de esta base. Las guardas miran el diff
// (lo que cambiaría), no el lote: por eso son puras y comparten código con la
// simulación.

/**
 * Cierres de un mismo tipo en una pasada que se consideran una avería del
 * extractor, no un cambio del repo: más de 2, o más del 25 % de los vigentes
 * de ese tipo. Sin suelo: con pocas filas el 25 % sigue significando algo
 * (una `prohibida` es el 20 % de las cinco que hay).
 */
export const MAXIMO_DE_CIERRES_POR_TIPO = 2;
export const FRACCION_MAXIMA_DE_CIERRES_POR_TIPO = 0.25;
/**
 * Cierres más cambios de sentido (modificaciones) de toda la pasada: si pasan
 * de esta fracción de lo vigente (y de este mínimo) se reescribe casi toda la
 * base de una vez. Un precio nuevo o el refresco de las comparativas quedan
 * muy por debajo.
 */
export const FRACCION_MAXIMA_DE_CAMBIOS = 0.6;
export const MINIMO_DE_CAMBIOS_PARA_MEDIR_LA_FRACCION = 30;

export type CambiosDeUnTipo = {
  tipo: string;
  vigentes: number;
  cierres: number;
  /** Modificaciones que cambian el sentido (tipo, texto o valor). */
  modificadas: number;
};

export type ExamenDeCierres = {
  masivo: boolean;
  motivo: string | null;
  /** Tipos cubiertos que tienen vigentes y no traen ni una afirmación nueva. */
  tiposVaciados: string[];
  /** Tipos cuyos cierres pasan el límite por tipo. */
  tiposConDemasiadosCierres: string[];
  /** Cierres y modificaciones por cada tipo cubierto con vigentes o cambios. */
  porTipo: CambiosDeUnTipo[];
};

function porcentaje(fraccion: number): string {
  return `${Math.round(fraccion * 100)} %`;
}

/**
 * ¿Parece que un extractor roto (o un token mal usado) va a vaciar o a
 * reescribir la base? Sí si:
 *  - un tipo cubierto se queda sin una sola afirmación nueva y tiene vigentes;
 *  - de un mismo tipo se cierran más de 2 afirmaciones o más del 25 % de sus
 *    vigentes (por tipo y sin suelo: lo que se retira de un tipo no se compensa
 *    con lo que sobra en otro);
 *  - los cierres y las modificaciones de sentido pasan del 60 % de todo lo
 *    vigente cubierto (y de 30).
 * Solo `forzarCierres` (un administrador) lo salta.
 */
export function examinarCierres(
  plan: PlanDeSincronizacion,
  vigentesCubiertas: number,
  nuevas: readonly { tipo: string }[],
  vigentes: readonly { tipo: string }[],
  tiposCubiertos: readonly string[]
): ExamenDeCierres {
  const traidos = new Set(nuevas.map((n) => n.tipo));
  const tiposVaciados = tiposCubiertos.filter(
    (tipo) => !traidos.has(tipo) && vigentes.some((v) => v.tipo === tipo)
  );

  const porTipo: CambiosDeUnTipo[] = [...new Set(tiposCubiertos)].map(
    (tipo) => ({
      tipo,
      vigentes: vigentes.filter((v) => v.tipo === tipo).length,
      cierres: plan.cerrar.filter((v) => v.tipo === tipo).length,
      modificadas: plan.reemplazar.filter(
        (r) => r.semantico && r.vigente.tipo === tipo
      ).length,
    })
  );
  const tiposConDemasiadosCierres = porTipo
    .filter(
      (t) =>
        t.cierres > MAXIMO_DE_CIERRES_POR_TIPO ||
        (t.vigentes > 0 &&
          t.cierres / t.vigentes > FRACCION_MAXIMA_DE_CIERRES_POR_TIPO)
    )
    .map((t) => t.tipo);

  const cierres = plan.cerrar.length;
  const modificadas = plan.reemplazar.filter((r) => r.semantico).length;
  const cambios = cierres + modificadas;

  const resultado = (motivo: string): ExamenDeCierres => ({
    masivo: true,
    motivo,
    tiposVaciados,
    tiposConDemasiadosCierres,
    porTipo,
  });

  if (tiposVaciados.length > 0) {
    return resultado(
      `El lote no trae ninguna afirmación de ${tiposVaciados.join(", ")} y la base tiene vigentes de ese tipo: se cerrarían todas.`
    );
  }
  if (tiposConDemasiadosCierres.length > 0) {
    const detalle = porTipo
      .filter((t) => tiposConDemasiadosCierres.includes(t.tipo))
      .map((t) => `${t.cierres} de ${t.vigentes} de tipo ${t.tipo}`)
      .join("; ");
    return resultado(
      `Se retirarían ${detalle} (el límite por tipo es ${MAXIMO_DE_CIERRES_POR_TIPO} afirmaciones y el ${porcentaje(FRACCION_MAXIMA_DE_CIERRES_POR_TIPO)} de las vigentes del tipo).`
    );
  }
  if (
    cambios > MINIMO_DE_CAMBIOS_PARA_MEDIR_LA_FRACCION &&
    vigentesCubiertas > 0 &&
    cambios / vigentesCubiertas > FRACCION_MAXIMA_DE_CAMBIOS
  ) {
    return resultado(
      `Se cambiarían ${cambios} de ${vigentesCubiertas} afirmaciones vigentes (${cierres} retiradas y ${modificadas} modificadas; más del ${porcentaje(FRACCION_MAXIMA_DE_CAMBIOS)}).`
    );
  }
  return {
    masivo: false,
    motivo: null,
    tiposVaciados,
    tiposConDemasiadosCierres,
    porTipo,
  };
}

// ── Prohibidas: solo se pueden añadir ────────────────────────────────────

export type DebilitamientoDeProhibida = {
  clave: string;
  motivo: "retirada" | "terminos_quitados" | "palabras_enteras";
  /** Los términos que dejarían de aplicarse (en una retirada, todos los de la regla). */
  terminos: string[];
};

function terminosDeProhibida(a: { texto: string; valor: unknown }): string[] {
  const valor = a.valor;
  if (
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor) &&
    Array.isArray((valor as Record<string, unknown>).terminos)
  ) {
    return ((valor as Record<string, unknown>).terminos as unknown[]).filter(
      (t): t is string => typeof t === "string"
    );
  }
  // Una regla sin lista aplica la frase de `texto` completa.
  return [a.texto];
}

function seBuscaComoPalabraEntera(valor: unknown): boolean {
  return !(
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor) &&
    (valor as Record<string, unknown>).palabrasEnteras === false
  );
}

/**
 * Lo que la sincronización quitaría de la lista de términos prohibidos. Con
 * un token de agente la lista solo puede crecer: se retira una regla, se
 * quita un término de una regla o se pasa de «palabra entera» a «contiene»
 * (que, entre otras cosas, deja de casar los términos de varias palabras con
 * espacios distintos) → debilita las reglas duras. Endurecer (reglas nuevas,
 * términos nuevos) no está aquí. `normalizar` es la comparación de términos:
 * mayúsculas, NFKC e invisibles no cuentan como un término distinto.
 */
export function prohibidasDebilitadas(
  plan: PlanDeSincronizacion,
  normalizar: (termino: string) => string = normalizarTermino
): DebilitamientoDeProhibida[] {
  const debilitamientos: DebilitamientoDeProhibida[] = [];

  for (const v of plan.cerrar.filter((x) => x.tipo === "prohibida")) {
    debilitamientos.push({
      clave: v.clave,
      motivo: "retirada",
      terminos: terminosDeProhibida(v),
    });
  }
  for (const r of plan.reemplazar) {
    if (r.vigente.tipo !== "prohibida") continue;
    const nuevos = new Set(
      terminosDeProhibida(r.nueva as { texto: string; valor: unknown }).map(
        normalizar
      )
    );
    const quitados = terminosDeProhibida(r.vigente).filter(
      (t) => !nuevos.has(normalizar(t))
    );
    if (quitados.length > 0) {
      debilitamientos.push({
        clave: r.vigente.clave,
        motivo: "terminos_quitados",
        terminos: quitados,
      });
    }
    if (
      seBuscaComoPalabraEntera(r.vigente.valor) &&
      !seBuscaComoPalabraEntera(r.nueva.valor)
    ) {
      debilitamientos.push({
        clave: r.vigente.clave,
        motivo: "palabras_enteras",
        terminos: terminosDeProhibida(
          r.nueva as { texto: string; valor: unknown }
        ),
      });
    }
  }
  return debilitamientos.sort((a, b) =>
    a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0
  );
}

const TEXTO_DEL_MOTIVO: Record<DebilitamientoDeProhibida["motivo"], string> = {
  retirada: "se retira la regla",
  terminos_quitados: "se quitan términos",
  palabras_enteras: "pasa de palabra entera a «contiene»",
};

/** Una línea por cada debilitamiento, para el mensaje de error. */
export function describirDebilitamientos(
  debilitamientos: readonly DebilitamientoDeProhibida[],
  maximo = 6
): string {
  const lineas = debilitamientos.slice(0, maximo).map((d) => {
    const terminos = d.terminos.slice(0, 5).join(", ");
    const resto =
      d.terminos.length > 5 ? ` y ${d.terminos.length - 5} más` : "";
    return `${d.clave} (${TEXTO_DEL_MOTIVO[d.motivo]}: ${terminos}${resto})`;
  });
  const masLineas =
    debilitamientos.length > maximo
      ? ` y ${debilitamientos.length - maximo} más`
      : "";
  return `${lineas.join("; ")}${masLineas}`;
}
