import { describe, it, expect } from "vitest";

import { nicheLandings, type NicheSlug } from "@/lib/niche-landings";
import { GUIONES_SECTOR } from "@/lib/relato-guiones";
import {
  GUION_GESTOR_GENERAL,
  GUIONES_GESTOR,
  RITMO,
  ausenciaDe,
  duracionDe,
  duracionDelGuion,
  estadoDeTurnos,
  guionDelGestor,
  hitosAlcanzados,
  horaDelTurno,
  pasosDe,
  progresoEn,
  vistaActiva,
  type Escenario,
  type GuionGestor,
} from "@/lib/gestor-guiones";

const SECTORES = Object.keys(nicheLandings) as NicheSlug[];
const GUIONES: Array<[string, GuionGestor]> = [
  ["general", GUION_GESTOR_GENERAL],
  ...SECTORES.map((s) => [s, GUIONES_GESTOR[s]] as [string, GuionGestor]),
];

/** Los hitos que puede alcanzar una situación: sus botones y sus consultas. */
function hitosDe(escenario: Escenario): string[] {
  return escenario.turnos.flatMap((t) => (t.de !== "dueno" && t.hito ? [t.hito] : []));
}

/**
 * Los guiones del Gestor en acción: uno por landing, la misma cadena
 * honesta (propuesta → Confirmar → Hecho) con el vocabulario de cada sector.
 */
