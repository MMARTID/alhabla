import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { WhatsappNumeroNegocio } from "@prisma/client";
import { prisma } from "../../../src/lib/prisma.js";
import { whatsappAdapter } from "../../../src/adapters/whatsapp/WhatsAppAdapter.js";
import {
  datosDelAlta,
  estadoWhatsappPropio,
  olvidarEnlaceEnCache,
  refrescarConexion,
  registrarWhatsappPropio,
} from "../../../src/modules/whatsapp/propio.js";

vi.mock("../../../src/lib/prisma.js", () => ({
  prisma: {
    whatsappNumeroNegocio: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    whatsappSender: { findFirst: vi.fn() },
  },
}));

vi.mock("../../../src/adapters/whatsapp/WhatsAppAdapter.js", () => ({
  whatsappAdapter: {
    appEnlazada: vi.fn(),
    registrarAltaEnCoexistencia: vi.fn(),
    estadoDeAlta: vi.fn(),
    numeroPorIdDeMeta: vi.fn(),
  },
}));

const db = prisma as unknown as {
  whatsappNumeroNegocio: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  whatsappSender: { findFirst: ReturnType<typeof vi.fn> };
};
const adapter = whatsappAdapter as unknown as {
  appEnlazada: ReturnType<typeof vi.fn>;
  registrarAltaEnCoexistencia: ReturnType<typeof vi.fn>;
  estadoDeAlta: ReturnType<typeof vi.fn>;
  numeroPorIdDeMeta: ReturnType<typeof vi.fn>;
};

const ENV = {
  WHATSAPP_PROPIO_ENABLED: "true",
  META_WHATSAPP_APP_ID: "2349496959195397",
  META_WHATSAPP_CONFIG_ID: "111222333",
  TELNYX_WA_SOLUTION_ID: "",
  META_GRAPH_VERSION: "v21.0",
};
const guardado: Record<string, string | undefined> = {};

function fila(
  cambios: Partial<WhatsappNumeroNegocio> = {}
): WhatsappNumeroNegocio {
  return {
    id: "wpn_1",
    businessId: "biz_1",
    metaPhoneNumberId: "109876543210",
    metaWabaId: "123456789012345",
    phoneNumber: null,
    signupId: "ses_1",
    estado: "registrando",
    errores: [],
    syncDeadline: null,
    consultadoAt: null,
    conectadoAt: null,
    createdAt: new Date("2026-11-06T10:00:00Z"),
    updatedAt: new Date("2026-11-06T10:00:00Z"),
    ...cambios,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  olvidarEnlaceEnCache();
  for (const [clave, valor] of Object.entries(ENV)) {
    guardado[clave] = process.env[clave];
    process.env[clave] = valor;
  }
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  db.whatsappNumeroNegocio.update.mockImplementation(
    async ({ data }: { data: Partial<WhatsappNumeroNegocio> }) => ({
      ...fila(),
      ...data,
    })
  );
});

afterEach(() => {
  for (const clave of Object.keys(ENV)) {
    if (guardado[clave] === undefined) delete process.env[clave];
    else process.env[clave] = guardado[clave];
  }
  vi.restoreAllMocks();
});

describe("datosDelAlta", () => {
  it("con el interruptor apagado no pregunta a Telnyx", async () => {
    process.env.WHATSAPP_PROPIO_ENABLED = "false";
    expect(await datosDelAlta()).toEqual({ motivo: "apagado" });
    expect(adapter.appEnlazada).not.toHaveBeenCalled();
  });

  it("sin app o configuración de Meta no está disponible", async () => {
    process.env.META_WHATSAPP_CONFIG_ID = "";
    expect(await datosDelAlta()).toEqual({ motivo: "sin_configurar" });
  });

  it("toma el solution_id de Telnyx cuando el enlace está activo, y lo guarda un rato", async () => {
    adapter.appEnlazada.mockResolvedValue({
      solutionId: "sol_9",
      enabled: true,
    });
    const primero = await datosDelAlta();
    const segundo = await datosDelAlta();
    expect(primero).toEqual({
      alta: {
        appId: "2349496959195397",
        configId: "111222333",
        solutionId: "sol_9",
        graphVersion: "v21.0",
      },
    });
    expect(segundo).toEqual(primero);
    expect(adapter.appEnlazada).toHaveBeenCalledTimes(1);
  });

  it("sin enlace en Telnyx (404) no está disponible", async () => {
    adapter.appEnlazada.mockResolvedValue(null);
    expect(await datosDelAlta()).toEqual({ motivo: "sin_enlace_de_telnyx" });
  });

  it("un enlace desactivado cuenta como sin enlace", async () => {
    adapter.appEnlazada.mockResolvedValue({
      solutionId: "sol_9",
      enabled: false,
    });
    expect(await datosDelAlta()).toEqual({ motivo: "sin_enlace_de_telnyx" });
  });

  it("si Telnyx falla, lo dice en el log y no está disponible", async () => {
    adapter.appEnlazada.mockRejectedValue(new Error("caído"));
    expect(await datosDelAlta()).toEqual({ motivo: "sin_enlace_de_telnyx" });
    expect(console.error).toHaveBeenCalled();
  });

  it("TELNYX_WA_SOLUTION_ID evita la consulta", async () => {
    process.env.TELNYX_WA_SOLUTION_ID = "sol_env";
    const datos = await datosDelAlta();
    expect("alta" in datos && datos.alta.solutionId).toBe("sol_env");
    expect(adapter.appEnlazada).not.toHaveBeenCalled();
  });
});

