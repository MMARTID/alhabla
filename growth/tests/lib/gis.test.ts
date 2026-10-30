import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANTELACION_DE_RENOVACION_MS,
  URL_DE_GIS,
  cargarGis,
  iniciarGis,
  olvidarCuentaDeGoogle,
  pintarBotonDeGoogle,
  programarRenovacion,
  recuperarSesionSilenciosa,
} from "@/lib/gis";
import {
  guardarCredencial,
  obtenerEstadoDeSesion,
  tokenGuardado,
} from "@/lib/sesion";
import { instalarGoogleFalso } from "../helpers/google-falso";
import { crearJwt } from "../helpers/jwt";
import { reiniciarTodo } from "../helpers/reiniciar";

const CLIENT_ID = "prueba.apps.googleusercontent.com";

beforeEach(() => {
  vi.restoreAllMocks();
  reiniciarTodo();
});

afterEach(() => {
  vi.useRealTimers();
});

function scriptsDeGoogle() {
  return document.head.querySelectorAll(`script[src="${URL_DE_GIS}"]`);
}

describe("cargarGis", () => {
  it("reutiliza window.google si ya existe y no inyecta ningún script", async () => {
    const { id } = instalarGoogleFalso();
    await expect(cargarGis()).resolves.toBe(id);
    expect(scriptsDeGoogle()).toHaveLength(0);
  });

  it("inyecta el script UNA sola vez aunque se pida varias veces a la vez", async () => {
    const a = cargarGis();
    const b = cargarGis();
    expect(scriptsDeGoogle()).toHaveLength(1);
    const script = scriptsDeGoogle()[0] as HTMLScriptElement;
    expect(script.async).toBe(true);
    const { id } = instalarGoogleFalso();
    script.onload?.(new Event("load"));
    await expect(a).resolves.toBe(id);
    await expect(b).resolves.toBe(id);
  });

  it("si el script no carga rechaza, quita la etiqueta y deja reintentar", async () => {
    const primera = cargarGis();
    (scriptsDeGoogle()[0] as HTMLScriptElement).onerror?.(new Event("error"));
    await expect(primera).rejects.toThrow(/No se pudo cargar/);
    expect(scriptsDeGoogle()).toHaveLength(0);

    const segunda = cargarGis();
    expect(scriptsDeGoogle()).toHaveLength(1);
    const { id } = instalarGoogleFalso();
    (scriptsDeGoogle()[0] as HTMLScriptElement).onload?.(new Event("load"));
    await expect(segunda).resolves.toBe(id);
  });

  it("si el script carga pero no ofrece el inicio de sesión, rechaza", async () => {
    const promesa = cargarGis();
    (scriptsDeGoogle()[0] as HTMLScriptElement).onload?.(new Event("load"));
    await expect(promesa).rejects.toThrow(/no ofrece/);
  });
});

describe("iniciarGis", () => {
  it("llama a initialize UNA vez con el client_id y auto_select", async () => {
    const { id } = instalarGoogleFalso();
    await iniciarGis(CLIENT_ID);
    await iniciarGis(CLIENT_ID);
    expect(id.initialize).toHaveBeenCalledTimes(1);
    expect(id.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: CLIENT_ID,
        auto_select: true,
        cancel_on_tap_outside: false,
        itp_support: true,
      })
    );
  });

  it("la credencial que entrega Google va a la sesión", async () => {
    const google = instalarGoogleFalso();
    await iniciarGis(CLIENT_ID);
    const jwt = crearJwt({ email: "yo@alhabla.ai" });
    google.entregar(jwt);
    expect(tokenGuardado()).toBe(jwt);
    expect(obtenerEstadoDeSesion()).toMatchObject({
      estado: "activa",
      email: "yo@alhabla.ai",
    });
  });

  it("una credencial ilegible no crea sesión", async () => {
    const google = instalarGoogleFalso();
    await iniciarGis(CLIENT_ID);
    google.entregar("basura");
    expect(obtenerEstadoDeSesion().estado).toBe("sin_sesion");
  });
});

describe("pintarBotonDeGoogle", () => {
  it("pinta el botón en español dentro del contenedor, sin FedCM forzado", async () => {
    const { id } = instalarGoogleFalso();
    const contenedor = document.createElement("div");
    contenedor.textContent = "antiguo";
    await pintarBotonDeGoogle(CLIENT_ID, contenedor);
    expect(id.renderButton).toHaveBeenCalledWith(
      contenedor,
      expect.objectContaining({ locale: "es", type: "standard", width: 320 })
    );
    expect(contenedor.textContent).toBe("");
    expect(id.initialize.mock.calls[0][0]).not.toHaveProperty(
      "use_fedcm_for_button"
    );
  });
});

