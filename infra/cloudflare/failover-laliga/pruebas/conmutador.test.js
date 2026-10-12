import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  analizarIp,
  analizarLista,
  analizarRango,
  aplicarResultados,
  debeGuardarObservacion,
  decidir,
  esDestinoVercel,
  esIpDeCloudflare,
  estadoProxy,
  evaluarRespuestaLista,
  extraerIpsDoh,
  formatearIp,
  fusionarIps,
  indiceDeIps,
  ipsEnLista,
  leerConfiguracion,
  mismoControl,
  negativaCacheadaDesde,
  normalizarControl,
  normalizarIp,
  respuestaDohValida,
  resumirConfirmacion,
  seleccionarRegistros,
} from "../src/conmutador.js";
import {
  AHORA,
  DESTINO_VERCEL,
  HOSTNAMES,
  IDS,
  IDS_AJENOS,
  IPS_CLOUDFLARE,
  IPS_VERCEL,
  MINUTO,
  TEXTO_LISTA_CON_BLOQUEO,
  TEXTO_LISTA_SIN_NOSOTROS,
  TOKEN,
  ZONA,
  controlConMarca,
  registrosDeZona,
  respuestaDnsBloqueos,
} from "./ayudas.js";

const lista = (cuerpo) =>
  evaluarRespuestaLista({ estado: 200, tipoContenido: "text/plain", cuerpo });
const LISTA_CON_BLOQUEO = lista(TEXTO_LISTA_CON_BLOQUEO);
const LISTA_SIN_NOSOTROS = lista(TEXTO_LISTA_SIN_NOSOTROS);
const LISTA_VACIA = lista("");

/**
 * Lo que da el DNS de hayahora si publica `ips` (A y AAAA, por dns.google y
 * cloudflare-dns.com) y sus respuestas negativas entraron en la caché hace
 * `edadNegativaS`.
 */
const confirmacionDe = (ips, ahora = AHORA, edadNegativaS = 0) =>
  resumirConfirmacion(
    ["A", "AAAA"].flatMap((tipo) =>
      [0, 1].map(() => ({
        tipo,
        datos: respuestaDnsBloqueos(tipo, ips, edadNegativaS),
      }))
    ),
    ahora
  );
/** Las IPs de una lista ya evaluada (lo que publicaría su DNS). */
const ipsDe = (listaEvaluada) => [...listaEvaluada.entradas.exactas];

function entrada(campos = {}) {
  return {
    ahora: AHORA,
    hostnames: HOSTNAMES,
    registros: registrosDeZona(),
    lista: LISTA_SIN_NOSOTROS,
    ipsCloudflare: IPS_CLOUDFLARE,
    ipsVercel: IPS_VERCEL,
    control: null,
    ...campos,
  };
}

/**
 * Simula varias ejecuciones seguidas aplicando las decisiones como lo haría
 * index.js con la API (los PATCH salen bien, cambian modified_on y lo
 * devuelven), KV (se guarda el control y desde cuándo está inoperativo) y el
 * DNS de hayahora (por defecto, repite la lista de ese paso, al día; cada
 * paso puede traer su `confirmacion`).
 */
function simular({ registros, control, pasos }) {
  let zona = registros.map((r) => ({ ...r }));
  let estado = control;
  let inoperativoDesde = null;
  let operativoDesde = null;
  const decisiones = [];
  for (const paso of pasos) {
    const base = entrada({
      ahora: paso.ahora,
      registros: zona,
      lista: paso.lista,
      control: estado,
      inoperativoDesde,
      operativoDesde,
    });
    let decision = decidir(base);
    if (decision.pideConfirmacion) {
      decision = decidir({
        ...base,
        confirmacion:
          paso.confirmacion ?? confirmacionDe(ipsDe(paso.lista), paso.ahora),
      });
    }
    const modificadoEn = new Date(paso.ahora + 1000).toISOString();
    zona = zona.map((r) => {
      const cambio = decision.cambios.find((c) => c.id === r.id);
      if (!cambio) return r;
      return { ...r, ...cambio.cuerpo, modified_on: modificadoEn };
    });
    estado = aplicarResultados(
      decision,
      decision.cambios.map((c) => ({ nombre: c.nombre, ok: true, modificadoEn }))
    );
    inoperativoDesde = decision.inoperativoDesde;
    operativoDesde = decision.operativoDesde;
    decisiones.push(decision);
  }
  return { decisiones, zona, control: estado };
}

/** Un paso cada 2 minutos, de `desde` a `hasta` (minutos), con esa lista. */
const pasosCada2 = (desde, hasta, listaPaso, extra = {}) => {
  const pasos = [];
  for (let min = desde; min <= hasta; min += 2) {
    pasos.push({ ahora: AHORA + min * MINUTO, lista: listaPaso, ...extra });
  }
  return pasos;
};

const cuerposDe = (decision) =>
  Object.fromEntries(decision.cambios.map((c) => [c.nombre, c.cuerpo]));

// ─── IPs ────────────────────────────────────────────────────────────────────

describe("IPs", () => {
  it("analiza y formatea IPv4", () => {
    assert.deepEqual(analizarIp("188.114.96.5"), {
      familia: 4,
      valor: (188n << 24n) | (114n << 16n) | (96n << 8n) | 5n,
    });
    assert.equal(normalizarIp(" 188.114.97.5 "), "188.114.97.5");
    assert.equal(normalizarIp("0.0.0.0"), "0.0.0.0");
    assert.equal(normalizarIp("255.255.255.255"), "255.255.255.255");
  });

  it("rechaza IPv4 mal formadas", () => {
    for (const malo of [
      "256.1.1.1",
      "1.2.3",
      "1.2.3.4.5",
      "a.b.c.d",
      "1.2.3.-4",
      "1.2.3.4/",
      "",
      "1..2.3",
    ]) {
      assert.equal(analizarIp(malo), null, malo);
    }
    assert.equal(analizarIp(null), null);
    assert.equal(analizarIp(42), null);
  });

  it("analiza IPv6 en todas sus formas y las deja canónicas", () => {
    const casos = {
      "2a06:98c1:3120::": "2a06:98c1:3120::",
      "2a06:98c1:3120::5": "2a06:98c1:3120::5",
      "2A06:98C1:3121:0:0:0:0:5": "2a06:98c1:3121::5",
      "2a06:98c1:3121:0000:0000:0000:0000:0005": "2a06:98c1:3121::5",
      "::": "::",
      "::1": "::1",
      "[2606:4700:2ff9::1]": "2606:4700:2ff9::1",
      "fe80::1%en0": "fe80::1",
      "1:0:0:2:0:0:0:3": "1:0:0:2::3",
      "1:2:3:4:5:6:7:8": "1:2:3:4:5:6:7:8",
      "1:2:3:4:5:6:7::": "1:2:3:4:5:6:7:0",
      "2001:db8:0:0:1:0:0:1": "2001:db8::1:0:0:1",
    };
    for (const [entradaIp, canonica] of Object.entries(casos)) {
      assert.equal(normalizarIp(entradaIp), canonica, entradaIp);
    }
  });

  it("rechaza IPv6 mal formadas", () => {
    for (const malo of [
      "1:::2",
      "12345::",
      "1:2:3:4:5:6:7:8:9",
      ":1",
      "1:",
      "2a06:98c1:3120::5::1",
      "1:2:3:4:5:6:7",
      "g::1",
      "::1.2.3",
    ]) {
      assert.equal(analizarIp(malo), null, malo);
    }
  });

  it("trata una IPv4 mapeada en IPv6 como IPv4", () => {
    assert.equal(normalizarIp("::ffff:188.114.96.5"), "188.114.96.5");
    assert.equal(normalizarIp("::ffff:bc72:6005"), "188.114.96.5");
    assert.deepEqual(ipsEnLista(["::ffff:188.114.96.5"], LISTA_CON_BLOQUEO.entradas), [
      "188.114.96.5",
    ]);
  });

  it("analiza CIDR IPv4 e IPv6 (con bits de host) y rangos con guion", () => {
    const v4 = analizarRango("188.114.96.77/24");
    assert.equal(formatearIp({ familia: 4, valor: v4.inicio }), "188.114.96.0");
    assert.equal(formatearIp({ familia: 4, valor: v4.fin }), "188.114.96.255");
    const v6 = analizarRango("2a06:98c1:3120::/48");
    assert.equal(formatearIp({ familia: 6, valor: v6.inicio }), "2a06:98c1:3120::");
    assert.equal(
      formatearIp({ familia: 6, valor: v6.fin }),
      "2a06:98c1:3120:ffff:ffff:ffff:ffff:ffff"
    );
    const todo = analizarRango("0.0.0.0/0");
    assert.equal(todo.inicio, 0n);
    assert.equal(todo.fin, (1n << 32n) - 1n);
    const guion = analizarRango("188.114.97.0-188.114.97.9");
    assert.equal(guion.fin - guion.inicio, 9n);
    for (const malo of [
      "188.114.96.0/33",
      "2a06::/129",
      "188.114.96.0/",
      "188.114.96.0/x",
      "1.2.3.9-1.2.3.1",
      "1.2.3.4-2a06::1",
      "hola",
    ]) {
      assert.equal(analizarRango(malo), null, malo);
    }
  });

  it("distingue las IPs de Cloudflare de las de Vercel", () => {
    for (const ip of IPS_CLOUDFLARE) assert.equal(esIpDeCloudflare(ip), true, ip);
    assert.equal(esIpDeCloudflare("2606:4700:3030::6815:399e"), true);
    for (const ip of IPS_VERCEL) assert.equal(esIpDeCloudflare(ip), false, ip);
    assert.equal(esIpDeCloudflare("no es una ip"), false);
  });

  it("encuentra nuestras IPs en la lista, sueltas, en CIDR y en IPv6", () => {
    assert.deepEqual(ipsEnLista(IPS_CLOUDFLARE, LISTA_CON_BLOQUEO.entradas), [
      "188.114.96.5",
      "188.114.97.5",
      "2a06:98c1:3120::5",
      "2a06:98c1:3121::5",
    ]);
    const cidr = lista("188.114.96.0/23\n2a06:98c1:3121::/48\n");
    assert.deepEqual(ipsEnLista(IPS_CLOUDFLARE, cidr.entradas), [
      "188.114.96.5",
      "188.114.97.5",
      "2a06:98c1:3121::5",
    ]);
    // "2a06:98c1:3120::" es una dirección, no un prefijo: no cubre la ::5.
    const direccion = lista("2a06:98c1:3120::\n");
    assert.deepEqual(ipsEnLista(IPS_CLOUDFLARE, direccion.entradas), []);
  });

  it("un rango IPv6 no casa con IPv4 aunque el número caiga dentro", () => {
    // 188.114.96.5 vale 0xbc726005, que está en ::/96 (0 … 2^32-1).
    assert.deepEqual(ipsEnLista(["188.114.96.5"], lista("::/96\n").entradas), []);
    assert.deepEqual(
      ipsEnLista(["2a06:98c1:3120::5"], lista("0.0.0.0/0\n").entradas),
      []
    );
    assert.deepEqual(ipsEnLista(["188.114.96.5"], lista("0.0.0.0/0\n").entradas), [
      "188.114.96.5",
    ]);
    // Y un índice de IPs sueltas (la respuesta DNS de hayahora).
    assert.deepEqual(
      ipsEnLista(IPS_CLOUDFLARE, indiceDeIps(["188.114.97.5", "no-ip", "64.29.17.1"])),
      ["188.114.97.5"]
    );
  });
});

