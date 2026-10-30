import {
  ALCANCES_DE_AGENTE,
  type AlcanceDeAgente,
} from "../../src/modules/growth/tokens.js";

/**
 * La parte PURA del script de tokens de Alhabla Growth (crearToken.ts):
 * argumentos, validaciones y cómo se describe una base de datos sin enseñar
 * sus credenciales. Aparte para poder probarla sin base de datos.
 */

export type Entorno = "dev" | "prod";

export type Orden =
  | {
      comando: "crear";
      nombre: string;
      alcances: AlcanceDeAgente[];
      entorno: Entorno;
    }
  | { comando: "listar"; entorno: Entorno }
  | { comando: "revocar"; id: string; entorno: Entorno };

export class ErrorDeUso extends Error {}

export const USO = `Uso:
  npm run growth:token -- crear --nombre <nombre> --alcances leer,escribir [--entorno dev|prod]
  npm run growth:token -- crear --nombre <nombre> --alcances conocimiento
  npm run growth:token -- listar [--entorno dev|prod]
  npm run growth:token -- revocar --id <id> [--entorno dev|prod]

Alcances: ${ALCANCES_DE_AGENTE.join(", ")}.
El token se muestra UNA vez al crearlo; en la base solo se guarda su hash.`;

/** `agente:<nombre>` firma la auditoría, así que el nombre es corto y legible. */
const NOMBRE = /^[a-z0-9][a-z0-9_.-]{1,59}$/;

export function analizarArgumentos(argv: readonly string[]): Orden {
  const [comando, ...resto] = argv;
  if (comando !== "crear" && comando !== "listar" && comando !== "revocar") {
    throw new ErrorDeUso(
      comando
        ? `Comando desconocido: ${comando}.`
        : "Falta el comando (crear, listar o revocar)."
    );
  }

  const valores = new Map<string, string>();
  for (let i = 0; i < resto.length; i++) {
    const arg = resto[i];
    if (!arg.startsWith("--")) {
      throw new ErrorDeUso(`Argumento inesperado: ${arg}`);
    }
    const nombre = arg.slice(2);
    if (!["nombre", "alcances", "id", "entorno"].includes(nombre)) {
      throw new ErrorDeUso(`Argumento desconocido: ${arg}`);
    }
    const valor = resto[i + 1];
    if (valor === undefined || valor.startsWith("--")) {
      throw new ErrorDeUso(`${arg} necesita un valor.`);
    }
    if (valores.has(nombre)) {
      throw new ErrorDeUso(`${arg} está repetido.`);
    }
    valores.set(nombre, valor);
    i += 1;
  }

  const entorno = valores.get("entorno") ?? "dev";
  if (entorno !== "dev" && entorno !== "prod") {
    throw new ErrorDeUso(`--entorno debe ser dev o prod, no «${entorno}».`);
  }

  const noAdmite = (admitidos: string[]) => {
    for (const nombre of valores.keys()) {
      if (nombre !== "entorno" && !admitidos.includes(nombre)) {
        throw new ErrorDeUso(`--${nombre} no se usa con «${comando}».`);
      }
    }
  };

  if (comando === "listar") {
    noAdmite([]);
    return { comando, entorno };
  }

  if (comando === "revocar") {
    noAdmite(["id"]);
    const id = valores.get("id");
    if (!id) throw new ErrorDeUso("Falta --id.");
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      throw new ErrorDeUso("El id del token no es válido.");
    }
    return { comando, id, entorno };
  }

  noAdmite(["nombre", "alcances"]);
  const nombre = valores.get("nombre");
  if (!nombre) throw new ErrorDeUso("Falta --nombre.");
  if (!NOMBRE.test(nombre)) {
    throw new ErrorDeUso(
      "El nombre va en minúsculas, números, punto, guion o guion bajo (2 a 60 caracteres, empezando por letra o número): firma la auditoría como agente:<nombre>."
    );
  }
  const crudo = valores.get("alcances");
  if (!crudo) throw new ErrorDeUso("Falta --alcances.");
  const alcances = crudo.split(",").map((a) => a.trim());
  for (const alcance of alcances) {
    if (!(ALCANCES_DE_AGENTE as readonly string[]).includes(alcance)) {
      throw new ErrorDeUso(
        `Alcance desconocido: «${alcance}». Los válidos: ${ALCANCES_DE_AGENTE.join(", ")}.`
      );
    }
  }
  if (new Set(alcances).size !== alcances.length) {
    throw new ErrorDeUso("Hay un alcance repetido.");
  }
  return { comando, nombre, alcances: alcances as AlcanceDeAgente[], entorno };
}

/**
 * Un aviso cuando se junta `conocimiento` con otro alcance: de esa base
 * cuelgan las reglas duras y quien redacta borradores no debería poder
 * cambiarlas. Se permite (hay quien empieza con un solo token), pero se dice.
 */
export function avisoDeAlcances(
  alcances: readonly AlcanceDeAgente[]
): string | null {
  if (
    alcances.includes("conocimiento") &&
    alcances.some((a) => a !== "conocimiento")
  ) {
    return "Este token puede cambiar la base de conocimiento de la que dependen las reglas duras y a la vez escribir borradores. Lo recomendable es un token aparte con solo «conocimiento».";
  }
  return null;
}

