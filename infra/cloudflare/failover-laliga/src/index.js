/**
 * Worker alhabla-failover-laliga: la parte de E/S.
 *
 * - scheduled (cron cada 2 minutos): lee la lista de bloqueos de hayahora, los
 *   tres CNAME por la API de Cloudflare, las IPs por DoH y el estado de KV;
 *   pregunta a conmutador.js qué hacer (y, antes de encender, confirma con el
 *   DNS de hayahora) y aplica los PATCH.
 * - fetch: GET /estado devuelve el último estado guardado (sin secretos).
 *   Cualquier otra ruta, 404. /estado nunca llama a la API ni a hayahora (así
 *   nadie puede gastar la cuota del token visitando la URL), guarda su
 *   respuesta 60 s por isolate (para no gastar la de KV) y, si existe el
 *   secreto ESTADO_TOKEN, lo exige.
 */

import {
  PARAMETROS_POR_DEFECTO,
  aplicarResultados,
  debeGuardarObservacion,
  decidir,
  esIpDeCloudflare,
  evaluarRespuestaLista,
  extraerIpsDoh,
  firmaInforme,
  fusionarIps,
  ipsEnLista,
  leerConfiguracion,
  mismoControl,
  normalizarControl,
  normalizarNombre,
  respuestaDohValida,
  resumirConfirmacion,
  seleccionarRegistros,
} from "./conmutador.js";

export const SERVICIO = "alhabla-failover-laliga";
export const URL_LISTA = "https://hayahora.futbol/estado/blocked-any.txt";
export const API_CLOUDFLARE = "https://api.cloudflare.com/client/v4";
export const CLAVE_CONTROL = "control";
export const CLAVE_OBSERVACION = "observacion";
/** DNS de hayahora: sus A/AAAA son las IPs bloqueadas en algún operador. */
export const NOMBRE_DNS_BLOQUEOS = "blocked.dns.hayahora.futbol";

/**
 * Resolvedores DoH. Google acepta edns_client_subnet: le pedimos la respuesta
 * que daría a un cliente de cada operadora española (subredes comprobadas en
 * el whois de RIPE). Comprobado el 10-10-2026 con dev-api.alhabla.ai (proxied
 * en la misma zona): Google, con cualquier ECS, y cloudflare-dns.com dan la
 * cara 188.114.96.x/97.x y 2a06:98c1:312x::; one.one.one.one (lo que usa
 * quien tiene 1.1.1.1, y lo que da el router de Orange) da la otra,
 * 104.21.57.158/172.67.191.30 y 2606:4700:303x::. Se pregunta a los dos de
 * Cloudflare por nombre, no por IP literal.
 */
export const RESOLVEDORES_DOH = Object.freeze([
  {
    nombre: "google-movistar",
    url: "https://dns.google/resolve",
    subred: "83.32.0.0/24", // RIMA, Telefónica de España
  },
  {
    nombre: "google-orange",
    url: "https://dns.google/resolve",
    subred: "90.165.0.0/24", // OrangeADSL
  },
  {
    nombre: "google-vodafone",
    url: "https://dns.google/resolve",
    subred: "77.208.0.0/24", // VODAFONE_SPAIN_NETWORK
  },
  {
    nombre: "google-digi",
    url: "https://dns.google/resolve",
    subred: "79.116.0.0/24", // Digi Spain Telecom
  },
  {
    nombre: "cloudflare",
    url: "https://cloudflare-dns.com/dns-query",
    subred: null,
  },
  {
    nombre: "cloudflare-1111",
    url: "https://one.one.one.one/dns-query",
    subred: null,
  },
]);

/** Para confirmar con el DNS de hayahora antes de encender (sin ECS). */
export const RESOLVEDORES_CONFIRMACION = Object.freeze([
  { nombre: "google", url: "https://dns.google/resolve", subred: null },
  {
    nombre: "cloudflare",
    url: "https://cloudflare-dns.com/dns-query",
    subred: null,
  },
]);

