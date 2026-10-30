import { execFile } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

/**
 * Lee los módulos TypeScript de `web/` (plans, paginas, comparativas,
 * sectores) y los vuelca como JSON. Corre en un PROCESO HIJO, por tres
 * razones verificadas (PLAN-GROWTH.md § 3.1, informe del sincronizador):
 *
 * 1. Alias `@/`: tsx usa UN solo tsconfig. El del backend mapea `@/*` a
 *    `backend/src/*` y `comparativas.ts` o `sectores/index.ts` fallarían con
 *    «Cannot find module '@/lib/plans'». El hijo arranca con
 *    `TSX_TSCONFIG_PATH=web/tsconfig.json`.
 * 2. CJS: `web/package.json` no es `"type": "module"`, así que tsx trata sus
 *    .ts como CommonJS. Un `import { plans }` estático falla; hay que usar
 *    `await import(ruta)` y leer `.default`.
 * 3. stdout del MCP: el proceso principal puede ser el MCP stdio, cuyo stdout
 *    ES el canal del protocolo. El hijo escribe el JSON en SU stdout y el
 *    padre lo recoge; nada del `web/` se carga en el proceso principal.
 *
 * Por eso este fichero no importa nada de `web/` de forma estática y solo
 * pasa a JSON los campos que hacen falta (los sectores completos traen
 * conversaciones de WhatsApp y guiones que no se usan).
 */

export type DatosDeWeb = {
  plans: {
    id: string;
    name: string;
    price: number;
    founderPrice: number;
    minutes: number;
    extraPerMinute: number;
    features: string[];
  }[];
  ivaPorcentaje: number;
  diasDePrueba: number;
  tranquilizadorDePrueba: string;
  precioDesde: string;
  paginas: {
    ruta: string;
    nombre: string;
    resumen: string;
    seccion: string;
    actualizado: string | null;
  }[];
  comparativas: {
    consultadas: string;
    resumen: {
      ruta: string | null;
      nombre: string;
      paraQuien: string;
      precio: string;
      numero: string;
    }[];
    fuentes: { nombre: string; url: string }[];
    fuenteLey: { nombre: string; url: string };
  };
  sectores: {
    slug: string;
    nombre: string;
    paraQuien: string;
    negocio: string;
    clientes: string;
    descripcion: string;
    heroFrase: string;
    titulo: string;
    salud: string | null;
  }[];
};

const MARCADOR = "@@DATOS-DE-WEB@@";

type Modulo = Record<string, unknown>;

async function cargar(raiz: string, ruta: string): Promise<Modulo> {
  const espacio = (await import(
    pathToFileURL(join(raiz, ruta)).href
  )) as Modulo;
  // tsx entrega los módulos CJS con los exports colgando de `default`.
  return ((espacio.default as Modulo | undefined) ?? espacio) as Modulo;
}

function pedir<T>(modulo: Modulo, nombre: string, ruta: string): T {
  if (!(nombre in modulo)) {
    throw new Error(
      `[Conocimiento] ${ruta} ya no exporta «${nombre}»: actualiza mcp/growth/conocimiento/cargarWeb.ts.`
    );
  }
  return modulo[nombre] as T;
}

