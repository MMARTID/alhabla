import { readFileSync } from "node:fs";
import path from "node:path";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { clienteHttp } from "@/lib/cliente-http";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import {
  ARRANQUE_DE_LA_DESCRIPCION_LARGA,
  CATEGORIAS_DE_LA_FICHA,
  CLAVES_DE_LA_DESCRIPCION_LARGA,
  CLAVES_DE_PRECIOS,
  LIMITE_DE_DESCRIPCION_CORTA,
  LIMITE_DE_DESCRIPCION_LARGA,
  NOMBRE_DEL_PRODUCTO,
  WEB_DEL_PRODUCTO,
} from "@/lib/demo/ficha-demo";
import {
  CODIGOS_DE_ERROR_DE_TAREAS,
  PASOS_GENERICOS_DE_UNA_TAREA,
  SEPARACION_DE_ORDEN,
  TAREAS_INICIALES,
} from "@/lib/demo/tareas-demo";
import { guardarCredencial, reiniciarSesionParaPruebas } from "@/lib/sesion";
import {
  CATEGORIAS_DE_TAREA,
  ESTADOS_DE_TAREA,
  LARGO_MAXIMO_DE_NOTAS_DE_TAREA,
  LARGO_MAXIMO_DE_NOTA_DE_RESULTADO_DE_TAREA,
  LARGO_MAXIMO_DE_PASO_DE_TAREA,
  LARGO_MAXIMO_DE_TITULO_DE_TAREA,
  LARGO_MAXIMO_DE_URL_DE_TAREA,
  MAXIMO_DE_PASOS_DE_TAREA,
  ORIGENES_DE_TAREA,
  RESULTADOS_DE_TAREA,
  TIPOS_DE_DATO_DEL_COMPARADOR,
} from "@/lib/types";
import { crearJwt } from "../helpers/jwt";

/**
 * El comparador, la Ficha de Alhabla y las tareas se copian a mano del
 * backend (`types.ts`, `cliente-http.ts`, `demo/ficha-demo.ts`,
 * `demo/tareas-demo.ts`). Este test lee los ficheros del backend y falla si se
 * separan. Si falla, mira el mensaje y copia el cambio al lado del panel.
 */

const BACKEND = path.resolve(
  import.meta.dirname,
  "../../../backend/src/modules/growth"
);
const leer = (fichero: string) =>
  readFileSync(path.join(BACKEND, fichero), "utf8");

const esquemas = leer("esquemas.ts");
const servicioDeTareas = leer("servicioTareas.ts");
const rutasDeTareas = leer("routesTareas.ts");
const rutasDeCompetencia = leer("routesCompetencia.ts");
const inicialesDelBackend = leer("tareasIniciales.ts");
const fichaDelBackend = leer("fichaDeAlhabla.ts");
const comparadorDelBackend = leer("comparadorDePrecios.ts");

