import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ErrorDeAsignacion,
  asignarNumeroExistente,
  provisionPhoneNumber,
  getPhoneNumberStatus,
} from "../../../src/modules/phone/service.js";
import { telnyxAiAdapter } from "../../../src/adapters/telnyx/TelnyxAiAdapter.js";
import { prisma } from "../../../src/lib/prisma.js";
import { telnyxAdapter } from "../../../src/adapters/telnyx/TelnyxAdapter.js";
import { syncAgentToTelnyx } from "../../../src/lib/telnyxAgentSync.js";
import { invalidarCacheDeVoz } from "../../../src/lib/voiceConfigCache.js";
import { acquireLock, releaseLock } from "../../../src/lib/bookingLock.js";

vi.mock("../../../src/lib/prisma.js", () => ({
  prisma: {
    business: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    whatsappSender: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: {
    setPhoneNumberConnectionId: vi.fn(),
  },
}));

vi.mock("../../../src/adapters/telnyx/TelnyxAdapter.js", () => ({
  telnyxAdapter: {
    searchAvailableNumbers: vi.fn(),
    purchaseNumber: vi.fn(),
    getNumberOrder: vi.fn(),
    getNumberByPhoneNumber: vi.fn(),
    getNumber: vi.fn(),
  },
}));

// El lock de aprovisionamiento va por acquireLock/releaseLock
// (lib/bookingLock.ts), cuya liberación es un compare-and-delete por token en
// vez de un DEL incondicional — ver hallazgo de la revisión posterior a la
// auditoría (un DEL sin más podía borrar el lock de otra ejecución si el TTL
// había expirado mientras tanto). Desde el corte de Redis (PR A) el cerrojo
// vive en Postgres: aquí se comprueba por su función, no por el almacén.
vi.mock("../../../src/lib/bookingLock.js", () => ({
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
}));

vi.mock("../../../src/modules/whatsapp/alertas.js", () => ({
  alertarNumeroNoActivo: vi.fn().mockResolvedValue({ via: "interactivo" }),
}));
// La transferencia al dueño (fase 4) sale desde el número recién comprado:
// aquí solo importa que la compra resincronice el assistant de Telnyx.
vi.mock("../../../src/lib/telnyxAgentSync.js", () => ({
  syncAgentToTelnyx: vi.fn().mockResolvedValue(undefined),
}));
// La invalidación de la caché de voz se comprueba por su función, no por la
// clave de Redis: así el contrato sigue valiendo cuando esa caché cambie de
// almacén (plan de corte de Redis, fase 0).
vi.mock("../../../src/lib/voiceConfigCache.js", () => ({
  invalidarCacheDeVoz: vi.fn().mockResolvedValue(undefined),
}));

const mockedBusinessFindUnique = vi.mocked(prisma.business.findUnique);
const mockedBusinessUpdate = vi.mocked(prisma.business.update);
const mockedSearchAvailableNumbers = vi.mocked(
  telnyxAdapter.searchAvailableNumbers
);
const mockedPurchaseNumber = vi.mocked(telnyxAdapter.purchaseNumber);
const mockedGetNumberOrder = vi.mocked(telnyxAdapter.getNumberOrder);
const mockedGetNumberByPhoneNumber = vi.mocked(
  telnyxAdapter.getNumberByPhoneNumber
);
const mockedSyncAgentToTelnyx = vi.mocked(syncAgentToTelnyx);
const mockedAcquireLock = vi.mocked(acquireLock);
const mockedReleaseLock = vi.mocked(releaseLock);

const businessId = "biz_123";

describe("provisionPhoneNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAcquireLock.mockResolvedValue("token-del-cerrojo");
    mockedReleaseLock.mockResolvedValue(undefined);
    // Por defecto, "no se encontró nada" — el código cae al phoneNumberId
    // del pedido, igual que antes del fix del issue #17. Los tests que
    // verifican la resolución real lo sobrescriben explícitamente.
    mockedGetNumberByPhoneNumber.mockResolvedValue(null);
    process.env.TELNYX_SPAIN_REQUIREMENT_GROUP_ID = "req_group_test";
    process.env.TELNYX_CALL_CONTROL_APP_ID = "cca_test";
  });

  afterEach(() => {
    delete process.env.TELNYX_SPAIN_REQUIREMENT_GROUP_ID;
    delete process.env.TELNYX_CALL_CONTROL_APP_ID;
    vi.useRealTimers();
  });

  it("returns existing active number without purchasing again", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      phoneNumberStatus: "active",
      telnyxPhoneNumber: "+34886020712",
    } as any);

    const result = await provisionPhoneNumber(businessId);

    expect(result.success).toBe(true);
    expect(result.phoneNumber).toBe("+34886020712");
    expect(result.status).toBe("active");
    expect(mockedSearchAvailableNumbers).not.toHaveBeenCalled();
  });

  // El número va al Call Control App y queda activo al comprarlo
  // (docs/historico/PLAN-RETIRAR-RETELL.md).
  it("compra un número en el Call Control App y lo deja activo en Telnyx", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
      telnyxNumberOrderId: null,
    } as any);

    mockedSearchAvailableNumbers.mockResolvedValue([
      { phoneNumber: "+34886020712", region: "PONTEVEDRA" },
    ]);
    mockedPurchaseNumber.mockResolvedValue({
      orderId: "order_123",
      status: "success",
      phoneNumber: "+34886020712",
      phoneNumberId: "pn_123",
    });

    const result = await provisionPhoneNumber(businessId);

    expect(result.success).toBe(true);
    expect(result.phoneNumber).toBe("+34886020712");
    expect(result.status).toBe("active");
    expect(mockedPurchaseNumber).toHaveBeenCalledWith("+34886020712", {
      requirementGroupId: "req_group_test",
      connectionId: "cca_test",
    });
    expect(mockedBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          telnyxPhoneNumber: "+34886020712",
          phoneNumberStatus: "active",
          telnyxPendingPhoneNumber: null,
        }),
      })
    );
  });

  it("falla con un mensaje claro si falta el Call Control App de Telnyx", async () => {
    delete process.env.TELNYX_CALL_CONTROL_APP_ID;
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
      telnyxNumberOrderId: null,
    } as any);

    const result = await provisionPhoneNumber(businessId);

    expect(result).toMatchObject({ success: false, status: "failed" });
    expect(result.error).toMatch(/TELNYX_CALL_CONTROL_APP_ID/);
    expect(mockedSearchAvailableNumbers).not.toHaveBeenCalled();
  });

  // telnyxPhoneNumber forma parte de la configuración de voz cacheada (es el
  // remitente del aviso de reserva): sin invalidarla, una llamada dentro de
  // la hora siguiente seguiría viendo el negocio sin número.
  it("invalida la caché de voz del negocio después de guardar el número comprado", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
      telnyxNumberOrderId: null,
    } as any);
    mockedSearchAvailableNumbers.mockResolvedValue([
      { phoneNumber: "+34886020712", region: "PONTEVEDRA" },
    ]);
    mockedPurchaseNumber.mockResolvedValue({
      orderId: "order_123",
      status: "success",
      phoneNumber: "+34886020712",
      phoneNumberId: "pn_123",
    });

    const result = await provisionPhoneNumber(businessId);

    expect(result.success).toBe(true);
    expect(invalidarCacheDeVoz).toHaveBeenCalledWith(businessId, "[Phone]");
    // Después de escribir el número en la BD: invalidar antes no serviría,
    // la siguiente lectura volvería a cachear el negocio sin número.
    const escrituraDelNumero = mockedBusinessUpdate.mock.calls.findIndex(
      ([argumentos]) =>
        (argumentos as any).data?.telnyxPhoneNumber === "+34886020712"
    );
    expect(escrituraDelNumero).toBeGreaterThanOrEqual(0);
    expect(
      vi.mocked(invalidarCacheDeVoz).mock.invocationCallOrder[0]
    ).toBeGreaterThan(
      mockedBusinessUpdate.mock.invocationCallOrder[escrituraDelNumero]
    );
  });

  it("también invalida la caché de voz si el pedido sigue en revisión pero ya trae número", async () => {
    vi.useFakeTimers();
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
    } as any);
    mockedSearchAvailableNumbers.mockResolvedValue([
      { phoneNumber: "+34886020712" },
    ]);
    mockedPurchaseNumber.mockResolvedValue({
      orderId: "order_123",
      status: "pending",
      phoneNumber: "+34886020712",
    });
    mockedGetNumberOrder.mockResolvedValue({
      orderId: "order_123",
      status: "pending",
      phoneNumber: "+34886020712",
    });

    const resultPromise = provisionPhoneNumber(businessId);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.status).toBe("pending");
    expect(invalidarCacheDeVoz).toHaveBeenCalledWith(businessId, "[Phone]");
  });

  it("issue #17: persiste el id REAL del número (getNumberByPhoneNumber), no el phoneNumberId del pedido, cuando ambos difieren", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
      telnyxNumberOrderId: null,
    } as any);

    mockedSearchAvailableNumbers.mockResolvedValue([
      { phoneNumber: "+34886020712", region: "PONTEVEDRA" },
    ]);
    // El pedido devuelve un id de línea del pedido (issue #17) — no el id
    // real del recurso PhoneNumber.
    mockedPurchaseNumber.mockResolvedValue({
      orderId: "order_123",
      status: "success",
      phoneNumber: "+34886020712",
      phoneNumberId: "id_de_linea_del_pedido",
    });
    mockedGetNumberByPhoneNumber.mockResolvedValue({
      id: "3042776700011153161",
      phoneNumber: "+34886020712",
      status: "active",
    });

    await provisionPhoneNumber(businessId);

    expect(mockedGetNumberByPhoneNumber).toHaveBeenCalledWith("+34886020712");
    expect(mockedBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          telnyxPhoneNumberId: "3042776700011153161",
        }),
      })
    );
  });

  it("si no se puede resolver el id real del número, usa el phoneNumberId del pedido como último recurso sin lanzar", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
      telnyxNumberOrderId: null,
    } as any);

    mockedSearchAvailableNumbers.mockResolvedValue([
      { phoneNumber: "+34886020712", region: "PONTEVEDRA" },
    ]);
    mockedPurchaseNumber.mockResolvedValue({
      orderId: "order_123",
      status: "success",
      phoneNumber: "+34886020712",
      phoneNumberId: "pn_123",
    });
    mockedGetNumberByPhoneNumber.mockRejectedValue(new Error("Telnyx down"));

    const result = await provisionPhoneNumber(businessId);

    expect(result.success).toBe(true);
    expect(mockedBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ telnyxPhoneNumberId: "pn_123" }),
      })
    );
  });

  it("falla con un mensaje claro si falta configurar el Requirement Group de España", async () => {
    delete process.env.TELNYX_SPAIN_REQUIREMENT_GROUP_ID;

    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
    } as any);

    const result = await provisionPhoneNumber(businessId);

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/TELNYX_SPAIN_REQUIREMENT_GROUP_ID/);
    expect(mockedSearchAvailableNumbers).not.toHaveBeenCalled();
  });

  it("resincroniza el assistant de Telnyx en cuanto el número está comprado (fase 4: la tool transfer sale desde ese número)", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
      telnyxNumberOrderId: null,
    } as any);
    mockedSearchAvailableNumbers.mockResolvedValue([
      { phoneNumber: "+34886020712" },
    ]);
    mockedPurchaseNumber.mockResolvedValue({
      orderId: "order_123",
      status: "success",
      phoneNumber: "+34886020712",
      phoneNumberId: "pn_123",
    });

    const result = await provisionPhoneNumber(businessId);

    expect(result).toMatchObject({ success: true, status: "active" });
    expect(mockedSyncAgentToTelnyx).toHaveBeenCalledTimes(1);
    expect(mockedSyncAgentToTelnyx).toHaveBeenCalledWith(businessId);
    // Después de guardar el número (y no antes): la resolución de la
    // transferencia lo lee de la base de datos.
    const ordenGuardado = mockedBusinessUpdate.mock.invocationCallOrder.find(
      (_, index) =>
        (mockedBusinessUpdate.mock.calls[index][0].data as any)
          .telnyxPhoneNumber === "+34886020712"
    );
    expect(ordenGuardado).toBeDefined();
    expect(mockedSyncAgentToTelnyx.mock.invocationCallOrder[0]).toBeGreaterThan(
      ordenGuardado!
    );
  });

  it("no resincroniza Telnyx si el número ya estaba activo", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      phoneNumberStatus: "active",
      telnyxPhoneNumber: "+34886020712",
    } as any);

    await provisionPhoneNumber(businessId);

    expect(mockedSyncAgentToTelnyx).not.toHaveBeenCalled();
  });

  it("returns failed status when no numbers are available", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
    } as any);

    mockedSearchAvailableNumbers.mockResolvedValue([]);

    const result = await provisionPhoneNumber(businessId);

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
    expect(mockedBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phoneNumberStatus: "failed" }),
      })
    );
  });

  it("returns failed status on unexpected error and updates DB", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
    } as any);

    mockedSearchAvailableNumbers.mockRejectedValue(new Error("Telnyx down"));

    const result = await provisionPhoneNumber(businessId);

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
  });

  it("marca el pedido como 'failure' de Telnyx como fallo claro", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
    } as any);

    mockedSearchAvailableNumbers.mockResolvedValue([
      { phoneNumber: "+34886020712" },
    ]);
    mockedPurchaseNumber.mockResolvedValue({
      orderId: "order_123",
      status: "failure",
      phoneNumber: "+34886020712",
    });

    const result = await provisionPhoneNumber(businessId);

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
    // Alerta #5 al dueño por WhatsApp.
    const { alertarNumeroNoActivo } =
      await import("../../../src/modules/whatsapp/alertas.js");
    expect(alertarNumeroNoActivo).toHaveBeenCalledWith({ businessId });
  });

  it("deja el pedido en 'pending' si Telnyx sigue revisando los requisitos tras el margen de espera, sin dar error genérico", async () => {
    vi.useFakeTimers();

    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
    } as any);

    mockedSearchAvailableNumbers.mockResolvedValue([
      { phoneNumber: "+34886020712" },
    ]);
    mockedPurchaseNumber.mockResolvedValue({
      orderId: "order_123",
      status: "pending",
      phoneNumber: "+34886020712",
    });
    mockedGetNumberOrder.mockResolvedValue({
      orderId: "order_123",
      status: "pending",
      phoneNumber: "+34886020712",
    });

    const resultPromise = provisionPhoneNumber(businessId);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.status).toBe("pending");
    expect(mockedBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ telnyxNumberOrderId: "order_123" }),
      })
    );
  });

  it("reanuda un pedido ya en curso (telnyxNumberOrderId) en vez de comprar un número nuevo", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
      telnyxNumberOrderId: "order_456",
    } as any);

    mockedGetNumberOrder.mockResolvedValue({
      orderId: "order_456",
      status: "success",
      phoneNumber: "+34886020712",
      phoneNumberId: "pn_456",
    });

    const result = await provisionPhoneNumber(businessId);

    expect(result.success).toBe(true);
    expect(result.status).toBe("active");
    expect(mockedSearchAvailableNumbers).not.toHaveBeenCalled();
    expect(mockedPurchaseNumber).not.toHaveBeenCalled();
    expect(mockedGetNumberOrder).toHaveBeenCalledWith("order_456");
  });

  it("no compra un segundo número si otra llamada concurrente ya tiene el lock", async () => {
    mockedAcquireLock.mockResolvedValueOnce(null);

    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
      telnyxNumberOrderId: null,
    } as any);

    const result = await provisionPhoneNumber(businessId);

    expect(result.status).toBe("pending");
    expect(mockedSearchAvailableNumbers).not.toHaveBeenCalled();
    expect(mockedPurchaseNumber).not.toHaveBeenCalled();
    expect(mockedBusinessUpdate).not.toHaveBeenCalled();
  });

  it("relee el negocio DESPUÉS de adquirir el lock, no la copia de antes (hallazgo #12 de la auditoría)", async () => {
    // Primera lectura (antes del lock): todavía sin número, como si otra
    // llamada concurrente aún no hubiera terminado de comprar el suyo.
    // Segunda lectura (después de adquirir el lock, ya sin competencia): esa
    // otra llamada YA terminó y dejó el número activo. Usar la primera copia
    // para decidir si comprar habría comprado un segundo número real.
    mockedBusinessFindUnique
      .mockResolvedValueOnce({
        id: businessId,
        phoneNumberStatus: "pending",
        telnyxPhoneNumber: null,
      } as any)
      .mockResolvedValueOnce({
        id: businessId,
        name: "Peluquería Test",
        phoneNumberStatus: "active",
        telnyxPhoneNumber: "+34886020712",
        telnyxNumberOrderId: null,
      } as any);

    const result = await provisionPhoneNumber(businessId);

    expect(result.success).toBe(true);
    expect(result.status).toBe("active");
    expect(result.phoneNumber).toBe("+34886020712");
    expect(mockedSearchAvailableNumbers).not.toHaveBeenCalled();
    expect(mockedPurchaseNumber).not.toHaveBeenCalled();
    // El lock se adquirió y se liberó igualmente, aunque no hiciera falta
    // comprar nada — con el token propio (compare-and-delete), no con un DEL
    // incondicional. Y la relectura que decide es la de DESPUÉS del lock.
    expect(mockedReleaseLock).toHaveBeenCalledWith(
      `phone_provision_lock:${businessId}`,
      "token-del-cerrojo"
    );
    expect(mockedBusinessFindUnique).toHaveBeenCalledTimes(2);
    expect(mockedAcquireLock.mock.invocationCallOrder[0]).toBeLessThan(
      mockedBusinessFindUnique.mock.invocationCallOrder[1]
    );
  });

  it("limpia telnyxNumberOrderId cuando Telnyx marca el pedido como 'failure' definitivo (hallazgo #32 de la auditoría)", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
      telnyxNumberOrderId: "order_dead",
    } as any);

    mockedGetNumberOrder.mockResolvedValue({
      orderId: "order_dead",
      status: "failure",
      phoneNumber: "+34886020712",
    });

    const result = await provisionPhoneNumber(businessId);

    expect(result.success).toBe(false);
    expect(result.status).toBe("failed");
    // Sin esto, el siguiente intento de "reintentar" reanudaría el mismo
    // pedido muerto (telnyxNumberOrderId sigue apuntando a él) y fallaría
    // en bucle para siempre.
    expect(mockedBusinessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: businessId },
        data: { telnyxNumberOrderId: null },
      })
    );
  });

  it("libera el lock incluso si el provisioning falla", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      name: "Peluquería Test",
      phoneNumberStatus: "pending",
      telnyxPhoneNumber: null,
    } as any);

    mockedSearchAvailableNumbers.mockRejectedValue(new Error("Telnyx down"));

    await provisionPhoneNumber(businessId);

    // Un solo intento (presupuesto 0) con un TTL de 60 s: si otra ejecución
    // ya lo tiene, esta devuelve el estado y no espera.
    expect(mockedAcquireLock).toHaveBeenCalledWith(
      `phone_provision_lock:${businessId}`,
      60_000,
      0
    );
    expect(mockedReleaseLock).toHaveBeenCalledWith(
      `phone_provision_lock:${businessId}`,
      "token-del-cerrojo"
    );
  });
});

