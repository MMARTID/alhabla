/**
 * Tokens de agente de Alhabla Growth (PLAN-GROWTH.md § 4). Los usa el MCP
 * `alhabla-growth` para entrar en /growth/agente/*, y el sincronizador de
 * conocimiento (alcance `conocimiento`).
 *
 *   npm run growth:token -- crear --nombre agente-semanal --alcances leer,escribir
 *   npm run growth:token -- crear --nombre conocimiento --alcances conocimiento
 *   npm run growth:token -- listar
 *   npm run growth:token -- revocar --id <id>
 *
 * El token (gta_…) se imprime UNA vez, por la salida estándar, y no se escribe
 * en ningún fichero ni en ningún log; en la base solo va su SHA-256. Todo lo
 * demás sale por la salida de error.
 *
 * Base de datos: la de dev por defecto (la `DATABASE_URL` del entorno o, si no
 * hay, la del `.env` del checkout principal vista desde el Mac). Con
 * `--entorno prod` hace falta que `DATABASE_URL` apunte a producción (por
 * ejemplo a través del proxy de Cloud SQL) y se pide confirmación a mano.
 */
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { generarTokenDeAgente } from "../../src/modules/growth/tokens.js";
import { cargarEnv, urlDeBdDeDev } from "../../mcp/entorno.js";
import {
  ErrorDeUso,
  USO,
  analizarArgumentos,
  avisoDeAlcances,
  confirmacionRequerida,
  describirBase,
  describirError,
  formatearTokens,
  type Orden,
} from "./argumentosDeToken.js";

function urlDeLaBase(orden: Orden): string {
  const delEntorno = process.env.DATABASE_URL;
  if (delEntorno) return delEntorno;
  if (orden.entorno === "prod") {
    throw new ErrorDeUso(
      "Con --entorno prod hace falta DATABASE_URL apuntando a producción (por ejemplo, el proxy de Cloud SQL)."
    );
  }
  // El `.env` del checkout principal, con el host de Compose traducido a localhost.
  return urlDeBdDeDev(cargarEnv());
}

async function confirmar(motivo: string, frase: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error(
      `${motivo}\nHace falta confirmarlo a mano y no hay una terminal interactiva: no se hace nada.`
    );
    return false;
  }
  const interfaz = createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  try {
    const respuesta = await interfaz.question(
      `${motivo}\nEscribe «${frase}» (el nombre de la base) para continuar: `
    );
    return respuesta.trim() === frase;
  } finally {
    interfaz.close();
  }
}

export async function ejecutar(orden: Orden): Promise<number> {
  const url = urlDeLaBase(orden);
  const base = describirBase(url);
  const confirmacion = confirmacionRequerida(orden.entorno, base);
  console.error(`Base de datos: ${base.descripcion} (${orden.entorno})`);

  if (confirmacion.necesaria && orden.comando !== "listar") {
    if (!(await confirmar(confirmacion.motivo, confirmacion.frase))) {
      console.error("No se ha confirmado: no se hace nada.");
      return 1;
    }
  }

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    if (orden.comando === "listar") {
      // Sin `hashToken`: ni siquiera se lee.
      const filas = await prisma.growthTokenAgente.findMany({
        select: {
          id: true,
          nombre: true,
          alcances: true,
          creadoEn: true,
          revocadoEn: true,
          ultimoUso: true,
        },
        orderBy: { creadoEn: "asc" },
      });
      console.log(formatearTokens(filas));
      return 0;
    }

    if (orden.comando === "revocar") {
      const token = await prisma.growthTokenAgente.findUnique({
        where: { id: orden.id },
        select: { nombre: true },
      });
      const { count } = await prisma.growthTokenAgente.updateMany({
        where: { id: orden.id, revocadoEn: null },
        data: { revocadoEn: new Date() },
      });
      if (count === 0) {
        console.error(
          token
            ? `El token ${orden.id} (${token.nombre}) ya estaba revocado.`
            : `No existe ningún token con id ${orden.id}.`
        );
        return 1;
      }
      await prisma.growthDecision.create({
        data: {
          accion: "revocar_token",
          motivo: `Token ${token?.nombre ?? orden.id}`,
          por: "script",
        },
      });
      console.error(`Token ${orden.id} (${token?.nombre}) revocado.`);
      return 0;
    }

    // crear
    const repetido = await prisma.growthTokenAgente.findFirst({
      where: { nombre: orden.nombre, revocadoEn: null },
      select: { id: true },
    });
    if (repetido) {
      console.error(
        `Ya hay un token activo llamado «${orden.nombre}» (${repetido.id}). Revócalo antes o elige otro nombre: la auditoría firma con el nombre.`
      );
      return 1;
    }
    const aviso = avisoDeAlcances(orden.alcances);
    if (aviso) console.error(`Aviso: ${aviso}`);

    const { token, hash } = generarTokenDeAgente();
    const creado = await prisma.growthTokenAgente.create({
      data: { nombre: orden.nombre, hashToken: hash, alcances: orden.alcances },
      select: { id: true },
    });
    await prisma.growthDecision.create({
      data: {
        accion: "crear_token",
        motivo: `Token ${orden.nombre} (${orden.alcances.join(", ")})`,
        por: "script",
      },
    });
    console.error(
      `Token ${creado.id} («${orden.nombre}», alcances ${orden.alcances.join(", ")}) creado.\nCópialo ahora: no se vuelve a mostrar.\n`
    );
    console.log(token);
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

async function principal() {
  try {
    process.exitCode = await ejecutar(
      analizarArgumentos(process.argv.slice(2))
    );
  } catch (error) {
    if (error instanceof ErrorDeUso) {
      console.error(`${error.message}\n\n${USO}`);
      process.exitCode = 2;
    } else {
      // Nunca la URL de conexión: lleva usuario y contraseña.
      console.error(`Fallo: ${describirError(error)}`);
      process.exitCode = 1;
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void principal();
}
