import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import worker, {
  API_CLOUDFLARE,
  NOMBRE_DNS_BLOQUEOS,
  URL_LISTA,
  ejecutarCiclo,
  responderEstado,
  vaciarCacheEstado,
} from "../src/index.js";
import {
  esIpDeCloudflare,
  normalizarIp,
  normalizarNombre,
} from "../src/conmutador.js";
import {
  AHORA,
  DESTINO_VERCEL,
  HOSTNAMES,
  IDS,
  IDS_AJENOS,
  IPS_VERCEL,
  MINUTO,
  REGISTROS_AJENOS,
  TEXTO_LISTA_CON_BLOQUEO,
  TEXTO_LISTA_SIN_NOSOTROS,
  TOKEN,
  ZONA,
  controlConMarca,
  registrosDeZona,
  respuestaDnsBloqueos,
} from "./ayudas.js";

const CUERPO_APAGAR = '{"proxied":false,"ttl":60}';
const CUERPO_ENCENDER = '{"proxied":true,"ttl":1}';
const URL_REGISTRO = (nombre) =>
  `${API_CLOUDFLARE}/zones/${ZONA}/dns_records/${IDS[nombre]}`;

const respuestaJson = (cuerpo, estado = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { "content-type": "application/json" },
  });

const HOSTS_DOH = ["dns.google", "cloudflare-dns.com", "one.one.one.one"];
const iso = (ms) => new Date(ms).toISOString();

/** Una lista como la sirve hayahora (Caddy): con Last-Modified y Content-Length. */
const listaReal = (cuerpo, extra = {}) => ({
  estado: 200,
  cuerpo,
  cabeceras: { "content-type": "text/plain; charset=utf-8" },
  edadMs: 90 * 1000,
  conLongitud: true,
  ...extra,
});

/** IPs sueltas de un texto de lista (lo que publica el DNS de hayahora). */
const ipsDeTexto = (texto) =>
  String(texto ?? "")
    .split("\n")
    .map((l) => normalizarIp(l.trim()))
    .filter(Boolean);

/**
 * Un mundo falso: la zona de Cloudflare (con paginación y registros ajenos),
 * hayahora (la lista y su DNS), los resolvedores DoH y KV. Apunta cada llamada
 * para poder comprobar a quién se habló, con qué cuerpo y en qué orden.
 *
 * Los resolvedores imitan lo comprobado el 10-10-2026: Google y
 * cloudflare-dns.com dan la cara 188.114.x de Cloudflare y one.one.one.one la
 * 104.21/172.67; el DNS de hayahora repite la lista salvo que se le diga otra
 * cosa (`dnsBloqueos`).
 */
