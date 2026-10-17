/**
 * Estado de GET /health. Solo las dependencias críticas (Postgres y Redis)
 * deciden el código: son lo que la revisión necesita para servir, y el
 * workflow de deploy revierte la revisión si /health no da "ok". Las
 * informativas (el proveedor de voz, Telnyx) salen en el JSON pero nunca
 * lo cambian: un fallo pasajero de su API durante un deploy revertía una
 * revisión sana (con las migraciones ya aplicadas).
 */
export async function comprobarSalud(comprobaciones: {
  criticas: Record<string, () => Promise<unknown>>;
  informativas: Record<string, () => Promise<unknown>>;
}): Promise<{ healthy: boolean; dependencies: Record<string, string> }> {
  const criticas = Object.entries(comprobaciones.criticas);
  const informativas = Object.entries(comprobaciones.informativas);
  const resultados = await Promise.allSettled(
    [...criticas, ...informativas].map(([, comprobar]) => comprobar())
  );

  const dependencies: Record<string, string> = {};
  [...criticas, ...informativas].forEach(([nombre], indice) => {
    dependencies[nombre] =
      resultados[indice].status === "fulfilled" ? "ok" : "unhealthy";
  });
  const healthy = criticas.every(([nombre]) => dependencies[nombre] === "ok");
  return { healthy, dependencies };
}

/**
 * Comprobación informativa con memoria, por instancia. El uptime check de
 * Cloud Monitoring pide /health cada 60 s desde 6 regiones (unas 8.600 veces
 * al día) y cada vez se abrían conexiones TLS nuevas con los proveedores de
 * voz (entonces Telnyx y Retell): ~30 MB/día de salida a internet y ~17.000
 * llamadas a sus APIs que no aportaban nada (issue #281). El resultado se guarda `vidaBienMs` si fue bien
 * y `vidaMalMs` si falló, para que una caída (y su vuelta) se vea pronto. Lo
 * que llega con una comprobación en vuelo espera a esa misma. Solo para las
 * informativas: las críticas se comprueban en cada consulta, porque deciden
 * el 200/503 y la vuelta atrás del deploy.
 */
export function conMemoria(
  comprobar: () => Promise<unknown>,
  {
    vidaBienMs = 60_000,
    vidaMalMs = 15_000,
    ahora = () => Date.now(),
  }: { vidaBienMs?: number; vidaMalMs?: number; ahora?: () => number } = {}
): () => Promise<void> {
  let guardado: { hasta: number; error: unknown } | null = null;
  let enVuelo: Promise<void> | null = null;

  return () => {
    if (guardado && ahora() < guardado.hasta) {
      const { error } = guardado;
      return error === undefined ? Promise.resolve() : Promise.reject(error);
    }
    enVuelo ??= comprobar()
      .then(
        () => {
          guardado = { hasta: ahora() + vidaBienMs, error: undefined };
        },
        (error: unknown) => {
          guardado = {
            hasta: ahora() + vidaMalMs,
            error: error ?? new Error("comprobación fallida"),
          };
          throw guardado.error;
        }
      )
      .finally(() => {
        enVuelo = null;
      });
    return enVuelo;
  };
}
