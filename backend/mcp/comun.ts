import { z } from "zod";

/**
 * Piezas comunes a todas las herramientas del MCP: cómo se devuelve un
 * resultado o un error y los parámetros que se repiten (entorno, mostrar
 * teléfonos). Las herramientas se registran en servidorDev.ts y en los
 * ficheros registro*.ts.
 */

export function respuesta(datos: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(datos, null, 2) }],
  };
}

export function fallo(error: unknown) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: error instanceof Error ? error.message : String(error),
      },
    ],
  };
}

export async function conErrores<T>(trabajo: () => Promise<T>) {
  try {
    return respuesta(await trabajo());
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error(mensaje.startsWith("[MCP]") ? mensaje : `[MCP] ${mensaje}`);
    return fallo(error);
  }
}

export const entorno = z
  .enum(["dev", "prod"])
  .describe(
    "dev: Postgres de Docker y la clave de Telnyx del .env; prod: Cloud SQL y Secret Manager"
  );

export const mostrarTelefonos = z
  .boolean()
  .optional()
  .describe(
    "Por defecto los teléfonos +34… salen enmascarados (las 3 últimas cifras)"
  );
