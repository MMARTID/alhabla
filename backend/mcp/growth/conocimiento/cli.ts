import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { ErroresDeExtraccion, construirAfirmaciones } from "./construir.js";
import { cargarEntrada, cargarProductMd, raizPorDefecto } from "./entrada.js";
import { huellasActuales, reescribirHuellas } from "./huellas.js";
import {
  cuerpoDeSincronizacion,
  prepararCarga,
  type CargaDeConocimiento,
} from "./index.js";

/**
 * CLI del sincronizador de conocimiento (`npm run growth:conocimiento -- …`).
 *
 *   --comprobar   Extrae y comprueba todos los invariantes. Sin red, sin base
 *                 de datos y sin git: es lo que corre en CI. Falla si PRODUCT.md,
 *                 plans.ts, paginas.ts… cambian de forma que el mapa no cubra algo.
 *   --dry-run     Calcula la carga y le pregunta al servidor qué cambiaría
 *                 (`?simular=true`), sin escribir nada.
 *   --aplicar     Lo mismo, pero aplicando. En producción pide confirmación.
 *   --huellas     Compara la huella de cada texto revisado a mano del mapa con
 *                 la del bullet de PRODUCT.md del que sale (solo lee).
 *   --actualizar-huellas
 *                 Reescribe las huellas de mapa.ts con las de hoy. Es el gesto
 *                 de «he releído el bullet y el texto sigue siendo cierto»:
 *                 mira antes `git diff PRODUCT.md`.
 *
 *   --entorno dev|prod        (por defecto dev). Dev sincroniza la rama y el
 *                             árbol que haya (se avisa si hay cambios sin
 *                             commitear); producción exige un árbol limpio e
 *                             idéntico a origin/main.
 *   --url <base>              Otra URL del backend de dev. Producción no admite ninguna.
 *   --raiz <ruta>             Otra raíz del repo.
 *   --json                    Salida en JSON.
 *
 * El token (alcance `conocimiento`) va en GROWTH_CONOCIMIENTO_TOKEN, nunca en
 * un argumento: los argumentos quedan en el historial de la shell.
 */

type Modo =
  "comprobar" | "dry-run" | "aplicar" | "huellas" | "actualizar-huellas";
type Entorno = "dev" | "prod";

export type Opciones = {
  modo: Modo;
  entorno: Entorno;
  url: string | null;
  raiz: string | null;
  json: boolean;
};

export class ErrorDeUso extends Error {}

export const URL_DE_PRODUCCION = "https://api.alhabla.ai";
export const URL_DE_DEV = "http://localhost:3000";
/** Hosts a los que se manda en dev y con qué protocolos: el token viaja en una cabecera. */
const HOSTS_DE_DEV = new Map<string, readonly string[]>([
  ["localhost", ["http:", "https:"]],
  ["127.0.0.1", ["http:", "https:"]],
  ["[::1]", ["http:", "https:"]],
  // Fuera de la máquina: solo cifrado.
  ["dev-api.alhabla.ai", ["https:"]],
]);

export function analizarArgumentos(argv: readonly string[]): Opciones {
  const opciones: Opciones = {
    modo: "comprobar",
    entorno: "dev",
    url: null,
    raiz: null,
    json: false,
  };
  const modos: Modo[] = [];
  const siguiente = (i: number, nombre: string): string => {
    const valor = argv[i + 1];
    if (valor === undefined || valor.startsWith("--")) {
      throw new ErrorDeUso(`${nombre} necesita un valor.`);
    }
    return valor;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--comprobar":
        modos.push("comprobar");
        break;
      case "--dry-run":
        modos.push("dry-run");
        break;
      case "--aplicar":
        modos.push("aplicar");
        break;
      case "--huellas":
        modos.push("huellas");
        break;
      case "--actualizar-huellas":
        modos.push("actualizar-huellas");
        break;
      case "--entorno": {
        const valor = siguiente(i++, arg);
        if (valor !== "dev" && valor !== "prod") {
          throw new ErrorDeUso(`--entorno debe ser dev o prod, no «${valor}».`);
        }
        opciones.entorno = valor;
        break;
      }
      case "--url":
        opciones.url = siguiente(i++, arg);
        break;
      case "--raiz":
        opciones.raiz = siguiente(i++, arg);
        break;
      case "--json":
        opciones.json = true;
        break;
      default:
        throw new ErrorDeUso(`Argumento desconocido: ${arg}`);
    }
  }
  if (modos.length > 1) {
    throw new ErrorDeUso(
      "Elige solo uno: --comprobar, --dry-run, --aplicar, --huellas o --actualizar-huellas."
    );
  }
  if (modos.length === 0) {
    throw new ErrorDeUso(
      "Falta --comprobar, --dry-run, --aplicar, --huellas o --actualizar-huellas."
    );
  }
  opciones.modo = modos[0];

  if (opciones.entorno === "prod") {
    if (opciones.url) {
      throw new ErrorDeUso(
        "Producción no admite --url: va siempre a api.alhabla.ai."
      );
    }
  }
  return opciones;
}

