import { describe, expect, it } from "vitest";
import {
  columnasDeDatos,
  conMiles,
  ordenarPorPrecioDeEntrada,
  planesDeAlhabla,
  precioDeEntrada,
  situacionDelAnalisis,
} from "@/components/competencia/utilidades-del-comparador";
import { afirmacion } from "../helpers/d2-datos";
import { datoDeComparador, filaDelComparador } from "../helpers/tareas-datos";

const normal = (texto: string) => texto.replace(/[  ]/g, " ");

const plan = (
  importe: number,
  periodo: "mes" | "anio" | "uso" | "unico" = "mes",
  moneda: "EUR" | "USD" | "GBP" = "EUR",
  tipo: "plan" | "precio" = "plan"
) =>
  datoDeComparador({
    tipo,
    valor: { importe, moneda, periodo, ivaIncluido: false },
  });

describe("precioDeEntrada", () => {
  it("es el plan más barato al mes, con el texto «Desde …»", () => {
    const entrada = precioDeEntrada([plan(139), plan(59), plan(269)]);
    expect(entrada).toMatchObject({
      importeMensual: 59,
      moneda: "EUR",
      equivalente: false,
    });
    expect(normal(entrada!.texto)).toBe("Desde 59 € al mes");
  });

  it("un precio anual cuenta dividido entre 12 y dice que es un equivalente", () => {
    const entrada = precioDeEntrada([plan(790, "anio")]);
    expect(entrada).toMatchObject({ importeMensual: 65.83, equivalente: true });
    expect(normal(entrada!.texto)).toBe(
      "Desde 790 € al año (≈ 65,83 € al mes)"
    );
  });

  it("no cuentan los precios por uso ni los pagos únicos, ni los datos sin precio", () => {
    expect(
      precioDeEntrada([
        plan(0.12, "uso", "EUR", "precio"),
        plan(500, "unico"),
        datoDeComparador({ tipo: "plan", valor: undefined }),
        datoDeComparador({ tipo: "integracion", valor: undefined }),
      ])
    ).toBeNull();
    expect(precioDeEntrada([])).toBeNull();
  });

  it("un plan gratuito es el precio de entrada (0 no es «sin precio»)", () => {
    expect(precioDeEntrada([plan(0), plan(49)])).toMatchObject({
      importeMensual: 0,
    });
  });

  it("no mezcla monedas: gana la primera de EUR, USD y GBP, y no convierte", () => {
    const entrada = precioDeEntrada([
      plan(10, "mes", "USD"),
      plan(99, "mes", "EUR"),
      plan(5, "mes", "GBP"),
    ]);
    expect(entrada).toMatchObject({ moneda: "EUR", importeMensual: 99 });
    expect(
      precioDeEntrada([plan(10, "mes", "USD"), plan(5, "mes", "GBP")])
    ).toMatchObject({ moneda: "USD", importeMensual: 10 });
  });
});

describe("ordenarPorPrecioDeEntrada", () => {
  const fila = (
    id: string,
    nombre: string,
    ...datos: ReturnType<typeof plan>[]
  ) => filaDelComparador({ competidorId: id, nombre, datos });

  it("de menor a mayor; los sin precio al final, por orden de entrada", () => {
    const orden = ordenarPorPrecioDeEntrada([
      fila("a", "Sin precio A"),
      fila("b", "Caro", plan(200)),
      fila("c", "Sin precio B"),
      fila("d", "Barato", plan(30)),
      fila("e", "Medio", plan(100)),
    ]).map((f) => f.nombre);
    expect(orden).toEqual([
      "Barato",
      "Medio",
      "Caro",
      "Sin precio A",
      "Sin precio B",
    ]);
  });

  it("las monedas van agrupadas (EUR, USD, GBP) y no se comparan entre sí", () => {
    const orden = ordenarPorPrecioDeEntrada([
      fila("a", "Libra", plan(1, "mes", "GBP")),
      fila("b", "Dólar", plan(1, "mes", "USD")),
      fila("c", "Euro caro", plan(900)),
      fila("d", "Euro barato", plan(9)),
    ]).map((f) => f.nombre);
    expect(orden).toEqual(["Euro barato", "Euro caro", "Dólar", "Libra"]);
  });

  it("es estable y no modifica la lista de entrada", () => {
    const entrada = [
      fila("a", "Uno", plan(50)),
      fila("b", "Dos", plan(50)),
      fila("c", "Tres", plan(50)),
    ];
    const copia = [...entrada];
    expect(ordenarPorPrecioDeEntrada(entrada).map((f) => f.nombre)).toEqual([
      "Uno",
      "Dos",
      "Tres",
    ]);
    expect(entrada).toEqual(copia);
  });
});