function crearMundo(opciones = {}) {
  const m = {
    ahora: opciones.ahora ?? AHORA,
    registros: opciones.registros ?? registrosDeZona(),
    lista: opciones.lista ?? listaReal(TEXTO_LISTA_CON_BLOQUEO),
    apiCaida: false,
    apiDevuelveHtml: false,
    dohCaido: false,
    // { host: Status } para responder HTTP 200 con un Status de error.
    dohStatusPorHost: {},
    // La sonda recibe IPs de Vercel aunque el registro esté proxied (cachés
    // justo después de encender).
    sondaDevuelveVercel: false,
    // El destino de Vercel también devuelve una IP de Cloudflare (no debería
    // pasar nunca; si pasa, no puede contar como «de Vercel»).
    destinoConIpDeCloudflare: false,
    // undefined: el DNS de hayahora repite la lista; o un array de IPs.
    dnsBloqueos: undefined,
    // Hace cuánto (s) guardó el resolvedor la respuesta negativa del DNS de
    // hayahora (0: la acaba de pedir; hasta 1800: el mínimo de su SOA).
    dnsNegativaEdadS: 0,
    dnsBloqueosCaido: false,
    patchesQueFallan: new Set(),
    patchMiente: false,
    kvFallaAlEscribir: new Set(),
    kvFallaAlLeer: false,
    almacen: new Map(),
    llamadas: [],
    eventos: [],
    lineas: [],
  };

  const prefijoApi = `/client/v4/zones/${ZONA}/dns_records`;

  function api(url, metodo, init) {
    if (m.apiDevuelveHtml) {
      return new Response("<html><body>502 Bad Gateway</body></html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      });
    }
    if (m.apiCaida) {
      return respuestaJson(
        {
          success: false,
          errors: [{ code: 10000, message: "Authentication error" }],
        },
        403
      );
    }
    if (metodo === "GET" && url.pathname === prefijoApi) {
      // Tres por página y sin respetar el filtro de tipo, a propósito: el
      // Worker tiene que paginar y filtrar él.
      const pagina = Number(url.searchParams.get("page") ?? 1);
      const porPagina = 3;
      const result = m.registros
        .slice((pagina - 1) * porPagina, pagina * porPagina)
        .map((r) => ({ ...r }));
      return respuestaJson({
        success: true,
        errors: [],
        result,
        result_info: {
          page: pagina,
          per_page: porPagina,
          count: result.length,
          total_count: m.registros.length,
          total_pages: Math.ceil(m.registros.length / porPagina),
        },
      });
    }
    if (metodo === "PATCH" && url.pathname.startsWith(`${prefijoApi}/`)) {
      const id = decodeURIComponent(url.pathname.slice(prefijoApi.length + 1));
      const registro = m.registros.find((r) => r.id === id);
      if (!registro) {
        return respuestaJson(
          { success: false, errors: [{ code: 81044, message: "No existe" }] },
          404
        );
      }
      if (m.patchesQueFallan.has(id)) {
        return respuestaJson(
          { success: false, errors: [{ code: 1000, message: "fallo simulado" }] },
          500
        );
      }
      if (m.patchMiente) {
        return respuestaJson({ success: true, errors: [], result: { ...registro } });
      }
      Object.assign(registro, JSON.parse(init.body), {
        modified_on: new Date(m.ahora + 1000).toISOString(),
      });
      return respuestaJson({ success: true, errors: [], result: { ...registro } });
    }
    throw new Error(`API inesperada: ${metodo} ${url}`);
  }

  function doh(url) {
    if (m.dohCaido) return new Response("", { status: 503 });
    if (m.dohStatusPorHost[url.host] !== undefined) {
      return respuestaJson({ Status: m.dohStatusPorHost[url.host] });
    }
    const nombre = normalizarNombre(url.searchParams.get("name"));
    const tipo = url.searchParams.get("type");
    if (nombre === NOMBRE_DNS_BLOQUEOS) {
      if (m.dnsBloqueosCaido) return new Response("", { status: 502 });
      const ips = m.dnsBloqueos ?? ipsDeTexto(m.lista.cuerpo);
      return respuestaJson(respuestaDnsBloqueos(tipo, ips, m.dnsNegativaEdadS));
    }
    const caraOtra = url.host === "one.one.one.one";
    const respuesta = (datos) =>
      datos.map((data) => ({
        name: `${nombre}.`,
        type: tipo === "A" ? 1 : 28,
        TTL: 300,
        data,
      }));
    const propio = m.registros.find(
      (r) => r.type === "CNAME" && r.name === nombre
    );
    let answer = [];
    if (propio && propio.proxied && !m.sondaDevuelveVercel) {
      if (tipo === "A") {
        answer = respuesta(
          caraOtra ? ["104.21.57.158", "172.67.191.30"] : ["188.114.96.5", "188.114.97.5"]
        );
      } else {
        answer = respuesta(
          caraOtra
            ? ["2606:4700:3032::6815:399e", "2606:4700:3036::ac43:bf1e"]
            : ["2a06:98c1:3120::5", "2a06:98c1:3121::5"]
        );
      }
    } else if (propio || nombre === DESTINO_VERCEL) {
      if (tipo === "A") {
        answer = respuesta(
          url.host === "dns.google"
            ? ["64.29.17.65", "216.198.79.65"]
            : ["64.29.17.1", "216.198.79.1"]
        );
        if (m.destinoConIpDeCloudflare) answer.push(...respuesta(["188.114.96.5"]));
      }
      if (propio) {
        answer.unshift({
          name: `${nombre}.`,
          type: 5,
          TTL: 60,
          data: `${DESTINO_VERCEL}.`,
        });
      }
    }
    return respuestaJson({ Status: 0, Answer: answer });
  }

  m.fetch = async (recurso, init = {}) => {
    const url = new URL(String(recurso));
    const metodo = init.method ?? "GET";
    m.llamadas.push({
      url: String(recurso),
      metodo,
      cabeceras: { ...(init.headers ?? {}) },
      cuerpo: init.body ?? null,
      conPlazo: init.signal instanceof AbortSignal,
    });
    m.eventos.push(`fetch ${metodo} ${url.host}`);
    if (url.host === "hayahora.futbol") {
      if (m.lista.error) throw new TypeError(m.lista.error);
      const cabeceras = { ...(m.lista.cabeceras ?? {}) };
      if (typeof m.lista.edadMs === "number") {
        cabeceras["last-modified"] = new Date(m.ahora - m.lista.edadMs).toUTCString();
      }
      if (m.lista.longitud !== undefined) {
        cabeceras["content-length"] = String(m.lista.longitud);
      } else if (m.lista.conLongitud) {
        cabeceras["content-length"] = String(Buffer.byteLength(m.lista.cuerpo));
      }
      return new Response(m.lista.cuerpo, {
        status: m.lista.estado,
        headers: cabeceras,
      });
    }
    if (url.host === "api.cloudflare.com") return api(url, metodo, init);
    if (HOSTS_DOH.includes(url.host)) return doh(url);
    throw new Error(`petición inesperada: ${metodo} ${url}`);
  };

  m.kv = {
    async get(clave, tipo) {
      m.eventos.push(`kv get ${clave}`);
      if (m.kvFallaAlLeer) throw new Error("KV no disponible");
      const valor = m.almacen.get(clave);
      if (valor === undefined) return null;
      return tipo === "json" ? JSON.parse(valor) : valor;
    },
    async put(clave, valor) {
      m.eventos.push(`kv put ${clave}`);
      if (m.kvFallaAlEscribir.has(clave)) {
        throw new Error("KV no acepta escrituras");
      }
      m.almacen.set(clave, valor);
    },
  };

  m.env = {
    ZONE_ID: ZONA,
    HOSTNAMES: HOSTNAMES.join(","),
    MODO: "activo",
    CF_API_TOKEN: TOKEN,
    ESTADO: m.kv,
    ...(opciones.env ?? {}),
  };

  m.ejecutar = () => {
    m.llamadas = [];
    m.eventos = [];
    m.lineas = [];
    return ejecutarCiclo(m.env, {
      fetch: m.fetch,
      ahora: m.ahora,
      registro: {
        log: (linea) => m.lineas.push({ nivel: "log", linea }),
        error: (linea) => m.lineas.push({ nivel: "error", linea }),
      },
    });
  };
  m.patches = () => m.llamadas.filter((l) => l.metodo === "PATCH");
  m.consultasDoh = (nombre) =>
    m.llamadas.filter(
      (l) =>
        HOSTS_DOH.includes(new URL(l.url).host) &&
        (nombre === undefined || new URL(l.url).searchParams.get("name") === nombre)
    );
  m.lecturasKv = () => m.eventos.filter((e) => e.startsWith("kv get")).length;
  m.leerKv = (clave) =>
    m.almacen.has(clave) ? JSON.parse(m.almacen.get(clave)) : null;
  m.sembrar = (clave, valor) => m.almacen.set(clave, JSON.stringify(valor));
  m.nuestros = () =>
    HOSTNAMES.map((n) => m.registros.find((r) => r.id === IDS[n]));
  return m;
}

function comprobarAjenosIntactos(m) {
  for (const original of REGISTROS_AJENOS) {
    const actual = m.registros.find((r) => r.id === original.id);
    assert.deepEqual(actual, original, original.name);
  }
  for (const patch of m.patches()) {
    assert.ok(!IDS_AJENOS.some((id) => patch.url.includes(id)), patch.url);
  }
}

function unaSolaLinea(m, nivel) {
  assert.equal(m.lineas.length, 1, "una línea de log por ejecución");
  assert.equal(m.lineas[0].nivel, nivel);
  const linea = JSON.parse(m.lineas[0].linea);
  assert.ok(!m.lineas[0].linea.includes(TOKEN), "el token no sale en el log");
  return linea;
}

const SEMILLA_CONTROL = readFileSync(
  new URL("../semillas/control.json", import.meta.url),
  "utf8"
);
const SEMILLA_OBSERVACION = readFileSync(
  new URL("../semillas/observacion.json", import.meta.url),
  "utf8"
);

// ─── Ciclo completo ─────────────────────────────────────────────────────────

describe("ciclo: apagar y encender", () => {
  it("con bloqueo apaga solo los tres CNAME, con el cuerpo exacto y la marca antes", async () => {
    const m = crearMundo();
    const resumen = await m.ejecutar();

    const patches = m.patches();
    assert.equal(patches.length, 3);
    assert.deepEqual(
      patches.map((p) => p.url).sort(),
      HOSTNAMES.map(URL_REGISTRO).sort()
    );
    for (const patch of patches) {
      assert.equal(patch.cuerpo, CUERPO_APAGAR);
      assert.equal(patch.cabeceras.authorization, `Bearer ${TOKEN}`);
      assert.equal(patch.cabeceras["content-type"], "application/json");
      assert.equal(patch.conPlazo, true);
    }
    comprobarAjenosIntactos(m);
    for (const r of m.nuestros()) {
      assert.equal(r.proxied, false);
      assert.equal(r.ttl, 60);
    }

    // La marca se guarda en KV antes del primer PATCH.
    const marcaEn = m.eventos.indexOf("kv put control");
    const primerPatch = m.eventos.indexOf("fetch PATCH api.cloudflare.com");
    assert.ok(marcaEn !== -1 && marcaEn < primerPatch, m.eventos.join("\n"));
    // La marca, ya confirmada con el modified_on que devolvió cada PATCH.
    const control = m.leerKv("control");
    assert.deepEqual(
      Object.keys(control.marca.registros).sort(),
      [...HOSTNAMES].sort()
    );
    for (const datos of Object.values(control.marca.registros)) {
      assert.deepEqual(datos, {
        apagadoEn: iso(m.ahora),
        modificadoEn: iso(m.ahora + 1000),
      });
    }
    assert.equal(control.ultimoCambio.accion, "apagar");

    // Una línea de log con la decisión.
    const linea = unaSolaLinea(m, "log");
    assert.equal(linea.accion, "apagar");
    assert.equal(linea.motivo, "bloqueo_detectado");
    assert.deepEqual(resumen.errores, []);
    assert.ok(linea.bloqueadasNuestras.includes("188.114.96.5"));

    // La lista se pide sin caché y con plazo.
    const peticionLista = m.llamadas.find((l) => l.url.startsWith(URL_LISTA));
    assert.match(peticionLista.url, /\?_=\d+$/);
    assert.equal(peticionLista.cabeceras["cache-control"], "no-cache");
    assert.equal(peticionLista.conPlazo, true);

    // DoH con la subred de cada operadora, y cloudflare-dns.com.
    const subredes = m.llamadas
      .filter((l) => l.url.startsWith("https://dns.google/resolve"))
      .map((l) => new URL(l.url).searchParams.get("edns_client_subnet"));
    assert.deepEqual(
      [...new Set(subredes)].sort(),
      ["77.208.0.0/24", "79.116.0.0/24", "83.32.0.0/24", "90.165.0.0/24"]
    );
    for (const url of [
      "https://cloudflare-dns.com/dns-query",
      "https://one.one.one.one/dns-query",
    ]) {
      assert.ok(
        m.llamadas.some(
          (l) =>
            l.url.startsWith(url) && l.cabeceras.accept === "application/dns-json"
        ),
        url
      );
    }
    // Todas las consultas DoH llevan plazo.
    assert.ok(m.consultasDoh().length > 0);
    assert.ok(m.consultasDoh().every((l) => l.conPlazo));

    // Aprende las IPs de Cloudflare (sin mezclar las de Vercel) y guarda las
    // de Vercel aparte.
    // Las dos caras: la de Google/cloudflare-dns.com y la de one.one.one.one.
    const observacion = m.leerKv("observacion");
    for (const ip of [
      "188.114.96.5",
      "2a06:98c1:3121::5",
      "104.21.57.158",
      "172.67.191.30",
      "2606:4700:3032::6815:399e",
      "2606:4700:3036::ac43:bf1e",
    ]) {
      assert.ok(ip in observacion.ipsCloudflare, ip);
    }
    for (const ip of Object.keys(observacion.ipsCloudflare)) {
      assert.equal(esIpDeCloudflare(ip), true, ip);
    }
    assert.deepEqual(Object.keys(observacion.ipsVercel).sort(), [
      "216.198.79.1",
      "216.198.79.65",
      "64.29.17.1",
      "64.29.17.65",
    ]);
  });

  it("al acabar el bloqueo lo enciende tras 10 minutos limpios, 15 desde el apagado y el DNS de hayahora", async () => {
    const m = crearMundo();
    await m.ejecutar(); // apaga

    m.lista = listaReal(TEXTO_LISTA_SIN_NOSOTROS);
    m.ahora += 2 * MINUTO;
    let resumen = await m.ejecutar();
    assert.equal(m.patches().length, 0);
    assert.equal(resumen.motivo, "esperando_ejecuciones_limpias");
    // Con el proxy apagado no hay nada que sondear: usa las IPs guardadas.
    assert.ok(!m.llamadas.some((l) => l.url.includes("name=alhabla.ai")));
    assert.equal(m.consultasDoh(NOMBRE_DNS_BLOQUEOS).length, 0);

    m.ahora += 2 * MINUTO;
    resumen = await m.ejecutar();
    assert.equal(resumen.motivo, "esperando_tiempo_limpio");
    assert.equal(m.patches().length, 0);

    // Cada 2 minutos (un hueco mayor rompería la racha): a los 12 la racha
    // ya dura 10, pero no han pasado 15 desde el apagado.
    const motivos = [];
    for (let min = 6; min <= 14; min += 2) {
      m.ahora += 2 * MINUTO;
      motivos.push((await m.ejecutar()).motivo);
      assert.equal(m.patches().length, 0);
    }
    assert.deepEqual(motivos, [
      "esperando_tiempo_limpio",
      "esperando_tiempo_limpio",
      "esperando_tiempo_limpio",
      "esperando_tiempo_minimo",
      "esperando_tiempo_minimo",
    ]);
    m.ahora += 2 * MINUTO; // 16 desde el apagado, 14 de racha limpia
    resumen = await m.ejecutar();
    assert.equal(resumen.accion, "encender");
    // Antes de encender preguntó al DNS de hayahora, A y AAAA.
    const confirmaciones = m.consultasDoh(NOMBRE_DNS_BLOQUEOS);
    assert.deepEqual(
      confirmaciones.map((l) => new URL(l.url).searchParams.get("type")).sort(),
      ["A", "A", "AAAA", "AAAA"]
    );
    assert.ok(confirmaciones.every((l) => l.conPlazo));
    assert.equal(resumen.confirmacion.ok, true);
    assert.deepEqual(resumen.confirmacion.bloqueadasNuestras, []);
    const patches = m.patches();
    assert.deepEqual(
      patches.map((p) => p.url).sort(),
      HOSTNAMES.map(URL_REGISTRO).sort()
    );
    for (const patch of patches) assert.equal(patch.cuerpo, CUERPO_ENCENDER);
    comprobarAjenosIntactos(m);
    for (const r of m.nuestros()) {
      assert.equal(r.proxied, true);
      assert.equal(r.ttl, 1);
    }
    const control = m.leerKv("control");
    assert.equal(control.marca, null);
    assert.equal(control.ultimoCambio.accion, "encender");
    assert.equal(control.limpiasSeguidas, 0);

    // Ya encendido y sin bloqueo, no hace nada más.
    m.ahora += 2 * MINUTO;
    resumen = await m.ejecutar();
    assert.equal(resumen.accion, "ninguna");
    assert.equal(m.patches().length, 0);
  });

  it("un PATCH que falla a medias se completa en el siguiente ciclo", async () => {
    const m = crearMundo();
    m.patchesQueFallan.add(IDS["www.alhabla.ai"]);
    const resumen = await m.ejecutar();
    assert.equal(m.patches().length, 3);
    assert.equal(resumen.nivel, "error");
    const linea = unaSolaLinea(m, "error");
    assert.deepEqual(
      linea.errores.map((e) => [e.fase, e.registro]),
      [["api_patch", "www.alhabla.ai"]]
    );
    assert.deepEqual(
      Object.keys(m.leerKv("control").marca.registros).sort(),
      [...HOSTNAMES].sort()
    );

    m.patchesQueFallan.clear();
    m.ahora += 2 * MINUTO;
    const segundo = await m.ejecutar();
    assert.deepEqual(
      m.patches().map((p) => [p.url, p.cuerpo]),
      [[URL_REGISTRO("www.alhabla.ai"), CUERPO_APAGAR]]
    );
    assert.equal(segundo.motivo, "reintento_de_apagado");
    assert.equal(segundo.nivel, "info");
    assert.ok(m.nuestros().every((r) => r.proxied === false));
    comprobarAjenosIntactos(m);
  });

  it("si la API dice que sí pero proxied no cambia, cuenta como fallo", async () => {
    const m = crearMundo();
    m.patchMiente = true;
    const resumen = await m.ejecutar();
    assert.equal(resumen.nivel, "error");
    assert.equal(resumen.errores.length, 3);
    assert.ok(resumen.cambios.every((c) => c.ok === false));
  });

  it("pagina la lista de registros y filtra por nombre exacto y tipo CNAME", async () => {
    // Los nuestros quedan en las páginas 2 y 3; hay un TXT con el mismo nombre
    // que el apex y un CNAME staging.app.alhabla.ai.
    const m = crearMundo();
    await m.ejecutar();
    const paginas = m.llamadas
      .filter((l) => l.metodo === "GET" && l.url.startsWith(API_CLOUDFLARE))
      .map((l) => new URL(l.url).searchParams.get("page"));
    assert.deepEqual(paginas, ["1", "2", "3"]);
    assert.equal(m.patches().length, 3);
    comprobarAjenosIntactos(m);
  });
});

// ─── Lo que NO debe tocar nada ──────────────────────────────────────────────

describe("ciclo: casos en que no se toca nada", () => {
  it("con la lista caída o rara no cambia nada y lo avisa", async () => {
    for (const lista of [
      { estado: 503, cuerpo: "Service Unavailable" },
      { error: "fetch failed" },
      {
        estado: 200,
        cuerpo: "<!doctype html><h1>Cloudflare</h1>",
        cabeceras: { "content-type": "text/html" },
      },
    ]) {
      const m = crearMundo({ lista });
      const resumen = await m.ejecutar();
      assert.equal(m.patches().length, 0);
      assert.equal(resumen.motivo, "lista_invalida");
      const linea = unaSolaLinea(m, "log");
      assert.equal(linea.nivel, "aviso");
      assert.equal(linea.lista.valida, false);
      assert.equal(m.leerKv("control"), null);
    }
  });

  it("con la API de Cloudflare caída no cambia nada y da un error ruidoso", async () => {
    const m = crearMundo();
    m.apiCaida = true;
    const resumen = await m.ejecutar();
    assert.equal(m.patches().length, 0);
    assert.equal(resumen.motivo, "api_ilegible");
    const linea = unaSolaLinea(m, "error");
    assert.equal(linea.errores[0].fase, "api_leer_registros");
    assert.match(linea.errores[0].mensaje, /403/);
    assert.ok(!m.eventos.includes("kv put control"));
  });

  it("si KV no se puede leer no cambia nada", async () => {
    const m = crearMundo();
    m.kvFallaAlLeer = true;
    const resumen = await m.ejecutar();
    assert.equal(m.patches().length, 0);
    assert.equal(resumen.motivo, "kv_ilegible");
    unaSolaLinea(m, "error");
  });

  it("si no puede guardar la marca, no apaga", async () => {
    const m = crearMundo();
    m.kvFallaAlEscribir.add("control");
    const resumen = await m.ejecutar();
    assert.equal(m.patches().length, 0);
    assert.equal(resumen.nivel, "error");
    assert.equal(resumen.errores[0].fase, "kv_guardar_marca");
    assert.ok(m.nuestros().every((r) => r.proxied === true));
  });

  it("en modo observar decide pero no hace PATCH ni toca la marca", async () => {
    const m = crearMundo({ env: { MODO: "observar" } });
    const resumen = await m.ejecutar();
    assert.equal(m.patches().length, 0);
    assert.equal(resumen.accion, "apagar");
    assert.equal(resumen.simulado, true);
    assert.ok(resumen.cambios.every((c) => c.simulado === true));
    assert.equal(m.leerKv("control"), null);
    assert.ok(m.nuestros().every((r) => r.proxied === true));
  });

  it("con api.alhabla.ai en HOSTNAMES se niega sin llamar a nadie", async () => {
    const m = crearMundo({
      env: { HOSTNAMES: "alhabla.ai,www.alhabla.ai,api.alhabla.ai" },
    });
    const resumen = await m.ejecutar();
    assert.equal(m.llamadas.length, 0);
    assert.equal(resumen.motivo, "configuracion_invalida");
    unaSolaLinea(m, "error");
  });

  it("sin token tampoco llama a nadie", async () => {
    const m = crearMundo({ env: { CF_API_TOKEN: "" } });
    const resumen = await m.ejecutar();
    assert.equal(m.llamadas.length, 0);
    assert.equal(resumen.nivel, "error");
  });

  it("con destinos de Vercel distintos se niega sin resolverlos (no caben en 50 subpeticiones)", async () => {
    const m = crearMundo();
    const destinos = ["a1.vercel-dns-017.com", "b2.vercel-dns-017.com", "cname.vercel-dns.com"];
    HOSTNAMES.forEach((nombre, i) => {
      m.registros.find((r) => r.id === IDS[nombre]).content = destinos[i];
    });
    const resumen = await m.ejecutar();
    assert.equal(resumen.motivo, "destinos_distintos");
    assert.deepEqual(resumen.destinos, destinos);
    assert.equal(m.patches().length, 0);
    for (const destino of destinos) assert.equal(m.consultasDoh(destino).length, 0);
    unaSolaLinea(m, "error");
  });

  it("como mucho ~35 subpeticiones en una ejecución (el límite es 50)", async () => {
    // Apagar con la caché de Vercel vieja: lista, 3 páginas de API, 12 DoH de
    // sonda, 12 de Vercel y 3 PATCH.
    const apagar = crearMundo();
    await apagar.ejecutar();
    assert.equal(apagar.llamadas.length, 31);
    // Encender: lista, 3 páginas, 12 DoH de Vercel (caché vieja), 4 al DNS
    // de hayahora y 3 PATCH (con el proxy apagado no hay sonda).
    const apagadoEn = AHORA - 60 * MINUTO;
    const encender = crearMundo({
      registros: registrosDeZona({}, { proxied: false, modificado: apagadoEn + 1000 }),
      lista: listaReal(TEXTO_LISTA_SIN_NOSOTROS),
    });
    encender.sembrar("control", controlConMarca(HOSTNAMES, apagadoEn, {
      limpiasSeguidas: 9,
      limpioDesde: iso(AHORA - 20 * MINUTO),
      limpioHasta: iso(AHORA - 2 * MINUTO),
    }, { modificadoEn: iso(apagadoEn + 1000) }));
    encender.sembrar("observacion", JSON.parse(SEMILLA_OBSERVACION));
    assert.equal((await encender.ejecutar()).accion, "encender");
    assert.equal(encender.llamadas.length, 23);
  });

  it("si falta uno de los tres registros no toca los otros dos", async () => {
    const m = crearMundo({
      registros: registrosDeZona().filter((r) => r.id !== IDS["app.alhabla.ai"]),
    });
    const resumen = await m.ejecutar();
    assert.equal(m.patches().length, 0);
    assert.equal(resumen.motivo, "registros_incompletos");
    assert.deepEqual(resumen.faltan, ["app.alhabla.ai"]);
    unaSolaLinea(m, "error");
  });

  it("lo apagado a mano (sin marca) no lo enciende nunca", async () => {
    const m = crearMundo({
      registros: registrosDeZona({}, { proxied: false }),
      lista: listaReal(""),
    });
    m.sembrar("observacion", JSON.parse(SEMILLA_OBSERVACION));
    for (let i = 0; i < 10; i++) {
      const resumen = await m.ejecutar();
      assert.equal(m.patches().length, 0);
      assert.equal(resumen.motivo, "apagado_a_mano");
      m.ahora += 2 * MINUTO;
    }
    assert.ok(m.nuestros().every((r) => r.proxied === false));
  });

  it("si el DoH no responde y no hay IPs guardadas, no apaga a ciegas", async () => {
    const m = crearMundo();
    m.dohCaido = true;
    const resumen = await m.ejecutar();
    assert.equal(m.patches().length, 0);
    assert.equal(resumen.motivo, "sin_ips_conocidas");
    assert.ok(resumen.avisos.includes("doh_sin_respuesta_para_la_sonda"));
    assert.equal(unaSolaLinea(m, "log").nivel, "aviso");
  });

  it("si el DoH de Vercel no responde y no hay IPs de Vercel guardadas, no apaga", async () => {
    const m = crearMundo();
    m.sembrar("observacion", {
      ipsCloudflare: JSON.parse(SEMILLA_OBSERVACION).ipsCloudflare,
    });
    m.dohCaido = true;
    const resumen = await m.ejecutar();
    assert.equal(m.patches().length, 0);
    assert.equal(resumen.motivo, "sin_ips_de_vercel");
    assert.ok(resumen.avisos.includes("doh_sin_ips_de_vercel"));
  });

  it("con el DoH caído pero IPs guardadas, sí apaga (las guardadas valen)", async () => {
    const m = crearMundo();
    m.sembrar("observacion", JSON.parse(SEMILLA_OBSERVACION));
    m.dohCaido = true;
    const resumen = await m.ejecutar();
    assert.equal(resumen.accion, "apagar");
    assert.equal(m.patches().length, 3);
  });

  it("si la API responde HTML en vez de JSON, error y nada más", async () => {
    const m = crearMundo();
    m.apiDevuelveHtml = true;
    const resumen = await m.ejecutar();
    assert.equal(m.patches().length, 0);
    assert.equal(resumen.motivo, "api_ilegible");
    assert.match(resumen.errores[0].mensaje, /502/);
  });

  it("sin el binding KV no arranca", async () => {
    const m = crearMundo({ env: { ESTADO: undefined } });
    const resumen = await m.ejecutar();
    assert.equal(m.llamadas.length, 0);
    assert.equal(resumen.motivo, "configuracion_invalida");
    unaSolaLinea(m, "error");
  });

  it("un fallo inesperado se registra como error y no deja nada a medias", async () => {
    const m = crearMundo();
    const env = { ...m.env };
    Object.defineProperty(env, "ESTADO", {
      get() {
        throw new Error("binding roto");
      },
    });
    const resumen = await ejecutarCiclo(env, {
      fetch: m.fetch,
      ahora: m.ahora,
      registro: { log: () => {}, error: () => {} },
    });
    assert.equal(resumen.nivel, "error");
    assert.equal(resumen.errores[0].fase, "inesperado");
    assert.match(resumen.errores[0].mensaje, /binding roto/);
    assert.equal(m.patches().length, 0);
  });

  it("si no puede guardar la observación, solo avisa (la marca sí se guarda)", async () => {
    const m = crearMundo();
    m.kvFallaAlEscribir.add("observacion");
    const resumen = await m.ejecutar();
    assert.equal(resumen.accion, "apagar");
    assert.equal(resumen.nivel, "aviso");
    assert.ok(resumen.avisos.some((a) => a.startsWith("kv_guardar_observacion")));
    assert.ok(m.leerKv("control").marca);
  });

  it("no reescribe KV en cada ejecución si nada cambia", async () => {
    const m = crearMundo({ lista: listaReal("") });
    await m.ejecutar();
    assert.ok(m.eventos.includes("kv put observacion"));
    m.ahora += 2 * MINUTO;
    await m.ejecutar();
    assert.ok(!m.eventos.some((e) => e.startsWith("kv put")), m.eventos.join("\n"));
    m.ahora += 10 * MINUTO; // toca latido
    await m.ejecutar();
    assert.ok(m.eventos.includes("kv put observacion"));
    assert.ok(!m.eventos.includes("kv put control"));
  });

  it("con dos fallos alternos todo un día no pasa de 1.000 escrituras de KV", async () => {
    // El DNS de hayahora ve nuestra IP aunque la lista no, y la lista falla
    // una ejecución de cada dos: `control` se escribe en cada ejecución
    // válida (avanza la racha) y la observación, antes, en todas (1.080).
    const apagadoEn = AHORA - 60 * MINUTO;
    const m = crearMundo({
      registros: registrosDeZona({}, { proxied: false, modificado: apagadoEn + 1000 }),
    });
    m.sembrar("control", controlConMarca(HOSTNAMES, apagadoEn, {}, {
      modificadoEn: iso(apagadoEn + 1000),
    }));
    m.sembrar("observacion", JSON.parse(SEMILLA_OBSERVACION));
    m.dnsBloqueos = ["188.114.96.5"];
    const puts = { control: 0, observacion: 0 };
    const niveles = new Set();
    for (let i = 0; i < 720; i++) {
      m.lista =
        i % 2
          ? { estado: 502, cuerpo: "Bad Gateway" }
          : listaReal(TEXTO_LISTA_SIN_NOSOTROS);
      niveles.add((await m.ejecutar()).nivel);
      for (const e of m.eventos) {
        if (e === "kv put control") puts.control++;
        if (e === "kv put observacion") puts.observacion++;
      }
      m.ahora += 2 * MINUTO;
    }
    assert.equal(m.patches().length, 0);
    assert.ok(niveles.has("error"));
    assert.equal(puts.control, 360);
    // El latido de 10 minutos (144 al día) y poco más.
    assert.ok(puts.observacion <= 160, JSON.stringify(puts));
  });
});

// ─── Estado inicial de hoy ──────────────────────────────────────────────────

describe("semillas de hoy", () => {
  it("con el proxy apagado a mano y la semilla, lo enciende él al acabar el bloqueo", async () => {
    const m = crearMundo({
      registros: registrosDeZona(
        {},
        { proxied: false, modificado: Date.parse("2026-10-10T16:40:00.000Z") }
      ),
    });
    m.almacen.set("control", SEMILLA_CONTROL);
    m.almacen.set("observacion", SEMILLA_OBSERVACION);

    // Bloqueo en curso: nada.
    let resumen = await m.ejecutar();
    assert.equal(resumen.motivo, "sigue_bloqueado");
    assert.equal(m.patches().length, 0);

    // La primera ejecución confirma (adopta) la semilla con el modified_on.
    for (const datos of Object.values(m.leerKv("control").marca.registros)) {
      assert.equal(datos.modificadoEn, "2026-10-10T16:40:00.000Z");
    }

    // Acaba el bloqueo: 10 minutos limpios, confirma con el DNS y lo enciende.
    m.lista = listaReal("");
    const acciones = [];
    for (let i = 0; i < 6; i++) {
      m.ahora += 2 * MINUTO;
      resumen = await m.ejecutar();
      acciones.push(resumen.accion);
    }
    assert.deepEqual(acciones, [
      "ninguna",
      "ninguna",
      "ninguna",
      "ninguna",
      "ninguna",
      "encender",
    ]);
    assert.deepEqual(
      m.patches().map((p) => p.cuerpo),
      [CUERPO_ENCENDER, CUERPO_ENCENDER, CUERPO_ENCENDER]
    );
    comprobarAjenosIntactos(m);
    assert.equal(m.leerKv("control").marca, null);
  });
});

// ─── La lista miente o está vieja ───────────────────────────────────────────

describe("ciclo: lista vacía falsa, cortada o congelada", () => {
  it("hayahora sirve vacío en pleno bloqueo: el DNS de hayahora impide encender", async () => {
    const m = crearMundo();
    await m.ejecutar(); // apaga
    // La lista se queda vacía (fallo de hayahora) pero su DNS, que sirve
    // otra máquina, sigue viendo nuestras IPs bloqueadas.
    m.lista = listaReal("");
    m.dnsBloqueos = ["188.114.96.5", "188.114.97.5", "2a06:98c1:3120::5"];
    const motivos = new Set();
    for (let i = 0; i < 45; i++) {
      m.ahora += 2 * MINUTO;
      const resumen = await m.ejecutar();
      assert.equal(m.patches().length, 0, `ejecución ${i}: ${resumen.motivo}`);
      motivos.add(resumen.motivo);
    }
    assert.ok(motivos.has("bloqueo_en_dns"), [...motivos].join(", "));
    assert.ok(m.nuestros().every((r) => r.proxied === false));
    // Cuando el DNS también lo da por acabado, enciende.
    m.dnsBloqueos = [];
    let encendido = false;
    for (let i = 0; i < 8 && !encendido; i++) {
      m.ahora += 2 * MINUTO;
      encendido = (await m.ejecutar()).accion === "encender";
    }
    assert.ok(encendido);
    assert.ok(m.nuestros().every((r) => r.proxied === true));
  });

  it("si el DNS de hayahora no responde, no enciende y a los 10 minutos es error", async () => {
    const m = crearMundo();
    await m.ejecutar(); // apaga
    m.lista = listaReal("");
    m.dnsBloqueosCaido = true;
    const vistos = [];
    for (let i = 0; i < 14; i++) {
      m.ahora += 2 * MINUTO;
      const resumen = await m.ejecutar();
      assert.equal(m.patches().length, 0);
      vistos.push([resumen.motivo, resumen.nivel]);
    }
    const fallidas = vistos.filter(([motivo]) => motivo === "confirmacion_dns_fallida");
    assert.ok(fallidas.length >= 6, JSON.stringify(vistos));
    assert.equal(fallidas[0][1], "aviso");
    assert.equal(fallidas.at(-1)[1], "error");
    assert.equal(m.lineas[0].nivel, "error");
  });

  it("el DNS de hayahora con una caché negativa de antes de acabar no deja encender", async () => {
    // Lo visto el 10-10 a las 18:07Z: la lista traía IPs ajenas y el DNS
    // contestaba «sin registros» desde una caché de hacía 20 minutos.
    const apagadoEn = AHORA - 60 * MINUTO;
    const m = crearMundo({
      registros: registrosDeZona({}, { proxied: false, modificado: apagadoEn + 1000 }),
      lista: listaReal(`${TEXTO_LISTA_SIN_NOSOTROS}2606:4700:2ff9::1\n`),
    });
    m.sembrar("control", controlConMarca(HOSTNAMES, apagadoEn, {}, {
      modificadoEn: iso(apagadoEn + 1000),
    }));
    m.sembrar("observacion", JSON.parse(SEMILLA_OBSERVACION));
    m.dnsBloqueos = [];
    m.dnsNegativaEdadS = 1391;
    const motivos = [];
    for (let i = 0; i < 12; i++) {
      const resumen = await m.ejecutar();
      motivos.push(resumen.motivo);
      m.ahora += 2 * MINUTO;
    }
    assert.equal(m.patches().length, 0);
    assert.ok(motivos.slice(5).every((x) => x === "confirmacion_dns_desfasada"), motivos.join());
    assert.equal(m.lineas[0].nivel, "error");
    // Cuando el DNS ya trae lo que trae la lista (A y AAAA), enciende.
    m.dnsBloqueos = undefined;
    assert.equal((await m.ejecutar()).accion, "encender");
  });

  it("si la API cae mientras vuelve el bloqueo, no enciende con una sola observación limpia", async () => {
    const apagadoEn = AHORA - 60 * MINUTO;
    const m = crearMundo({
      registros: registrosDeZona({}, { proxied: false, modificado: apagadoEn + 1000 }),
      lista: listaReal(TEXTO_LISTA_SIN_NOSOTROS),
    });
    m.sembrar("control", controlConMarca(HOSTNAMES, apagadoEn, {}, {
      modificadoEn: iso(apagadoEn + 1000),
    }));
    m.sembrar("observacion", JSON.parse(SEMILLA_OBSERVACION));
    assert.equal((await m.ejecutar()).motivo, "esperando_ejecuciones_limpias");
    m.lista = listaReal(TEXTO_LISTA_CON_BLOQUEO);
    m.apiCaida = true;
    for (let i = 0; i < 8; i++) {
      m.ahora += 2 * MINUTO;
      assert.equal((await m.ejecutar()).motivo, "api_ilegible");
    }
    m.apiCaida = false;
    m.lista = listaReal(TEXTO_LISTA_SIN_NOSOTROS);
    m.ahora += 2 * MINUTO;
    const resumen = await m.ejecutar();
    assert.equal(resumen.motivo, "esperando_ejecuciones_limpias");
    assert.equal(resumen.limpioDesde, iso(m.ahora));
    assert.equal(m.patches().length, 0);
  });

  it("sin Last-Modified, o con uno del futuro, la lista no vale", async () => {
    for (const [extra, motivo] of [
      [{ edadMs: undefined }, "lista_sin_fecha"],
      [{ edadMs: -60 * MINUTO }, "lista_con_fecha_futura"],
    ]) {
      const m = crearMundo({ lista: listaReal(TEXTO_LISTA_CON_BLOQUEO, extra) });
      const resumen = await m.ejecutar();
      assert.equal(resumen.lista.motivo, motivo);
      assert.equal(m.patches().length, 0);
    }
  });

  it("una lista con menos bytes que su Content-Length no vale", async () => {
    const m = crearMundo({
      lista: listaReal("104.20.18.209\n104.21.0.122\n", { longitud: 4782 }),
    });
    const resumen = await m.ejecutar();
    assert.equal(resumen.motivo, "lista_invalida");
    assert.equal(resumen.lista.motivo, "lista_incompleta");
    assert.equal(m.patches().length, 0);
  });

  it("una lista con Last-Modified de hace más de 15 minutos no vale", async () => {
    const m = crearMundo({
      lista: listaReal(TEXTO_LISTA_CON_BLOQUEO, { edadMs: 20 * MINUTO }),
    });
    const resumen = await m.ejecutar();
    assert.equal(resumen.lista.motivo, "lista_antigua");
    assert.equal(m.patches().length, 0);
    assert.ok(resumen.avisos.includes("lista_invalida:lista_antigua"));
  });
});

// ─── Avisos que pasan a error ───────────────────────────────────────────────

describe("ciclo: no poder decidir acaba siendo error", () => {
  it("hayahora caído: aviso al principio y error (con console.error) a los 10 minutos", async () => {
    const m = crearMundo({ lista: listaReal(TEXTO_LISTA_SIN_NOSOTROS) });
    await m.ejecutar();
    m.lista = { error: "Network connection lost." };
    const niveles = [];
    for (let i = 0; i < 6; i++) {
      m.ahora += 2 * MINUTO;
      const resumen = await m.ejecutar();
      niveles.push(resumen.nivel);
      assert.equal(resumen.motivo, "lista_invalida");
    }
    assert.deepEqual(niveles, ["aviso", "aviso", "aviso", "aviso", "aviso", "error"]);
    const linea = unaSolaLinea(m, "error");
    assert.equal(linea.inoperativoDesde, iso(AHORA + 2 * MINUTO));
    assert.equal(m.leerKv("observacion").inoperativoDesde, iso(AHORA + 2 * MINUTO));

    // Vuelve la lista: la primera ejecución sale bien (info), pero la cuenta
    // solo se borra con la segunda buena seguida.
    m.lista = listaReal(TEXTO_LISTA_SIN_NOSOTROS);
    const vuelta = [];
    for (let i = 0; i < 2; i++) {
      m.ahora += 2 * MINUTO;
      const resumen = await m.ejecutar();
      vuelta.push([resumen.nivel, m.leerKv("observacion").inoperativoDesde]);
    }
    assert.deepEqual(vuelta, [
      ["info", iso(AHORA + 2 * MINUTO)],
      ["info", null],
    ]);
  });

  it("una lista que falla una vez de cada dos acaba siendo error", async () => {
    const m = crearMundo({ lista: listaReal(TEXTO_LISTA_SIN_NOSOTROS) });
    const niveles = [];
    for (let i = 0; i < 8; i++) {
      m.lista =
        i % 2
          ? listaReal(TEXTO_LISTA_SIN_NOSOTROS)
          : { estado: 502, cuerpo: "Bad Gateway" };
      niveles.push((await m.ejecutar()).nivel);
      m.ahora += 2 * MINUTO;
    }
    // Antes, cada ejecución buena borraba la cuenta y nunca llegaba a error.
    assert.deepEqual(niveles, [
      "aviso",
      "info",
      "aviso",
      "info",
      "aviso",
      "info",
      "error",
      "info",
    ]);
  });

  it("scheduled lanza cuando lleva 10 minutos sin poder decidir", async (t) => {
    const m = crearMundo({ lista: { error: "fetch failed" } });
    m.sembrar("observacion", {
      ...JSON.parse(SEMILLA_OBSERVACION),
      inoperativoDesde: iso(Date.now() - 20 * MINUTO),
    });
    t.mock.method(globalThis, "fetch", m.fetch);
    const log = t.mock.method(console, "log", () => {});
    const error = t.mock.method(console, "error", () => {});
    await assert.rejects(
      worker.scheduled({ scheduledTime: Date.now(), cron: "*/2 * * * *" }, m.env, {}),
      /lista_invalida: inoperativo desde/
    );
    assert.equal(log.mock.callCount(), 0);
    assert.equal(error.mock.callCount(), 1);
  });

  it("con la marca puesta y sin IPs conocidas es error desde la primera ejecución", async () => {
    const m = crearMundo({
      registros: registrosDeZona({}, { proxied: false }),
      lista: listaReal(""),
    });
    m.almacen.set("control", SEMILLA_CONTROL);
    const resumen = await m.ejecutar();
    assert.equal(resumen.motivo, "sin_ips_conocidas");
    assert.equal(resumen.nivel, "error");
    unaSolaLinea(m, "error");
  });
});

// ─── DoH: sonda, Vercel y fallos ────────────────────────────────────────────

describe("ciclo: DoH", () => {
  it("la sonda no guarda como nuestras las IPs de Vercel (cachés justo tras encender)", async () => {
    const m = crearMundo({ lista: listaReal(TEXTO_LISTA_SIN_NOSOTROS) });
    m.sondaDevuelveVercel = true;
    const resumen = await m.ejecutar();
    assert.deepEqual(resumen.sonda.ipsCloudflare, []);
    assert.ok(resumen.sonda.otras.includes("64.29.17.65"));
    const observacion = m.leerKv("observacion");
    for (const ip of IPS_VERCEL) {
      assert.ok(!(ip in observacion.ipsCloudflare), ip);
    }
  });

  it("tres ejecuciones seguidas sondean los tres nombres", async () => {
    const m = crearMundo({ lista: listaReal(TEXTO_LISTA_SIN_NOSOTROS) });
    const sondeados = new Set();
    for (let i = 0; i < 3; i++) {
      const resumen = await m.ejecutar();
      sondeados.add(resumen.sonda.nombre);
      m.ahora += 2 * MINUTO;
    }
    assert.deepEqual([...sondeados].sort(), [...HOSTNAMES].sort());
  });

  it("con un bloqueo vuelve a resolver Vercel aunque se refrescara hace poco", async () => {
    const semilla = {
      ...JSON.parse(SEMILLA_OBSERVACION),
      vercelActualizadoEn: iso(AHORA - 5 * MINUTO),
    };
    const sinBloqueo = crearMundo({ lista: listaReal(TEXTO_LISTA_SIN_NOSOTROS) });
    sinBloqueo.sembrar("observacion", semilla);
    await sinBloqueo.ejecutar();
    assert.equal(sinBloqueo.consultasDoh(DESTINO_VERCEL).length, 0);

    const conBloqueo = crearMundo();
    conBloqueo.sembrar("observacion", semilla);
    await conBloqueo.ejecutar();
    assert.equal(conBloqueo.consultasDoh(DESTINO_VERCEL).length, 12);
    assert.equal(
      conBloqueo.leerKv("observacion").vercelActualizadoEn,
      iso(AHORA)
    );
  });

  it("una IP de Cloudflare en el destino de Vercel no cuenta como de Vercel", async () => {
    const m = crearMundo();
    m.destinoConIpDeCloudflare = true;
    const resumen = await m.ejecutar();
    assert.equal(resumen.accion, "apagar");
    assert.deepEqual(resumen.vercelBloqueadas, []);
    assert.ok(!("188.114.96.5" in m.leerKv("observacion").ipsVercel));
  });

  it("las IPs de Vercel se sustituyen por las de hoy, no se acumulan", async () => {
    // Una IP que Vercel ya no nos da (y que hoy está bloqueada) no puede
    // impedir el apagado.
    const m = crearMundo({
      lista: listaReal(`${TEXTO_LISTA_CON_BLOQUEO}76.76.21.21\n`),
    });
    m.sembrar("observacion", {
      ...JSON.parse(SEMILLA_OBSERVACION),
      ipsVercel: { "76.76.21.21": iso(AHORA - 60 * MINUTO) },
      vercelActualizadoEn: iso(AHORA - 60 * MINUTO),
    });
    const resumen = await m.ejecutar();
    assert.equal(resumen.accion, "apagar");
    assert.deepEqual(resumen.vercelBloqueadas, []);
    assert.ok(!("76.76.21.21" in m.leerKv("observacion").ipsVercel));
  });

  it("una IP vista hace 20 días sigue siendo nuestra; una de hace 40, no", async () => {
    const m = crearMundo({ lista: listaReal(TEXTO_LISTA_SIN_NOSOTROS) });
    m.sembrar("observacion", {
      ipsCloudflare: {
        "188.114.96.1": iso(AHORA - 20 * 24 * 60 * MINUTO),
        "188.114.97.1": iso(AHORA - 40 * 24 * 60 * MINUTO),
      },
      ipsVercel: JSON.parse(SEMILLA_OBSERVACION).ipsVercel,
    });
    await m.ejecutar();
    const { ipsCloudflare } = m.leerKv("observacion");
    assert.equal(ipsCloudflare["188.114.96.1"], iso(AHORA - 20 * 24 * 60 * MINUTO));
    assert.ok(!("188.114.97.1" in ipsCloudflare));
    assert.ok("188.114.96.5" in ipsCloudflare);
  });

  it("una respuesta DoH con Status de error (HTTP 200) cuenta como fallo y avisa", async () => {
    const m = crearMundo({ lista: listaReal(TEXTO_LISTA_SIN_NOSOTROS) });
    m.dohStatusPorHost = { "one.one.one.one": 2 };
    let resumen = await m.ejecutar();
    assert.equal(resumen.sonda.fallos, 2);
    assert.deepEqual(resumen.sonda.resolvedoresConFallos, ["cloudflare-1111"]);
    assert.ok(resumen.avisos.includes("sonda_doh_degradado:cloudflare-1111"));
    assert.equal(resumen.nivel, "aviso");

    m.dohStatusPorHost = Object.fromEntries(HOSTS_DOH.map((h) => [h, 5]));
    m.ahora += 2 * MINUTO;
    resumen = await m.ejecutar();
    assert.equal(resumen.sonda.fallos, resumen.sonda.consultas);
    assert.ok(resumen.avisos.includes("doh_sin_respuesta_para_la_sonda"));
  });
});

// ─── Cambios a mano entre ejecuciones ───────────────────────────────────────

describe("ciclo: cambios a mano", () => {
  it("si un humano lo enciende y lo vuelve a apagar, no lo enciende nunca", async () => {
    const m = crearMundo();
    await m.ejecutar(); // apaga y confirma con el modified_on del PATCH
    for (const r of m.nuestros()) {
      r.proxied = true;
      r.modified_on = iso(m.ahora + 30 * 1000);
    }
    for (const r of m.nuestros()) {
      r.proxied = false;
      r.modified_on = iso(m.ahora + 60 * 1000);
    }
    m.lista = listaReal("104.20.18.209\n");
    m.ahora += 2 * MINUTO;
    const primero = await m.ejecutar();
    assert.equal(primero.accion, "limpiar_marca");
    assert.equal(primero.motivo, "modificado_a_mano");
    assert.equal(m.leerKv("control").marca, null);
    for (let i = 0; i < 20; i++) {
      m.ahora += 2 * MINUTO;
      const resumen = await m.ejecutar();
      assert.equal(m.patches().length, 0);
      assert.equal(resumen.motivo, "apagado_a_mano");
    }
  });

  it("si al sembrar ya estaba encendido a mano, suelta la marca sin apagar al momento", async () => {
    const ahora = Date.parse("2026-10-10T17:35:00.000Z");
    const m = crearMundo({
      ahora,
      registros: registrosDeZona(
        {},
        { proxied: true, modificado: ahora - 2 * MINUTO }
      ),
    });
    m.almacen.set("control", SEMILLA_CONTROL);
    m.almacen.set("observacion", SEMILLA_OBSERVACION);
    const primero = await m.ejecutar();
    assert.equal(primero.accion, "limpiar_marca");
    assert.equal(m.patches().length, 0);
    // Después, el antirrebote respeta el cambio del humano.
    m.ahora += 2 * MINUTO;
    const segundo = await m.ejecutar();
    assert.equal(segundo.motivo, "antirrebote");
    assert.equal(m.patches().length, 0);
  });
});

// ─── fetch: /estado ─────────────────────────────────────────────────────────

describe("fetch", () => {
  beforeEach(() => vaciarCacheEstado());

  it("GET /estado devuelve el estado sin secretos", async () => {
    const m = crearMundo();
    await m.ejecutar();
    const respuesta = await worker.fetch(
      new Request("https://alhabla-failover-laliga.ejemplo.workers.dev/estado"),
      m.env
    );
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("cache-control"), "no-store");
    const texto = await respuesta.text();
    assert.ok(!texto.includes(TOKEN));
    const estado = JSON.parse(texto);
    assert.equal(estado.servicio, "alhabla-failover-laliga");
    assert.deepEqual(estado.hostnames, HOSTNAMES);
    assert.deepEqual(estado.decision, {
      accion: "apagar",
      motivo: "bloqueo_detectado",
    });
    assert.ok(estado.ipsConocidas.cloudflare.includes("188.114.96.5"));
    assert.ok(estado.ipsConocidas.vercel.includes("64.29.17.65"));
    assert.ok(estado.bloqueadasQueNosAfectan.includes("188.114.97.5"));
    assert.deepEqual(
      Object.keys(estado.marcaDelConmutador.registros).sort(),
      [...HOSTNAMES].sort()
    );
    assert.equal(estado.ultimoCambio.accion, "apagar");
    assert.equal(estado.lista.valida, true);
    // /estado no llama a nadie: solo lee KV.
    assert.equal(m.llamadas.filter((l) => l.metodo === "PATCH").length, 3);
  });

  it("/estado sin nada guardado responde igualmente", async () => {
    const m = crearMundo();
    const respuesta = await worker.fetch(
      new Request("https://x.workers.dev/estado"),
      m.env
    );
    assert.equal(respuesta.status, 200);
    const estado = await respuesta.json();
    assert.equal(estado.marcaDelConmutador, null);
    assert.equal(estado.decision, null);
  });

  it("/estado con KV caído responde 503 sin detalles", async () => {
    const m = crearMundo();
    m.kvFallaAlLeer = true;
    const respuesta = await worker.fetch(
      new Request("https://x.workers.dev/estado"),
      m.env
    );
    assert.equal(respuesta.status, 503);
    assert.ok(!(await respuesta.text()).includes(TOKEN));
  });

  it("/estado guarda la respuesta 60 s: una avalancha de visitas no gasta KV", async () => {
    const m = crearMundo();
    await m.ejecutar();
    m.eventos = [];
    const t0 = AHORA + 5 * MINUTO;
    for (let i = 0; i < 50; i++) {
      const respuesta = await responderEstado(m.env, t0 + i * 1000);
      assert.equal(respuesta.status, 200);
    }
    assert.equal(m.lecturasKv(), 2, "solo la primera lee control y observación");
    await responderEstado(m.env, t0 + 61 * 1000);
    assert.equal(m.lecturasKv(), 4);
    // Un 503 no se guarda.
    vaciarCacheEstado();
    m.kvFallaAlLeer = true;
    assert.equal((await responderEstado(m.env, t0)).status, 503);
    m.kvFallaAlLeer = false;
    assert.equal((await responderEstado(m.env, t0 + 1000)).status, 200);
  });

  it("con ESTADO_TOKEN, /estado exige la cabecera y sin ella no lee KV", async () => {
    const m = crearMundo({ env: { ESTADO_TOKEN: "secreto-de-estado" } });
    await m.ejecutar();
    m.eventos = [];
    const pedir = (cabeceras = {}) =>
      worker.fetch(
        new Request("https://x.workers.dev/estado", { headers: cabeceras }),
        m.env
      );
    for (const cabeceras of [
      {},
      { authorization: "Bearer otro" },
      { authorization: "secreto-de-estado" },
      { authorization: "Bearer " },
    ]) {
      const respuesta = await pedir(cabeceras);
      assert.equal(respuesta.status, 401, JSON.stringify(cabeceras));
      const texto = await respuesta.text();
      assert.ok(!texto.includes("secreto-de-estado"));
      assert.ok(!texto.includes(TOKEN));
    }
    assert.equal(m.lecturasKv(), 0);
    const bien = await pedir({ authorization: "Bearer secreto-de-estado" });
    assert.equal(bien.status, 200);
    assert.equal((await bien.json()).decision.accion, "apagar");
  });

  it("cualquier otra ruta o método da 404", async () => {
    const m = crearMundo();
    for (const peticion of [
      new Request("https://x.workers.dev/"),
      new Request("https://x.workers.dev/estado/"),
      new Request("https://x.workers.dev/estado2"),
      new Request("https://x.workers.dev/estado", { method: "POST" }),
      new Request("https://x.workers.dev/__scheduled"),
    ]) {
      const respuesta = await worker.fetch(peticion, m.env);
      assert.equal(respuesta.status, 404, `${peticion.method} ${peticion.url}`);
    }
  });
});