// ─── Lista de hayahora ──────────────────────────────────────────────────────

describe("lista de bloqueos", () => {
  it("entiende el formato real de blocked-any.txt", () => {
    assert.equal(LISTA_CON_BLOQUEO.valida, true);
    assert.equal(LISTA_CON_BLOQUEO.total, 18);
    assert.equal(LISTA_CON_BLOQUEO.vacia, false);
  });

  it("admite comentarios, CRLF, BOM, espacios y columnas extra", () => {
    const analisis = analizarLista(
      "﻿# lista de prueba\r\n188.114.96.5 Movistar\r\n\r\n  2a06:98c1:3120::5,DIGI  # nota\r\n188.114.97.0/24;Orange\r\n"
    );
    assert.equal(analisis.total, 3);
    assert.equal(analisis.invalidas, 0);
    assert.deepEqual([...analisis.entradas.exactas].sort(), [
      "188.114.96.5",
      "2a06:98c1:3120::5",
    ]);
    assert.deepEqual(
      analisis.entradas.rangos.map((e) => e.texto),
      ["188.114.97.0/24"]
    );
  });

  it("normaliza las IPs de la lista aunque vengan escritas de otra forma", () => {
    // Ceros a la izquierda, mayúsculas, sin comprimir o mapeadas: todas casan
    // con nuestra forma canónica.
    const rara = lista(
      "188.114.096.005\n2A06:98C1:3121:0:0:0:0:5\n::ffff:172.67.191.30\n[2606:4700:3032::6815:399e]\n"
    );
    assert.equal(rara.valida, true);
    assert.deepEqual(ipsEnLista(IPS_CLOUDFLARE, rara.entradas), [
      "172.67.191.30",
      "188.114.96.5",
      "2606:4700:3032::6815:399e",
      "2a06:98c1:3121::5",
    ]);
  });

  it("una lista vacía (o solo comentarios) es válida: es lo normal entre partidos", () => {
    for (const cuerpo of ["", "\n", "   \n\n", "# nada bloqueado\n"]) {
      const resultado = lista(cuerpo);
      assert.equal(resultado.valida, true, JSON.stringify(cuerpo));
      assert.equal(resultado.vacia, true);
      assert.equal(resultado.total, 0);
    }
  });

  it("es inválida si falla la red o el HTTP", () => {
    assert.equal(evaluarRespuestaLista({ error: "plazo agotado" }).motivo, "error_de_red");
    assert.equal(evaluarRespuestaLista(null).motivo, "sin_respuesta");
    for (const estado of [404, 500, 503, 304]) {
      const r = evaluarRespuestaLista({ estado, cuerpo: TEXTO_LISTA_CON_BLOQUEO });
      assert.equal(r.valida, false);
      assert.equal(r.motivo, `http_${estado}`);
    }
  });

  it("es inválida si es una página HTML o un JSON", () => {
    assert.equal(
      evaluarRespuestaLista({
        estado: 200,
        tipoContenido: "text/html; charset=utf-8",
        cuerpo: "188.114.96.5\n",
      }).motivo,
      "tipo_de_contenido_inesperado"
    );
    assert.equal(
      evaluarRespuestaLista({
        estado: 200,
        tipoContenido: "application/json",
        cuerpo: "[]",
      }).motivo,
      "tipo_de_contenido_inesperado"
    );
    assert.equal(
      lista("<!DOCTYPE html><title>Error 502</title>").motivo,
      "no_parece_una_lista"
    );
    assert.equal(lista('{"error":"mantenimiento"}').motivo, "no_parece_una_lista");
  });

  it("es inválida si no trae IPs o si demasiadas líneas no lo son", () => {
    assert.equal(lista("mantenimiento\nvuelva luego\n").motivo, "sin_ips");
    const basura = [...Array(8).fill("188.114.96.5"), "x", "y"].join("\n") + "\n";
    assert.equal(lista(basura).motivo, "formato_desconocido");
    // Una línea rara entre muchas buenas no invalida la lista.
    const unaMala =
      [...Array(30).fill("188.114.96.5"), "basura"].join("\n") + "\n";
    const resultado = lista(unaMala);
    assert.equal(resultado.valida, true);
    assert.equal(resultado.invalidas, 1);
  });

  it("es inválida si llega cortada (el fichero real siempre acaba en salto)", () => {
    // Se corta la última IP a medias: "2606:4700:2ff9::1\n" → "2606:4700".
    const cortada = TEXTO_LISTA_CON_BLOQUEO.slice(0, -10);
    const resultado = lista(cortada);
    assert.equal(resultado.valida, false);
    assert.equal(resultado.motivo, "lista_truncada");
    // Cortada a mitad de una IP que sigue pareciendo una IP ("188.114.96.12"
    // → "188.114.96.1"): también es inválida.
    assert.equal(lista("104.20.18.209\n188.114.96.1").motivo, "lista_truncada");
    assert.equal(lista("188.114.96.5\n188.114.97.5").valida, false);
    assert.equal(lista("188.114.96.5\n188.114.97.5\n").valida, true);
  });

  it("es inválida si llegan menos bytes de los que anuncia Content-Length", () => {
    const cuerpo = "104.20.18.209\n104.21.0.122\n"; // 27 bytes, cortada en una línea entera
    const base = { estado: 200, cuerpo, bytesRecibidos: cuerpo.length };
    const corta = evaluarRespuestaLista({ ...base, longitudDeclarada: "4782" });
    assert.equal(corta.valida, false);
    assert.equal(corta.motivo, "lista_incompleta");
    assert.match(corta.detalle, /27 de 4782/);
    // Con la longitud justa, o comprimida (Content-Length es del gzip), vale.
    assert.equal(
      evaluarRespuestaLista({ ...base, longitudDeclarada: "27" }).valida,
      true
    );
    assert.equal(
      evaluarRespuestaLista({
        ...base,
        longitudDeclarada: "4782",
        codificacion: "gzip",
      }).valida,
      true
    );
    // Sin cabecera tampoco hay con qué comparar.
    assert.equal(evaluarRespuestaLista(base).valida, true);
  });

  it("es inválida si Last-Modified tiene más de 15 minutos (lista congelada)", () => {
    const conFecha = (minutos) =>
      evaluarRespuestaLista(
        {
          estado: 200,
          cuerpo: TEXTO_LISTA_SIN_NOSOTROS,
          ultimaModificacion: new Date(AHORA - minutos * MINUTO).toUTCString(),
        },
        { ahora: AHORA }
      );
    assert.equal(conFecha(2).valida, true);
    assert.equal(conFecha(15).valida, true);
    const vieja = conFecha(16);
    assert.equal(vieja.valida, false);
    assert.equal(vieja.motivo, "lista_antigua");
    // Una vacía congelada tampoco vale (sería «sin bloqueos» falso).
    assert.equal(
      evaluarRespuestaLista(
        {
          estado: 200,
          cuerpo: "",
          ultimaModificacion: new Date(AHORA - 60 * MINUTO).toUTCString(),
        },
        { ahora: AHORA }
      ).motivo,
      "lista_antigua"
    );
    // Hasta 2 minutos en el futuro (relojes) vale; más, no: una lista
    // congelada ganaría tanto margen como desfase trajera la fecha.
    assert.equal(conFecha(-2).valida, true);
    assert.equal(conFecha(-3).motivo, "lista_con_fecha_futura");
    assert.equal(conFecha(-60).motivo, "lista_con_fecha_futura");
    // Sin cabecera o ilegible no se puede ver si está congelada: no vale.
    for (const ultimaModificacion of [null, "ayer"]) {
      const r = evaluarRespuestaLista(
        { estado: 200, cuerpo: "188.114.96.5\n", ultimaModificacion },
        { ahora: AHORA }
      );
      assert.equal(r.valida, false);
      assert.equal(r.motivo, "lista_sin_fecha");
    }
  });

  it("es inválida si es absurdamente grande", () => {
    const enorme = "188.114.96.5\n".repeat(100_000);
    assert.equal(lista(enorme).motivo, "demasiado_grande");
  });

  it("conserva la fecha de última modificación", () => {
    const r = evaluarRespuestaLista({
      estado: 200,
      cuerpo: "188.114.96.5\n",
      ultimaModificacion: "Sat, 10 Oct 2026 16:59:30 GMT",
    });
    assert.equal(r.ultimaModificacion, "Sat, 10 Oct 2026 16:59:30 GMT");
  });
});

// ─── DoH e IPs conocidas ────────────────────────────────────────────────────

