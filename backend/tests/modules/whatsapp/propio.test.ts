import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { WhatsappNumeroNegocio } from "@prisma/client";
import { prisma } from "../../../src/lib/prisma.js";
import { whatsappAdapter } from "../../../src/adapters/whatsapp/WhatsAppAdapter.js";
import {
  alAnadirseUnWaba,
  disponibilidad,
  estadoWhatsappPropio,
  olvidarEnlaceEnCache,
  pedirEnlaceDeAlta,
  refrescarConexion,
  registrarWhatsappPropio,
} from "../../../src/modules/whatsapp/propio.js";

vi.mock("../../../src/lib/prisma.js", () => ({
  prisma: {
    whatsappNumeroNegocio: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
    numerosDelWaba: vi.fn(),
    crearEnlaceDeAlta: vi.fn(),
    enlaceDeAlta: vi.fn(),
  },
}));

const db = prisma as unknown as {
  whatsappNumeroNegocio: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
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
  numerosDelWaba: ReturnType<typeof vi.fn>;
  crearEnlaceDeAlta: ReturnType<typeof vi.fn>;
  enlaceDeAlta: ReturnType<typeof vi.fn>;
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
    origen: "propia",
    enlaceId: null,
    enlaceCaducaAt: null,
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

describe("disponibilidad", () => {
  it("con el interruptor apagado no pregunta a Telnyx", async () => {
    process.env.WHATSAPP_PROPIO_ENABLED = "false";
    expect(await disponibilidad()).toEqual({ motivo: "apagado" });
    expect(adapter.appEnlazada).not.toHaveBeenCalled();
  });

  it("sin app de Meta no está disponible", async () => {
    process.env.META_WHATSAPP_APP_ID = "";
    expect(await disponibilidad()).toEqual({ motivo: "sin_configurar" });
  });

  it("sin configuración de Meta hay alta alojada pero no la ventana de la app", async () => {
    process.env.META_WHATSAPP_CONFIG_ID = "";
    process.env.TELNYX_WA_SOLUTION_ID = "sol_env";
    expect(await disponibilidad()).toEqual({
      appId: "2349496959195397",
      propia: null,
    });
  });

  it("toma el solution_id de Telnyx cuando el enlace está activo, y lo guarda un rato", async () => {
    adapter.appEnlazada.mockResolvedValue({
      solutionId: "sol_9",
      enabled: true,
    });
    const primero = await disponibilidad();
    const segundo = await disponibilidad();
    expect(primero).toEqual({
      appId: "2349496959195397",
      propia: {
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
    expect(await disponibilidad()).toEqual({ motivo: "sin_enlace_de_telnyx" });
  });

  it("un enlace desactivado cuenta como sin enlace", async () => {
    adapter.appEnlazada.mockResolvedValue({
      solutionId: "sol_9",
      enabled: false,
    });
    expect(await disponibilidad()).toEqual({ motivo: "sin_enlace_de_telnyx" });
  });

  it("si Telnyx falla, lo dice en el log y no está disponible", async () => {
    adapter.appEnlazada.mockRejectedValue(new Error("caído"));
    expect(await disponibilidad()).toEqual({ motivo: "sin_enlace_de_telnyx" });
    expect(console.error).toHaveBeenCalled();
  });

  it("TELNYX_WA_SOLUTION_ID evita la consulta", async () => {
    process.env.TELNYX_WA_SOLUTION_ID = "sol_env";
    const datos = await disponibilidad();
    expect("appId" in datos && datos.propia?.solutionId).toBe("sol_env");
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
          origen: "propia",
          enlaceId: null,
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
      wabaId: null,
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
      wabaId: "123456789012345",
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
      altaPropia: {
        appId: "2349496959195397",
        configId: "111222333",
        solutionId: "sol_env",
        graphVersion: "v21.0",
      },
      conexion: null,
    });
  });
});

describe("alta propia sin configuración de Meta", () => {
  it("no registra si falta META_WHATSAPP_CONFIG_ID", async () => {
    process.env.TELNYX_WA_SOLUTION_ID = "sol_env";
    process.env.META_WHATSAPP_CONFIG_ID = "";
    expect(
      await registrarWhatsappPropio("biz_1", {
        wabaId: "123456789012345",
        phoneNumberId: "109876543210",
      })
    ).toEqual({ outcome: "no_disponible", motivo: "sin_configurar" });
    expect(adapter.registrarAltaEnCoexistencia).not.toHaveBeenCalled();
  });
});

describe("pedirEnlaceDeAlta", () => {
  const ahora = new Date("2026-11-06T12:00:00Z");
  const caduca = new Date("2026-11-07T12:00:00Z");

  function alojada(cambios: Partial<WhatsappNumeroNegocio> = {}) {
    return fila({
      origen: "alojada",
      enlaceId: "enl_1",
      enlaceCaducaAt: caduca,
      metaPhoneNumberId: null,
      metaWabaId: null,
      signupId: null,
      estado: "esperando_alta",
      ...cambios,
    });
  }

  beforeEach(() => {
    process.env.TELNYX_WA_SOLUTION_ID = "sol_env";
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(null);
    adapter.crearEnlaceDeAlta.mockResolvedValue({
      id: "enl_2",
      url: "https://acct.fyi?token=nuevo",
      caducaAt: caduca,
    });
    db.whatsappNumeroNegocio.upsert.mockImplementation(
      async ({ create }: { create: Partial<WhatsappNumeroNegocio> }) => ({
        ...fila(),
        ...create,
      })
    );
  });

  it("crea un enlace de coexistencia y deja la fila esperando el alta", async () => {
    const resultado = await pedirEnlaceDeAlta("biz_1", ahora);
    expect(adapter.crearEnlaceDeAlta).toHaveBeenCalledWith("2349496959195397");
    expect(db.whatsappNumeroNegocio.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: "biz_1" },
        create: expect.objectContaining({
          businessId: "biz_1",
          origen: "alojada",
          enlaceId: "enl_2",
          enlaceCaducaAt: caduca,
          metaPhoneNumberId: null,
          estado: "esperando_alta",
        }),
      })
    );
    expect(resultado).toMatchObject({
      outcome: "enlace",
      url: "https://acct.fyi?token=nuevo",
      estado: { disponible: true, conexion: { estado: "esperando_alta" } },
    });
  });

  it("con un enlace vigente devuelve el mismo, sin crear otro", async () => {
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(alojada());
    adapter.enlaceDeAlta.mockResolvedValue({
      id: "enl_1",
      url: "https://acct.fyi?token=viejo",
      caducaAt: caduca,
    });
    const resultado = await pedirEnlaceDeAlta("biz_1", ahora);
    expect(adapter.enlaceDeAlta).toHaveBeenCalledWith("enl_1");
    expect(adapter.crearEnlaceDeAlta).not.toHaveBeenCalled();
    expect(db.whatsappNumeroNegocio.upsert).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({
      outcome: "enlace",
      url: "https://acct.fyi?token=viejo",
    });
  });

  it("con el enlace a punto de caducar crea uno nuevo", async () => {
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(
      alojada({ enlaceCaducaAt: new Date(ahora.getTime() + 5 * 60_000) })
    );
    const resultado = await pedirEnlaceDeAlta("biz_1", ahora);
    expect(adapter.enlaceDeAlta).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ url: "https://acct.fyi?token=nuevo" });
  });

  it("deja empezar otra vez tras un enlace caducado o un alta fallida", async () => {
    for (const estado of ["enlace_caducado", "fallido", "disconnected"]) {
      db.whatsappNumeroNegocio.findUnique.mockResolvedValue(
        alojada({ estado })
      );
      expect((await pedirEnlaceDeAlta("biz_1", ahora)).outcome).toBe("enlace");
    }
  });

  it("no empieza otra con una conexión en curso o hecha", async () => {
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(
      alojada({ estado: "syncing" })
    );
    expect(await pedirEnlaceDeAlta("biz_1", ahora)).toEqual({
      outcome: "en_curso",
    });
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(
      alojada({ estado: "active" })
    );
    expect(await pedirEnlaceDeAlta("biz_1", ahora)).toEqual({
      outcome: "ya_conectado",
    });
    expect(adapter.crearEnlaceDeAlta).not.toHaveBeenCalled();
  });

  it("si Telnyx falla, no guarda nada y lo dice", async () => {
    adapter.crearEnlaceDeAlta.mockRejectedValue(new Error("Error 422"));
    const resultado = await pedirEnlaceDeAlta("biz_1", ahora);
    expect(resultado.outcome).toBe("error_de_telnyx");
    expect(db.whatsappNumeroNegocio.upsert).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("sin enlace de la app en Telnyx no está disponible", async () => {
    process.env.TELNYX_WA_SOLUTION_ID = "";
    adapter.appEnlazada.mockResolvedValue(null);
    expect(await pedirEnlaceDeAlta("biz_1", ahora)).toEqual({
      outcome: "no_disponible",
      motivo: "sin_enlace_de_telnyx",
    });
  });
});

