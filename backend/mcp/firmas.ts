import {
  createPrivateKey,
  generateKeyPairSync,
  sign as firmarEd25519,
} from "node:crypto";
import Retell from "retell-sdk";

/**
 * Firmas de los webhooks simulados. Nada de esto toca la verificación del
 * backend (plugins/firmaTelnyx.ts y firmaRetell.ts): firma igual que el
 * proveedor para que la verificación de siempre las acepte.
 *
 * Telnyx firma `${timestamp}|${cuerpo}` con Ed25519 y su clave privada, que
 * solo tiene Telnyx. Por eso las peticiones simuladas van al backend de
 * simulación (`backend-sim` en docker-compose), que confía en una clave
 * pública generada en local (`TELNYX_PUBLIC_KEY_SIMULACION`); el backend de
 * dev sigue confiando solo en la de Telnyx.
 */
export function firmarComoTelnyx(
  cuerpo: string,
  clavePrivadaBase64: string,
  marcaDeTiempo = Math.floor(Date.now() / 1000).toString()
): { firma: string; marcaDeTiempo: string } {
  const clavePrivada = createPrivateKey({
    key: Buffer.from(clavePrivadaBase64, "base64"),
    format: "der",
    type: "pkcs8",
  });
  const firma = firmarEd25519(
    null,
    Buffer.from(`${marcaDeTiempo}|${cuerpo}`, "utf8"),
    clavePrivada
  ).toString("base64");
  return { firma, marcaDeTiempo };
}

/**
 * Par de claves con el formato que usa Telnyx: la pública son los 32 bytes
 * crudos en base64 (lo que espera `TELNYX_PUBLIC_KEY`); la privada, PKCS#8
 * DER en base64.
 */
export function generarClavesDeSimulacion(): {
  publica: string;
  privada: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const spki = publicKey.export({ type: "spki", format: "der" });
  return {
    publica: spki.subarray(spki.length - 32).toString("base64"),
    privada: privateKey
      .export({ type: "pkcs8", format: "der" })
      .toString("base64"),
  };
}

/** Retell firma con la API key de la cuenta (HMAC), la misma que usa dev. */
export function firmarComoRetell(cuerpo: string, apiKey: string): Promise<string> {
  return Retell.sign(cuerpo, apiKey);
}