describe("DoH e IPs conocidas", () => {
  it("extrae A y AAAA de una respuesta DoH e ignora el resto", () => {
    const ips = extraerIpsDoh({
      Status: 0,
      Answer: [
        { name: "www.alhabla.ai.", type: 5, data: `${DESTINO_VERCEL}.` },
        { name: DESTINO_VERCEL, type: 1, data: "64.29.17.65" },
        { name: DESTINO_VERCEL, type: 1, data: "64.29.17.65" },
        { name: "alhabla.ai.", type: 28, data: "2A06:98C1:3120:0::5" },
        { name: "alhabla.ai.", type: 16, data: '"v=spf1"' },
        { name: "alhabla.ai.", type: 1, data: "no-ip" },
      ],
    });
    assert.deepEqual(ips, ["2a06:98c1:3120::5", "64.29.17.65"]);
    assert.deepEqual(extraerIpsDoh({ Status: 3 }), []);
    assert.deepEqual(extraerIpsDoh(null), []);
    assert.deepEqual(extraerIpsDoh({ Status: 0 }), []);
  });

  it("resume el DNS de hayahora y sabe desde cuándo está cacheada una negativa", () => {
    const soa = (ttl) => ({
      Status: 0,
      Authority: [{ type: 6, TTL: ttl, data: "ns1.digitalocean.com. h. 0 10800 3600 604800 1800" }],
    });
    // Visto el 10-10 a las 18:07Z: TTL 409 de 1800 → cacheada hace 1391 s.
    assert.equal(negativaCacheadaDesde(soa(409), AHORA), AHORA - 1391 * 1000);
    assert.equal(negativaCacheadaDesde({ Status: 3 }, AHORA), null);
    const r = resumirConfirmacion(
      [
        { tipo: "A", datos: { Status: 0, Answer: [{ type: 1, data: "104.21.0.122" }, { type: 5, data: "x." }] } },
        { tipo: "A", datos: soa(1800) },
        { tipo: "AAAA", datos: soa(409) },
        { tipo: "AAAA", datos: soa(1700) },
      ],
      AHORA
    );
    assert.equal(r.ok, true);
    assert.deepEqual(r.ips, ["104.21.0.122"]);
    // IPv4 tiene IPs (la negativa del otro resolvedor no cuenta); IPv6 se
    // queda con la negativa más antigua.
    assert.deepEqual(r.negativaDesde, { 4: null, 6: AHORA - 1391 * 1000 });
    assert.equal(resumirConfirmacion([{ tipo: "A", datos: soa(1800) }], AHORA).ok, false);
    assert.equal(
      resumirConfirmacion(
        [
          { tipo: "A", datos: soa(1800) },
          { tipo: "AAAA", datos: { Status: 3 } },
        ],
        AHORA
      ).negativaDesde[6],
      null
    );
  });

  it("solo NOERROR y NXDOMAIN son respuestas DoH válidas", () => {
    assert.equal(respuestaDohValida({ Status: 0 }), true);
    assert.equal(respuestaDohValida({ Status: 3 }), true);
    for (const malo of [{ Status: 2 }, { Status: 5 }, {}, null]) {
      assert.equal(respuestaDohValida(malo), false, JSON.stringify(malo));
    }
  });

  it("funde las IPs vistas con las guardadas y olvida las caducadas", () => {
    const viejo = new Date(AHORA - 40 * 24 * 60 * MINUTO).toISOString();
    const reciente = new Date(AHORA - 60 * MINUTO).toISOString();
    const anteriores = {
      "188.114.96.5": reciente,
      "104.21.1.1": viejo,
      "no-es-ip": reciente,
      "2A06:98C1:3120:0::5": "fecha-rota",
    };
    const caducidad = 30 * 24 * 60 * MINUTO;
    const fundidas = fusionarIps(anteriores, ["172.67.191.30"], AHORA, caducidad);
    assert.deepEqual(Object.keys(fundidas), [
      "172.67.191.30",
      "188.114.96.5",
      "2a06:98c1:3120::5",
    ]);
    assert.equal(fundidas["172.67.191.30"], new Date(AHORA).toISOString());
    // Sin nada visto (proxy apagado o DoH caído) no se olvida nada.
    const sinVer = fusionarIps(anteriores, [], AHORA, caducidad);
    assert.ok("104.21.1.1" in sinVer);
  });
});

// ─── Configuración y registros ──────────────────────────────────────────────

describe("configuración", () => {
  const base = {
    ZONE_ID: ZONA,
    HOSTNAMES: "alhabla.ai, www.alhabla.ai,app.alhabla.ai.",
    CF_API_TOKEN: TOKEN,
  };

  it("lee una configuración válida sin exponer el token", () => {
    const config = leerConfiguracion(base);
    assert.deepEqual(config, {
      zoneId: ZONA,
      hostnames: HOSTNAMES,
      modo: "activo",
      errores: [],
    });
    assert.ok(!JSON.stringify(config).includes(TOKEN));
    assert.deepEqual(
      leerConfiguracion({ ...base, HOSTNAMES: [...HOSTNAMES, "WWW.alhabla.ai"] })
        .hostnames,
      HOSTNAMES
    );
    assert.equal(leerConfiguracion({ ...base, MODO: "Observar" }).modo, "observar");
  });

  it("rechaza api y dev-api aunque se configuren", () => {
    const config = leerConfiguracion({
      ...base,
      HOSTNAMES: "alhabla.ai,api.alhabla.ai,dev-api.alhabla.ai",
    });
    assert.equal(config.errores.length, 2);
    assert.match(config.errores[0], /api\.alhabla\.ai no se puede conmutar/);
  });

  it("rechaza zona, modo, nombres y token que no valen", () => {
    assert.equal(leerConfiguracion({ ...base, ZONE_ID: "x" }).errores.length, 1);
    assert.equal(leerConfiguracion({ ...base, MODO: "a_medias" }).errores.length, 1);
    assert.equal(leerConfiguracion({ ...base, HOSTNAMES: "" }).errores.length, 1);
    assert.equal(
      leerConfiguracion({ ...base, HOSTNAMES: "alhabla.ai/x" }).errores.length,
      1
    );
    assert.equal(
      leerConfiguracion({ ...base, CF_API_TOKEN: undefined }).errores.length,
      1
    );
  });
});

describe("registros", () => {
  it("elige solo los tres CNAME por nombre exacto y tipo", () => {
    const seleccion = seleccionarRegistros(registrosDeZona(), HOSTNAMES);
    assert.deepEqual(
      seleccion.registros.map((r) => r.id),
      HOSTNAMES.map((n) => IDS[n])
    );
    assert.deepEqual(seleccion.faltan, []);
    for (const id of IDS_AJENOS) {
      assert.ok(!seleccion.registros.some((r) => r.id === id));
    }
  });

  it("detecta registros que faltan o duplicados", () => {
    const sinWww = registrosDeZona().filter((r) => r.id !== IDS["www.alhabla.ai"]);
    assert.deepEqual(seleccionarRegistros(sinWww, HOSTNAMES).faltan, [
      "www.alhabla.ai",
    ]);
    const doble = [...registrosDeZona(), { ...registrosDeZona()[4], id: "otro" }];
    assert.deepEqual(seleccionarRegistros(doble, HOSTNAMES).duplicados, [
      "alhabla.ai",
    ]);
  });

  it("solo acepta destinos de Vercel", () => {
    assert.equal(esDestinoVercel(DESTINO_VERCEL), true);
    assert.equal(esDestinoVercel(`${DESTINO_VERCEL}.`), true);
    assert.equal(esDestinoVercel("cname.vercel-dns.com"), true);
    assert.equal(esDestinoVercel("ghs.googlehosted.com"), false);
    assert.equal(esDestinoVercel("vercel-dns.com.example.org"), false);
  });

  it("resume el estado del proxy", () => {
    const r = (proxied) => ({ proxied });
    assert.equal(estadoProxy([r(true), r(true)]), "encendido");
    assert.equal(estadoProxy([r(false), r(false)]), "apagado");
    assert.equal(estadoProxy([r(true), r(false)]), "mezclado");
    assert.equal(estadoProxy([]), "sin_registros");
  });
});

// ─── Decidir: apagar ────────────────────────────────────────────────────────

describe("decidir: apagar", () => {
  it("con una IP nuestra bloqueada apaga los tres registros", () => {
    const decision = decidir(entrada({ lista: LISTA_CON_BLOQUEO }));
    assert.equal(decision.accion, "apagar");
    assert.equal(decision.motivo, "bloqueo_detectado");
    assert.equal(decision.escribirControlAntes, true);
    assert.deepEqual(
      decision.cambios.map((c) => c.id),
      HOSTNAMES.map((n) => IDS[n])
    );
    for (const cambio of decision.cambios) {
      assert.deepEqual(cambio.cuerpo, { proxied: false, ttl: 60 });
    }
    assert.deepEqual(decision.bloqueadasNuestras, [
      "188.114.96.5",
      "188.114.97.5",
      "2a06:98c1:3120::5",
      "2a06:98c1:3121::5",
    ]);
    const marca = decision.control.marca;
    assert.deepEqual(Object.keys(marca.registros).sort(), [...HOSTNAMES].sort());
    for (const datos of Object.values(marca.registros)) {
      assert.equal(datos.apagadoEn, new Date(AHORA).toISOString());
      assert.equal(datos.pendiente, true);
    }
    assert.equal(marca.origen, "conmutador");
    assert.deepEqual(decision.control.ultimoCambio, {
      accion: "apagar",
      en: new Date(AHORA).toISOString(),
      hostnames: HOSTNAMES,
    });
  });

  it("también apaga si solo está bloqueada una IPv6 nuestra", () => {
    const decision = decidir(entrada({ lista: lista("2a06:98c1:3121::5\n") }));
    assert.equal(decision.accion, "apagar");
    assert.deepEqual(decision.bloqueadasNuestras, ["2a06:98c1:3121::5"]);
  });

  it("también apaga si la lista trae un CIDR que nos cubre", () => {
    const decision = decidir(entrada({ lista: lista("188.114.96.0/20\n") }));
    assert.equal(decision.accion, "apagar");
    assert.deepEqual(decision.bloqueadasNuestras, ["188.114.96.5", "188.114.97.5"]);
  });

  it("si Vercel también está bloqueado no hace nada", () => {
    const decision = decidir(
      entrada({ lista: lista(`${TEXTO_LISTA_CON_BLOQUEO}64.29.17.65\n`) })
    );
    assert.equal(decision.accion, "ninguna");
    assert.equal(decision.motivo, "vercel_tambien_bloqueado");
    assert.deepEqual(decision.vercelBloqueadas, ["64.29.17.65"]);
    assert.deepEqual(decision.cambios, []);
  });

  it("sin IPs de Vercel conocidas no apaga a ciegas", () => {
    const decision = decidir(entrada({ lista: LISTA_CON_BLOQUEO, ipsVercel: [] }));
    assert.equal(decision.accion, "ninguna");
    assert.equal(decision.motivo, "sin_ips_de_vercel");
  });

  it("con la lista inválida no hace nada", () => {
    for (const mala of [
      evaluarRespuestaLista({ error: "plazo agotado" }),
      evaluarRespuestaLista({ estado: 503, cuerpo: "" }),
      lista("<html>"),
    ]) {
      const decision = decidir(entrada({ lista: mala }));
      assert.equal(decision.accion, "ninguna");
      assert.equal(decision.motivo, "lista_invalida");
      assert.equal(decision.gravedad, "aviso");
      assert.deepEqual(decision.cambios, []);
    }
  });

  it("sin IPs de Cloudflare conocidas no puede saber si nos afecta", () => {
    const decision = decidir(entrada({ lista: LISTA_CON_BLOQUEO, ipsCloudflare: [] }));
    assert.equal(decision.motivo, "sin_ips_conocidas");
    assert.deepEqual(decision.cambios, []);
  });

  it("antirrebote: no apaga si el último cambio fue hace menos de 10 minutos", () => {
    const control = {
      ultimoCambio: {
        accion: "encender",
        en: new Date(AHORA - 9 * MINUTO).toISOString(),
      },
    };
    const pronto = decidir(entrada({ lista: LISTA_CON_BLOQUEO, control }));
    assert.equal(pronto.accion, "ninguna");
    assert.equal(pronto.motivo, "antirrebote");
    const luego = decidir(
      entrada({ lista: LISTA_CON_BLOQUEO, control, ahora: AHORA + 1 * MINUTO })
    );
    assert.equal(luego.accion, "apagar");
  });

  it("antirrebote: cuenta también un cambio hecho a mano en la API", () => {
    const registros = registrosDeZona({
      "www.alhabla.ai": { modificado: AHORA - 3 * MINUTO },
    });
    const decision = decidir(entrada({ lista: LISTA_CON_BLOQUEO, registros }));
    assert.equal(decision.motivo, "antirrebote");
    assert.deepEqual(decision.cambios, []);
  });

  it("con registros incompletos, duplicados o que no van a Vercel no toca nada", () => {
    const sinApp = registrosDeZona().filter((r) => r.name !== "app.alhabla.ai");
    const incompleto = decidir(entrada({ lista: LISTA_CON_BLOQUEO, registros: sinApp }));
    assert.equal(incompleto.motivo, "registros_incompletos");
    assert.equal(incompleto.gravedad, "error");
    assert.deepEqual(incompleto.faltan, ["app.alhabla.ai"]);
    assert.deepEqual(incompleto.cambios, []);

    const otroDestino = registrosDeZona({
      "app.alhabla.ai": { content: "ghs.googlehosted.com" },
    });
    const noVercel = decidir(
      entrada({ lista: LISTA_CON_BLOQUEO, registros: otroDestino })
    );
    assert.equal(noVercel.motivo, "destino_no_vercel");
    assert.deepEqual(noVercel.noVercel, ["app.alhabla.ai"]);
    assert.deepEqual(noVercel.cambios, []);

    // Tres destinos de Vercel distintos serían 36 consultas DoH y los PATCH
    // no cabrían en las 50 subpeticiones: se niega.
    const distintos = decidir(
      entrada({
        lista: LISTA_CON_BLOQUEO,
        registros: registrosDeZona({ "app.alhabla.ai": { content: "cname.vercel-dns.com" } }),
      })
    );
    assert.equal(distintos.motivo, "destinos_distintos");
    assert.equal(distintos.gravedad, "error");
    assert.equal(distintos.inoperativo, true);
    assert.deepEqual(distintos.destinos, ["11d10c4786ee7e11.vercel-dns-017.com", "cname.vercel-dns.com"]);
    assert.deepEqual(distintos.cambios, []);
  });

  it("sin bloqueo y con el proxy encendido no hace nada", () => {
    for (const sinBloqueo of [LISTA_SIN_NOSOTROS, LISTA_VACIA]) {
      const decision = decidir(entrada({ lista: sinBloqueo }));
      assert.equal(decision.accion, "ninguna");
      assert.equal(decision.motivo, "sin_bloqueo");
      assert.equal(decision.control.limpiasSeguidas, 0);
    }
  });

  it("nunca propone cambios para registros ajenos", () => {
    const listas = [LISTA_CON_BLOQUEO, LISTA_SIN_NOSOTROS, LISTA_VACIA];
    const controles = [null, controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO)];
    for (const l of listas) {
      for (const control of controles) {
        for (const comun of [{ proxied: true }, { proxied: false }]) {
          const decision = decidir(
            entrada({ lista: l, control, registros: registrosDeZona({}, comun) })
          );
          for (const cambio of decision.cambios) {
            assert.ok(Object.values(IDS).includes(cambio.id));
            assert.ok(!IDS_AJENOS.includes(cambio.id));
          }
        }
      }
    }
  });
});

