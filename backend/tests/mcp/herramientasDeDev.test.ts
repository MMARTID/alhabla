import { describe, expect, it, vi } from "vitest";
import { resumirMigraciones } from "../../mcp/backendSim.js";
import {
  completarReserva,
  recogerValores,
  rellenarMarcadores,
} from "../../mcp/conversacionSimulada.js";
import { explicarFalloDeGcloud } from "../../mcp/gcloud.js";
import {
  claveDePase,
  destinoDeLaApp,
  llamarApiDeDev,
} from "../../mcp/sesionDeDev.js";

describe("simular_conversacion: memoria entre pasos", () => {
  const respuestas = [
    { success: true, result: { availabilityToken: "tok-1", hueco: { professionalId: "p-1" } } },
    { result: { success: true, bookingId: "b-1", citaAnterior: { bookingId: "b-0" } } },
  ];

  it("recoge los valores con nombre a cualquier profundidad; gana el último", () => {
    const memoria = new Map<string, unknown>();
    for (const respuesta of respuestas) recogerValores(respuesta, memoria);
    expect(memoria.get("availabilityToken")).toBe("tok-1");
    expect(memoria.get("professionalId")).toBe("p-1");
    // citaAnterior.bookingId aparece después que bookingId en el objeto.
    expect(memoria.get("bookingId")).toBe("b-0");
  });

  it("rellena los marcadores y avisa del que no existe", () => {
    const memoria = new Map<string, unknown>([["bookingId", "b-1"]]);
    expect(
      rellenarMarcadores({ bookingId: "{{bookingId}}", nota: "{{no es}} marcador" }, memoria)
    ).toEqual({ bookingId: "b-1", nota: "{{no es}} marcador" });
    expect(() => rellenarMarcadores({ x: "{{availabilityToken}}" }, memoria)).toThrow(
      /Ningún paso anterior devolvió «availabilityToken»/
    );
  });

  it("book_appointment sin token ni fecha toma el del último check_availability", () => {
    const memoria = new Map<string, unknown>([["availabilityToken", "tok-1"]]);
    expect(completarReserva("book_appointment", { clientName: "Ana" }, memoria)).toEqual({
      clientName: "Ana",
      availabilityToken: "tok-1",
    });
    // Con fecha explícita (camino sin token) no se toca.
    expect(
      completarReserva("book_appointment", { startDateTime: "2026-10-30T10:00:00+01:00" }, memoria)
    ).not.toHaveProperty("availabilityToken");
    expect(completarReserva("check_availability", {}, memoria)).toEqual({});
  });
});

describe("entrar_en_app_dev", () => {
  it("usa la misma clave de pase que modules/auth/pase.ts", () => {
    expect(claveDePase("abc")).toBe("auth:pase:abc");
  });

  it("solo acepta rutas de la app como destino", () => {
    expect(destinoDeLaApp(undefined)).toBe("/");
    expect(destinoDeLaApp("/agenda?dia=2026-10-29")).toBe("/agenda?dia=2026-10-29");
    expect(() => destinoDeLaApp("https://malo.com")).toThrow();
    expect(() => destinoDeLaApp("//malo.com")).toThrow();
    expect(() => destinoDeLaApp("/\\malo.com")).toThrow();
  });
});

describe("llamar_api_dev", () => {
  it("no sale de la base aunque la ruta lo intente", async () => {
    const fetchFn = vi.fn();
    await expect(
      llamarApiDeDev({
        env: {},
        urlDeBdDeDev: "postgresql://localhost/x",
        metodo: "GET",
        ruta: "//otro.host/x",
        sinSesion: true,
        fetchFn,
      })
    ).rejects.toThrow(/quedarse en http:\/\/localhost:3000/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("sin sesión hace la petición y devuelve el JSON", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ quedan: 7 }), { status: 200 })
    );
    const resultado = await llamarApiDeDev({
      env: {},
      urlDeBdDeDev: "postgresql://localhost/x",
      metodo: "get",
      ruta: "/billing/fundadores",
      backend: "sim",
      sinSesion: true,
      fetchFn,
    });
    expect(fetchFn.mock.calls[0][0].toString()).toBe("http://localhost:3010/billing/fundadores");
    expect(resultado).toMatchObject({
      peticion: "GET http://localhost:3010/billing/fundadores",
      status: 200,
      respuesta: { quedan: 7 },
    });
    expect(resultado).not.toHaveProperty("comoUsuario");
  });
});

describe("backend_sim", () => {
  it("resume la salida de prisma migrate deploy", () => {
    expect(
      resumirMigraciones(
        "Applying migration `20261028120000_modo_de_agenda`\n\nThe following migration(s) have been applied:\n\nmigrations/\n  └─ 20261028120000_modo_de_agenda/\n    └─ migration.sql\n"
      )
    ).toEqual({ aplicadas: ["20261028120000_modo_de_agenda"] });
    expect(resumirMigraciones("No pending migrations to apply.")).toEqual({
      aplicadas: [],
      mensaje: "Ninguna pendiente",
    });
  });
});

describe("explicarFalloDeGcloud", () => {
  it("da el arreglo cuando la sesión de Google caducó", () => {
    const explicado = explicarFalloDeGcloud(
      "ERROR: (gcloud.secrets.versions.access) There was a problem refreshing your current auth tokens: Reauthentication failed. cannot prompt during non-interactive execution."
    );
    expect(explicado).toContain("gcloud auth login admin@alhabla.ai");
  });

  it("deja igual cualquier otro fallo", () => {
    expect(explicarFalloDeGcloud("NOT_FOUND: Secret [X] not found")).toBe(
      "NOT_FOUND: Secret [X] not found"
    );
  });
});