const HOSTS_LOCALES = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
  "::1",
  "postgres",
]);

export type BaseDeDatos = {
  /** `host:puerto/base`, sin usuario ni contraseña. */
  descripcion: string;
  base: string;
  local: boolean;
};

/** Describe `DATABASE_URL` sin enseñar usuario ni contraseña. */
export function describirBase(url: string): BaseDeDatos {
  let analizada: URL;
  try {
    analizada = new URL(url);
  } catch {
    throw new ErrorDeUso("DATABASE_URL no es una URL válida.");
  }
  const base = analizada.pathname.replace(/^\//, "");
  // `?host=/cloudsql/…` (socket de Cloud SQL) manda sobre el host de la URL.
  const socket = analizada.searchParams.get("host");
  const host = socket ?? analizada.host;
  return {
    descripcion: `${host}/${base}`,
    base,
    local: !socket && HOSTS_LOCALES.has(analizada.hostname),
  };
}

/**
 * Las bases de datos que son de desarrollo o de pruebas. Una base LOCAL con
 * otro nombre puede ser la de producción vista por el proxy de Cloud SQL
 * (`localhost:5432/alhabla`): el host local no basta para fiarse.
 */
const BASES_DE_DESARROLLO = new Set([
  "botbook",
  "alhabla_test",
  "alhabla_movil",
  "alhabla_shadow",
]);

export function esBaseDeDesarrollo(nombre: string): boolean {
  return BASES_DE_DESARROLLO.has(nombre) || /_test$/.test(nombre);
}

export type Confirmacion = {
  necesaria: boolean;
  frase: string;
  motivo: string;
};

/**
 * Cuándo hay que escribir una frase a mano. Siempre con `--entorno prod`, y
 * también si en dev la base no es local o, siendo local, no se llama como una
 * base de desarrollo conocida (botbook, alhabla_test, alhabla_movil…): el
 * escritorio con un `.env` mal copiado, o con el proxy de Cloud SQL en
 * `localhost`, no debe poder crear tokens en producción sin enterarse. La
 * frase es el nombre de la base: hay que mirarla para escribirla.
 */
export function confirmacionRequerida(
  entorno: Entorno,
  base: BaseDeDatos
): Confirmacion {
  if (entorno === "prod") {
    return {
      necesaria: true,
      frase: base.base,
      motivo: `Vas a escribir en la base de PRODUCCIÓN (${base.descripcion}).`,
    };
  }
  if (!base.local) {
    return {
      necesaria: true,
      frase: base.base,
      motivo: `Has pedido dev, pero la base (${base.descripcion}) no es local.`,
    };
  }
  if (!esBaseDeDesarrollo(base.base)) {
    return {
      necesaria: true,
      frase: base.base,
      motivo: `Has pedido dev y el host es local, pero «${base.base}» (${base.descripcion}) no es una base de desarrollo conocida (${[...BASES_DE_DESARROLLO].join(", ")} o *_test): ¿es el proxy de Cloud SQL con la base de producción?`,
    };
  }
  return { necesaria: false, frase: "", motivo: "" };
}

export type FilaDeToken = {
  id: string;
  nombre: string;
  alcances: string[];
  creadoEn: Date;
  revocadoEn: Date | null;
  ultimoUso: Date | null;
};

/** El listado de tokens: lo que se sabe de cada uno, nunca su hash. */
export function formatearTokens(filas: readonly FilaDeToken[]): string {
  if (filas.length === 0) return "No hay tokens de agente.";
  const dia = (f: Date | null) => (f ? f.toISOString().slice(0, 10) : "—");
  return filas
    .map(
      (f) =>
        `${f.id}  ${f.nombre.padEnd(24)}  ${f.alcances.join(",").padEnd(26)}  creado ${dia(f.creadoEn)}  último uso ${dia(f.ultimoUso)}  ${f.revocadoEn ? `REVOCADO ${dia(f.revocadoEn)}` : "activo"}`
    )
    .join("\n");
}

/**
 * Un mensaje de error sin ninguna URL de conexión (puede llevar usuario y
 * contraseña) y legible: una línea. Los errores de Prisma empiezan por una
 * línea en blanco y siguen con «Invalid `prisma.x.create()` invocation:», un
 * trozo del código y, AL FINAL, el motivo («Unique constraint failed…»): ese
 * es el que se enseña, no la primera línea.
 */
export function sinCredenciales(mensaje: string): string {
  const lineas = mensaje
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[url de la base]")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lineas.length === 0) return "";
  const deInvocacion = lineas.some((l) => /^Invalid `.*` invocation/.test(l));
  return deInvocacion ? lineas[lineas.length - 1] : lineas[0];
}

/** El error de una orden, en una línea y sin credenciales: «Nombre CÓDIGO: motivo». */
export function describirError(error: unknown): string {
  if (!(error instanceof Error)) return sinCredenciales(String(error));
  const codigo = (error as { code?: unknown }).code;
  const etiqueta =
    typeof codigo === "string" ? `${error.name} ${codigo}` : error.name;
  const motivo = sinCredenciales(error.message);
  return motivo ? `${etiqueta}: ${motivo}` : etiqueta;
}
