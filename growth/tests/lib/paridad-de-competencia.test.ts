import { readFileSync } from "node:fs";
import path from "node:path";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { clienteHttp } from "@/lib/cliente-http";
import { CODIGOS_DE_ERROR_DE_COMPETENCIA } from "@/lib/demo/competencia-demo";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import { guardarCredencial, reiniciarSesionParaPruebas } from "@/lib/sesion";
import {
  DIAS_PARA_CADUCAR_UN_ANALISIS,
  ESTADOS_DE_COMPETIDOR,
  LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR,
  LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR,
  LARGO_MAXIMO_DE_URL_DE_COMPETIDOR,
  MONEDAS_DE_PRECIO,
  ORIGENES_DE_COMPETIDOR,
  PERIODOS_DE_PRECIO,
  TIPOS_DE_DATO_DE_COMPETIDOR,
} from "@/lib/types";
import { crearJwt } from "../helpers/jwt";

/**
 * La competencia del panel (tipos, constantes, rutas, códigos de error y
 * transiciones de la demostración) se copia a mano del backend. Este test lee
 * los ficheros del backend y falla si se separan. Si falla, mira el mensaje y
 * copia el cambio al lado del panel (`types.ts`, `cliente-http.ts`,
 * `demo/competencia-demo.ts`).
 */

const BACKEND = path.resolve(
  import.meta.dirname,
  "../../../backend/src/modules/growth"
);
const leer = (fichero: string) =>
  readFileSync(path.join(BACKEND, fichero), "utf8");

const esquemas = leer("esquemas.ts");
const servicio = leer("servicioCompetenciaAdmin.ts");
const rutas = leer("routesCompetencia.ts");
const servicioGeneral = leer("service.ts");

/** `export const NOMBRE = [ "a", "b" ] as const;` → ["a", "b"] */
function leerLista(nombre: string): string[] {
  const inicio = esquemas.indexOf(`export const ${nombre}`);
  expect(inicio, `no se encontró ${nombre} en esquemas.ts`).toBeGreaterThan(-1);
  const abre = esquemas.indexOf("[", esquemas.indexOf("=", inicio));
  const cierra = esquemas.indexOf("]", abre);
  return [...esquemas.slice(abre, cierra).matchAll(/"([A-Za-z_]+)"/g)].map(
    (m) => m[1]
  );
}

function leerNumero(nombre: string): number {
  const m = esquemas.match(
    new RegExp(`export const ${nombre}\\s*=\\s*([0-9_]+)`)
  );
  expect(m, `no se encontró ${nombre} en esquemas.ts`).not.toBeNull();
  return Number(m![1].replace(/_/g, ""));
}

/** El texto de `export const NOMBRE = …;` (hasta el siguiente `export`). */
function bloqueDe(texto: string, empieza: string): string {
  const inicio = texto.indexOf(empieza);
  expect(inicio, `no se encontró «${empieza}»`).toBeGreaterThan(-1);
  const fin = texto.indexOf("\nexport ", inicio + empieza.length);
  return texto.slice(inicio, fin === -1 ? undefined : fin);
}

