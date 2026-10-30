import { z } from "zod";
import { SincronizarBody, booleanoDeConsulta } from "../esquemas.js";

/**
 * Lo que el sincronizador añade al cuerpo de `SincronizarBody` (esquemas.ts):
 * el rastro de los ficheros que leyó. El cuerpo del servidor es `.strict()`,
 * así que `fuentes` viaja en el mismo JSON y se separa ANTES de validar el
 * resto; si algún día pasa a `SincronizarBody`, este fichero se simplifica.
 */

/** Un fichero del repo que se leyó para calcular el lote. */
export const FuenteLeida = z
  .object({
    /** Ruta desde la raíz del repo, p. ej. `web/src/lib/plans.ts`. */
    ruta: z
      .string()
      .max(300)
      .regex(/^[A-Za-z0-9_./@-]+$/, "Ruta no válida."),
    /** SHA del contenido del fichero (`git rev-parse HEAD:<ruta>`). */
    blobSha: z.string().regex(/^[0-9a-f]{40}$/),
    /** Último commit que tocó el fichero (`git log -1 -- <ruta>`). */
    commitSha: z
      .string()
      .regex(/^[0-9a-f]{40}$/)
      .optional(),
  })
  .strict();
export type FuenteLeida = z.infer<typeof FuenteLeida>;

export const FuentesLeidas = z.array(FuenteLeida).max(300);

/**
 * Separa `fuentes` del resto del cuerpo y valida cada parte con su esquema.
 * Un cuerpo que no es un objeto se deja pasar a `SincronizarBody`, que da el
 * error de validación de siempre.
 */
export function analizarCuerpoDeSincronizacion(cuerpo: unknown): {
  body: SincronizarBody;
  fuentes: FuenteLeida[];
} {
  if (cuerpo && typeof cuerpo === "object" && !Array.isArray(cuerpo)) {
    const { fuentes, ...resto } = cuerpo as Record<string, unknown>;
    return {
      body: SincronizarBody.parse(resto),
      fuentes: FuentesLeidas.parse(fuentes ?? []),
    };
  }
  return { body: SincronizarBody.parse(cuerpo), fuentes: [] };
}

/**
 * `POST /growth/agente/conocimiento/sincronizar?simular=true`: calcula y
 * devuelve el diff sin escribir nada. Estricto: no existe `forzar` para el
 * agente (saltar la guarda de cierres masivos es cosa de un administrador).
 */
export const SincronizarQuery = z
  .object({ simular: booleanoDeConsulta.optional() })
  .strict();
export type SincronizarQuery = z.infer<typeof SincronizarQuery>;