/** `export const NOMBRE = [ "a", "b" ] as const;` → ["a", "b"] */
function leerLista(texto: string, nombre: string): string[] {
  const inicio = texto.indexOf(`export const ${nombre}`);
  expect(inicio, `no se encontró ${nombre}`).toBeGreaterThan(-1);
  const abre = texto.indexOf("[", texto.indexOf("=", inicio));
  const cierra = texto.indexOf("]", abre);
  return [...texto.slice(abre, cierra).matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(
    (m) => m[1]
  );
}

function leerNumero(texto: string, nombre: string): number {
  const m = texto.match(new RegExp(`export const ${nombre}\\s*=\\s*([0-9_]+)`));
  expect(m, `no se encontró ${nombre}`).not.toBeNull();
  return Number(m![1].replace(/_/g, ""));
}

function leerTexto(texto: string, nombre: string): string {
  const m = texto.match(
    new RegExp(`export const ${nombre}\\s*=\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`)
  );
  expect(m, `no se encontró ${nombre}`).not.toBeNull();
  return m![1];
}

/** Los campos (primer nivel) de `export type NOMBRE = { campo: …; }`. */
function camposDelTipo(texto: string, nombre: string): string[] {
  const inicio = texto.indexOf(`export type ${nombre} =`);
  expect(inicio, `no se encontró el tipo ${nombre}`).toBeGreaterThan(-1);
  const fin = texto.indexOf("\n};", inicio);
  return [...texto.slice(inicio, fin).matchAll(/^ {2}(\w+)\??:/gm)].map(
    (m) => m[1]
  );
}

/** Las constantes de un esquema Zod: `.max(N)` de una línea. */
function maxDe(texto: string, declaracion: string): number {
  const m = texto.match(new RegExp(`${declaracion}[^;]*?\\.max\\((\\d+)\\)`));
  expect(m, `no se encontró ${declaracion}`).not.toBeNull();
  return Number(m![1]);
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

describe("las constantes de las tareas siguen a las del backend", () => {
  it("categorías, orígenes, estados y resultados son los mismos, en el mismo orden", () => {
    expect([...CATEGORIAS_DE_TAREA]).toEqual(
      leerLista(esquemas, "CATEGORIAS_DE_TAREA")
    );
    expect([...ORIGENES_DE_TAREA]).toEqual(
      leerLista(esquemas, "ORIGENES_DE_TAREA")
    );
    expect([...ESTADOS_DE_TAREA]).toEqual(
      leerLista(esquemas, "ESTADOS_DE_TAREA")
    );
    expect([...RESULTADOS_DE_TAREA]).toEqual(
      leerLista(esquemas, "RESULTADOS_DE_TAREA")
    );
  });

  it("los topes del título, la URL, los pasos, las notas y la nota de resultado son los del esquema", () => {
    expect(LARGO_MAXIMO_DE_TITULO_DE_TAREA).toBe(
      maxDe(esquemas, "const tituloDeTarea")
    );
    expect(MAXIMO_DE_PASOS_DE_TAREA).toBe(
      leerNumero(esquemas, "MAXIMO_DE_PASOS_DE_UNA_TAREA")
    );
    expect(LARGO_MAXIMO_DE_PASO_DE_TAREA).toBe(
      leerNumero(esquemas, "MAXIMO_DE_CARACTERES_DE_UN_PASO")
    );
    expect(LARGO_MAXIMO_DE_NOTAS_DE_TAREA).toBe(
      leerNumero(esquemas, "MAXIMO_DE_CARACTERES_DE_LAS_NOTAS_DE_UNA_TAREA")
    );
    expect(LARGO_MAXIMO_DE_NOTA_DE_RESULTADO_DE_TAREA).toBe(
      leerNumero(esquemas, "MAXIMO_DE_CARACTERES_DE_LA_NOTA_DE_RESULTADO")
    );
    expect(LARGO_MAXIMO_DE_URL_DE_TAREA).toBe(
      maxDe(esquemas, "export const urlHttp")
    );
  });

  it("los tipos de dato del comparador son los que filtra el backend", () => {
    const m = comparadorDelBackend.match(
      /TIPOS_DE_DATO_COMPARABLES[^=]*=\s*new Set\(\[([^\]]*)\]/
    );
    expect(m, "no se encontró TIPOS_DE_DATO_COMPARABLES").not.toBeNull();
    expect([...m![1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]).sort()).toEqual(
      [...TIPOS_DE_DATO_DEL_COMPARADOR].sort()
    );
  });
});

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------

describe("las respuestas de la demostración tienen los mismos campos que las del backend", () => {
  const cliente = clienteDemo({
    retardoMs: 0,
    ahora: () => new Date("2026-10-30T09:00:00.000Z"),
  });

  it("la tarea (los 14 campos del contrato, sin la identidad de siembra)", async () => {
    const [primera] = (await cliente.tareas()).data;
    expect(Object.keys(primera).sort()).toEqual(
      camposDelTipo(servicioDeTareas, "Tarea").sort()
    );
    expect(Object.keys(primera)).not.toContain("siembra");
  });

  it("la fila del comparador, su análisis y la respuesta", async () => {
    const { data, ...resto } = await cliente.comparadorDeCompetencia();
    expect(Object.keys(resto).concat("data").sort()).toEqual(
      camposDelTipo(comparadorDelBackend, "RespuestaDelComparador").sort()
    );
    const conAnalisis = data.find((f) => f.analisis)!;
    expect(Object.keys(conAnalisis).sort()).toEqual(
      camposDelTipo(comparadorDelBackend, "FilaDelComparador").sort()
    );
    // El resumen del análisis del backend es un literal dentro del tipo.
    const inicio = comparadorDelBackend.indexOf("analisis: null | {");
    const fin = comparadorDelBackend.indexOf("};", inicio);
    expect(Object.keys(conAnalisis.analisis!).sort()).toEqual(
      [...comparadorDelBackend.slice(inicio, fin).matchAll(/^ {4}(\w+):/gm)]
        .map((m) => m[1])
        .sort()
    );
  });

  it("la ficha y cada uno de sus campos", async () => {
    const ficha = await cliente.fichaDeAlhabla();
    expect(Object.keys(ficha).sort()).toEqual(
      camposDelTipo(fichaDelBackend, "RespuestaDeFicha").sort()
    );
    const campos = camposDelTipo(fichaDelBackend, "CampoDeFicha").sort();
    for (const campo of ficha.campos) {
      // `limite` solo lo llevan las dos descripciones: es opcional.
      expect(
        Object.keys(campo)
          .concat(campo.limite === undefined ? ["limite"] : [])
          .sort()
      ).toEqual(campos);
    }
  });
});

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

describe("las rutas que llama el panel existen en el backend", () => {
  let llamadas: Array<{ metodo: string; ruta: string }> = [];

  beforeAll(async () => {
    reiniciarSesionParaPruebas();
    window.sessionStorage.clear();
    guardarCredencial(crearJwt());
    api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      llamadas.push({
        metodo: String(config.method).toUpperCase(),
        ruta: String(config.url),
      });
      return {
        status: 200,
        statusText: "",
        headers: {},
        config,
        data: {},
      } as AxiosResponse;
    });
    llamadas = [];
    await clienteHttp.comparadorDeCompetencia();
    await clienteHttp.fichaDeAlhabla();
    await clienteHttp.tareas();
    await clienteHttp.anadirTarea({ titulo: "x", url: "https://x.example" });
    await clienteHttp.editarTarea("ID1", { titulo: "y" });
    await clienteHttp.marcarTareaHecha("ID1", {});
    await clienteHttp.descartarTarea("ID1", {});
    await clienteHttp.reabrirTarea("ID1");
    await clienteHttp.borrarTarea("ID1");
  });

  const declaradas = (texto: string, prefijo: RegExp) =>
    [
      ...texto.matchAll(
        /fastify\s*\.(get|post|patch|delete)\(\s*"(\/growth\/admin\/[^"]*)"/g
      ),
    ]
      .map((m) => `${m[1].toUpperCase()} ${m[2]}`)
      .filter((r) => prefijo.test(r));

  it("cada ruta de las tareas y de la ficha (método y ruta) está declarada en routesTareas.ts", () => {
    const delBackend = declaradas(rutasDeTareas, /./).sort();
    expect(delBackend.length).toBeGreaterThanOrEqual(8);
    const delPanel = llamadas
      .map(({ metodo, ruta }) => `${metodo} ${ruta.replace("ID1", ":id")}`)
      .filter((r) => /\/(tareas|ficha-de-alhabla)/.test(r))
      .sort();
    expect(delPanel).toEqual(delBackend);
  });

  it("el comparador está declarado en routesCompetencia.ts, con GET", () => {
    expect(declaradas(rutasDeCompetencia, /comparador/)).toEqual([
      "GET /growth/admin/competidores/comparador",
    ]);
    expect(llamadas).toContainEqual({
      metodo: "GET",
      ruta: "/growth/admin/competidores/comparador",
    });
  });

  it("las rutas con cuerpo vacío mandan `{}` y el borrado, 204 sin cuerpo", () => {
    expect(rutasDeTareas).toMatch(/reply\.status\(204\)/);
    expect(rutasDeTareas).toMatch(/reply\.status\(201\)/);
  });
});