/** Se ejecuta DENTRO del hijo. */
export async function volcarDatosDeWeb(raiz: string): Promise<DatosDeWeb> {
  const rutaPlans = "web/src/lib/plans.ts";
  const rutaPaginas = "web/src/lib/paginas.ts";
  const rutaComparativas = "web/src/lib/comparativas.ts";
  const rutaSectores = "web/src/lib/sectores/index.ts";

  const [plansMod, paginasMod, comparativasMod, sectoresMod] =
    await Promise.all([
      cargar(raiz, rutaPlans),
      cargar(raiz, rutaPaginas),
      cargar(raiz, rutaComparativas),
      cargar(raiz, rutaSectores),
    ]);

  type PlanWeb = {
    id: string;
    name: string;
    price: number;
    founderPrice: number;
    minutes: number;
    extraPerMinute: number;
    features: readonly string[];
  };
  type PaginaWeb = {
    ruta: string;
    nombre: string;
    resumen: string;
    seccion: string;
    actualizado?: string;
  };
  type FilaResumen = {
    ruta?: string;
    nombre: string;
    paraQuien: string;
    precio: string;
    numero: string;
  };
  type SectorWeb = {
    slug: string;
    nombre: string;
    paraQuien: string;
    negocio: string;
    clientes: string;
    descripcion: string;
    hero: { frase: string };
    oficio: { salud?: { texto: string } };
  };

  const plans = pedir<readonly PlanWeb[]>(plansMod, "plans", rutaPlans);
  const paginas = pedir<readonly PaginaWeb[]>(
    paginasMod,
    "PAGINAS",
    rutaPaginas
  );
  const sectores = pedir<Record<string, SectorWeb>>(
    sectoresMod,
    "SECTORES",
    rutaSectores
  );
  const tituloDeSector = pedir<(s: SectorWeb) => string>(
    sectoresMod,
    "tituloDeSector",
    rutaSectores
  );

  return {
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      founderPrice: p.founderPrice,
      minutes: p.minutes,
      extraPerMinute: p.extraPerMinute,
      features: [...p.features],
    })),
    ivaPorcentaje: pedir<number>(plansMod, "IVA_PORCENTAJE", rutaPlans),
    diasDePrueba: pedir<number>(plansMod, "TRIAL_DAYS", rutaPlans),
    tranquilizadorDePrueba: pedir<string>(
      plansMod,
      "TRIAL_REASSURANCE",
      rutaPlans
    ),
    precioDesde: pedir<string>(plansMod, "PRECIO_DESDE", rutaPlans),
    paginas: paginas.map((p) => ({
      ruta: p.ruta,
      nombre: p.nombre,
      resumen: p.resumen,
      seccion: p.seccion,
      actualizado: p.actualizado ?? null,
    })),
    comparativas: {
      consultadas: pedir<string>(
        comparativasMod,
        "CONSULTADAS",
        rutaComparativas
      ),
      resumen: pedir<readonly FilaResumen[]>(
        comparativasMod,
        "RESUMEN_PLATAFORMAS",
        rutaComparativas
      ).map((f) => ({
        ruta: f.ruta ?? null,
        nombre: f.nombre,
        paraQuien: f.paraQuien,
        precio: f.precio,
        numero: f.numero,
      })),
      fuentes: pedir<{ nombre: string; url: string }[]>(
        comparativasMod,
        "FUENTES_DEL_RESUMEN",
        rutaComparativas
      ).map((f) => ({ nombre: f.nombre, url: f.url })),
      fuenteLey: pedir<{ nombre: string; url: string }>(
        comparativasMod,
        "FUENTE_LEY",
        rutaComparativas
      ),
    },
    sectores: Object.values(sectores).map((s) => ({
      slug: s.slug,
      nombre: s.nombre,
      paraQuien: s.paraQuien,
      negocio: s.negocio,
      clientes: s.clientes,
      descripcion: s.descripcion,
      heroFrase: s.hero.frase,
      titulo: tituloDeSector(s),
      salud: s.oficio.salud?.texto ?? null,
    })),
  };
}

const ejecutar = promisify(execFile);

/**
 * Variables del entorno que el hijo SÍ recibe. `web/` es código TypeScript
 * que se ejecuta: no tiene por qué ver `GROWTH_CONOCIMIENTO_TOKEN`,
 * `DATABASE_URL` ni ningún secreto del proceso que lo lanza. Solo lo que
 * necesitan Node y `tsx` para arrancar (ruta de ejecutables, carpeta
 * personal y temporal, idioma y las `NODE_*`).
 */
const VARIABLES_DEL_HIJO = new Set([
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TZ",
  "SystemRoot",
]);

/** Entorno del proceso hijo: lo imprescindible y `TSX_TSCONFIG_PATH`; nunca `GROWTH_*`. */
export function entornoMinimoDelHijo(
  raiz: string,
  base: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const entorno: NodeJS.ProcessEnv = {};
  for (const [clave, valor] of Object.entries(base)) {
    if (valor === undefined) continue;
    if (VARIABLES_DEL_HIJO.has(clave) || /^NODE_/.test(clave)) {
      entorno[clave] = valor;
    }
  }
  entorno.TSX_TSCONFIG_PATH = join(resolve(raiz), "web", "tsconfig.json");
  return entorno;
}

/** La carpeta `backend/`, donde vive `node_modules/tsx`. */
function carpetaDelBackend(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
}

/**
 * Lanza el hijo y devuelve lo que volcó. `raiz` es la raíz del repo (donde
 * están `web/` y `PRODUCT.md`).
 */
export async function cargarDatosDeWeb(raiz: string): Promise<DatosDeWeb> {
  const { stdout } = await ejecutar(
    process.execPath,
    [
      "--import",
      "tsx",
      fileURLToPath(import.meta.url),
      "--hijo",
      resolve(raiz),
    ],
    {
      cwd: carpetaDelBackend(),
      env: entornoMinimoDelHijo(raiz),
      maxBuffer: 16 * 1024 * 1024,
    }
  ).catch((error: { stderr?: string; message: string }) => {
    throw new Error(
      `[Conocimiento] No se pudo leer web/ en un proceso hijo: ${(error.stderr ?? error.message).trim().split("\n").slice(-6).join(" | ")}`
    );
  });

  const inicio = stdout.lastIndexOf(MARCADOR);
  if (inicio === -1) {
    throw new Error(
      "[Conocimiento] El proceso hijo que lee web/ no devolvió datos."
    );
  }
  return JSON.parse(stdout.slice(inicio + MARCADOR.length)) as DatosDeWeb;
}

// Modo hijo: `node --import tsx cargarWeb.ts --hijo <raiz>`.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url) &&
  process.argv[2] === "--hijo"
) {
  volcarDatosDeWeb(process.argv[3])
    .then((datos) => {
      process.stdout.write(`\n${MARCADOR}${JSON.stringify(datos)}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