const PLAZOS_MS = { lista: 8000, api: 10000, doh: 5000 };
// Las IPs de Vercel se refrescan cuando puede hacer falta apagar o, si no,
// cada 6 horas (para /estado).
const REFRESCO_VERCEL_MS = 6 * 60 * 60 * 1000;
// Una sonda por ejecución, rotando entre los registros proxied: con 6
// resolvedores × A/AAAA son 12 consultas, y nos quedamos lejos del límite de
// 50 subpeticiones del plan gratuito.
const PERIODO_CRON_MS = PARAMETROS_POR_DEFECTO.periodoCronMs;

function describirError(error) {
  if (error?.name === "TimeoutError") return "plazo agotado";
  return error instanceof Error ? error.message : String(error);
}

// ─── hayahora ───────────────────────────────────────────────────────────────

async function leerLista(fetchImpl, ahora) {
  try {
    // El parámetro evita cualquier caché intermedia; Caddy lo ignora.
    const respuesta = await fetchImpl(`${URL_LISTA}?_=${ahora}`, {
      headers: {
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent": `${SERVICIO} (+https://alhabla.ai)`,
      },
      signal: AbortSignal.timeout(PLAZOS_MS.lista),
    });
    // En bytes, para compararlo con Content-Length (una lista cortada).
    const bytes = await respuesta.arrayBuffer();
    return {
      estado: respuesta.status,
      tipoContenido: respuesta.headers.get("content-type"),
      ultimaModificacion: respuesta.headers.get("last-modified"),
      longitudDeclarada: respuesta.headers.get("content-length"),
      codificacion: respuesta.headers.get("content-encoding"),
      bytesRecibidos: bytes.byteLength,
      cuerpo: new TextDecoder().decode(bytes),
    };
  } catch (error) {
    return { error: describirError(error) };
  }
}

// ─── API de Cloudflare ──────────────────────────────────────────────────────

async function llamarApi(fetchImpl, token, ruta, init = {}) {
  const metodo = init.method ?? "GET";
  const respuesta = await fetchImpl(`${API_CLOUDFLARE}${ruta}`, {
    ...init,
    method: metodo,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(PLAZOS_MS.api),
  });
  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    cuerpo = null;
  }
  if (!respuesta.ok || cuerpo?.success !== true) {
    const detalle =
      (cuerpo?.errors ?? []).map((e) => `${e.code}: ${e.message}`).join("; ") ||
      "sin detalle";
    throw new Error(
      `API de Cloudflare ${respuesta.status} en ${metodo} ${ruta}: ${detalle}`
    );
  }
  return cuerpo;
}

async function listarCnames(fetchImpl, token, zoneId) {
  const registros = [];
  for (let pagina = 1; pagina <= 20; pagina++) {
    const cuerpo = await llamarApi(
      fetchImpl,
      token,
      `/zones/${zoneId}/dns_records?type=CNAME&per_page=100&page=${pagina}`
    );
    registros.push(...(Array.isArray(cuerpo.result) ? cuerpo.result : []));
    if (pagina >= (cuerpo.result_info?.total_pages ?? 1)) break;
  }
  return registros;
}

async function parchearRegistro(fetchImpl, token, zoneId, cambio) {
  try {
    const cuerpo = await llamarApi(
      fetchImpl,
      token,
      `/zones/${zoneId}/dns_records/${encodeURIComponent(cambio.id)}`,
      { method: "PATCH", body: JSON.stringify(cambio.cuerpo) }
    );
    if (cuerpo.result?.proxied !== cambio.cuerpo.proxied) {
      return {
        nombre: cambio.nombre,
        ok: false,
        error: "la API respondió bien pero proxied no cambió",
      };
    }
    // El modified_on de NUESTRO cambio: si luego aparece otro, fue un humano.
    return {
      nombre: cambio.nombre,
      ok: true,
      modificadoEn: cuerpo.result?.modified_on ?? null,
    };
  } catch (error) {
    return { nombre: cambio.nombre, ok: false, error: describirError(error) };
  }
}

// ─── DoH ────────────────────────────────────────────────────────────────────