// ─── Decidir: encender ──────────────────────────────────────────────────────

describe("decidir: encender", () => {
  const apagados = () => registrosDeZona({}, { proxied: false, modificado: AHORA });
  const t = (min) => AHORA + min * MINUTO;
  const iso = (ms) => new Date(ms).toISOString();

  it("histéresis: 2 ejecuciones y 10 minutos limpios, y 15 desde el apagado", () => {
    const { decisiones, control, zona } = simular({
      registros: apagados(),
      control: controlConMarca(HOSTNAMES, AHORA),
      pasos: [
        { ahora: t(2), lista: LISTA_CON_BLOQUEO },
        { ahora: t(4), lista: LISTA_SIN_NOSOTROS },
        { ahora: t(6), lista: LISTA_SIN_NOSOTROS },
        { ahora: t(8), lista: LISTA_CON_BLOQUEO },
        ...pasosCada2(10, 20, LISTA_SIN_NOSOTROS),
      ],
    });
    assert.deepEqual(
      decisiones.map((d) => [d.accion, d.motivo, d.control.limpiasSeguidas]),
      [
        ["ninguna", "sigue_bloqueado", 0],
        ["ninguna", "esperando_ejecuciones_limpias", 1],
        ["ninguna", "esperando_tiempo_limpio", 2],
        ["ninguna", "sigue_bloqueado", 0],
        ["ninguna", "esperando_ejecuciones_limpias", 1],
        ["ninguna", "esperando_tiempo_limpio", 2],
        ["ninguna", "esperando_tiempo_limpio", 3],
        ["ninguna", "esperando_tiempo_limpio", 4],
        ["ninguna", "esperando_tiempo_limpio", 5],
        ["encender", "fin_del_bloqueo", 6],
      ]
    );
    // La racha limpia cuenta desde la primera ejecución sin bloqueo.
    assert.equal(decisiones[1].control.limpioDesde, iso(t(4)));
    assert.equal(decisiones[3].control.limpioDesde, null);
    assert.equal(decisiones[9].control.limpioDesde, iso(t(10)));
    // La semilla se confirma (adopta) en cuanto se ve en DNS-only.
    assert.deepEqual(decisiones[0].control.marca.registros["alhabla.ai"], {
      apagadoEn: iso(AHORA),
      modificadoEn: iso(AHORA),
    });
    const ultima = decisiones.at(-1);
    assert.deepEqual(cuerposDe(ultima), {
      "alhabla.ai": { proxied: true, ttl: 1 },
      "www.alhabla.ai": { proxied: true, ttl: 1 },
      "app.alhabla.ai": { proxied: true, ttl: 1 },
    });
    assert.equal(ultima.escribirControlAntes, false);
    assert.equal(control.marca, null);
    assert.equal(control.limpiasSeguidas, 0);
    assert.equal(control.limpioDesde, null);
    assert.deepEqual(control.ultimoCambio, {
      accion: "encender",
      en: iso(t(20)),
      hostnames: HOSTNAMES,
    });
    for (const nombre of HOSTNAMES) {
      assert.equal(zona.find((r) => r.id === IDS[nombre]).proxied, true, nombre);
    }
  });

  it("espera 15 minutos desde el apagado aunque la racha limpia ya dure 10", () => {
    const { decisiones } = simular({
      registros: apagados(),
      control: controlConMarca(HOSTNAMES, AHORA, {}, { modificadoEn: iso(AHORA) }),
      pasos: pasosCada2(0, 16, LISTA_SIN_NOSOTROS),
    });
    assert.deepEqual(
      decisiones.map((d) => d.motivo),
      [
        "esperando_ejecuciones_limpias",
        "esperando_tiempo_limpio",
        "esperando_tiempo_limpio",
        "esperando_tiempo_limpio",
        "esperando_tiempo_limpio",
        "esperando_tiempo_minimo",
        "esperando_tiempo_minimo",
        "esperando_tiempo_minimo",
        "fin_del_bloqueo",
      ]
    );
  });

  it("aunque el bloqueo acabara hace horas, espera 2 ejecuciones y 10 minutos limpios", () => {
    const { decisiones } = simular({
      registros: apagados(),
      control: controlConMarca(HOSTNAMES, AHORA - 3 * 60 * MINUTO),
      pasos: pasosCada2(0, 10, LISTA_SIN_NOSOTROS),
    });
    assert.deepEqual(
      decisiones.map((d) => d.accion),
      ["ninguna", "ninguna", "ninguna", "ninguna", "ninguna", "encender"]
    );
  });

  it("una lista vacía cuenta como ejecución limpia", () => {
    const { decisiones } = simular({
      registros: apagados(),
      control: controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO),
      pasos: pasosCada2(0, 10, LISTA_VACIA),
    });
    assert.equal(decisiones.at(-1).accion, "encender");
  });

  it("una sola lista inválida en medio ni cuenta ni rompe la racha", () => {
    const { decisiones } = simular({
      registros: apagados(),
      control: controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO),
      pasos: [
        { ahora: AHORA, lista: LISTA_SIN_NOSOTROS },
        { ahora: t(2), lista: evaluarRespuestaLista({ estado: 502 }) },
        ...pasosCada2(4, 10, LISTA_SIN_NOSOTROS),
      ],
    });
    assert.deepEqual(
      decisiones.map((d) => [d.motivo, d.control.limpiasSeguidas]),
      [
        ["esperando_ejecuciones_limpias", 1],
        ["lista_invalida", 1],
        ["esperando_tiempo_limpio", 2],
        ["esperando_tiempo_limpio", 3],
        ["esperando_tiempo_limpio", 4],
        ["fin_del_bloqueo", 5],
      ]
    );
    // La inválida no toca el control (ni una escritura de KV).
    assert.ok(mismoControl(decisiones[1].control, decisiones[0].control));
    assert.equal(decisiones[2].control.limpioDesde, iso(AHORA));
  });

  it("dos ejecuciones seguidas sin observar (más de 5 minutos) rompen la racha", () => {
    const invalida = evaluarRespuestaLista({ estado: 502 });
    const { decisiones } = simular({
      registros: apagados(),
      control: controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO),
      pasos: [
        { ahora: AHORA, lista: LISTA_SIN_NOSOTROS },
        { ahora: t(2), lista: invalida },
        { ahora: t(4), lista: invalida },
        ...pasosCada2(6, 16, LISTA_SIN_NOSOTROS),
      ],
    });
    assert.deepEqual(
      decisiones.slice(3).map((d) => [d.motivo, d.control.limpiasSeguidas]),
      [
        ["esperando_ejecuciones_limpias", 1],
        ["esperando_tiempo_limpio", 2],
        ["esperando_tiempo_limpio", 3],
        ["esperando_tiempo_limpio", 4],
        ["esperando_tiempo_limpio", 5],
        ["fin_del_bloqueo", 6],
      ]
    );
    assert.equal(decisiones[3].control.limpioDesde, iso(t(6)));
  });

  it("si la API o KV fallan mientras vuelve el bloqueo, el hueco rompe la racha", () => {
    // Las ejecuciones de t=2 a t=16 no llegan a decidir (index.js sale antes):
    // no hay observación. En t=18 la lista sale limpia: una sola observación
    // tras un hueco de 18 minutos no basta para encender.
    const { decisiones } = simular({
      registros: apagados(),
      control: controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO),
      pasos: [
        { ahora: AHORA, lista: LISTA_SIN_NOSOTROS },
        ...pasosCada2(18, 28, LISTA_SIN_NOSOTROS),
      ],
    });
    assert.deepEqual(
      decisiones.map((d) => d.motivo),
      [
        "esperando_ejecuciones_limpias",
        "esperando_ejecuciones_limpias",
        "esperando_tiempo_limpio",
        "esperando_tiempo_limpio",
        "esperando_tiempo_limpio",
        "esperando_tiempo_limpio",
        "fin_del_bloqueo",
      ]
    );
    assert.equal(decisiones[1].control.limpioDesde, iso(t(18)));
    // Tras el hueco, cada familia también vuelve a contar desde ahora.
    assert.deepEqual(decisiones[1].control.familiaLimpiaDesde, {
      ipv4: iso(t(18)),
      ipv6: iso(t(18)),
    });
  });

  it("las IPs de la marca cuentan aunque la observación de KV venga atrasada", () => {
    // 188.114.96.5 se vio por primera vez justo antes de apagar y una lectura
    // atrasada de `observacion` no la trae: la marca (mismo documento que se
    // escribe antes del PATCH) sí, así que sigue contando como nuestra.
    const sinLaNueva = IPS_CLOUDFLARE.filter((ip) => ip !== "188.114.96.5");
    const control = controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO, {
      limpiasSeguidas: 9,
      limpioDesde: iso(AHORA - 20 * MINUTO),
      limpioHasta: iso(AHORA - 2 * MINUTO),
    });
    const comun = { registros: apagados(), control, ipsCloudflare: sinLaNueva };
    const enLista = decidir(entrada({ ...comun, lista: lista("188.114.96.5\n") }));
    assert.equal(enLista.motivo, "sigue_bloqueado");
    assert.deepEqual(enLista.bloqueadasNuestras, ["188.114.96.5"]);
    const enDns = decidir(
      entrada({ ...comun, lista: LISTA_VACIA, confirmacion: confirmacionDe(["188.114.96.5"]) })
    );
    assert.equal(enDns.motivo, "bloqueo_en_dns");
    // Al apagar, la marca guarda las bloqueadas (y no olvida las que ya tenía).
    const apagado = decidir(entrada({ lista: LISTA_CON_BLOQUEO, control: { marca: null } }));
    assert.ok(apagado.control.marca.ipsBloqueadas.includes("188.114.96.5"));
  });

  it("si lo apagó un humano (sin marca) nunca lo enciende", () => {
    const pasos = [];
    for (let i = 0; i < 20; i++) {
      pasos.push({
        ahora: AHORA + i * 2 * MINUTO,
        lista: i % 2 ? LISTA_VACIA : LISTA_SIN_NOSOTROS,
      });
    }
    pasos.push({ ahora: AHORA + 60 * MINUTO, lista: LISTA_CON_BLOQUEO });
    const { decisiones, zona } = simular({
      registros: apagados(),
      control: null,
      pasos,
    });
    for (const decision of decisiones) {
      assert.equal(decision.accion, "ninguna");
      assert.equal(decision.motivo, "apagado_a_mano");
      assert.deepEqual(decision.cambios, []);
      assert.equal(decision.pideConfirmacion, false);
    }
    assert.ok(zona.filter((r) => HOSTNAMES.includes(r.name) && r.type === "CNAME").every((r) => !r.proxied));
  });

  it("si un humano lo encendió mientras estaba marcado, limpia la marca", () => {
    const apagadoEn = AHORA - 30 * MINUTO;
    const decision = decidir(
      entrada({
        lista: LISTA_CON_BLOQUEO,
        registros: registrosDeZona({}, { proxied: true, modificado: AHORA - 5 * MINUTO }),
        control: controlConMarca(HOSTNAMES, apagadoEn),
      })
    );
    assert.equal(decision.accion, "limpiar_marca");
    assert.equal(decision.motivo, "encendido_a_mano");
    assert.deepEqual(decision.cambios, []);
    assert.equal(decision.control.marca, null);
    assert.equal(decision.control.limpiasSeguidas, 0);
    // Y en la siguiente, con el bloqueo aún activo, el antirrebote respeta el
    // cambio del humano durante 10 minutos.
    const siguiente = decidir(
      entrada({
        ahora: AHORA + 2 * MINUTO,
        lista: LISTA_CON_BLOQUEO,
        registros: registrosDeZona({}, { proxied: true, modificado: AHORA - 5 * MINUTO }),
        control: decision.control,
      })
    );
    assert.equal(siguiente.motivo, "antirrebote");
  });

  it("si un humano encendió solo uno, suelta ese y los demás siguen esperando", () => {
    const decision = decidir(
      entrada({
        lista: LISTA_CON_BLOQUEO,
        registros: registrosDeZona(
          { "www.alhabla.ai": { proxied: true, modificado: AHORA - MINUTO } },
          { proxied: false, modificado: AHORA - 30 * MINUTO }
        ),
        control: controlConMarca(HOSTNAMES, AHORA - 30 * MINUTO),
      })
    );
    assert.equal(decision.accion, "limpiar_marca");
    assert.deepEqual(Object.keys(decision.control.marca.registros).sort(), [
      "alhabla.ai",
      "app.alhabla.ai",
    ]);
    assert.deepEqual(decision.cambios, []);
  });

  it("una marca ilegible cuenta como apagado a mano (no enciende)", () => {
    const control = {
      marca: { registros: { "alhabla.ai": { apagadoEn: "ayer por la tarde" } } },
    };
    const decision = decidir(
      entrada({ registros: apagados(), control, lista: LISTA_VACIA })
    );
    assert.deepEqual(decision.cambios, []);
    assert.ok(decision.avisos.includes("marca_descartada:alhabla.ai"));
    assert.equal(normalizarControl("basura").avisos[0], "control_ilegible");
    assert.equal(normalizarControl([]).avisos[0], "control_ilegible");
    assert.deepEqual(normalizarControl({ marca: { registros: "todos" } }).avisos, [
      "marca_ilegible",
    ]);
    assert.deepEqual(
      normalizarControl({ ultimoCambio: { en: "nunca" } }).avisos,
      ["ultimo_cambio_ilegible"]
    );
    // Un modificadoEn ilegible deja la entrada «sin confirmar», no la rompe.
    const { control: normalizado } = normalizarControl({
      marca: {
        registros: {
          "alhabla.ai": { apagadoEn: iso(AHORA), modificadoEn: "x", pendiente: "sí" },
        },
      },
      limpioDesde: "nunca",
    });
    assert.deepEqual(normalizado.marca.registros["alhabla.ai"], {
      apagadoEn: iso(AHORA),
    });
    assert.equal(normalizado.limpioDesde, null);
  });

  it("ignora (con aviso) la marca de un nombre que ya no está configurado", () => {
    const control = controlConMarca(["viejo.alhabla.ai"], AHORA - 60 * MINUTO);
    const decision = decidir(entrada({ registros: apagados(), control }));
    assert.ok(decision.avisos.includes("marca_fuera_de_hostnames:viejo.alhabla.ai"));
    assert.deepEqual(decision.cambios, []);
    assert.equal(decision.control.marca, null);
  });
});