/** La URL del backend a la que se manda la carga; nunca otra que la de dev o la de producción. */
export function urlDelBackend(
  opciones: Pick<Opciones, "entorno" | "url">,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (opciones.entorno === "prod") return URL_DE_PRODUCCION;
  const base = opciones.url ?? env.GROWTH_API_URL ?? URL_DE_DEV;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new ErrorDeUso(`La URL «${base}» no es válida.`);
  }
  const protocolos = HOSTS_DE_DEV.get(url.hostname);
  if (!protocolos) {
    throw new ErrorDeUso(
      `En dev solo se manda a localhost o dev-api.alhabla.ai, no a ${url.hostname}.`
    );
  }
  if (!protocolos.includes(url.protocol)) {
    throw new ErrorDeUso(
      `${url.hostname} solo se admite por https (con ${url.protocol}// el token viajaría en claro).`
    );
  }
  return url.origin;
}

// ── Salida ───────────────────────────────────────────────────────────────

function porTipo(afirmaciones: readonly { tipo: string }[]): string {
  const conteo = new Map<string, number>();
  for (const a of afirmaciones) {
    conteo.set(a.tipo, (conteo.get(a.tipo) ?? 0) + 1);
  }
  return [...conteo].map(([tipo, n]) => `${tipo} ${n}`).join(", ");
}

function imprimirCarga(carga: CargaDeConocimiento) {
  console.log(
    `Commit ${carga.commitSha.slice(0, 7)}: ${carga.afirmaciones.length} afirmaciones (${porTipo(carga.afirmaciones)}), ${carga.competidores.length} competidores, ${carga.nichos.length} nichos, ${carga.paginas?.length ?? 0} páginas, ${carga.fuentesLeidas.length} ficheros leídos.`
  );
}

type RespuestaDeSincronizacion = {
  commitSha: string;
  simulado: boolean;
  sinCambios: boolean;
  aplicable: boolean;
  motivoNoAplicable: string | null;
  prohibidasDebilitadas?: {
    clave: string;
    motivo: string;
    terminos: string[];
  }[];
  nuevas: string[];
  modificadas: { clave: string; campos: string[]; semantico: boolean }[];
  retiradas: string[];
  iguales: number;
  competidoresNuevos: string[];
  nichosNuevos: string[];
  paginasNuevas: string[];
  paginasActualizadas: string[];
  borradoresBloqueados: { borradorId: string; claves: string[] }[];
  avisos: string[];
};

function lista(titulo: string, elementos: readonly string[]) {
  if (elementos.length === 0) return;
  const visibles = elementos.slice(0, 12);
  console.log(
    `  ${titulo} (${elementos.length}): ${visibles.join(", ")}${elementos.length > visibles.length ? ", …" : ""}`
  );
}