/** La respuesta JSON de un resolvedor, si es una respuesta de verdad. */
async function consultarDoh(fetchImpl, resolvedor, nombre, tipo) {
  const parametros = new URLSearchParams({ name: nombre, type: tipo });
  if (resolvedor.subred) {
    parametros.set("edns_client_subnet", resolvedor.subred);
  }
  const respuesta = await fetchImpl(`${resolvedor.url}?${parametros}`, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(PLAZOS_MS.doh),
  });
  if (!respuesta.ok) {
    throw new Error(`${resolvedor.nombre} respondió ${respuesta.status}`);
  }
  const datos = await respuesta.json();
  // HTTP 200 con SERVFAIL o REFUSED no es «sin IPs»: es un fallo.
  if (!respuestaDohValida(datos)) {
    throw new Error(`${resolvedor.nombre} devolvió Status ${datos?.Status}`);
  }
  return datos;
}

/** A y AAAA de `nombre` a cada resolvedor: respuestas válidas y fallos. */
async function preguntar(fetchImpl, nombre, resolvedores) {
  const consultas = resolvedores.flatMap((resolvedor) =>
    ["A", "AAAA"].map((tipo) => ({
      resolvedor: resolvedor.nombre,
      tipo,
      promesa: consultarDoh(fetchImpl, resolvedor, nombre, tipo),
    }))
  );
  const resultados = await Promise.allSettled(consultas.map((c) => c.promesa));
  const respuestas = [];
  const fallidos = new Set();
  resultados.forEach((resultado, i) => {
    if (resultado.status === "fulfilled") {
      respuestas.push({ tipo: consultas[i].tipo, datos: resultado.value });
    } else {
      fallidos.add(consultas[i].resolvedor);
    }
  });
  return {
    respuestas,
    fallos: consultas.length - respuestas.length,
    consultas: consultas.length,
    resolvedoresConFallos: [...fallidos].sort(),
  };
}

async function resolver(fetchImpl, nombre) {
  const resolucion = await preguntar(fetchImpl, nombre, RESOLVEDORES_DOH);
  const ips = new Set();
  for (const { datos } of resolucion.respuestas) {
    for (const ip of extraerIpsDoh(datos)) ips.add(ip);
  }
  return { ...resolucion, ips: [...ips].sort() };
}

/** Aviso si falla algún resolvedor (no solo si fallan todos). */
function avisarDohDegradado(resumen, contexto, resolucion) {
  if (resolucion.fallos > 0 && resolucion.fallos < resolucion.consultas) {
    resumen.avisos.push(
      `${contexto}_doh_degradado:${resolucion.resolvedoresConFallos.join(",")}`
    );
  }
}

/**
 * Antes de encender, el DNS de hayahora (otro canal: lo sirve DigitalOcean,
 * no el servidor web de la lista) tiene que decir lo mismo que la lista.
 * Vale si, para A y para AAAA, contestó bien al menos un resolvedor; si está
 * al día y cuadra con la lista lo mira decidir (resumirConfirmacion).
 */
async function consultarDnsDeBloqueos(fetchImpl, ahora) {
  const resolucion = await preguntar(
    fetchImpl,
    NOMBRE_DNS_BLOQUEOS,
    RESOLVEDORES_CONFIRMACION
  );
  const confirmacion = resumirConfirmacion(resolucion.respuestas, ahora);
  delete resolucion.respuestas;
  if (!confirmacion.ok) {
    return {
      ok: false,
      error: `${NOMBRE_DNS_BLOQUEOS} sin respuesta válida`,
      resolucion,
    };
  }
  return { ...confirmacion, resolucion };
}

// ─── KV ─────────────────────────────────────────────────────────────────────

async function leerKv(kv, clave) {
  try {
    return { ok: true, valor: await kv.get(clave, "json") };
  } catch (error) {
    return { ok: false, error: describirError(error) };
  }
}

async function escribirKv(kv, clave, valor) {
  try {
    await kv.put(clave, JSON.stringify(valor));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describirError(error) };
  }
}

// ─── Ciclo ──────────────────────────────────────────────────────────────────

/**
 * Una ejecución completa. Nunca lanza: devuelve el resumen, que también se
 * escribe como UNA línea JSON (console.log, o console.error si algo falló).
 *
 * deps (para los tests): { fetch, ahora, registro }.
 */
