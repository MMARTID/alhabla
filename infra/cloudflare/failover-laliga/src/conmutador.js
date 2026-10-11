/**
 * Conmutador de failover para los bloqueos de LaLiga: lógica PURA.
 *
 * Aquí no hay fetch, ni KV, ni reloj. Todo lo que hace falta para decidir
 * entra por parámetros (la hora incluida) y la decisión sale como datos.
 * La E/S (hayahora, API de Cloudflare, DoH y KV) vive en index.js.
 *
 * Idea general: mientras las operadoras bloquean alguna IP de Cloudflare que
 * reciben nuestros usuarios, los tres CNAME de las webs pasan a DNS-only
 * (proxied=false) y Vercel las sirve directamente con su certificado. Cuando
 * el bloqueo acaba, el conmutador vuelve a encender el proxy, pero solo en los
 * registros que apagó él mismo (la «marca» en KV, por nombre de registro).
 */

// ─── Parámetros ─────────────────────────────────────────────────────────────

const MINUTO_MS = 60 * 1000;

export const PARAMETROS_POR_DEFECTO = Object.freeze({
  // No apaga si hubo un cambio (nuestro o de un humano) hace menos de esto.
  antirreboteMs: 10 * MINUTO_MS,
  // No enciende antes de que pase esto desde que apagó cada registro.
  esperaMinimaEncenderMs: 15 * MINUTO_MS,
  // Ejecuciones seguidas, con lista válida, sin nuestras IPs en la lista.
  ejecucionesLimpiasNecesarias: 2,
  // Y esa racha limpia tiene que durar al menos esto: un hueco corto en la
  // lista (o una lista vacía por un fallo de hayahora) no basta para encender.
  tiempoLimpioMinimoMs: 10 * MINUTO_MS,
  // El cron. Entre dos observaciones limpias de una racha puede faltar como
  // mucho UNA ejecución (lista inválida, API o KV ilegibles, cron que no
  // corrió): con un hueco mayor el bloqueo pudo volver sin que lo viéramos y
  // la racha empieza de nuevo.
  periodoCronMs: 2 * MINUTO_MS,
  huecoMaximoRachaMs: 5 * MINUTO_MS,
  ttlApagado: 60,
  ttlEncendido: 1, // 1 = automático en la API de Cloudflare
  // Una IP de Cloudflare que no vemos en 30 días deja de ser «nuestra».
  caducidadIpMs: 30 * 24 * 60 * MINUTO_MS,
  // La observación (IPs conocidas e informe para /estado) se guarda cuando
  // cambia algo relevante o, como mucho, cada 10 minutos.
  latidoObservacionMs: 10 * MINUTO_MS,
  // Si más del 10 % de las líneas no son IPs, la lista no es lo que creemos.
  maxProporcionLineasInvalidas: 0.1,
  maxBytesLista: 1024 * 1024,
  // hayahora reescribe el fichero cada ~30 s (Last-Modified va 1-2 min por
  // detrás): uno con más de 15 minutos es una lista congelada. Sin
  // Last-Modified, o con uno de más de 2 minutos en el futuro, tampoco vale.
  maxAntiguedadListaMs: 15 * MINUTO_MS,
  maxAdelantoListaMs: 2 * MINUTO_MS,
  // Si el conmutador lleva esto sin poder decidir (lista inválida, sin IPs,
  // sin confirmación), el aviso pasa a error (console.error y la invocación
  // falla en las métricas).
  umbralInoperativoMs: 10 * MINUTO_MS,
  // Y esa cuenta solo se borra con dos ejecuciones buenas seguidas (la
  // segunda, al menos esto después de la primera): con una buena de cada dos
  // nunca llegaría a error.
  recuperacionMs: 2 * MINUTO_MS,
});

/** Registros que el conmutador no puede tocar jamás, aunque se configuren. */
export const HOSTNAMES_PROHIBIDOS = Object.freeze([
  "api.alhabla.ai",
  "dev-api.alhabla.ai",
]);

/** Rangos publicados por Cloudflare (cloudflare.com/ips-v4 e ips-v6). */
export const RANGOS_CLOUDFLARE = Object.freeze([
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c1::/32",
  "2c0f:f248::/32",
]);

// ─── Direcciones IP ─────────────────────────────────────────────────────────
//
// Dos representaciones de una IP ya analizada:
// - «básica»: { familia: 4, octetos: [4 números] } o { familia: 6, grupos:
//   [8 números] }. Sirve para la forma canónica sin BigInt, que es lo que se
//   hace con cada línea de la lista (la CPU de un cron es escasa).
// - { familia, valor: BigInt }: solo para rangos (CIDR y «desde-hasta»).

const MAX_IPV4 = (1n << 32n) - 1n;
const MAX_IPV6 = (1n << 128n) - 1n;
const PATRON_IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const PATRON_GRUPO = /^[0-9a-f]{1,4}$/;

function octetosIpv4(texto) {
  const partes = PATRON_IPV4.exec(texto);
  if (!partes) return null;
  const octetos = [
    Number(partes[1]),
    Number(partes[2]),
    Number(partes[3]),
    Number(partes[4]),
  ];
  for (const octeto of octetos) if (octeto > 255) return null;
  return octetos;
}

function gruposIpv6(texto) {
  let t = texto;
  // IPv4 incrustada al final (p. ej. ::ffff:188.114.96.5): la pasamos a dos
  // grupos hexadecimales y seguimos como si nada.
  if (t.includes(".")) {
    const corte = t.lastIndexOf(":");
    const o = octetosIpv4(t.slice(corte + 1));
    if (!o) return null;
    t =
      t.slice(0, corte + 1) +
      ((o[0] << 8) | o[1]).toString(16) +
      ":" +
      ((o[2] << 8) | o[3]).toString(16);
  }
  const mitades = t.split("::");
  if (mitades.length > 2) return null;
  const izquierda = mitades[0] === "" ? [] : mitades[0].split(":");
  const derecha =
    mitades.length === 2 && mitades[1] !== "" ? mitades[1].split(":") : [];
  const total = izquierda.length + derecha.length;
  if (mitades.length === 2 ? total > 7 : total !== 8) return null;
  const grupos = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < izquierda.length; i++) {
    if (!PATRON_GRUPO.test(izquierda[i])) return null;
    grupos[i] = parseInt(izquierda[i], 16);
  }
  for (let i = 0; i < derecha.length; i++) {
    if (!PATRON_GRUPO.test(derecha[i])) return null;
    grupos[8 - derecha.length + i] = parseInt(derecha[i], 16);
  }
  return grupos;
}

function limpiarTextoIp(texto) {
  let t = texto.trim().toLowerCase();
  if (t.startsWith("[") && t.endsWith("]")) t = t.slice(1, -1);
  const zona = t.indexOf("%");
  if (zona !== -1) t = t.slice(0, zona);
  return t;
}

function analizarBasicaSinMapear(texto) {
  const t = limpiarTextoIp(texto);
  if (t.includes(":")) {
    const grupos = gruposIpv6(t);
    return grupos ? { familia: 6, grupos } : null;
  }
  const octetos = octetosIpv4(t);
  return octetos ? { familia: 4, octetos } : null;
}

/** Una IPv4 mapeada en IPv6 (::ffff:a.b.c.d) se trata como IPv4. */
function analizarBasica(texto) {
  if (typeof texto !== "string") return null;
  const ip = analizarBasicaSinMapear(texto);
  if (!ip || ip.familia === 4) return ip;
  const g = ip.grupos;
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0) {
    if (g[5] === 0xffff) {
      return {
        familia: 4,
        octetos: [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255],
      };
    }
  }
  return ip;
}

