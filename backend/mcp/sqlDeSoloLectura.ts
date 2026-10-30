import pg from "./pg.js";

export type ResultadoDeConsulta = {
  columnas: string[];
  filas: Record<string, unknown>[];
  totalFilas: number;
  truncado: boolean;
};

const MAX_CARACTERES_POR_VALOR = 2_000;

/**
 * Ejecuta UNA sentencia dentro de una transacción `READ ONLY` que siempre
 * acaba en ROLLBACK, en una conexión nueva que se cierra al terminar (nada
 * de estado de sesión entre consultas).
 *
 * - `queryMode: "extended"` fuerza el protocolo extendido de Postgres, que
 *   rechaza varias sentencias en la misma cadena: `SELECT 1; DELETE …` falla
 *   entero en vez de colar el DELETE.
 * - En una transacción READ ONLY Postgres rechaza cualquier escritura,
 *   también las que haga una función, y no deja volver a lectura-escritura
 *   una vez ejecutada la primera consulta.
 * - En producción se suma un usuario que solo tiene permiso de lectura
 *   (ver prod.ts): esto es la segunda barrera, no la única.
 */
export async function ejecutarSoloLectura(
  urlDeConexion: string,
  sql: string,
  {
    parametros = [],
    limiteFilas = 200,
    timeoutMs = 15_000,
    maxCaracteresPorValor = MAX_CARACTERES_POR_VALOR,
  }: {
    parametros?: unknown[];
    limiteFilas?: number;
    timeoutMs?: number;
    /** Las cadenas más largas se recortan (un prompt entero, para el
     * inventario del panel, necesita más). */
    maxCaracteresPorValor?: number;
  } = {}
): Promise<ResultadoDeConsulta> {
  const cliente = new pg.Client({
    connectionString: urlDeConexion,
    connectionTimeoutMillis: 10_000,
  });
  await cliente.connect();
  try {
    await cliente.query("BEGIN READ ONLY");
    await cliente.query(`SET LOCAL statement_timeout = ${Math.trunc(timeoutMs)}`);
    const resultado = await cliente.query({
      text: sql,
      values: parametros,
      // No está en @types/pg, pero pg lo admite desde la 8.12.
      queryMode: "extended",
    } as pg.QueryConfig);
    return {
      columnas: resultado.fields.map((campo) => campo.name),
      filas: resultado.rows
        .slice(0, limiteFilas)
        .map((fila) => serializarFila(fila, maxCaracteresPorValor)),
      totalFilas: resultado.rowCount ?? resultado.rows.length,
      truncado: resultado.rows.length > limiteFilas,
    };
  } finally {
    await cliente.query("ROLLBACK").catch(() => undefined);
    await cliente.end();
  }
}

function serializarFila(
  fila: Record<string, unknown>,
  maximo: number
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fila).map(([columna, valor]) => [
      columna,
      serializar(valor, maximo),
    ])
  );
}

function serializar(valor: unknown, maximo: number): unknown {
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "bigint") return valor.toString();
  if (Buffer.isBuffer(valor)) return `<${valor.length} bytes>`;
  if (typeof valor === "string" && valor.length > maximo) {
    return `${valor.slice(0, maximo)}… (${valor.length} caracteres)`;
  }
  return valor;
}
