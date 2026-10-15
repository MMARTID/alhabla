import { describe, expect, it } from "vitest";
import { describirTabla } from "../../../mcp/esquema.js";

// Contra el Postgres real (alhabla_test, con todas las migraciones): las
// consultas a pg_catalog solo se prueban de verdad con un Postgres.
const url = process.env.DATABASE_URL!;

describe("describirTabla (integración)", () => {
  it("sin tabla lista las tablas con su modelo de Prisma", async () => {
    const { tablas } = (await describirTabla(url)) as {
      tablas: { tabla: string; modelo: string | null; filasAprox: number }[];
    };
    expect(tablas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tabla: "bookings", modelo: "Booking" }),
        expect.objectContaining({
          tabla: "claves_temporales",
          modelo: "ClaveTemporal",
        }),
      ])
    );
    // La tabla de migraciones de Prisma no tiene modelo.
    expect(
      tablas.find((t) => t.tabla === "_prisma_migrations")?.modelo
    ).toBeNull();
  });

  it("por el nombre del modelo: columnas, índices y claves foráneas", async () => {
    const resultado = (await describirTabla(url, "ClaveTemporal")) as {
      tabla: string;
      modelo: string;
      columnas: { columna: string; tipo: string; nula: boolean }[];
      indices: { indice: string }[];
      clavesForaneas: { definicion: string }[];
    };
    expect(resultado.tabla).toBe("claves_temporales");
    expect(resultado.modelo).toBe("ClaveTemporal");
    expect(resultado.columnas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          columna: "clave",
          tipo: "text",
          nula: false,
        }),
        expect.objectContaining({ columna: "valor", tipo: "jsonb" }),
        expect.objectContaining({ columna: "businessId", nula: true }),
      ])
    );
    expect(resultado.indices.map((i) => i.indice)).toContain(
      "claves_temporales_pkey"
    );
    expect(resultado.clavesForaneas[0].definicion).toMatch(
      /REFERENCES businesses\(id\) ON UPDATE CASCADE ON DELETE CASCADE/
    );
  });

  it("una tabla que no existe da error con las parecidas", async () => {
    // «booking» sí vale (es el modelo Booking en minúsculas); «bookin», no.
    await expect(describirTabla(url, "bookin")).rejects.toThrow(
      /¿quizá .*bookings/
    );
    await expect(describirTabla(url, "'; DROP TABLE x; --")).rejects.toThrow(
      /No hay ninguna tabla/
    );
  });
});