// ─── scheduled ──────────────────────────────────────────────────────────────

describe("scheduled", () => {
  it("ejecuta el ciclo con fetch y console globales", async (t) => {
    // scheduled usa el reloj de verdad: la lista lleva Last-Modified de ahora.
    const m = crearMundo({ ahora: Date.now(), lista: listaReal("") });
    t.mock.method(globalThis, "fetch", m.fetch);
    const log = t.mock.method(console, "log", () => {});
    const error = t.mock.method(console, "error", () => {});
    await worker.scheduled({ scheduledTime: Date.now(), cron: "*/2 * * * *" }, m.env, {});
    assert.equal(log.mock.callCount(), 1);
    assert.equal(error.mock.callCount(), 0);
    assert.equal(JSON.parse(log.mock.calls[0].arguments[0]).motivo, "sin_bloqueo");
  });

  it("lanza (para que se vea en las métricas) si algo falla, tras una sola línea", async (t) => {
    const m = crearMundo();
    m.apiCaida = true;
    t.mock.method(globalThis, "fetch", m.fetch);
    const log = t.mock.method(console, "log", () => {});
    const error = t.mock.method(console, "error", () => {});
    await assert.rejects(
      worker.scheduled({ scheduledTime: Date.now(), cron: "*/2 * * * *" }, m.env, {}),
      /api_ilegible/
    );
    assert.equal(log.mock.callCount(), 0);
    assert.equal(error.mock.callCount(), 1);
  });
});
