import { describe, it, expect } from "vitest";
import {
  AltaDeCompetidorBody,
  AnalisisDeCompetidorBody,
  AnalisisDeCompetidorParams,
  CambioDeCompetidorBody,
  DatoDeCompetidor,
  DatosDeOportunidad,
  ListadoDeOportunidadesQuery,
  PropuestaDeCompetidorBody,
  RevisionDeAnalisisBody,
} from "../../../src/modules/growth/esquemas.js";
import {
  COMPETIDOR_CONFIRMADO,
  aplicaReglasDuras,
  analisisCaducado,
  motivoDeAnalisis,
  nombrePorDefectoDeDominio,
  numeroDeDatos,
  porNombre,
} from "../../../src/modules/growth/competidores.js";

/** Los esquemas de la Fase 2a (competencia) y las piezas puras que usan las rutas. */

const DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA);

const dato = (cambios: Record<string, unknown> = {}) => ({
  tipo: "precio",
  etiqueta: "Plan Pro",
  texto: "99 € al mes con 500 minutos",
  valor: { importe: 99, moneda: "EUR", periodo: "mes" },
  urlFuente: "https://rival.com/precios",
  consultadoEn: new Date().toISOString(),
  ...cambios,
});

const ok = (
  esquema: { safeParse: (v: unknown) => { success: boolean } },
  v: unknown
) => esquema.safeParse(v).success;

describe("DatoDeCompetidor", () => {
  it("acepta un precio con su valor, su fuente y su fecha", () => {
    expect(ok(DatoDeCompetidor, dato())).toBe(true);
  });

  it("un precio exige valor; un producto no puede llevarlo", () => {
    expect(ok(DatoDeCompetidor, dato({ valor: undefined }))).toBe(false);
    expect(
      ok(DatoDeCompetidor, dato({ tipo: "producto", etiqueta: "Producto" }))
    ).toBe(false);
    expect(
      ok(
        DatoDeCompetidor,
        dato({
          tipo: "producto",
          valor: undefined,
          texto: "Recepcionista de IA",
        })
      )
    ).toBe(true);
    // Un plan sí puede llevar valor.
    expect(ok(DatoDeCompetidor, dato({ tipo: "plan" }))).toBe(true);
  });

  it("el importe, la moneda y el periodo tienen sus límites", () => {
    const con = (valor: Record<string, unknown>) =>
      ok(DatoDeCompetidor, dato({ valor }));
    expect(con({ importe: -1, moneda: "EUR", periodo: "mes" })).toBe(false);
    expect(con({ importe: 5, moneda: "JPY", periodo: "mes" })).toBe(false);
    expect(con({ importe: 5, moneda: "EUR", periodo: "semana" })).toBe(false);
    expect(
      con({ importe: 0.15, moneda: "EUR", periodo: "uso", unidad: "minuto" })
    ).toBe(true);
    expect(con({ importe: 5, moneda: "EUR", periodo: "mes", otro: 1 })).toBe(
      false
    );
  });

  it("la fuente tiene que ser http(s) sin credenciales", () => {
    for (const urlFuente of [
      "javascript:alert(1)",
      "data:text/html,x",
      "ftp://rival.com",
      "https://u:p@rival.com",
      "no es una url",
    ]) {
      expect(ok(DatoDeCompetidor, dato({ urlFuente })), urlFuente).toBe(false);
    }
  });

  it("la fecha de consulta no puede ser futura ni de hace más de 30 días", () => {
    const en = (ms: number) => new Date(Date.now() + ms).toISOString();
    expect(ok(DatoDeCompetidor, dato({ consultadoEn: en(10 * 60_000) }))).toBe(
      false
    );
    expect(ok(DatoDeCompetidor, dato({ consultadoEn: en(60_000) }))).toBe(true);
    expect(ok(DatoDeCompetidor, dato({ consultadoEn: en(-29 * DIA) }))).toBe(
      true
    );
    expect(ok(DatoDeCompetidor, dato({ consultadoEn: en(-31 * DIA) }))).toBe(
      false
    );
    expect(ok(DatoDeCompetidor, dato({ consultadoEn: "ayer" }))).toBe(false);
  });

  it("no admite correos ni teléfonos, texto con caracteres nulos ni campos de más", () => {
    expect(
      ok(DatoDeCompetidor, dato({ texto: "Escribe a ventas@rival.com" }))
    ).toBe(false);
    expect(
      ok(DatoDeCompetidor, dato({ texto: "Llama al +34 912 345 678" }))
    ).toBe(false);
    expect(ok(DatoDeCompetidor, dato({ texto: "Hola\u0000mundo" }))).toBe(
      false
    );
    expect(ok(DatoDeCompetidor, dato({ campoNuevo: 1 }))).toBe(false);
    expect(ok(DatoDeCompetidor, dato({ tipo: "inventado" }))).toBe(false);
  });

  it("los números de un precio no son teléfonos", () => {
    for (const texto of [
      "Desde 1.299 €/año",
      "Hasta 10000 llamadas al mes",
      "0,15 € por minuto adicional; 29 €/mes",
    ]) {
      expect(ok(DatoDeCompetidor, dato({ texto })), texto).toBe(true);
    }
  });
});

