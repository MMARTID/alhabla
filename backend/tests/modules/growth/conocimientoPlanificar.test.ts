import { describe, it, expect } from "vitest";
import type { AfirmacionSincronizada } from "../../../src/modules/growth/esquemas.js";
import {
  camposQueCambian,
  canonico,
  clavesAfectadas,
  describirDebilitamientos,
  examinarCierres,
  planSinCambios,
  planificar,
  prohibidasDebilitadas,
  type AfirmacionVigente,
} from "../../../src/modules/growth/conocimiento/planificar.js";

const DESDE = new Date("2026-10-01T10:00:00Z");

function vigente(cambios: Partial<AfirmacionVigente> = {}): AfirmacionVigente {
  return {
    id: "a1",
    clave: "precio.plan.pro",
    tipo: "precio",
    texto: "Plan Pro: 139 € + IVA al mes.",
    valor: { cuotaEur: 139, minutos: 600 },
    fuente: "web/src/lib/plans.ts#plans-pro",
    commitSha: "a".repeat(40),
    nichoSlug: null,
    vigenteDesde: DESDE,
    ...cambios,
  };
}

function nueva(
  cambios: Partial<AfirmacionSincronizada> = {}
): AfirmacionSincronizada {
  return {
    clave: "precio.plan.pro",
    tipo: "precio",
    texto: "Plan Pro: 139 € + IVA al mes.",
    valor: { minutos: 600, cuotaEur: 139 },
    fuente: "web/src/lib/plans.ts#plans-pro",
    ...cambios,
  } as AfirmacionSincronizada;
}

describe("canonico", () => {
  it("no depende del orden de las claves ni de cómo jsonb normaliza los números", () => {
    expect(canonico({ b: 1, a: { d: 0.3, c: [1, 2] } })).toBe(
      canonico({ a: { c: [1, 2], d: 0.3 }, b: 1 })
    );
    expect(canonico({ x: 0.3 })).toBe(canonico(JSON.parse('{"x":0.30}')));
  });

  it("trata null, undefined y ausencia como lo mismo, pero no un objeto vacío", () => {
    expect(canonico(undefined)).toBe(canonico(null));
    expect(canonico({ a: undefined })).toBe(canonico({}));
    expect(canonico({})).not.toBe(canonico(null));
  });

  it("el orden de un array sí cuenta", () => {
    expect(canonico([1, 2])).not.toBe(canonico([2, 1]));
  });
});

describe("planificar", () => {
  const TIPOS = ["precio"] as const;

  it("la primera vez, todo se crea", () => {
    const plan = planificar([], [nueva()], TIPOS);
    expect(plan.crear.map((a) => a.clave)).toEqual(["precio.plan.pro"]);
    expect(plan.reemplazar).toEqual([]);
    expect(plan.cerrar).toEqual([]);
    expect(planSinCambios(plan)).toBe(false);
  });

  it("la segunda vez con lo mismo no cambia nada (idempotencia)", () => {
    const plan = planificar([vigente()], [nueva()], TIPOS);
    expect(plan.crear).toEqual([]);
    expect(plan.reemplazar).toEqual([]);
    expect(plan.cerrar).toEqual([]);
    expect(plan.iguales).toHaveLength(1);
    expect(planSinCambios(plan)).toBe(true);
  });

  it("un cambio de texto reemplaza y es semántico", () => {
    const plan = planificar(
      [vigente()],
      [nueva({ texto: "Plan Pro: 149 € + IVA al mes." })],
      TIPOS
    );
    expect(plan.reemplazar).toHaveLength(1);
    expect(plan.reemplazar[0]).toMatchObject({
      campos: ["texto"],
      semantico: true,
    });
    expect(clavesAfectadas(plan)).toEqual(["precio.plan.pro"]);
  });

  it("un cambio de valor reemplaza y es semántico", () => {
    const plan = planificar(
      [vigente()],
      [nueva({ valor: { minutos: 700, cuotaEur: 139 } })],
      TIPOS
    );
    expect(plan.reemplazar[0]).toMatchObject({
      campos: ["valor"],
      semantico: true,
    });
  });

  it("cambiar solo la fuente o el nicho reemplaza pero NO es semántico: no bloquea borradores", () => {
    const plan = planificar(
      [vigente({ tipo: "sector", clave: "sector.peluqueria" })],
      [
        nueva({
          clave: "sector.peluqueria",
          tipo: "sector",
          fuente: "web/src/lib/sectores/otro.ts#peluqueria",
          nichoSlug: "peluqueria",
        }),
      ],
      ["sector"]
    );
    expect(plan.reemplazar).toHaveLength(1);
    expect(plan.reemplazar[0].campos.sort()).toEqual(["fuente", "nichoSlug"]);
    expect(plan.reemplazar[0].semantico).toBe(false);
    expect(clavesAfectadas(plan)).toEqual([]);
  });

  it("el commitSha no cuenta: la misma afirmación en otro commit es igual", () => {
    const plan = planificar(
      [vigente({ commitSha: "b".repeat(40) })],
      [nueva()],
      TIPOS
    );
    expect(planSinCambios(plan)).toBe(true);
  });

  it("una clave que ya no viene se cierra y deja obsoletos los borradores que la citan", () => {
    const plan = planificar(
      [vigente(), vigente({ id: "a2", clave: "precio.plan.inicio" })],
      [nueva()],
      TIPOS
    );
    expect(plan.cerrar.map((v) => v.clave)).toEqual(["precio.plan.inicio"]);
    expect(clavesAfectadas(plan)).toEqual(["precio.plan.inicio"]);
  });

  it("vigentes repetidas: se queda la más reciente y las demás se cierran como sobrantes", () => {
    const plan = planificar(
      [
        vigente({
          id: "vieja",
          vigenteDesde: new Date("2026-09-01T00:00:00Z"),
        }),
        vigente({
          id: "nueva",
          vigenteDesde: new Date("2026-10-15T00:00:00Z"),
        }),
      ],
      [nueva()],
      TIPOS
    );
    expect(plan.iguales.map((v) => v.id)).toEqual(["nueva"]);
    expect(plan.sobrantes.map((v) => v.id)).toEqual(["vieja"]);
    expect(plan.cerrar).toEqual([]);
    expect(planSinCambios(plan)).toBe(false);
  });

  it("solo toca los tipos cubiertos: lo vigente de otros tipos no se cierra", () => {
    const plan = planificar(
      [
        vigente(),
        vigente({ id: "p1", clave: "pagina.planes", tipo: "pagina" }),
      ],
      [nueva()],
      TIPOS
    );
    expect(plan.cerrar).toEqual([]);
  });

  it("nuevas vacías con tipos cubiertos: cerraría todo lo vigente de ese tipo", () => {
    const plan = planificar([vigente()], [], TIPOS);
    expect(plan.cerrar).toHaveLength(1);
  });
});

