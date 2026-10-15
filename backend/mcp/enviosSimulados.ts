import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ejecutar = promisify(execFile);

/** Contenedor de backend-sim (docker-compose.yml, perfil sim). */
export const CONTENEDOR_DE_SIMULACION = "alhabla_backend_sim";

/** Formato de lib/enviosSimulados.ts → registrarEnvioSimulado. */
const LINEA_DE_ENVIO =
  /^(\S+)\s+\[(WhatsApp|SMS|Correo)\] ENVÍO SIMULADO \(ENVIOS_SIMULADOS=1\), no sale: destino=(\S+)\s*(.*)$/;

export type EnvioSimulado = {
  momento: string;
  canal: "WhatsApp" | "SMS" | "Correo";
  destino: string;
  detalle: string;
};

/** Extrae los envíos simulados de un volcado de `docker logs -t`. */
export function extraerEnviosSimulados(volcado: string): EnvioSimulado[] {
  const envios: EnvioSimulado[] = [];
  for (const linea of volcado.split("\n")) {
    const coincidencia = LINEA_DE_ENVIO.exec(linea.trim());
    if (!coincidencia) continue;
    const [, momento, canal, destino, detalle] = coincidencia;
    envios.push({
      momento,
      canal: canal as EnvioSimulado["canal"],
      destino,
      detalle,
    });
  }
  return envios;
}

/**
 * Lee del log de backend-sim los WhatsApp, SMS y correos que NO salieron.
 * Docker acepta `--since` como duración («10m», «1h») o fecha ISO; se valida
 * para no pasarle al CLI nada que no sea eso.
 */
export async function leerEnviosSimulados({
  desde = "30m",
  limite = 50,
  canal,
  destino,
}: {
  desde?: string;
  limite?: number;
  canal?: EnvioSimulado["canal"];
  destino?: string;
}): Promise<{ total: number; envios: EnvioSimulado[] }> {
  if (!/^(\d+[smh]|\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?)$/.test(desde)) {
    throw new Error(
      `[MCP] «desde» tiene que ser una duración como 10m, 2h o 30s, o una fecha ISO; llegó «${desde}»`
    );
  }
  let volcado: string;
  try {
    const { stdout, stderr } = await ejecutar(
      "docker",
      ["logs", "-t", "--since", desde, CONTENEDOR_DE_SIMULACION],
      { maxBuffer: 32 * 1024 * 1024 }
    );
    // Docker escribe el stderr del contenedor en el stderr del CLI:
    // console.warn (donde cae registrarEnvioSimulado) llega por ahí.
    volcado = `${stdout}\n${stderr}`;
  } catch (error) {
    throw new Error(
      `[MCP] No pude leer el log de ${CONTENEDOR_DE_SIMULACION} (${(error as Error).message.split("\n")[0]}). ¿Está levantado? scripts/backend-sim.sh`,
      { cause: error }
    );
  }

  const filtrados = extraerEnviosSimulados(volcado).filter(
    (envio) =>
      (!canal || envio.canal === canal) &&
      (!destino || envio.destino.includes(destino))
  );
  return { total: filtrados.length, envios: filtrados.slice(-limite) };
}