describe("AnalisisDeCompetidorBody", () => {
  const cuerpo = (cambios: Record<string, unknown> = {}) => ({
    resumen: "Recepcionista de IA para pymes.",
    datos: [dato()],
    ...cambios,
  });

  it("acepta un análisis válido, con o sin ejecución", () => {
    expect(ok(AnalisisDeCompetidorBody, cuerpo())).toBe(true);
    expect(ok(AnalisisDeCompetidorBody, cuerpo({ ejecucionId: "e1" }))).toBe(
      true
    );
  });

  it("exige resumen y entre 1 y 60 datos", () => {
    expect(ok(AnalisisDeCompetidorBody, cuerpo({ resumen: "" }))).toBe(false);
    expect(ok(AnalisisDeCompetidorBody, cuerpo({ datos: [] }))).toBe(false);
    expect(
      ok(
        AnalisisDeCompetidorBody,
        cuerpo({ datos: Array.from({ length: 60 }, () => dato()) })
      )
    ).toBe(true);
    expect(
      ok(
        AnalisisDeCompetidorBody,
        cuerpo({ datos: Array.from({ length: 61 }, () => dato()) })
      )
    ).toBe(false);
  });

  it("el resumen no puede llevar correos ni teléfonos", () => {
    expect(
      ok(AnalisisDeCompetidorBody, cuerpo({ resumen: "Contacto: a@b.com" }))
    ).toBe(false);
    expect(
      ok(AnalisisDeCompetidorBody, cuerpo({ resumen: "Tel. 912 345 678" }))
    ).toBe(false);
  });

  it("no pasa de 40 KB en total", () => {
    const grande = Array.from({ length: 60 }, (_, i) =>
      dato({ texto: `${"x".repeat(590)} ${i}`, etiqueta: "e".repeat(120) })
    );
    expect(ok(AnalisisDeCompetidorBody, cuerpo({ datos: grande }))).toBe(false);
  });

  it("no admite campos de más (ni el estado)", () => {
    expect(ok(AnalisisDeCompetidorBody, cuerpo({ estado: "revisado" }))).toBe(
      false
    );
  });
});

describe("altas, propuestas, cambios y revisiones", () => {
  it("propuesta: URL, nombre y motivo; la fuente es opcional; nada más", () => {
    const base = {
      url: "https://rival.com",
      nombre: "Rival",
      motivo: "Sale en una lista",
    };
    expect(ok(PropuestaDeCompetidorBody, base)).toBe(true);
    expect(
      ok(PropuestaDeCompetidorBody, { ...base, fuenteUrl: "https://blog.es/x" })
    ).toBe(true);
    expect(ok(PropuestaDeCompetidorBody, { ...base, motivo: "" })).toBe(false);
    expect(
      ok(PropuestaDeCompetidorBody, { ...base, url: "javascript:x" })
    ).toBe(false);
    expect(
      ok(PropuestaDeCompetidorBody, { ...base, estado: "por_analizar" })
    ).toBe(false);
    expect(
      ok(PropuestaDeCompetidorBody, { ...base, motivo: "x".repeat(501) })
    ).toBe(false);
  });

  it("alta: solo la URL es obligatoria", () => {
    expect(ok(AltaDeCompetidorBody, { url: "https://rival.com" })).toBe(true);
    expect(ok(AltaDeCompetidorBody, {})).toBe(false);
    expect(
      ok(AltaDeCompetidorBody, { url: "https://rival.com", origen: "repo" })
    ).toBe(false);
  });

  it("cambio: al menos un campo; el dominio y el estado no se cambian", () => {
    expect(ok(CambioDeCompetidorBody, {})).toBe(false);
    expect(ok(CambioDeCompetidorBody, { nombre: "X" })).toBe(true);
    expect(ok(CambioDeCompetidorBody, { notas: null })).toBe(true);
    expect(ok(CambioDeCompetidorBody, { url: null })).toBe(true);
    expect(ok(CambioDeCompetidorBody, { dominio: "otro.com" })).toBe(false);
    expect(ok(CambioDeCompetidorBody, { estado: "revisado" })).toBe(false);
  });

  it("revisión: nota opcional de hasta 500 caracteres", () => {
    expect(ok(RevisionDeAnalisisBody, {})).toBe(true);
    expect(ok(RevisionDeAnalisisBody, { nota: "Bien" })).toBe(true);
    expect(ok(RevisionDeAnalisisBody, { nota: "x".repeat(501) })).toBe(false);
    expect(ok(RevisionDeAnalisisBody, { nota: "x", otro: 1 })).toBe(false);
  });

  it("parámetros del análisis: los dos ids", () => {
    expect(ok(AnalisisDeCompetidorParams, { id: "c1", analisisId: "a1" })).toBe(
      true
    );
    expect(ok(AnalisisDeCompetidorParams, { id: "c1" })).toBe(false);
  });
});

