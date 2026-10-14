import { generarClavesDeSimulacion } from "./firmas.js";

/**
 * Genera el par de claves Ed25519 de los webhooks de Telnyx simulados.
 * Pegar las dos líneas en el `.env` de la raíz y (re)arrancar backend-sim:
 *
 *   cd backend && npx tsx mcp/generarClavesDeSimulacion.ts
 *
 * Son claves de desarrollo: solo valen contra backend-sim, que es el único
 * que confía en TELNYX_PUBLIC_KEY_SIMULACION.
 */
const { publica, privada } = generarClavesDeSimulacion();
console.log(`TELNYX_PUBLIC_KEY_SIMULACION=${publica}`);
console.log(`TELNYX_PRIVATE_KEY_SIMULACION=${privada}`);
