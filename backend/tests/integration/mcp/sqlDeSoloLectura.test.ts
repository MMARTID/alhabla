import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { ejecutarSoloLectura } from "../../../mcp/sqlDeSoloLectura.js";

// Contra el Postgres real (alhabla_test): las barreras de solo lectura son
// de Postgres, no de una lista de palabras prohibidas, así que solo se
// pueden probar con un Postgres de verdad.

const url = process.env.DATABASE_URL!;
const TABLA = "mcp_prueba_solo_lectura";

async function sql(texto: string) {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    return await cliente.query(texto);
  } finally {
    await cliente.end();
  }
}

beforeAll(async () => {
  await sql(`DROP TABLE IF EXISTS ${TABLA}; CREATE TABLE ${TABLA} (id int)`);
  await sql(`INSERT INTO ${TABLA} SELECT generate_series(1, 5)`);
});

afterAll(async () => {
  await sql(`DROP TABLE IF EXISTS ${TABLA}`);
});

async function filasDeLaTabla() {
  return (await sql(`SELECT count(*)::int AS n FROM ${TABLA}`)).rows[0].n;
}

describe("ejecutarSoloLectura", () => {
  it("lee, con parámetros y límite de filas", async () => {
    const resultado = await ejecutarSoloLectura(
      url,
      `SELECT id FROM ${TABLA} WHERE id > $1 ORDER BY id`,
      { parametros: [1], limiteFilas: 2 }
    );
    expect(resultado.columnas).toEqual(["id"]);
    expect(resultado.filas).toEqual([{ id: 2 }, { id: 3 }]);
    expect(resultado.totalFilas).toBe(4);
    expect(resultado.truncado).toBe(true);
  });

  it("rechaza una escritura directa", async () => {
    await expect(
      ejecutarSoloLectura(url, `DELETE FROM ${TABLA}`)
    ).rejects.toThrow(/read-only transaction/);
    expect(await filasDeLaTabla()).toBe(5);
  });

  it("rechaza colar una escritura detrás de un SELECT", async () => {
    await expect(
      ejecutarSoloLectura(url, `SELECT 1; DELETE FROM ${TABLA}`)
    ).rejects.toThrow(/multiple commands/);
    await expect(
      ejecutarSoloLectura(url, `COMMIT; DELETE FROM ${TABLA}`)
    ).rejects.toThrow(/multiple commands/);
    expect(await filasDeLaTabla()).toBe(5);
  });

  it("rechaza escribir desde un CTE", async () => {
    await expect(
      ejecutarSoloLectura(
        url,
        `WITH borradas AS (DELETE FROM ${TABLA} RETURNING id) SELECT * FROM borradas`
      )
    ).rejects.toThrow(/read-only transaction/);
    expect(await filasDeLaTabla()).toBe(5);
  });

  it("no deja volver a lectura-escritura dentro de la sentencia", async () => {
    await expect(
      ejecutarSoloLectura(
        url,
        "SELECT set_config('transaction_read_only', 'off', true)"
      )
    ).rejects.toThrow();
  });

  it("corta una consulta que pasa del plazo", async () => {
    await expect(
      ejecutarSoloLectura(url, "SELECT pg_sleep(2)", { timeoutMs: 200 })
    ).rejects.toThrow(/statement timeout/);
  });

  it("lee los timestamp sin zona (los de Prisma) como UTC, no como hora local", async () => {
    const { filas } = await ejecutarSoloLectura(
      url,
      "SELECT timestamp '2026-10-20 09:00:00' AS programado"
    );
    expect(filas[0]!.programado).toBe("2026-10-20T09:00:00.000Z");
  });

  it("serializa fechas y textos largos", async () => {
    const { filas } = await ejecutarSoloLectura(
      url,
      "SELECT timestamptz '2026-10-14 10:00:00+00' AS cuando, repeat('a', 3000) AS largo"
    );
    expect(filas[0]!.cuando).toBe("2026-10-14T10:00:00.000Z");
    expect(String(filas[0]!.largo)).toMatch(/… \(3000 caracteres\)$/);
  });
});