describe("competidoresMencionados y ?menciona=", () => {
  it("se normaliza (minúsculas, sin www) y admite hasta 10", () => {
    const r = DatosDeOportunidad.parse({
      competidoresMencionados: ["WWW.HeyDiga.ai", "fonio.ai"],
    });
    expect(r.competidoresMencionados).toEqual(["heydiga.ai", "fonio.ai"]);
    expect(
      ok(DatosDeOportunidad, {
        competidoresMencionados: Array.from(
          { length: 11 },
          (_, i) => `c${i}.com`
        ),
      })
    ).toBe(false);
  });

  it("solo dominios, no URL ni texto", () => {
    for (const malo of ["https://heydiga.ai", "heydiga", "hey diga.ai", ""]) {
      expect(
        ok(DatosDeOportunidad, { competidoresMencionados: [malo] }),
        malo
      ).toBe(false);
    }
  });

  it("el listado admite menciona y lo pasa a minúsculas", () => {
    expect(
      ListadoDeOportunidadesQuery.parse({ menciona: "HeyDiga.ai" }).menciona
    ).toBe("heydiga.ai");
    expect(ListadoDeOportunidadesQuery.parse({}).menciona).toBeUndefined();
  });
});

describe("piezas puras de la competencia", () => {
  it("solo un propuesto queda fuera de las reglas duras", () => {
    expect(COMPETIDOR_CONFIRMADO).toEqual({ estado: { not: "propuesto" } });
    expect(aplicaReglasDuras("propuesto")).toBe(false);
    for (const estado of ["por_analizar", "analizado", "revisado"]) {
      expect(aplicaReglasDuras(estado), estado).toBe(true);
    }
  });

  it("caduca pasados 90 días", () => {
    const ahora = new Date();
    expect(analisisCaducado(hace(89), ahora)).toBe(false);
    expect(analisisCaducado(hace(91), ahora)).toBe(true);
  });

  it("qué competidores necesitan análisis y por qué", () => {
    const ahora = new Date();
    expect(motivoDeAnalisis({ estado: "propuesto" }, null, ahora)).toBeNull();
    expect(motivoDeAnalisis({ estado: "por_analizar" }, null, ahora)).toBe(
      "por_analizar"
    );
    // Aunque tenga un análisis viejo: se pidió volver a hacerlo.
    expect(motivoDeAnalisis({ estado: "por_analizar" }, hace(200), ahora)).toBe(
      "por_analizar"
    );
    expect(
      motivoDeAnalisis({ estado: "analizado" }, hace(5), ahora)
    ).toBeNull();
    expect(motivoDeAnalisis({ estado: "revisado" }, hace(95), ahora)).toBe(
      "caducado"
    );
    // Una fila incoherente (revisado sin análisis) se trata como pendiente.
    expect(motivoDeAnalisis({ estado: "revisado" }, null, ahora)).toBe(
      "por_analizar"
    );
  });

  it("nombre por defecto: la primera etiqueta del dominio con mayúscula", () => {
    expect(nombrePorDefectoDeDominio("heydiga.ai")).toBe("Heydiga");
    expect(nombrePorDefectoDeDominio("app.fonio.ai")).toBe("App");
  });

  it("cuenta los datos de un análisis, sea lo que sea el JSON", () => {
    expect(numeroDeDatos([1, 2, 3])).toBe(3);
    expect(numeroDeDatos(null)).toBe(0);
    expect(numeroDeDatos({ a: 1 })).toBe(0);
  });

  it("ordena por nombre sin distinguir mayúsculas ni tildes, con el id como desempate", () => {
    const filas = [
      { id: "3", nombre: "Zeta" },
      { id: "2", nombre: "HeyDiga" },
      { id: "1", nombre: "fonio" },
      { id: "4", nombre: "Álamo" },
      { id: "0", nombre: "heydiga" },
    ];
    expect(porNombre(filas).map((f) => f.id)).toEqual([
      "4",
      "1",
      "0",
      "2",
      "3",
    ]);
    // No muta la entrada.
    expect(filas[0]!.id).toBe("3");
  });
});
