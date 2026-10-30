import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import {
  ErrorDeCliente,
  MENSAJE_SESION_CADUCADA,
  MENSAJE_SIN_CONFIGURAR,
  SesionCaducada,
  analizarError,
  codigoDeError,
  esGrowthSinConfigurar,
  esLimiteDePeticiones,
  mensajeDeError,
} from "@/lib/api-errors";

function errorHttp(estado: number | null, data?: unknown): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const respuesta =
    estado === null
      ? undefined
      : { status: estado, statusText: "", headers: {}, config, data };
  return new AxiosError(
    "fallo",
    AxiosError.ERR_BAD_RESPONSE,
    config,
    null,
    respuesta
  );
}

const RESPALDO = "No se pudo hacer eso.";

describe("analizarError", () => {
  it("usa el texto del backend en un fallo de dominio (409) con su código y comprobaciones", () => {
    const comprobaciones = [
      { regla: "afirmaciones_vigentes", ok: false, dura: true, detalle: "x" },
    ];
    const resultado = analizarError(
      errorHttp(409, {
        error: "Una regla dura ya no se cumple.",
        codigo: "cumplimiento",
        comprobaciones,
      }),
      RESPALDO
    );
    expect(resultado).toEqual({
      estado: 409,
      mensaje: "Una regla dura ya no se cumple.",
      codigo: "cumplimiento",
      comprobaciones,
    });
  });

  it("un 400 de Zod (lista de fallos) no se enseña tal cual", () => {
    const resultado = analizarError(
      errorHttp(400, {
        error: [
          {
            code: "too_small",
            path: ["motivo"],
            message: "String must contain at least 1 character(s)",
          },
        ],
      }),
      RESPALDO
    );
    expect(resultado.mensaje).toBe(RESPALDO);
    expect(resultado.estado).toBe(400);
  });

  it("la forma estándar de Fastify (429) dice que hay que esperar, no «Too Many Requests»", () => {
    const resultado = analizarError(
      errorHttp(429, {
        statusCode: 429,
        error: "Too Many Requests",
        message: "Rate limit exceeded",
      }),
      RESPALDO
    );
    expect(resultado.mensaje).toMatch(/Espera unos segundos/);
    expect(esLimiteDePeticiones(errorHttp(429))).toBe(true);
    expect(esLimiteDePeticiones(errorHttp(500))).toBe(false);
  });

  it("un 400 con la forma de Fastify usa el respaldo", () => {
    expect(
      analizarError(
        errorHttp(400, {
          statusCode: 400,
          error: "Bad Request",
          message: "JSON mal formado",
        }),
        RESPALDO
      ).mensaje
    ).toBe(RESPALDO);
  });

  it("503 dice «Growth no está configurado.» aunque el cuerpo diga otra cosa", () => {
    expect(
      analizarError(
        errorHttp(503, { error: "Growth no está configurado." }),
        RESPALDO
      ).mensaje
    ).toBe(MENSAJE_SIN_CONFIGURAR);
    expect(
      analizarError(
        errorHttp(503, "<html>Service Unavailable</html>"),
        RESPALDO
      ).mensaje
    ).toBe(MENSAJE_SIN_CONFIGURAR);
    expect(esGrowthSinConfigurar(errorHttp(503))).toBe(true);
    expect(esGrowthSinConfigurar(errorHttp(500))).toBe(false);
  });

  it("un 5xx usa el respaldo y no filtra el mensaje del servidor", () => {
    expect(
      analizarError(errorHttp(500, { error: "Error interno." }), RESPALDO)
        .mensaje
    ).toBe(RESPALDO);
    expect(
      analizarError(
        errorHttp(502, { error: "connect ECONNREFUSED 10.0.0.1:5432" }),
        RESPALDO
      ).mensaje
    ).toBe(RESPALDO);
  });

  it("401 dice que la sesión caducó", () => {
    expect(
      analizarError(
        errorHttp(401, {
          error: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
        }),
        RESPALDO
      ).mensaje
    ).toBe(MENSAJE_SESION_CADUCADA);
  });

  it("403 usa el texto del backend o «No tienes acceso.»", () => {
    expect(
      analizarError(errorHttp(403, { error: "No tienes acceso." }), RESPALDO)
        .mensaje
    ).toBe("No tienes acceso.");
    expect(analizarError(errorHttp(403, {}), RESPALDO).mensaje).toBe(
      "No tienes acceso."
    );
  });

  it("sin respuesta (red caída) usa el respaldo y no tiene estado", () => {
    const resultado = analizarError(errorHttp(null), RESPALDO);
    expect(resultado).toEqual({
      estado: null,
      mensaje: RESPALDO,
      codigo: null,
      comprobaciones: null,
    });
  });

  it("una frase de más de 240 caracteres es un volcado, no un texto", () => {
    expect(
      analizarError(errorHttp(409, { error: "x".repeat(300) }), RESPALDO)
        .mensaje
    ).toBe(RESPALDO);
  });

  it("un error que no es de axios usa el respaldo", () => {
    expect(analizarError(new Error("kaboom"), RESPALDO).mensaje).toBe(RESPALDO);
    expect(analizarError("cadena", RESPALDO).mensaje).toBe(RESPALDO);
  });

  it("entiende los errores propios de la demostración y de la sesión", () => {
    const propio = new ErrorDeCliente(409, "Sin hueco.", {
      codigo: "tope_semanal",
    });
    expect(analizarError(propio, RESPALDO)).toEqual({
      estado: 409,
      mensaje: "Sin hueco.",
      codigo: "tope_semanal",
      comprobaciones: null,
    });
    expect(analizarError(new SesionCaducada(), RESPALDO)).toMatchObject({
      estado: 401,
      mensaje: MENSAJE_SESION_CADUCADA,
    });
  });
});

describe("mensajeDeError y codigoDeError", () => {
  it("son atajos de analizarError", () => {
    const error = errorHttp(409, {
      error: "Hay otro contacto.",
      codigo: "dominio_ya_aprobado",
    });
    expect(mensajeDeError(error, RESPALDO)).toBe("Hay otro contacto.");
    expect(codigoDeError(error)).toBe("dominio_ya_aprobado");
    expect(codigoDeError(errorHttp(500))).toBeNull();
  });
});
