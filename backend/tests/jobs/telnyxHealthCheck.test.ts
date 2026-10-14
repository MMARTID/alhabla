import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { telnyxHealthCheckJob } from "../../src/jobs/telnyxHealthCheck.js";
import { prisma } from "../../src/lib/prisma.js";
import {
  anotarLecturaDeSalud,
  reiniciarRachaBuena,
  tickDeLaLectura,
} from "../../src/lib/saludTelnyx.js";
import { acquireLock, releaseLock } from "../../src/lib/bookingLock.js";
import { checkTelnyxAiInfraStatus } from "../../src/lib/telnyxStatusPage.js";
import { telnyxAiAdapter } from "../../src/adapters/telnyx/TelnyxAiAdapter.js";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: {
    business: { findMany: vi.fn(), update: vi.fn() },
  },
}));

// Las rachas (con su SQL de un tick = una lectura) tienen su test de
// integración en tests/integration/lib/saludTelnyx.test.ts; aquí se mira qué
// hace el job con ellas. tickDeLaLectura es el real.
vi.mock("../../src/lib/saludTelnyx.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/saludTelnyx.js")>()),
  anotarLecturaDeSalud: vi.fn(),
  reiniciarRachaBuena: vi.fn(),
}));

vi.mock("../../src/lib/bookingLock.js", () => ({
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
}));

vi.mock("../../src/lib/telnyxStatusPage.js", () => ({
  checkTelnyxAiInfraStatus: vi.fn(),
}));

vi.mock("../../src/adapters/telnyx/TelnyxAiAdapter.js", () => ({
  telnyxAiAdapter: { setPhoneNumberConnectionId: vi.fn() },
}));

const mockedBusinessFindMany = vi.mocked(prisma.business.findMany);
const mockedBusinessUpdate = vi.mocked(prisma.business.update);
const mockedAnotar = vi.mocked(anotarLecturaDeSalud);
const mockedReiniciarBuena = vi.mocked(reiniciarRachaBuena);
const mockedAcquireLock = vi.mocked(acquireLock);
const mockedReleaseLock = vi.mocked(releaseLock);
const mockedCheckStatus = vi.mocked(checkTelnyxAiInfraStatus);
const mockedSetConnectionId = vi.mocked(telnyxAiAdapter.setPhoneNumberConnectionId);