/** Los campos de `export type NOMBRE = { campo: …; }` (primer nivel). */
function camposDelTipo(nombre: string): string[] {
  const bloque = bloqueDe(servicio, `export type ${nombre} =`);
  return [...bloque.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
}

describe("las constantes de la competencia siguen a las del backend", () => {
  it("estados, orígenes, tipos de dato, monedas y periodos son los mismos, en el mismo orden", () => {
    expect([...ESTADOS_DE_COMPETIDOR]).toEqual(
      leerLista("ESTADOS_DE_COMPETIDOR")
    );
    expect([...ORIGENES_DE_COMPETIDOR]).toEqual(
      leerLista("ORIGENES_DE_COMPETIDOR")
    );
    expect([...TIPOS_DE_DATO_DE_COMPETIDOR]).toEqual(
      leerLista("TIPOS_DE_DATO_DE_COMPETIDOR")
    );
    expect([...MONEDAS_DE_PRECIO]).toEqual(leerLista("MONEDAS_DE_PRECIO"));
    expect([...PERIODOS_DE_PRECIO]).toEqual(leerLista("PERIODOS_DE_PRECIO"));
  });

  it("un análisis caduca a los mismos días", () => {
    expect(DIAS_PARA_CADUCAR_UN_ANALISIS).toBe(
      leerNumero("DIAS_PARA_CADUCAR_UN_ANALISIS")
    );
  });

  it("los topes del nombre, las notas y la URL son los del esquema", () => {
    const alta = bloqueDe(esquemas, "export const AltaDeCompetidorBody");
    expect(alta).toMatch(
      new RegExp(
        `nombre:[^\\n]*max\\(${LARGO_MAXIMO_DE_NOMBRE_DE_COMPETIDOR}\\)`
      )
    );
    expect(alta).toMatch(
      new RegExp(`notas:[^\\n]*max\\(${LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR}\\)`)
    );
    const url = bloqueDe(esquemas, "export const urlHttp");
    expect(url).toMatch(
      new RegExp(`max\\(${LARGO_MAXIMO_DE_URL_DE_COMPETIDOR}\\)`)
    );
    const revision = bloqueDe(esquemas, "export const RevisionDeAnalisisBody");
    expect(revision).toMatch(
      new RegExp(`nota:[^\\n]*max\\(${LARGO_MAXIMO_DE_NOTAS_DE_COMPETIDOR}\\)`)
    );
  });
});

describe("las respuestas de la demostración tienen los mismos campos que las del backend", () => {
  const cliente = clienteDemo({ retardoMs: 0 });

  it("el resumen y el resumen del último análisis", async () => {
    const [primero] = (await cliente.competidores()).data;
    const conAnalisis = (await cliente.competidores()).data.find(
      (c) => c.analisis
    )!;
    expect(Object.keys(primero).sort()).toEqual(
      camposDelTipo("CompetidorResumen").sort()
    );
    expect(Object.keys(conAnalisis.analisis!).sort()).toEqual(
      camposDelTipo("ResumenDeAnalisis").sort()
    );
  });

  it("el detalle, una versión y el análisis completo", async () => {
    const detalle = await cliente.detalleDeCompetidor("demo-co-3");
    expect(Object.keys(detalle).sort()).toEqual(
      [
        ...camposDelTipo("CompetidorResumen"),
        "ultimoAnalisis",
        "versiones",
      ].sort()
    );
    expect(Object.keys(detalle.ultimoAnalisis!).sort()).toEqual(
      camposDelTipo("AnalisisDeCompetidor").sort()
    );
    // Las versiones del detalle: id, version, creadoEn, revisadoEn y numDatos.
    expect(Object.keys(detalle.versiones[0]).sort()).toEqual(
      ["creadoEn", "id", "numDatos", "revisadoEn", "version"].sort()
    );
    expect(
      Object.keys(
        await cliente.analisisDeCompetidor("demo-co-3", "demo-an-3-1")
      ).sort()
    ).toEqual(camposDelTipo("AnalisisDeCompetidor").sort());
  });
});

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
    await clienteHttp.competidores();
    await clienteHttp.detalleDeCompetidor("ID1");
    await clienteHttp.analisisDeCompetidor("ID1", "AN1");
    await clienteHttp.anadirCompetidor({ url: "https://rival.example" });
    await clienteHttp.editarCompetidor("ID1", { nombre: "X" });
    await clienteHttp.quitarCompetidor("ID1");
    await clienteHttp.aceptarCompetidor("ID1");
    await clienteHttp.reanalizarCompetidor("ID1");
    await clienteHttp.revisarAnalisis("ID1", "AN1", {});
  });

  it("cada ruta del panel (método y ruta) está declarada en routesCompetencia.ts", () => {
    const declaradas = new Set(
      [
        ...rutas.matchAll(
          /fastify\s*\.(get|post|patch|delete)\(\s*"(\/growth\/admin\/competidores[^"]*)"/g
        ),
      ].map((m) => `${m[1].toUpperCase()} ${m[2]}`)
    );
    expect(declaradas.size).toBeGreaterThanOrEqual(9);
    const delPanel = new Set(
      llamadas.map(
        ({ metodo, ruta }) =>
          `${metodo} ${ruta.replace("ID1", ":id").replace("AN1", ":analisisId")}`
      )
    );
    expect([...delPanel].sort()).toEqual([...declaradas].sort());
  });
});