export async function ejecutarCiclo(env, deps = {}) {
  const fetchImpl = deps.fetch ?? ((...args) => fetch(...args));
  const registro = deps.registro ?? console;
  const ahora = deps.ahora ?? Date.now();
  const inicio = Date.now();
  const ahoraIso = new Date(ahora).toISOString();
  const resumen = {
    servicio: SERVICIO,
    evento: "ciclo",
    nivel: "info",
    en: ahoraIso,
    modo: null,
    accion: "ninguna",
    motivo: null,
    simulado: false,
    errores: [],
    avisos: [],
  };
  const error = (fase, mensaje, extra = {}) =>
    resumen.errores.push({ fase, mensaje, ...extra });

  try {
    await ciclo(env, { fetchImpl, ahora, ahoraIso, resumen, error });
  } catch (fallo) {
    error("inesperado", describirError(fallo), {
      pila: fallo instanceof Error ? fallo.stack : undefined,
    });
  }

  if (resumen.errores.length || resumen.gravedad === "error") {
    resumen.nivel = "error";
  } else if (resumen.avisos.length || resumen.gravedad === "aviso") {
    resumen.nivel = "aviso";
  }
  delete resumen.gravedad;
  resumen.duracionMs = Date.now() - inicio;
  const linea = JSON.stringify(resumen);
  if (resumen.nivel === "error") registro.error(linea);
  else registro.log(linea);
  return resumen;
}