describe("refrescarConexion en el alta alojada", () => {
  const ahora = new Date("2026-11-06T12:00:00Z");

  // Como Prisma: la fila guardada más los cambios, partiendo de la que se
  // refresca (el mock general parte de una fila «registrando»).
  beforeEach(() => {
    db.whatsappNumeroNegocio.update.mockImplementation(
      async ({ data }: { data: Partial<WhatsappNumeroNegocio> }) => ({
        ...esperando(),
        ...data,
      })
    );
  });

  function esperando(cambios: Partial<WhatsappNumeroNegocio> = {}) {
    return fila({
      origen: "alojada",
      enlaceId: "enl_1",
      enlaceCaducaAt: new Date("2026-11-07T10:00:00Z"),
      metaPhoneNumberId: null,
      metaWabaId: null,
      signupId: null,
      estado: "esperando_alta",
      ...cambios,
    });
  }

  it("mientras el dueño no acaba, sigue esperando sin buscar números", async () => {
    adapter.estadoDeAlta.mockResolvedValue(null);
    const resultado = await refrescarConexion(esperando(), ahora);
    expect(adapter.estadoDeAlta).toHaveBeenCalledWith("enl_1");
    expect(resultado.estado).toBe("esperando_alta");
    expect(adapter.numerosDelWaba).not.toHaveBeenCalled();
  });

  it("un enlace sin usar pasa a caducado pasada la gracia", async () => {
    adapter.estadoDeAlta.mockResolvedValue(null);
    const resultado = await refrescarConexion(
      esperando({ enlaceCaducaAt: new Date("2026-11-06T10:30:00Z") }),
      ahora
    );
    expect(resultado.estado).toBe("enlace_caducado");
    expect(
      (
        await refrescarConexion(
          esperando({ enlaceCaducaAt: new Date("2026-11-06T11:30:00Z") }),
          ahora
        )
      ).estado
    ).toBe("esperando_alta");
  });

  it("al acabar el alta, busca el número del WABA en la app de WhatsApp Business", async () => {
    adapter.estadoDeAlta.mockResolvedValue({
      status: "SUCCESS",
      state: "COMPLETE",
      wabaId: "555",
      errores: [],
    });
    adapter.numerosDelWaba.mockResolvedValue([
      {
        phoneNumber: "+34911000000",
        phoneNumberId: "1",
        wabaId: "555",
        coexistenceState: null,
        isOnBizApp: false,
        syncDeadline: null,
      },
      {
        phoneNumber: "+34600111222",
        phoneNumberId: "2",
        wabaId: "555",
        coexistenceState: "syncing",
        isOnBizApp: true,
        syncDeadline: null,
      },
    ]);
    const resultado = await refrescarConexion(esperando(), ahora);
    expect(adapter.numerosDelWaba).toHaveBeenCalledWith("555");
    expect(resultado).toMatchObject({
      signupId: "enl_1",
      metaWabaId: "555",
      metaPhoneNumberId: "2",
      phoneNumber: "+34600111222",
      estado: "syncing",
    });
  });

  it("con la sesión en marcha pero sin el número aún, queda registrando", async () => {
    adapter.estadoDeAlta.mockResolvedValue({
      status: "PENDING",
      state: "SUBSCRIBE_WEBHOOKS",
      wabaId: "555",
      errores: [],
    });
    adapter.numerosDelWaba.mockResolvedValue([]);
    const resultado = await refrescarConexion(esperando(), ahora);
    expect(resultado.estado).toBe("registrando");
    expect(resultado.signupId).toBe("enl_1");
  });

  it("una sesión alojada fallida pasa a fallido", async () => {
    adapter.estadoDeAlta.mockResolvedValue({
      status: "FAILURE",
      state: "SHARE_CREDIT_LINE",
      wabaId: "555",
      errores: ["credit line"],
    });
    const resultado = await refrescarConexion(esperando(), ahora);
    expect(resultado.estado).toBe("fallido");
    expect(resultado.errores).toEqual(["credit line"]);
  });

  it("un enlace caducado no se vuelve a consultar", async () => {
    const caducado = esperando({ estado: "enlace_caducado" });
    expect(await refrescarConexion(caducado, ahora)).toBe(caducado);
    expect(adapter.estadoDeAlta).not.toHaveBeenCalled();
  });
});

