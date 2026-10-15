import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ejecutarSoloLectura } from "./sqlDeSoloLectura.js";

/**
 * El esquema REAL de una base de datos (dev o producción), no el que dice
 * schema.prisma: columnas con su tipo, índices y claves foráneas, leídos de
 * pg_catalog en la misma transacción de solo lectura que el resto. La tabla
 * se puede pedir por su nombre (`bookings`) o por el del modelo de Prisma
 * (`Booking`), que se traduce con los `@@map` de schema.prisma.
 */
export function tablasDePrisma(schema: string): Map<string, string> {
  const tablas = new Map<string, string>();
  for (const [, modelo, cuerpo] of schema.matchAll(
    /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm
  )) {
    const mapa = /@@map\("([^"]+)"\)/.exec(cuerpo);
    tablas.set(mapa ? mapa[1] : modelo, modelo);
  }
  return tablas;
}

function leerSchemaDePrisma(): string {
  const aqui = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(aqui, "../prisma/schema.prisma"), "utf8");
}

export async function describirTabla(
  url: string,
  tabla?: string,
  schema: string = leerSchemaDePrisma()
) {
  const modelos = tablasDePrisma(schema);
  const { filas: existentes } = await ejecutarSoloLectura(
    url,
    `SELECT c.relname AS tabla, GREATEST(c.reltuples, 0)::bigint AS filas_aprox
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname`,
    { limiteFilas: 1000 }
  );
  const tablas = existentes as { tabla: string; filas_aprox: string }[];

  if (!tabla) {
    return {
      tablas: tablas.map((t) => ({
        tabla: t.tabla,
        modelo: modelos.get(t.tabla) ?? null,
        filasAprox: Number(t.filas_aprox),
      })),
    };
  }

  const buscada = tabla.trim().toLowerCase();
  const nombre =
    tablas.find((t) => t.tabla.toLowerCase() === buscada)?.tabla ??
    [...modelos.entries()].find(
      ([, modelo]) => modelo.toLowerCase() === buscada
    )?.[0];
  if (!nombre || !tablas.some((t) => t.tabla === nombre)) {
    const parecidas = tablas
      .map((t) => t.tabla)
      .filter(
        (t) => t.includes(buscada) || buscada.includes(t.replace(/s$/, ""))
      );
    throw new Error(
      `[MCP] No hay ninguna tabla «${tabla}»${parecidas.length ? `; ¿quizá ${parecidas.join(", ")}?` : ""}`
    );
  }

  // Una tras otra: el usuario de lectura de producción admite solo 2
  // conexiones a la vez (CONNECTION LIMIT 2) y cada consulta abre la suya.
  const columnas = await ejecutarSoloLectura(
    url,
    `SELECT column_name AS columna,
              CASE WHEN data_type = 'USER-DEFINED' THEN udt_name
                   WHEN data_type = 'ARRAY' THEN udt_name
                   ELSE data_type END AS tipo,
              is_nullable = 'YES' AS nula,
              column_default AS por_defecto
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position`,
    { parametros: [nombre], limiteFilas: 500 }
  );
  const indices = await ejecutarSoloLectura(
    url,
    `SELECT indexname AS indice, indexdef AS definicion
         FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1
        ORDER BY indexname`,
    { parametros: [nombre], limiteFilas: 200 }
  );
  const foraneas = await ejecutarSoloLectura(
    url,
    `SELECT conname AS restriccion, pg_get_constraintdef(oid) AS definicion
         FROM pg_constraint
        WHERE conrelid = ('public.' || quote_ident($1))::regclass AND contype = 'f'
        ORDER BY conname`,
    { parametros: [nombre], limiteFilas: 200 }
  );

  return {
    tabla: nombre,
    modelo: modelos.get(nombre) ?? null,
    filasAprox: Number(
      tablas.find((t) => t.tabla === nombre)?.filas_aprox ?? 0
    ),
    columnas: columnas.filas,
    indices: indices.filas,
    clavesForaneas: foraneas.filas,
  };
}