async function ciclo(env, { fetchImpl, ahora, ahoraIso, resumen, error }) {
  const config = leerConfiguracion(env);
  resumen.modo = config.modo;
  if (config.errores.length) {
    resumen.motivo = "configuracion_invalida";
    for (const mensaje of config.errores) error("configuracion", mensaje);
    return;
  }
  const kv = env.ESTADO;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    resumen.motivo = "configuracion_invalida";
    error("configuracion", "falta el namespace KV con binding ESTADO");
    return;
  }
  const token = env.CF_API_TOKEN;

  // 1. Lecturas en paralelo.
  const [controlLeido, observacionLeida, respuestaLista, registrosApi] =
    await Promise.all([
      leerKv(kv, CLAVE_CONTROL),
      leerKv(kv, CLAVE_OBSERVACION),
      leerLista(fetchImpl, ahora),
      listarCnames(fetchImpl, token, config.zoneId).then(
        (valor) => ({ ok: true, valor }),
        (fallo) => ({ ok: false, error: describirError(fallo) })
      ),
    ]);

  // Sin KV no sabemos si la marca es nuestra: no se toca nada.
  if (!controlLeido.ok || !observacionLeida.ok) {
    resumen.motivo = "kv_ilegible";
    if (!controlLeido.ok) error("kv_leer_control", controlLeido.error);
    if (!observacionLeida.ok) {
      error("kv_leer_observacion", observacionLeida.error);
    }
    return;
  }
  if (!registrosApi.ok) {
    resumen.motivo = "api_ilegible";
    error("api_leer_registros", registrosApi.error);
    return;
  }

  const lista = evaluarRespuestaLista(respuestaLista, { ahora });
  resumen.lista = {
    valida: lista.valida,
    motivo: lista.motivo,
    detalle: lista.detalle ?? null,
    entradas: lista.total,
    ultimaModificacion: lista.ultimaModificacion ?? null,
  };
  if (!lista.valida) {
    resumen.avisos.push(`lista_invalida:${lista.motivo}`);
  }

  const seleccion = seleccionarRegistros(registrosApi.valor, config.hostnames);
  const seleccionCompleta =
    seleccion.faltan.length === 0 && seleccion.duplicados.length === 0;
  const anterior = observacionLeida.valor ?? {};

  // 2. IPs de Cloudflare: solo se pueden ver con el proxy encendido.
  const encendidos = seleccion.registros.filter((r) => r.proxied);
  let vistasCloudflare = [];
  if (seleccionCompleta && encendidos.length) {
    const sonda =
      encendidos[Math.floor(ahora / PERIODO_CRON_MS) % encendidos.length];
    const resolucion = await resolver(fetchImpl, sonda.name);
    vistasCloudflare = resolucion.ips.filter(esIpDeCloudflare);
    resumen.sonda = {
      nombre: sonda.name,
      ipsCloudflare: vistasCloudflare,
      otras: resolucion.ips.filter((ip) => !esIpDeCloudflare(ip)),
      fallos: resolucion.fallos,
      consultas: resolucion.consultas,
      resolvedoresConFallos: resolucion.resolvedoresConFallos,
    };
    if (resolucion.fallos === resolucion.consultas) {
      resumen.avisos.push("doh_sin_respuesta_para_la_sonda");
    }
    avisarDohDegradado(resumen, "sonda", resolucion);
  }
  const ipsCloudflare = fusionarIps(
    anterior.ipsCloudflare,
    vistasCloudflare,
    ahora,
    PARAMETROS_POR_DEFECTO.caducidadIpMs
  );

  // 3. IPs de Vercel (destino de los CNAME, uno solo: si son distintos,
  // decidir se niega): frescas cuando podríamos apagar.
  let ipsVercel = fusionarIps(anterior.ipsVercel, [], ahora, 0);
  let vercelActualizadoEn = anterior.vercelActualizadoEn ?? null;
  const podriaApagar =
    lista.valida &&
    encendidos.length > 0 &&
    ipsEnLista(Object.keys(ipsCloudflare), lista.entradas).length > 0;
  const vercelViejo =
    !Number.isFinite(Date.parse(vercelActualizadoEn)) ||
    ahora - Date.parse(vercelActualizadoEn) > REFRESCO_VERCEL_MS;
  const destinos = [
    ...new Set(seleccion.registros.map((r) => normalizarNombre(r.content))),
  ];
  if (
    seleccionCompleta &&
    destinos.length === 1 &&
    (podriaApagar || vercelViejo)
  ) {
    const resolucion = await resolver(fetchImpl, destinos[0]);
    avisarDohDegradado(resumen, "vercel", resolucion);
    const frescas = resolucion.ips.filter((ip) => !esIpDeCloudflare(ip));
    if (frescas.length) {
      // Se sustituyen: para decidir valen las que Vercel da hoy.
      ipsVercel = fusionarIps({}, frescas, ahora, 0);
      vercelActualizadoEn = ahoraIso;
    } else {
      resumen.avisos.push("doh_sin_ips_de_vercel");
    }
  }

  // 4. Decisión (y, si toca encender, confirmación con el DNS de hayahora).
  const entradaDecision = {
    ahora,
    hostnames: config.hostnames,
    registros: registrosApi.valor,
    lista,
    ipsCloudflare: Object.keys(ipsCloudflare),
    ipsVercel: Object.keys(ipsVercel),
    control: controlLeido.valor,
    inoperativoDesde: anterior.inoperativoDesde ?? null,
    operativoDesde: anterior.operativoDesde ?? null,
  };
  let decision = decidir(entradaDecision);
  if (decision.pideConfirmacion) {
    const confirmacion = await consultarDnsDeBloqueos(fetchImpl, ahora);
    decision = decidir({ ...entradaDecision, confirmacion });
    resumen.confirmacion = {
      ok: confirmacion.ok,
      ...(confirmacion.error ? { error: confirmacion.error } : {}),
      ipsEnDns: confirmacion.ok ? confirmacion.ips.length : null,
      // Familias sin IPs en el DNS: desde cuándo (como muy pronto) está esa
      // respuesta negativa en la caché del resolvedor.
      negativaDesde: confirmacion.ok
        ? Object.fromEntries(
            Object.entries(confirmacion.negativaDesde).map(([familia, ms]) => [
              `ipv${familia}`,
              ms === null ? null : new Date(ms).toISOString(),
            ])
          )
        : null,
      bloqueadasNuestras: decision.bloqueadasEnDns,
      fallos: confirmacion.resolucion.fallos,
      consultas: confirmacion.resolucion.consultas,
    };
    avisarDohDegradado(resumen, "confirmacion", confirmacion.resolucion);
  }
  resumen.accion = decision.accion;
  resumen.motivo = decision.motivo;
  resumen.gravedad = decision.gravedad;
  resumen.estadoProxy = decision.estadoProxy;
  resumen.proxied = Object.fromEntries(
    decision.registros.map((r) => [r.nombre, r.proxied])
  );
  resumen.bloqueadasNuestras = decision.bloqueadasNuestras;
  resumen.vercelBloqueadas = decision.vercelBloqueadas;
  resumen.ipsCloudflare = Object.keys(ipsCloudflare);
  resumen.ipsVercel = Object.keys(ipsVercel);
  resumen.detalles = decision.detalles;
  if (decision.inoperativoDesde) {
    resumen.inoperativoDesde = decision.inoperativoDesde;
  }
  if (decision.faltan?.length) resumen.faltan = decision.faltan;
  if (decision.duplicados?.length) resumen.duplicados = decision.duplicados;
  if (decision.noVercel?.length) resumen.noVercel = decision.noVercel;
  if (decision.destinos?.length) resumen.destinos = decision.destinos;
  resumen.avisos.push(...decision.avisos);

  // 5. Aplicar.
  const activo = config.modo === "activo";
  resumen.simulado = !activo && decision.cambios.length > 0;
  let resultados = [];
  let controlGuardado = decision.controlPrevio;
  let kvFiable = true;
  if (activo && decision.cambios.length) {
    let seguir = true;
    if (decision.escribirControlAntes) {
      // La marca va antes que el PATCH. Si no se puede guardar, no se apaga:
      // un apagado sin marca parecería hecho a mano y no se volvería a
      // encender solo.
      const escrito = await escribirKv(kv, CLAVE_CONTROL, decision.control);
      if (escrito.ok) {
        controlGuardado = decision.control;
      } else {
        seguir = false;
        kvFiable = false;
        error("kv_guardar_marca", escrito.error);
      }
    }
    if (seguir) {
      for (const cambio of decision.cambios) {
        resultados.push(
          await parchearRegistro(fetchImpl, token, config.zoneId, cambio)
        );
      }
    }
  }
  resumen.cambios = decision.cambios.map((cambio) => {
    const resultado = resultados.find((r) => r.nombre === cambio.nombre);
    return {
      nombre: cambio.nombre,
      cuerpo: cambio.cuerpo,
      ok: resultado?.ok ?? false,
      ...(resultado?.error ? { error: resultado.error } : {}),
      ...(activo ? {} : { simulado: true }),
    };
  });
  for (const resultado of resultados) {
    if (!resultado.ok) {
      error("api_patch", resultado.error, { registro: resultado.nombre });
    }
  }

  // 6. Control final (solo en modo activo y si KV acepta escrituras).
  let controlFinal = controlGuardado;
  if (activo && kvFiable) {
    controlFinal = aplicarResultados(decision, resultados);
    if (!mismoControl(controlFinal, controlGuardado)) {
      const escrito = await escribirKv(kv, CLAVE_CONTROL, controlFinal);
      if (!escrito.ok) error("kv_guardar_control", escrito.error);
    }
  }
  resumen.limpiasSeguidas = controlFinal.limpiasSeguidas;
  resumen.limpioDesde = controlFinal.limpioDesde ?? null;
  resumen.marca = controlFinal.marca;

  // 7. Observación para /estado.
  const informe = {
    en: ahoraIso,
    modo: config.modo,
    accion: decision.accion,
    motivo: decision.motivo,
    estadoProxy: decision.estadoProxy,
    proxied: resumen.proxied,
    bloqueadasNuestras: decision.bloqueadasNuestras,
    vercelBloqueadas: decision.vercelBloqueadas,
    lista: resumen.lista,
    cambios: resumen.cambios,
    errores: resumen.errores.length,
  };
  informe.firma = firmaInforme(informe);
  const observacion = {
    version: 1,
    ipsCloudflare,
    ipsVercel,
    vercelActualizadoEn,
    // Desde cuándo no puede decidir (lista inválida, sin IPs…): pasado el
    // umbral, cada ejecución sale como error. Y desde cuándo vuelve a poder:
    // la cuenta se borra con dos ejecuciones buenas seguidas.
    inoperativoDesde: decision.inoperativoDesde ?? null,
    operativoDesde: decision.operativoDesde ?? null,
    informe,
    guardadaEn: ahoraIso,
  };
  if (
    debeGuardarObservacion(
      observacionLeida.valor,
      observacion,
      ahora,
      PARAMETROS_POR_DEFECTO.latidoObservacionMs
    )
  ) {
    const escrito = await escribirKv(kv, CLAVE_OBSERVACION, observacion);
    if (!escrito.ok) {
      resumen.avisos.push(`kv_guardar_observacion:${escrito.error}`);
    }
  }
}