describe("columnasDeDatos", () => {
  it("reparte los datos en precios, límites y etiquetas, y deja fuera el resto", () => {
    const columnas = columnasDeDatos([
      datoDeComparador({ tipo: "plan", etiqueta: "Plan" }),
      datoDeComparador({ tipo: "precio", etiqueta: "Extra" }),
      datoDeComparador({ tipo: "limite", etiqueta: "Límite" }),
      datoDeComparador({ tipo: "integracion", etiqueta: "Integración" }),
      datoDeComparador({ tipo: "idioma", etiqueta: "Idioma" }),
      datoDeComparador({ tipo: "canal", etiqueta: "Canal" }),
      datoDeComparador({ tipo: "producto", etiqueta: "Producto" }),
    ]);
    expect(columnas.precios.map((d) => d.etiqueta)).toEqual(["Plan", "Extra"]);
    expect(columnas.limites.map((d) => d.etiqueta)).toEqual(["Límite"]);
    expect(columnas.etiquetas.map((d) => d.etiqueta)).toEqual([
      "Integración",
      "Idioma",
      "Canal",
    ]);
  });
});

describe("situacionDelAnalisis", () => {
  const analisis = (revisadoEn: string | null, caducado = false) =>
    filaDelComparador({
      analisis: {
        id: "an",
        version: 1,
        creadoEn: "2026-10-01T00:00:00.000Z",
        revisadoEn,
        caducado,
      },
    });

  it("sin análisis: «Sin analizar»", () => {
    expect(situacionDelAnalisis(filaDelComparador({ analisis: null }))).toEqual(
      { etiqueta: "Sin analizar", tono: "neutro", caducado: false }
    );
  });

  it("sin revisar: «Pendiente de revisión»; revisado: «Revisado»; y el caducado va aparte", () => {
    expect(situacionDelAnalisis(analisis(null))).toMatchObject({
      etiqueta: "Pendiente de revisión",
      caducado: false,
    });
    expect(
      situacionDelAnalisis(analisis("2026-10-02T00:00:00.000Z", true))
    ).toMatchObject({ etiqueta: "Revisado", tono: "exito", caducado: true });
  });
});

describe("planesDeAlhabla", () => {
  const precio = (clave: string, valor: unknown, texto = "Texto.") =>
    afirmacion({ id: clave, clave, tipo: "precio", texto, valor });

  it("solo toma las precio.plan.*, con cuota, minutos y minuto extra, del más barato al más caro", () => {
    const planes = planesDeAlhabla([
      precio("precio.plan.scale", {
        plan: "scale",
        cuotaEur: 269,
        minutosIncluidos: 1500,
        minutoExtraEur: 0.2,
      }),
      precio("precio.iva", { ivaPorcentaje: 21 }),
      precio("precio.plan.inicio", {
        plan: "inicio",
        cuotaEur: 59,
        minutosIncluidos: 200,
        minutoExtraEur: 0.3,
      }),
      precio("precio.desde", { cuotaEur: 59 }),
    ]);
    expect(planes.map((p) => [p.nombre, p.cuota, p.minutosIncluidos])).toEqual([
      ["Inicio", 59, 200],
      ["Scale", 269, 1500],
    ]);
    expect(planes[0].minutoExtra).toBe(0.3);
  });

  it("si el valor no trae números, quedan en null (y el nombre sale de la clave)", () => {
    const [plan] = planesDeAlhabla([
      precio("precio.plan.pro", { precio: 139 }, "El plan Pro cuesta 139 €."),
    ]);
    expect(plan).toMatchObject({
      nombre: "Pro",
      cuota: null,
      minutosIncluidos: null,
      minutoExtra: null,
      texto: "El plan Pro cuesta 139 €.",
    });
    expect(
      planesDeAlhabla([precio("precio.plan.pro", null)])[0].cuota
    ).toBeNull();
  });

  it("sin planes, una lista vacía", () => {
    expect(planesDeAlhabla([])).toEqual([]);
  });
});

describe("conMiles", () => {
  it("pone el punto de millar también en cuatro cifras", () => {
    expect(conMiles(200)).toBe("200");
    expect(conMiles(1500)).toBe("1.500");
    expect(conMiles(1234567)).toBe("1.234.567");
  });
});
