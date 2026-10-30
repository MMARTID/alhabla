import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { aParametros, clienteHttp } from "@/lib/cliente-http";
import { guardarCredencial, reiniciarSesionParaPruebas } from "@/lib/sesion";
import { clienteFalso } from "../helpers/cliente-falso";
import { crearJwt } from "../helpers/jwt";

let ultima: InternalAxiosRequestConfig | null = null;

beforeEach(() => {
  reiniciarSesionParaPruebas();
  window.sessionStorage.clear();
  guardarCredencial(crearJwt());
  ultima = null;
  api.defaults.adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    ultima = config;
    return {
      status: 200,
      statusText: "",
      headers: {},
      config,
      data: { ok: true },
    } as AxiosResponse;
  });
});

describe("aParametros", () => {
  it("omite los vacíos, une las listas con comas y escribe los booleanos", () => {
    expect(
      aParametros({
        estado: ["calificada", "bloqueada"],
        objetivo: undefined,
        q: "",
        vacia: [],
        soloSistema: false,
        pagina: 2,
        nulo: null,
      })
    ).toEqual({
      estado: "calificada,bloqueada",
      soloSistema: "false",
      pagina: "2",
    });
    expect(aParametros(undefined)).toEqual({});
  });
});

describe("clienteHttp", () => {
  it("tiene un método por cada uno de la interfaz", () => {
    expect(Object.keys(clienteHttp).sort()).toEqual(
      Object.keys(clienteFalso()).sort()
    );
  });

  it("lista las oportunidades con los filtros como parámetros de consulta", async () => {
    await clienteHttp.listarOportunidades({
      estado: ["calificada", "bloqueada"],
      orden: "puntuacion",
      q: "",
      pagina: 2,
    });
    expect(ultima?.method).toBe("get");
    expect(ultima?.url).toBe("/growth/admin/oportunidades");
    expect(ultima?.params).toEqual({
      estado: "calificada,bloqueada",
      orden: "puntuacion",
      pagina: "2",
    });
  });

  it("codifica los identificadores en la ruta", async () => {
    await clienteHttp.detalleDeOportunidad("a/b c");
    expect(ultima?.url).toBe("/growth/admin/oportunidades/a%2Fb%20c");
    await clienteHttp.historialDeAfirmacion("precio.plan.pro");
    expect(ultima?.url).toBe(
      "/growth/admin/conocimiento/precio.plan.pro/historial"
    );
    await clienteHttp.detalleDeBorrador("bo 1");
    expect(ultima?.url).toBe("/growth/admin/borradores/bo%201");
    await clienteHttp.detalleDeEjecucion("ej/1");
    expect(ultima?.url).toBe("/growth/admin/ejecuciones/ej%2F1");
  });

  it("decide con un POST a la decisión de esa oportunidad", async () => {
    await clienteHttp.decidir("op-1", {
      accion: "devolver",
      motivo: "Quita el precio",
    });
    expect(ultima?.method).toBe("post");
    expect(ultima?.url).toBe("/growth/admin/oportunidades/op-1/decision");
    expect(JSON.parse(ultima?.data)).toEqual({
      accion: "devolver",
      motivo: "Quita el precio",
    });
  });

  it("edita un borrador con PATCH y guarda ajustes con PUT", async () => {
    await clienteHttp.editarBorrador("bo-1", { texto: "Nuevo texto" });
    expect(ultima?.method).toBe("patch");
    expect(ultima?.url).toBe("/growth/admin/borradores/bo-1");
    await clienteHttp.guardarAjustes({ pausa: true });
    expect(ultima?.method).toBe("put");
    expect(ultima?.url).toBe("/growth/admin/ajustes");
    expect(JSON.parse(ultima?.data)).toEqual({ pausa: true });
  });

  it("añade una URL con un POST a las oportunidades", async () => {
    await clienteHttp.anadirUrl({ url: "https://ejemplo.example/a" });
    expect(ultima?.method).toBe("post");
    expect(ultima?.url).toBe("/growth/admin/oportunidades");
  });

  it("pide el conocimiento filtrado por tipo", async () => {
    await clienteHttp.conocimiento("prohibida");
    expect(ultima?.params).toEqual({ tipo: "prohibida" });
    await clienteHttp.conocimiento();
    expect(ultima?.params).toEqual({});
  });

  it("devuelve el cuerpo de la respuesta", async () => {
    await expect(clienteHttp.yo()).resolves.toEqual({ ok: true });
    expect(ultima?.url).toBe("/growth/admin/yo");
  });
});

