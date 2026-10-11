import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Cliente ioredis falso: guarda las opciones con que se crea y deja decidir
// a cada test el estado y las respuestas.
const { creados, ajustes, FalsoRedis } = await vi.hoisted(async () => {
  const creados: Array<{
    url: string;
    opciones: Record<string, unknown>;
    cliente: InstanceType<typeof FalsoRedis>;
  }> = [];
  /** Si es false, el próximo cliente no llega nunca a «ready». */
  const ajustes = { conectaSolo: true };
  const { EventEmitter: Emisor } = await import("node:events");
  class FalsoRedis extends Emisor {
    status = "wait";
    conectaSolo = ajustes.conectaSolo;
    set = vi.fn();
    eval = vi.fn().mockResolvedValue(1);
    quit = vi.fn().mockResolvedValue("OK");
    disconnect = vi.fn();
    connect = vi.fn(async () => {
      if (!this.conectaSolo) {
        this.status = "connecting";
        return;
      }
      this.status = "ready";
      this.emit("ready");
    });
    constructor(url: string, opciones: Record<string, unknown>) {
      super();
      creados.push({ url, opciones, cliente: this });
    }
  }
  return { creados, ajustes, FalsoRedis };
});

vi.mock("ioredis", () => ({ default: FalsoRedis }));

import {
  cerrarRedisDeCompatibilidad,
  cerrojoEnRedisAntiguo,
  compatibilidadActiva,
  conectarRedisDeCompatibilidad,
  redisDeCompatibilidadListo,
  reiniciarFrenoDeLogsParaTests,
  soltarEnRedisAntiguo,
  sueltasAplazadasParaTests,
} from "../../src/lib/redisDeCompatibilidad.js";

const URL_ORIGINAL = process.env.REDIS_URL;

function ultimoCliente() {
  const ultimo = creados.at(-1);
  if (!ultimo) throw new Error("no se creó ningún cliente");
  return ultimo.cliente;
}

/** El cliente vuelve a conectar (ioredis emite «ready»). */
async function reconectar(cliente: ReturnType<typeof ultimoCliente>) {
  cliente.status = "ready";
  cliente.emit("ready");
  await new Promise((r) => setImmediate(r));
}

/** Un error como los de Redis cuando contesta con error (ReplyError). */
function errorDeRedis(mensaje: string): Error {
  const err = new Error(mensaje);
  err.name = "ReplyError";
  return err;
}

