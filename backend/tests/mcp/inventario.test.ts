import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUENTA_DEL_PANEL,
  ErrorDeInventario,
  asignarNumero,
  pedirNumero,
  tokenDelPanel,
  SQL_DE_CUENTAS,
  borrarFantasma,
  buscarFantasmas,
  editar,
  leerInventario,
  montarInventario,
  simularBorrado,
  variablesDeCloudRun,
  type Borrador,
  type Fuentes,
  type Inventario,
} from "../../mcp/inventario.js";

const AGENTE_DEV = "assistant-dev-1";
const AGENTE_PROD = "assistant-prod-1";
const GESTOR = "assistant-gestor";
const DE_AGENTE_BORRADO = "assistant-borrado";
const FANTASMA = "assistant-fantasma";

function inventario(
  entorno: "dev" | "prod",
  {
    assistantId,
    borrado = null,
    numero = null,
    pendiente = null,
    senders = [],
  }: {
    assistantId: string;
    borrado?: string | null;
    numero?: string | null;
    pendiente?: string | null;
    senders?: { audience: string; phoneNumber: string }[];
  }
): Inventario {
  return montarInventario(
    entorno,
    [
      {
        id: `cuenta${entorno}000001`,
        name: `Peluquería ${entorno}`,
        plan: "pro",
        subscriptionStatus: "active",
        phoneNumberStatus: numero ? "active" : "pending",
        telnyxPhoneNumber: numero,
        telnyxPhoneNumberId: null,
        telnyxPendingPhoneNumber: pendiente,
        createdAt: "2026-10-01T00:00:00.000Z",
      },
    ],
    [
      {
        id: `agente${entorno}000001`,
        businessId: `cuenta${entorno}000001`,
        name: "Recepcionista",
        telnyxAssistantId: assistantId,
        active: true,
        deletedAt: borrado,
        promptManuallyEdited: false,
        telnyxSyncError: null,
        telnyxSyncedAt: null,
        systemPrompt: "Eres la recepcionista de IA.",
      },
    ],
    senders.map((s) => ({
      ...s,
      telnyxPhoneNumberId: null,
      status: "CONNECTED",
    }))
  );
}

function fuentes(cambios: Partial<Fuentes> = {}): Fuentes {
  return {
    listarAssistants: async () => [
      { id: AGENTE_DEV, name: "dev", createdAt: null },
      { id: AGENTE_PROD, name: "prod", createdAt: null },
      { id: GESTOR, name: "alhabla-gestor", createdAt: null },
      { id: DE_AGENTE_BORRADO, name: "viejo", createdAt: null },
      { id: FANTASMA, name: "alhabla-x", createdAt: "2026-09-11T10:00:00Z" },
    ],
    listarNumeros: async () => [
      {
        id: "n-voz-prod",
        phoneNumber: "+34930000001",
        status: "active",
        connectionId: null,
        tags: [],
        createdAt: null,
      },
      {
        id: "n-reservas",
        phoneNumber: "+34930000002",
        status: "active",
        connectionId: null,
        tags: [],
        createdAt: null,
      },
      {
        id: "n-pendiente",
        phoneNumber: "+34930000003",
        status: "active",
        connectionId: null,
        tags: [],
        createdAt: null,
      },
      {
        id: "n-env",
        phoneNumber: "+34930000004",
        status: "active",
        connectionId: null,
        tags: [],
        createdAt: null,
      },
      {
        id: "n-waba",
        phoneNumber: "+34930000006",
        status: "active",
        connectionId: null,
        tags: [],
        createdAt: null,
      },
      {
        id: "n-reserva",
        phoneNumber: "+34930000007",
        status: "active",
        connectionId: null,
        tags: ["env-prod", "whatsapp-sector", "sector-barberia"],
        createdAt: null,
      },
      {
        id: "n-libre",
        phoneNumber: "+34930000009",
        status: "active",
        connectionId: null,
        tags: [],
        createdAt: "2026-09-20T00:00:00Z",
      },
    ],
    numerosDelWaba: async () => ["+34930000006"],
    inventario: async (entorno) => {
      if (entorno === "dev") {
        const dev = inventario("dev", {
          assistantId: AGENTE_DEV,
          pendiente: "+34930000003",
        });
        // Un segundo agente, borrado: su assistant sigue siendo fantasma.
        dev.cuentas[0].agentes.push({
          ...dev.cuentas[0].agentes[0],
          id: "agentedev000002",
          assistantId: DE_AGENTE_BORRADO,
          borrado: "2026-10-02T00:00:00.000Z",
        });
        return dev;
      }
      return inventario("prod", {
        assistantId: AGENTE_PROD,
        numero: "+34930000001",
        senders: [{ audience: "client", phoneNumber: "+34930000002" }],
      });
    },
    variablesDeDev: async () => ({
      TELNYX_GESTOR_ASSISTANT_ID: GESTOR,
      OTRA: "x",
    }),
    variablesDeProd: async () => ({
      WHATSAPP_TELNYX_FROM_NUMBER: "+34930000004",
    }),
    ...cambios,
  };
}

