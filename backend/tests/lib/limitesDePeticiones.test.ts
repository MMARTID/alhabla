import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AlmacenDeLimites,
  cerrarConexionDelLimitador,
  consultasDeLimitesEnVueloParaTests,
  cuentasLocalesParaTests,
  reiniciarEstadoDeLimitesParaTests,
} from "../../src/lib/limitesDePeticiones.js";
import {
  incrementarContadores,
  type Incremento,
} from "../../src/lib/almacenTemporal.js";
import { crearClienteDeUnaConexion } from "../../src/lib/prisma.js";

vi.mock("../../src/lib/almacenTemporal.js", () => ({
  incrementarContadores: vi.fn(),
}));

// El cliente con la conexión propia del limitador: lo que importa es que
// cada sentencia salga por él y no por el pool de `prisma`.
const { conexionPropia } = vi.hoisted(() => ({
  conexionPropia: { $disconnect: async () => {} },
}));
vi.mock("../../src/lib/prisma.js", () => ({
  crearClienteDeUnaConexion: vi.fn(() => conexionPropia),
}));

const incrementar = vi.mocked(incrementarContadores);

/** Lo que da Prisma cuando no puede conectar (P1001): la sentencia no
 * llegó a Postgres. */
function sinConexion(): Error {
  return Object.assign(new Error("ECONNREFUSED"), { code: "P1001" });
}

/** Lo que da Prisma si la conexión se cierra con la sentencia ya enviada
 * (P1017): Postgres puede haberla ejecutado y confirmado. */
function conexionCerrada(): Error {
  return Object.assign(new Error("Server has closed the connection."), {
    code: "P1017",
  });
}

type Resultado = { current: number; ttl: number };
type Fila = { valor: number; ttlMs: number };

/** Lanza un `incr` y recoge cada vez que se llama a su callback. */
function pedir(
  almacen: AlmacenDeLimites,
  clave: string,
  ventanaMs: number,
  max: number
) {
  const llamadas: Array<{ error: Error | null; resultado?: Resultado }> = [];
  almacen.incr(
    clave,
    (error, resultado) => llamadas.push({ error, resultado }),
    ventanaMs,
    max
  );
  return llamadas;
}

/** Una promesa que el test resuelve o rechaza cuando quiere. */
function diferida<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

function hijoDe(almacen: AlmacenDeLimites, method: string, url: string) {
  return almacen.child({
    routeInfo: { method, url },
  } as never) as AlmacenDeLimites;
}

/** La respuesta de Postgres a una sentencia. */
function filas(entradas: Record<string, Fila>): Map<string, Fila> {
  return new Map(Object.entries(entradas));
}

/** Lo que mandó cada sentencia: clave → cantidad. */
function lotes(): Array<Record<string, number>> {
  return incrementar.mock.calls.map((c) =>
    Object.fromEntries((c[0] as Incremento[]).map((i) => [i.clave, i.cantidad]))
  );
}

/**
 * Modelo en memoria de la sentencia de incrementarContadores, con el reloj
 * falso como now() de la BD (la sentencia real la prueban los tests de
 * integración de contadores).
 */
function postgresSimulado() {
  const tabla = new Map<string, { valor: number; expira: number }>();
  return (incrementos: readonly Incremento[]) => {
    const ahora = Date.now();
    const salida = new Map<string, Fila>();
    for (const { clave, ventanaMs, cantidad } of incrementos) {
      const fila = tabla.get(clave);
      const nueva =
        fila && fila.expira > ahora
          ? { valor: fila.valor + cantidad, expira: fila.expira }
          : { valor: cantidad, expira: ahora + ventanaMs };
      tabla.set(clave, nueva);
      salida.set(clave, {
        valor: nueva.valor,
        ttlMs: Math.max(0, nueva.expira - ahora),
      });
    }
    return salida;
  };
}