function aValor(basica) {
  if (basica.familia === 4) {
    const [a, b, c, d] = basica.octetos;
    return { familia: 4, valor: BigInt(a * 16777216 + b * 65536 + c * 256 + d) };
  }
  let valor = 0n;
  for (const grupo of basica.grupos) valor = (valor << 16n) | BigInt(grupo);
  return { familia: 6, valor };
}

/** RFC 5952: se comprime la racha de ceros más larga (de dos o más grupos). */
function formatearGrupos(grupos) {
  let mejorInicio = -1;
  let mejorLargo = 0;
  for (let i = 0; i < 8; ) {
    if (grupos[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && grupos[j] === 0) j++;
    if (j - i >= 2 && j - i > mejorLargo) {
      mejorInicio = i;
      mejorLargo = j - i;
    }
    i = j;
  }
  const hex = grupos.map((g) => g.toString(16));
  if (mejorInicio === -1) return hex.join(":");
  const izquierda = hex.slice(0, mejorInicio).join(":");
  const derecha = hex.slice(mejorInicio + mejorLargo).join(":");
  return `${izquierda}::${derecha}`;
}

function formatearBasica(basica) {
  return basica.familia === 4
    ? basica.octetos.join(".")
    : formatearGrupos(basica.grupos);
}

/**
 * Analiza una IP suelta. Devuelve { familia: 4|6, valor: BigInt } o null.
 * Una IPv4 mapeada en IPv6 (::ffff:a.b.c.d) se trata como IPv4.
 */
export function analizarIp(texto) {
  const basica = analizarBasica(texto);
  return basica ? aValor(basica) : null;
}

/** Texto canónico de una IP ya analizada ({ familia, valor }). */
export function formatearIp(ip) {
  if (ip.familia === 4) {
    return [24n, 16n, 8n, 0n]
      .map((desplazamiento) => String((ip.valor >> desplazamiento) & 255n))
      .join(".");
  }
  const grupos = [];
  for (let i = 7; i >= 0; i--) {
    grupos.push(Number((ip.valor >> BigInt(i * 16)) & 0xffffn));
  }
  return formatearGrupos(grupos);
}

/** Normaliza una IP a su forma canónica, o null si no lo es (sin BigInt). */
export function normalizarIp(texto) {
  const basica = analizarBasica(texto);
  return basica ? formatearBasica(basica) : null;
}

/**
 * Analiza una entrada de lista: IP suelta, CIDR (a.b.c.d/n, x::/n) o rango
 * «desde-hasta». Devuelve { familia, inicio, fin } (BigInt) o null.
 */
export function analizarRango(texto) {
  if (typeof texto !== "string") return null;
  const t = texto.trim().toLowerCase();
  const barra = t.indexOf("/");
  if (barra !== -1) {
    const basica = analizarBasicaSinMapear(t.slice(0, barra));
    const prefijoTexto = t.slice(barra + 1);
    if (!basica || !/^\d{1,3}$/.test(prefijoTexto)) return null;
    const base = aValor(basica);
    const bits = base.familia === 4 ? 32 : 128;
    const prefijo = Number(prefijoTexto);
    if (prefijo > bits) return null;
    const maximo = base.familia === 4 ? MAX_IPV4 : MAX_IPV6;
    const host = (1n << BigInt(bits - prefijo)) - 1n;
    const inicio = base.valor & (maximo ^ host);
    return { familia: base.familia, inicio, fin: inicio | host };
  }
  const guion = t.indexOf("-");
  if (guion !== -1) {
    const desde = analizarIp(t.slice(0, guion));
    const hasta = analizarIp(t.slice(guion + 1));
    if (!desde || !hasta || desde.familia !== hasta.familia) return null;
    if (desde.valor > hasta.valor) return null;
    return { familia: desde.familia, inicio: desde.valor, fin: hasta.valor };
  }
  const ip = analizarIp(t);
  return ip ? { familia: ip.familia, inicio: ip.valor, fin: ip.valor } : null;
}

function ipEnRangos(ip, rangos) {
  return rangos.some(
    (r) => r.familia === ip.familia && r.inicio <= ip.valor && ip.valor <= r.fin
  );
}

const RANGOS_CLOUDFLARE_ANALIZADOS = RANGOS_CLOUDFLARE.map(analizarRango);

/** ¿Está la IP en los rangos publicados de Cloudflare? */
export function esIpDeCloudflare(texto) {
  const ip = analizarIp(texto);
  return ip ? ipEnRangos(ip, RANGOS_CLOUDFLARE_ANALIZADOS) : false;
}

/** Índice vacío de una lista: { exactas: Set de IPs canónicas, rangos }. */
function indiceVacio() {
  return { exactas: new Set(), rangos: [] };
}

/**
 * Índice de una lista de IPs sueltas (p. ej. la respuesta DNS de hayahora,
 * que puede traer cientos). Las IPv4 ya canónicas entran tal cual, sin
 * analizarlas, como en analizarLista.
 */
export function indiceDeIps(ips) {
  const indice = indiceVacio();
  for (const valor of ips ?? []) {
    const texto = String(valor);
    const clave = IPV4_CANONICA.test(texto) ? texto : normalizarIp(texto);
    if (clave) indice.exactas.add(clave);
  }
  return indice;
}

/**
 * Las IPs (normalizadas, sin repetir, ordenadas) que caen en la lista.
 * `entradas` es el índice { exactas, rangos } de analizarLista (o, por
 * comodidad, un array de rangos).
 */
export function ipsEnLista(ips, entradas) {
  const indice = Array.isArray(entradas)
    ? { exactas: new Set(), rangos: entradas }
    : entradas ?? indiceVacio();
  const exactas = indice.exactas ?? new Set();
  const rangos = indice.rangos ?? [];
  const resultado = new Set();
  for (const texto of ips ?? []) {
    const basica = analizarBasica(texto);
    if (!basica) continue;
    const clave = formatearBasica(basica);
    if (
      exactas.has(clave) ||
      (rangos.length > 0 && ipEnRangos(aValor(basica), rangos))
    ) {
      resultado.add(clave);
    }
  }
  return [...resultado].sort();
}

function ipsUnicas(ips) {
  const resultado = new Set();
  for (const texto of ips ?? []) {
    const normalizada = normalizarIp(texto);
    if (normalizada) resultado.add(normalizada);
  }
  return [...resultado].sort();
}

// ─── Lista de bloqueos (hayahora.futbol) ────────────────────────────────────

const SEPARADORES = /[\s,;]/;
const OCTETO_CANONICO = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
// Una IPv4 ya escrita en forma canónica (sin ceros a la izquierda): casi todas
// las líneas del fichero real. Se guarda tal cual, sin analizarla.
const IPV4_CANONICA = new RegExp(
  `^${OCTETO_CANONICO}(?:\\.${OCTETO_CANONICO}){3}$`
);

/**
 * Analiza el texto de blocked-any.txt: una IP (o rango) por línea. Admite
 * comentarios con #, líneas en blanco, CRLF, BOM y columnas extra (se toma
 * la primera).
 *
 * Las IPs sueltas (casi todo el fichero) van a un Set con su forma canónica,
 * sin BigInt (las IPv4 ya canónicas, con una sola regex); solo los CIDR y
 * rangos «desde-hasta» se analizan con BigInt. Así una lista de miles de
 * líneas cabe holgada en los 10 ms de CPU de un cron del plan gratuito.
 */
export function analizarLista(texto) {
  const entradas = indiceVacio();
  const invalidas = [];
  let lineasConContenido = 0;
  let total = 0;
  const limpio = String(texto ?? "").replace(/^﻿/, "");
  for (const bruta of limpio.split("\n")) {
    const recortada = bruta.trim();
    if (IPV4_CANONICA.test(recortada)) {
      lineasConContenido++;
      entradas.exactas.add(recortada);
      total++;
      continue;
    }
    const almohadilla = recortada.indexOf("#");
    const linea =
      almohadilla === -1 ? recortada : recortada.slice(0, almohadilla).trim();
    if (!linea) continue;
    lineasConContenido++;
    const token = SEPARADORES.test(linea) ? linea.split(/[\s,;]+/)[0] : linea;
    if (token.includes("/") || token.includes("-")) {
      const rango = analizarRango(token);
      if (rango) {
        entradas.rangos.push({ ...rango, texto: token });
        total++;
      } else {
        invalidas.push(token);
      }
    } else {
      const clave = normalizarIp(token);
      if (clave) {
        entradas.exactas.add(clave);
        total++;
      } else {
        invalidas.push(token);
      }
    }
  }
  return {
    entradas,
    total,
    lineasConContenido,
    invalidas: invalidas.length,
    ejemplosInvalidos: invalidas.slice(0, 5),
  };
}

function listaInvalida(motivo, extra = {}) {
  return { valida: false, motivo, entradas: indiceVacio(), total: 0, ...extra };
}

/**
 * Decide si la respuesta de hayahora es una lista en la que confiar.
 *
 * respuesta: { error } si falló la red, o
 *            { estado, tipoContenido, cuerpo, ultimaModificacion,
 *              longitudDeclarada, codificacion, bytesRecibidos }.
 * opciones:  { ahora } (ms; sin él no se mira la antigüedad) y, para los
 *            tests, cualquier parámetro de PARAMETROS_POR_DEFECTO.
 *
 * Una lista VACÍA (HTTP 200 sin IPs) es válida: es lo normal entre partidos
 * (el historial de hayahora llega a 0 todos los días). Lo inválido es lo que
 * no parece la lista o no está entera o al día: error de red o HTTP, una
 * página HTML o JSON, texto que no son IPs, menos bytes de los anunciados,
 * un fichero que no acaba en salto de línea (el real siempre acaba así) o
 * uno con un Last-Modified de hace más de 15 minutos.
 */
export function evaluarRespuestaLista(respuesta, opciones = {}) {
  const p = { ...PARAMETROS_POR_DEFECTO, ...opciones };
  if (!respuesta) return listaInvalida("sin_respuesta");
  if (respuesta.error) {
    return listaInvalida("error_de_red", { detalle: String(respuesta.error) });
  }
  if (respuesta.estado !== 200) {
    return listaInvalida(`http_${respuesta.estado}`);
  }
  const tipo = String(respuesta.tipoContenido ?? "").toLowerCase();
  if (tipo.includes("html") || tipo.includes("json")) {
    return listaInvalida("tipo_de_contenido_inesperado", { detalle: tipo });
  }
  const cuerpoBruto = String(respuesta.cuerpo ?? "");
  if (cuerpoBruto.length > p.maxBytesLista) {
    return listaInvalida("demasiado_grande");
  }
  // Content-Length solo cuenta los bytes del cuerpo si no viene comprimido.
  const codificacion = String(respuesta.codificacion ?? "").toLowerCase();
  const declarada = Number(respuesta.longitudDeclarada);
  if (
    (codificacion === "" || codificacion === "identity") &&
    respuesta.longitudDeclarada != null &&
    Number.isFinite(declarada) &&
    Number.isFinite(respuesta.bytesRecibidos) &&
    declarada !== respuesta.bytesRecibidos
  ) {
    return listaInvalida("lista_incompleta", {
      detalle: `${respuesta.bytesRecibidos} de ${declarada} bytes`,
    });
  }
  const cuerpo = cuerpoBruto.replace(/^﻿/, "");
  const primero = cuerpo.trimStart()[0];
  if (primero === "<" || primero === "{") {
    return listaInvalida("no_parece_una_lista");
  }
  // Cortada: el fichero real siempre acaba en salto de línea. Un corte justo
  // tras un salto lo tapan Content-Length y la racha limpia de 10 minutos.
  if (cuerpo.trim() !== "" && !cuerpo.endsWith("\n")) {
    const ultima = cuerpo.slice(cuerpo.lastIndexOf("\n") + 1).trim();
    return listaInvalida("lista_truncada", { detalle: ultima.slice(0, 40) });
  }
  const analisis = analizarLista(cuerpo);
  if (analisis.lineasConContenido > 0 && analisis.total === 0) {
    return listaInvalida("sin_ips", {
      ejemplosInvalidos: analisis.ejemplosInvalidos,
    });
  }
  if (
    analisis.lineasConContenido > 0 &&
    analisis.invalidas / analisis.lineasConContenido >
      p.maxProporcionLineasInvalidas
  ) {
    return listaInvalida("formato_desconocido", {
      invalidas: analisis.invalidas,
      ejemplosInvalidos: analisis.ejemplosInvalidos,
    });
  }
  // Con `ahora` (index.js siempre lo pasa), el Last-Modified es obligatorio:
  // sin él no se puede ver si la lista está congelada, y uno del futuro le
  // daría tanto margen como desfase traiga.
  const ultimaModificacion = respuesta.ultimaModificacion ?? null;
  const modificadaMs = Date.parse(ultimaModificacion);
  if (Number.isFinite(p.ahora)) {
    let motivo = null;
    if (!Number.isFinite(modificadaMs)) motivo = "lista_sin_fecha";
    else if (modificadaMs - p.ahora > p.maxAdelantoListaMs) {
      motivo = "lista_con_fecha_futura";
    } else if (p.ahora - modificadaMs > p.maxAntiguedadListaMs) {
      motivo = "lista_antigua";
    }
    if (motivo) {
      return listaInvalida(motivo, {
        detalle: ultimaModificacion,
        ultimaModificacion,
      });
    }
  }
  return {
    valida: true,
    motivo: null,
    vacia: analisis.total === 0,
    entradas: analisis.entradas,
    total: analisis.total,
    invalidas: analisis.invalidas,
    ultimaModificacion,
  };
}

// ─── Respuestas DoH ─────────────────────────────────────────────────────────

/** IPs (A y AAAA) de una respuesta JSON de dns.google o cloudflare-dns.com. */
export function extraerIpsDoh(respuesta) {
  const respuestas = respuesta?.Status === 0 ? respuesta.Answer : null;
  if (!Array.isArray(respuestas)) return [];
  const ips = [];
  for (const registro of respuestas) {
    if (registro?.type !== 1 && registro?.type !== 28) continue;
    const ip = normalizarIp(String(registro.data ?? ""));
    if (ip) ips.push(ip);
  }
  return ipsUnicas(ips);
}

/**
 * ¿La respuesta DoH es una respuesta de verdad? Status 0 (NOERROR) o 3
 * (NXDOMAIN) lo son; SERVFAIL, REFUSED y compañía (con HTTP 200) no.
 */
export function respuestaDohValida(respuesta) {
  return respuesta?.Status === 0 || respuesta?.Status === 3;
}

/**
 * Desde cuándo, como muy pronto, guarda el resolvedor una respuesta negativa
 * (NXDOMAIN, o NOERROR sin registros). La caché negativa dura lo que diga el
 * SOA de Authority (RFC 2308: como mucho su campo mínimo, 1800 s en
 * dns.hayahora.futbol) y su TTL es lo que le queda, así que entró hace como
 * mucho (mínimo − TTL) segundos. Sin SOA no se sabe: null.
 */
export function negativaCacheadaDesde(respuesta, ahora) {
  const soa = (respuesta?.Authority ?? []).find((r) => r?.type === 6);
  const minimo = Number(String(soa?.data ?? "").trim().split(/\s+/)[6]);
  const restante = Number(soa?.TTL);
  if (!Number.isFinite(minimo) || !Number.isFinite(restante)) return null;
  return ahora - Math.max(0, minimo - restante) * 1000;
}

/**
 * Resume las respuestas válidas del DNS de hayahora para `decidir`.
 * respuestas: [{ tipo: "A" | "AAAA", datos }] (JSON de dns.google o
 * cloudflare-dns.com, ya comprobados con respuestaDohValida).
 *
 * Devuelve { ok, ips, negativaDesde }:
 * - ok: contestó bien al menos un resolvedor para A y otro para AAAA;
 * - ips: los `data` de A y AAAA de todas, sin repetir y sin normalizar ni
 *   ordenar (pueden ser cientos y la CPU del cron es escasa);
 * - negativaDesde: { 4, 6 } (ms) para la familia que no trae ninguna IP en
 *   ninguna respuesta: desde cuándo, como muy pronto, la tiene en caché el
 *   resolvedor que la guarda desde hace más (null si alguno no trae SOA).
 */
export function resumirConfirmacion(respuestas, ahora) {
  const ips = new Set();
  const conIps = { 4: false, 6: false };
  const negativaDesde = { 4: Infinity, 6: Infinity };
  const tipos = new Set();
  for (const { tipo, datos } of respuestas ?? []) {
    const familia = tipo === "AAAA" ? 6 : 4;
    const numero = familia === 6 ? 28 : 1;
    tipos.add(tipo);
    let alguna = false;
    for (const registro of Array.isArray(datos?.Answer) ? datos.Answer : []) {
      if (registro?.type !== numero) continue;
      ips.add(String(registro.data ?? "").trim().toLowerCase());
      alguna = true;
    }
    if (alguna) conIps[familia] = true;
    else {
      const desde = negativaCacheadaDesde(datos, ahora);
      negativaDesde[familia] = Math.min(
        negativaDesde[familia],
        desde ?? -Infinity
      );
    }
  }
  const resumen = (familia) =>
    conIps[familia] || !Number.isFinite(negativaDesde[familia])
      ? null
      : negativaDesde[familia];
  return {
    ok: tipos.has("A") && tipos.has("AAAA"),
    ips: [...ips],
    negativaDesde: { 4: resumen(4), 6: resumen(6) },
  };
}

/**
 * Funde las IPs guardadas ({ ip: vistaEn ISO }) con las vistas ahora. Las
 * vistas renuevan su fecha; las que llevan más de `caducidadMs` sin verse se
 * olvidan, pero solo si en esta ejecución se ha visto alguna (si el DoH falla
 * o el proxy está apagado, no se olvida nada).
 */
export function fusionarIps(anteriores, vistas, ahora, caducidadMs) {
  const ahoraIso = new Date(ahora).toISOString();
  const resultado = new Map();
  for (const [texto, vistaEn] of Object.entries(anteriores ?? {})) {
    const ip = normalizarIp(texto);
    if (!ip) continue;
    const ms = Date.parse(vistaEn);
    resultado.set(
      ip,
      Number.isFinite(ms) ? new Date(ms).toISOString() : ahoraIso
    );
  }
  const vistasNormalizadas = ipsUnicas(vistas);
  for (const ip of vistasNormalizadas) resultado.set(ip, ahoraIso);
  if (vistasNormalizadas.length > 0) {
    for (const [ip, vistaEn] of resultado) {
      if (ahora - Date.parse(vistaEn) > caducidadMs) resultado.delete(ip);
    }
  }
  return ordenarClaves(Object.fromEntries(resultado));
}

// ─── Configuración ──────────────────────────────────────────────────────────

/** Nombre DNS en minúsculas y sin punto final. */
export function normalizarNombre(nombre) {
  return String(nombre ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

/** Lee y valida las variables del Worker. No devuelve el valor del token. */
export function leerConfiguracion(env) {
  const errores = [];
  const zoneId = String(env?.ZONE_ID ?? "").trim();
  if (!/^[0-9a-f]{32}$/.test(zoneId)) {
    errores.push("ZONE_ID no es un id de zona válido");
  }
  const crudo = env?.HOSTNAMES;
  const lista = Array.isArray(crudo)
    ? crudo
    : String(crudo ?? "").split(/[\s,]+/);
  const hostnames = [...new Set(lista.map(normalizarNombre).filter(Boolean))];
  if (hostnames.length === 0) errores.push("HOSTNAMES está vacío");
  for (const nombre of hostnames) {
    if (HOSTNAMES_PROHIBIDOS.includes(nombre)) {
      errores.push(`${nombre} no se puede conmutar nunca`);
    } else if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(nombre)) {
      errores.push(`${nombre} no es un nombre DNS válido`);
    }
  }
  const modo = String(env?.MODO ?? "").trim().toLowerCase() || "activo";
  if (modo !== "activo" && modo !== "observar") {
    errores.push(`MODO desconocido: ${modo} (usa «activo» u «observar»)`);
  }
  if (!env?.CF_API_TOKEN) errores.push("falta el secreto CF_API_TOKEN");
  return { zoneId, hostnames, modo, errores };
}

// ─── Registros DNS ──────────────────────────────────────────────────────────

/**
 * Elige, de todo lo que devuelve la API, exactamente un CNAME por hostname
 * configurado (nombre exacto y tipo CNAME). Nada más sale de aquí, así que
 * ningún otro registro puede acabar en un PATCH.
 */
export function seleccionarRegistros(registros, hostnames) {
  const todos = Array.isArray(registros) ? registros : [];
  const seleccion = [];
  const faltan = [];
  const duplicados = [];
  for (const nombre of hostnames) {
    const coinciden = todos.filter(
      (r) =>
        r &&
        r.type === "CNAME" &&
        normalizarNombre(r.name) === nombre &&
        typeof r.id === "string" &&
        r.id !== "" &&
        typeof r.proxied === "boolean"
    );
    if (coinciden.length === 0) faltan.push(nombre);
    else if (coinciden.length > 1) duplicados.push(nombre);
    else seleccion.push({ ...coinciden[0], name: nombre });
  }
  return { registros: seleccion, faltan, duplicados };
}

/** El destino del CNAME tiene que ser Vercel: es quien sirve sin el proxy. */
export function esDestinoVercel(contenido) {
  return /(^|\.)vercel-dns(-\d+)?\.com$/.test(normalizarNombre(contenido));
}

/** "encendido" (todos proxied), "apagado" (ninguno) o "mezclado". */
export function estadoProxy(registros) {
  if (!registros.length) return "sin_registros";
  const encendidos = registros.filter((r) => r.proxied).length;
  if (encendidos === registros.length) return "encendido";
  if (encendidos === 0) return "apagado";
  return "mezclado";
}

// ─── Control (la marca del conmutador en KV) ────────────────────────────────

function aIso(valor) {
  const ms = Date.parse(valor);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * Normaliza el valor de la clave `control` de KV. Lo que no se entiende se
 * descarta con un aviso: una marca ilegible cuenta como «sin marca», y sin
 * marca el conmutador nunca enciende nada (lo seguro).
 *
 * Forma:
 * {
 *   version: 1,
 *   marca: null | {
 *     // Los que apagó él (o se sembraron a mano), cada uno en un estado:
 *     // - { apagadoEn, pendiente: true }: marca escrita antes del PATCH, sin
 *     //   confirmar todavía que se aplicó;
 *     // - { apagadoEn, modificadoEn }: apagado confirmado; modificadoEn es el
 *     //   modified_on que dejó NUESTRO cambio. Si la API muestra otro
 *     //   posterior, alguien lo tocó a mano y la marca se suelta;
 *     // - { apagadoEn }: sembrado a mano; se confirma (adopta) en cuanto se ve
 *     //   en DNS-only, y si se ve proxied, se suelta.
 *     registros: { "<hostname>": { apagadoEn, modificadoEn?, pendiente? } },
 *     motivo, origen, ipsBloqueadas
 *   },
 *   ultimoCambio: null | { accion: "apagar"|"encender", en: ISO, hostnames },
 *   limpiasSeguidas: 0,      // observaciones limpias de la racha
 *   limpioDesde: null | ISO, // la primera de esa racha
 *   limpioHasta: null | ISO, // la última (para ver si hubo un hueco)
 *   // Con marca: desde cuándo no está en la lista ninguna IP nuestra de cada
 *   // familia, aunque la otra siga bloqueada (fecha las respuestas negativas
 *   // del DNS de hayahora).
 *   familiaLimpiaDesde: null | { ipv4: null | ISO, ipv6: null | ISO }
 * }
 */
export function normalizarControl(bruto) {
  const avisos = [];
  const control = {
    version: 1,
    marca: null,
    ultimoCambio: null,
    limpiasSeguidas: 0,
    limpioDesde: null,
    limpioHasta: null,
    familiaLimpiaDesde: null,
  };
  if (bruto == null) return { control, avisos };
  if (typeof bruto !== "object" || Array.isArray(bruto)) {
    avisos.push("control_ilegible");
    return { control, avisos };
  }
  const marca = bruto.marca;
  if (marca != null) {
    const fuente = marca.registros;
    const registros = {};
    if (fuente && typeof fuente === "object" && !Array.isArray(fuente)) {
      for (const [nombre, datos] of Object.entries(fuente)) {
        const normalizado = normalizarNombre(nombre);
        const apagadoEn = aIso(datos?.apagadoEn);
        if (!normalizado || !apagadoEn) {
          avisos.push(`marca_descartada:${nombre}`);
          continue;
        }
        const entrada = { apagadoEn };
        const modificadoEn = aIso(datos?.modificadoEn);
        if (modificadoEn) entrada.modificadoEn = modificadoEn;
        else if (datos?.pendiente === true) entrada.pendiente = true;
        registros[normalizado] = entrada;
      }
    } else {
      avisos.push("marca_ilegible");
    }
    if (Object.keys(registros).length > 0) {
      control.marca = {
        registros: ordenarClaves(registros),
        motivo: typeof marca.motivo === "string" ? marca.motivo : null,
        origen: typeof marca.origen === "string" ? marca.origen : "conmutador",
        ipsBloqueadas: ipsUnicas(marca.ipsBloqueadas),
      };
    }
  }
  const cambio = bruto.ultimoCambio;
  const enCambio = aIso(cambio?.en);
  if (cambio && enCambio) {
    control.ultimoCambio = {
      accion: typeof cambio.accion === "string" ? cambio.accion : null,
      en: enCambio,
      hostnames: Array.isArray(cambio.hostnames)
        ? cambio.hostnames.map(normalizarNombre)
        : [],
    };
  } else if (cambio != null) {
    avisos.push("ultimo_cambio_ilegible");
  }
  if (Number.isInteger(bruto.limpiasSeguidas) && bruto.limpiasSeguidas >= 0) {
    control.limpiasSeguidas = bruto.limpiasSeguidas;
  }
  control.limpioDesde = aIso(bruto.limpioDesde);
  control.limpioHasta = aIso(bruto.limpioHasta);
  const familias = bruto.familiaLimpiaDesde;
  if (familias && typeof familias === "object") {
    control.familiaLimpiaDesde = {
      ipv4: aIso(familias.ipv4),
      ipv6: aIso(familias.ipv6),
    };
  }
  return { control, avisos };
}

function ordenarClaves(objeto) {
  return Object.fromEntries(
    Object.entries(objeto).sort(([a], [b]) => (a < b ? -1 : 1))
  );
}

function canonico(valor) {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.keys(valor)
        .sort()
        .map((clave) => [clave, canonico(valor[clave])])
    );
  }
  return valor;
}

/** ¿Son iguales dos controles (sin importar el orden de las claves)? */
export function mismoControl(a, b) {
  return JSON.stringify(canonico(a)) === JSON.stringify(canonico(b));
}

// ─── Decisión ───────────────────────────────────────────────────────────────

function maximoFinito(valores) {
  const finitos = valores.filter(Number.isFinite);
  return finitos.length ? Math.max(...finitos) : null;
}

// Motivos por registro que dejan al conmutador sin poder actuar.
const MOTIVOS_INOPERATIVOS = new Set([
  "sin_ips_de_vercel",
  "confirmacion_dns_fallida",
  "confirmacion_dns_desfasada",
  // La lista dice que ya no hay bloqueo y el DNS de hayahora que sí: si dura,
  // uno de los dos está roto y el proxy no se vuelve a encender.
  "bloqueo_en_dns",
  "sin_fecha_de_modificacion",
]);

/**
 * ¿Dice el DNS de hayahora lo mismo que la lista, y está al día? Por familia
 * (IPv4 en A, IPv6 en AAAA):
 * - si la lista trae IPs de esa familia, el DNS tiene que traer alguna de
 *   ellas: uno sin ninguna es una caché negativa vieja (dura hasta 30
 *   minutos) o va por detrás;
 * - si no trae ninguna, el DNS puede no traer nada, pero esa respuesta
 *   negativa tiene que haber entrado en la caché después de que la lista
 *   quedara limpia de nuestras IPs de esa familia (`desdeMs`, menos un ciclo:
 *   pudo limpiarse justo después de la última vez que las vimos); una de
 *   antes dice cómo estaba el DNS durante el bloqueo, no cómo está ahora.
 * Las respuestas con IPs llevan TTL de 30 s: valen tal cual.
 */
function confirmacionAlDia(confirmacion, indiceDns, entradas, desdeMs) {
  // desdeMs: { 4, 6 }, desde cuándo está limpia de nuestras IPs cada familia.
  const enLista = { 4: false, 6: false };
  for (const r of entradas.rangos) enLista[r.familia] = true;
  for (const ip of entradas.exactas) {
    enLista[ip.includes(":") ? 6 : 4] = true;
    if (enLista[4] && enLista[6]) break;
  }
  const enDns = { 4: false, 6: false };
  const comunes = { 4: false, 6: false };
  for (const ip of indiceDns.exactas) {
    const familia = ip.includes(":") ? 6 : 4;
    enDns[familia] = true;
    if (entradas.exactas.has(ip)) comunes[familia] = true;
  }
  if (entradas.rangos.length > 0) {
    for (const ip of ipsEnLista(indiceDns.exactas, entradas)) {
      comunes[ip.includes(":") ? 6 : 4] = true;
    }
  }
  return [4, 6].every((familia) => {
    if (enDns[familia]) return !enLista[familia] || comunes[familia];
    const negativaMs = confirmacion.negativaDesde?.[familia];
    return (
      !enLista[familia] &&
      Number.isFinite(negativaMs) &&
      negativaMs >= desdeMs[familia]
    );
  });
}

/**
 * Decide qué hacer en esta ejecución.
 *
 * entrada = {
 *   ahora,                 // ms
 *   hostnames,             // los tres nombres configurados
 *   registros,             // lo que devuelve la API (se filtra aquí)
 *   lista,                 // resultado de evaluarRespuestaLista
 *   ipsCloudflare,         // IPs de Cloudflare conocidas (guardadas + vistas)
 *   ipsVercel,             // IPs del destino de Vercel
 *   control,               // valor de KV (se normaliza aquí)
 *   confirmacion,          // undefined | { ok: false, error } | lo que
 *                          //   devuelve resumirConfirmacion (el DNS de
 *                          //   blocked.dns.hayahora.futbol)
 *   inoperativoDesde,      // ISO guardado en la observación, o null
 *   operativoDesde,        // ídem (ver valorarSalud)
 *   parametros,            // opcional, para los tests
 * }
 *
 * Por registro:
 * - Con marca (apagado por el conmutador o sembrado):
 *     · proxied, marca pendiente y sin tocar desde la marca: el PATCH no
 *       llegó a aplicarse; se reintenta si sigue el bloqueo (y Vercel está
 *       sano), y si no, se retira de la marca;
 *     · proxied en cualquier otro caso: lo encendió un humano (o una semilla
 *       que ya no vale); se retira de la marca y no se toca;
 *     · DNS-only pero modificado después de nuestro cambio: lo tocó un
 *       humano; se retira de la marca y no se toca nunca;
 *     · DNS-only sin modified_on legible: espera (no sabe si lo tocó un
 *       humano) y cuenta como inoperativo;
 *     · DNS-only: se enciende cuando nuestras IPs llevan N observaciones
 *       seguidas y 10 minutos fuera de la lista, han pasado 15 minutos desde
 *       que lo apagó y el DNS de hayahora (blocked.dns.hayahora.futbol),
 *       al día y de acuerdo con la lista, confirma que no están bloqueadas.
 * - Sin marca:
 *     · apagado: lo apagó un humano y no se toca nunca;
 *     · encendido: se apaga si alguna IP nuestra de Cloudflare está bloqueada,
 *       las de Vercel no lo están y no hubo cambios en los últimos 10 minutos.
 *
 * Devuelve los PATCH que hay que hacer (`cambios`), el control a guardar
 * (`control`), si ese control se guarda ANTES de los PATCH
 * (`escribirControlAntes`, al apagar: la marca va primero para que un PATCH
 * aplicado sin respuesta nunca parezca un apagado a mano) y si hace falta
 * consultar el DNS de hayahora antes de encender (`pideConfirmacion`: index.js
 * lo consulta y vuelve a llamar a decidir con `confirmacion`).
 */
export function decidir(entrada) {
  const p = { ...PARAMETROS_POR_DEFECTO, ...(entrada.parametros ?? {}) };
  const decision = decidirSinSalud(entrada, p);
  return valorarSalud(decision, entrada, p);
}

/**
 * Si el conmutador no puede decidir (lista inválida, sin IPs, sin
 * confirmación…), lo cuenta desde la primera ejecución así y, pasado
 * `umbralInoperativoMs`, lo sube a error. La cuenta solo se borra con dos
 * ejecuciones buenas seguidas (`operativoDesde`, `recuperacionMs`). Sin IPs
 * conocidas con una marca activa es error desde la primera: el proxy no se
 * volvería a encender nunca.
 */
function valorarSalud(decision, entrada, p) {
  const ahora = entrada.ahora;
  const previo = (valor) => {
    const ms = Date.parse(valor);
    return Number.isFinite(ms) && ms <= ahora ? ms : null;
  };
  const previoMs = previo(entrada.inoperativoDesde);
  if (!decision.inoperativo) {
    // Una ejecución buena suelta no borra la cuenta: si no, una lista que
    // falla una vez de cada dos nunca llegaría a error.
    const operativoMs = previo(entrada.operativoDesde) ?? ahora;
    if (previoMs === null || ahora - operativoMs >= p.recuperacionMs) {
      return { ...decision, inoperativoDesde: null, operativoDesde: null };
    }
    return {
      ...decision,
      inoperativoDesde: new Date(previoMs).toISOString(),
      operativoDesde: new Date(operativoMs).toISOString(),
    };
  }
  const desdeMs = previoMs ?? ahora;
  const inoperativoMs = ahora - desdeMs;
  const conMarca = Boolean(decision.control?.marca);
  const grave =
    inoperativoMs >= p.umbralInoperativoMs ||
    (decision.motivo === "sin_ips_conocidas" && conMarca);
  return {
    ...decision,
    gravedad: grave ? "error" : decision.gravedad,
    inoperativoDesde: new Date(desdeMs).toISOString(),
    operativoDesde: null,
    inoperativoMs,
  };
}

function decidirSinSalud(entrada, p) {
  const ahora = entrada.ahora;
  const ahoraIso = new Date(ahora).toISOString();
  const hostnames = entrada.hostnames ?? [];
  const lista = entrada.lista ?? { valida: false, motivo: "sin_lista" };
  const normalizacion = normalizarControl(entrada.control);
  const avisos = [...normalizacion.avisos];
  const controlPrevio = normalizacion.control;

  // Una marca de un nombre que ya no está en HOSTNAMES no se puede cumplir.
  let control = controlPrevio;
  if (control.marca) {
    const registrosMarca = {};
    for (const [nombre, datos] of Object.entries(control.marca.registros)) {
      if (hostnames.includes(nombre)) registrosMarca[nombre] = datos;
      else avisos.push(`marca_fuera_de_hostnames:${nombre}`);
    }
    control = {
      ...control,
      marca: Object.keys(registrosMarca).length
        ? { ...control.marca, registros: registrosMarca }
        : null,
    };
  }

  const comun = {
    ahoraIso,
    avisos,
    controlPrevio,
    estadoProxy: null,
    registros: [],
    bloqueadasNuestras: [],
    vercelBloqueadas: [],
    bloqueadasEnDns: [],
    cambios: [],
    detalles: [],
    escribirControlAntes: false,
    pideConfirmacion: false,
    inoperativo: false,
  };
  const sinCambios = (motivo, gravedad, extra = {}, nuevo = control) => ({
    ...comun,
    accion: "ninguna",
    motivo,
    gravedad,
    control: nuevo,
    ...extra,
  });

  const seleccion = seleccionarRegistros(entrada.registros, hostnames);
  if (seleccion.faltan.length || seleccion.duplicados.length) {
    return sinCambios("registros_incompletos", "error", {
      faltan: seleccion.faltan,
      duplicados: seleccion.duplicados,
      inoperativo: true,
    });
  }
  const registros = seleccion.registros;
  comun.estadoProxy = estadoProxy(registros);
  comun.registros = registros.map((r) => ({
    nombre: r.name,
    proxied: r.proxied,
    ttl: r.ttl ?? null,
  }));

  const noVercel = registros
    .filter((r) => !esDestinoVercel(r.content))
    .map((r) => r.name);
  if (noVercel.length) {
    return sinCambios("destino_no_vercel", "error", {
      noVercel,
      inoperativo: true,
    });
  }
  // Las IPs de Vercel se resuelven de un solo destino (con 12 consultas DoH
  // por destino, tres distintos se comerían el límite de 50 subpeticiones).
  const destinos = [
    ...new Set(registros.map((r) => normalizarNombre(r.content))),
  ];
  if (destinos.length > 1) {
    return sinCambios("destinos_distintos", "error", {
      destinos: destinos.sort(),
      inoperativo: true,
    });
  }

  // Sin lista válida (o sin IPs) no se observa nada: la racha limpia ni
  // avanza ni se rompe; la rompe el hueco entre observaciones (más abajo).
  if (!lista.valida) {
    return sinCambios("lista_invalida", "aviso", {
      detalleLista: lista.motivo ?? null,
      inoperativo: true,
    });
  }
  const conocidas = ipsUnicas(entrada.ipsCloudflare);
  if (conocidas.length === 0) {
    return sinCambios("sin_ips_conocidas", "aviso", { inoperativo: true });
  }
  // Las IPs por las que se apagó viajan en la marca, que se escribe antes del
  // PATCH: una observación de KV atrasada no puede hacer que se olviden.
  const ipsCloudflare = ipsUnicas([
    ...conocidas,
    ...(control.marca?.ipsBloqueadas ?? []),
  ]);

  const ipsVercel = ipsUnicas(entrada.ipsVercel);
  const bloqueadasNuestras = ipsEnLista(ipsCloudflare, lista.entradas);
  const vercelBloqueadas = ipsEnLista(ipsVercel, lista.entradas);
  comun.bloqueadasNuestras = bloqueadasNuestras;
  comun.vercelBloqueadas = vercelBloqueadas;
  const hayBloqueo = bloqueadasNuestras.length > 0;
  const vercelSano = ipsVercel.length > 0 && vercelBloqueadas.length === 0;

  // Racha limpia: observaciones con la lista válida y sin nuestras IPs. Se
  // rompe si la lista las trae o si entre dos observaciones limpias pasan más
  // de huecoMaximoRachaMs (falló más de una ejecución seguida, o no corrió):
  // el bloqueo pudo volver sin que lo viéramos.
  const propios = control.marca?.registros ?? {};
  const hayPropios = Object.keys(propios).length > 0;
  let limpias = 0;
  let limpioDesdeMs = null;
  let hueco = false;
  if (!hayBloqueo && hayPropios) {
    const desdePrevioMs = Date.parse(control.limpioDesde);
    const hastaPrevioMs = Date.parse(control.limpioHasta);
    const sigue =
      control.limpiasSeguidas > 0 &&
      desdePrevioMs <= hastaPrevioMs &&
      hastaPrevioMs <= ahora &&
      ahora - hastaPrevioMs <= p.huecoMaximoRachaMs;
    hueco = control.limpiasSeguidas > 0 && !sigue;
    limpias = sigue ? control.limpiasSeguidas + 1 : 1;
    limpioDesdeMs = sigue ? desdePrevioMs : ahora;
  }
  // Lo mismo por familia, sin exigir la otra: nuestras IPv6 suelen salir de
  // la lista antes que las IPv4, y una respuesta negativa del AAAA guardada
  // desde entonces vale. Solo se escribe cuando cambia (nunca en cada
  // ejecución de un bloqueo); tras un hueco en la racha vuelve a contar.
  let familiaLimpiaDesde = null;
  if (hayPropios) {
    familiaLimpiaDesde = {};
    for (const familia of ["ipv4", "ipv6"]) {
      const sucia = bloqueadasNuestras.some(
        (ip) => ip.includes(":") === (familia === "ipv6")
      );
      const previoMs = Date.parse(control.familiaLimpiaDesde?.[familia]);
      familiaLimpiaDesde[familia] = sucia
        ? null
        : !hueco && previoMs <= ahora
          ? new Date(previoMs).toISOString()
          : ahoraIso;
    }
  }

  const limpiaDesdeMs = (familia) =>
    Math.min(
      Date.parse(familiaLimpiaDesde?.[familia]) || Infinity,
      limpioDesdeMs
    );
  const confirmacion = entrada.confirmacion;
  const indiceDns = confirmacion?.ok ? indiceDeIps(confirmacion.ips) : null;
  const bloqueadasEnDns = indiceDns ? ipsEnLista(ipsCloudflare, indiceDns) : [];
  comun.bloqueadasEnDns = bloqueadasEnDns;

  // Antirrebote: nuestro último cambio o el último que vea la API (un humano).
  const ultimoCambioMs = maximoFinito([
    Date.parse(control.ultimoCambio?.en),
    ...registros.map((r) => Date.parse(r.modified_on)),
  ]);
  const antirreboteActivo =
    ultimoCambioMs !== null && ahora - ultimoCambioMs < p.antirreboteMs;

  const nuevosPropios = { ...propios };
  const apagadosNuevos = [];
  const cambios = [];
  const detalles = [];
  let pideConfirmacion = false;

  for (const r of registros) {
    const propio = propios[r.name];
    const modificadoMs = Date.parse(r.modified_on);
    let accion = "ninguna";
    let motivo;
    if (propio) {
      const apagadoEnMs = Date.parse(propio.apagadoEn);
      if (r.proxied) {
        const sinAplicar =
          propio.pendiente === true &&
          Number.isFinite(modificadoMs) &&
          modificadoMs <= apagadoEnMs;
        if (sinAplicar && hayBloqueo && vercelSano) {
          accion = "apagar";
          motivo = "reintento_de_apagado";
        } else {
          accion = "soltar";
          motivo = sinAplicar ? "apagado_no_aplicado" : "encendido_a_mano";
        }
      } else if (!Number.isFinite(modificadoMs)) {
        // Sin modified_on no se sabe si lo tocó un humano: ni se suelta
        // (sería para siempre) ni se enciende. Se espera, y si dura es error.
        motivo = "sin_fecha_de_modificacion";
      } else if (
        propio.modificadoEn &&
        modificadoMs > Date.parse(propio.modificadoEn)
      ) {
        accion = "soltar";
        motivo = "modificado_a_mano";
      } else {
        if (!propio.modificadoEn) {
          // Apagado sin confirmar (PATCH sin respuesta o semilla): lo está, así
          // que se adopta su modified_on como el de nuestro cambio.
          nuevosPropios[r.name] = {
            apagadoEn: propio.apagadoEn,
            modificadoEn: new Date(modificadoMs).toISOString(),
          };
        }
        if (hayBloqueo) {
          motivo = "sigue_bloqueado";
        } else if (limpias < p.ejecucionesLimpiasNecesarias) {
          motivo = "esperando_ejecuciones_limpias";
        } else if (ahora - limpioDesdeMs < p.tiempoLimpioMinimoMs) {
          motivo = "esperando_tiempo_limpio";
        } else if (ahora - apagadoEnMs < p.esperaMinimaEncenderMs) {
          motivo = "esperando_tiempo_minimo";
        } else if (confirmacion === undefined) {
          motivo = "esperando_confirmacion_dns";
          pideConfirmacion = true;
        } else if (!confirmacion?.ok) {
          motivo = "confirmacion_dns_fallida";
        } else if (bloqueadasEnDns.length > 0) {
          // La lista dice que no, pero el DNS de hayahora sí: no se enciende y
          // se vuelve a preguntar en la siguiente ejecución (la racha sigue).
          motivo = "bloqueo_en_dns";
        } else if (
          !confirmacionAlDia(confirmacion, indiceDns, lista.entradas, {
            4: limpiaDesdeMs("ipv4") - p.periodoCronMs,
            6: limpiaDesdeMs("ipv6") - p.periodoCronMs,
          })
        ) {
          // Un «no hay nada» del DNS que puede ser una caché negativa de
          // antes de acabar el bloqueo, o un DNS que no cuadra con la lista.
          motivo = "confirmacion_dns_desfasada";
        } else {
          accion = "encender";
          motivo = "fin_del_bloqueo";
        }
      }
      if (accion === "soltar") delete nuevosPropios[r.name];
    } else if (!r.proxied) {
      motivo = "apagado_a_mano";
    } else if (!hayBloqueo) {
      motivo = "sin_bloqueo";
    } else if (ipsVercel.length === 0) {
      motivo = "sin_ips_de_vercel";
    } else if (vercelBloqueadas.length > 0) {
      motivo = "vercel_tambien_bloqueado";
    } else if (antirreboteActivo) {
      motivo = "antirrebote";
    } else {
      accion = "apagar";
      motivo = "bloqueo_detectado";
      nuevosPropios[r.name] = { apagadoEn: ahoraIso, pendiente: true };
      apagadosNuevos.push(r.name);
    }
    detalles.push({
      nombre: r.name,
      proxied: r.proxied,
      propio: Boolean(propio),
      accion,
      motivo,
    });
    if (accion === "apagar") {
      cambios.push({
        id: r.id,
        nombre: r.name,
        cuerpo: { proxied: false, ttl: p.ttlApagado },
      });
    } else if (accion === "encender") {
      cambios.push({
        id: r.id,
        nombre: r.name,
        cuerpo: { proxied: true, ttl: p.ttlEncendido },
      });
    }
  }

  const quedanPropios = Object.keys(nuevosPropios).length > 0;
  let marca = null;
  if (quedanPropios) {
    marca = {
      registros: ordenarClaves(nuevosPropios),
      motivo: control.marca?.motivo ?? "bloqueo_detectado",
      origen: control.marca?.origen ?? "conmutador",
      ipsBloqueadas: ipsUnicas([
        ...(control.marca?.ipsBloqueadas ?? []),
        ...(apagadosNuevos.length ? bloqueadasNuestras : []),
      ]),
    };
  }
  const conRacha = quedanPropios && limpias > 0;
  const controlNuevo = {
    ...control,
    marca,
    limpiasSeguidas: conRacha ? limpias : 0,
    limpioDesde: conRacha ? new Date(limpioDesdeMs).toISOString() : null,
    limpioHasta: conRacha ? ahoraIso : null,
    familiaLimpiaDesde: quedanPropios ? familiaLimpiaDesde : null,
    ultimoCambio: apagadosNuevos.length
      ? { accion: "apagar", en: ahoraIso, hostnames: apagadosNuevos }
      : control.ultimoCambio,
  };

  const unir = (lista) => [...new Set(lista.map((d) => d.motivo))].join("+");
  const apagan = detalles.filter((d) => d.accion === "apagar");
  const encienden = detalles.filter((d) => d.accion === "encender");
  const sueltan = detalles.filter((d) => d.accion === "soltar");
  let accion = "ninguna";
  let motivo = unir(detalles);
  if (apagan.length) {
    accion = "apagar";
    motivo = unir(apagan);
  } else if (encienden.length) {
    accion = "encender";
    motivo = unir(encienden);
  } else if (sueltan.length) {
    accion = "limpiar_marca";
    motivo = unir(sueltan);
  }

  const inoperativo = detalles.some((d) => MOTIVOS_INOPERATIVOS.has(d.motivo));
  return {
    ...comun,
    accion,
    motivo,
    gravedad: inoperativo ? "aviso" : "info",
    cambios,
    detalles,
    control: controlNuevo,
    escribirControlAntes: apagadosNuevos.length > 0,
    pideConfirmacion,
    inoperativo,
  };
}

/**
 * Control final tras intentar los PATCH.
 * `resultados` = [{ nombre, ok, modificadoEn? }] (modificadoEn: el
 * modified_on que devolvió la API).
 * - Los encendidos que salieron bien se quitan de la marca; si no queda
 *   ninguno, la marca desaparece.
 * - Los apagados que salieron bien quedan confirmados con su modificadoEn.
 * - Los apagados que fallaron siguen pendientes en la marca (se guardó
 *   antes): el siguiente ciclo ve que siguen proxied sin tocar y reintenta.
 */
export function aplicarResultados(decision, resultados) {
  const porNombre = new Map(
    (resultados ?? []).filter((r) => r.ok).map((r) => [r.nombre, r])
  );
  const registros = { ...(decision.control.marca?.registros ?? {}) };
  const encendidos = [];
  let cambia = false;
  for (const cambio of decision.cambios) {
    const resultado = porNombre.get(cambio.nombre);
    if (!resultado) continue;
    if (cambio.cuerpo.proxied) {
      delete registros[cambio.nombre];
      encendidos.push(cambio.nombre);
      cambia = true;
    } else if (registros[cambio.nombre]) {
      const modificadoEn = aIso(resultado.modificadoEn);
      if (modificadoEn) {
        registros[cambio.nombre] = {
          apagadoEn: registros[cambio.nombre].apagadoEn,
          modificadoEn,
        };
        cambia = true;
      }
    }
  }
  if (!cambia) return decision.control;
  const quedan = Object.keys(registros).length > 0;
  return {
    ...decision.control,
    marca: quedan
      ? { ...decision.control.marca, registros: ordenarClaves(registros) }
      : null,
    limpiasSeguidas: quedan ? decision.control.limpiasSeguidas : 0,
    limpioDesde: quedan ? decision.control.limpioDesde : null,
    limpioHasta: quedan ? decision.control.limpioHasta : null,
    familiaLimpiaDesde: quedan ? decision.control.familiaLimpiaDesde : null,
    ultimoCambio: encendidos.length
      ? { accion: "encender", en: decision.ahoraIso, hostnames: encendidos }
      : decision.control.ultimoCambio,
  };
}

// ─── Observación (lo que se guarda para /estado) ────────────────────────────

/** Lo que cuenta como «cambio relevante» del informe de una ejecución. */
export function firmaInforme(informe) {
  if (!informe) return null;
  return JSON.stringify([
    informe.accion ?? null,
    informe.motivo ?? null,
    informe.estadoProxy ?? null,
    informe.proxied ?? null,
    informe.bloqueadasNuestras ?? [],
    informe.vercelBloqueadas ?? [],
    informe.lista?.valida ?? null,
    informe.lista?.motivo ?? null,
    Boolean(informe.errores),
  ]);
}

function firmaObservacion(observacion, conInforme) {
  return JSON.stringify([
    Object.keys(observacion?.ipsCloudflare ?? {}).sort(),
    Object.keys(observacion?.ipsVercel ?? {}).sort(),
    observacion?.inoperativoDesde ?? null,
    observacion?.operativoDesde ?? null,
    conInforme ? firmaInforme(observacion?.informe) : null,
  ]);
}

/**
 * ¿Hay que guardar la observación? Sí si cambió algo relevante (IPs conocidas,
 * el informe o desde cuándo está inoperativo) o si la última guardada tiene
 * más de `latidoMs`. Así KV no se escribe en cada ejecución (720 al día) y
 * /estado no se queda viejo.
 *
 * Mientras sigue la misma cuenta de inoperativo y no se hace nada, el informe
 * no cuenta: con dos fallos que alternan (la lista inválida en una ejecución,
 * el DNS de hayahora contradiciéndola en la siguiente) cambiaría en todas y,
 * sumado a `control` (la racha avanza en cada ejecución válida), KV pasaría
 * de las 1.000 escrituras al día. Lo recoge el latido, y la línea de log sale
 * en cada ejecución.
 */
export function debeGuardarObservacion(anterior, nueva, ahora, latidoMs) {
  if (!anterior) return true;
  const conInforme = !(
    nueva?.inoperativoDesde != null &&
    nueva.inoperativoDesde === anterior.inoperativoDesde &&
    nueva.informe?.accion === "ninguna"
  );
  if (
    firmaObservacion(anterior, conInforme) !==
    firmaObservacion(nueva, conInforme)
  ) {
    return true;
  }
  const guardadaMs = Date.parse(anterior.guardadaEn);
  return !Number.isFinite(guardadaMs) || ahora - guardadaMs >= latidoMs;
}