describe("montarInventario", () => {
  it("no saca nada de Stripe ni teléfonos del local o del dueño", () => {
    expect(SQL_DE_CUENTAS).not.toMatch(/stripe|ownerWhatsapp|"phone"|email/i);
    const inv = inventario("dev", {
      assistantId: AGENTE_DEV,
      senders: [
        { audience: "client", phoneNumber: "+34930000002" },
        { audience: "owner", phoneNumber: "+34930000005" },
      ],
    });
    expect(Object.keys(inv.cuentas[0]).sort()).toEqual(
      [
        "agentes",
        "creada",
        "estadoDeSuscripcion",
        "estadoDelNumero",
        "id",
        "nombre",
        "numero",
        "plan",
      ].sort()
    );
    expect(inv.cuentas[0].numero).toBeNull();
    expect(inv.numerosDePlataforma.map((n) => n.tipo)).toEqual([
      "whatsapp_reservas",
      "whatsapp_gestor",
    ]);
  });

  it("lee las tres tablas una tras otra y los prompts enteros", async () => {
    const ejecutar = vi.fn(async () => ({ filas: [] }));
    await leerInventario("prod", ejecutar);
    expect(ejecutar).toHaveBeenCalledTimes(3);
    expect(ejecutar.mock.calls[1]).toEqual([
      expect.stringContaining("FROM agents"),
      { maxCaracteresPorValor: 200_000 },
    ]);
  });
});

describe("buscarFantasmas", () => {
  it("cruza la cuenta con las DOS BD y con los ids de la configuración", async () => {
    const f = await buscarFantasmas(fuentes());
    // Ni el de producción visto desde dev ni al revés (el agujero de #86).
    expect(f.assistants.map((a) => a.id)).toEqual([
      DE_AGENTE_BORRADO,
      FANTASMA,
    ]);
    expect(f.assistants[0].nota?.[0]).toContain("(borrado)");
    // El de voz, el de WhatsApp, el que se está comprando, el de Cloud Run,
    // el del WABA y el de reserva (etiqueta whatsapp-sector) están en uso.
    expect(f.numeros.map((n) => n.id)).toEqual(["n-libre"]);
    expect(f.enLaCuenta).toEqual({ assistants: 5, numeros: 7 });
  });

  it("si falta una fuente no marca nada", async () => {
    await expect(
      buscarFantasmas(
        fuentes({
          inventario: async (entorno) => {
            if (entorno === "prod") throw new Error("[MCP] proxy caído");
            return inventario("dev", { assistantId: AGENTE_DEV });
          },
        })
      )
    ).rejects.toThrow(
      "No se puede decidir qué es fantasma sin la BD de producción: proxy caído"
    );
    await expect(
      buscarFantasmas(
        fuentes({
          variablesDeProd: async () => {
            throw new Error("gcloud sin sesión");
          },
        })
      )
    ).rejects.toThrow("las variables de Cloud Run");
    await expect(
      buscarFantasmas(
        fuentes({
          numerosDelWaba: async () => {
            throw new Error("WABA no responde");
          },
        })
      )
    ).rejects.toThrow("los números del WABA de WhatsApp");
  });
});

