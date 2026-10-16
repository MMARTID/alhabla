/**
 * Solicita a Meta (vía Telnyx) las plantillas de WhatsApp de
 * `plantillas.json`. Las del cliente llevan cabecera, el negocio en negrita
 * y una línea con emoji por dato (estilo elegido por el usuario el 16-10):
 * en español EDITAN las aprobadas (mismo nombre y mismos parámetros, así el
 * código no cambia) y en catalán, inglés, francés, alemán, italiano,
 * portugués y neerlandés son nuevas. Las del dueño, solo en catalán. Meta no
 * admite euskera ni gallego en plantillas.
 *
 * Editar una plantilla aprobada la devuelve a revisión: mientras tanto no se
 * puede enviar y la cascada de `elegirPlantillaCliente` cae a la anterior
 * aprobada (`confirmacion_cita`, `recordatorio_cita`…). Meta deja editar una
 * aprobada como mucho 10 veces al mes y una vez al día, y la rechaza con
 * 2388039 («Message Template Status Can't Be Changed») mientras hay otro
 * idioma del mismo nombre en revisión (16-10: las 35 traducciones recién
 * creadas): primero las nuevas, y las ediciones cuando Meta las resuelva
 * (`--idioma es --enviar`).
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
 * Salta las que ya existen en el WABA con el mismo nombre e idioma, salvo las
 * marcadas `editar`, que se editan (`PATCH /v2/whatsapp/message_templates/{id}`).
 * Después de enviar, `sincronizarWhatsapp.mts` las vuelca en
 * `WhatsappTemplate`.
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
  /** Ya existe aprobada en el WABA: se edita en vez de crearla. */
  editar?: boolean;
  components: Array<{ type: string; text?: string }>;
}

interface Argumentos {
  enviar: boolean;
  idioma?: string;
  nombre?: string;
}

const API = "https://api.telnyx.com/v2/whatsapp/message_templates";
// La de la documentación del SDK (`/v2/whatsapp_message_templates/{id}`) da
// 404; la que existe es la misma ruta de la lista con el id (16-10).
const API_EDITAR = API;

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

  const ruta = fileURLToPath(new URL("./plantillas.json", import.meta.url));
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
  )) as {
    data: Array<{ id: string; name: string; language: string; status: string }>;
  };
  const yaEstan = new Map(
    existentes.data.map((t) => [`${t.name}/${t.language}`, t])
  );

  let enviadas = 0;
  for (const p of elegidas) {
    const clave = `${p.name}/${p.language}`;
    const existente = yaEstan.get(clave);
    if (existente && !p.editar) {
      console.log(`= ${clave}: ya existe (${existente.status}), se salta`);
      continue;
    }
    if (!existente && p.editar) {
      console.error(`✗ ${clave}: marcada para editar pero no existe en el WABA`);
      continue;
    }
    const errores = erroresDeMeta(p);
    if (errores.length > 0) {
      console.error(`✗ ${clave}: ${errores.join("; ")}`);
      continue;
    }
    if (existente) {
      // Meta solo deja editar APPROVED, REJECTED o PAUSED.
      if (!["APPROVED", "REJECTED", "PAUSED"].includes(existente.status)) {
        console.error(
          `✗ ${clave}: está ${existente.status}; Meta no deja editarla así`
        );
        continue;
      }
      if (!args.enviar) {
        console.log(
          `· ${clave} (${existente.status}): se editaría y volvería a revisión`
        );
        continue;
      }
      try {
        await telnyx(apiKey, `${API_EDITAR}/${existente.id}`, {
          method: "PATCH",
          body: JSON.stringify({ components: p.components }),
        });
        enviadas += 1;
        console.log(`✓ ${clave}: editada, vuelve a revisión de Meta`);
      } catch (error) {
        console.error(
          `✗ ${clave}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      continue;
    }
    if (!args.enviar) {
      console.log(`· ${clave} (${p.category}, ${p.audiencia}): se solicitaría`);
      continue;
    }
    // `audiencia` y `editar` son nuestras: no van a Meta.
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