// ─── Confirmación con el DNS de hayahora ────────────────────────────────────

describe("decidir: confirmación con blocked.dns.hayahora.futbol", () => {
  // Todo listo para encender: marca de hace una hora y racha de 20 minutos.
  const listoParaEncender = (campos = {}) =>
    entrada({
      registros: registrosDeZona({}, { proxied: false }),
      control: controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO, {
        limpiasSeguidas: 9,
        limpioDesde: new Date(AHORA - 20 * MINUTO).toISOString(),
        limpioHasta: new Date(AHORA - 2 * MINUTO).toISOString(),
      }),
      lista: LISTA_VACIA,
      ...campos,
    });

  it("nunca enciende sin preguntar antes al DNS de hayahora", () => {
    const decision = decidir(listoParaEncender());
    assert.equal(decision.accion, "ninguna");
    assert.equal(decision.motivo, "esperando_confirmacion_dns");
    assert.equal(decision.pideConfirmacion, true);
    assert.deepEqual(decision.cambios, []);
  });

  it("con el DNS sin nuestras IPs (o sin nada, recién preguntado) enciende", () => {
    for (const ips of [[], ["104.21.0.122", "2606:4700:2ff9::1"]]) {
      const decision = decidir(
        listoParaEncender({ confirmacion: confirmacionDe(ips) })
      );
      assert.equal(decision.accion, "encender");
      assert.equal(decision.pideConfirmacion, false);
      assert.equal(decision.cambios.length, 3);
    }
    // Con la lista trayendo IPs ajenas, el DNS tiene que traer alguna.
    const conAjenas = (texto, ips) =>
      decidir(
        listoParaEncender({ lista: lista(texto), confirmacion: confirmacionDe(ips) })
      ).accion;
    assert.equal(conAjenas(TEXTO_LISTA_SIN_NOSOTROS, ["104.21.0.122", "9.9.9.9"]), "encender");
    assert.equal(
      conAjenas("104.21.0.122\n2606:4700:2ff9::1\n", ["104.21.0.122", "2606:4700:2ff9::1"]),
      "encender"
    );
  });

  it("caché negativa vieja: el DNS «sin nada» de antes de acabar el bloqueo no vale", () => {
    // Visto el 10-10 a las 18:07Z: dns.google y cloudflare-dns.com daban el
    // AAAA sin respuestas, cacheado hacía 20 minutos (SOA mínimo 1800 s),
    // con 10 IPv6 bloqueadas en la lista. La racha empezó hace 20 minutos.
    const motivo = (campos) => decidir(listoParaEncender(campos)).motivo;
    // Lista vacía y negativa cacheada hace 23 minutos (antes de la racha).
    assert.equal(
      motivo({ confirmacion: confirmacionDe([], AHORA, 23 * 60) }),
      "confirmacion_dns_desfasada"
    );
    // La misma de hace 21 (un ciclo antes de la primera limpia) sí vale.
    assert.equal(motivo({ confirmacion: confirmacionDe([], AHORA, 21 * 60) }), "fin_del_bloqueo");
    // La lista trae IPv4 o IPv6 ajenas y el DNS no tiene ninguna de esa
    // familia: aunque la negativa sea de ahora, no cuadra con la lista.
    assert.equal(
      motivo({ lista: LISTA_SIN_NOSOTROS, confirmacion: confirmacionDe([]) }),
      "confirmacion_dns_desfasada"
    );
    assert.equal(
      motivo({
        lista: lista("104.21.0.122\n2606:4700:2ff9::1\n"),
        confirmacion: confirmacionDe(["104.21.0.122"]),
      }),
      "confirmacion_dns_desfasada"
    );
    // Trae IPv4, pero ninguna de las de la lista.
    assert.equal(
      motivo({ lista: LISTA_SIN_NOSOTROS, confirmacion: confirmacionDe(["9.9.9.9"]) }),
      "confirmacion_dns_desfasada"
    );
    // Una negativa sin SOA no dice de cuándo es.
    assert.equal(
      motivo({ confirmacion: { ok: true, ips: [], negativaDesde: { 4: null, 6: null } } }),
      "confirmacion_dns_desfasada"
    );
    const decision = decidir(listoParaEncender({ confirmacion: confirmacionDe([], AHORA, 1500) }));
    assert.deepEqual(decision.cambios, []);
    assert.equal(decision.inoperativo, true);
    assert.equal(decision.gravedad, "aviso");
  });

  it("una negativa del AAAA vale desde que salieron nuestras IPv6, aunque las IPv4 siguieran", () => {
    // Lo normal al acabar un bloqueo: nuestras IPv6 salen de la lista ~10
    // minutos antes que las IPv4 y el AAAA negativo se queda en la caché.
    const t = (min) => AHORA + min * MINUTO;
    const negativas = (ahora, aaaaCacheadaEn) =>
      resumirConfirmacion(
        [
          { tipo: "A", datos: respuestaDnsBloqueos("A", [], 0) },
          { tipo: "AAAA", datos: respuestaDnsBloqueos("AAAA", [], (ahora - aaaaCacheadaEn) / 1000) },
        ],
        ahora
      );
    const pasosCon = (aaaaCacheadaEn) => [
      { ahora: t(0), lista: LISTA_CON_BLOQUEO },
      ...pasosCada2(2, 10, lista("188.114.96.5\n188.114.97.5\n")),
      ...pasosCada2(12, 22, LISTA_VACIA).map((paso) => ({
        ...paso,
        confirmacion: negativas(paso.ahora, aaaaCacheadaEn),
      })),
    ];
    const caso = (aaaaCacheadaEn) =>
      simular({
        registros: registrosDeZona({}, { proxied: false, modificado: AHORA - 60 * MINUTO }),
        control: controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO),
        pasos: pasosCon(aaaaCacheadaEn),
      }).decisiones;
    const bien = caso(t(2));
    assert.deepEqual(bien[1].control.familiaLimpiaDesde, { ipv4: null, ipv6: new Date(t(2)).toISOString() });
    assert.equal(bien.at(-1).motivo, "fin_del_bloqueo");
    // Cacheada antes de que salieran nuestras IPv6: no vale.
    assert.equal(caso(t(-1)).at(-1).motivo, "confirmacion_dns_desfasada");
  });

  it("si el DNS sigue viendo nuestras IPs, no enciende y vuelve a preguntar (la racha sigue)", () => {
    const decision = decidir(
      listoParaEncender({
        confirmacion: { ok: true, ips: ["1.2.3.4", "2A06:98C1:3120:0::5"] },
      })
    );
    assert.equal(decision.accion, "ninguna");
    assert.equal(decision.motivo, "bloqueo_en_dns");
    assert.deepEqual(decision.bloqueadasEnDns, ["2a06:98c1:3120::5"]);
    assert.deepEqual(decision.cambios, []);
    assert.equal(decision.control.limpiasSeguidas, 10);
    assert.equal(decision.control.limpioDesde, new Date(AHORA - 20 * MINUTO).toISOString());
    assert.equal(decision.inoperativo, true);
    assert.ok(decision.control.marca, "la marca sigue");
    // En la siguiente ejecución vuelve a pedir confirmación.
    const siguiente = decidir(
      listoParaEncender({ ahora: AHORA + 2 * MINUTO, control: decision.control })
    );
    assert.equal(siguiente.pideConfirmacion, true);
  });

  it("si el DNS no responde, no enciende (y cuenta como inoperativo)", () => {
    const decision = decidir(
      listoParaEncender({ confirmacion: { ok: false, error: "sin respuesta" } })
    );
    assert.equal(decision.motivo, "confirmacion_dns_fallida");
    assert.deepEqual(decision.cambios, []);
    assert.equal(decision.inoperativo, true);
    assert.equal(decision.gravedad, "aviso");
    assert.ok(decision.control.marca);
  });

  it("hayahora sirve una lista vacía falsa en pleno bloqueo: el DNS lo para", () => {
    const bloqueoEnDns = {
      confirmacion: { ok: true, ips: ["188.114.96.5", "2a06:98c1:3120::5"] },
    };
    const { decisiones, zona } = simular({
      registros: registrosDeZona(),
      control: null,
      pasos: [
        { ahora: AHORA, lista: LISTA_CON_BLOQUEO },
        ...pasosCada2(2, 90, LISTA_VACIA, bloqueoEnDns),
      ],
    });
    assert.equal(decisiones[0].accion, "apagar");
    assert.ok(decisiones.slice(1).every((d) => d.cambios.length === 0));
    assert.ok(decisiones.some((d) => d.motivo === "bloqueo_en_dns"));
    for (const nombre of HOSTNAMES) {
      assert.equal(zona.find((r) => r.id === IDS[nombre]).proxied, false, nombre);
    }
  });
});