describe("los errores de la competencia", () => {
  it("la demostración usa los mismos códigos que el servicio del backend", () => {
    // Los códigos del servicio: el tercer argumento de cada ErrorDeGrowth.
    const delServicio = new Set(
      [
        ...servicio.matchAll(
          /new ErrorDeGrowth\(\s*\d{3},[^;]*?,\s*"([a-z_]+)"/g
        ),
      ].map((m) => m[1])
    );
    // `dominio_propio` lo lanza `validarUrlExterna`, en el servicio general.
    expect(servicioGeneral).toMatch(/"dominio_propio"/);
    delServicio.add("dominio_propio");
    expect([...CODIGOS_DE_ERROR_DE_COMPETENCIA].sort()).toEqual(
      [...delServicio].sort()
    );
  });

  it("los números de estado de cada código son los del backend (409 salvo dominio_propio y url_de_otro_dominio, que son 400)", () => {
    const estadoDe = (codigo: string) => {
      const m = [
        ...servicio.matchAll(
          new RegExp(`new ErrorDeGrowth\\(\\s*(\\d{3}),[^;]*?"${codigo}"`, "g")
        ),
      ];
      return m.length > 0 ? Number(m[m.length - 1][1]) : null;
    };
    expect(estadoDe("competidor_existente")).toBe(409);
    expect(estadoDe("competidor_del_repositorio")).toBe(409);
    expect(estadoDe("estado_incorrecto")).toBe(409);
    expect(estadoDe("analisis_antiguo")).toBe(409);
    expect(estadoDe("ya_revisado")).toBe(409);
    expect(estadoDe("url_de_otro_dominio")).toBe(400);
  });

  it("el 409 competidor_existente lleva el id del existente, como en el backend", () => {
    expect(servicio).toMatch(/"competidor_existente",\s*id \? \{ id \}/);
  });
});

describe("las transiciones de la demostración son las del backend", () => {
  /** El cuerpo de `export async function nombre(…) {…}` hasta la siguiente. */
  const funcion = (nombre: string) =>
    bloqueDe(servicio, `export async function ${nombre}`);

  it("aceptar: solo un propuesto, y pasa a «por analizar» pidiendo el análisis", () => {
    const cuerpo = funcion("aceptarCompetidor");
    expect(cuerpo).toMatch(/estado !== "propuesto"/);
    expect(cuerpo).toMatch(
      /estado: "por_analizar",\s*analisisSolicitadoEn: new Date\(\)/
    );
  });

  it("volver a analizar: un propuesto no, «por analizar» es idempotente y el resto pasa a «por analizar»", () => {
    const cuerpo = funcion("reanalizarCompetidor");
    expect(cuerpo).toMatch(/estado === "propuesto"/);
    expect(cuerpo).toMatch(/estado === "por_analizar"\) return/);
    expect(cuerpo).toMatch(
      /estado: "por_analizar",\s*analisisSolicitadoEn: new Date\(\)/
    );
  });

  it("revisar: solo el último análisis, sin revisar y de un competidor «analizado»; deja «revisado»", () => {
    const cuerpo = funcion("revisarAnalisis");
    expect(cuerpo).toMatch(/ultimo\?\.id !== analisis\.id/);
    expect(cuerpo).toMatch(/analisis\.revisadoEn/);
    expect(cuerpo).toMatch(/estado !== "analizado"/);
    expect(cuerpo).toMatch(/estado: "revisado"/);
    // El orden de las comprobaciones: antiguo, ya revisado, estado.
    expect(cuerpo.indexOf("analisis_antiguo")).toBeLessThan(
      cuerpo.indexOf("ya_revisado")
    );
    expect(cuerpo.indexOf("ya_revisado")).toBeLessThan(
      cuerpo.indexOf("estado_incorrecto") > -1
        ? cuerpo.indexOf("estado_incorrecto")
        : cuerpo.indexOf("estadoIncorrecto(")
    );
  });

  it("quitar: los del repositorio no se quitan", () => {
    expect(funcion("quitarCompetidor")).toMatch(/origen === "repo"/);
  });

  it("el alta nace «por analizar», manual y con el análisis pedido", () => {
    const cuerpo = funcion("darDeAltaUnCompetidor");
    expect(cuerpo).toMatch(/origen: "manual"/);
    expect(cuerpo).toMatch(/estado: "por_analizar"/);
    expect(cuerpo).toMatch(/analisisSolicitadoEn: new Date\(\)/);
  });
});