describe("getPhoneNumberStatus", () => {
  it("returns phone number info for a business, sourcing from Telnyx fields", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      id: businessId,
      telnyxPhoneNumber: "+34886020712",
      telnyxPhoneNumberId: "pn_123",
      telnyxPhoneNumberPurchasedAt: new Date("2024-01-01"),
      phoneNumberStatus: "active",
    } as any);

    const result = await getPhoneNumberStatus(businessId);

    expect(result).toEqual({
      phoneNumber: "+34886020712",
      sid: "pn_123",
      purchasedAt: expect.any(Date),
      status: "active",
    });
  });

  it("returns null when business is not found", async () => {
    mockedBusinessFindUnique.mockResolvedValue(null);

    const result = await getPhoneNumberStatus(businessId);

    expect(result).toBeNull();
  });
});

describe("asignarNumeroExistente", () => {
  const numero = {
    id: "3047548328515471109",
    phoneNumber: "+34930000009",
    status: "active",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELNYX_CALL_CONTROL_APP_ID = "cca_test";
    mockedAcquireLock.mockResolvedValue("token-del-cerrojo");
    mockedReleaseLock.mockResolvedValue(undefined);
    mockedBusinessFindUnique.mockResolvedValue({
      telnyxPhoneNumber: null,
      telnyxNumberOrderId: null,
      telnyxPendingPhoneNumber: null,
    } as never);
    vi.mocked(telnyxAdapter.getNumber).mockResolvedValue(numero);
    vi.mocked(prisma.business.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.whatsappSender.findFirst).mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env.TELNYX_CALL_CONTROL_APP_ID;
  });

  it("conecta el número, lo guarda, invalida la caché y resincroniza", async () => {
    const r = await asignarNumeroExistente(businessId, numero.id);

    expect(r).toEqual({ phoneNumber: numero.phoneNumber, anterior: null });
    expect(telnyxAiAdapter.setPhoneNumberConnectionId).toHaveBeenCalledWith(
      numero.id,
      "cca_test"
    );
    expect(mockedBusinessUpdate).toHaveBeenCalledWith({
      where: { id: businessId },
      data: expect.objectContaining({
        telnyxPhoneNumber: numero.phoneNumber,
        telnyxPhoneNumberId: numero.id,
        phoneNumberStatus: "active",
        telnyxPhoneNumberPurchasedAt: expect.any(Date),
      }),
    });
    expect(invalidarCacheDeVoz).toHaveBeenCalledWith(businessId, "[Phone]");
    expect(mockedSyncAgentToTelnyx).toHaveBeenCalledWith(businessId);
    expect(mockedReleaseLock).toHaveBeenCalledWith(
      `phone_provision_lock:${businessId}`,
      "token-del-cerrojo"
    );
  });

  it("no pisa un número que ya tiene sin «sustituir»", async () => {
    mockedBusinessFindUnique.mockResolvedValue({
      telnyxPhoneNumber: "+34930000001",
      telnyxNumberOrderId: null,
      telnyxPendingPhoneNumber: null,
    } as never);

    await expect(asignarNumeroExistente(businessId, numero.id)).rejects.toThrow(
      "ya tiene el número +34930000001"
    );
    expect(telnyxAiAdapter.setPhoneNumberConnectionId).not.toHaveBeenCalled();

    const r = await asignarNumeroExistente(businessId, numero.id, {
      sustituir: true,
    });
    expect(r.anterior).toBe("+34930000001");
  });

  it("rechaza un número de otro negocio o del WhatsApp de plataforma", async () => {
    vi.mocked(prisma.business.findFirst).mockResolvedValueOnce({
      id: "otro",
    } as never);
    await expect(asignarNumeroExistente(businessId, numero.id)).rejects.toThrow(
      "ya es del negocio otro"
    );

    vi.mocked(prisma.whatsappSender.findFirst).mockResolvedValueOnce({
      audience: "client",
    } as never);
    await expect(asignarNumeroExistente(businessId, numero.id)).rejects.toThrow(
      "WhatsApp de plataforma (client)"
    );
    expect(telnyxAiAdapter.setPhoneNumberConnectionId).not.toHaveBeenCalled();
    expect(mockedReleaseLock).toHaveBeenCalledTimes(2);
  });

  it("rechaza un número que no está o no está activo, y una compra a medias", async () => {
    vi.mocked(telnyxAdapter.getNumber).mockResolvedValueOnce(null);
    const noEsta = await asignarNumeroExistente(businessId, numero.id).catch(
      (e: ErrorDeAsignacion) => e
    );
    expect((noEsta as ErrorDeAsignacion).codigo).toBe(404);

    vi.mocked(telnyxAdapter.getNumber).mockResolvedValueOnce({
      ...numero,
      status: "port-pending",
    });
    await expect(asignarNumeroExistente(businessId, numero.id)).rejects.toThrow(
      "«port-pending»"
    );

    mockedBusinessFindUnique.mockResolvedValueOnce({
      telnyxPhoneNumber: null,
      telnyxNumberOrderId: "order_1",
      telnyxPendingPhoneNumber: null,
    } as never);
    await expect(asignarNumeroExistente(businessId, numero.id)).rejects.toThrow(
      "compra de número a medias"
    );
  });

  it("con otra compra en curso no hace nada", async () => {
    mockedAcquireLock.mockResolvedValueOnce(null);
    const error = await asignarNumeroExistente(businessId, numero.id).catch(
      (e: ErrorDeAsignacion) => e
    );
    expect((error as ErrorDeAsignacion).codigo).toBe(409);
    expect(mockedBusinessFindUnique).not.toHaveBeenCalled();
  });
});
