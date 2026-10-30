import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLAVE_DE_SESION,
  cerrarSesion,
  decodificarIdToken,
  guardarCredencial,
  marcarCaducada,
  marcarSinAcceso,
  obtenerEstadoDeSesion,
  reiniciarSesionParaPruebas,
  suscribirseASesion,
  tokenGuardado,
  tokenVigente,
} from "@/lib/sesion";
import { crearJwt } from "../helpers/jwt";

const enSegundos = (ms: number) => Math.floor(ms / 1000);

beforeEach(() => {
  vi.restoreAllMocks();
  reiniciarSesionParaPruebas();
  window.sessionStorage.clear();
});

describe("decodificarIdToken", () => {
  it("lee el correo y la caducidad de un JWT", () => {
    const exp = enSegundos(Date.now()) + 3600;
    expect(
      decodificarIdToken(crearJwt({ email: "admin@alhabla.ai", exp }))
    ).toEqual({
      email: "admin@alhabla.ai",
      exp,
    });
  });

  it("decodifica nombres con tildes y eñes (UTF-8, no latin1)", () => {
    const datos = decodificarIdToken(crearJwt({ name: "María Núñez" }));
    expect(datos?.name).toBe("María Núñez");
  });

  it("devuelve null si no es un JWT legible o le falta algo", () => {
    expect(decodificarIdToken("")).toBeNull();
    expect(decodificarIdToken("solo.dos")).toBeNull();
    expect(decodificarIdToken("a.%%%.c")).toBeNull();
    expect(decodificarIdToken("a.bm8tZXMtanNvbg.c")).toBeNull();
    expect(decodificarIdToken(crearJwt({ email: "" }))).toBeNull();
    expect(
      decodificarIdToken(crearJwt({ exp: "mañana" as unknown as number }))
    ).toBeNull();
  });
});

describe("tokenVigente", () => {
  it("devuelve el token y respeta el margen de un minuto", () => {
    const jwt = crearJwt({ exp: enSegundos(Date.now()) + 3600 });
    expect(guardarCredencial(jwt)).toBe(true);
    const caduca = decodificarIdToken(jwt)!.exp * 1000;
    expect(tokenVigente(caduca - 61_000)).toBe(jwt);
    expect(tokenVigente(caduca - 60_000)).toBeNull();
    expect(tokenVigente(caduca - 30_000)).toBeNull();
    expect(tokenVigente(caduca + 1)).toBeNull();
    // El margen se puede cambiar.
    expect(tokenVigente(caduca - 120_000, 90_000)).toBe(jwt);
    expect(tokenVigente(caduca - 80_000, 90_000)).toBeNull();
  });

  it("sin sesión no hay token", () => {
    expect(tokenVigente()).toBeNull();
    expect(tokenGuardado()).toBeNull();
  });
});

