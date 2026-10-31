import type { Tono } from "@/lib/etiquetas";
import type {
  Afirmacion,
  DatoDeCompetidor,
  FilaDelComparador,
  MonedaDePrecio,
  ValorDePrecio,
} from "@/lib/types";
import { formatearPrecio } from "./utilidades";

/**
 * Lo que el comparador calcula con las filas que manda el backend: el precio
 * de entrada para ordenarlas, los datos de cada columna, el estado del
 * análisis y los planes de Alhabla (que salen de la base de conocimiento, no
 * de un análisis). Todo es puro: sin red ni reloj.
 */

// ---------------------------------------------------------------------------
// Precio de entrada
// ---------------------------------------------------------------------------

export type PrecioDeEntrada = {
  /** El importe al mes (un precio anual se divide entre 12). */
  importeMensual: number;
  moneda: MonedaDePrecio;
  /** `true` si no es un precio mensual publicado sino el anual dividido entre 12. */
  equivalente: boolean;
  /** «Desde 79 € al mes» o «Desde 790 € al año (≈ 65,83 € al mes)». */
  texto: string;
};

/** Las monedas, en el orden en que se ordenan: no se convierten entre sí. */
const ORDEN_DE_MONEDAS: readonly MonedaDePrecio[] = ["EUR", "USD", "GBP"];

const redondear = (importe: number) => Math.round(importe * 100) / 100;

type Candidato = { valor: ValorDePrecio; importeMensual: number };

function candidatosAPrecioDeEntrada(
  datos: readonly DatoDeCompetidor[]
): Candidato[] {
  return datos.flatMap((dato): Candidato[] => {
    const valor = dato.valor;
    if (
      (dato.tipo !== "plan" && dato.tipo !== "precio") ||
      !valor ||
      !Number.isFinite(valor.importe) ||
      valor.importe < 0
    ) {
      return [];
    }
    if (valor.periodo === "mes") {
      return [{ valor, importeMensual: valor.importe }];
    }
    if (valor.periodo === "anio") {
      return [{ valor, importeMensual: valor.importe / 12 }];
    }
    // «por uso» y «pago único» no son una cuota: no son un precio de entrada.
    return [];
  });
}

/**
 * El plan más barato de un competidor, a un mes. Solo cuentan los datos de
 * tipo `plan` o `precio` con un precio estructurado y periodo mes o año. Si
 * publica en varias monedas gana la primera de EUR, USD, GBP (no se
 * convierten). Sin precio, `null`.
 */
export function precioDeEntrada(
  datos: readonly DatoDeCompetidor[]
): PrecioDeEntrada | null {
  const candidatos = candidatosAPrecioDeEntrada(datos);
  if (candidatos.length === 0) return null;
  const moneda = ORDEN_DE_MONEDAS.find((m) =>
    candidatos.some((c) => c.valor.moneda === m)
  );
  if (!moneda) return null;
  const mejor = candidatos
    .filter((c) => c.valor.moneda === moneda)
    .reduce((a, b) => (b.importeMensual < a.importeMensual ? b : a));
  const equivalente = mejor.valor.periodo !== "mes";
  const mensual = redondear(mejor.importeMensual);
  // Sin el IVA ni la unidad: la fila los enseña en cada plan.
  const publicado = formatearPrecio({
    ...mejor.valor,
    ivaIncluido: undefined,
    unidad: undefined,
  });
  const texto = equivalente
    ? `Desde ${publicado} (≈ ${formatearPrecio({ importe: mensual, moneda, periodo: "mes" })})`
    : `Desde ${publicado}`;
  return { importeMensual: mensual, moneda, equivalente, texto };
}

/**
 * Las filas por precio de entrada, de menor a mayor. Primero las que tienen
 * precio (por moneda, y dentro de ella por importe al mes) y al final las que
 * no, por nombre. Es estable: a igual precio, el orden de entrada.
 */
export function ordenarPorPrecioDeEntrada(
  filas: readonly FilaDelComparador[]
): FilaDelComparador[] {
  return filas
    .map((fila, indice) => ({
      fila,
      indice,
      entrada: precioDeEntrada(fila.datos),
    }))
    .sort((a, b) => {
      if (a.entrada && b.entrada) {
        return (
          ORDEN_DE_MONEDAS.indexOf(a.entrada.moneda) -
            ORDEN_DE_MONEDAS.indexOf(b.entrada.moneda) ||
          a.entrada.importeMensual - b.entrada.importeMensual ||
          a.indice - b.indice
        );
      }
      if (a.entrada) return -1;
      if (b.entrada) return 1;
      return a.indice - b.indice;
    })
    .map(({ fila }) => fila);
}