describe("registrarWhatsappPropio", () => {
  const entrada = { wabaId: "123456789012345", phoneNumberId: "109876543210" };

  beforeEach(() => {
    process.env.TELNYX_WA_SOLUTION_ID = "sol_env";
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(null);
    db.whatsappSender.findFirst.mockResolvedValue(null);
    adapter.registrarAltaEnCoexistencia.mockResolvedValue({
      sessionId: "ses_1",
      status: "PENDING",
    });
    db.whatsappNumeroNegocio.upsert.mockImplementation(
      async ({ create }: { create: Partial<WhatsappNumeroNegocio> }) => ({
        ...fila(),
        ...create,
      })
    );
  });

  it("registra en Telnyx con el negocio del JWT como customer_id", async () => {
    const resultado = await registrarWhatsappPropio("biz_1", entrada);
    expect(adapter.registrarAltaEnCoexistencia).toHaveBeenCalledWith({
      wabaId: "123456789012345",
      phoneNumberId: "109876543210",
      appId: "2349496959195397",
      customerId: "biz_1",
    });
    expect(db.whatsappNumeroNegocio.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: "biz_1" },
        create: expect.objectContaining({
          businessId: "biz_1",
          signupId: "ses_1",
          estado: "registrando",
        }),
      })
    );
    expect(resultado.outcome).toBe("registrado");
    if (resultado.outcome === "registrado") {
      expect(resultado.estado.conexion?.estado).toBe("registrando");
    }
  });

  it("no deja conectar un número de Alhabla", async () => {
    db.whatsappSender.findFirst.mockResolvedValue({ id: "s1" });
    expect(await registrarWhatsappPropio("biz_1", entrada)).toEqual({
      outcome: "numero_ocupado",
    });
    expect(adapter.registrarAltaEnCoexistencia).not.toHaveBeenCalled();
  });

  it("no deja conectar el número de otro negocio", async () => {
    db.whatsappNumeroNegocio.findUnique.mockImplementation(
      async ({ where }: { where: Record<string, string> }) =>
        where.metaPhoneNumberId ? fila({ businessId: "biz_2" }) : null
    );
    expect(await registrarWhatsappPropio("biz_1", entrada)).toEqual({
      outcome: "numero_ocupado",
    });
  });

  it("si ya está conectado, no repite el alta", async () => {
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(
      fila({ estado: "active" })
    );
    expect(await registrarWhatsappPropio("biz_1", entrada)).toEqual({
      outcome: "ya_conectado",
    });
  });

  it("deja repetir un alta caducada", async () => {
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(
      fila({ estado: "sync_deadline_expired" })
    );
    const resultado = await registrarWhatsappPropio("biz_1", entrada);
    expect(resultado.outcome).toBe("registrado");
  });

  it("con Telnyx rechazando, no guarda nada y lo dice", async () => {
    adapter.registrarAltaEnCoexistencia.mockRejectedValue(
      new Error("Error 422")
    );
    const resultado = await registrarWhatsappPropio("biz_1", entrada);
    expect(resultado.outcome).toBe("error_de_telnyx");
    expect(db.whatsappNumeroNegocio.upsert).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("sin el interruptor no llama a Telnyx", async () => {
    process.env.WHATSAPP_PROPIO_ENABLED = "false";
    expect(await registrarWhatsappPropio("biz_1", entrada)).toEqual({
      outcome: "no_disponible",
      motivo: "apagado",
    });
    expect(adapter.registrarAltaEnCoexistencia).not.toHaveBeenCalled();
  });
});