// ---------------------------------------------------------------------------
// Errores y transiciones
// ---------------------------------------------------------------------------

describe("los errores y las transiciones de las tareas", () => {
  it("el código del 409 es el del servicio y el 404 dice lo mismo", () => {
    const codigos = [
      ...servicioDeTareas.matchAll(
        /new ErrorDeGrowth\(\s*(\d{3}),[^;]*?"([a-z_]+)"\s*\)/g
      ),
    ].map((m) => `${m[1]} ${m[2]}`);
    expect(codigos).toEqual(
      CODIGOS_DE_ERROR_DE_TAREAS.map((codigo) => `409 ${codigo}`)
    );
    expect(servicioDeTareas).toMatch(
      /new ErrorDeGrowth\(404, "La tarea no existe\."\)/
    );
    expect(servicioDeTareas).toContain(
      "Esta tarea viene del repositorio y no se puede borrar: descártala."
    );
  });

  it("solo se borra lo que no es del repositorio", () => {
    expect(servicioDeTareas).toMatch(/origen: \{ not: "repo" \}/);
  });

  it("hecha y descartar son idempotentes (no tocan lo ya hecho) y reabrir conserva la nota", () => {
    const funcion = (nombre: string) => {
      const inicio = servicioDeTareas.indexOf(
        `export async function ${nombre}`
      );
      expect(inicio, nombre).toBeGreaterThan(-1);
      const fin = servicioDeTareas.indexOf("\n}\n", inicio);
      return servicioDeTareas.slice(inicio, fin);
    };
    expect(funcion("marcarTareaHecha")).toMatch(/estado: \{ not: "hecha" \}/);
    expect(funcion("descartarTarea")).toMatch(
      /estado: \{ not: "descartada" \}/
    );
    const reabrir = funcion("reabrirTarea");
    expect(reabrir).toMatch(
      /estado: "pendiente", hechaEn: null, resultado: null/
    );
    expect(reabrir).not.toMatch(/notaDeResultado/);
    expect(funcion("descartarTarea")).toMatch(
      /estado: "descartada",\s*hechaEn: null,\s*resultado: null/
    );
  });

  it("el listado va por estado (pendiente, hecha, descartada) y luego `orden` y título", () => {
    expect(servicioDeTareas).toMatch(
      /pendiente: 0,\s*hecha: 1,\s*descartada: 2/
    );
    expect(servicioDeTareas).toMatch(
      /a\.orden - b\.orden \|\|\s*COLACION\.compare\(a\.titulo, b\.titulo\)/
    );
  });

  it("una tarea nueva es manual, pendiente y de categoría «otro» si no dices otra", () => {
    expect(servicioDeTareas).toMatch(
      /categoria: entrada\.categoria \?\? "otro"/
    );
    expect(servicioDeTareas).toMatch(/origen: "manual"/);
  });
});