function imprimirRespuesta(r: RespuestaDeSincronizacion) {
  console.log(r.simulado ? "Simulación (no se ha escrito nada):" : "Aplicado:");
  if (r.sinCambios) {
    console.log(`  Sin cambios (${r.iguales} afirmaciones iguales).`);
  }
  lista("Nuevas", r.nuevas);
  lista(
    "Modificadas",
    r.modificadas.map(
      (m) =>
        `${m.clave} [${m.campos.join("+")}${m.semantico ? "" : ", no cambia el sentido"}]`
    )
  );
  lista("Retiradas", r.retiradas);
  lista("Competidores nuevos", r.competidoresNuevos);
  lista("Nichos nuevos", r.nichosNuevos);
  lista("Páginas nuevas", r.paginasNuevas);
  lista("Páginas actualizadas", r.paginasActualizadas);
  lista(
    r.simulado ? "Borradores que se bloquearían" : "Borradores bloqueados",
    r.borradoresBloqueados.map(
      (b) => `${b.borradorId} (${b.claves.join(", ")})`
    )
  );
  lista("Avisos", r.avisos);
  lista(
    "Prohibidas que se debilitarían",
    (r.prohibidasDebilitadas ?? []).map(
      (d) => `${d.clave} [${d.motivo}: ${d.terminos.join(", ")}]`
    )
  );
  if (!r.aplicable) {
    console.log(
      `  NO SE PODRÍA APLICAR: ${r.motivoNoAplicable}\n  Si el cambio es real, hace falta un administrador: ni este token ni el CLI pueden saltarse la guarda de cierres masivos ni la de prohibidas.`
    );
  }
}

async function enviar(
  base: string,
  carga: CargaDeConocimiento,
  simular: boolean
): Promise<RespuestaDeSincronizacion> {
  const token = process.env.GROWTH_CONOCIMIENTO_TOKEN;
  if (!token) {
    throw new ErrorDeUso(
      "Falta GROWTH_CONOCIMIENTO_TOKEN (un token de agente con el alcance «conocimiento»; se crea con `npm run growth:token`)."
    );
  }
  const respuesta = await fetch(
    `${base}/growth/agente/conocimiento/sincronizar${simular ? "?simular=true" : ""}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cuerpoDeSincronizacion(carga)),
      signal: AbortSignal.timeout(60_000),
    }
  );
  const texto = await respuesta.text();
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    cuerpo = null;
  }
  if (!respuesta.ok) {
    const detalle =
      cuerpo && typeof cuerpo === "object" && "error" in cuerpo
        ? JSON.stringify((cuerpo as { error: unknown }).error)
        : texto.slice(0, 300);
    const codigo =
      cuerpo && typeof cuerpo === "object" && "codigo" in cuerpo
        ? ` [${(cuerpo as { codigo: string }).codigo}]`
        : "";
    throw new Error(
      `El backend respondió ${respuesta.status}${codigo}: ${detalle}`
    );
  }
  return cuerpo as RespuestaDeSincronizacion;
}

async function confirmar(pregunta: string, esperado: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const interfaz = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const respuesta = await interfaz.question(
      `${pregunta}\nEscribe «${esperado}» para continuar: `
    );
    return respuesta.trim() === esperado;
  } finally {
    interfaz.close();
  }
}

// ── Ejecución ────────────────────────────────────────────────────────────

/** `mapa.ts` que usa ESTE código (no el de otra `--raiz`): es el que se reescribe. */
const RUTA_DEL_MAPA = fileURLToPath(new URL("./mapa.ts", import.meta.url));

async function ejecutarHuellas(
  opciones: Opciones,
  raiz: string
): Promise<number> {
  const huellas = huellasActuales(await cargarProductMd(raiz));
  const desfasadas = huellas.filter((h) => h.actual !== h.esperada);

  if (opciones.modo === "actualizar-huellas") {
    const sinOrigen = huellas.filter((h) => h.actual === null);
    if (sinOrigen.length > 0) {
      console.error(
        `No se actualiza nada: ${sinOrigen.map((h) => h.clave).join(", ")} ya no encuentra${sinOrigen.length === 1 ? "" : "n"} su origen en PRODUCT.md. Arréglalo primero (--comprobar dice qué).`
      );
      return 1;
    }
    if (desfasadas.length === 0) {
      console.log("Las huellas ya estaban al día.");
      return 0;
    }
    const codigo = await readFile(RUTA_DEL_MAPA, "utf8");
    await writeFile(RUTA_DEL_MAPA, reescribirHuellas(codigo, desfasadas));
    for (const h of desfasadas) {
      console.log(`  ${h.clave}: ${h.esperada} → ${h.actual}`);
    }
    console.log(
      `Actualizadas ${desfasadas.length} huella${desfasadas.length === 1 ? "" : "s"} en mapa.ts. Revisa \`git diff PRODUCT.md mcp/growth/conocimiento/mapa.ts\`: el texto del mapa debe seguir diciendo lo que dice el bullet.`
    );
    return 0;
  }

  if (opciones.json) {
    console.log(JSON.stringify({ ok: desfasadas.length === 0, huellas }));
  } else {
    for (const h of huellas) {
      const estado =
        h.actual === null
          ? "SIN ORIGEN"
          : h.actual === h.esperada
            ? "ok"
            : `CAMBIÓ (hoy ${h.actual})`;
      console.log(`  ${h.clave.padEnd(52)} ${h.esperada}  ${estado}`);
    }
    console.log(
      desfasadas.length === 0
        ? "Todas las huellas coinciden con PRODUCT.md."
        : `${desfasadas.length} huella${desfasadas.length === 1 ? "" : "s"} no coincide${desfasadas.length === 1 ? "" : "n"}: relee los bullets y, si los textos del mapa siguen siendo ciertos, \`npm run growth:conocimiento -- --actualizar-huellas\`.`
    );
  }
  return desfasadas.length === 0 ? 0 : 1;
}