describe("refrescarConexion", () => {
  const ahora = new Date("2026-11-06T12:00:00Z");

  it("con una consulta reciente no vuelve a preguntar", async () => {
    const reciente = fila({
      consultadoAt: new Date(ahora.getTime() - 2_000),
    });
    expect(await refrescarConexion(reciente, ahora)).toBe(reciente);
    expect(adapter.estadoDeAlta).not.toHaveBeenCalled();
  });

  it("una sesión fallida pasa a fallido con el motivo", async () => {
    adapter.estadoDeAlta.mockResolvedValue({
      status: "FAILURE",
      state: "SHARE_CREDIT_LINE",
      errores: ["credit line"],
    });
    const resultado = await refrescarConexion(fila(), ahora);
    expect(resultado.estado).toBe("fallido");
    expect(resultado.errores).toEqual(["credit line"]);
    expect(adapter.numeroPorIdDeMeta).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("cuando el número aparece, copia su estado de coexistencia", async () => {
    adapter.estadoDeAlta.mockResolvedValue({
      status: "SUCCESS",
      state: "COMPLETE",
      errores: [],
    });
    const plazo = new Date("2026-11-07T12:00:00Z");
    adapter.numeroPorIdDeMeta.mockResolvedValue({
      phoneNumber: "+34600111222",
      wabaId: "123456789012345",
      coexistenceState: "syncing",
      isOnBizApp: true,
      syncDeadline: plazo,
    });
    const resultado = await refrescarConexion(fila(), ahora);
    expect(resultado.estado).toBe("syncing");
    expect(resultado.phoneNumber).toBe("+34600111222");
    expect(resultado.syncDeadline).toEqual(plazo);
    expect(resultado.conectadoAt).toBeNull();
  });

  it("al llegar a active apunta cuándo quedó conectado", async () => {
    adapter.numeroPorIdDeMeta.mockResolvedValue({
      phoneNumber: "+34600111222",
      wabaId: "123456789012345",
      coexistenceState: "active",
      isOnBizApp: true,
      syncDeadline: null,
    });
    const resultado = await refrescarConexion(
      fila({ estado: "syncing", signupId: "ses_1" }),
      ahora
    );
    expect(resultado.estado).toBe("active");
    expect(resultado.conectadoAt).toEqual(ahora);
    expect(adapter.estadoDeAlta).not.toHaveBeenCalled();
  });

  it("si Telnyx falla, se queda lo guardado y lo dice en el log", async () => {
    adapter.estadoDeAlta.mockRejectedValue(new Error("timeout"));
    const resultado = await refrescarConexion(fila(), ahora);
    expect(resultado.estado).toBe("registrando");
    expect(resultado.consultadoAt).toEqual(ahora);
    expect(console.error).toHaveBeenCalled();
  });

  it("un alta fallida no se vuelve a consultar", async () => {
    const fallida = fila({ estado: "fallido" });
    expect(await refrescarConexion(fallida, ahora)).toBe(fallida);
    expect(adapter.estadoDeAlta).not.toHaveBeenCalled();
  });
});

describe("estadoWhatsappPropio", () => {
  it("con el interruptor apagado enseña la conexión guardada sin consultar", async () => {
    process.env.WHATSAPP_PROPIO_ENABLED = "false";
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(
      fila({ estado: "active", phoneNumber: "+34600111222" })
    );
    const estado = await estadoWhatsappPropio("biz_1");
    expect(estado.disponible).toBe(false);
    expect(estado.motivo).toBe("apagado");
    expect(estado.conexion).toMatchObject({
      estado: "active",
      phoneNumber: "+34600111222",
      puedeRepetir: false,
    });
    expect(adapter.numeroPorIdDeMeta).not.toHaveBeenCalled();
  });

  it("sin conexión devuelve los datos del alta para el panel", async () => {
    process.env.TELNYX_WA_SOLUTION_ID = "sol_env";
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(null);
    const estado = await estadoWhatsappPropio("biz_1");
    expect(estado).toEqual({
      disponible: true,
      motivo: null,
      alta: {
        appId: "2349496959195397",
        configId: "111222333",
        solutionId: "sol_env",
        graphVersion: "v21.0",
      },
      conexion: null,
    });
  });
});
