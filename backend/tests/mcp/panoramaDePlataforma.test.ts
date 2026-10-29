import { describe, expect, it } from "vitest";
import {
  SQL_DE_RESUMEN,
  SQL_DE_SUSCRIPCIONES,
  SQL_POR_DIA,
  diasDeLaVentana,
  embudoDeAlta,
  inicioDelMes,
  panoramaDePlataforma,
  serieDelPanorama,
  totalesDeLaSerie,
} from "../../mcp/panoramaDePlataforma.js";
import type { ResultadoDeConsulta } from "../../mcp/sqlDeSoloLectura.js";

// 23:30 UTC del 31-10 = ya es 1-11 en Madrid (CET, UTC+1).
const NOCHE_DE_HALLOWEEN = Date.parse("2026-10-31T23:30:00Z");
const AHORA = Date.parse("2026-10-29T12:00:00Z");

function resultado(filas: Record<string, unknown>[]): ResultadoDeConsulta {
  return {
    columnas: Object.keys(filas[0] ?? {}),
    filas,
    totalFilas: filas.length,
    truncado: false,
  };
}

describe("ventana en días de Madrid", () => {
  it("los días acaban hoy en Madrid, del más reciente al más antiguo", () => {
    expect(diasDeLaVentana(3, AHORA)).toEqual([
      "2026-10-29",
      "2026-10-28",
      "2026-10-27",
    ]);
    expect(diasDeLaVentana(2, NOCHE_DE_HALLOWEEN)).toEqual([
      "2026-11-01",
      "2026-10-31",
    ]);
  });

  it("el mes en curso también es el de Madrid", () => {
    expect(inicioDelMes(AHORA)).toBe("2026-10-01");
    expect(inicioDelMes(NOCHE_DE_HALLOWEEN)).toBe("2026-11-01");
  });
});

describe("las consultas", () => {
  it("no cuentan como voz los chats de WhatsApp ni las llamadas simuladas", () => {
    for (const sql of [SQL_DE_RESUMEN, SQL_POR_DIA]) {
      expect(sql).toContain(`c."voiceProvider" <> 'whatsapp'`);
      expect(sql).toContain(`c."callId" NOT LIKE 'sim-mcp-%'`);
    }
    // Las citas cuelgan de calls (bookings no tiene businessId).
    expect(SQL_POR_DIA).toContain(`JOIN calls c ON c.id = bk."callId"`);
    // La ventana empieza a medianoche de Madrid, no de UTC.
    expect(SQL_POR_DIA).toContain(
      "($1::date::timestamp AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'UTC'"
    );
    expect(SQL_DE_SUSCRIPCIONES).toContain("'ninguno'");
  });
});

describe("serieDelPanorama", () => {
  it("rellena los días sin nada y junta las filas de cada día", () => {
    const serie = serieDelPanorama(
      ["2026-10-29", "2026-10-28"],
      [
        { dia: "2026-10-28", tipo: "altas", clave: "", n: "1" },
        { dia: "2026-10-28", tipo: "llamadas", clave: "", n: "2" },
        { dia: "2026-10-28", tipo: "segundosDeVoz", clave: "", n: "158" },
        { dia: "2026-10-28", tipo: "citas", clave: "voice", n: "2" },
        { dia: "2026-10-28", tipo: "citas", clave: "owner_panel", n: 1 },
        {
          dia: "2026-10-28",
          tipo: "mensajesWhatsapp",
          clave: "client",
          n: "3",
        },
        { dia: "2026-10-28", tipo: "chatsNuevos", clave: "", n: "1" },
        // Fuera de la ventana: no cuenta.
        { dia: "2026-10-01", tipo: "altas", clave: "", n: "9" },
      ]
    );
    expect(serie).toEqual([
      {
        dia: "2026-10-29",
        altas: 0,
        llamadas: 0,
        minutosDeVoz: 0,
        chatsNuevos: 0,
        mensajesWhatsapp: {},
        citas: {},
      },
      {
        dia: "2026-10-28",
        altas: 1,
        llamadas: 2,
        minutosDeVoz: 2.6,
        chatsNuevos: 1,
        mensajesWhatsapp: { client: 3 },
        citas: { voice: 2, owner_panel: 1 },
      },
    ]);
    expect(totalesDeLaSerie(serie)).toEqual({
      altas: 1,
      llamadas: 2,
      minutosDeVoz: 2.6,
      chatsNuevos: 1,
      mensajesWhatsapp: { client: 3 },
      citas: { voice: 2, owner_panel: 1 },
    });
  });
});

const RESUMEN = {
  cuentas: "3",
  suscrita: "0",
  con_numero: "0",
  con_agenda: "0",
  con_llamada: "0",
  solo_con_numero: "1",
  solo_con_agenda: "1",
  solo_con_llamada: "1",
  llamadas_del_mes: "14",
  segundos_del_mes: "1234",
};

describe("embudoDeAlta", () => {
  it("cada etapa con las anteriores y sin mirarlas", () => {
    expect(embudoDeAlta(RESUMEN)).toEqual([
      { etapa: "cuenta creada", negocios: 3 },
      {
        etapa: "suscripción activa o en prueba",
        negocios: 0,
        sinMirarLasAnteriores: 0,
      },
      { etapa: "número de teléfono", negocios: 0, sinMirarLasAnteriores: 1 },
      {
        etapa: "calendario conectado o agenda de Alhabla",
        negocios: 0,
        sinMirarLasAnteriores: 1,
      },
      {
        etapa: "al menos una llamada de voz",
        negocios: 0,
        sinMirarLasAnteriores: 1,
      },
    ]);
  });
});

describe("panoramaDePlataforma", () => {
  it("lanza las tres consultas una tras otra con el mes y la ventana de Madrid", async () => {
    const consultas: { sql: string; parametros: unknown[] }[] = [];
    const respuestas = [
      resultado([RESUMEN]),
      resultado([
        {
          plan: "pro",
          estado: "PAST_DUE",
          negocios: "1",
          cancelanAlAcabarElPeriodo: "0",
        },
      ]),
      resultado([{ dia: "2026-10-28", tipo: "llamadas", clave: "", n: "2" }]),
    ];
    const panorama = await panoramaDePlataforma(
      "postgres://falsa",
      { dias: 2 },
      {
        ahora: AHORA,
        ejecutar: async (sql, parametros) => {
          consultas.push({ sql, parametros });
          return respuestas.shift()!;
        },
      }
    );
    expect(consultas.map((consulta) => consulta.parametros)).toEqual([
      ["2026-10-01"],
      [],
      ["2026-10-28"],
    ]);
    expect(panorama).toMatchObject({
      negocios: 3,
      suscripciones: [
        {
          plan: "pro",
          estado: "PAST_DUE",
          negocios: 1,
          cancelanAlAcabarElPeriodo: 0,
        },
      ],
      mesEnCurso: {
        desde: "2026-10-01",
        llamadasDeVoz: 14,
        minutosDeVoz: 20.6,
      },
      ventana: {
        desde: "2026-10-28",
        hasta: "2026-10-29",
        dias: 2,
        totales: { llamadas: 2 },
      },
    });
    expect(panorama.porDia.map((dia) => dia.dia)).toEqual([
      "2026-10-29",
      "2026-10-28",
    ]);
  });
});