describe("clienteHttp · competencia", () => {
  it("lista los competidores y pide uno por su id codificado", async () => {
    await clienteHttp.competidores();
    expect(ultima?.method).toBe("get");
    expect(ultima?.url).toBe("/growth/admin/competidores");
    await clienteHttp.detalleDeCompetidor("a/b c");
    expect(ultima?.method).toBe("get");
    expect(ultima?.url).toBe("/growth/admin/competidores/a%2Fb%20c");
  });

  it("pide una versión del análisis con los dos ids codificados", async () => {
    await clienteHttp.analisisDeCompetidor("co 1", "an/2");
    expect(ultima?.method).toBe("get");
    expect(ultima?.url).toBe(
      "/growth/admin/competidores/co%201/analisis/an%2F2"
    );
  });

  it("añade un competidor con un POST y el cuerpo tal cual", async () => {
    await clienteHttp.anadirCompetidor({
      url: "https://rival.example",
      nombre: "Rival",
    });
    expect(ultima?.method).toBe("post");
    expect(ultima?.url).toBe("/growth/admin/competidores");
    expect(JSON.parse(ultima?.data)).toEqual({
      url: "https://rival.example",
      nombre: "Rival",
    });
  });

  it("edita con PATCH (y manda null para borrar la URL o las notas)", async () => {
    await clienteHttp.editarCompetidor("co-1", { notas: null, url: null });
    expect(ultima?.method).toBe("patch");
    expect(ultima?.url).toBe("/growth/admin/competidores/co-1");
    expect(JSON.parse(ultima?.data)).toEqual({ notas: null, url: null });
  });

  it("quita con DELETE, sin cuerpo, y no devuelve nada (204)", async () => {
    await expect(clienteHttp.quitarCompetidor("co-1")).resolves.toBeUndefined();
    expect(ultima?.method).toBe("delete");
    expect(ultima?.url).toBe("/growth/admin/competidores/co-1");
    expect(ultima?.data).toBeUndefined();
  });

  it("aceptar y volver a analizar son POST con cuerpo vacío (Fastify no admite un POST JSON sin cuerpo)", async () => {
    await clienteHttp.aceptarCompetidor("co-1");
    expect(ultima?.method).toBe("post");
    expect(ultima?.url).toBe("/growth/admin/competidores/co-1/aceptar");
    expect(JSON.parse(ultima?.data)).toEqual({});
    await clienteHttp.reanalizarCompetidor("co-1");
    expect(ultima?.method).toBe("post");
    expect(ultima?.url).toBe("/growth/admin/competidores/co-1/reanalizar");
    expect(JSON.parse(ultima?.data)).toEqual({});
  });

  it("revisa un análisis con un POST a su ruta, con la nota o con el cuerpo vacío", async () => {
    await clienteHttp.revisarAnalisis("co-1", "an-2", { nota: "Bien" });
    expect(ultima?.method).toBe("post");
    expect(ultima?.url).toBe(
      "/growth/admin/competidores/co-1/analisis/an-2/revisar"
    );
    expect(JSON.parse(ultima?.data)).toEqual({ nota: "Bien" });
    await clienteHttp.revisarAnalisis("co-1", "an-2", {});
    expect(JSON.parse(ultima?.data)).toEqual({});
  });

  it("filtra las oportunidades por el competidor que mencionan", async () => {
    await clienteHttp.listarOportunidades({
      menciona: "rival.example",
      pagina: 1,
    });
    expect(ultima?.url).toBe("/growth/admin/oportunidades");
    expect(ultima?.params).toEqual({
      menciona: "rival.example",
      pagina: "1",
    });
  });
});