describe("alAnadirseUnWaba", () => {
  function evento(payload: Record<string, unknown>) {
    return {
      data: {
        id: "evt_1",
        event_type: "whatsapp.waba_added",
        record_type: "event",
        payload: { record_type: "waba_account_added", ...payload },
      },
    };
  }

  it("ata el WABA al negocio del enlace y pide buscar el número ya", async () => {
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(
      fila({ id: "wpn_9", estado: "esperando_alta", enlaceId: "enl_1" })
    );
    expect(
      await alAnadirseUnWaba(
        evento({ event_id: "enl_1", waba_id: "555", status: "SUCCESS" })
      )
    ).toEqual({ success: true });
    expect(db.whatsappNumeroNegocio.findUnique).toHaveBeenCalledWith({
      where: { enlaceId: "enl_1" },
    });
    expect(db.whatsappNumeroNegocio.update).toHaveBeenCalledWith({
      where: { id: "wpn_9" },
      data: {
        signupId: "enl_1",
        metaWabaId: "555",
        estado: "registrando",
        errores: [],
        consultadoAt: null,
      },
    });
  });

  it("recoge también un alta terminada con el enlace ya caducado", async () => {
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(
      fila({ estado: "enlace_caducado", enlaceId: "enl_1" })
    );
    await alAnadirseUnWaba(
      evento({ event_id: "enl_1", waba_id: "555", status: "SUCCESS" })
    );
    expect(db.whatsappNumeroNegocio.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: "registrando" }),
      })
    );
  });

  it("un alta fallida queda como fallida con su motivo", async () => {
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(
      fila({ estado: "esperando_alta", enlaceId: "enl_1" })
    );
    await alAnadirseUnWaba(
      evento({
        event_id: "enl_1",
        waba_id: "555",
        status: "FAILURE",
        errors: ["sin línea de crédito"],
      })
    );
    expect(db.whatsappNumeroNegocio.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: "fallido",
          errores: ["sin línea de crédito"],
        }),
      })
    );
    expect(console.error).toHaveBeenCalled();
  });

  it("busca también por la sesión del alta propia", async () => {
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(null);
    db.whatsappNumeroNegocio.findFirst.mockResolvedValue(fila());
    await alAnadirseUnWaba(
      evento({ event_id: "ses_1", waba_id: "555", status: "SUCCESS" })
    );
    expect(db.whatsappNumeroNegocio.findFirst).toHaveBeenCalledWith({
      where: { signupId: "ses_1" },
    });
    expect(db.whatsappNumeroNegocio.update).toHaveBeenCalled();
  });

  it("un WABA sin alta de ningún negocio no toca nada", async () => {
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(null);
    db.whatsappNumeroNegocio.findFirst.mockResolvedValue(null);
    expect(
      await alAnadirseUnWaba(
        evento({ event_id: "otra", waba_id: "555", status: "SUCCESS" })
      )
    ).toEqual({ success: true });
    expect(db.whatsappNumeroNegocio.update).not.toHaveBeenCalled();
  });

  it("no hace retroceder una conexión que ya avanzó", async () => {
    db.whatsappNumeroNegocio.findUnique.mockResolvedValue(
      fila({ estado: "active", enlaceId: "enl_1" })
    );
    await alAnadirseUnWaba(
      evento({ event_id: "enl_1", waba_id: "555", status: "SUCCESS" })
    );
    expect(db.whatsappNumeroNegocio.update).not.toHaveBeenCalled();
  });
});