// ─── Registros mezclados y PATCH a medias ───────────────────────────────────

describe("registros mezclados", () => {
  const iso = (ms) => new Date(ms).toISOString();

  it("apagado a medias: reintenta solo el que sigue encendido", () => {
    const apagadoEn = AHORA - 2 * MINUTO;
    const registros = registrosDeZona(
      {
        "alhabla.ai": { proxied: false, modificado: apagadoEn + 1000 },
        "app.alhabla.ai": { proxied: false, modificado: apagadoEn + 1000 },
        // El PATCH de www falló: sigue proxied y sin tocar desde antes.
        "www.alhabla.ai": { proxied: true, modificado: AHORA - 60 * MINUTO },
      },
    );
    const decision = decidir(
      entrada({
        lista: LISTA_CON_BLOQUEO,
        registros,
        control: controlConMarca(HOSTNAMES, apagadoEn, {}, { pendiente: true }),
      })
    );
    assert.equal(decision.accion, "apagar");
    assert.equal(decision.motivo, "reintento_de_apagado");
    assert.deepEqual(decision.cambios, [
      {
        id: IDS["www.alhabla.ai"],
        nombre: "www.alhabla.ai",
        cuerpo: { proxied: false, ttl: 60 },
      },
    ]);
    // El reintento no espera al antirrebote ni reescribe la marca.
    assert.equal(decision.escribirControlAntes, false);
    assert.deepEqual(decision.control.marca.registros["www.alhabla.ai"], {
      apagadoEn: iso(apagadoEn),
      pendiente: true,
    });
    // Los que sí se apagaron quedan confirmados con su modified_on.
    assert.deepEqual(decision.control.marca.registros["alhabla.ai"], {
      apagadoEn: iso(apagadoEn),
      modificadoEn: iso(apagadoEn + 1000),
    });
  });

  it("el reintento tampoco apaga si Vercel está bloqueado o no se conoce", () => {
    const apagadoEn = AHORA - 2 * MINUTO;
    const comun = {
      registros: registrosDeZona({
        "www.alhabla.ai": { proxied: true, modificado: AHORA - 60 * MINUTO },
      }),
      control: controlConMarca(["www.alhabla.ai"], apagadoEn, {}, { pendiente: true }),
    };
    for (const campos of [
      { lista: lista(`${TEXTO_LISTA_CON_BLOQUEO}64.29.17.65\n`) },
      { lista: LISTA_CON_BLOQUEO, ipsVercel: [] },
    ]) {
      const decision = decidir(entrada({ ...comun, ...campos }));
      assert.deepEqual(decision.cambios, [], JSON.stringify(campos.ipsVercel));
      const www = decision.detalles.find((d) => d.nombre === "www.alhabla.ai");
      assert.equal(www.motivo, "apagado_no_aplicado");
      assert.equal(decision.control.marca, null);
    }
  });

  it("apagado sin aplicar y el bloqueo ya acabó: retira la marca sin tocar nada", () => {
    const decision = decidir(
      entrada({
        lista: LISTA_SIN_NOSOTROS,
        registros: registrosDeZona({}, { proxied: true, modificado: AHORA - 60 * MINUTO }),
        control: controlConMarca(HOSTNAMES, AHORA - 2 * MINUTO, {}, { pendiente: true }),
      })
    );
    assert.equal(decision.accion, "limpiar_marca");
    assert.equal(decision.motivo, "apagado_no_aplicado");
    assert.deepEqual(decision.cambios, []);
    assert.equal(decision.control.marca, null);
  });

  it("encendido a medias: completa solo los que faltan", () => {
    const apagadoEn = AHORA - 60 * MINUTO;
    const control = controlConMarca(["www.alhabla.ai", "app.alhabla.ai"], apagadoEn, {
      limpiasSeguidas: 2,
      limpioDesde: iso(AHORA - 20 * MINUTO),
      limpioHasta: iso(AHORA - 2 * MINUTO),
    });
    const registros = registrosDeZona(
      {
        "alhabla.ai": { proxied: true, modificado: AHORA - 2 * MINUTO },
      },
      { proxied: false, modificado: apagadoEn }
    );
    const decision = decidir(
      entrada({
        lista: LISTA_SIN_NOSOTROS,
        registros,
        control,
        confirmacion: confirmacionDe(ipsDe(LISTA_SIN_NOSOTROS)),
      })
    );
    assert.equal(decision.accion, "encender");
    assert.deepEqual(decision.cambios.map((c) => c.nombre), [
      "www.alhabla.ai",
      "app.alhabla.ai",
    ]);
    // Y si en esa ejecución solo sale bien uno, el otro sigue marcado.
    const control2 = aplicarResultados(decision, [
      { nombre: "www.alhabla.ai", ok: true },
      { nombre: "app.alhabla.ai", ok: false },
    ]);
    assert.deepEqual(Object.keys(control2.marca.registros), ["app.alhabla.ai"]);
    assert.equal(control2.limpiasSeguidas, 3);
    assert.equal(control2.limpioDesde, iso(AHORA - 20 * MINUTO));
    assert.equal(control2.limpioHasta, iso(AHORA));
    assert.deepEqual(control2.ultimoCambio.hostnames, ["www.alhabla.ai"]);
    const todoBien = aplicarResultados(decision, [
      { nombre: "www.alhabla.ai", ok: true },
      { nombre: "app.alhabla.ai", ok: true },
    ]);
    assert.equal(todoBien.marca, null);
    assert.equal(todoBien.limpiasSeguidas, 0);
    assert.equal(todoBien.limpioDesde, null);
    assert.equal(todoBien.limpioHasta, null);
  });

  it("si falla todo el encendido, la marca sigue y se reintenta", () => {
    const control = controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO, {
      limpiasSeguidas: 1,
      limpioDesde: iso(AHORA - 20 * MINUTO),
      limpioHasta: iso(AHORA - 2 * MINUTO),
    });
    const decision = decidir(
      entrada({
        registros: registrosDeZona({}, { proxied: false }),
        control,
        confirmacion: confirmacionDe(ipsDe(LISTA_SIN_NOSOTROS)),
      })
    );
    assert.equal(decision.accion, "encender");
    const tras = aplicarResultados(
      decision,
      decision.cambios.map((c) => ({ nombre: c.nombre, ok: false }))
    );
    assert.deepEqual(Object.keys(tras.marca.registros).sort(), [...HOSTNAMES].sort());
    assert.ok(mismoControl(tras, decision.control));
  });

  it("si un humano apagó uno, apaga los otros y luego solo enciende esos", () => {
    const t = (min) => AHORA + min * MINUTO;
    const { decisiones, zona } = simular({
      registros: registrosDeZona({
        "app.alhabla.ai": { proxied: false, modificado: AHORA - 120 * MINUTO },
      }),
      control: null,
      pasos: [
        { ahora: t(0), lista: LISTA_CON_BLOQUEO },
        ...pasosCada2(20, 30, LISTA_SIN_NOSOTROS),
      ],
    });
    assert.equal(decisiones[0].accion, "apagar");
    assert.deepEqual(decisiones[0].cambios.map((c) => c.nombre), [
      "alhabla.ai",
      "www.alhabla.ai",
    ]);
    assert.deepEqual(Object.keys(decisiones[0].control.marca.registros), [
      "alhabla.ai",
      "www.alhabla.ai",
    ]);
    assert.ok(decisiones.slice(1, -1).every((d) => d.accion === "ninguna"));
    assert.equal(decisiones.at(-1).accion, "encender");
    assert.deepEqual(decisiones.at(-1).cambios.map((c) => c.nombre), [
      "alhabla.ai",
      "www.alhabla.ai",
    ]);
    const app = zona.find((r) => r.id === IDS["app.alhabla.ai"]);
    assert.equal(app.proxied, false);
  });

  it("sin marca y con el proxy mezclado solo apaga lo que está encendido", () => {
    const decision = decidir(
      entrada({
        lista: LISTA_CON_BLOQUEO,
        registros: registrosDeZona({
          "alhabla.ai": { proxied: false, modificado: AHORA - 120 * MINUTO },
        }),
      })
    );
    assert.equal(decision.estadoProxy, "mezclado");
    assert.deepEqual(
      decision.detalles.map((d) => [d.nombre, d.motivo]),
      [
        ["alhabla.ai", "apagado_a_mano"],
        ["www.alhabla.ai", "bloqueo_detectado"],
        ["app.alhabla.ai", "bloqueo_detectado"],
      ]
    );
  });
});

