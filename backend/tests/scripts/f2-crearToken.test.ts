import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  confirmacionRequerida,
  describirBase,
  describirError,
  esBaseDeDesarrollo,
  sinCredenciales,
} from "../../scripts/growth/argumentosDeToken.js";

/**
 * Revisión 1b (conocimiento M6 y B7): el proxy de Cloud SQL en `localhost`
 * también es producción, y un error de Prisma se tiene que poder leer.
 */

const ejecutar = promisify(execFile);
const BACKEND = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("confirmacionRequerida en dev con host local", () => {
  it.each(["botbook", "alhabla_test", "alhabla_movil", "alhabla_shadow"])(
    "la base de desarrollo conocida «%s» no pide confirmación",
    (nombre) => {
      const base = describirBase(`postgresql://u:p@localhost:5433/${nombre}`);
      expect(esBaseDeDesarrollo(nombre)).toBe(true);
      expect(confirmacionRequerida("dev", base).necesaria).toBe(false);
    }
  );

  it("cualquier base que termina en _test tampoco", () => {
    const base = describirBase(
      "postgresql://u:p@localhost:5433/growth_fix_f2_test"
    );
    expect(confirmacionRequerida("dev", base).necesaria).toBe(false);
  });

  it("la producción vista por el proxy de Cloud SQL (localhost:5432/alhabla) SÍ pide confirmación en dev", () => {
    const base = describirBase("postgresql://u:clave@localhost:5432/alhabla");
    expect(base.local).toBe(true);
    const c = confirmacionRequerida("dev", base);
    expect(c).toMatchObject({ necesaria: true, frase: "alhabla" });
    expect(c.motivo).toMatch(/no es una base de desarrollo conocida/);
    expect(c.motivo).toMatch(/proxy de Cloud SQL/);
    expect(c.motivo).not.toContain("clave");
  });

  it("un nombre parecido no cuela: «botbook_prod» y «test» no son de desarrollo", () => {
    for (const nombre of ["botbook_prod", "test", "alhabla", "testing"]) {
      expect(esBaseDeDesarrollo(nombre), nombre).toBe(false);
    }
  });

  it("con --entorno prod sigue pidiéndose siempre, y una base remota en dev también", () => {
    expect(
      confirmacionRequerida(
        "prod",
        describirBase("postgresql://u:p@localhost:5432/botbook")
      ).necesaria
    ).toBe(true);
    expect(
      confirmacionRequerida(
        "dev",
        describirBase("postgresql://u:p@10.0.0.5:5432/botbook")
      ).necesaria
    ).toBe(true);
  });

  it("el script de verdad se niega sin una terminal y no llega a conectar con la base", async () => {
    const r = await ejecutar(
      process.execPath,
      [
        "--import",
        "tsx",
        join(BACKEND, "scripts/growth/crearToken.ts"),
        "crear",
        "--nombre",
        "no-debe-crearse",
        "--alcances",
        "leer",
      ],
      {
        cwd: BACKEND,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          // Una base local que NO es de desarrollo: ni siquiera existe.
          DATABASE_URL: "postgresql://postgres:secreta@localhost:5433/alhabla",
        },
      }
    ).catch((e: { stderr: string; code: number }) => e);
    const resultado = r as { stderr: string; code?: number };
    expect(resultado.code).toBe(1);
    expect(resultado.stderr).toMatch(/no es una base de desarrollo conocida/);
    expect(resultado.stderr).toMatch(/no hay una terminal interactiva/);
    expect(resultado.stderr).not.toContain("secreta");
    expect(resultado.stderr).not.toMatch(/PrismaClient/);
  }, 30_000);
});

describe("un error de Prisma se lee", () => {
  const PRISMA = [
    "",
    "Invalid `prisma.growthTokenAgente.create()` invocation in",
    "/repo/backend/scripts/growth/crearToken.ts:146:56",
    "",
    "  143 const { token, hash } = generarTokenDeAgente();",
    "  144 const creado = await prisma.growthTokenAgente.create({",
    "→ 146   data: { nombre: orden.nombre, hashToken: hash },",
    "",
    "Unique constraint failed on the fields: (`hashToken`)",
  ].join("\n");

  it("sinCredenciales enseña el motivo (la última línea), no la línea en blanco del principio", () => {
    expect(sinCredenciales(PRISMA)).toBe(
      "Unique constraint failed on the fields: (`hashToken`)"
    );
  });

  it("sigue quitando la URL de conexión y enseñando la primera línea de un error normal", () => {
    const limpio = sinCredenciales(
      "PrismaClientInitializationError: Can't reach postgresql://postgres:clavesecreta@db.example:5432/alhabla\nsegunda línea"
    );
    expect(limpio).toBe(
      "PrismaClientInitializationError: Can't reach [url de la base]"
    );
  });

  it("una URL en la última línea de un error de invocación tampoco se cuela", () => {
    expect(
      sinCredenciales(
        "\nInvalid `prisma.x.create()` invocation:\n\nCan't reach postgres://u:clave@h/db"
      )
    ).toBe("Can't reach [url de la base]");
  });

  it("describirError añade el nombre y el código de Prisma", () => {
    const error = Object.assign(new Error(PRISMA), {
      name: "PrismaClientKnownRequestError",
      code: "P2002",
    });
    expect(describirError(error)).toBe(
      "PrismaClientKnownRequestError P2002: Unique constraint failed on the fields: (`hashToken`)"
    );
  });

  it("describirError con un error sin código o que no es un Error", () => {
    expect(describirError(new Error("algo falló"))).toBe("Error: algo falló");
    expect(describirError("texto suelto")).toBe("texto suelto");
    expect(describirError(new Error(""))).toBe("Error");
  });
});
