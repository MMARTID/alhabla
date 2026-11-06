/**
 * Ancla en Europa (ANCLAJE_DEL_AUDIO, Frankfurt) el audio de todas las
 * conexiones de la cuenta de Telnyx: los Call Control Apps, las apps TeXML de
 * los assistants y las credential connections. Lo nuevo ya nace anclado
 * (createCallControlApp y createAssistant); esto es para lo que ya existía y
 * para repasar la cuenta. La cuenta es la misma para dev y producción hasta
 * #400, así que toca las dos.
 *
 * Uso:
 *   npx tsx scripts/anclarAudioEnEuropa.ts            # solo lista
 *   npx tsx scripts/anclarAudioEnEuropa.ts --aplicar  # y cambia las que falten
 */
import {
  ANCLAJE_DEL_AUDIO,
  telnyxAiAdapter,
} from "../src/adapters/telnyx/TelnyxAiAdapter.js";

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const conexiones = await telnyxAiAdapter.listarAnclajesDeConexiones();
  const pendientes = conexiones.filter((c) => c.anclaje !== ANCLAJE_DEL_AUDIO);

  for (const c of conexiones) {
    const marca = c.anclaje === ANCLAJE_DEL_AUDIO ? "ok" : "--";
    console.log(`${marca} ${c.tipo.padEnd(12)} ${c.id}  ${c.nombre}  (${c.anclaje})`);
  }
  console.log(
    `\n${conexiones.length} conexiones, ${pendientes.length} sin anclar en ${ANCLAJE_DEL_AUDIO}`
  );

  if (!aplicar) {
    if (pendientes.length > 0) console.log("Pasa --aplicar para cambiarlas.");
    return;
  }

  let fallos = 0;
  for (const c of pendientes) {
    try {
      await telnyxAiAdapter.anclarConexionEnEuropa(c.tipo, c.id);
      console.log(`anclada ${c.tipo} ${c.id} ${c.nombre}`);
    } catch (error) {
      fallos++;
      console.error(
        `[Telnyx] No se pudo anclar ${c.tipo} ${c.id} ${c.nombre}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  if (fallos > 0) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error("Fallo:", error);
    process.exit(1);
  });
