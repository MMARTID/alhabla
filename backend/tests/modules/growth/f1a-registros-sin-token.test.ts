import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import { OAuth2Client } from "google-auth-library";
import { Writable } from "node:stream";
import { growthRoutes } from "../../../src/modules/growth/routes.js";
import { motivoSinToken } from "../../../src/plugins/growthAuth.js";
import { ADMIN } from "./ayudas.js";

/**
 * Un token de agente (`gta_…`, que no caduca) enviado por error a
 * /growth/admin/* no puede acabar en el log. `google-auth-library` mete el
 * token en el mensaje de su error, y la ruta registraba el error entero.
 *
 * Aquí NO se simula la librería de Google: se usa la real (solo se sustituye la
 * descarga de los certificados, para no salir a la red).
 */

const { prismaMock } = await vi.hoisted(async () => {
  const { crearPrismaMock } = await import("./ayudas.js");
  return { prismaMock: crearPrismaMock() };
});

vi.mock("../../../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const TOKEN_DE_AGENTE = "gta_Zq8Yx7WvUtSrQpOnMlKjIhGfEdCbA0123456789";
const JWT_AJENO =
  "eyJhbGciOiJSUzI1NiIsImtpZCI6Ims5In0.eyJzdWIiOiIxMjMiLCJlbWFpbCI6InNlY3JldG9AZWplbXBsby5jb20ifQ.firma-secreta-abc";

describe("el log no guarda el token que llega al administrador", () => {
  let lineas: string[];
  let fastify: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    process.env.GROWTH_GOOGLE_CLIENT_ID =
      "cliente-growth.apps.googleusercontent.com";
    process.env.GROWTH_ADMIN_EMAILS = ADMIN;
    // Sin red: los certificados de Google no hacen falta para que el token
    // se rechace por su forma.
    vi.spyOn(
      OAuth2Client.prototype,
      "getFederatedSignonCertsAsync"
    ).mockResolvedValue({ certs: {}, format: "PEM" } as never);

    lineas = [];
    fastify = Fastify({
      logger: {
        level: "debug",
        stream: new Writable({
          write(trozo, _codificacion, listo) {
            lineas.push(trozo.toString());
            listo();
          },
        }),
      },
    });
    await fastify.register(growthRoutes);
  });

  afterEach(async () => {
    await fastify.close();
    vi.restoreAllMocks();
  });

  const entrar = (token: string) =>
    fastify.inject({
      method: "GET",
      url: "/growth/admin/oportunidades",
      headers: { authorization: `Bearer ${token}` },
    });

  it("la librería de Google sí mete el token en el mensaje (por eso no se registra el error)", async () => {
    const error = await new OAuth2Client()
      .verifyIdToken({ idToken: TOKEN_DE_AGENTE, audience: "x" })
      .catch((e: Error) => e);
    expect((error as Error).message).toContain(TOKEN_DE_AGENTE);
  });

  it.each([
    ["un token de agente", TOKEN_DE_AGENTE],
    ["un JWT con tres segmentos que no es de Google", JWT_AJENO],
    ["basura con puntos", "aaa.bbb.ccc"],
  ])(
    "%s enviado a /growth/admin/* da 401 y no aparece en la salida",
    async (_n, token) => {
      const response = await entrar(token);
      expect(response.statusCode).toBe(401);

      const salida = lineas.join("");
      // Ni entero ni por trozos.
      for (const trozo of [token, ...token.split(".")].filter(
        (t) => t.length >= 6
      )) {
        expect(salida).not.toContain(trozo);
      }
      // Y sí se registra QUE falló, con el motivo sin el contenido.
      expect(salida).toContain(
        "[Growth] ID token de administrador no verificado"
      );
    }
  );

  it("el motivo que queda en el log es el nombre del error y el mensaje cortado antes de «:»", async () => {
    await entrar(TOKEN_DE_AGENTE);
    const registro = lineas
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .find((l) => String(l.msg).includes("no verificado"));
    expect(registro).toBeDefined();
    expect(registro!.motivo).toBe("Error: Wrong number of segments in token");
    expect(registro).not.toHaveProperty("err");
  });

  it("nada del registro de la petición lleva la cabecera Authorization", async () => {
    await entrar(TOKEN_DE_AGENTE);
    expect(lineas.join("")).not.toMatch(/authorization/i);
  });
});

describe("motivoSinToken", () => {
  it("corta el mensaje en el primer «:» y en el primer salto de línea", () => {
    expect(
      motivoSinToken(new Error("Wrong number of segments in token: gta_abc"))
    ).toBe("Error: Wrong number of segments in token");
    expect(
      motivoSinToken(new Error("Primera línea\nSegunda con gta_abc"))
    ).toBe("Error: Primera línea");
  });

  it("si el token está antes del primer «:», lo tapa igualmente", () => {
    expect(
      motivoSinToken(new Error("Token gta_abc123 caducado"), "gta_abc123")
    ).toBe("Error: Token [token] caducado");
    expect(
      motivoSinToken(new Error("Rechazado gta_zzz999 y eyJhbGciOi.eyJzdWI.fir"))
    ).toBe("Error: Rechazado [token] y [token]");
  });

  it("no revienta con lo que no es un Error y limita la longitud", () => {
    expect(motivoSinToken("texto")).toBe("string");
    expect(motivoSinToken(undefined)).toBe("undefined");
    expect(motivoSinToken(new Error(""))).toBe("Error");
    expect(motivoSinToken(new Error("x".repeat(500))).length).toBeLessThan(140);
  });
});