describe("AlmacenDeLimites (síncrono en Postgres, por lotes)", () => {
  let avisos: ReturnType<typeof vi.spyOn>;
  let errores: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    incrementar.mockReset();
    vi.useFakeTimers();
    reiniciarEstadoDeLimitesParaTests();
    avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
    errores = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("cuenta en Postgres con la clave ratelimit:<ip> y responde con el valor global y su ttl", async () => {
    incrementar.mockResolvedValueOnce(
      filas({ "ratelimit:10.0.0.1": { valor: 7, ttlMs: 41_000 } })
    );
    const almacen = new AlmacenDeLimites();

    const llamadas = pedir(almacen, "10.0.0.1", 60_000, 100);
    expect(llamadas).toHaveLength(0); // espera a la BD: es síncrono
    await vi.advanceTimersByTimeAsync(0);

    expect(incrementar).toHaveBeenCalledWith(
      [{ clave: "ratelimit:10.0.0.1", ventanaMs: 60_000, cantidad: 1 }],
      conexionPropia
    );
    expect(llamadas).toEqual([
      { error: null, resultado: { current: 7, ttl: 41_000 } },
    ]);
  });

  it("con una sentencia en vuelo, lo que llega (otras claves y rutas) espera y sale en UNA sola sentencia; cada petición decide con el global (D2)", async () => {
    const bd = diferida<Map<string, Fila>>();
    incrementar.mockReturnValueOnce(bd.promesa).mockResolvedValueOnce(
      filas({
        "ratelimit:ip-b": { valor: 40, ttlMs: 50_000 },
        "ratelimit:POST/auth/login-ip-c": { valor: 2, ttlMs: 59_000 },
      })
    );
    const almacen = new AlmacenDeLimites();
    const login = hijoDe(almacen, "POST", "/auth/login");

    const a = pedir(almacen, "ip-a", 60_000, 100);
    const b = pedir(almacen, "ip-b", 60_000, 100);
    const c = [
      pedir(login, "ip-c", 60_000, 10),
      pedir(login, "ip-c", 60_000, 10),
    ];
    // Ninguna se decide en local: esperan a Postgres.
    expect([a, b, ...c].every((r) => r.length === 0)).toBe(true);
    expect(incrementar).toHaveBeenCalledTimes(1);
    expect(consultasDeLimitesEnVueloParaTests()).toBe(1);

    bd.resolver(filas({ "ratelimit:ip-a": { valor: 1, ttlMs: 60_000 } }));
    await vi.advanceTimersByTimeAsync(0);

    expect(lotes()).toEqual([
      { "ratelimit:ip-a": 1 },
      { "ratelimit:ip-b": 1, "ratelimit:POST/auth/login-ip-c": 2 },
    ]);
    expect(a[0].resultado).toEqual({ current: 1, ttl: 60_000 });
    expect(b[0].resultado).toEqual({ current: 40, ttl: 50_000 });
    // Las dos de ip-c, con su posición: 2 - 2 + 1 y 2 - 2 + 2.
    expect(c.map((r) => r[0].resultado?.current)).toEqual([1, 2]);
    expect(consultasDeLimitesEnVueloParaTests()).toBe(0);
    expect(avisos).not.toHaveBeenCalled();
  });

  it("una ráfaga de la misma clave recibe posiciones consecutivas del global, como con INCR", async () => {
    const bd = diferida<Map<string, Fila>>();
    incrementar
      .mockReturnValueOnce(bd.promesa)
      .mockResolvedValueOnce(
        filas({ "ratelimit:ip": { valor: 7, ttlMs: 59_000 } })
      );
    const almacen = new AlmacenDeLimites();

    const rafaga = Array.from({ length: 5 }, () =>
      pedir(almacen, "ip", 60_000, 5)
    );
    // Otras instancias ya llevaban 2 en esta ventana.
    bd.resolver(filas({ "ratelimit:ip": { valor: 3, ttlMs: 60_000 } }));
    await vi.advanceTimersByTimeAsync(0);

    expect(lotes()).toEqual([{ "ratelimit:ip": 1 }, { "ratelimit:ip": 4 }]);
    expect(rafaga.map((r) => r[0].resultado?.current)).toEqual([3, 4, 5, 6, 7]);
  });

  it("con current > max fija un bloqueo local hasta el ttl de la BD y no vuelve a consultarla hasta entonces", async () => {
    incrementar.mockResolvedValue(
      filas({ "ratelimit:ip": { valor: 101, ttlMs: 30_000 } })
    );
    const almacen = new AlmacenDeLimites();

    pedir(almacen, "ip", 60_000, 100);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10_000);
    const bloqueada = pedir(almacen, "ip", 60_000, 100);
    expect(bloqueada).toHaveLength(1); // sin esperar a nada
    expect(bloqueada[0].resultado?.current).toBe(101);
    expect(bloqueada[0].resultado?.ttl).toBe(20_000);
    expect(incrementar).toHaveBeenCalledTimes(1);

    // Pasado el ttl vuelve a contar en la BD; las bloqueadas no se suman.
    await vi.advanceTimersByTimeAsync(20_001);
    incrementar.mockResolvedValueOnce(
      filas({ "ratelimit:ip": { valor: 1, ttlMs: 60_000 } })
    );
    pedir(almacen, "ip", 60_000, 100);
    expect(lotes()[1]).toEqual({ "ratelimit:ip": 1 });
  });

  it("si la sentencia en vuelo deja la clave bloqueada, las suyas que esperaban responden «pasado» sin mandarse; las de otras claves sí salen", async () => {
    const bd = diferida<Map<string, Fila>>();
    incrementar
      .mockReturnValueOnce(bd.promesa)
      .mockResolvedValueOnce(
        filas({ "ratelimit:otra": { valor: 1, ttlMs: 60_000 } })
      );
    const almacen = new AlmacenDeLimites();

    pedir(almacen, "ip", 60_000, 5);
    const detras = [
      pedir(almacen, "ip", 60_000, 5),
      pedir(almacen, "ip", 60_000, 5),
    ];
    const otra = pedir(almacen, "otra", 60_000, 5);
    bd.resolver(filas({ "ratelimit:ip": { valor: 9, ttlMs: 20_000 } }));
    await vi.advanceTimersByTimeAsync(0);

    expect(detras.map((d) => d[0].resultado)).toEqual([
      { current: 6, ttl: 20_000 },
      { current: 6, ttl: 20_000 },
    ]);
    expect(lotes()).toEqual([{ "ratelimit:ip": 1 }, { "ratelimit:otra": 1 }]);
    expect(otra[0].resultado?.current).toBe(1);
  });

  it("a ritmo sostenido, con la BD a 2 ms y una petición cada 1,5 ms, TODAS se deciden con Postgres y nunca hay más de una sentencia en vuelo", async () => {
    const postgres = postgresSimulado();
    let enVuelo = 0;
    let maxEnVuelo = 0;
    incrementar.mockImplementation(async (incrementos) => {
      enVuelo += 1;
      maxEnVuelo = Math.max(maxEnVuelo, enVuelo);
      await new Promise((r) => setTimeout(r, 2));
      enVuelo -= 1;
      return postgres(incrementos);
    });
    const almacen = new AlmacenDeLimites();

    // 1 000 peticiones de 50 IPs, 20 por IP: con max 100 pasan todas, y
    // cada una tiene que recibir exactamente su posición en el global.
    const respuestas: Array<{ ip: string; current: number }> = [];
    for (let i = 0; i < 1_000; i += 1) {
      const ip = `10.1.${i % 50}`;
      setTimeout(() => {
        almacen.incr(
          ip,
          (_e, r) => respuestas.push({ ip, current: r!.current }),
          60_000,
          100
        );
      }, i * 1.5);
    }
    await vi.advanceTimersByTimeAsync(2_000);

    expect(respuestas).toHaveLength(1_000);
    expect(maxEnVuelo).toBe(1);
    const porIp = new Map<string, number[]>();
    for (const { ip, current } of respuestas) {
      porIp.set(ip, [...(porIp.get(ip) ?? []), current]);
    }
    for (const posiciones of porIp.values()) {
      expect(posiciones).toEqual(Array.from({ length: 20 }, (_, k) => k + 1));
    }
    // Ninguna se decidió en local.
    expect(avisos).not.toHaveBeenCalled();
    expect(errores).not.toHaveBeenCalled();
    // Y salen por lotes: muchas menos sentencias que peticiones.
    expect(incrementar.mock.calls.length).toBeLessThan(1_000);
  });

  it("si vence el plazo de 500 ms responden en local la sentencia en vuelo y la cola; hasta que vuelva, todo en local con un error que dice cuánto lleva", async () => {
    const bd = diferida<Map<string, Fila>>();
    incrementar.mockReturnValueOnce(bd.promesa);
    const almacen = new AlmacenDeLimites();

    const primera = pedir(almacen, "ip", 60_000, 10);
    await vi.advanceTimersByTimeAsync(20);
    const enCola = Array.from({ length: 3 }, () =>
      pedir(almacen, "ip", 60_000, 10)
    );
    await vi.advanceTimersByTimeAsync(479);
    expect(primera).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);

    expect(primera[0].resultado).toEqual({ current: 1, ttl: 59_500 });
    expect(enCola.map((r) => r[0].resultado?.current)).toEqual([2, 3, 4]);
    expect(avisos).toHaveBeenCalledWith(
      expect.stringContaining("plazo de 500 ms vencido")
    );

    // Con la sentencia aún en vuelo, la siguiente no espera ni consulta.
    await vi.advanceTimersByTimeAsync(4_500);
    const mientras = pedir(almacen, "ip", 60_000, 10);
    expect(mientras[0].resultado?.current).toBe(5);
    expect(errores).toHaveBeenCalledWith(
      expect.stringContaining("lleva 5000 ms en vuelo sin volver")
    );
    expect(incrementar).toHaveBeenCalledTimes(1);

    // Vuelve tarde con las suyas contadas: el global manda otra vez, y las 4
    // que decidió la cuenta local (Postgres no las contó) siguen sumando en
    // esta ventana: 3 + 4, como con INCR.
    incrementar.mockResolvedValueOnce(
      filas({ "ratelimit:ip": { valor: 3, ttlMs: 54_000 } })
    );
    bd.resolver(filas({ "ratelimit:ip": { valor: 2, ttlMs: 55_000 } }));
    await vi.advanceTimersByTimeAsync(0);
    const despues = pedir(almacen, "ip", 60_000, 10);
    await vi.advanceTimersByTimeAsync(0);
    expect(lotes()).toEqual([{ "ratelimit:ip": 1 }, { "ratelimit:ip": 1 }]);
    expect(despues[0].resultado?.current).toBe(7);
  });

  it("el callback sale una sola vez aunque compitan el plazo y la consulta (gana el plazo)", async () => {
    const bd = diferida<Map<string, Fila>>();
    incrementar.mockReturnValueOnce(bd.promesa);
    const almacen = new AlmacenDeLimites();

    const llamadas = pedir(almacen, "ip", 60_000, 100);
    await vi.advanceTimersByTimeAsync(500);
    bd.resolver(filas({ "ratelimit:ip": { valor: 50, ttlMs: 30_000 } }));
    await vi.advanceTimersByTimeAsync(0);

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].resultado?.current).toBe(1); // la cuenta local
  });

  it("el callback sale una sola vez aunque compitan el plazo y la consulta (gana la consulta)", async () => {
    const bd = diferida<Map<string, Fila>>();
    incrementar.mockReturnValueOnce(bd.promesa);
    const almacen = new AlmacenDeLimites();

    const llamadas = pedir(almacen, "ip", 60_000, 100);
    await vi.advanceTimersByTimeAsync(499);
    bd.resolver(filas({ "ratelimit:ip": { valor: 50, ttlMs: 30_000 } }));
    await vi.advanceTimersByTimeAsync(10);

    expect(llamadas).toEqual([
      { error: null, resultado: { current: 50, ttl: 30_000 } },
    ]);
  });

  it("cada sentencia sale por la conexión propia del limitador, fuera del pool de prisma, y esa conexión se crea una sola vez", async () => {
    await cerrarConexionDelLimitador();
    vi.mocked(crearClienteDeUnaConexion).mockClear();
    incrementar.mockImplementation(async (incrementos) =>
      filas({ [incrementos[0].clave]: { valor: 1, ttlMs: 60_000 } })
    );
    const almacen = new AlmacenDeLimites();

    for (let i = 0; i < 3; i += 1) {
      pedir(almacen, `ip-${i}`, 60_000, 100);
      await vi.advanceTimersByTimeAsync(0);
    }

    expect(incrementar).toHaveBeenCalledTimes(3);
    expect(incrementar.mock.calls.map((c) => c[1])).toEqual([
      conexionPropia,
      conexionPropia,
      conexionPropia,
    ]);
    expect(crearClienteDeUnaConexion).toHaveBeenCalledTimes(1);
  });

  // Con la conexión congelada, el $disconnect de Prisma no resuelve mientras
  // su sentencia sigue en vuelo (y nunca si es la del PREPARE): el apagado de
  // server.ts llegaría a su límite de 8 s y saldría con código 1.
  it("al apagar no espera más de 500 ms a una conexión del limitador que no se cierra, y lo dice en el log", async () => {
    await cerrarConexionDelLimitador();
    const congelada = {
      $disconnect: vi.fn(() => new Promise<void>(() => {})),
    };
    vi.mocked(crearClienteDeUnaConexion).mockReturnValueOnce(
      congelada as never
    );
    incrementar.mockResolvedValueOnce(
      filas({ "ratelimit:ip": { valor: 1, ttlMs: 60_000 } })
    );
    pedir(new AlmacenDeLimites(), "ip", 60_000, 100);
    await vi.advanceTimersByTimeAsync(0);

    let cerrada = false;
    const cierre = cerrarConexionDelLimitador().then(() => {
      cerrada = true;
    });
    await vi.advanceTimersByTimeAsync(499);
    expect(cerrada).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await cierre;

    expect(cerrada).toBe(true);
    expect(congelada.$disconnect).toHaveBeenCalledTimes(1);
    expect(avisos).toHaveBeenCalledWith(
      expect.stringContaining(
        "[Límite] La conexión del limitador no se cerró en 500 ms"
      )
    );
  });

  it("la conexión propia acota la sentencia en Postgres por debajo del cliente, y tras un error la desecha: la siguiente sentencia sale por una nueva (una conexión medio abierta no deja la instancia en local para siempre)", async () => {
    await cerrarConexionDelLimitador();
    const crear = vi.mocked(crearClienteDeUnaConexion);
    crear.mockClear();
    const primera = { $disconnect: vi.fn(async () => {}) };
    const segunda = { $disconnect: vi.fn(async () => {}) };
    crear
      .mockReturnValueOnce(primera as never)
      .mockReturnValueOnce(segunda as never);
    const tardia = diferida<Map<string, Fila>>();
    const muerta = diferida<Map<string, Fila>>();
    incrementar
      .mockReturnValueOnce(tardia.promesa)
      .mockReturnValueOnce(muerta.promesa)
      .mockResolvedValueOnce(
        filas({ "ratelimit:ip-3": { valor: 1, ttlMs: 60_000 } })
      );
    const almacen = new AlmacenDeLimites();

    // El statement_timeout (Postgres, 2 s) por debajo del socket_timeout
    // (cliente, 5 s): cuando el cliente la suelta, Postgres ya la canceló.
    pedir(almacen, "ip-1", 60_000, 100);
    expect(crear).toHaveBeenCalledWith({
      socket_timeout: "5",
      options: "-c statement_timeout=2000",
    });

    // Un éxito que llega después del plazo: la conexión funciona y se queda.
    await vi.advanceTimersByTimeAsync(800);
    tardia.resolver(filas({ "ratelimit:ip-1": { valor: 1, ttlMs: 60_000 } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(primera.$disconnect).not.toHaveBeenCalled();

    // La conexión se queda medio abierta: vence el plazo y, a los 5 s, el
    // socket_timeout da P2010. Se desecha.
    pedir(almacen, "ip-2", 60_000, 100);
    await vi.advanceTimersByTimeAsync(5_000);
    muerta.rechazar(
      Object.assign(new Error("Timed out during query execution."), {
        code: "P2010",
      })
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(primera.$disconnect).toHaveBeenCalledTimes(1);
    expect(avisos).toHaveBeenCalledWith(
      expect.stringContaining(
        "[Límite] Se desecha la conexión del limitador tras un error de su sentencia (Timed out during query execution.)"
      )
    );

    // La siguiente vuelve a contar en Postgres, por una conexión nueva.
    const tercera = pedir(almacen, "ip-3", 60_000, 100);
    await vi.advanceTimersByTimeAsync(0);
    expect(incrementar.mock.calls.map((c) => c[1])).toEqual([
      primera,
      primera,
      segunda,
    ]);
    expect(crear).toHaveBeenCalledTimes(2);
    expect(tercera[0].resultado).toEqual({ current: 1, ttl: 60_000 });
    await cerrarConexionDelLimitador();
  });

  it("un fallo de la BD después del plazo no vuelve a llamar al callback; si prueba que la sentencia no salió (P1001), la cuenta local la conserva también en las posiciones de Postgres", async () => {
    const bd = diferida<Map<string, Fila>>();
    incrementar.mockReturnValueOnce(bd.promesa);
    const almacen = new AlmacenDeLimites();

    const llamadas = pedir(almacen, "ip", 60_000, 100);
    await vi.advanceTimersByTimeAsync(500);
    bd.rechazar(sinConexion());
    await vi.advanceTimersByTimeAsync(0);

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].resultado?.current).toBe(1);
    // Postgres no la contó: cuando vuelve, la siguiente es la 2.ª, no la 1.ª.
    incrementar.mockResolvedValueOnce(
      filas({ "ratelimit:ip": { valor: 1, ttlMs: 59_000 } })
    );
    const siguiente = pedir(almacen, "ip", 60_000, 100);
    await vi.advanceTimersByTimeAsync(0);
    expect(siguiente[0].resultado?.current).toBe(2);
  });

  it("si la conexión se cierra después del plazo (P1017), la petición suma en la cuenta local pero no otra vez en las posiciones de Postgres: puede que ya la haya contado", async () => {
    // Las cinco peticiones de la clave: la 1.ª y la 4.ª las cuenta Postgres
    // con respuesta; la 2.ª la ejecuta y la confirma, pero la conexión se
    // cierra antes de la respuesta; la 3.ª y la 5.ª no llegan (no hay
    // conexión).
    const segunda = diferida<Map<string, Fila>>();
    incrementar
      .mockResolvedValueOnce(
        filas({ "ratelimit:ip": { valor: 1, ttlMs: 60_000 } })
      )
      .mockReturnValueOnce(segunda.promesa)
      .mockRejectedValueOnce(sinConexion())
      .mockResolvedValueOnce(
        filas({ "ratelimit:ip": { valor: 3, ttlMs: 59_000 } })
      )
      .mockRejectedValueOnce(sinConexion());
    const almacen = new AlmacenDeLimites();

    const primera = pedir(almacen, "ip", 60_000, 10);
    await vi.advanceTimersByTimeAsync(0);
    const otra = pedir(almacen, "ip", 60_000, 10);
    await vi.advanceTimersByTimeAsync(500);
    segunda.rechazar(conexionCerrada());
    await vi.advanceTimersByTimeAsync(0);
    const tercera = pedir(almacen, "ip", 60_000, 10);
    await vi.advanceTimersByTimeAsync(0);
    const cuarta = pedir(almacen, "ip", 60_000, 10);
    await vi.advanceTimersByTimeAsync(0);
    const quinta = pedir(almacen, "ip", 60_000, 10);
    await vi.advanceTimersByTimeAsync(0);

    // Las posiciones de INCR: la 3.ª suma la incierta (Postgres no
    // contesta); la 4.ª, el valor de Postgres (que ya la incluye) más la
    // 3.ª, que seguro que no contó; y la 5.ª, en local, ya no suma la
    // incierta: va en el valor.
    expect(
      [primera, otra, tercera, cuarta, quinta].map(
        (r) => r[0].resultado?.current
      )
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it.each([
    {
      como: "P1001 (no se pudo conectar)",
      error: () => sinConexion(),
      seguro: true,
    },
    {
      como: "P2024 (ninguna conexión libre en el pool)",
      error: () =>
        Object.assign(new Error("Timed out fetching a new connection"), {
          code: "P2024",
        }),
      seguro: true,
    },
    {
      como: "PrismaClientInitializationError",
      error: () =>
        Object.assign(new Error("Can't reach database server"), {
          name: "PrismaClientInitializationError",
        }),
      seguro: true,
    },
    {
      como: "P1017 (la conexión se cerró)",
      error: conexionCerrada,
      seguro: false,
    },
    {
      como: "P2010 «Timed out during query execution» (socket_timeout)",
      error: () =>
        Object.assign(new Error("Timed out during query execution."), {
          code: "P2010",
        }),
      seguro: false,
    },
    {
      como: "un ECONNRESET sin código",
      error: () => new Error("ECONNRESET"),
      seguro: false,
    },
  ])(
    "un fallo a tiempo con $como decide en local y, cuando Postgres vuelve, nunca cuenta la petición dos veces",
    async ({ error, seguro }) => {
      incrementar
        .mockRejectedValueOnce(error())
        // Si el error no prueba que la sentencia no salió, Postgres pudo
        // contarla: su valor ya la incluye.
        .mockResolvedValueOnce(
          filas({ "ratelimit:ip": { valor: seguro ? 1 : 2, ttlMs: 59_000 } })
        );
      const almacen = new AlmacenDeLimites();

      const primera = pedir(almacen, "ip", 60_000, 2);
      await vi.advanceTimersByTimeAsync(0);
      const segunda = pedir(almacen, "ip", 60_000, 2);
      await vi.advanceTimersByTimeAsync(0);

      // Con max 2 pasan las dos, como con INCR (contando dos veces la que
      // Postgres pudo contar, la 2.ª sería la 3.ª).
      expect(primera[0].resultado?.current).toBe(1);
      expect(segunda[0].resultado?.current).toBe(2);
      expect(avisos).toHaveBeenCalledWith(
        expect.stringContaining(
          seguro
            ? "[Límite] Postgres no contó 1 claves"
            : "[Límite] No se sabe si Postgres contó 1 claves"
        )
      );
    }
  );

  it("nunca devuelve error al plugin: un fallo de la BD responde con la cuenta local, y lo decidido en local no se manda después", async () => {
    incrementar
      .mockRejectedValueOnce(sinConexion())
      .mockRejectedValueOnce(sinConexion())
      .mockResolvedValueOnce(
        filas({ "ratelimit:ip": { valor: 1, ttlMs: 59_000 } })
      );
    const almacen = new AlmacenDeLimites();

    const respuestas = [];
    for (let i = 0; i < 3; i += 1) {
      respuestas.push(pedir(almacen, "ip", 60_000, 100));
      await vi.advanceTimersByTimeAsync(0);
    }

    // La tercera la cuenta Postgres (1) y suma las dos que decidió la cuenta
    // local en esta ventana: 3, la posición que le habría dado su INCR.
    expect(respuestas.map((r) => r[0])).toEqual([
      { error: null, resultado: { current: 1, ttl: 60_000 } },
      { error: null, resultado: { current: 2, ttl: 60_000 } },
      { error: null, resultado: { current: 3, ttl: 59_000 } },
    ]);
    expect(lotes()).toEqual([
      { "ratelimit:ip": 1 },
      { "ratelimit:ip": 1 },
      { "ratelimit:ip": 1 },
    ]);
    expect(avisos).toHaveBeenCalledWith(
      expect.stringContaining(
        "[Límite] Postgres no contó 1 claves (ECONNREFUSED)"
      )
    );
  });

  it("tras un fallo a tiempo, lo que esperaba en la cola sale en la siguiente sentencia (son peticiones reales, no un bucle)", async () => {
    const bd = diferida<Map<string, Fila>>();
    incrementar
      .mockReturnValueOnce(bd.promesa)
      .mockResolvedValueOnce(
        filas({ "ratelimit:ip-b": { valor: 4, ttlMs: 59_000 } })
      );
    const almacen = new AlmacenDeLimites();

    pedir(almacen, "ip-a", 60_000, 100);
    const b = pedir(almacen, "ip-b", 60_000, 100);
    bd.rechazar(new Error("ECONNRESET"));
    await vi.advanceTimersByTimeAsync(0);

    expect(lotes()).toEqual([{ "ratelimit:ip-a": 1 }, { "ratelimit:ip-b": 1 }]);
    expect(b[0].resultado?.current).toBe(4);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(incrementar).toHaveBeenCalledTimes(2);
  });

  it("cortacircuitos: 3 fallos seguidos ⇒ 30 s sin BD (la cola, también en local); luego una sonda que, si sale bien, lo cierra, y lo que llegó detrás de ella cuenta en Postgres", async () => {
    incrementar.mockRejectedValue(sinConexion());
    const almacen = new AlmacenDeLimites();

    for (let i = 0; i < 3; i += 1) {
      pedir(almacen, `ip-${i}`, 60_000, 100);
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(incrementar).toHaveBeenCalledTimes(3);
    expect(errores).toHaveBeenCalledWith(
      expect.stringContaining("Cortacircuitos abierto tras 3 fallos")
    );

    // Abierto: 30 s con la cuenta local, sin esperar.
    for (let i = 0; i < 5; i += 1) {
      expect(pedir(almacen, `ip-x${i}`, 60_000, 100)).toHaveLength(1);
    }
    expect(incrementar).toHaveBeenCalledTimes(3);

    // Mucho más de 30 s sin tráfico: el estado sigue «abierto» hasta que
    // llega la primera petición, que sale como sonda.
    await vi.advanceTimersByTimeAsync(120_000);
    avisos.mockClear();
    incrementar
      .mockResolvedValueOnce(
        filas({ "ratelimit:ip-sonda": { valor: 1, ttlMs: 60_000 } })
      )
      .mockResolvedValueOnce(
        filas({ "ratelimit:ip-otra": { valor: 4, ttlMs: 60_000 } })
      );
    const sonda = pedir(almacen, "ip-sonda", 60_000, 100);
    // Lo que llega con la sonda en vuelo espera detrás de ella, como detrás
    // de cualquier sentencia, en vez de decidirse con la cuenta local.
    const otra = pedir(almacen, "ip-otra", 60_000, 100);
    expect(otra).toHaveLength(0);
    expect(incrementar).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(0);
    expect(sonda[0].resultado?.current).toBe(1);
    expect(avisos).toHaveBeenCalledWith(
      expect.stringContaining("Cortacircuitos cerrado")
    );
    expect(lotes()[4]).toEqual({ "ratelimit:ip-otra": 1 });
    expect(otra[0].resultado?.current).toBe(4);
    expect(avisos).not.toHaveBeenCalledWith(
      expect.stringContaining("se decide con la cuenta local")
    );

    // Cerrado: la siguiente vuelve a Postgres.
    incrementar.mockResolvedValueOnce(
      filas({ "ratelimit:ip-z": { valor: 1, ttlMs: 60_000 } })
    );
    pedir(almacen, "ip-z", 60_000, 100);
    expect(incrementar).toHaveBeenCalledTimes(6);
  });

  it.each([
    { como: "falla", cuelga: false },
    { como: "vence su plazo", cuelga: true },
  ])(
    "cortacircuitos: si la sonda $como, lo que esperaba detrás de ella se decide en local y siguen 30 s sin BD",
    async ({ cuelga }) => {
      incrementar.mockRejectedValue(sinConexion());
      const almacen = new AlmacenDeLimites();
      for (let i = 0; i < 3; i += 1) {
        pedir(almacen, `ip-${i}`, 60_000, 100);
        await vi.advanceTimersByTimeAsync(0);
      }

      await vi.advanceTimersByTimeAsync(30_000);
      const bd = diferida<Map<string, Fila>>();
      incrementar.mockReturnValueOnce(bd.promesa);
      pedir(almacen, "ip-sonda", 60_000, 100);
      const detras = [
        pedir(almacen, "k", 60_000, 100),
        pedir(almacen, "k", 60_000, 100),
      ];
      expect(detras.every((r) => r.length === 0)).toBe(true);
      if (cuelga) {
        await vi.advanceTimersByTimeAsync(500);
      } else {
        bd.rechazar(sinConexion());
        await vi.advanceTimersByTimeAsync(0);
      }

      expect(detras.map((r) => r[0].resultado?.current)).toEqual([1, 2]);
      expect(errores).toHaveBeenCalledWith(
        expect.stringContaining("la sonda falló")
      );
      if (cuelga) {
        bd.rechazar(sinConexion());
        await vi.advanceTimersByTimeAsync(0);
      }
      pedir(almacen, "ip-y", 60_000, 100);
      expect(incrementar).toHaveBeenCalledTimes(4);
    }
  );

  it.each([
    { como: "con un error", cuelga: false },
    { como: "con el plazo vencido", cuelga: true },
  ])(
    "si el fallo que abre el cortacircuitos llega $como, la sentencia y la cola de la misma clave reciben posiciones distintas",
    async ({ cuelga }) => {
      const bd = diferida<Map<string, Fila>>();
      incrementar
        .mockRejectedValueOnce(sinConexion())
        .mockRejectedValueOnce(sinConexion())
        .mockReturnValueOnce(bd.promesa);
      const almacen = new AlmacenDeLimites();
      for (let i = 0; i < 2; i += 1) {
        pedir(almacen, `ip-${i}`, 60_000, 100);
        await vi.advanceTimersByTimeAsync(0);
      }

      const enVuelo = pedir(almacen, "k", 60_000, 100);
      const enCola = pedir(almacen, "k", 60_000, 100);
      if (cuelga) await vi.advanceTimersByTimeAsync(500);
      else bd.rechazar(new Error("ECONNRESET"));
      await vi.advanceTimersByTimeAsync(0);

      expect(errores).toHaveBeenCalledWith(
        expect.stringContaining("Cortacircuitos abierto tras 3 fallos")
      );
      expect([
        enVuelo[0].resultado?.current,
        enCola[0].resultado?.current,
      ]).toEqual([1, 2]);
    }
  );

  it("cortacircuitos: si la sonda falla, otros 30 s sin BD", async () => {
    incrementar.mockRejectedValue(sinConexion());
    const almacen = new AlmacenDeLimites();
    for (let i = 0; i < 3; i += 1) {
      pedir(almacen, `ip-${i}`, 60_000, 100);
      await vi.advanceTimersByTimeAsync(0);
    }

    await vi.advanceTimersByTimeAsync(30_000);
    pedir(almacen, "ip-sonda", 60_000, 100); // sonda: falla
    await vi.advanceTimersByTimeAsync(0);
    expect(incrementar).toHaveBeenCalledTimes(4);
    expect(errores).toHaveBeenCalledWith(
      expect.stringContaining("la sonda falló")
    );

    await vi.advanceTimersByTimeAsync(29_000);
    pedir(almacen, "ip-y", 60_000, 100);
    expect(incrementar).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(1_000);
    pedir(almacen, "ip-y", 60_000, 100);
    expect(incrementar).toHaveBeenCalledTimes(5);
  });

  it("un éxito que llega después del plazo no cierra el cortacircuitos (BD lenta, no sana)", async () => {
    incrementar.mockImplementation(
      (incrementos) =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                filas({ [incrementos[0].clave]: { valor: 1, ttlMs: 60_000 } })
              ),
            700
          )
        )
    );
    const almacen = new AlmacenDeLimites();

    for (let i = 0; i < 3; i += 1) {
      pedir(almacen, `ip-${i}`, 60_000, 100);
      await vi.advanceTimersByTimeAsync(1_000);
    }

    expect(errores).toHaveBeenCalledWith(
      expect.stringContaining("Cortacircuitos abierto tras 3 fallos")
    );
    pedir(almacen, "ip-z", 60_000, 100);
    expect(incrementar).toHaveBeenCalledTimes(3);
  });

  // Tras 30 s sin usarse, la conexión hace dos viajes antes de la sonda (la
  // comprobación de Prisma de una conexión inactiva) y, si es nueva, seis: con
  // la red algo lenta, la sonda vencería su plazo en cada ciclo aunque una
  // sentencia normal cupiera en él.
  it.each([
    { ms: 900, cierra: true },
    { ms: 1_000, cierra: false },
  ])(
    "cortacircuitos: una sonda que vuelve bien a los $ms ms, con su plazo de 500 ms ya vencido, cierra el cortacircuitos: $cierra (solo por debajo de 1 s)",
    async ({ ms, cierra }) => {
      incrementar.mockRejectedValue(sinConexion());
      const almacen = new AlmacenDeLimites();
      for (let i = 0; i < 3; i += 1) {
        pedir(almacen, `ip-${i}`, 60_000, 100);
        await vi.advanceTimersByTimeAsync(0);
      }
      await vi.advanceTimersByTimeAsync(30_000);
      avisos.mockClear();
      incrementar.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve(
                  filas({ "ratelimit:ip-sonda": { valor: 1, ttlMs: 60_000 } })
                ),
              ms
            )
          )
      );

      const sonda = pedir(almacen, "ip-sonda", 60_000, 100);
      await vi.advanceTimersByTimeAsync(500);
      // Sus peticiones ya se decidieron en local: no esperan más.
      expect(sonda[0].resultado?.current).toBe(1);
      expect(errores).toHaveBeenCalledWith(
        expect.stringContaining("la sonda falló o venció su plazo")
      );
      await vi.advanceTimersByTimeAsync(ms - 500);
      expect(sonda).toHaveLength(1);

      incrementar.mockResolvedValueOnce(
        filas({ "ratelimit:ip-z": { valor: 1, ttlMs: 60_000 } })
      );
      pedir(almacen, "ip-z", 60_000, 100);
      if (cierra) {
        expect(avisos).toHaveBeenCalledWith(
          expect.stringContaining("Cortacircuitos cerrado")
        );
        expect(incrementar).toHaveBeenCalledTimes(5);
      } else {
        expect(avisos).not.toHaveBeenCalledWith(
          expect.stringContaining("Cortacircuitos cerrado")
        );
        expect(incrementar).toHaveBeenCalledTimes(4);
      }
    }
  );

  it("una sentencia que Prisma no devuelve nunca (su socket_timeout no acota el PREPARE de la primera de cada conexión) se da por perdida a los 6 s: se desecha la conexión, lo suyo queda como incierto y la siguiente sale por otra", async () => {
    await cerrarConexionDelLimitador();
    const crear = vi.mocked(crearClienteDeUnaConexion);
    crear.mockClear();
    const primera = { $disconnect: vi.fn(async () => {}) };
    const segunda = { $disconnect: vi.fn(async () => {}) };
    crear
      .mockReturnValueOnce(primera as never)
      .mockReturnValueOnce(segunda as never);
    const nunca = diferida<Map<string, Fila>>();
    incrementar.mockReturnValueOnce(nunca.promesa);
    const almacen = new AlmacenDeLimites();

    const colgada = pedir(almacen, "ip", 60_000, 5);
    await vi.advanceTimersByTimeAsync(500);
    expect(colgada[0].resultado?.current).toBe(1);
    // Hasta los 6 s sigue esperándola: lo que llega se decide en local.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(pedir(almacen, "ip", 60_000, 5)[0].resultado?.current).toBe(2);
    expect(consultasDeLimitesEnVueloParaTests()).toBe(1);
    expect(primera.$disconnect).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(consultasDeLimitesEnVueloParaTests()).toBe(0);
    expect(primera.$disconnect).toHaveBeenCalledTimes(1);
    expect(avisos).toHaveBeenCalledWith(
      expect.stringContaining(
        "Se desecha la conexión del limitador tras un error de su sentencia (la sentencia no volvió en 6 s y se da por perdida)"
      )
    );

    // La siguiente cuenta en Postgres por una conexión nueva. Postgres no
    // ejecutó la colgada (valor 1: solo esta): la incierta se olvida y la que
    // se decidió en local sigue sumando, 1 + 1.
    incrementar.mockResolvedValueOnce(
      filas({ "ratelimit:ip": { valor: 1, ttlMs: 54_000 } })
    );
    const despues = pedir(almacen, "ip", 60_000, 5);
    await vi.advanceTimersByTimeAsync(0);
    expect(incrementar.mock.calls.map((c) => c[1])).toEqual([primera, segunda]);
    expect(despues[0].resultado?.current).toBe(2);

    // Si Prisma la devuelve después, no cambia nada.
    nunca.resolver(filas({ "ratelimit:ip": { valor: 9, ttlMs: 50_000 } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(colgada).toHaveLength(1);
    const otra = pedir(almacen, "ip", 60_000, 5);
    incrementar.mockResolvedValueOnce(
      filas({ "ratelimit:ip": { valor: 2, ttlMs: 53_000 } })
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(otra[0].resultado?.current).toBe(3);
    await cerrarConexionDelLimitador();
  });

  it("con dos conexiones desechadas por un plazo en 15 min no abre otra: decide en local, con un error, hasta que la primera cumple los 15 min (una cerrada por Postgres, P1017, no cuenta)", async () => {
    await cerrarConexionDelLimitador();
    const crear = vi.mocked(crearClienteDeUnaConexion);
    crear.mockClear();
    const conexiones = Array.from({ length: 4 }, () => ({
      $disconnect: vi.fn(async () => {}),
    }));
    for (const c of conexiones) crear.mockReturnValueOnce(c as never);
    const plazoDelCliente = () =>
      Object.assign(
        new Error(
          "Raw query failed. Code: `N/A`. Message: `Timed out during query execution.`"
        ),
        { code: "P2010" }
      );
    const bien = (clave: string) =>
      filas({ [`ratelimit:${clave}`]: { valor: 1, ttlMs: 60_000 } });
    // Entre fallo y fallo, un éxito: el cortacircuitos no se abre.
    incrementar
      .mockRejectedValueOnce(conexionCerrada())
      .mockResolvedValueOnce(bien("ip-1"))
      .mockRejectedValueOnce(plazoDelCliente())
      .mockResolvedValueOnce(bien("ip-3"))
      .mockRejectedValueOnce(plazoDelCliente());
    const almacen = new AlmacenDeLimites();
    for (let i = 0; i < 5; i += 1) {
      pedir(almacen, `ip-${i}`, 60_000, 100);
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(incrementar.mock.calls.map((c) => c[1])).toEqual([
      conexiones[0],
      conexiones[1],
      conexiones[1],
      conexiones[2],
      conexiones[2],
    ]);
    expect(conexiones[2].$disconnect).toHaveBeenCalledTimes(1);

    // Dos desechadas por un plazo que pueden seguir abiertas: no se abre una
    // tercera, ni se espera.
    const sinConexionPropia = pedir(almacen, "ip-5", 60_000, 100);
    expect(sinConexionPropia[0].resultado?.current).toBe(1);
    expect(crear).toHaveBeenCalledTimes(3);
    expect(incrementar).toHaveBeenCalledTimes(5);
    expect(errores).toHaveBeenCalledWith(
      expect.stringContaining(
        "2 conexiones del limitador desechadas por un plazo en los últimos 15 min pueden seguir abiertas en Postgres; no se abre otra hasta"
      )
    );

    await vi.advanceTimersByTimeAsync(15 * 60_000 - 1_000);
    pedir(almacen, "ip-6", 60_000, 100);
    expect(incrementar).toHaveBeenCalledTimes(5);

    // A los 15 min de la primera, se da por cerrada y se abre otra.
    await vi.advanceTimersByTimeAsync(1_000);
    incrementar.mockResolvedValueOnce(bien("ip-7"));
    const despues = pedir(almacen, "ip-7", 60_000, 100);
    await vi.advanceTimersByTimeAsync(0);
    expect(crear).toHaveBeenCalledTimes(4);
    expect(incrementar.mock.calls[5][1]).toBe(conexiones[3]);
    expect(despues[0].resultado?.current).toBe(1);
    await cerrarConexionDelLimitador();
  });

  it("un resultado tardío con current > max sí deja el bloqueo local para las siguientes", async () => {
    const bd = diferida<Map<string, Fila>>();
    incrementar.mockReturnValueOnce(bd.promesa);
    const almacen = new AlmacenDeLimites();

    pedir(almacen, "ip", 60_000, 100);
    await vi.advanceTimersByTimeAsync(500);
    bd.resolver(filas({ "ratelimit:ip": { valor: 150, ttlMs: 20_000 } }));
    await vi.advanceTimersByTimeAsync(0);

    const siguiente = pedir(almacen, "ip", 60_000, 100);
    expect(siguiente[0].resultado?.current).toBe(101);
    expect(incrementar).toHaveBeenCalledTimes(1);
  });

  it("child() usa el prefijo del RedisStore: ratelimit:POST/auth/login-<ip>", async () => {
    incrementar.mockResolvedValueOnce(new Map());
    const hijo = hijoDe(new AlmacenDeLimites(), "POST", "/auth/login");

    pedir(hijo, "10.0.0.1", 60_000, 10);

    expect(lotes()).toEqual([{ "ratelimit:POST/auth/login-10.0.0.1": 1 }]);
  });

  it("una ruta de /webhooks/ también cuenta de forma síncrona en Postgres (D2): responde tras la BD, con el valor global", async () => {
    const bd = diferida<Map<string, Fila>>();
    incrementar.mockReturnValueOnce(bd.promesa);
    const hijo = hijoDe(new AlmacenDeLimites(), "POST", "/webhooks/telnyx");

    const llamadas = pedir(hijo, "1.2.3.4", 60_000, 300);
    await vi.advanceTimersByTimeAsync(100);
    expect(llamadas).toHaveLength(0);

    bd.resolver(
      filas({
        "ratelimit:POST/webhooks/telnyx-1.2.3.4": { valor: 301, ttlMs: 12_000 },
      })
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(llamadas).toEqual([
      { error: null, resultado: { current: 301, ttl: 12_000 } },
    ]);
  });

  it("la cuenta local se alinea con la ventana de la BD: al cerrarse, lo de la anterior no rechaza en la nueva", async () => {
    incrementar
      .mockResolvedValueOnce(
        filas({ "ratelimit:ip": { valor: 1, ttlMs: 1_000 } })
      )
      .mockRejectedValue(sinConexion());
    const almacen = new AlmacenDeLimites();
    pedir(almacen, "ip", 60_000, 2);
    await vi.advanceTimersByTimeAsync(600);

    const enLocal = pedir(almacen, "ip", 60_000, 2);
    await vi.advanceTimersByTimeAsync(0);
    expect(enLocal[0].resultado).toEqual({ current: 2, ttl: 400 });

    await vi.advanceTimersByTimeAsync(400);
    const nueva = pedir(almacen, "ip", 60_000, 2);
    await vi.advanceTimersByTimeAsync(0);
    expect(nueva[0].resultado).toEqual({ current: 1, ttl: 60_000 });
  });

  it.each([
    { caida: "con errores", cuelga: false },
    { caida: "con consultas colgadas", cuelga: true },
  ])(
    "tras una caída de la BD ($caida), un cliente por debajo del límite no recibe ningún 429",
    async ({ cuelga }) => {
      // 80 por minuto con max 100 (Redis no rechazaría ninguna), y la BD
      // caída de t = 50 s a t = 85 s, como un failover de Cloud SQL.
      const CAE = 50_000;
      const VUELVE = 85_000;
      const base = Date.now();
      const postgres = postgresSimulado();
      incrementar.mockImplementation(async (incrementos) => {
        const t = Date.now() - base;
        if (t >= CAE && t < VUELVE) {
          if (!cuelga) throw sinConexion();
          await new Promise((res) => setTimeout(res, VUELVE - t));
        }
        await new Promise((res) => setTimeout(res, 2));
        return postgres(incrementos);
      });
      const almacen = new AlmacenDeLimites();

      const respuestas: number[] = [];
      for (let t = 0; t < 240_000; t += 750) {
        setTimeout(() => {
          almacen.incr(
            "198.51.100.9",
            (_e, r) => respuestas.push(r!.current),
            60_000,
            100
          );
        }, t);
      }
      await vi.advanceTimersByTimeAsync(245_000);

      expect(respuestas).toHaveLength(320);
      expect(respuestas.filter((c) => c > 100)).toEqual([]);
    }
  );

  it.each([
    { caida: "con errores", cuelga: false, primera: [50_000, 70_000] },
    {
      caida: "con consultas colgadas",
      cuelga: true,
      primera: [50_000, 85_000],
    },
  ])(
    "tras DOS caídas de la BD ($caida), lo decidido en local en la ventana provisional no pasa a la que abre Postgres: ningún 429 a un cliente por debajo del límite",
    async ({ cuelga, primera }) => {
      // Mismo cliente que arriba (Redis no rechazaría ninguna). La primera
      // caída cruza el fin de la ventana: la cuenta local abre una
      // provisional y Postgres, al volver, otra más tarde. La segunda cae
      // dentro de la de Postgres.
      const caidas = [primera, [100_000, 140_000]];
      const base = Date.now();
      const postgres = postgresSimulado();
      incrementar.mockImplementation(async (incrementos) => {
        const t = Date.now() - base;
        const caida = caidas.find(([a, b]) => t >= a && t < b);
        if (caida) {
          if (!cuelga) throw sinConexion();
          await new Promise((res) => setTimeout(res, caida[1] - t));
        }
        await new Promise((res) => setTimeout(res, 2));
        return postgres(incrementos);
      });
      const almacen = new AlmacenDeLimites();

      const respuestas: number[] = [];
      for (let t = 0; t < 240_000; t += 750) {
        setTimeout(() => {
          almacen.incr(
            "198.51.100.9",
            (_e, r) => respuestas.push(r!.current),
            60_000,
            100
          );
        }, t);
      }
      await vi.advanceTimersByTimeAsync(245_000);

      expect(respuestas).toHaveLength(320);
      expect(respuestas.filter((c) => c > 100)).toEqual([]);
    }
  );

  it.each([
    { retraso: 300, despues: 1_100 },
    { retraso: 1_500, despues: 1_600 },
  ])(
    "una respuesta que llega $retraso ms tarde no alarga la ventana ni el bloqueo: en la ventana siguiente vuelve a contar Postgres",
    async ({ retraso, despues }) => {
      const postgres = postgresSimulado();
      incrementar.mockImplementation(async (incrementos) =>
        postgres(incrementos)
      );
      const almacen = new AlmacenDeLimites();
      // Ventana de 1 s en Postgres desde t = 0, con max 2.
      pedir(almacen, "ip", 1_000, 2);
      await vi.advanceTimersByTimeAsync(0);
      pedir(almacen, "ip", 1_000, 2);
      await vi.advanceTimersByTimeAsync(0);

      // La tercera se ejecuta en t = 0 (valor 3, ttl 1 000) y su respuesta
      // tarda: el ttl se midió al ejecutarla, no al llegar.
      incrementar.mockImplementationOnce(async (incrementos) => {
        const respuesta = postgres(incrementos);
        await new Promise((res) => setTimeout(res, retraso));
        return respuesta;
      });
      const tercera = pedir(almacen, "ip", 1_000, 2);
      await vi.advanceTimersByTimeAsync(retraso);
      expect(tercera[0].resultado?.current).toBe(3);

      // La ventana de Postgres acabó en t = 1 000: la siguiente no puede
      // quedarse en un bloqueo local que la BD ya no tiene.
      await vi.advanceTimersByTimeAsync(despues - retraso);
      const siguiente = pedir(almacen, "ip", 1_000, 2);
      await vi.advanceTimersByTimeAsync(0);
      expect(siguiente[0].resultado).toEqual({ current: 1, ttl: 1_000 });
      expect(incrementar).toHaveBeenCalledTimes(4);
    }
  );

  it("una respuesta tardía de una ventana que ya acabó no toca la ventana provisional: lo decidido en local en ella sigue sumando", async () => {
    const postgres = postgresSimulado();
    incrementar.mockImplementation(async (incrementos) =>
      postgres(incrementos)
    );
    const almacen = new AlmacenDeLimites();
    // Ventana de 1 s en Postgres desde t = 0, con max 5.
    pedir(almacen, "ip", 1_000, 5);
    await vi.advanceTimersByTimeAsync(10);
    // Se ejecuta en t = 10 y su respuesta llega en t = 1 510: entretanto
    // decide la cuenta local, y desde t = 1 000 en una ventana provisional.
    incrementar.mockImplementationOnce(async (incrementos) => {
      const respuesta = postgres(incrementos);
      await new Promise((res) => setTimeout(res, 1_500));
      return respuesta;
    });
    pedir(almacen, "ip", 1_000, 5);
    await vi.advanceTimersByTimeAsync(1_090);
    const enLocal = [];
    for (let i = 0; i < 4; i += 1) {
      enLocal.push(pedir(almacen, "ip", 1_000, 5));
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(enLocal.map((r) => r[0].resultado?.current)).toEqual([1, 2, 3, 4]);
    await vi.advanceTimersByTimeAsync(100); // llega la respuesta tardía

    // Postgres vuelve a fallar: la provisional conserva las 4.
    incrementar.mockRejectedValue(sinConexion());
    const despues = [];
    for (let i = 0; i < 2; i += 1) {
      despues.push(pedir(almacen, "ip", 1_000, 5));
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(despues.map((r) => r[0].resultado?.current)).toEqual([5, 6]);
  });

  it("si la ventana de la cuenta acaba con la sentencia en vuelo, lo decidido en local en ella ya no suma en sus posiciones", async () => {
    const postgres = postgresSimulado();
    incrementar.mockRejectedValueOnce(sinConexion());
    const almacen = new AlmacenDeLimites();
    // En local en t = 0: ventana provisional [0, 1 000).
    const primera = pedir(almacen, "ip", 1_000, 5);
    await vi.advanceTimersByTimeAsync(900);
    expect(primera[0].resultado?.current).toBe(1);

    // Sale en t = 900 (Postgres abre su ventana ahí) y vuelve en t = 1 200.
    incrementar.mockImplementationOnce(async (incrementos) => {
      const respuesta = postgres(incrementos);
      await new Promise((res) => setTimeout(res, 300));
      return respuesta;
    });
    const enVuelo = pedir(almacen, "ip", 1_000, 5);
    await vi.advanceTimersByTimeAsync(300);
    expect(enVuelo[0].resultado).toEqual({ current: 1, ttl: 1_000 });
  });

  it("si el bloqueo se debe a lo decidido en local, acaba con la ventana en que se decidió, no con la que abrió Postgres después", async () => {
    const postgres = postgresSimulado();
    incrementar
      .mockRejectedValueOnce(sinConexion())
      .mockRejectedValueOnce(sinConexion())
      .mockImplementation(async (incrementos) => postgres(incrementos));
    const almacen = new AlmacenDeLimites();
    const base = Date.now();
    const codigos: number[] = [];
    const en = async (t: number) => {
      await vi.advanceTimersByTimeAsync(t - (Date.now() - base));
      const r = pedir(almacen, "ip", 1_000, 3);
      await vi.advanceTimersByTimeAsync(0);
      codigos.push(r[0].resultado!.current);
    };
    // Dos en local en la provisional [0, 1 000); Postgres vuelve en t = 500
    // y abre su ventana [500, 1 500).
    await en(0);
    await en(100);
    await en(500);
    await en(600); // 2 de Postgres + 2 locales > 3: bloqueo hasta t = 1 000
    await en(1_100); // la BD tiene 2 en su ventana: es la 3.ª
    expect(codigos).toEqual([1, 2, 3, 4, 3]);
  });

  it("una instancia sola deja pasar como mucho max por ventana aunque la BD falle y vuelva dentro de ella: lo decidido en local suma en las posiciones de Postgres", async () => {
    // max 10 por minuto y una petición cada 200 ms durante 50 s; la BD falla
    // de t = 1 s a t = 5 s (el cortacircuitos la vuelve a probar a los 31,4 s).
    const base = Date.now();
    const postgres = postgresSimulado();
    incrementar.mockImplementation(async (incrementos) => {
      const t = Date.now() - base;
      if (t >= 1_000 && t < 5_000) throw sinConexion();
      return postgres(incrementos);
    });
    const almacen = new AlmacenDeLimites();

    let pasan = 0;
    for (let t = 0; t < 50_000; t += 200) {
      setTimeout(() => {
        almacen.incr(
          "ip",
          (_e, r) => {
            if (r!.current <= 10) pasan += 1;
          },
          60_000,
          10
        );
      }, t);
    }
    await vi.advanceTimersByTimeAsync(51_000);

    // 5 contadas en Postgres antes del fallo y 5 en local; al volver, la BD
    // no deja pasar 5 más.
    expect(pasan).toBe(10);
  });

  it("un callback que lanza no deja la clave colgada: las demás se responden y la siguiente vuelve a la BD", async () => {
    incrementar
      .mockResolvedValueOnce(
        filas({ "ratelimit:ip": { valor: 1, ttlMs: 60_000 } })
      )
      .mockResolvedValueOnce(
        filas({ "ratelimit:ip": { valor: 2, ttlMs: 59_000 } })
      );
    const almacen = new AlmacenDeLimites();

    almacen.incr(
      "ip",
      () => {
        throw new Error("callback roto");
      },
      60_000,
      100
    );
    await vi.advanceTimersByTimeAsync(0);
    const siguiente = pedir(almacen, "ip", 60_000, 100);
    await vi.advanceTimersByTimeAsync(0);

    expect(siguiente[0].resultado?.current).toBe(2);
    expect(incrementar).toHaveBeenCalledTimes(2);
    expect(errores).toHaveBeenCalledWith(
      expect.stringContaining("callback roto")
    );
  });

  it("las cuentas locales tienen tope: con 10 000 claves vivas se podan las más antiguas", async () => {
    incrementar.mockRejectedValue(sinConexion());
    const almacen = new AlmacenDeLimites();
    // Cortacircuitos abierto: todo se decide en local sin promesas pendientes.
    for (let i = 0; i < 3; i += 1) {
      pedir(almacen, `ip-${i}`, 60_000, 100);
      await vi.advanceTimersByTimeAsync(0);
    }
    for (let i = 0; i < 10_050; i += 1) {
      pedir(almacen, `ip-masiva-${i}`, 60_000, 100);
    }

    expect(cuentasLocalesParaTests()).toBeLessThanOrEqual(10_000);
  });

  it("la poda no olvida una cuenta con peticiones en la cola: la clave no va dos veces en un lote y las posiciones son las de INCR", async () => {
    const postgres = postgresSimulado();
    incrementar.mockImplementation(async (incrementos) =>
      postgres(incrementos)
    );
    const almacen = new AlmacenDeLimites();
    for (let i = 0; i < 9_999; i += 1) pedir(almacen, `ip-${i}`, 60_000, 100);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(cuentasLocalesParaTests()).toBe(9_999);

    const bd = diferida<void>();
    incrementar.mockImplementationOnce(async (incrementos) => {
      await bd.promesa;
      return postgres(incrementos);
    });
    // ip-0 (la más antigua, ya lleva 1): una en vuelo y dos en la cola.
    const ip0 = [
      pedir(almacen, "ip-0", 60_000, 100),
      pedir(almacen, "ip-0", 60_000, 100),
      pedir(almacen, "ip-0", 60_000, 100),
    ];
    // La segunda clave nueva llega al tope y poda el 10 % más antiguo.
    pedir(almacen, "nueva-1", 60_000, 100);
    pedir(almacen, "nueva-2", 60_000, 100);
    ip0.push(pedir(almacen, "ip-0", 60_000, 100));
    bd.resolver();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);

    for (const [incrementos] of incrementar.mock.calls) {
      const claves = (incrementos as Incremento[]).map((i) => i.clave);
      expect(new Set(claves).size).toBe(claves.length);
    }
    expect(ip0.map((r) => r[0].resultado?.current)).toEqual([2, 3, 4, 5]);
    expect(cuentasLocalesParaTests()).toBeLessThanOrEqual(10_000);
  });
});