// ─── /estado ────────────────────────────────────────────────────────────────
//
// /estado solo lee KV, pero KV del plan gratuito da 100.000 lecturas al día y
// la URL de workers.dev es pública: cada isolate guarda la respuesta 60 s, así
// que una avalancha de visitas no se come la cuota que necesita el cron. Con
// el secreto opcional ESTADO_TOKEN, además, sin la cabecera
// `Authorization: Bearer <token>` responde 401 sin leer nada.

const VIDA_CACHE_ESTADO_MS = 60 * 1000;
let cacheEstado = null; // { hasta, cuerpo }

/** Para los tests: olvida la respuesta guardada de /estado. */
export function vaciarCacheEstado() {
  cacheEstado = null;
}

function json(cuerpo, estado = 200, cabeceras = {}) {
  return new Response(JSON.stringify(cuerpo, null, 2), {
    status: estado,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cabeceras,
    },
  });
}

async function resumenSha256(texto) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto))
  );
}

/** Compara el token en tiempo constante (sobre los SHA-256, misma longitud). */
async function tokenValido(peticion, esperado) {
  const cabecera = peticion.headers.get("authorization") ?? "";
  const recibido = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : "";
  const [a, b] = await Promise.all([
    resumenSha256(recibido),
    resumenSha256(esperado),
  ]);
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a[i] ^ b[i];
  return diferencia === 0;
}