describe("simularBorrado (dry-run)", () => {
  it("dice qué se libera de un assistant fantasma", async () => {
    const plan = await simularBorrado(FANTASMA, fuentes());
    expect(plan).toMatchObject({
      esFantasma: true,
      tipo: "assistant",
      id: FANTASMA,
      descripcion: "Assistant «alhabla-x», creado el 2026-09-11",
    });
    expect(plan.esFantasma && plan.seLibera).toEqual([
      `El assistant ${FANTASMA} (deleteAssistant)`,
      `Su app TeXML «ai-${FANTASMA}», si existe (deleteTexmlAppOfAssistant)`,
    ]);
    expect(plan.esFantasma && plan.aviso).toContain("No tiene vuelta atrás");
  });

  it("encuentra un número por su id o por el número", async () => {
    for (const id of ["n-libre", "+34930000009"]) {
      expect(await simularBorrado(id, fuentes())).toMatchObject({
        esFantasma: true,
        tipo: "numero",
        id: "n-libre",
      });
    }
  });

  it("de algo en uso dice quién lo usa", async () => {
    expect(await simularBorrado(AGENTE_PROD, fuentes())).toEqual({
      esFantasma: false,
      id: AGENTE_PROD,
      motivo: [
        "prod · cuenta «Peluquería prod» (cuentaprod000001): agente agenteprod000001",
      ],
    });
    expect(await simularBorrado(GESTOR, fuentes())).toMatchObject({
      motivo: ["dev · .env: TELNYX_GESTOR_ASSISTANT_ID"],
    });
    expect(await simularBorrado("n-reserva", fuentes())).toMatchObject({
      esFantasma: false,
      motivo: ["Telnyx · etiqueta whatsapp-sector (WhatsApp en reserva)"],
    });
  });
});

