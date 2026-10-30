import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
  MENSAJE_SIN_CONFIGURAR,
  SesionCaducada,
  mensajeDeError,
} from "@/lib/api-errors";
import {
  guardarCredencial,
  obtenerEstadoDeSesion,
  reiniciarSesionParaPruebas,
  tokenGuardado,
} from "@/lib/sesion";
import { crearJwt } from "../helpers/jwt";

type Respuesta = { status: number; data?: unknown };

/** Sustituye la red: cada petición recibe la respuesta que toque. */
function simularRed(respuestas: Respuesta[]) {
  const peticiones: InternalAxiosRequestConfig[] = [];
  const adaptador = vi.fn(async (config: InternalAxiosRequestConfig) => {
    peticiones.push(config);
    const siguiente = respuestas.shift() ?? { status: 200, data: {} };
    const respuesta: AxiosResponse = {
      status: siguiente.status,
      statusText: "",
      headers: {},
      config,
      data: siguiente.data,
    };
    if (siguiente.status >= 400) {
      throw new AxiosError(
        "fallo",
        AxiosError.ERR_BAD_RESPONSE,
        config,
        null,
        respuesta
      );
    }
    return respuesta;
  });
  api.defaults.adapter = adaptador;
  return { adaptador, peticiones };
}

beforeEach(() => {
  reiniciarSesionParaPruebas();
  window.sessionStorage.clear();
});

describe("el cliente HTTP", () => {
  it("manda el ID token vigente como Bearer, y solo en la cabecera", async () => {
    const jwt = crearJwt();
    guardarCredencial(jwt);
    const { peticiones } = simularRed([
      { status: 200, data: { email: "admin@alhabla.ai" } },
    ]);

    await api.get("/growth/admin/yo");

    expect(peticiones).toHaveLength(1);
    expect(peticiones[0].headers.get("Authorization")).toBe(`Bearer ${jwt}`);
    // Nunca en la URL ni en parámetros: acabaría en logs.
    expect(peticiones[0].url).not.toContain(jwt);
    expect(peticiones[0].params).toBeUndefined();
    expect(peticiones[0].withCredentials).toBeFalsy();
  });

  it("sin token vigente no sale ninguna petición y rechaza con SesionCaducada", async () => {
    const { adaptador } = simularRed([]);
    await expect(api.get("/growth/admin/yo")).rejects.toBeInstanceOf(
      SesionCaducada
    );
    expect(adaptador).not.toHaveBeenCalled();
  });

  it("un token dentro del margen de caducidad cuenta como caducado: no sale y marca la sesión", async () => {
    // exp a 90 s: lo bastante para guardarse, pero menos de un minuto después ya no vale.
    guardarCredencial(crearJwt({ exp: Math.floor(Date.now() / 1000) + 90 }));
    const { adaptador } = simularRed([]);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 40_000);
    try {
      await expect(api.get("/growth/admin/yo")).rejects.toBeInstanceOf(
        SesionCaducada
      );
    } finally {
      vi.useRealTimers();
    }
    expect(adaptador).not.toHaveBeenCalled();
    expect(obtenerEstadoDeSesion().estado).toBe("caducada");
  });

  it("un 401 deja la sesión «caducada», borra el token y no redirige", async () => {
    guardarCredencial(crearJwt({ email: "yo@alhabla.ai" }));
    const antes = window.location.href;
    simularRed([
      {
        status: 401,
        data: { error: "Tu sesión ha caducado. Vuelve a iniciar sesión." },
      },
    ]);

    await expect(api.get("/growth/admin/resumen")).rejects.toBeInstanceOf(
      AxiosError
    );

    expect(obtenerEstadoDeSesion()).toEqual({
      estado: "caducada",
      email: "yo@alhabla.ai",
    });
    expect(tokenGuardado()).toBeNull();
    expect(window.location.href).toBe(antes);
  });

  it("un 403 deja la sesión «sin acceso» con el correo", async () => {
    guardarCredencial(crearJwt({ email: "otro@ejemplo.example" }));
    simularRed([{ status: 403, data: { error: "No tienes acceso." } }]);

    await expect(api.get("/growth/admin/yo")).rejects.toBeInstanceOf(
      AxiosError
    );

    expect(obtenerEstadoDeSesion()).toEqual({
      estado: "sin_acceso",
      email: "otro@ejemplo.example",
    });
  });

  it("un 503 no toca la sesión y se cuenta como «Growth no está configurado.»", async () => {
    guardarCredencial(crearJwt());
    simularRed([
      { status: 503, data: { error: "Growth no está configurado." } },
    ]);

    const error = await api.get("/growth/admin/yo").catch((e: unknown) => e);

    expect(obtenerEstadoDeSesion().estado).toBe("activa");
    expect(mensajeDeError(error, "No se pudo.")).toBe(MENSAJE_SIN_CONFIGURAR);
  });

  it("un 409 de dominio tampoco toca la sesión", async () => {
    guardarCredencial(crearJwt());
    simularRed([
      {
        status: 409,
        data: { error: "Una oportunidad aprobada no admite «aprobar»." },
      },
    ]);
    await api
      .post("/growth/admin/oportunidades/x/decision", {
        accion: "aprobar",
        borradorId: "b",
      })
      .catch(() => {});
    expect(obtenerEstadoDeSesion().estado).toBe("activa");
  });

  it("un 401 de una petición con un token viejo no castiga la sesión nueva", async () => {
    const viejo = crearJwt({ email: "yo@alhabla.ai" });
    guardarCredencial(viejo);
    let nuevo = "";
    const adaptador = vi.fn(async (config: InternalAxiosRequestConfig) => {
      // Mientras la petición vuela, la persona vuelve a iniciar sesión.
      nuevo = crearJwt({
        email: "yo@alhabla.ai",
        exp: Math.floor(Date.now() / 1000) + 7200,
      });
      guardarCredencial(nuevo);
      throw new AxiosError("fallo", AxiosError.ERR_BAD_RESPONSE, config, null, {
        status: 401,
        statusText: "",
        headers: {},
        config,
        data: { error: "Tu sesión ha caducado." },
      });
    });
    api.defaults.adapter = adaptador;

    await api.get("/growth/admin/resumen").catch(() => {});

    expect(obtenerEstadoDeSesion()).toMatchObject({
      estado: "activa",
      email: "yo@alhabla.ai",
    });
    expect(tokenGuardado()).toBe(nuevo);
  });

  it("rechaza la promesa con el error original para que la pantalla lo cuente", async () => {
    guardarCredencial(crearJwt());
    simularRed([
      {
        status: 429,
        data: { statusCode: 429, error: "Too Many Requests", message: "x" },
      },
    ]);
    const error = await api
      .get("/growth/admin/resumen")
      .catch((e: unknown) => e);
    expect(mensajeDeError(error, "No se pudo.")).toMatch(
      /Espera unos segundos/
    );
  });
});