// ─── Cambios a mano y modified_on ───────────────────────────────────────────

describe("cambios a mano (modified_on)", () => {
  const iso = (ms) => new Date(ms).toISOString();
  const t = (min) => AHORA + min * MINUTO;

  it("al apagar, la marca queda pendiente y el PATCH la confirma con su modified_on", () => {
    const decision = decidir(entrada({ lista: LISTA_CON_BLOQUEO }));
    for (const datos of Object.values(decision.control.marca.registros)) {
      assert.deepEqual(datos, { apagadoEn: iso(AHORA), pendiente: true });
    }
    const control = aplicarResultados(decision, [
      { nombre: "alhabla.ai", ok: true, modificadoEn: "2026-10-10T18:00:01.123456Z" },
      { nombre: "www.alhabla.ai", ok: true }, // la API no devolvió modified_on
      { nombre: "app.alhabla.ai", ok: false },
    ]);
    assert.deepEqual(control.marca.registros, {
      "alhabla.ai": { apagadoEn: iso(AHORA), modificadoEn: "2026-10-10T18:00:01.123Z" },
      "app.alhabla.ai": { apagadoEn: iso(AHORA), pendiente: true },
      "www.alhabla.ai": { apagadoEn: iso(AHORA), pendiente: true },
    });
    assert.deepEqual(control.ultimoCambio.hostnames, HOSTNAMES);
    assert.equal(control.ultimoCambio.accion, "apagar");
  });

  it("una marca pendiente que ya está en DNS-only se adopta (PATCH aplicado sin respuesta)", () => {
    const apagadoEn = AHORA - 2 * MINUTO;
    const decision = decidir(
      entrada({
        lista: LISTA_CON_BLOQUEO,
        registros: registrosDeZona({}, { proxied: false, modificado: apagadoEn + 1500 }),
        control: controlConMarca(HOSTNAMES, apagadoEn, {}, { pendiente: true }),
      })
    );
    assert.equal(decision.motivo, "sigue_bloqueado");
    assert.deepEqual(decision.cambios, []);
    for (const datos of Object.values(decision.control.marca.registros)) {
      assert.deepEqual(datos, {
        apagadoEn: iso(apagadoEn),
        modificadoEn: iso(apagadoEn + 1500),
      });
    }
  });

  it("si un humano lo enciende y lo vuelve a apagar, la marca se suelta y no lo enciende nunca", () => {
    // Ciclo 1: el conmutador apaga y confirma con el modified_on del PATCH.
    const primera = simular({
      registros: registrosDeZona(),
      control: null,
      pasos: [{ ahora: t(0), lista: LISTA_CON_BLOQUEO }],
    });
    assert.equal(primera.decisiones[0].accion, "apagar");
    // Entre dos ejecuciones, un humano lo enciende y lo vuelve a apagar.
    const tocada = primera.zona.map((r) =>
      HOSTNAMES.includes(r.name) && r.type === "CNAME"
        ? { ...r, proxied: false, modified_on: iso(t(1)) }
        : r
    );
    const { decisiones, zona } = simular({
      registros: tocada,
      control: primera.control,
      pasos: pasosCada2(2, 60, LISTA_VACIA),
    });
    assert.equal(decisiones[0].accion, "limpiar_marca");
    assert.equal(decisiones[0].motivo, "modificado_a_mano");
    assert.equal(decisiones[0].control.marca, null);
    assert.ok(decisiones.every((d) => d.cambios.length === 0));
    assert.ok(decisiones.slice(1).every((d) => d.motivo === "apagado_a_mano"));
    assert.ok(
      zona.filter((r) => HOSTNAMES.includes(r.name) && r.type === "CNAME").every((r) => !r.proxied)
    );
  });

  it("sin modified_on legible ni suelta la marca ni enciende: espera y acaba en error", () => {
    const apagadoEn = AHORA - 60 * MINUTO;
    const sinFecha = registrosDeZona({}, { proxied: false, modificado: apagadoEn + 1000 });
    for (const r of sinFecha) {
      if (HOSTNAMES.includes(r.name) && r.type === "CNAME") delete r.modified_on;
    }
    const control = controlConMarca(HOSTNAMES, apagadoEn, {}, {
      modificadoEn: iso(apagadoEn + 1000),
    });
    const decision = decidir(entrada({ registros: sinFecha, lista: LISTA_VACIA, control }));
    assert.equal(decision.accion, "ninguna");
    assert.equal(decision.motivo, "sin_fecha_de_modificacion");
    assert.deepEqual(decision.cambios, []);
    assert.deepEqual(Object.keys(decision.control.marca.registros).sort(), [...HOSTNAMES].sort());
    assert.equal(decision.gravedad, "aviso");
    const dura = decidir(
      entrada({
        registros: sinFecha,
        lista: LISTA_VACIA,
        control,
        inoperativoDesde: iso(AHORA - 10 * MINUTO),
      })
    );
    assert.equal(dura.gravedad, "error");
    // Cuando la API vuelve a dar modified_on (el nuestro), sigue como siempre.
    const { decisiones } = simular({
      registros: registrosDeZona({}, { proxied: false, modificado: apagadoEn + 1000 }),
      control: decision.control,
      pasos: pasosCada2(2, 10, LISTA_VACIA),
    });
    assert.equal(decisiones.at(-1).accion, "encender");
  });

  it("una semilla con los registros ya encendidos se suelta sin apagar al momento", () => {
    // Un humano volvió a encender hace 2 minutos y luego se sembró la marca.
    const registros = registrosDeZona({}, { proxied: true, modificado: AHORA - 2 * MINUTO });
    const semilla = controlConMarca(HOSTNAMES, AHORA - 30 * MINUTO);
    const decision = decidir(
      entrada({ lista: LISTA_CON_BLOQUEO, registros, control: semilla })
    );
    assert.equal(decision.accion, "limpiar_marca");
    assert.equal(decision.motivo, "encendido_a_mano");
    assert.deepEqual(decision.cambios, []);
    // Después rigen las reglas normales: el cambio del humano gana 10 minutos.
    const siguiente = decidir(
      entrada({
        ahora: AHORA + 2 * MINUTO,
        lista: LISTA_CON_BLOQUEO,
        registros,
        control: decision.control,
      })
    );
    assert.equal(siguiente.motivo, "antirrebote");
    assert.deepEqual(siguiente.cambios, []);
  });
});

// ─── Salud: cuándo es error no poder decidir ────────────────────────────────

