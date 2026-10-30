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
