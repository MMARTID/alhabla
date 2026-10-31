import { beforeEach, describe, expect, it } from "vitest";
import type { ClienteGrowth } from "@/lib/cliente";
import { clienteDemo } from "@/lib/demo/cliente-demo";
import {
  ARRANQUE_DE_LA_DESCRIPCION_LARGA,
  CATEGORIAS_DE_LA_FICHA,
  CLAVES_DE_LA_DESCRIPCION_LARGA,
  CLAVES_DE_PRECIOS,
  componerFichaDeAlhabla,
  LIMITE_DE_DESCRIPCION_CORTA,
  LIMITE_DE_DESCRIPCION_LARGA,
} from "@/lib/demo/ficha-demo";
import { crearAlmacenDeDemostracion } from "@/lib/demo/datos";
import { TIPOS_DE_DATO_DEL_COMPARADOR } from "@/lib/types";

/**
 * Todo lo que escribe fechas se calcula con el reloj que se le da: aquí se
 * fija el 30-10-2026, nunca el real.
 */
const AHORA = new Date("2026-10-30T09:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;

let cliente: ClienteGrowth;
beforeEach(() => {
  cliente = clienteDemo({ retardoMs: 0, ahora: () => AHORA });
});

const sincronizada = {
  commitSha: "1234abc",
  sincronizadoEn: "2026-10-28T09:00:00.000Z",
  antiguedadHoras: 48,
  obsoleto: false,
};

function afirmaciones(claves: readonly string[]) {
  return claves.map((clave) => ({
    clave,
    texto: `Texto de ${clave}.`,
    valor: null as unknown,
  }));
}

const TODAS = [
  "pagina.inicio",
  ...CLAVES_DE_LA_DESCRIPCION_LARGA,
  ...CLAVES_DE_PRECIOS,
  "precio.prueba",
];

const PROHIBIDA = {
  clave: "prohibida.promesas",
  texto: "No se prometen resultados absolutos.",
  valor: { terminos: ["sin límites", "100 % garantizado"] } as unknown,
};

describe("ficha del demo · la composición", () => {
  it("con todas las afirmaciones: ocho campos, sin faltas, en el orden del contrato", () => {
    const ficha = componerFichaDeAlhabla(
      [...afirmaciones(TODAS), PROHIBIDA],
      sincronizada
    );
    expect(ficha.campos.map((c) => c.clave)).toEqual([
      "nombre",
      "web",
      "descripcion_corta",
      "descripcion_larga",
      "precios",
      "prueba",
      "idiomas",
      "categorias",
    ]);
    expect(ficha.campos.every((c) => c.texto !== null)).toBe(true);
    expect(ficha.campos.flatMap((c) => c.faltan)).toEqual([]);
    expect(ficha.avisos).toEqual([]);
    expect(ficha.commit).toBe("1234abc");
    expect(ficha.sincronizadaEn).toBe("2026-10-28T09:00:00.000Z");
  });

  it("nombre, web y categorías son fijos y no citan ninguna afirmación", () => {
    const ficha = componerFichaDeAlhabla([PROHIBIDA], sincronizada);
    const por = Object.fromEntries(ficha.campos.map((c) => [c.clave, c]));
    expect(por.nombre).toMatchObject({ texto: "Alhabla", afirmaciones: [] });
    expect(por.web).toMatchObject({
      texto: "https://alhabla.ai/",
      afirmaciones: [],
    });
    expect(por.categorias).toMatchObject({
      texto: CATEGORIAS_DE_LA_FICHA,
      afirmaciones: [],
      faltan: [],
    });
  });

  it("los límites orientativos solo los llevan las dos descripciones", () => {
    const ficha = componerFichaDeAlhabla(
      [...afirmaciones(TODAS), PROHIBIDA],
      sincronizada
    );
    const limites = Object.fromEntries(
      ficha.campos.map((c) => [c.clave, c.limite])
    );
    expect(limites).toEqual({
      nombre: undefined,
      web: undefined,
      descripcion_corta: LIMITE_DE_DESCRIPCION_CORTA,
      descripcion_larga: LIMITE_DE_DESCRIPCION_LARGA,
      precios: undefined,
      prueba: undefined,
      idiomas: undefined,
      categorias: undefined,
    });
    expect([LIMITE_DE_DESCRIPCION_CORTA, LIMITE_DE_DESCRIPCION_LARGA]).toEqual([
      160, 1000,
    ]);
  });

  it("la descripción corta es el texto de pagina.inicio sin el prefijo «Alhabla: »", () => {
    const ficha = componerFichaDeAlhabla(
      [
        {
          clave: "pagina.inicio",
          texto: "Alhabla: Recepcionista de IA para tu negocio.",
          valor: null,
        },
        PROHIBIDA,
      ],
      sincronizada
    );
    expect(
      ficha.campos.find((c) => c.clave === "descripcion_corta")
    ).toMatchObject({
      texto: "Recepcionista de IA para tu negocio.",
      afirmaciones: ["pagina.inicio"],
      faltan: [],
    });
  });

  it("la descripción larga: el arranque fijo y las funciones que existan, en orden y con un solo punto final", () => {
    const ficha = componerFichaDeAlhabla(
      [
        {
          clave: "funcion.calendarios",
          texto: "Se conecta a Google.",
          valor: null,
        },
        { clave: "funcion.idiomas", texto: "Habla español", valor: null },
        {
          clave: "funcion.atiende_a_cualquier_hora",
          texto: "Atiende de noche..",
          valor: null,
        },
        PROHIBIDA,
      ],
      sincronizada
    );
    const larga = ficha.campos.find((c) => c.clave === "descripcion_larga")!;
    expect(larga.texto).toBe(
      `${ARRANQUE_DE_LA_DESCRIPCION_LARGA} Atiende de noche. Se conecta a Google. Habla español.`
    );
    expect(larga.afirmaciones).toEqual([
      "funcion.atiende_a_cualquier_hora",
      "funcion.calendarios",
      "funcion.idiomas",
    ]);
    expect(larga.faltan).toEqual(
      CLAVES_DE_LA_DESCRIPCION_LARGA.filter(
        (c) => !larga.afirmaciones.includes(c)
      )
    );
  });

  it("sin ninguna función, la descripción larga es null", () => {
    const ficha = componerFichaDeAlhabla([PROHIBIDA], sincronizada);
    const larga = ficha.campos.find((c) => c.clave === "descripcion_larga")!;
    expect(larga.texto).toBeNull();
    expect(larga.faltan).toEqual([...CLAVES_DE_LA_DESCRIPCION_LARGA]);
  });

  it("los precios van una afirmación por línea; si falta una, el campo es null y dice cuál", () => {
    const completa = componerFichaDeAlhabla(
      [...afirmaciones(CLAVES_DE_PRECIOS), PROHIBIDA],
      sincronizada
    );
    const precios = completa.campos.find((c) => c.clave === "precios")!;
    expect(precios.texto).toBe(
      CLAVES_DE_PRECIOS.map((c) => `Texto de ${c}.`).join("\n")
    );
    expect(precios.afirmaciones).toEqual([...CLAVES_DE_PRECIOS]);

    const sinIva = componerFichaDeAlhabla(
      [
        ...afirmaciones(CLAVES_DE_PRECIOS.filter((c) => c !== "precio.iva")),
        PROHIBIDA,
      ],
      sincronizada
    );
    const incompleto = sinIva.campos.find((c) => c.clave === "precios")!;
    expect(incompleto.texto).toBeNull();
    expect(incompleto.faltan).toEqual(["precio.iva"]);
    expect(incompleto.afirmaciones).not.toContain("precio.iva");
  });

  it("prueba e idiomas son el texto de su afirmación, o null con la clave que falta", () => {
    const con = componerFichaDeAlhabla(
      [...afirmaciones(["precio.prueba", "funcion.idiomas"]), PROHIBIDA],
      sincronizada
    );
    expect(con.campos.find((c) => c.clave === "prueba")?.texto).toBe(
      "Texto de precio.prueba."
    );
    expect(con.campos.find((c) => c.clave === "idiomas")?.texto).toBe(
      "Texto de funcion.idiomas."
    );
    const sin = componerFichaDeAlhabla([PROHIBIDA], sincronizada);
    expect(sin.campos.find((c) => c.clave === "prueba")).toMatchObject({
      texto: null,
      faltan: ["precio.prueba"],
    });
    expect(sin.campos.find((c) => c.clave === "idiomas")).toMatchObject({
      texto: null,
      faltan: ["funcion.idiomas"],
    });
  });

  it("una afirmación con el texto en blanco cuenta como si faltara", () => {
    const ficha = componerFichaDeAlhabla(
      [{ clave: "precio.prueba", texto: "   ", valor: null }, PROHIBIDA],
      sincronizada
    );
    expect(ficha.campos.find((c) => c.clave === "prueba")?.texto).toBeNull();
  });
});

describe("ficha del demo · los avisos", () => {
  it("un término prohibido (palabra entera, sin mayúsculas ni tildes) avisa con el campo, y el campo se devuelve igualmente", () => {
    const ficha = componerFichaDeAlhabla(
      [
        {
          clave: "pagina.inicio",
          texto: "Alhabla: Atiende SIN LIMITES y es 100 % garantizado.",
          valor: null,
        },
        PROHIBIDA,
      ],
      sincronizada
    );
    expect(ficha.avisos).toEqual([
      "El campo «Descripción corta» contiene términos que no se pueden decir: sin límites, 100 % garantizado.",
    ]);
    expect(
      ficha.campos.find((c) => c.clave === "descripcion_corta")?.texto
    ).toContain("SIN LIMITES");
  });

  it("sin términos prohibidos vigentes avisa de que no se ha podido comprobar", () => {
    const ficha = componerFichaDeAlhabla(afirmaciones(TODAS), sincronizada);
    expect(ficha.avisos).toEqual([
      "No hay términos prohibidos vigentes en la base de conocimiento: no se ha podido comprobar el texto.",
    ]);
  });

  it("sin sincronizar nunca avisa, y sin commit ni fecha", () => {
    const ficha = componerFichaDeAlhabla([PROHIBIDA], null);
    expect(ficha.avisos).toEqual([
      "La base de conocimiento aún no se ha sincronizado: la ficha puede estar incompleta.",
    ]);
    expect(ficha.commit).toBeNull();
    expect(ficha.sincronizadaEn).toBeNull();
  });

  it("una base obsoleta (más de 8 días) avisa de los días", () => {
    const ficha = componerFichaDeAlhabla([PROHIBIDA], {
      ...sincronizada,
      antiguedadHoras: 24 * 9 + 5,
      obsoleto: true,
    });
    expect(ficha.avisos).toEqual([
      "La base de conocimiento no se sincroniza desde hace 9 días: comprueba los precios y las funciones antes de pegarlos.",
    ]);
  });
});

describe("ficha del demo · desde el cliente", () => {
  it("la ficha del demo sale completa, sin faltas ni avisos, y respeta los límites", async () => {
    const ficha = await cliente.fichaDeAlhabla();
    expect(ficha.avisos).toEqual([]);
    expect(ficha.commit).toBe("1234abc");
    for (const campo of ficha.campos) {
      expect(campo.texto, campo.clave).not.toBeNull();
      expect(campo.faltan, campo.clave).toEqual([]);
      if (campo.limite !== undefined) {
        expect([...campo.texto!].length, campo.clave).toBeLessThanOrEqual(
          campo.limite
        );
      }
    }
  });

  it("solo usa afirmaciones vigentes: una cerrada deja el campo sin texto", async () => {
    const almacen = crearAlmacenDeDemostracion({ ahora: AHORA });
    const iva = almacen.afirmaciones.find((a) => a.clave === "precio.iva")!;
    iva.vigenteHasta = new Date(AHORA.getTime() - DIA).toISOString();
    const otro = clienteDemo({ retardoMs: 0, ahora: () => AHORA, almacen });
    const precios = (await otro.fichaDeAlhabla()).campos.find(
      (c) => c.clave === "precios"
    )!;
    expect(precios.texto).toBeNull();
    expect(precios.faltan).toEqual(["precio.iva"]);
  });

  it("una base sin sincronizar hace 10 días avisa, con el reloj fijo", async () => {
    const almacen = crearAlmacenDeDemostracion({ ahora: AHORA });
    almacen.snapshot.sincronizadoEn = new Date(
      AHORA.getTime() - 10 * DIA
    ).toISOString();
    const otro = clienteDemo({ retardoMs: 0, ahora: () => AHORA, almacen });
    expect((await otro.fichaDeAlhabla()).avisos).toEqual([
      "La base de conocimiento no se sincroniza desde hace 10 días: comprueba los precios y las funciones antes de pegarlos.",
    ]);
  });

  it("la respuesta es una copia", async () => {
    const ficha = await cliente.fichaDeAlhabla();
    ficha.campos[0].texto = "Manipulado";
    expect((await cliente.fichaDeAlhabla()).campos[0].texto).toBe("Alhabla");
  });
});

describe("comparador del demo", () => {
  it("excluye los propuestos, va por nombre y trae el último análisis", async () => {
    const { data, generadoEn } = await cliente.comparadorDeCompetencia();
    expect(generadoEn).toBe("2026-10-30T09:00:00.000Z");
    expect(data.map((f) => f.nombre)).toEqual([
      "Competidor ficticio",
      "Otra recepcionista (ejemplo)",
      "Recepción Express (ejemplo)",
    ]);
    const express = data.find((f) => f.competidorId === "demo-co-3")!;
    expect(express.analisis).toMatchObject({
      id: "demo-an-3-2",
      version: 2,
      revisadoEn: null,
      caducado: false,
    });
    expect(express.estado).toBe("analizado");
  });

  it("solo trae los tipos que se comparan, del ÚLTIMO análisis", async () => {
    const { data } = await cliente.comparadorDeCompetencia();
    const express = data.find((f) => f.competidorId === "demo-co-3")!;
    const tipos: readonly string[] = TIPOS_DE_DATO_DEL_COMPARADOR;
    for (const dato of express.datos) expect(tipos).toContain(dato.tipo);
    // Producto, servicio y diferencia están en el análisis y no salen.
    const detalle = await cliente.detalleDeCompetidor("demo-co-3");
    expect(detalle.ultimoAnalisis!.datos.length).toBeGreaterThan(
      express.datos.length
    );
    expect(express.datos.map((d) => d.etiqueta)).toEqual([
      "Plan Pro",
      "Plan Pro anual",
      "Minutos extra",
      "WhatsApp",
      "Castellano y catalán",
      "Sin calendarios externos",
    ]);
  });

  it("sin análisis, analisis null y datos vacíos", async () => {
    const { data } = await cliente.comparadorDeCompetencia();
    expect(data.find((f) => f.competidorId === "demo-co-2")).toMatchObject({
      estado: "por_analizar",
      analisis: null,
      datos: [],
    });
  });

  it("caducado se calcula con el reloj dado: más de 90 días", async () => {
    const edad = async (dias: number) => {
      const almacen = crearAlmacenDeDemostracion({ ahora: AHORA });
      const co3 = almacen.competidores.find((c) => c.id === "demo-co-3")!;
      co3.analisis[co3.analisis.length - 1].creadoEn = new Date(
        AHORA.getTime() - dias * DIA
      ).toISOString();
      const otro = clienteDemo({ retardoMs: 0, ahora: () => AHORA, almacen });
      const comparador = await otro.comparadorDeCompetencia();
      const lista = await otro.competidores();
      // Lo mismo que dice la lista de competidores.
      expect(
        comparador.data.find((f) => f.competidorId === "demo-co-3")?.analisis
          ?.caducado
      ).toBe(lista.data.find((c) => c.id === "demo-co-3")?.analisis?.caducado);
      return comparador.data.find((f) => f.competidorId === "demo-co-3")!
        .analisis!.caducado;
    };
    expect(await edad(89)).toBe(false);
    expect(await edad(91)).toBe(true);
    // El del repositorio tiene 95 días el 30-10-2026.
    expect(
      (await cliente.comparadorDeCompetencia()).data.find(
        (f) => f.competidorId === "demo-co-1"
      )?.analisis?.caducado
    ).toBe(true);
  });

  it("al aceptar un propuesto, entra en el comparador como «por analizar»", async () => {
    await cliente.aceptarCompetidor("demo-co-4");
    const { data } = await cliente.comparadorDeCompetencia();
    expect(data.find((f) => f.competidorId === "demo-co-4")).toMatchObject({
      estado: "por_analizar",
      analisis: null,
      datos: [],
    });
  });

  it("la respuesta es una copia", async () => {
    const { data } = await cliente.comparadorDeCompetencia();
    data[0].nombre = "Manipulado";
    expect((await cliente.comparadorDeCompetencia()).data[0].nombre).toBe(
      "Competidor ficticio"
    );
  });
});