// ---------------------------------------------------------------------------
// Las tareas iniciales
// ---------------------------------------------------------------------------

describe("las tareas iniciales del demo son las del backend", () => {
  /** Los bloques `{ siembra: "x", … }` de `tareasIniciales.ts`. */
  function bloquesDelBackend() {
    const inicio = inicialesDelBackend.indexOf("const TAREAS:");
    const cuerpo = inicialesDelBackend.slice(
      inicio,
      inicialesDelBackend.indexOf("export const TAREAS_INICIALES")
    );
    const trozos = cuerpo.split(/\n {2}\{\n/).slice(1);
    return trozos.map((contenido) => {
      // El salto de línea que se quedó en el separador.
      const trozo = `\n${contenido}`;
      const cadena = (campo: string) =>
        trozo.match(
          new RegExp(`\\n {4}${campo}:\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`)
        )?.[1];
      return {
        siembra: cadena("siembra"),
        titulo: cadena("titulo"),
        dominio: cadena("dominio"),
        url: cadena("url"),
        categoria: cadena("categoria"),
        notas: cadena("notas"),
        hecha: /\n {4}hecha: \{/.test(trozo),
        resultado: trozo.match(/resultado: "([a-z_]+)"/)?.[1],
        hechaEn: trozo.match(/new Date\("([^"]+)"\)/)?.[1],
        nota: trozo.match(/\n {6}nota: "((?:[^"\\]|\\.)*)"/)?.[1],
      };
    });
  }

  it("las mismas tareas, en el mismo orden, con la misma identidad, título, dirección, categoría y notas", () => {
    const delBackend = bloquesDelBackend();
    expect(delBackend.length).toBeGreaterThanOrEqual(11);
    expect(
      TAREAS_INICIALES.map((t) => ({
        siembra: t.siembra,
        titulo: t.titulo,
        dominio: t.dominio,
        url: t.url,
        categoria: t.categoria,
        notas: t.notas,
      }))
    ).toEqual(
      delBackend.map((b) => ({
        siembra: b.siembra,
        titulo: b.titulo,
        dominio: b.dominio,
        url: b.url,
        categoria: b.categoria,
        notas: b.notas,
      }))
    );
  });

  it("solo está hecha la que ya lo estaba, con el mismo resultado, día y nota", () => {
    const hechas = bloquesDelBackend().filter((b) => b.hecha);
    expect(hechas).toHaveLength(1);
    const [hecha] = hechas;
    const delDemo = TAREAS_INICIALES.filter((t) => t.hecha);
    expect(delDemo).toHaveLength(1);
    expect(delDemo[0].siembra).toBe(hecha.siembra);
    expect(delDemo[0].hecha).toEqual({
      resultado: hecha.resultado,
      hechaEn: hecha.hechaEn,
      nota: hecha.nota,
    });
  });

  it("los pasos genéricos y la separación del orden son los del backend", () => {
    expect([...PASOS_GENERICOS_DE_UNA_TAREA]).toEqual(
      leerLista(inicialesDelBackend, "PASOS_GENERICOS_DE_UNA_TAREA")
    );
    expect(SEPARACION_DE_ORDEN).toBe(
      leerNumero(inicialesDelBackend, "SEPARACION_DE_ORDEN")
    );
  });
});