export async function ejecutar(opciones: Opciones): Promise<number> {
  const raiz = resolve(opciones.raiz ?? raizPorDefecto());

  if (opciones.modo === "huellas" || opciones.modo === "actualizar-huellas") {
    return ejecutarHuellas(opciones, raiz);
  }

  if (opciones.modo === "comprobar") {
    try {
      const resultado = construirAfirmaciones(await cargarEntrada(raiz));
      if (opciones.json) {
        console.log(
          JSON.stringify({
            ok: true,
            afirmaciones: resultado.afirmaciones.length,
            porTipo: porTipo(resultado.afirmaciones),
            avisos: resultado.avisos,
          })
        );
      } else {
        console.log(
          `OK: ${resultado.afirmaciones.length} afirmaciones (${porTipo(resultado.afirmaciones)}), ${resultado.competidores.length} competidores, ${resultado.nichos.length} nichos, ${resultado.paginas.length} páginas.`
        );
        for (const aviso of resultado.avisos) console.log(`  aviso: ${aviso}`);
      }
      return 0;
    } catch (error) {
      if (error instanceof ErroresDeExtraccion) {
        console.error(error.message);
        return 1;
      }
      throw error;
    }
  }

  const base = urlDelBackend(opciones);
  const carga = await prepararCarga({
    raiz,
    // En dev se admite la rama que haya; producción exige main.
    permitirRamaLocal: opciones.entorno === "dev",
  });
  if (!opciones.json) {
    imprimirCarga(carga);
    for (const aviso of carga.avisos) console.log(`  aviso: ${aviso}`);
  }

  const simulacion = await enviar(base, carga, true);
  if (opciones.json && opciones.modo === "dry-run") {
    console.log(JSON.stringify(simulacion));
    return simulacion.aplicable ? 0 : 1;
  }
  if (!opciones.json) imprimirRespuesta(simulacion);
  if (opciones.modo === "dry-run") return simulacion.aplicable ? 0 : 1;

  if (!simulacion.aplicable) return 1;
  if (simulacion.sinCambios) {
    console.log("Nada que aplicar (se renueva la fecha del snapshot).");
  }
  if (opciones.entorno === "prod") {
    const confirmado = await confirmar(
      `Vas a aplicar ${carga.afirmaciones.length} afirmaciones en PRODUCCIÓN (${base}).`,
      "aplicar en produccion"
    );
    if (!confirmado) {
      console.error("No se ha confirmado: no se aplica nada.");
      return 1;
    }
  }
  const aplicada = await enviar(base, carga, false);
  if (opciones.json) console.log(JSON.stringify(aplicada));
  else imprimirRespuesta(aplicada);
  return 0;
}

async function principal() {
  try {
    const opciones = analizarArgumentos(process.argv.slice(2));
    process.exitCode = await ejecutar(opciones);
  } catch (error) {
    if (error instanceof ErrorDeUso) {
      console.error(
        `${error.message}\n(Uso: npm run growth:conocimiento -- --comprobar | --dry-run | --aplicar [--entorno dev|prod] | --huellas | --actualizar-huellas)`
      );
      process.exitCode = 2;
    } else {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void principal();
}