describe("recuperarSesionSilenciosa", () => {
  it("pide la credencial una sola vez por carga de página", async () => {
    const { id } = instalarGoogleFalso();
    await recuperarSesionSilenciosa(CLIENT_ID);
    await recuperarSesionSilenciosa(CLIENT_ID);
    expect(id.prompt).toHaveBeenCalledTimes(1);
  });

  it("si Google no carga, no lanza: el botón sigue a la vista", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const promesa = recuperarSesionSilenciosa(CLIENT_ID);
    (scriptsDeGoogle()[0] as HTMLScriptElement).onerror?.(new Event("error"));
    await expect(promesa).resolves.toBeUndefined();
  });
});

describe("olvidarCuentaDeGoogle", () => {
  it("desactiva el inicio automático", () => {
    const { id } = instalarGoogleFalso();
    olvidarCuentaDeGoogle();
    expect(id.disableAutoSelect).toHaveBeenCalledTimes(1);
  });

  it("sin Google cargado no hace nada", () => {
    expect(() => olvidarCuentaDeGoogle()).not.toThrow();
  });
});

describe("programarRenovacion", () => {
  async function conSesion(vigenciaSegundos: number) {
    const google = instalarGoogleFalso();
    await iniciarGis(CLIENT_ID);
    const exp = Math.floor(Date.now() / 1000) + vigenciaSegundos;
    guardarCredencial(crearJwt({ exp }));
    return { google, exp };
  }

  it("pide una credencial nueva 5 minutos antes de que expire", async () => {
    const { google, exp } = await conSesion(3600);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(Date.now());
    const cancelar = programarRenovacion(CLIENT_ID, exp);

    await vi.advanceTimersByTimeAsync(
      3600_000 - ANTELACION_DE_RENOVACION_MS - 1000
    );
    expect(google.id.prompt).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(google.id.prompt).toHaveBeenCalledTimes(1);
    cancelar();
  });

  it("si no llega una credencial nueva, un minuto antes marca la sesión caducada", async () => {
    const { exp } = await conSesion(3600);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(Date.now());
    const cancelar = programarRenovacion(CLIENT_ID, exp);

    await vi.advanceTimersByTimeAsync(3600_000 - 61_000);
    expect(obtenerEstadoDeSesion().estado).toBe("activa");
    await vi.advanceTimersByTimeAsync(2000);
    expect(obtenerEstadoDeSesion()).toMatchObject({
      estado: "caducada",
      email: "admin@alhabla.ai",
    });
    cancelar();
  });

  it("cancelar lo deja todo parado", async () => {
    const { google, exp } = await conSesion(3600);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(Date.now());
    programarRenovacion(CLIENT_ID, exp)();
    await vi.advanceTimersByTimeAsync(4000_000);
    expect(google.id.prompt).not.toHaveBeenCalled();
    expect(obtenerEstadoDeSesion().estado).toBe("activa");
  });

  it("al volver a la pestaña con menos de 5 minutos pide renovar", async () => {
    const { google, exp } = await conSesion(200);
    // Con los temporizadores parados: solo cuenta el aviso de volver a la pestaña.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const cancelar = programarRenovacion(CLIENT_ID, exp);
    document.dispatchEvent(new Event("visibilitychange"));
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(google.id.prompt).toHaveBeenCalledTimes(1);
    cancelar();
  });

  it("al volver a la pestaña con el token ya vencido marca la caducidad", async () => {
    const { exp } = await conSesion(3600);
    const cancelar = programarRenovacion(
      CLIENT_ID,
      exp,
      () => exp * 1000 - 10_000
    );
    document.dispatchEvent(new Event("visibilitychange"));
    expect(obtenerEstadoDeSesion().estado).toBe("caducada");
    cancelar();
  });

  it("sin client_id solo programa el aviso de caducidad", async () => {
    const { google, exp } = await conSesion(100);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(Date.now());
    const cancelar = programarRenovacion(null, exp);
    await vi.advanceTimersByTimeAsync(100_000);
    expect(google.id.prompt).not.toHaveBeenCalled();
    expect(obtenerEstadoDeSesion().estado).toBe("caducada");
    cancelar();
  });
});