describe("salud: inoperativo", () => {
  const t = (min) => AHORA + min * MINUTO;
  const iso = (ms) => new Date(ms).toISOString();
  const invalida = evaluarRespuestaLista({ error: "Network connection lost." });

  it("lista inválida: aviso al principio, error a los 10 minutos y se limpia con dos buenas seguidas", () => {
    const { decisiones } = simular({
      registros: registrosDeZona(),
      control: null,
      pasos: [
        ...pasosCada2(0, 10, invalida),
        { ahora: t(12), lista: LISTA_SIN_NOSOTROS },
        { ahora: t(14), lista: invalida },
        ...pasosCada2(16, 18, LISTA_SIN_NOSOTROS),
      ],
    });
    assert.deepEqual(
      decisiones.map((d) => [d.gravedad, d.inoperativoDesde, d.operativoDesde]),
      [
        ["aviso", iso(t(0)), null],
        ["aviso", iso(t(0)), null],
        ["aviso", iso(t(0)), null],
        ["aviso", iso(t(0)), null],
        ["aviso", iso(t(0)), null],
        ["error", iso(t(0)), null],
        // Una buena suelta no la borra: el fallo siguiente sigue siendo error.
        ["info", iso(t(0)), iso(t(12))],
        ["error", iso(t(0)), null],
        ["info", iso(t(0)), iso(t(16))],
        ["info", null, null],
      ]
    );
  });

  it("una lista que falla una vez de cada dos acaba en error (y no impide encender)", () => {
    const pasos = [];
    for (let min = 0; min <= 20; min += 2) {
      pasos.push({ ahora: t(min), lista: (min / 2) % 2 ? LISTA_SIN_NOSOTROS : invalida });
    }
    const { decisiones } = simular({
      registros: registrosDeZona({}, { proxied: false, modificado: AHORA - 60 * MINUTO }),
      control: controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO),
      pasos,
    });
    assert.deepEqual(
      decisiones.map((d) => d.gravedad),
      ["aviso", "info", "aviso", "info", "aviso", "info", "error", "info", "error", "info", "error"]
    );
    // Las válidas siguen la racha (una inválida suelta no la rompe).
    assert.ok(decisiones.some((d) => d.accion === "encender"));
  });

  it("el DNS de hayahora que contradice a la lista acaba en error", () => {
    const { decisiones } = simular({
      registros: registrosDeZona({}, { proxied: false, modificado: AHORA - 60 * MINUTO }),
      control: controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO),
      pasos: pasosCada2(0, 30, LISTA_SIN_NOSOTROS, {
        confirmacion: confirmacionDe(["188.114.96.5", ...ipsDe(LISTA_SIN_NOSOTROS)]),
      }),
    });
    const motivos = decisiones.map((d) => d.motivo);
    assert.equal(motivos.indexOf("bloqueo_en_dns"), 5);
    assert.ok(motivos.slice(5).every((m) => m === "bloqueo_en_dns"));
    assert.equal(decisiones[9].gravedad, "aviso");
    assert.equal(decisiones[10].gravedad, "error");
    assert.ok(decisiones.every((d) => d.cambios.length === 0));
  });

  it("sin IPs conocidas con una marca activa es error desde la primera ejecución", () => {
    const comun = {
      registros: registrosDeZona({}, { proxied: false }),
      ipsCloudflare: [],
      lista: LISTA_VACIA,
    };
    const conMarca = decidir(
      entrada({ ...comun, control: controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO) })
    );
    assert.equal(conMarca.motivo, "sin_ips_conocidas");
    assert.equal(conMarca.gravedad, "error");
    const sinMarca = decidir(entrada(comun));
    assert.equal(sinMarca.gravedad, "aviso");
    assert.equal(sinMarca.inoperativoDesde, iso(AHORA));
  });

  it("sin IPs de Vercel en pleno bloqueo, o sin confirmación, también cuenta", () => {
    const sinVercel = decidir(
      entrada({
        lista: LISTA_CON_BLOQUEO,
        ipsVercel: [],
        inoperativoDesde: iso(AHORA - 12 * MINUTO),
      })
    );
    assert.equal(sinVercel.motivo, "sin_ips_de_vercel");
    assert.equal(sinVercel.gravedad, "error");
    assert.equal(sinVercel.inoperativoDesde, iso(AHORA - 12 * MINUTO));
    const sinConfirmacion = decidir(
      entrada({
        registros: registrosDeZona({}, { proxied: false }),
        control: controlConMarca(HOSTNAMES, AHORA - 60 * MINUTO, {
          limpiasSeguidas: 9,
          limpioDesde: iso(AHORA - 20 * MINUTO),
          limpioHasta: iso(AHORA - 2 * MINUTO),
        }),
        confirmacion: { ok: false },
        inoperativoDesde: iso(AHORA - 10 * MINUTO),
      })
    );
    assert.equal(sinConfirmacion.motivo, "confirmacion_dns_fallida");
    assert.equal(sinConfirmacion.gravedad, "error");
    // Un registro que falta también lo apunta (ya es error de por sí).
    const incompleto = decidir(
      entrada({ registros: registrosDeZona().filter((r) => r.id !== IDS["www.alhabla.ai"]) })
    );
    assert.equal(incompleto.gravedad, "error");
    assert.equal(incompleto.inoperativoDesde, iso(AHORA));
    // Un inoperativoDesde del futuro o ilegible empieza a contar ahora.
    for (const raro of ["mañana", iso(AHORA + 60 * MINUTO)]) {
      const d = decidir(entrada({ lista: invalida, inoperativoDesde: raro }));
      assert.equal(d.inoperativoDesde, iso(AHORA));
      assert.equal(d.gravedad, "aviso");
    }
  });

  it("con dos ejecuciones buenas seguidas no hay inoperatividad que arrastrar", () => {
    const tras = (operativoDesde) =>
      decidir(
        entrada({
          lista: LISTA_SIN_NOSOTROS,
          inoperativoDesde: iso(AHORA - 60 * MINUTO),
          operativoDesde,
        })
      );
    assert.equal(tras(iso(AHORA - 2 * MINUTO)).inoperativoDesde, null);
    assert.equal(tras(iso(AHORA - 2 * MINUTO)).operativoDesde, null);
    // Recién recuperado: la ejecución es buena (info), pero la cuenta sigue.
    const recien = tras(null);
    assert.equal(recien.gravedad, "info");
    assert.equal(recien.inoperativoDesde, iso(AHORA - 60 * MINUTO));
    assert.equal(recien.operativoDesde, iso(AHORA));
    assert.equal(decidir(entrada({ lista: LISTA_SIN_NOSOTROS })).inoperativoDesde, null);
  });
});

// ─── Observación ────────────────────────────────────────────────────────────

describe("observación", () => {
  const observacion = (extra = {}) => ({
    ipsCloudflare: { "188.114.96.5": "x" },
    ipsVercel: { "64.29.17.1": "x" },
    informe: { accion: "ninguna", motivo: "sin_bloqueo", lista: { valida: true } },
    guardadaEn: new Date(AHORA - 5 * MINUTO).toISOString(),
    ...extra,
  });
  const latido = 10 * MINUTO;

  it("no reescribe KV si nada relevante cambió y es reciente", () => {
    assert.equal(debeGuardarObservacion(observacion(), observacion(), AHORA, latido), false);
  });

  it("reescribe si cambian las IPs, el informe o toca latido", () => {
    assert.equal(debeGuardarObservacion(null, observacion(), AHORA, latido), true);
    assert.equal(
      debeGuardarObservacion(
        observacion(),
        observacion({ ipsCloudflare: { "188.114.96.5": "x", "104.21.57.158": "x" } }),
        AHORA,
        latido
      ),
      true
    );
    assert.equal(
      debeGuardarObservacion(
        observacion(),
        observacion({ informe: { accion: "apagar", motivo: "bloqueo_detectado" } }),
        AHORA,
        latido
      ),
      true
    );
    assert.equal(
      debeGuardarObservacion(observacion(), observacion(), AHORA + 6 * MINUTO, latido),
      true
    );
  });

  it("con la misma cuenta de inoperativo, el informe no fuerza la escritura (va con el latido)", () => {
    const desde = new Date(AHORA - 30 * MINUTO).toISOString();
    const caida = observacion({
      inoperativoDesde: desde,
      informe: { accion: "ninguna", motivo: "lista_invalida", lista: { valida: false, motivo: "http_502" } },
    });
    const contradice = observacion({
      inoperativoDesde: desde,
      informe: { accion: "ninguna", motivo: "bloqueo_en_dns", lista: { valida: true, motivo: null } },
    });
    assert.equal(debeGuardarObservacion(caida, contradice, AHORA, latido), false);
    assert.equal(debeGuardarObservacion(contradice, caida, AHORA, latido), false);
    assert.equal(debeGuardarObservacion(caida, contradice, AHORA + 6 * MINUTO, latido), true);
    // Sí fuerzan: empezar o acabar la cuenta, una ejecución buena, cambiar
    // las IPs o hacer algo.
    assert.equal(debeGuardarObservacion(observacion(), caida, AHORA, latido), true);
    assert.equal(
      debeGuardarObservacion(caida, observacion({ ...contradice, inoperativoDesde: null }), AHORA, latido),
      true
    );
    assert.equal(
      debeGuardarObservacion(caida, { ...contradice, operativoDesde: new Date(AHORA).toISOString() }, AHORA, latido),
      true
    );
    assert.equal(
      debeGuardarObservacion(caida, { ...contradice, ipsCloudflare: {} }, AHORA, latido),
      true
    );
    assert.equal(
      debeGuardarObservacion(
        caida,
        { ...contradice, informe: { ...contradice.informe, accion: "apagar" } },
        AHORA,
        latido
      ),
      true
    );
  });
});

// ─── Semillas de hoy ────────────────────────────────────────────────────────

describe("semillas para KV", () => {
  const leer = (nombre) =>
    JSON.parse(readFileSync(new URL(`../semillas/${nombre}`, import.meta.url), "utf8"));
  const control = leer("control.json");
  const observacion = leer("observacion.json");

  it("son legibles y marcan los tres registros (sin confirmar: se adoptan)", () => {
    const { control: normalizado, avisos } = normalizarControl(control);
    assert.deepEqual(avisos, []);
    assert.deepEqual(Object.keys(normalizado.marca.registros).sort(), [...HOSTNAMES].sort());
    for (const datos of Object.values(normalizado.marca.registros)) {
      assert.deepEqual(Object.keys(datos), ["apagadoEn"]);
    }
    assert.equal(observacion.inoperativoDesde, null);
    for (const ip of IPS_CLOUDFLARE) assert.ok(ip in observacion.ipsCloudflare, ip);
    // Google rota la cara 188.114.x entre .5, .2 y .1 (y ::5, ::2, ::1): con
    // el proxy apagado no se pueden descubrir, así que van todas en la semilla.
    for (const final of ["5", "2", "1"]) {
      for (const ip of [`188.114.96.${final}`, `188.114.97.${final}`, `2a06:98c1:3120::${final}`, `2a06:98c1:3121::${final}`]) {
        assert.ok(ip in observacion.ipsCloudflare, ip);
      }
    }
    for (const ip of Object.keys(observacion.ipsCloudflare)) {
      assert.equal(esIpDeCloudflare(ip), true, ip);
    }
    for (const ip of Object.keys(observacion.ipsVercel)) {
      assert.equal(esIpDeCloudflare(ip), false, ip);
    }
  });

  it("con el bloqueo en curso no enciende; al acabar, lo enciende el conmutador", () => {
    const registros = registrosDeZona({}, { proxied: false, modificado: AHORA - 4 * 60 * MINUTO });
    const comun = {
      registros,
      ipsCloudflare: Object.keys(observacion.ipsCloudflare),
      ipsVercel: Object.keys(observacion.ipsVercel),
    };
    const durante = decidir(entrada({ ...comun, lista: LISTA_CON_BLOQUEO, control }));
    assert.equal(durante.motivo, "sigue_bloqueado");
    const { decisiones } = simular({
      registros,
      control,
      pasos: pasosCada2(60, 70, LISTA_VACIA),
    });
    assert.equal(decisiones[0].motivo, "esperando_ejecuciones_limpias");
    assert.equal(decisiones.at(-1).accion, "encender");
    assert.equal(decisiones.at(-1).cambios.length, 3);
  });

  it("si al sembrar alguien ya lo había encendido, la semilla se suelta y no apaga al momento", () => {
    // El caso de la revisión: encendido a mano a las 16:50Z, semilla de las
    // 17:00Z puesta a las 17:35Z con el bloqueo en curso.
    const ahora = Date.parse("2026-10-10T17:35:00.000Z");
    const registros = registrosDeZona(
      {},
      { proxied: true, modificado: Date.parse("2026-10-10T16:50:00.000Z") }
    );
    const decision = decidir(
      entrada({
        ahora,
        registros,
        lista: LISTA_CON_BLOQUEO,
        control,
        ipsCloudflare: Object.keys(observacion.ipsCloudflare),
        ipsVercel: Object.keys(observacion.ipsVercel),
      })
    );
    assert.equal(decision.accion, "limpiar_marca");
    assert.equal(decision.motivo, "encendido_a_mano");
    assert.deepEqual(decision.cambios, []);
    assert.equal(decision.control.marca, null);
  });
});
