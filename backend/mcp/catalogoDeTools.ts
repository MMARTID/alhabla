import { buildTelnyxVoiceTools } from "../src/lib/telnyxAssistantPayload.js";

/**
 * Catálogo de las tools de voz que el assistant de Telnyx llama por webhook,
 * sacado de la misma función que las registra en Telnyx
 * (`buildTelnyxVoiceTools`): nombres, argumentos y cuáles son obligatorios no
 * se pueden desfasar de lo que el assistant envía de verdad.
 */

type Propiedad = { type?: string; description?: string } & Record<string, unknown>;

export type ToolDeVoz = {
  nombre: string;
  ruta: string;
  descripcion: string;
  argumentos: Record<string, Propiedad>;
  obligatorios: string[];
  ejemplo: Record<string, unknown>;
};

const VALOR_DE_EJEMPLO: Record<string, unknown> = {
  string: "…",
  number: 30,
  boolean: true,
  array: [],
};

export function catalogoDeToolsDeVoz(): ToolDeVoz[] {
  return buildTelnyxVoiceTools("http://localhost").map((tool) => {
    const argumentos = tool.properties as Record<string, Propiedad>;
    const obligatorios = tool.required ?? [];
    const ejemplo: Record<string, unknown> = {};
    for (const nombre of obligatorios) {
      ejemplo[nombre] = VALOR_DE_EJEMPLO[argumentos[nombre]?.type ?? "string"];
    }
    // Las fechas llevan offset local: un ejemplo con «…» las haría fallar.
    if ("startDateTime" in ejemplo) {
      ejemplo.startDateTime = "2026-10-20T10:00:00+02:00";
    }
    return {
      nombre: tool.name,
      ruta: new URL(tool.url).pathname,
      descripcion: tool.description,
      argumentos,
      obligatorios,
      ejemplo,
    };
  });
}

/**
 * Avisos sobre el cuerpo de una llamada a una tool de voz: argumentos
 * obligatorios que faltan, de otro tipo o que la tool no conoce. NO bloquea
 * el envío —probar cómo responde una tool a un cuerpo malo es legítimo—, solo
 * evita adivinar nombres (`fecha` en vez de `startDateTime`) leyendo código.
 */
export function avisosDeCuerpo(
  ruta: string,
  cuerpo: Record<string, unknown>,
  catalogo: ToolDeVoz[] = catalogoDeToolsDeVoz()
): string[] {
  const tool = catalogo.find((candidata) => candidata.ruta === ruta);
  if (!tool) return [];

  const avisos: string[] = [];
  for (const nombre of tool.obligatorios) {
    if (!(nombre in cuerpo)) {
      avisos.push(`Falta el argumento obligatorio «${nombre}».`);
    }
  }
  for (const [nombre, valor] of Object.entries(cuerpo)) {
    const definicion = tool.argumentos[nombre];
    if (!definicion) {
      const conocidos = Object.keys(tool.argumentos).join(", ") || "ninguno";
      avisos.push(
        `«${nombre}» no es un argumento de ${tool.nombre} (los suyos: ${conocidos}).`
      );
      continue;
    }
    const tipo = Array.isArray(valor) ? "array" : typeof valor;
    if (definicion.type && tipo !== definicion.type) {
      avisos.push(
        `«${nombre}» debería ser ${definicion.type} y es ${tipo}.`
      );
    }
  }
  return avisos;
}
