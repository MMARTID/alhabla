import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  calendariosFalsosActivos,
  conCalendarioFalso,
  guardarCalendarioFalso,
  leerCalendarioFalso,
  marcaDeCredencialFalsa,
} from "../../../src/adapters/calendar/falso/calendarioFalso.js";
import type {
  CalendarProvider,
  ConexionActiva,
} from "../../../src/adapters/calendar/CalendarProvider.js";
import {
  almacenEnMemoria,
  reiniciarAlmacenEnMemoria,
} from "../../helpers/almacenEnMemoria.js";

// El calendario falso de backend-sim (PLAN-AGENDA-PRINCIPAL.md, «Cómo se
// comprueba»): solo para credenciales `falso:` y nunca en producción.

vi.mock("../../../src/lib/almacenTemporal.js", async () =>
  (await import("../../helpers/almacenEnMemoria.js")).almacenEnMemoria
);

const real: CalendarProvider<"google"> = {
  id: "google",
  listarCalendarios: vi.fn().mockResolvedValue([]),
  listarProximosEventos: vi.fn().mockResolvedValue([]),
  listarOcupacion: vi.fn().mockResolvedValue([]),
  crearEvento: vi.fn().mockResolvedValue({ id: "real", htmlLink: null }),
  borrarEvento: vi.fn().mockResolvedValue({ resultado: "borrado" }),
};

const conexion = (refreshToken: string): ConexionActiva<"google"> => ({
  provider: "google",
  calendarId: "primary",
  credentials: { provider: "google", refreshToken },
});

const evento = {
  summary: "Corte — Lucía",
  description: "",
  startTime: new Date("2026-12-10T10:00:00Z"),
  endTime: new Date("2026-12-10T10:45:00Z"),
  cliente: { nombre: "Lucía", telefono: null, email: null },
  recordatorioInmediatoMinutos: null,
  recordatorioPrevioMinutos: 120,
  zonaHoraria: "Europe/Madrid",
  idempotencyDigest: "abc123abc123abc123abc123ffff",
};

describe("calendario falso", () => {
  const entornoAntes = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    reiniciarAlmacenEnMemoria();
  });
  afterEach(() => {
    process.env = { ...entornoAntes };
  });

  it("solo está activo con CALENDARIOS_FALSOS=1 y nunca en producción", () => {
    process.env.CALENDARIOS_FALSOS = "1";
    process.env.NODE_ENV = "development";
    expect(calendariosFalsosActivos()).toBe(true);
    process.env.NODE_ENV = "production";
    expect(calendariosFalsosActivos()).toBe(false);
    process.env.NODE_ENV = "development";
    delete process.env.CALENDARIOS_FALSOS;
    expect(calendariosFalsosActivos()).toBe(false);
  });

  it("reconoce solo las credenciales que empiezan por falso:", () => {
    expect(
      marcaDeCredencialFalsa({ provider: "google", refreshToken: "falso:biz_1" })
    ).toBe("falso:biz_1");
    expect(
      marcaDeCredencialFalsa({ provider: "google", refreshToken: "1//real" })
    ).toBeNull();
    expect(
      marcaDeCredencialFalsa({
        provider: "caldav",
        serverUrl: "https://x.invalid/",
        username: "falso",
        appPassword: "falso:biz_2",
      })
    ).toBe("falso:biz_2");
  });

  it("con una credencial real va al adaptador real, sin tocar el falso", async () => {
    const envuelto = conCalendarioFalso(real);
    await envuelto.crearEvento(conexion("1//real"), evento);
    expect(real.crearEvento).toHaveBeenCalledTimes(1);
    expect(almacenEnMemoria.guardarClave).not.toHaveBeenCalled();
  });

  it("crea, lista la ocupación y borra en el falso; crear es idempotente", async () => {
    const envuelto = conCalendarioFalso(real);
    const c = conexion("falso:biz_1");

    const creado = await envuelto.crearEvento(c, evento);
    await envuelto.crearEvento(c, evento);
    expect(real.crearEvento).not.toHaveBeenCalled();
    expect((await leerCalendarioFalso("falso:biz_1")).eventos).toHaveLength(1);

    const ocupado = await envuelto.listarOcupacion(c, {
      timeMin: new Date("2026-12-10T09:00:00Z"),
      timeMax: new Date("2026-12-10T12:00:00Z"),
    });
    expect(ocupado).toEqual([
      {
        start: evento.startTime,
        end: evento.endTime,
        externalEventId: creado.id,
      },
    ]);

    expect(await envuelto.borrarEvento(c, creado.id!)).toEqual({
      resultado: "borrado",
    });
    expect(await envuelto.borrarEvento(c, creado.id!)).toEqual({
      resultado: "no_estaba",
      estado: 404,
    });
  });

  it("caído lanza un error cualquiera; revocado, el de reconexión del proveedor", async () => {
    const envuelto = conCalendarioFalso(real);
    const c = conexion("falso:biz_1");

    await guardarCalendarioFalso("falso:biz_1", { estado: "caido", eventos: [] });
    await expect(envuelto.crearEvento(c, evento)).rejects.toThrow(/caído/);

    await guardarCalendarioFalso("falso:biz_1", { estado: "revocado", eventos: [] });
    await expect(envuelto.crearEvento(c, evento)).rejects.toMatchObject({
      name: "CalendarBusinessError",
      code: "GOOGLE_CALENDAR_RECONNECT_REQUIRED",
      provider: "google",
    });
  });
});