describe("gestor-guiones", () => {
  it("hay un guion por sector y la portada usa el general", () => {
    expect(Object.keys(GUIONES_GESTOR).sort()).toEqual([...SECTORES].sort());
    expect(guionDelGestor()).toBe(GUION_GESTOR_GENERAL);
    for (const sector of SECTORES) {
      expect(guionDelGestor(sector)).toBe(GUIONES_GESTOR[sector]);
    }
  });

  it.each(GUIONES)("el guion %s tiene tres situaciones que empiezan por la ausencia", (_, guion) => {
    expect(guion.escenarios).toHaveLength(3);
    expect(guion.escenarios[0].id).toBe("ausencia");
    const ids = guion.escenarios.map((e) => e.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("los profesionales de cada sector son los de su landing (el relato)", () => {
    for (const sector of SECTORES) {
      const g = GUIONES_SECTOR[sector];
      const ausencia = GUIONES_GESTOR[sector].escenarios[0];
      expect(GUIONES_GESTOR[sector].negocio).toBe(g.negocio);
      expect(ausencia.turnos[0]).toMatchObject({ de: "dueno" });
      expect(ausencia.turnos[0].texto).toContain(g.profesional);
      expect(ausencia.turnos.some((t) => t.de === "gestor" && t.texto.includes(g.companera))).toBe(true);
      const agenda = ausencia.vistas[0];
      expect(agenda.tipo).toBe("agenda");
      if (agenda.tipo === "agenda") {
        expect(agenda.profesionales).toContain(g.profesional);
        expect(agenda.profesionales).toContain(g.companera);
      }
    }
  });

  it.each(GUIONES)("en %s, nada cambia sin pulsar un botón y cada propuesta lleva Confirmar · Cancelar", (_, guion) => {
    for (const escenario of guion.escenarios) {
      escenario.turnos.forEach((turno, i) => {
        if (turno.de === "gestor" && turno.texto.startsWith("¿Confirmas?")) {
          expect(turno.botones).toEqual(["Confirmar", "Cancelar"]);
        }
        if (turno.de === "boton") {
          // El botón pulsado es uno de los dos del mensaje anterior.
          const anterior = escenario.turnos[i - 1];
          expect(anterior.de).toBe("gestor");
          if (anterior.de === "gestor") expect(anterior.botones).toContain(turno.texto);
        }
        if (turno.de === "gestor" && turno.texto.startsWith("Hecho:")) {
          // Un «Hecho» solo sigue a un botón pulsado, nunca a un mensaje suelto.
          expect(escenario.turnos[i - 1].de).toBe("boton");
        }
      });
      // Una propuesta a la vez: entre dos «¿Confirmas?» hay un botón.
      const propuestas = escenario.turnos.map((t, i) => (t.de === "gestor" && t.botones ? i : -1)).filter((i) => i >= 0);
      for (let k = 1; k < propuestas.length; k++) {
        const entre = escenario.turnos.slice(propuestas[k - 1] + 1, propuestas[k]);
        expect(entre.some((t) => t.de === "boton")).toBe(true);
      }
      // El Gestor no usa emojis.
      expect(escenario.turnos.map((t) => t.texto).join(" ")).not.toMatch(/✓|✔/);
    }
  });

  it.each(GUIONES)("en %s, cada hito del panel lo alcanza un turno y cada aviso tiene su hito", (_, guion) => {
    for (const escenario of guion.escenarios) {
      const hitos = hitosDe(escenario);
      for (const hito of Object.keys(escenario.avisos)) expect(hitos).toContain(hito);
      for (const vista of escenario.vistas) {
        if (vista.desdeHito) expect(hitos).toContain(vista.desdeHito);
        if (vista.tipo === "agenda") {
          if (vista.ausencia) expect(hitos).toContain(vista.ausencia.hito);
          if (vista.cita?.movida) expect(hitos).toContain(vista.cita.movida.hito);
          if (vista.cita?.nueva) expect(hitos).toContain(vista.cita.nueva);
          if (vista.cita?.whatsapp) expect(hitos).toContain(vista.cita.whatsapp.hito);
          // Las citas caben en las diez filas de la agenda y en sus tres columnas.
          for (const cita of [...vista.citas, ...(vista.cita ? [vista.cita.cita] : [])]) {
            expect(cita.col).toBeGreaterThanOrEqual(0);
            expect(cita.col).toBeLessThan(3);
            expect(cita.fila + cita.filas).toBeLessThanOrEqual(10);
          }
        }
        if (vista.tipo === "horario") expect(hitos).toContain(vista.nuevo.hito);
        if (vista.tipo === "servicios") {
          if (vista.cambio) {
            expect(hitos).toContain(vista.cambio.hito);
            expect(vista.servicios.map((s) => s.nombre)).toContain(vista.cambio.nombre);
          }
          if (vista.nuevo) expect(hitos).toContain(vista.nuevo.hito);
        }
        if (vista.tipo === "informacion") expect(hitos).toContain(vista.nueva.hito);
        if (vista.tipo === "resumen") expect(hitos).toContain(vista.hito);
      }
    }
  });

  it("la ausencia sigue el orden real: ausencia, Hecho, a quién, mover, Hecho, ¿le aviso?, aviso", () => {
    const turnos = ausenciaDe({
      aviso: "Marta está de baja hoy",
      profesional: "Marta",
      cuando: "hoy",
      motivo: "baja",
      respuesta: "La de las 11, a Lucía",
      cita: "la cita de Carmen R.",
      servicio: "Corte y color",
      hora: "11:00",
      otra: "Lucía",
      cliente: "Carmen",
      telefono: "+34 791 32 55 57",
    });
    const textos = turnos.map((t) => t.texto);
    expect(textos[1]).toBe(
      "¿Confirmas? Marcar a Marta como ausente hoy (baja): la recepcionista no le reservará nada. Ojo: ya tiene 1 cita ahí, que no se mueve sola."
    );
    expect(turnos[2]).toMatchObject({ de: "boton", texto: "Confirmar", hito: "ausente" });
    expect(textos[3]).toContain("dime si las movemos o las cancelamos");
    expect(turnos[4].de).toBe("dueno");
    expect(textos[5]).toBe("¿Confirmas? Mover la cita de Carmen R. de hoy a las 11:00 (Corte y color) con Marta, a la misma hora con Lucía.");
    expect(turnos[6]).toMatchObject({ de: "boton", hito: "movida" });
    expect(textos[7]).toContain("El calendario ya está al día.");
    expect(turnos[8]).toMatchObject({
      de: "gestor",
      botones: ["Sí, avísale", "Le llamo yo"],
      seguido: true,
    });
    expect(textos[8]).toBe("¿Le aviso a Carmen por WhatsApp de la nueva hora? Si prefieres llamarle tú: +34 791 32 55 57.");
    expect(turnos[9]).toMatchObject({ de: "boton", texto: "Sí, avísale", hito: "avisada" });
    expect(textos[10]).toBe("Le aviso a Carmen al +34 791 32 55 57.");
    // Sin motivo, sin paréntesis.
    const sinMotivo = ausenciaDe({
      aviso: "Sara no puede venir hoy",
      profesional: "Sara",
      cuando: "hoy",
      respuesta: "A Elena",
      cita: "la cita de Inés",
      servicio: "Facial",
      hora: "12:00",
      otra: "Elena",
      cliente: "Inés",
      telefono: "+34 794 27 93 51",
    });
    expect(sinMotivo[1].texto).toContain("como ausente hoy: la recepcionista");
  });

  it.each(GUIONES)("en %s, la ausencia va en el orden real y el dueño dice a quién antes de mover", (_, guion) => {
    const textos = guion.escenarios[0].turnos.map((t) => t.texto);
    const ausencia = textos.findIndex((t) => t.startsWith("¿Confirmas? Marcar a "));
    const hecho = textos.findIndex((t) => t.includes("dime si las movemos o las cancelamos"));
    const mover = textos.findIndex((t) => t.startsWith("¿Confirmas? Mover "));
    const aviso = textos.findIndex((t) => t.startsWith("¿Le aviso a "));
    expect(ausencia).toBe(1);
    expect(hecho).toBeGreaterThan(ausencia);
    expect(mover).toBeGreaterThan(hecho + 1);
    expect(aviso).toBeGreaterThan(mover);
    // El sistema no reparte solo: entre el «Hecho» y la propuesta de mover
    // habla el dueño.
    expect(guion.escenarios[0].turnos[hecho + 1].de).toBe("dueno");
  });

  it("las fechas de los guiones caen en el día de la semana que dicen (2026)", () => {
    const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const fechas = new RegExp(`(${DIAS.join("|")}),? (\\d{1,2}) de (${MESES.join("|")})`, "gi");
    let vistas = 0;
    for (const [, guion] of GUIONES) {
      const todo = JSON.stringify(guion);
      for (const [, dia, numero, mes] of todo.matchAll(fechas)) {
        const fecha = new Date(Date.UTC(2026, MESES.indexOf(mes.toLowerCase()), Number(numero)));
        expect(`${dia.toLowerCase()} ${numero} de ${mes}`).toBe(`${DIAS[fecha.getUTCDay()]} ${numero} de ${mes}`);
        vistas++;
      }
    }
    expect(vistas).toBeGreaterThan(10);
  });

  it("los pasos recorren cada letra del dueño, los puntos y cada mensaje, en orden", () => {
    const escenario: Escenario = {
      id: "p",
      reloj: "9:00",
      diaCorto: "Lun",
      turnos: [
        { de: "dueno", texto: "Hola" },
        { de: "gestor", texto: "¿Confirmas? Algo.", botones: ["Confirmar", "Cancelar"] },
        { de: "boton", texto: "Confirmar", hito: "x" },
        { de: "gestor", texto: "Hecho.", seguido: true },
      ],
      vistas: [{ tipo: "resumen", cifras: [], hito: "x" }],
      avisos: {},
    };
    const pasos = pasosDe(escenario);
    expect(pasos.map((p) => `${p.turno}:${p.fase}`)).toEqual([
      "0:tecleando",
      "0:tecleando",
      "0:tecleando",
      "0:tecleando",
      "0:enviado",
      "1:escribiendo",
      "1:visible",
      "2:pulsado",
      "3:escribiendo",
      "3:visible",
    ]);
    expect(pasos[0]).toMatchObject({ letras: 1, espera: RITMO.letra });
    expect(pasos[3]).toMatchObject({ letras: 4 });
    expect(pasos[5].espera).toBe(RITMO.escribiendo);
    expect(pasos[8].espera).toBe(RITMO.escribiendoSeguido);
    // Con botones se lee menos por letra, y se suma ver los botones.
    expect(pasos[6].espera).toBe(RITMO.lecturaBase + "¿Confirmas? Algo.".length * RITMO.lecturaConBotonesPorLetra + RITMO.botones);
    expect(pasos[9].espera).toBe(RITMO.lecturaBase + "Hecho.".length * RITMO.lecturaPorLetra);
    expect(pasos[7].espera).toBe(RITMO.pulsado);
    expect(duracionDe(escenario)).toBe(pasos.reduce((t, p) => t + p.espera, RITMO.inicial + RITMO.final));

    // Qué se ve con cada número de pasos aplicados.
    expect(estadoDeTurnos(escenario, pasos, 0)).toEqual({ estados: ["oculto", "oculto", "oculto", "oculto"], letras: 0 });
    expect(estadoDeTurnos(escenario, pasos, 2)).toEqual({ estados: ["tecleando", "oculto", "oculto", "oculto"], letras: 2 });
    expect(estadoDeTurnos(escenario, pasos, 5)).toEqual({ estados: ["visible", "oculto", "oculto", "oculto"], letras: 0 });
    expect(estadoDeTurnos(escenario, pasos, 6).estados[1]).toBe("escribiendo");
    const al7 = estadoDeTurnos(escenario, pasos, 7);
    expect(al7.estados).toEqual(["visible", "visible", "oculto", "oculto"]);
    expect(hitosAlcanzados(escenario, al7.estados)).toEqual([]);
    const al8 = estadoDeTurnos(escenario, pasos, 8);
    expect(al8.estados[2]).toBe("visible");
    expect(hitosAlcanzados(escenario, al8.estados)).toEqual(["x"]);
    expect(estadoDeTurnos(escenario, pasos, pasos.length).estados).toEqual(["visible", "visible", "visible", "visible"]);

    // El progreso crece con el tiempo y llega a 1 al final.
    expect(progresoEn(pasos, 0, duracionDe(escenario))).toBeCloseTo(RITMO.inicial / duracionDe(escenario));
    expect(progresoEn(pasos, 5, duracionDe(escenario))).toBeGreaterThan(progresoEn(pasos, 2, duracionDe(escenario)));
    expect(progresoEn(pasos, pasos.length, duracionDe(escenario))).toBeLessThanOrEqual(1);
  });

  it("la vista activa es la última cuyo hito se alcanzó", () => {
    const semana = GUIONES_GESTOR.fisioterapia.escenarios[2];
    expect(semana.vistas).toHaveLength(2);
    expect(vistaActiva(semana, []).tipo).toBe("resumen");
    expect(vistaActiva(semana, ["resumen"]).tipo).toBe("resumen");
    expect(vistaActiva(semana, ["resumen", "duracion"]).tipo).toBe("servicios");
    // Una consulta del Gestor también es un hito, sin botón.
    const pasos = pasosDe(semana);
    const { estados } = estadoDeTurnos(semana, pasos, pasos.length);
    expect(hitosAlcanzados(semana, estados)).toEqual(["resumen", "duracion"]);
  });

  it("la hora de las burbujas avanza un minuto cada pocos turnos", () => {
    expect(horaDelTurno("8:41", 0)).toBe("8:41");
    expect(horaDelTurno("8:41", 3)).toBe("8:41");
    expect(horaDelTurno("8:41", 4)).toBe("8:42");
    expect(horaDelTurno("20:59", 8)).toBe("21:01");
  });

  it("una vuelta entera dura menos de 35 segundos y la ausencia menos de 18", () => {
    for (const [, guion] of GUIONES) {
      expect(duracionDelGuion(guion)).toBeLessThan(35_000);
      expect(duracionDe(guion.escenarios[0])).toBeLessThan(18_000);
      for (const escenario of guion.escenarios) {
        // Ninguna situación se queda sin mostrar (el final deja ver el aviso).
        expect(duracionDe(escenario)).toBeGreaterThan(RITMO.inicial + RITMO.final);
      }
    }
  });
});
