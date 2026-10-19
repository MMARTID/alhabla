import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { adquirirCerrojo, liberarCerrojo } from "../../src/lib/cerrojos.js";
import { prisma } from "../../src/lib/prisma.js";

vi.mock("../../src/lib/prisma.js", () => ({
  prisma: { $queryRaw: vi.fn(), $executeRaw: vi.fn() },
}));

const queryRaw = vi.mocked(prisma.$queryRaw);
const executeRaw = vi.mocked(prisma.$executeRaw);

/** SQL de una llamada a la plantilla etiquetada ($queryRaw`...`). */
function sqlDe(llamada: unknown[]): string {
  return (llamada[0] as TemplateStringsArray).join("?");
}

/** Las filas que devuelve el INSERT … RETURNING: con fila = adquirido en
 * Postgres; sin fila = otro lo tiene vivo. */
const libre = (token = "t") => [{ token }];
const ocupada: never[] = [];

describe("adquirirCerrojo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeRaw.mockResolvedValue(1 as never);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("adquiere a la primera con un INSERT … ON CONFLICT … WHERE caducado, con la clave, su token y el TTL", async () => {
    queryRaw.mockResolvedValueOnce(libre() as never);

    const resultado = await adquirirCerrojo(
      "booking_lock:biz_1",
      45_000,
      6_000
    );

    expect(resultado.estado).toBe("adquirido");
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const llamada = queryRaw.mock.calls[0];
    const sql = sqlDe(llamada);
    expect(sql).toContain('INSERT INTO "cerrojos"');
    expect(sql).toContain('ON CONFLICT ("clave") DO UPDATE');
    // Solo se pisa una fila caducada, y con now() de la BD.
    expect(sql).toMatch(/WHERE c\."expiraEn" <= now\(\)/);
    expect(llamada[1]).toBe("booking_lock:biz_1");
    expect(resultado.estado === "adquirido" && resultado.token).toBe(
      llamada[2]
    );
    expect(llamada[3]).toBe(45_000);
  });

  it("reintenta cada 300 ms mientras está ocupado y lo consigue cuando se libera", async () => {
    vi.useFakeTimers();
    queryRaw
      .mockResolvedValueOnce(ocupada as never)
      .mockResolvedValueOnce(ocupada as never)
      .mockResolvedValueOnce(libre() as never);

    const promesa = adquirirCerrojo("k", 45_000, 6_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(299);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(queryRaw).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(300);
    expect(queryRaw).toHaveBeenCalledTimes(3);

    expect((await promesa).estado).toBe("adquirido");
  });

  it("se rinde con «ocupado» al agotar el presupuesto (6 s / 300 ms ≈ 20 intentos)", async () => {
    vi.useFakeTimers();
    queryRaw.mockResolvedValue(ocupada as never);

    const promesa = adquirirCerrojo("k", 45_000, 6_000);
    await vi.runAllTimersAsync();

    expect(await promesa).toEqual({ estado: "ocupado" });
    expect(queryRaw.mock.calls.length).toBeGreaterThanOrEqual(15);
    expect(queryRaw.mock.calls.length).toBeLessThanOrEqual(25);
  });

  it("con presupuesto 0 hace exactamente un intento y no espera", async () => {
    vi.useFakeTimers();
    queryRaw.mockResolvedValue(ocupada as never);

    const resultado = await adquirirCerrojo("k", 60_000, 0);

    expect(resultado).toEqual({ estado: "ocupado" });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("un error de la BD da «error» con log y sin reintentar (falla cerrado)", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    queryRaw.mockRejectedValue(new Error("ECONNREFUSED"));

    const resultado = await adquirirCerrojo(
      "booking_lock:biz_1",
      45_000,
      6_000
    );

    expect(resultado).toEqual({ estado: "error", motivo: "ECONNREFUSED" });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(consola).toHaveBeenCalledWith(
      expect.stringContaining("[Cerrojo] No se pudo coger booking_lock:biz_1")
    );
    consola.mockRestore();
  });

  /** Un error de Prisma con su código (P1017, P2024…), como los lanza. */
  function errorDePrisma(code: string, mensaje: string) {
    return Object.assign(new Error(mensaje), { code });
  }

  it("una conexión del pool cerrada por el servidor (P1017) se reintenta dentro del presupuesto, con otro token", async () => {
    vi.useFakeTimers();
    queryRaw
      .mockRejectedValueOnce(
        errorDePrisma("P1017", "Server has closed the connection.")
      )
      .mockResolvedValueOnce(libre() as never);

    const promesa = adquirirCerrojo("booking_lock:biz_1", 45_000, 6_000);
    await vi.advanceTimersByTimeAsync(300);
    const resultado = await promesa;

    expect(resultado.estado).toBe("adquirido");
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(resultado.estado === "adquirido" && resultado.token).not.toBe(
      queryRaw.mock.calls[0][2]
    );
  });

  // Un P1017 puede llegar con el INSERT ya confirmado: la fila quedaría a
  // nombre de un token que nadie tiene y los reintentos darían «ocupado»
  // hasta que caducara.
  it("tras un P1017 borra la fila de ese token antes de reintentar (Postgres pudo confirmar el INSERT)", async () => {
    vi.useFakeTimers();
    queryRaw
      .mockRejectedValueOnce(
        errorDePrisma("P1017", "Server has closed the connection.")
      )
      .mockResolvedValueOnce(libre() as never);

    const promesa = adquirirCerrojo("booking_lock:biz_1", 45_000, 6_000);
    await vi.advanceTimersByTimeAsync(300);
    const resultado = await promesa;

    expect(resultado.estado).toBe("adquirido");
    const tokenViejo = queryRaw.mock.calls[0][2];
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(sqlDe(executeRaw.mock.calls[0])).toMatch(
      /DELETE FROM "cerrojos" WHERE "clave" = \? AND "token" = \?/
    );
    expect(executeRaw.mock.calls[0].slice(1)).toEqual([
      "booking_lock:biz_1",
      tokenViejo,
    ]);
    expect(executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      queryRaw.mock.invocationCallOrder[1]
    );
  });

  it("con presupuesto 0, un P1017 da «error» y antes borra la fila de ese token", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    queryRaw.mockRejectedValueOnce(
      errorDePrisma("P1017", "Server has closed the connection.")
    );

    const resultado = await adquirirCerrojo("k", 45_000, 0);

    expect(resultado.estado).toBe("error");
    expect(executeRaw.mock.calls[0].slice(1)).toEqual([
      "k",
      queryRaw.mock.calls[0][2],
    ]);
    vi.mocked(console.error).mockRestore();
  });

  it("si la fila de un intento incierto no se puede borrar, lo dice en el log y lo vuelve a intentar antes del intento siguiente", async () => {
    vi.useFakeTimers();
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    queryRaw
      .mockRejectedValueOnce(
        errorDePrisma("P1017", "Server has closed the connection.")
      )
      .mockResolvedValueOnce(ocupada as never)
      .mockResolvedValueOnce(libre() as never);
    executeRaw
      .mockRejectedValueOnce(new Error("Server has closed the connection."))
      .mockResolvedValueOnce(1 as never);

    const promesa = adquirirCerrojo("k", 45_000, 6_000);
    await vi.advanceTimersByTimeAsync(600);
    const resultado = await promesa;

    expect(resultado.estado).toBe("adquirido");
    const tokenViejo = queryRaw.mock.calls[0][2];
    expect(executeRaw.mock.calls.map((c) => c.slice(1))).toEqual([
      ["k", tokenViejo],
      ["k", tokenViejo],
    ]);
    expect(consola).toHaveBeenCalledWith(
      expect.stringContaining("No se pudo borrar la fila propia de k")
    );
    consola.mockRestore();
  });

  it("un error que no prueba que la sentencia no se ejecutó da «error» en el acto, y antes borra la fila de ese token", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    queryRaw.mockRejectedValueOnce(
      errorDePrisma("P2010", "Timed out during query execution")
    );

    const resultado = await adquirirCerrojo("k", 45_000, 6_000);

    expect(resultado.estado).toBe("error");
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw.mock.calls[0].slice(1)).toEqual([
      "k",
      queryRaw.mock.calls[0][2],
    ]);
    vi.mocked(console.error).mockRestore();
  });

  it("sin conexión con Postgres durante todo el presupuesto (P2024, pool lleno) ⇒ «error» al agotarlo, sin borrar nada", async () => {
    vi.useFakeTimers();
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    queryRaw.mockRejectedValue(
      errorDePrisma("P2024", "Timed out fetching a new connection")
    );

    const resultado = await adquirirCerrojo("k", 90_000, 0);

    expect(resultado.estado).toBe("error");
    expect(resultado.estado === "error" && resultado.motivo).toContain(
      "sin conexión con Postgres"
    );
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw).not.toHaveBeenCalled();
    expect(consola).toHaveBeenCalledWith(
      expect.stringContaining("falla cerrado")
    );
    consola.mockRestore();
  });

  it("un PrismaClientInitializationError sin código (no se pudo conectar) también se reintenta", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    queryRaw
      .mockRejectedValueOnce(
        Object.assign(new Error("Can't reach database server"), {
          name: "PrismaClientInitializationError",
        })
      )
      .mockResolvedValueOnce(libre() as never);

    const promesa = adquirirCerrojo("k", 45_000, 6_000);
    await vi.advanceTimersByTimeAsync(300);

    expect((await promesa).estado).toBe("adquirido");
    // No llegó a conectar: no hay fila que borrar.
    expect(executeRaw).not.toHaveBeenCalled();
    vi.mocked(console.error).mockRestore();
  });

  it("una respuesta que llega con medio TTL gastado no concede el cerrojo: borra la fila propia y acaba en «error»", async () => {
    vi.useFakeTimers();
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    queryRaw.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(libre() as never), 500)
        ) as never
    );

    const promesa = adquirirCerrojo("k", 1_000, 0);
    await vi.advanceTimersByTimeAsync(500);
    const resultado = await promesa;

    expect(resultado.estado).toBe("error");
    expect(resultado.estado === "error" && resultado.motivo).toContain(
      "tardó 500 ms en confirmar un arrendamiento de 1000 ms"
    );
    expect(executeRaw.mock.calls[0].slice(1)).toEqual([
      "k",
      queryRaw.mock.calls[0][2],
    ]);
    consola.mockRestore();
  });

  it("una respuesta por debajo de medio TTL sí lo concede", async () => {
    vi.useFakeTimers();
    queryRaw.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(libre() as never), 499)
        ) as never
    );

    const promesa = adquirirCerrojo("k", 1_000, 0);
    await vi.advanceTimersByTimeAsync(499);

    expect((await promesa).estado).toBe("adquirido");
    expect(executeRaw).not.toHaveBeenCalled();
  });

  // Con un TTL largo, medio TTL deja demasiado poco: una reserva (45 s, con
  // una sección de hasta ~32 s con Outlook) concedida a los 14 s tendría 31 s,
  // y otro llamador entraría con la primera aún dentro. Con el tope de 12 s le
  // quedan al menos 33 s.
  it.each([
    { ms: 12_000, concede: false },
    { ms: 11_999, concede: true },
  ])(
    "con un TTL de 45 s, una respuesta a los $ms ms lo concede: $concede (tope fijo de 12 s, por debajo de medio TTL)",
    async ({ ms, concede }) => {
      vi.useFakeTimers();
      const consola = vi.spyOn(console, "error").mockImplementation(() => {});
      queryRaw.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(libre() as never), ms)
          ) as never
      );

      const promesa = adquirirCerrojo("booking_lock:biz", 45_000, 0);
      await vi.advanceTimersByTimeAsync(ms);
      const resultado = await promesa;

      if (concede) {
        expect(resultado.estado).toBe("adquirido");
        expect(executeRaw).not.toHaveBeenCalled();
      } else {
        expect(resultado.estado).toBe("error");
        expect(resultado.estado === "error" && resultado.motivo).toContain(
          `tardó ${ms} ms en confirmar un arrendamiento de 45000 ms`
        );
        // La fila propia se borra: no se queda ocupada hasta que caduque.
        expect(executeRaw.mock.calls[0].slice(1)).toEqual([
          "booking_lock:biz",
          queryRaw.mock.calls[0][2],
        ]);
      }
      consola.mockRestore();
    }
  );

  it("dos adquisiciones dan tokens distintos (para no liberar el cerrojo de otro)", async () => {
    queryRaw.mockResolvedValue(libre() as never);

    const a = await adquirirCerrojo("k", 1_000, 0);
    const b = await adquirirCerrojo("k", 1_000, 0);

    expect(a.estado === "adquirido" && a.token).toBeTruthy();
    expect(a.estado === "adquirido" && a.token).not.toBe(
      b.estado === "adquirido" && b.token
    );
  });
});

describe("liberarCerrojo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("libera con compare-and-delete: borra la clave solo con el token propio", async () => {
    executeRaw.mockResolvedValue(1 as never);

    await liberarCerrojo("booking_lock:biz_1", "token-abc");

    const llamada = executeRaw.mock.calls[0];
    expect(sqlDe(llamada)).toMatch(
      /DELETE FROM "cerrojos" WHERE "clave" = \? AND "token" = \?/
    );
    expect(llamada.slice(1)).toEqual(["booking_lock:biz_1", "token-abc"]);
  });

  it("liberar nunca lanza: si la BD falla lo deja en el log (quedará ocupado hasta que caduque)", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    executeRaw.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(liberarCerrojo("k", "t")).resolves.toBeUndefined();
    expect(consola).toHaveBeenCalledWith(
      expect.stringContaining("quedará ocupado hasta que caduque")
    );
    consola.mockRestore();
  });
});
