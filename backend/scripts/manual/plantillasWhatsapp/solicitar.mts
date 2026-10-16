/**
 * Solicita a Meta (vía Telnyx) las plantillas de WhatsApp traducidas de
 * `traducciones.json`: las vigentes en español (al cliente en catalán,
 * inglés, francés, alemán, italiano, portugués y neerlandés; al dueño solo
 * en catalán). Meta no admite euskera ni gallego en plantillas.
 *
 * Telnyx no tiene borradores: `POST /v2/whatsapp/message_templates` manda la
 * plantilla a revisión de Meta en el acto, y una plantilla `PENDING` no se
 * puede editar hasta que Meta la resuelve. Por eso el script, sin
 * `--enviar`, solo enseña lo que haría.
 *
 * Uso:
 *   npx tsx scripts/manual/plantillasWhatsapp/solicitar.mts
 *   npx tsx scripts/manual/plantillasWhatsapp/solicitar.mts --idioma ca
 *   npx tsx scripts/manual/plantillasWhatsapp/solicitar.mts --nombre hueco_libre --enviar
 *
 * Salta las que ya existen en el WABA con el mismo nombre e idioma. Después
 * de enviar, `sincronizarWhatsapp.mts` las vuelca en `WhatsappTemplate`.
 * Requiere TELNYX_API_KEY y WHATSAPP_WABA_ID (UUID del WABA en Telnyx).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

interface Plantilla {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING";
  audiencia: "cliente" | "negocio";
  parameter_format: "NAMED";
  components: Array<{ type: string; text?: string }>;
}

interface Argumentos {
  enviar: boolean;
  idioma?: string;
  nombre?: string;
}

const API = "https://api.telnyx.com/v2/whatsapp/message_templates";

function leerArgumentos(argv: string[]): Argumentos {
  const args: Argumentos = { enviar: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--enviar") {
      args.enviar = true;
    } else if (flag === "--idioma" && value) {
      args.idioma = value;
      i += 1;
    } else if (flag === "--nombre" && value) {
      args.nombre = value;
      i += 1;
    } else {
      throw new Error(`Argumento no reconocido: ${flag}`);
    }
  }
  return args;
}

/** Reglas de Meta que rechazan la creación (AGENTS.md § Plantillas). */
function erroresDeMeta(p: Plantilla): string[] {
  const errores: string[] = [];
  const cuerpo = p.components.find((c) => c.type === "BODY")?.text ?? "";
  if (/^\s*\{\{/.test(cuerpo)) errores.push("el cuerpo empieza con variable");
  if (/\}\}\s*$/.test(cuerpo)) errores.push("el cuerpo acaba con variable");
  if (cuerpo.length > 1024) errores.push("cuerpo de más de 1024 caracteres");
  return errores;
}

async function telnyx(
  apiKey: string,
  url: string,
  init?: RequestInit
): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${texto}`);
  return JSON.parse(texto);
}

async function main(): Promise<void> {
  const args = leerArgumentos(process.argv.slice(2));
  const apiKey = process.env.TELNYX_API_KEY;
  const wabaId = process.env.WHATSAPP_WABA_ID;
  if (!apiKey || !wabaId) {
    throw new Error("Faltan TELNYX_API_KEY o WHATSAPP_WABA_ID");
  }

  const ruta = fileURLToPath(new URL("./traducciones.json", import.meta.url));
  const { plantillas } = JSON.parse(readFileSync(ruta, "utf8")) as {
    plantillas: Plantilla[];
  };
  const elegidas = plantillas.filter(
    (p) =>
      (!args.idioma || p.language === args.idioma) &&
      (!args.nombre || p.name === args.nombre)
  );

  const existentes = (await telnyx(
    apiKey,
    `${API}?waba_id=${encodeURIComponent(wabaId)}&page%5Bsize%5D=250`
  )) as { data: Array<{ name: string; language: string; status: string }> };
  const yaEstan = new Map(
    existentes.data.map((t) => [`${t.name}/${t.language}`, t.status])
  );

  let enviadas = 0;
  for (const p of elegidas) {
    const clave = `${p.name}/${p.language}`;
    const estado = yaEstan.get(clave);
    if (estado) {
      console.log(`= ${clave}: ya existe (${estado}), se salta`);
      continue;
    }
    const errores = erroresDeMeta(p);
    if (errores.length > 0) {
      console.error(`✗ ${clave}: ${errores.join("; ")}`);
      continue;
    }
    if (!args.enviar) {
      console.log(`· ${clave} (${p.category}, ${p.audiencia}): se solicitaría`);
      continue;
    }
    // `audiencia` es nuestra (para el filtro y la vista previa): no va a Meta.
    const { name, language, category, parameter_format, components } = p;
    try {
      const res = (await telnyx(apiKey, API, {
        method: "POST",
        body: JSON.stringify({
          waba_id: wabaId,
          name,
          language,
          category,
          parameter_format,
          components,
        }),
      })) as { data?: { id?: string; status?: string } };
      enviadas += 1;
      console.log(
        `✓ ${clave}: ${res.data?.status ?? "?"} (${res.data?.id ?? "sin id"})`
      );
    } catch (error) {
      console.error(
        `✗ ${clave}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  console.log(
    args.enviar
      ? `${enviadas} plantillas enviadas a revisión de Meta.`
      : `Modo de prueba: nada enviado. Añade --enviar para solicitarlas.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