export async function responderEstado(env, ahora = Date.now()) {
  if (cacheEstado && ahora < cacheEstado.hasta) return json(cacheEstado.cuerpo);
  let controlBruto;
  let observacion;
  try {
    [controlBruto, observacion] = await Promise.all([
      env.ESTADO.get(CLAVE_CONTROL, "json"),
      env.ESTADO.get(CLAVE_OBSERVACION, "json"),
    ]);
  } catch (fallo) {
    return json(
      { servicio: SERVICIO, error: "no se pudo leer el estado de KV" },
      503
    );
  }
  const { control } = normalizarControl(controlBruto);
  const config = leerConfiguracion(env);
  const informe = observacion?.informe ?? null;
  const cuerpo = {
    servicio: SERVICIO,
    generadoEn: new Date(ahora).toISOString(),
    modo: config.modo,
    hostnames: config.hostnames,
    ultimaEjecucionGuardada: informe?.en ?? null,
    decision: informe
      ? { accion: informe.accion, motivo: informe.motivo }
      : null,
    estadoProxy: informe?.estadoProxy ?? null,
    proxied: informe?.proxied ?? null,
    ipsConocidas: {
      cloudflare: Object.keys(observacion?.ipsCloudflare ?? {}),
      vercel: Object.keys(observacion?.ipsVercel ?? {}),
    },
    bloqueadasQueNosAfectan: informe?.bloqueadasNuestras ?? [],
    vercelBloqueadas: informe?.vercelBloqueadas ?? [],
    lista: informe?.lista ?? null,
    inoperativoDesde: observacion?.inoperativoDesde ?? null,
    marcaDelConmutador: control.marca,
    ultimoCambio: control.ultimoCambio,
    ejecucionesLimpiasSeguidas: control.limpiasSeguidas,
    limpioDesde: control.limpioDesde,
  };
  cacheEstado = { hasta: ahora + VIDA_CACHE_ESTADO_MS, cuerpo };
  return json(cuerpo);
}

export default {
  async scheduled(controlador, env, ctx) {
    const resumen = await ejecutarCiclo(env);
    // Fallo visible en las métricas del Worker (el log ya salió arriba).
    if (resumen.nivel === "error") {
      throw new Error(
        `[${SERVICIO}] ${resumen.motivo ?? "error"}: ` +
          (resumen.errores.length
            ? resumen.errores.map((e) => `${e.fase}: ${e.mensaje}`).join(" | ")
            : `inoperativo desde ${resumen.inoperativoDesde ?? "?"}`)
      );
    }
  },

  async fetch(peticion, env) {
    const url = new URL(peticion.url);
    if (peticion.method === "GET" && url.pathname === "/estado") {
      if (env.ESTADO_TOKEN && !(await tokenValido(peticion, env.ESTADO_TOKEN))) {
        return json({ servicio: SERVICIO, error: "no autorizado" }, 401, {
          "www-authenticate": "Bearer",
        });
      }
      return responderEstado(env);
    }
    return new Response("No encontrado\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  },
};