describe("redisDeCompatibilidad", () => {
  beforeEach(() => {
    creados.length = 0;
    ajustes.conectaSolo = true;
    reiniciarFrenoDeLogsParaTests();
    process.env.REDIS_URL = "redis://localhost:6379/1";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(async () => {
    await cerrarRedisDeCompatibilidad();
    vi.restoreAllMocks();
    vi.useRealTimers();
    if (URL_ORIGINAL === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = URL_ORIGINAL;
  });

  it("sin conectar, la compatibilidad está inactiva (los tests unitarios nunca la activan)", () => {
    expect(compatibilidadActiva()).toBe(false);
  });

  it("sin REDIS_URL no crea cliente y la compatibilidad sigue inactiva", async () => {
    delete process.env.REDIS_URL;

    await conectarRedisDeCompatibilidad();

    expect(creados).toHaveLength(0);
    expect(compatibilidadActiva()).toBe(false);
  });

  it("crea un cliente propio que no deja comandos en cola ni colgados", async () => {
    await conectarRedisDeCompatibilidad();

    expect(creados).toHaveLength(1);
    expect(creados[0].url).toBe("redis://localhost:6379/1");
    expect(creados[0].opciones).toMatchObject({
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      commandTimeout: 1000,
    });
    expect(compatibilidadActiva()).toBe(true);
  });

  it("si Redis no está listo en el plazo, sigue arrancando, la compatibilidad queda activa y el cerrojo falla cerrado sin enviar nada", async () => {
    vi.useFakeTimers();
    ajustes.conectaSolo = false;
    const promesa = conectarRedisDeCompatibilidad(3000);
    await vi.advanceTimersByTimeAsync(3000);
    await promesa;

    expect(compatibilidadActiva()).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("no estuvo listo en 3000 ms")
    );
    await expect(cerrojoEnRedisAntiguo("k", "t", 45_000)).resolves.toBe(
      "sin_conexion"
    );
    expect(ultimoCliente().set).not.toHaveBeenCalled();
  });

  it("con un estado distinto de ready devuelve «sin_conexion» sin enviar el SET", async () => {
    await conectarRedisDeCompatibilidad();
    const cliente = ultimoCliente();
    cliente.status = "reconnecting";

    await expect(cerrojoEnRedisAntiguo("k", "t", 45_000)).resolves.toBe(
      "sin_conexion"
    );
    expect(cliente.set).not.toHaveBeenCalled();
  });

  it("SET NX PX: OK ⇒ adquirido; null ⇒ ocupado", async () => {
    await conectarRedisDeCompatibilidad();
    const cliente = ultimoCliente();
    cliente.set.mockResolvedValueOnce("OK").mockResolvedValueOnce(null);

    await expect(
      cerrojoEnRedisAntiguo("booking_lock:biz_1", "tok", 45_000)
    ).resolves.toBe("adquirido");
    await expect(
      cerrojoEnRedisAntiguo("booking_lock:biz_1", "tok2", 45_000)
    ).resolves.toBe("ocupado");
    // El mismo comando que usaban las revisiones viejas.
    expect(cliente.set).toHaveBeenCalledWith(
      "booking_lock:biz_1",
      "tok",
      "PX",
      45_000,
      "NX"
    );
  });

  it("plazo vencido ⇒ «incierto» y un compare-and-delete compensatorio con el mismo token", async () => {
    await conectarRedisDeCompatibilidad();
    const cliente = ultimoCliente();
    cliente.set.mockRejectedValueOnce(new Error("Command timed out"));

    await expect(cerrojoEnRedisAntiguo("k", "tok", 45_000)).resolves.toBe(
      "incierto"
    );
    expect(cliente.eval).toHaveBeenCalledTimes(1);
    const [script, numClaves, clave, token] = cliente.eval.mock.calls[0];
    expect(script).toContain('redis.call("GET", KEYS[1]) == ARGV[1]');
    expect(script).toContain('redis.call("DEL", KEYS[1])');
    expect([numClaves, clave, token]).toEqual([1, "k", "tok"]);
  });

  it("si ioredis rechaza el SET sin enviarlo ⇒ «sin_conexion», sin compensación", async () => {
    await conectarRedisDeCompatibilidad();
    const cliente = ultimoCliente();
    cliente.set.mockRejectedValueOnce(
      new Error(
        "Stream isn't writeable and enableOfflineQueue options is false"
      )
    );

    await expect(cerrojoEnRedisAntiguo("k", "tok", 45_000)).resolves.toBe(
      "sin_conexion"
    );
    expect(cliente.eval).not.toHaveBeenCalled();
  });

  it("si la conexión cae con el SET ya enviado ⇒ «incierto», y el compare-and-delete sale al reconectar", async () => {
    await conectarRedisDeCompatibilidad();
    const cliente = ultimoCliente();
    cliente.set.mockImplementationOnce(async () => {
      cliente.status = "reconnecting";
      throw new Error(
        'Reached the max retries per request limit (which is 0). Refer to "maxRetriesPerRequest" option for details.'
      );
    });

    await expect(cerrojoEnRedisAntiguo("k", "tok", 45_000)).resolves.toBe(
      "incierto"
    );
    await new Promise((r) => setImmediate(r));
    // Sin conexión no se envía; queda para el próximo «ready».
    expect(cliente.eval).not.toHaveBeenCalled();
    expect(sueltasAplazadasParaTests()).toBe(1);

    await reconectar(cliente);
    expect(cliente.eval).toHaveBeenCalledTimes(1);
    expect(cliente.eval.mock.calls[0].slice(1)).toEqual([1, "k", "tok"]);
    expect(sueltasAplazadasParaTests()).toBe(0);
  });

  it("soltar usa el token y nunca lanza", async () => {
    await conectarRedisDeCompatibilidad();
    const cliente = ultimoCliente();
    cliente.eval.mockRejectedValue(new Error("ECONNRESET"));

    await expect(soltarEnRedisAntiguo("k", "tok")).resolves.toBeUndefined();

    expect(cliente.eval.mock.calls[0].slice(1)).toEqual([1, "k", "tok"]);
  });

  it("soltar con el cliente reconectando no envía nada y lo reenvía en cuanto vuelve «ready»", async () => {
    await conectarRedisDeCompatibilidad();
    const cliente = ultimoCliente();
    cliente.status = "reconnecting";

    await soltarEnRedisAntiguo("booking_lock:biz_1", "tok");
    expect(cliente.eval).not.toHaveBeenCalled();
    expect(redisDeCompatibilidadListo()).toBe(false);

    await reconectar(cliente);
    expect(redisDeCompatibilidadListo()).toBe(true);
    expect(cliente.eval).toHaveBeenCalledTimes(1);
    const [script, numClaves, clave, token] = cliente.eval.mock.calls[0];
    expect(script).toContain('redis.call("DEL", KEYS[1])');
    expect([numClaves, clave, token]).toEqual([1, "booking_lock:biz_1", "tok"]);
  });

  it("un EVAL de soltar que falla por la conexión se reenvía al reconectar (hasta 5 veces); uno que Redis rechaza, no", async () => {
    await conectarRedisDeCompatibilidad();
    const cliente = ultimoCliente();
    cliente.eval.mockRejectedValue(new Error("Connection is closed."));

    await soltarEnRedisAntiguo("k", "tok");
    expect(sueltasAplazadasParaTests()).toBe(1);
    for (let i = 0; i < 6; i += 1) await reconectar(cliente);
    // El primero más cuatro reenvíos: al quinto fallo se deja caducar.
    expect(cliente.eval).toHaveBeenCalledTimes(5);
    expect(sueltasAplazadasParaTests()).toBe(0);

    cliente.eval.mockReset();
    cliente.eval.mockRejectedValueOnce(errorDeRedis("ERR algo"));
    await soltarEnRedisAntiguo("k", "tok2");
    expect(sueltasAplazadasParaTests()).toBe(0);
  });

  // Con la conexión medio abierta el cliente sigue en «ready» y cada comando
  // vence su plazo sin que ioredis reconecte: los cerrojos fallarían cerrados
  // hasta que el sistema diera el socket por muerto (unos 15 min).
  it("un compare-and-delete que vence su plazo fuerza la reconexión y queda para el próximo «ready»", async () => {
    await conectarRedisDeCompatibilidad();
    const cliente = ultimoCliente();
    cliente.eval.mockRejectedValueOnce(new Error("Command timed out"));

    await soltarEnRedisAntiguo("k", "tok");

    expect(cliente.disconnect).toHaveBeenCalledWith(true);
    expect(sueltasAplazadasParaTests()).toBe(1);
    await reconectar(cliente);
    expect(cliente.eval).toHaveBeenCalledTimes(2);
    expect(cliente.eval.mock.calls[1].slice(1)).toEqual([1, "k", "tok"]);
    expect(sueltasAplazadasParaTests()).toBe(0);
  });

  it("un SET que vence su plazo no fuerza la reconexión: su compare-and-delete sale detrás por la misma conexión", async () => {
    await conectarRedisDeCompatibilidad();
    const cliente = ultimoCliente();
    cliente.set.mockRejectedValueOnce(new Error("Command timed out"));

    await expect(cerrojoEnRedisAntiguo("k", "tok", 45_000)).resolves.toBe(
      "incierto"
    );
    await new Promise((r) => setImmediate(r));

    expect(cliente.eval).toHaveBeenCalledTimes(1);
    expect(cliente.disconnect).not.toHaveBeenCalled();
  });

  it("cerrar olvida los compare-and-delete pendientes de reenviar", async () => {
    await conectarRedisDeCompatibilidad();
    ultimoCliente().status = "reconnecting";
    await soltarEnRedisAntiguo("k", "tok");
    expect(sueltasAplazadasParaTests()).toBe(1);

    await cerrarRedisDeCompatibilidad();

    expect(sueltasAplazadasParaTests()).toBe(0);
  });

  it("los avisos van con freno: uno por minuto y operación", async () => {
    await conectarRedisDeCompatibilidad();
    const cliente = ultimoCliente();
    cliente.status = "end";
    vi.mocked(console.error).mockClear();

    for (let i = 0; i < 5; i += 1) {
      await cerrojoEnRedisAntiguo(`k${i}`, "t", 1000);
    }

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[Compat Redis\] cerrojo k0: /)
    );
  });

  it("cerrar vuelve a «solo Postgres»", async () => {
    await conectarRedisDeCompatibilidad();
    const cliente = ultimoCliente();

    await cerrarRedisDeCompatibilidad();

    expect(compatibilidadActiva()).toBe(false);
    expect(cliente.quit).toHaveBeenCalled();
  });

  it("es idempotente: conectar dos veces no crea dos clientes", async () => {
    await conectarRedisDeCompatibilidad();
    await conectarRedisDeCompatibilidad();

    expect(creados).toHaveLength(1);
  });
});