describe("el estado de la sesión", () => {
  it("empieza sin sesión y pasa a activa al guardar una credencial", () => {
    expect(obtenerEstadoDeSesion()).toEqual({ estado: "sin_sesion" });
    const exp = enSegundos(Date.now()) + 3600;
    expect(guardarCredencial(crearJwt({ email: "yo@alhabla.ai", exp }))).toBe(
      true
    );
    expect(obtenerEstadoDeSesion()).toEqual({
      estado: "activa",
      email: "yo@alhabla.ai",
      exp,
    });
  });

  it("no acepta una credencial ilegible ni ya caducada", () => {
    expect(guardarCredencial("basura")).toBe(false);
    expect(
      guardarCredencial(crearJwt({ exp: enSegundos(Date.now()) - 10 }))
    ).toBe(false);
    expect(
      guardarCredencial(crearJwt({ exp: enSegundos(Date.now()) + 30 }))
    ).toBe(false);
    expect(obtenerEstadoDeSesion()).toEqual({ estado: "sin_sesion" });
    expect(window.sessionStorage.getItem(CLAVE_DE_SESION)).toBeNull();
  });

  it("el token vive en sessionStorage, nunca en localStorage", () => {
    const jwt = crearJwt();
    guardarCredencial(jwt);
    expect(window.sessionStorage.getItem(CLAVE_DE_SESION)).toBe(jwt);
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).not.toContain(jwt);
  });

  it("recupera la sesión tras una recarga si el token sigue vigente", () => {
    guardarCredencial(crearJwt({ email: "yo@alhabla.ai" }));
    reiniciarSesionParaPruebas(); // «recargar»
    expect(obtenerEstadoDeSesion()).toMatchObject({
      estado: "activa",
      email: "yo@alhabla.ai",
    });
  });

  it("descarta un token guardado que ya caducó", () => {
    window.sessionStorage.setItem(
      CLAVE_DE_SESION,
      crearJwt({ exp: enSegundos(Date.now()) - 5 })
    );
    expect(obtenerEstadoDeSesion()).toEqual({ estado: "sin_sesion" });
    expect(window.sessionStorage.getItem(CLAVE_DE_SESION)).toBeNull();
  });

  it("si sessionStorage lanza, sigue funcionando en memoria", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(obtenerEstadoDeSesion()).toEqual({ estado: "sin_sesion" });
    const jwt = crearJwt({ email: "privado@alhabla.ai" });
    expect(guardarCredencial(jwt)).toBe(true);
    expect(tokenVigente()).toBe(jwt);
    expect(obtenerEstadoDeSesion()).toMatchObject({
      estado: "activa",
      email: "privado@alhabla.ai",
    });
    expect(() => cerrarSesion()).not.toThrow();
    expect(tokenVigente()).toBeNull();
  });

  it("marcarCaducada pasa a «caducada», conserva el correo y borra el token", () => {
    guardarCredencial(crearJwt({ email: "yo@alhabla.ai" }));
    marcarCaducada();
    expect(obtenerEstadoDeSesion()).toEqual({
      estado: "caducada",
      email: "yo@alhabla.ai",
    });
    expect(tokenGuardado()).toBeNull();
    expect(window.sessionStorage.getItem(CLAVE_DE_SESION)).toBeNull();
  });

  it("marcarCaducada no hace nada sin sesión activa", () => {
    marcarCaducada();
    expect(obtenerEstadoDeSesion()).toEqual({ estado: "sin_sesion" });
  });

  it("marcarSinAcceso conserva el correo y no deja token", () => {
    guardarCredencial(crearJwt({ email: "intruso@ejemplo.example" }));
    marcarSinAcceso();
    expect(obtenerEstadoDeSesion()).toEqual({
      estado: "sin_acceso",
      email: "intruso@ejemplo.example",
    });
    expect(tokenGuardado()).toBeNull();
  });

  it("marcarSinAcceso tampoco inventa una sesión", () => {
    marcarSinAcceso();
    expect(obtenerEstadoDeSesion()).toEqual({ estado: "sin_sesion" });
  });

  it("una credencial nueva saca de «caducada» y de «sin acceso»", () => {
    guardarCredencial(crearJwt({ email: "a@alhabla.ai" }));
    marcarCaducada();
    guardarCredencial(crearJwt({ email: "a@alhabla.ai" }));
    expect(obtenerEstadoDeSesion().estado).toBe("activa");
    marcarSinAcceso();
    guardarCredencial(crearJwt({ email: "b@alhabla.ai" }));
    expect(obtenerEstadoDeSesion()).toMatchObject({
      estado: "activa",
      email: "b@alhabla.ai",
    });
  });

  it("cerrarSesión lo borra todo", () => {
    guardarCredencial(crearJwt());
    cerrarSesion();
    expect(obtenerEstadoDeSesion()).toEqual({ estado: "sin_sesion" });
    expect(tokenGuardado()).toBeNull();
    expect(window.sessionStorage.getItem(CLAVE_DE_SESION)).toBeNull();
  });

  it("avisa a quien está suscrito, y deja de avisar al darse de baja", () => {
    const oyente = vi.fn();
    const baja = suscribirseASesion(oyente);
    guardarCredencial(crearJwt());
    expect(oyente).toHaveBeenCalledTimes(1);
    baja();
    cerrarSesion();
    expect(oyente).toHaveBeenCalledTimes(1);
  });
});
