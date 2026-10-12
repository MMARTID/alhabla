// Datos y constructores compartidos por los tests. No acaba en .test.js ni
// vive en una carpeta test/, así que `node --test` no lo ejecuta como prueba.

export const MINUTO = 60 * 1000;
export const AHORA = Date.parse("2026-10-10T18:00:00.000Z");
export const HOSTNAMES = ["alhabla.ai", "www.alhabla.ai", "app.alhabla.ai"];
export const DESTINO_VERCEL = "11d10c4786ee7e11.vercel-dns-017.com";
export const ZONA = "252ecca77f844b46263852c7699a9421";
export const TOKEN = "token-de-prueba-que-no-debe-salir-nunca";

export const IDS = Object.freeze({
  "alhabla.ai": "0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a01",
  "www.alhabla.ai": "0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b02",
  "app.alhabla.ai": "0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c03",
});

// Las IPs de Cloudflare que reciben hoy los usuarios españoles: la cara que
// dan Google y cloudflare-dns.com (188.114.x y 2a06:98c1:312x::) y la que da
// one.one.one.one (104.21/172.67 y 2606:4700:303x::).
export const IPS_CLOUDFLARE = Object.freeze([
  "188.114.96.5",
  "188.114.97.5",
  "2a06:98c1:3120::5",
  "2a06:98c1:3121::5",
  "104.21.57.158",
  "172.67.191.30",
  "2606:4700:3032::6815:399e",
  "2606:4700:3036::ac43:bf1e",
]);
export const IPS_VERCEL = Object.freeze([
  "64.29.17.1",
  "64.29.17.65",
  "216.198.79.1",
  "216.198.79.65",
]);

// Un trozo del blocked-any.txt real del 10-10-2026 (con nuestras IPs).
export const TEXTO_LISTA_CON_BLOQUEO = [
  "2a06:98c1:3120::",
  "2a06:98c1:3120::3",
  "2a06:98c1:3120::5",
  "2a06:98c1:3121::",
  "2a06:98c1:3121::3",
  "2a06:98c1:3121::5",
  "104.20.18.209",
  "104.21.0.122",
  "104.21.57.76",
  "172.67.68.216",
  "172.67.191.63",
  "188.114.96.0",
  "188.114.96.5",
  "188.114.96.12",
  "188.114.97.0",
  "188.114.97.5",
  "188.114.97.12",
  "2606:4700:2ff9::1",
  "",
].join("\n");

// La misma lista cuando ya han liberado nuestras IPs (quedan otras).
export const TEXTO_LISTA_SIN_NOSOTROS = [
  "104.20.18.209",
  "104.21.0.122",
  "104.21.57.76",
  "172.67.68.216",
  "",
].join("\n");

// Registros de la zona que NUNCA se pueden tocar (y uno que se parece).
export const REGISTROS_AJENOS = Object.freeze([
  {
    id: "1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d11",
    type: "CNAME",
    name: "api.alhabla.ai",
    content: "ghs.googlehosted.com",
    proxied: false,
    ttl: 300,
    modified_on: "2026-09-01T10:00:00.000Z",
  },
  {
    id: "2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e22",
    type: "CNAME",
    name: "dev-api.alhabla.ai",
    content: "0f0f0f0f-0000-4000-8000-000000000000.cfargotunnel.com",
    proxied: true,
    ttl: 1,
    modified_on: "2026-09-01T10:00:00.000Z",
  },
  {
    id: "3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f33",
    type: "CNAME",
    name: "staging.app.alhabla.ai",
    content: DESTINO_VERCEL,
    proxied: true,
    ttl: 1,
    modified_on: "2026-09-01T10:00:00.000Z",
  },
  {
    id: "4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a44",
    type: "TXT",
    name: "alhabla.ai",
    content: "v=spf1 include:zoho.eu -all",
    proxied: false,
    ttl: 1,
    modified_on: "2026-09-01T10:00:00.000Z",
  },
]);

export const IDS_AJENOS = REGISTROS_AJENOS.map((r) => r.id);

/** Un CNAME de los nuestros. */
export function registro(nombre, opciones = {}) {
  const proxied = opciones.proxied ?? true;
  return {
    id: IDS[nombre],
    type: "CNAME",
    name: nombre,
    content: opciones.content ?? DESTINO_VERCEL,
    proxied,
    proxiable: true,
    ttl: opciones.ttl ?? (proxied ? 1 : 60),
    modified_on: new Date(
      opciones.modificado ?? AHORA - 60 * MINUTO
    ).toISOString(),
  };
}

/** Los tres nuestros (con opciones por nombre) más los ajenos. */
export function registrosDeZona(porNombre = {}, comun = {}) {
  return [
    ...REGISTROS_AJENOS.map((r) => ({ ...r })),
    ...HOSTNAMES.map((nombre) =>
      registro(nombre, { ...comun, ...(porNombre[nombre] ?? {}) })
    ),
  ];
}

/**
 * Un control de KV con la marca del conmutador en esos registros. Por
 * defecto la marca es «sin confirmar» (como una semilla); con
 * `registro: { pendiente: true }` es la que se escribe antes del PATCH, y con
 * `registro: { modificadoEn }`, la de un apagado confirmado.
 */
export function controlConMarca(nombres, apagadoEnMs, extra = {}, registro = {}) {
  const apagadoEn = new Date(apagadoEnMs).toISOString();
  return {
    version: 1,
    marca: {
      registros: Object.fromEntries(
        nombres.map((n) => [n, { apagadoEn, ...registro }])
      ),
      motivo: "bloqueo_detectado",
      origen: "conmutador",
      ipsBloqueadas: ["188.114.96.5"],
    },
    ultimoCambio: { accion: "apagar", en: apagadoEn, hostnames: nombres },
    limpiasSeguidas: 0,
    ...extra,
  };
}

// El SOA que manda dns.hayahora.futbol (DigitalOcean, mínimo 1800 s) en la
// Authority de una respuesta negativa, con el TTL que le queda a la caché.
export const SOA_DNS_HAYAHORA =
  "ns1.digitalocean.com. hostmaster.dns.hayahora.futbol. 0 10800 3600 604800 1800";

/**
 * Lo que devuelve un resolvedor por DoH para blocked.dns.hayahora.futbol:
 * las IPs de ese tipo con TTL 30 o, si no hay ninguna, NXDOMAIN (o NOERROR
 * sin registros) con el SOA, guardado en la caché hace `edadNegativaS`.
 */
export function respuestaDnsBloqueos(tipo, ips, edadNegativaS = 0) {
  const seis = tipo === "AAAA";
  const deEsteTipo = ips.filter((ip) => ip.includes(":") === seis);
  if (deEsteTipo.length) {
    return {
      Status: 0,
      Answer: deEsteTipo.map((data) => ({
        name: "blocked.dns.hayahora.futbol.",
        type: seis ? 28 : 1,
        TTL: 30,
        data,
      })),
    };
  }
  return {
    Status: ips.length ? 0 : 3,
    Authority: [
      {
        name: "dns.hayahora.futbol.",
        type: 6,
        TTL: Math.max(0, 1800 - edadNegativaS),
        data: SOA_DNS_HAYAHORA,
      },
    ],
  };
}