// ---------------------------------------------------------------------------
// La ficha
// ---------------------------------------------------------------------------

describe("la composición de la ficha del demo sigue a la del backend", () => {
  it("el nombre, la web, las categorías y el arranque de la descripción larga son los mismos", () => {
    expect(NOMBRE_DEL_PRODUCTO).toBe(
      leerTexto(fichaDelBackend, "NOMBRE_DEL_PRODUCTO")
    );
    expect(WEB_DEL_PRODUCTO).toBe(
      leerTexto(fichaDelBackend, "WEB_DEL_PRODUCTO")
    );
    expect(CATEGORIAS_DE_LA_FICHA).toBe(
      leerTexto(fichaDelBackend, "CATEGORIAS_DE_LA_FICHA")
    );
    expect(ARRANQUE_DE_LA_DESCRIPCION_LARGA).toBe(
      leerTexto(fichaDelBackend, "ARRANQUE_DE_LA_DESCRIPCION_LARGA")
    );
  });

  it("los límites orientativos de las dos descripciones son los mismos", () => {
    expect(LIMITE_DE_DESCRIPCION_CORTA).toBe(
      leerNumero(fichaDelBackend, "LIMITE_DE_LA_DESCRIPCION_CORTA")
    );
    expect(LIMITE_DE_DESCRIPCION_LARGA).toBe(
      leerNumero(fichaDelBackend, "LIMITE_DE_LA_DESCRIPCION_LARGA")
    );
  });

  it("las claves de la descripción larga y de los precios, las mismas y en el mismo orden", () => {
    expect([...CLAVES_DE_LA_DESCRIPCION_LARGA]).toEqual(
      leerLista(fichaDelBackend, "CLAVES_DE_LA_DESCRIPCION_LARGA")
    );
    expect([...CLAVES_DE_PRECIOS]).toEqual(
      leerLista(fichaDelBackend, "CLAVES_DE_PRECIOS")
    );
  });

  it("las claves de la descripción corta, la prueba y los idiomas son las mismas", async () => {
    const cliente = clienteDemo({ retardoMs: 0 });
    const ficha = await cliente.fichaDeAlhabla();
    const clave = (campo: string) =>
      ficha.campos.find((c) => c.clave === campo)!.afirmaciones[0];
    expect(fichaDelBackend).toContain(
      `CLAVE_DE_LA_DESCRIPCION_CORTA = "${clave("descripcion_corta")}"`
    );
    expect(fichaDelBackend).toContain(
      `CLAVE_DE_LA_PRUEBA = "${clave("prueba")}"`
    );
    expect(fichaDelBackend).toContain(
      `CLAVE_DE_LOS_IDIOMAS = "${clave("idiomas")}"`
    );
  });

  it("los ocho campos, con la misma clave y etiqueta y en el mismo orden", async () => {
    const ficha = await clienteDemo({ retardoMs: 0 }).fichaDeAlhabla();
    // El orden del array `campos` del backend (algunos campos se montan antes
    // en una constante con otro nombre).
    const inicio = fichaDelBackend.indexOf("const campos: CampoDeFicha[] = [");
    expect(inicio).toBeGreaterThan(-1);
    const bloque = fichaDelBackend.slice(
      inicio,
      fichaDelBackend.indexOf("\n  ];", inicio)
    );
    const alias: Record<string, string> = {
      descripcionCorta: "descripcion_corta",
      descripcionLarga: "descripcion_larga",
      idiomas: "idiomas",
    };
    const ordenDelBackend = [
      ...bloque.matchAll(
        /clave: "(\w+)"|completo\(\s*"(\w+)"|^\s{4}(descripcionCorta|descripcionLarga|idiomas),/gm
      ),
    ].map((m) => m[1] ?? m[2] ?? alias[m[3]]);
    expect(ficha.campos.map((c) => c.clave)).toEqual(ordenDelBackend);
    // Y cada etiqueta está escrita igual en el backend.
    for (const campo of ficha.campos) {
      expect(
        fichaDelBackend,
        `«${campo.etiqueta}» no está en fichaDeAlhabla.ts`
      ).toContain(`"${campo.etiqueta}"`);
    }
  });

  it("los textos de los avisos son los del backend", () => {
    for (const fragmento of [
      "contiene términos que no se pueden decir: ",
      "No hay términos prohibidos vigentes en la base de conocimiento: no se ha podido comprobar el texto.",
      "La base de conocimiento aún no se ha sincronizado: la ficha puede estar incompleta.",
      "no se sincroniza desde hace ",
      "días: comprueba los precios y las funciones antes de pegarlos.",
    ]) {
      expect(fichaDelBackend, fragmento).toContain(fragmento);
    }
  });

  it("la descripción corta quita el prefijo «Alhabla: » y los precios van uno por línea", () => {
    expect(fichaDelBackend).toContain("`${NOMBRE_DEL_PRODUCTO}: `");
    expect(fichaDelBackend).toMatch(/textos\.join\("\\n"\)/);
  });

  it("la descripción larga une con «. » y cierra con un punto, tras quitar el punto final de cada texto", () => {
    expect(fichaDelBackend).toMatch(/\.map\(sinPuntoFinal\)\s*\.join\("\. "\)/);
    expect(fichaDelBackend).toContain('replace(/[.\\s]+$/, "")');
  });
});