// ---------------------------------------------------------------------------
// Datos de cada columna
// ---------------------------------------------------------------------------

export type ColumnasDeDatos = {
  /** Planes y precios, en el orden del agente. */
  precios: DatoDeCompetidor[];
  /** Límites (minutos, profesionales…). */
  limites: DatoDeCompetidor[];
  /** Integraciones, idiomas y canales, como etiquetas. */
  etiquetas: DatoDeCompetidor[];
};

export function columnasDeDatos(
  datos: readonly DatoDeCompetidor[]
): ColumnasDeDatos {
  return {
    precios: datos.filter((d) => d.tipo === "plan" || d.tipo === "precio"),
    limites: datos.filter((d) => d.tipo === "limite"),
    etiquetas: datos.filter(
      (d) =>
        d.tipo === "integracion" || d.tipo === "idioma" || d.tipo === "canal"
    ),
  };
}

// ---------------------------------------------------------------------------
// Estado del análisis
// ---------------------------------------------------------------------------

export type SituacionDelAnalisis = {
  etiqueta: string;
  tono: Tono;
  caducado: boolean;
};

/**
 * Cómo está el análisis de una fila: «Sin analizar» (aún no hay ninguno),
 * «Pendiente de revisión» (lo guardó el agente y no lo has dado por bueno) o
 * «Revisado»; y aparte, si ya caducó (más de 90 días).
 */
export function situacionDelAnalisis(
  fila: Pick<FilaDelComparador, "analisis">
): SituacionDelAnalisis {
  const { analisis } = fila;
  if (!analisis) {
    return { etiqueta: "Sin analizar", tono: "neutro", caducado: false };
  }
  return analisis.revisadoEn
    ? { etiqueta: "Revisado", tono: "exito", caducado: analisis.caducado }
    : {
        etiqueta: "Pendiente de revisión",
        tono: "morado",
        caducado: analisis.caducado,
      };
}

// ---------------------------------------------------------------------------
// Alhabla
// ---------------------------------------------------------------------------

export type PlanDeAlhabla = {
  clave: string;
  /** «Inicio», «Pro», «Scale». */
  nombre: string;
  cuota: number | null;
  minutosIncluidos: number | null;
  minutoExtra: number | null;
  /** La afirmación tal cual, por si faltan los números. */
  texto: string;
  /** `ruta#ancla`. */
  fuente: string;
  vigenteDesde: string;
};

const numeroONulo = (valor: unknown): number | null =>
  typeof valor === "number" && Number.isFinite(valor) ? valor : null;

function nombreDeLaClave(clave: string): string {
  const id = clave.slice("precio.plan.".length);
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * Los planes de Alhabla, de las afirmaciones `precio.plan.*` vigentes: cuota,
 * minutos incluidos y minuto extra salen de su `valor`; si el `valor` no trae
 * un número, ese campo queda en `null` y se enseña el texto de la afirmación.
 * Del más barato al más caro.
 */
export function planesDeAlhabla(
  afirmaciones: readonly Afirmacion[]
): PlanDeAlhabla[] {
  return afirmaciones
    .filter((a) => a.clave.startsWith("precio.plan."))
    .map((a): PlanDeAlhabla => {
      const valor =
        a.valor !== null && typeof a.valor === "object"
          ? (a.valor as Record<string, unknown>)
          : {};
      return {
        clave: a.clave,
        nombre:
          typeof valor.plan === "string" && valor.plan !== ""
            ? valor.plan.charAt(0).toUpperCase() + valor.plan.slice(1)
            : nombreDeLaClave(a.clave),
        cuota: numeroONulo(valor.cuotaEur),
        minutosIncluidos: numeroONulo(valor.minutosIncluidos),
        minutoExtra: numeroONulo(valor.minutoExtraEur),
        texto: a.texto,
        fuente: a.fuente,
        vigenteDesde: a.vigenteDesde,
      };
    })
    .sort(
      (a, b) =>
        (a.cuota ?? Number.POSITIVE_INFINITY) -
          (b.cuota ?? Number.POSITIVE_INFINITY) ||
        a.clave.localeCompare(b.clave)
    );
}

/** 1500 → «1.500»: con punto de millar también en cuatro cifras, como en la web. */
export function conMiles(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