describe("camposQueCambian", () => {
  it("compara el nicho tratando null y ausencia como iguales", () => {
    expect(camposQueCambian(vigente({ nichoSlug: null }), nueva())).toEqual([]);
  });
});

describe("examinarCierres", () => {
  function vigentesDe(n: number, tipo = "pagina") {
    return Array.from({ length: n }, (_, i) =>
      vigente({ id: `v${i}`, clave: `${tipo}.x${i}`, tipo })
    );
  }

  function examen(
    vigentes: AfirmacionVigente[],
    nuevas: AfirmacionSincronizada[]
  ) {
    const tipos = [...new Set(vigentes.map((v) => v.tipo))] as never[];
    const plan = planificar(vigentes, nuevas, tipos);
    return examinarCierres(plan, vigentes.length, nuevas, vigentes, tipos);
  }

  function nuevasDe(vigentes: AfirmacionVigente[], conservar: number) {
    return vigentes.slice(0, conservar).map((v) =>
      nueva({
        clave: v.clave,
        tipo: v.tipo as never,
        texto: v.texto,
        valor: v.valor,
        fuente: v.fuente,
      })
    );
  }

  it("un cierre suelto en una base grande es normal", () => {
    const vs = vigentesDe(60);
    expect(examen(vs, nuevasDe(vs, 59)).masivo).toBe(false);
  });

  it("hasta dos cierres de un tipo pasan si no superan el 25 %", () => {
    const vs = vigentesDe(10);
    const resultado = examen(vs, nuevasDe(vs, 8));
    expect(resultado.masivo).toBe(false);
    expect(resultado.porTipo).toEqual([
      { tipo: "pagina", vigentes: 10, cierres: 2, modificadas: 0 },
    ]);
  });

  it("más de dos cierres de un tipo son masivos, aunque sean pocos frente al total", () => {
    const vs = vigentesDe(60);
    const resultado = examen(vs, nuevasDe(vs, 57));
    expect(resultado.masivo).toBe(true);
    expect(resultado.tiposConDemasiadosCierres).toEqual(["pagina"]);
    expect(resultado.motivo).toMatch(/3 de 60 de tipo pagina/);
  });

  it("más del 25 % de un tipo es masivo aunque sean solo dos (sin el suelo de cinco)", () => {
    const vs = vigentesDe(5, "prohibida");
    // 2 de 5 = 40 %
    expect(examen(vs, nuevasDe(vs, 3)).masivo).toBe(true);
    // 1 de 5 = 20 %
    expect(examen(vs, nuevasDe(vs, 4)).masivo).toBe(false);
  });

  it("el límite es por tipo: lo que sobra en un tipo no compensa lo que se retira de otro", () => {
    // 4 prohibidas, 4 páginas y 100 funciones: cierra 3 de las 4 prohibidas.
    const prohibidas = vigentesDe(4, "prohibida");
    const funciones = vigentesDe(100, "funcion");
    const vs = [...prohibidas, ...funciones];
    const nuevas = [...nuevasDe(prohibidas, 1), ...nuevasDe(funciones, 100)];
    const tipos = ["prohibida", "funcion"];
    const plan = planificar(vs, nuevas, tipos as never[]);
    const resultado = examinarCierres(plan, vs.length, nuevas, vs, tipos);
    expect(resultado.masivo).toBe(true);
    expect(resultado.tiposConDemasiadosCierres).toEqual(["prohibida"]);
  });

  it("un cambio de precios (muchas modificaciones de un tipo pequeño) no es masivo", () => {
    const vs = vigentesDe(6, "precio");
    const nuevas = vs.map((v) =>
      nueva({
        clave: v.clave,
        tipo: "precio",
        texto: `${v.texto} (nuevo precio)`,
        valor: v.valor,
        fuente: v.fuente,
      })
    );
    const resultado = examen(vs, nuevas);
    expect(resultado.masivo).toBe(false);
    expect(resultado.porTipo[0]).toMatchObject({
      cierres: 0,
      modificadas: 6,
    });
  });

  it("reescribir casi toda la base de una pasada (modificaciones) es masivo", () => {
    const vs = vigentesDe(74, "pagina");
    const nuevas = vs.map((v) =>
      nueva({
        clave: v.clave,
        tipo: "pagina",
        texto: `${v.texto} (roto)`,
        valor: v.valor,
        fuente: v.fuente,
      })
    );
    const resultado = examen(vs, nuevas);
    expect(resultado.masivo).toBe(true);
    expect(resultado.motivo).toMatch(/74 de 74 afirmaciones vigentes/);
    expect(resultado.motivo).toMatch(/0 retiradas y 74 modificadas/);
  });

  it("cambiar solo la fuente no cuenta como modificación", () => {
    const vs = vigentesDe(74, "pagina");
    const nuevas = vs.map((v) =>
      nueva({
        clave: v.clave,
        tipo: "pagina",
        texto: v.texto,
        valor: v.valor,
        fuente: "web/src/lib/otro.ts#x",
      })
    );
    expect(examen(vs, nuevas).masivo).toBe(false);
  });

  it("un tipo cubierto sin ninguna afirmación nueva se considera vaciado", () => {
    const vs = vigentesDe(3, "precio");
    const plan = planificar(vs, [], ["precio"]);
    const resultado = examinarCierres(plan, 3, [], vs, ["precio"]);
    expect(resultado.masivo).toBe(true);
    expect(resultado.tiposVaciados).toEqual(["precio"]);
  });

  it("un tipo que no tiene vigentes no cuenta como vaciado", () => {
    const plan = planificar([], [], ["precio"]);
    expect(examinarCierres(plan, 0, [], [], ["precio"]).masivo).toBe(false);
  });
});

