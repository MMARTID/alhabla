import { describe, it, expect } from "vitest";
import {
  ErrorDeUso,
  analizarArgumentos,
  avisoDeAlcances,
  confirmacionRequerida,
  describirBase,
  formatearTokens,
  sinCredenciales,
} from "../../scripts/growth/argumentosDeToken.js";
import {
  PREFIJO_DE_TOKEN,
  generarTokenDeAgente,
  hashDeToken,
} from "../../src/modules/growth/tokens.js";

describe("analizarArgumentos (script de tokens de Growth)", () => {
  it("crear con nombre y alcances", () => {
    expect(
      analizarArgumentos([
        "crear",
        "--nombre",
        "agente-semanal",
        "--alcances",
        "leer,escribir",
      ])
    ).toEqual({
      comando: "crear",
      nombre: "agente-semanal",
      alcances: ["leer", "escribir"],
      entorno: "dev",
    });
  });

  it("crear un token solo de conocimiento, en producción", () => {
    expect(
      analizarArgumentos([
        "crear",
        "--nombre",
        "conocimiento",
        "--alcances",
        "conocimiento",
        "--entorno",
        "prod",
      ])
    ).toMatchObject({ alcances: ["conocimiento"], entorno: "prod" });
  });

  it("listar y revocar", () => {
    expect(analizarArgumentos(["listar"])).toEqual({
      comando: "listar",
      entorno: "dev",
    });
    expect(analizarArgumentos(["revocar", "--id", "cm123abc"])).toEqual({
      comando: "revocar",
      id: "cm123abc",
      entorno: "dev",
    });
  });

  it.each([
    [[], /Falta el comando/],
    [["borrar"], /Comando desconocido/],
    [["crear", "--alcances", "leer"], /Falta --nombre/],
    [["crear", "--nombre", "agente"], /Falta --alcances/],
    [
      ["crear", "--nombre", "agente", "--alcances", "admin"],
      /Alcance desconocido: «admin»/,
    ],
    [["crear", "--nombre", "agente", "--alcances", "leer,leer"], /repetido/],
    [["crear", "--nombre", "agente", "--alcances", ""], /Falta --alcances/],
    [
      ["crear", "--nombre", "Agente Semanal", "--alcances", "leer"],
      /El nombre va en minúsculas/,
    ],
    [
      ["crear", "--nombre", "a", "--alcances", "leer"],
      /El nombre va en minúsculas/,
    ],
    [
      ["crear", "--nombre", "../x", "--alcances", "leer"],
      /El nombre va en minúsculas/,
    ],
    [
      ["crear", "--nombre", "x".repeat(61), "--alcances", "leer"],
      /El nombre va en minúsculas/,
    ],
    [
      ["crear", "--nombre", "a-b", "--alcances", "leer", "--id", "x"],
      /--id no se usa con «crear»/,
    ],
    [
      ["crear", "--nombre", "a-b", "--alcances", "leer", "--token", "gta_x"],
      /Argumento desconocido: --token/,
    ],
    [["crear", "--nombre"], /necesita un valor/],
    [["crear", "--nombre", "--alcances", "leer"], /necesita un valor/],
    [
      ["crear", "--nombre", "a-b", "--nombre", "c-d", "--alcances", "leer"],
      /repetido/,
    ],
    [["listar", "--nombre", "x"], /no se usa con «listar»/],
    [["revocar"], /Falta --id/],
    [["revocar", "--id", "con espacios"], /id del token no es válido/],
    [["revocar", "--id", "x", "--alcances", "leer"], /no se usa con «revocar»/],
    [["listar", "--entorno", "staging"], /dev o prod/],
    [["listar", "sobrante"], /Argumento inesperado/],
  ])("rechaza %j", (argv, mensaje) => {
    expect(() => analizarArgumentos(argv as string[])).toThrow(ErrorDeUso);
    expect(() => analizarArgumentos(argv as string[])).toThrow(mensaje);
  });
});

describe("avisoDeAlcances", () => {
  it("avisa si el mismo token puede cambiar las reglas y redactar borradores", () => {
    expect(avisoDeAlcances(["leer", "escribir", "conocimiento"])).toMatch(
      /token aparte con solo «conocimiento»/
    );
    expect(avisoDeAlcances(["leer", "conocimiento"])).not.toBeNull();
  });

  it("no avisa con los alcances separados", () => {
    expect(avisoDeAlcances(["conocimiento"])).toBeNull();
    expect(avisoDeAlcances(["leer", "escribir"])).toBeNull();
  });
});