describe("borrarFantasma", () => {
  let carpeta: string;
  const borrador = (): Borrador => ({
    borrarAssistant: vi.fn(async () => undefined),
    borrarAppTexml: vi.fn(async () => 1),
    liberarNumero: vi.fn(async () => undefined),
  });

  beforeEach(() => {
    carpeta = mkdtempSync(join(tmpdir(), "inventario-"));
    vi.stubEnv("ALHABLA_INVENTARIO_LOG", join(carpeta, "inventario.log"));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(carpeta, { recursive: true, force: true });
  });
  const log = () =>
    readFileSync(join(carpeta, "inventario.log"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as Record<string, unknown>);

  it("sin el id escrito o sin la marca no toca nada", async () => {
    const b = borrador();
    await expect(
      borrarFantasma(
        {
          id: FANTASMA,
          confirmacion: "assistant-otro",
          cuentaCompartida: true,
        },
        fuentes(),
        b
      )
    ).rejects.toThrow("Escribe el id exacto");
    await expect(
      borrarFantasma(
        { id: FANTASMA, confirmacion: FANTASMA, cuentaCompartida: false },
        fuentes(),
        b
      )
    ).rejects.toThrow("la cuenta de Telnyx es la de producción");
    expect(b.borrarAssistant).not.toHaveBeenCalled();
  });

  it("vuelve a comprobar y rechaza lo que ya no es fantasma", async () => {
    const b = borrador();
    const error = await borrarFantasma(
      { id: AGENTE_PROD, confirmacion: AGENTE_PROD, cuentaCompartida: true },
      fuentes(),
      b
    ).catch((e: ErrorDeInventario) => e);
    expect(error).toBeInstanceOf(ErrorDeInventario);
    expect((error as ErrorDeInventario).codigo).toBe(409);
    expect(b.borrarAssistant).not.toHaveBeenCalled();
    expect(log()[0]).toMatchObject({
      operacion: "borrar_fantasma",
      resultado: "rechazado",
    });
  });

  it("borra el assistant y su app TeXML, aunque el assistant ya no estuviera", async () => {
    const b = borrador();
    vi.mocked(b.borrarAssistant).mockRejectedValueOnce(
      Object.assign(new Error("Not found"), { status: 404 })
    );
    const r = await borrarFantasma(
      { id: FANTASMA, confirmacion: ` ${FANTASMA} `, cuentaCompartida: true },
      fuentes(),
      b
    );
    expect(r.hecho).toEqual([
      `Assistant ${FANTASMA} ya no existía`,
      "1 app TeXML borrada",
    ]);
    expect(b.borrarAppTexml).toHaveBeenCalledWith(FANTASMA);
    expect(log().map((l) => l.resultado)).toEqual(["empieza", "hecho"]);
  });

  it("libera un número con releaseNumber", async () => {
    const b = borrador();
    await borrarFantasma(
      { id: "n-libre", confirmacion: "n-libre", cuentaCompartida: true },
      fuentes(),
      b
    );
    expect(b.liberarNumero).toHaveBeenCalledWith("n-libre");
    expect(b.borrarAssistant).not.toHaveBeenCalled();
  });
});

describe("editar", () => {
  let carpeta: string;
  beforeEach(() => {
    carpeta = mkdtempSync(join(tmpdir(), "inventario-"));
    vi.stubEnv("ALHABLA_INVENTARIO_LOG", join(carpeta, "inventario.log"));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(carpeta, { recursive: true, force: true });
  });

  const agente = {
    tipo: "agente",
    entorno: "dev",
    businessId: "cuentadev000001",
    agenteId: "agentedev000001",
    systemPrompt: "Prompt nuevo y secreto",
  };

  it("va por PATCH /agents/:id de la app y anota sin el texto del prompt", async () => {
    const llamador = vi.fn(async () => ({ status: 200, respuesta: {} }));
    await editar(agente, llamador);
    expect(llamador).toHaveBeenCalledWith("dev", {
      metodo: "PATCH",
      ruta: "/agents/agentedev000001",
      cuerpo: { systemPrompt: "Prompt nuevo y secreto" },
      businessId: "cuentadev000001",
    });
    const log = readFileSync(join(carpeta, "inventario.log"), "utf8");
    expect(log).toContain('"systemPrompt":"22 caracteres"');
    expect(log).not.toContain("secreto");
  });

  it("el nombre, por PATCH /business/me", async () => {
    const llamador = vi.fn(async () => ({ status: 200, respuesta: {} }));
    await editar(
      {
        tipo: "cuenta",
        entorno: "dev",
        businessId: "cuentadev000001",
        nombre: " Nuevo ",
      },
      llamador
    );
    expect(llamador).toHaveBeenCalledWith(
      "dev",
      expect.objectContaining({
        ruta: "/business/me",
        cuerpo: { name: "Nuevo" },
      })
    );
  });

  it("en producción exige el id escrito", async () => {
    const llamador = vi.fn(async () => ({ status: 200, respuesta: {} }));
    await expect(
      editar({ ...agente, entorno: "prod" }, llamador)
    ).rejects.toThrow("escribe el id (agentedev000001)");
    expect(llamador).not.toHaveBeenCalled();
    await editar(
      { ...agente, entorno: "prod", confirmacion: "agentedev000001" },
      llamador
    );
    expect(llamador).toHaveBeenCalledWith("prod", expect.anything());
  });

  it("rechaza lo que no valida y propaga el error de la app", async () => {
    const llamador = vi.fn(async () => ({
      status: 404,
      respuesta: { error: "Recepcionista no encontrada" },
    }));
    await expect(
      editar({ ...agente, agenteId: "../x" }, llamador)
    ).rejects.toThrow("id no válido");
    await expect(
      editar(
        {
          tipo: "agente",
          entorno: "dev",
          businessId: "cuentadev000001",
          agenteId: "agentedev000001",
        },
        llamador
      )
    ).rejects.toThrow("Nada que cambiar");
    await expect(editar(agente, llamador)).rejects.toThrow(
      "La app respondió 404: Recepcionista no encontrada"
    );
  });
});

describe("variablesDeCloudRun", () => {
  it("se queda con los valores literales, no con los secretos", async () => {
    const gcloud = vi.fn(async () =>
      JSON.stringify({
        spec: {
          template: {
            spec: {
              containers: [
                {
                  env: [
                    { name: "TELNYX_GESTOR_ASSISTANT_ID", value: GESTOR },
                    { name: "TELNYX_API_KEY", valueFrom: { secretKeyRef: {} } },
                  ],
                },
              ],
            },
          },
        },
      })
    );
    expect(await variablesDeCloudRun(gcloud)).toEqual({
      TELNYX_GESTOR_ASSISTANT_ID: GESTOR,
    });
    expect(gcloud.mock.calls[0][0]).toContain("describe");
  });
});

describe("números para una cuenta", () => {
  let carpeta: string;
  beforeEach(() => {
    carpeta = mkdtempSync(join(tmpdir(), "inventario-"));
    vi.stubEnv("ALHABLA_INVENTARIO_LOG", join(carpeta, "inventario.log"));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(carpeta, { recursive: true, force: true });
  });
  const log = () =>
    readFileSync(join(carpeta, "inventario.log"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as Record<string, unknown>);

  const asignacion = {
    entorno: "dev",
    businessId: "cuentadev000001",
    telnyxPhoneNumberId: "n-libre",
  };

  it("asignar: solo un número fantasma, por la ruta interna del panel", async () => {
    const llamador = vi.fn(async () => ({
      status: 200,
      respuesta: { phoneNumber: "+34930000009", anterior: "+34930000008" },
    }));
    // Los ids de número de Telnyx son numéricos.
    const fuentesConIdNumerico = fuentes({
      listarNumeros: async () => [
        {
          id: "3047548328515471109",
          phoneNumber: "+34930000009",
          status: "active",
          connectionId: null,
          tags: [],
          createdAt: null,
        },
      ],
    });
    const r = await asignarNumero(
      {
        ...asignacion,
        telnyxPhoneNumberId: "3047548328515471109",
        sustituir: true,
      },
      fuentesConIdNumerico,
      llamador
    );
    expect(r.mensaje).toBe("+34930000009 asignado; +34930000008 queda sin uso");
    expect(llamador).toHaveBeenCalledWith(
      "dev",
      "/internal/panel/asignar-numero",
      {
        businessId: "cuentadev000001",
        telnyxPhoneNumberId: "3047548328515471109",
        sustituir: true,
      }
    );
    expect(log().at(-1)).toMatchObject({
      operacion: "asignar_numero",
      resultado: "hecho",
    });
  });

  it("asignar: rechaza un número en uso sin llamar al backend", async () => {
    const llamador = vi.fn();
    const fuentesEnUso = fuentes({
      listarNumeros: async () => [
        {
          id: "3047548328515471100",
          phoneNumber: "+34930000001",
          status: "active",
          connectionId: null,
          tags: [],
          createdAt: null,
        },
      ],
    });
    await expect(
      asignarNumero(
        { ...asignacion, telnyxPhoneNumberId: "3047548328515471100" },
        fuentesEnUso,
        llamador
      )
    ).rejects.toThrow(
      "Ese número no está libre: prod · cuenta «Peluquería prod»"
    );
    expect(llamador).not.toHaveBeenCalled();
  });

  it("asignar en producción exige el id del número escrito", async () => {
    const llamador = vi.fn();
    await expect(
      asignarNumero(
        { ...asignacion, entorno: "prod", telnyxPhoneNumberId: "123" },
        fuentes(),
        llamador
      )
    ).rejects.toThrow("escribe el id del número (123)");
    expect(llamador).not.toHaveBeenCalled();
  });

  it("pedir: siempre con el id de la cuenta y por la ruta de la app", async () => {
    const llamador = vi.fn(async () => ({
      status: 200,
      respuesta: {
        success: true,
        phoneNumber: "+34930000010",
        status: "active",
      },
    }));
    await expect(
      pedirNumero(
        { entorno: "dev", businessId: "cuentadev000001", confirmacion: "" },
        llamador
      )
    ).rejects.toThrow("cuesta dinero");
    expect(llamador).not.toHaveBeenCalled();

    const r = await pedirNumero(
      {
        entorno: "dev",
        businessId: "cuentadev000001",
        confirmacion: "cuentadev000001",
      },
      llamador
    );
    expect(r.mensaje).toBe("Comprado +34930000010");
    expect(llamador).toHaveBeenCalledWith("dev", {
      metodo: "POST",
      ruta: "/business/me/phone/provision",
      cuerpo: {},
      businessId: "cuentadev000001",
    });
  });

  it("pedir: el 402 de la app sale tal cual y un pedido en revisión no es un fallo", async () => {
    const sinPlan = vi.fn(async () => ({
      status: 402,
      respuesta: {
        error: "No tienes un plan activo para asignar un número de teléfono",
      },
    }));
    await expect(
      pedirNumero(
        {
          entorno: "dev",
          businessId: "cuentadev000001",
          confirmacion: "cuentadev000001",
        },
        sinPlan
      )
    ).rejects.toThrow("No tienes un plan activo");

    const enRevision = vi.fn(async () => ({
      status: 200,
      respuesta: {
        success: false,
        status: "pending",
        error: "revisión regulatoria",
      },
    }));
    const r = await pedirNumero(
      {
        entorno: "prod",
        businessId: "cuentadev000001",
        confirmacion: "cuentadev000001",
      },
      enRevision
    );
    expect(r.mensaje).toContain("Pedido en revisión");
    expect(log().map((l) => l.resultado)).toEqual(["rechazado", "pendiente"]);
  });

  it("el token lo firma la cuenta del panel con la audience del entorno", async () => {
    const gcloud = vi.fn(async () => "aaa.bbb.ccc\n");
    expect(await tokenDelPanel("https://dev-api.alhabla.ai", gcloud)).toBe(
      "aaa.bbb.ccc"
    );
    expect(gcloud).toHaveBeenCalledWith([
      "auth",
      "print-identity-token",
      `--impersonate-service-account=${CUENTA_DEL_PANEL}`,
      "--audiences=https://dev-api.alhabla.ai",
      "--include-email",
    ]);
    await expect(
      tokenDelPanel(
        "x",
        vi.fn(async () => "Permission denied")
      )
    ).rejects.toThrow("no devolvió un token");
  });
});