describe("prohibidasDebilitadas", () => {
  const reglaVigente = (
    clave: string,
    terminos: string[],
    palabrasEnteras = true
  ) =>
    vigente({
      id: clave,
      clave,
      tipo: "prohibida",
      texto: `No se dice: ${terminos.join("; ")}.`,
      valor: { terminos, palabrasEnteras },
      fuente: "growth/agentes/reglas/afirmaciones-prohibidas.md#x",
    });
  const reglaNueva = (
    clave: string,
    terminos: string[],
    palabrasEnteras = true
  ) =>
    nueva({
      clave,
      tipo: "prohibida",
      texto: `No se dice: ${terminos.join("; ")}.`,
      valor: { terminos, palabrasEnteras },
      fuente: "growth/agentes/reglas/afirmaciones-prohibidas.md#x",
    });
  const plan = (
    vigentes: AfirmacionVigente[],
    nuevas: AfirmacionSincronizada[]
  ) => planificar(vigentes, nuevas, ["prohibida"]);

  it("añadir reglas o términos endurece: no se señala nada", () => {
    const p = plan(
      [reglaVigente("prohibida.proveedores", ["Telnyx"])],
      [
        reglaNueva("prohibida.proveedores", ["Telnyx", "Soniox"]),
        reglaNueva("prohibida.nueva", ["otra cosa"]),
      ]
    );
    expect(prohibidasDebilitadas(p)).toEqual([]);
  });

  it("retirar una regla entera debilita", () => {
    const p = plan(
      [
        reglaVigente("prohibida.proveedores", ["Telnyx"]),
        reglaVigente("prohibida.jerga", ["webhook", "LLM"]),
      ],
      [reglaNueva("prohibida.jerga", ["webhook", "LLM"])]
    );
    expect(prohibidasDebilitadas(p)).toEqual([
      {
        clave: "prohibida.proveedores",
        motivo: "retirada",
        terminos: ["Telnyx"],
      },
    ]);
  });

  it("quitar o cambiar un término debilita (escenario del revisor: «xyzzy» en vez de «Telnyx»)", () => {
    const p = plan(
      [reglaVigente("prohibida.proveedores", ["Telnyx", "Soniox"])],
      [reglaNueva("prohibida.proveedores", ["xyzzy", "Soniox"])]
    );
    expect(prohibidasDebilitadas(p)).toEqual([
      {
        clave: "prohibida.proveedores",
        motivo: "terminos_quitados",
        terminos: ["Telnyx"],
      },
    ]);
  });

  it("la lista de términos nunca se acorta, ni siquiera añadiendo otros", () => {
    const p = plan(
      [reglaVigente("prohibida.jerga", ["a-uno", "a-dos", "a-tres"])],
      [reglaNueva("prohibida.jerga", ["a-uno", "a-dos", "b-uno", "b-dos"])]
    );
    expect(prohibidasDebilitadas(p)[0]).toMatchObject({
      motivo: "terminos_quitados",
      terminos: ["a-tres"],
    });
  });

  it("tampoco los acentos: el backend busca sin ellos, así que «Télnyx» y «Telnyx» son el mismo término", () => {
    const p = plan(
      [reglaVigente("prohibida.proveedores", ["Telnyx", "año"])],
      [reglaNueva("prohibida.proveedores", ["Télnyx", "ano"])]
    );
    expect(prohibidasDebilitadas(p)).toEqual([]);
  });

  it("mayúsculas, espacios y caracteres de compatibilidad no cuentan como un término distinto", () => {
    const p = plan(
      [reglaVigente("prohibida.proveedores", ["Telnyx", "agenda real"])],
      [
        reglaNueva("prohibida.proveedores", [
          "TELNYX",
          "Agenda  Real",
          "Ｓoniox",
        ]),
      ]
    );
    expect(prohibidasDebilitadas(p)).toEqual([]);
  });

  it("pasar de palabra entera a «contiene» debilita; al revés no se señala", () => {
    const aContiene = plan(
      [reglaVigente("prohibida.proveedores", ["Telnyx"], true)],
      [reglaNueva("prohibida.proveedores", ["Telnyx"], false)]
    );
    expect(prohibidasDebilitadas(aContiene)).toEqual([
      {
        clave: "prohibida.proveedores",
        motivo: "palabras_enteras",
        terminos: ["Telnyx"],
      },
    ]);
    const aEntera = plan(
      [reglaVigente("prohibida.proveedores", ["Telnyx"], false)],
      [reglaNueva("prohibida.proveedores", ["Telnyx"], true)]
    );
    expect(prohibidasDebilitadas(aEntera)).toEqual([]);
  });

  it("una regla sin lista (aplica el texto entero) se compara por su texto", () => {
    const sinLista = vigente({
      clave: "prohibida.vieja",
      tipo: "prohibida",
      texto: "frase vieja",
      valor: null,
    });
    const p = plan([sinLista], [reglaNueva("prohibida.vieja", ["otra"])]);
    expect(prohibidasDebilitadas(p)[0]).toMatchObject({
      motivo: "terminos_quitados",
      terminos: ["frase vieja"],
    });
  });

  it("solo mira las prohibidas: retirar un precio no se señala", () => {
    const p = planificar([vigente()], [], ["precio"]);
    expect(prohibidasDebilitadas(p)).toEqual([]);
  });

  it("las vigentes repetidas (sobrantes) no cuentan como una retirada", () => {
    const p = plan(
      [
        reglaVigente("prohibida.proveedores", ["Telnyx"]),
        {
          ...reglaVigente("prohibida.proveedores", ["Telnyx"]),
          id: "otra",
          vigenteDesde: new Date("2026-09-01T00:00:00Z"),
        },
      ],
      [reglaNueva("prohibida.proveedores", ["Telnyx"])]
    );
    expect(prohibidasDebilitadas(p)).toEqual([]);
  });

  it("describirDebilitamientos resume con las claves y los términos", () => {
    const texto = describirDebilitamientos([
      { clave: "prohibida.a", motivo: "retirada", terminos: ["x", "y"] },
      {
        clave: "prohibida.b",
        motivo: "terminos_quitados",
        terminos: ["1", "2", "3", "4", "5", "6", "7"],
      },
    ]);
    expect(texto).toContain("prohibida.a (se retira la regla: x, y)");
    expect(texto).toContain(
      "prohibida.b (se quitan términos: 1, 2, 3, 4, 5 y 2 más)"
    );
  });
});