describe("describirBase y confirmacionRequerida", () => {
  it("describe la base sin usuario ni contraseña", () => {
    const base = describirBase(
      "postgresql://postgres:secreto@localhost:5433/botbook?schema=public"
    );
    expect(base.descripcion).toBe("localhost:5433/botbook");
    expect(JSON.stringify(base)).not.toContain("secreto");
    expect(JSON.stringify(base)).not.toContain("postgres:");
    expect(base).toMatchObject({ base: "botbook", local: true });
  });

  it("el socket de Cloud SQL manda sobre el host y nunca es local", () => {
    const base = describirBase(
      "postgresql://u:clave@localhost/alhabla?host=/cloudsql/proyecto:europe-west1:instancia"
    );
    expect(base.local).toBe(false);
    expect(base.descripcion).toBe(
      "/cloudsql/proyecto:europe-west1:instancia/alhabla"
    );
    expect(base.descripcion).not.toContain("clave");
  });

  it("un host remoto no es local", () => {
    expect(describirBase("postgresql://u:p@10.0.0.5:5432/alhabla").local).toBe(
      false
    );
    expect(describirBase("postgresql://u:p@postgres:5432/botbook").local).toBe(
      true
    );
  });

  it("una URL que no lo es, error sin repetirla", () => {
    expect(() => describirBase("no-es-una-url-con-clave-secreta")).toThrow(
      /DATABASE_URL no es una URL válida\./
    );
    expect(() => describirBase("no-es-una-url-con-clave-secreta")).not.toThrow(
      /secreta/
    );
  });

  it("en dev contra una base local no hace falta confirmar", () => {
    const base = describirBase("postgresql://u:p@localhost:5433/botbook");
    expect(confirmacionRequerida("dev", base).necesaria).toBe(false);
  });

  it("con --entorno prod siempre se confirma, aunque la base parezca local (proxy de Cloud SQL)", () => {
    const base = describirBase("postgresql://u:p@localhost:5432/alhabla");
    const c = confirmacionRequerida("prod", base);
    expect(c).toMatchObject({ necesaria: true, frase: "alhabla" });
    expect(c.motivo).toMatch(/PRODUCCIÓN/);
  });

  it("en dev contra una base que no es local también se confirma: un .env mal copiado no escribe en producción", () => {
    const base = describirBase("postgresql://u:p@10.0.0.5:5432/alhabla");
    const c = confirmacionRequerida("dev", base);
    expect(c.necesaria).toBe(true);
    expect(c.motivo).toMatch(/no es local/);
  });
});

describe("formatearTokens", () => {
  const FILA = {
    id: "tok_1",
    nombre: "agente-semanal",
    alcances: ["leer", "escribir"],
    creadoEn: new Date("2026-10-30T10:00:00Z"),
    revocadoEn: null,
    ultimoUso: new Date("2026-10-31T08:00:00Z"),
  };

  it("lista lo que se sabe de cada token y si está activo o revocado", () => {
    const texto = formatearTokens([
      FILA,
      {
        ...FILA,
        id: "tok_2",
        nombre: "viejo",
        revocadoEn: new Date("2026-11-02T00:00:00Z"),
        ultimoUso: null,
      },
    ]);
    expect(texto).toMatch(
      /tok_1 +agente-semanal +leer,escribir +creado 2026-10-30 +último uso 2026-10-31 +activo/
    );
    expect(texto).toMatch(/tok_2 +viejo .*último uso — +REVOCADO 2026-11-02/);
  });

  it("nunca enseña un hash, ni aunque la fila lo trajera", () => {
    const { hash } = generarTokenDeAgente();
    const texto = formatearTokens([
      { ...FILA, hashToken: hash } as typeof FILA,
    ]);
    expect(texto).not.toContain(hash);
  });

  it("sin tokens lo dice", () => {
    expect(formatearTokens([])).toBe("No hay tokens de agente.");
  });
});

describe("sinCredenciales", () => {
  it("quita cualquier URL de conexión de un mensaje de error", () => {
    const mensaje =
      "PrismaClientInitializationError: Can't reach postgresql://postgres:clavesecreta@db.example:5432/alhabla?sslmode=require\nsegunda línea";
    const limpio = sinCredenciales(mensaje);
    expect(limpio).not.toContain("clavesecreta");
    expect(limpio).toContain("[url de la base]");
    expect(limpio).not.toContain("segunda línea");
  });
});

describe("el token generado", () => {
  it("lleva el prefijo y solo su hash es lo que se guardaría", () => {
    const { token, hash } = generarTokenDeAgente();
    expect(token.startsWith(PREFIJO_DE_TOKEN)).toBe(true);
    expect(hash).toBe(hashDeToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });

  it("dos tokens nunca coinciden", () => {
    expect(generarTokenDeAgente().token).not.toBe(generarTokenDeAgente().token);
  });
});