const ORIGINAL_ENV = {
  VOICE_FAILOVER_ENABLED: process.env.VOICE_FAILOVER_ENABLED,
  TELNYX_CALL_CONTROL_APP_ID: process.env.TELNYX_CALL_CONTROL_APP_ID,
  TELNYX_SIP_CONNECTION_ID: process.env.TELNYX_SIP_CONNECTION_ID,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedReiniciarBuena.mockResolvedValue(undefined);
  mockedAcquireLock.mockResolvedValue("lock-token");
  process.env.VOICE_FAILOVER_ENABLED = "true";
  process.env.TELNYX_CALL_CONTROL_APP_ID = "cca_platform_1";
  process.env.TELNYX_SIP_CONNECTION_ID = "conn_retell_1";
});

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("telnyxHealthCheckJob", () => {
  it("no hace nada si VOICE_FAILOVER_ENABLED no está activo (kill switch)", async () => {
    delete process.env.VOICE_FAILOVER_ENABLED;

    await telnyxHealthCheckJob();

    expect(mockedCheckStatus).not.toHaveBeenCalled();
  });

  it("no hace nada si TELNYX_STATUS_COMPONENT_IDS no está configurado", async () => {
    mockedCheckStatus.mockResolvedValue({
      healthy: false,
      unconfigured: true,
      components: [],
    });

    await telnyxHealthCheckJob();

    expect(mockedAnotar).not.toHaveBeenCalled();
    expect(mockedBusinessFindMany).not.toHaveBeenCalled();
  });

  it("avisa de que falta TELNYX_STATUS_COMPONENT_IDS una sola vez por instancia, no cada 2 minutos", async () => {
    // Módulo fresco: el aviso se recuerda en una variable del módulo.
    vi.resetModules();
    const { telnyxHealthCheckJob: jobFresco } = await import(
      "../../src/jobs/telnyxHealthCheck.js"
    );
    const { checkTelnyxAiInfraStatus: statusFresco } = await import(
      "../../src/lib/telnyxStatusPage.js"
    );
    vi.mocked(statusFresco).mockResolvedValue({
      healthy: false,
      unconfigured: true,
      components: [],
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await jobFresco();
    await jobFresco();
    await jobFresco();

    const avisos = warn.mock.calls.filter(([m]) =>
      String(m).includes("TELNYX_STATUS_COMPONENT_IDS")
    );
    expect(avisos).toHaveLength(1);
    warn.mockRestore();
  });

  it("no lanza y no evalúa nada si falla la consulta del status page", async () => {
    mockedCheckStatus.mockRejectedValue(new Error("network down"));

    await expect(telnyxHealthCheckJob()).resolves.toBeUndefined();
    expect(mockedAnotar).not.toHaveBeenCalled();
  });

  it("con lectura sana la anota con el tick de la hora programada del Scheduler, sin llegar al umbral de failback", async () => {
    mockedCheckStatus.mockResolvedValue({
      healthy: true,
      unconfigured: false,
      components: [],
    });
    mockedAnotar.mockResolvedValue({ malas: 0, buenas: 3 });

    await telnyxHealthCheckJob({ horaProgramada: "2026-10-14T10:02:00Z" });

    expect(mockedAnotar).toHaveBeenCalledWith(
      true,
      BigInt(Date.parse("2026-10-14T10:02:00Z") / 1000)
    );
    expect(mockedBusinessFindMany).not.toHaveBeenCalled();
  });

  it("una entrega repetida del mismo tick no hace nada aunque la racha mala ya esté en el umbral", async () => {
    mockedCheckStatus.mockResolvedValue({
      healthy: false,
      unconfigured: false,
      components: [],
    });
    mockedAnotar.mockResolvedValue(null);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await telnyxHealthCheckJob({ horaProgramada: "2026-10-14T10:02:00Z" });

    expect(mockedBusinessFindMany).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("ya contada"));
    log.mockRestore();
  });

  it("activa el failover a Retell tras 2 lecturas malas consecutivas", async () => {
    mockedCheckStatus.mockResolvedValue({
      healthy: false,
      unconfigured: false,
      components: [{ id: "comp_1", name: "AI", status: "major_outage" }],
    });
    mockedAnotar.mockResolvedValue({ malas: 2, buenas: 0 });
    mockedBusinessFindMany.mockResolvedValue([
      { id: "biz1", telnyxPhoneNumberId: "pn_1" },
    ] as any);
    mockedBusinessUpdate.mockResolvedValue({} as any);

    await telnyxHealthCheckJob();

    expect(mockedBusinessFindMany).toHaveBeenCalledWith({
      where: {
        orchestrator: "telnyx",
        voiceRoutingTarget: "telnyx",
        telnyxPhoneNumberId: { not: null },
      },
      select: { id: true, telnyxPhoneNumberId: true },
    });
    expect(mockedSetConnectionId).toHaveBeenCalledWith("pn_1", "conn_retell_1");
    expect(mockedBusinessUpdate).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: expect.objectContaining({
        voiceRoutingTarget: "retell",
        voiceFailoverActive: true,
      }),
    });
    expect(mockedReleaseLock).toHaveBeenCalledWith(
      "phone_provision_lock:biz1",
      "lock-token"
    );
  });

  it("no activa el failover con solo 1 lectura mala (por debajo del umbral)", async () => {
    mockedCheckStatus.mockResolvedValue({
      healthy: false,
      unconfigured: false,
      components: [],
    });
    mockedAnotar.mockResolvedValue({ malas: 1, buenas: 0 });

    await telnyxHealthCheckJob();

    expect(mockedBusinessFindMany).not.toHaveBeenCalled();
  });

  it("hace failback a Telnyx tras 5 lecturas buenas consecutivas", async () => {
    mockedCheckStatus.mockResolvedValue({
      healthy: true,
      unconfigured: false,
      components: [],
    });
    mockedAnotar.mockResolvedValue({ malas: 0, buenas: 5 });
    mockedBusinessFindMany.mockResolvedValue([
      { id: "biz1", telnyxPhoneNumberId: "pn_1" },
    ] as any);
    mockedBusinessUpdate.mockResolvedValue({} as any);

    await telnyxHealthCheckJob();

    expect(mockedSetConnectionId).toHaveBeenCalledWith("pn_1", "cca_platform_1");
    expect(mockedBusinessUpdate).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: expect.objectContaining({
        voiceRoutingTarget: "telnyx",
        voiceFailoverActive: false,
        voiceFailoverReason: null,
      }),
    });
    // Tras el failback la racha buena vuelve a cero: el tick siguiente no
    // lo repite.
    expect(mockedReiniciarBuena).toHaveBeenCalledTimes(1);
  });

  it("no cambia ningún negocio si no hay ninguno en orchestrator=telnyx", async () => {
    mockedCheckStatus.mockResolvedValue({
      healthy: false,
      unconfigured: false,
      components: [],
    });
    mockedAnotar.mockResolvedValue({ malas: 2, buenas: 0 });
    mockedBusinessFindMany.mockResolvedValue([]);

    await telnyxHealthCheckJob();

    expect(mockedAcquireLock).not.toHaveBeenCalled();
    expect(mockedSetConnectionId).not.toHaveBeenCalled();
  });

  it("salta un negocio sin bloquearlo y sigue sin lanzar si no consigue el lock", async () => {
    mockedCheckStatus.mockResolvedValue({
      healthy: false,
      unconfigured: false,
      components: [],
    });
    mockedAnotar.mockResolvedValue({ malas: 2, buenas: 0 });
    mockedBusinessFindMany.mockResolvedValue([
      { id: "biz1", telnyxPhoneNumberId: "pn_1" },
    ] as any);
    mockedAcquireLock.mockResolvedValue(null);

    await expect(telnyxHealthCheckJob()).resolves.toBeUndefined();

    expect(mockedSetConnectionId).not.toHaveBeenCalled();
  });

  it("no cambia ningún negocio si falta la variable de entorno del connection_id de destino", async () => {
    delete process.env.TELNYX_SIP_CONNECTION_ID;
    mockedCheckStatus.mockResolvedValue({
      healthy: false,
      unconfigured: false,
      components: [],
    });
    mockedAnotar.mockResolvedValue({ malas: 2, buenas: 0 });
    mockedBusinessFindMany.mockResolvedValue([
      { id: "biz1", telnyxPhoneNumberId: "pn_1" },
    ] as any);

    await telnyxHealthCheckJob();

    expect(mockedAcquireLock).not.toHaveBeenCalled();
    expect(mockedSetConnectionId).not.toHaveBeenCalled();
  });
});

describe("tickDeLaLectura", () => {
  it("usa la hora programada del Scheduler (segundos) y, sin ella, el tramo de 2 minutos", () => {
    expect(tickDeLaLectura("2026-10-14T10:02:00Z")).toBe(
      BigInt(Date.parse("2026-10-14T10:02:00Z") / 1000)
    );
    const ahora = Date.parse("2026-10-14T10:03:59.900Z");
    expect(tickDeLaLectura(undefined, ahora)).toBe(
      BigInt(Date.parse("2026-10-14T10:02:00Z") / 1000)
    );
    expect(tickDeLaLectura("no es una fecha", ahora)).toBe(
      BigInt(Date.parse("2026-10-14T10:02:00Z") / 1000)
    );
  });
});
