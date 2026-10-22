import { describe, it, expect } from "vitest";

import {
  ALTO_BOLSILLO_VH,
  ALTO_NEGOCIO_VH,
  BLOQUEO_VH,
  BOLSILLO_P,
  BOLSILLO_VH,
  CORTE_VH,
  ENCUADRE_VH,
  HOLGURA_CUBRE,
  NEGOCIO_P,
  NEGOCIO_VH,
  SOLAPE_NEGOCIO_VH,
  aumentoQueCubre,
  encendidoEnElCorte,
  hayNegocioEnEscena,
  marcarNegocioEnEscena,
  salida,
  zambullida,
} from "@/lib/transicion-bolsillo-negocio";

/**
 * La transición «En tu bolsillo» → «En tu negocio» se reparte en vh de
 * scroll; de ahí salen las alturas de las dos secciones, el solape y los
 * puntos del progreso de cada una. Lo que importa es que casen entre sí: el
 * teléfono cubre el escenario antes del corte, el corte cae con los dos
 * escenarios fijos y la salida continúa la zambullida.
 */
describe("transicion-bolsillo-negocio", () => {
  it("el cruce cae dentro del recorrido fijo de «En tu bolsillo» y al principio del de «En tu negocio»", () => {
    const recorridoBolsillo = ALTO_BOLSILLO_VH - 100;
    const recorridoNegocio = ALTO_NEGOCIO_VH - 100;
    // «En tu negocio» se pega arriba justo cuando empieza el cruce…
    expect(recorridoBolsillo * BOLSILLO_P.inicioCruce).toBeCloseTo(
      ALTO_BOLSILLO_VH - SOLAPE_NEGOCIO_VH
    );
    // …y el cruce dura lo mismo visto desde las dos secciones.
    expect(recorridoBolsillo * (1 - BOLSILLO_P.inicioCruce)).toBeCloseTo(
      BOLSILLO_VH.cruce
    );
    expect(recorridoNegocio * NEGOCIO_P.finCruce).toBeCloseTo(
      BOLSILLO_VH.cruce
    );
  });

  it("los pasos de cada sección conservan su scroll de antes", () => {
    const recorridoBolsillo = ALTO_BOLSILLO_VH - 100;
    const recorridoNegocio = ALTO_NEGOCIO_VH - 100;
    expect(recorridoBolsillo * BOLSILLO_P.finPasos).toBeCloseTo(
      BOLSILLO_VH.pasos
    );
    expect(recorridoNegocio * (1 - NEGOCIO_P.finSalida)).toBeCloseTo(
      NEGOCIO_VH.pasos
    );
    expect(BOLSILLO_P.finPasos).toBeLessThan(BOLSILLO_P.finVuelco);
    expect(BOLSILLO_P.finVuelco).toBeLessThan(BOLSILLO_P.inicioCruce);
    expect(NEGOCIO_P.finCruce).toBeLessThan(NEGOCIO_P.finSalida);
    // El texto de «En tu negocio» entra durante la salida, no después.
    expect(NEGOCIO_P.finCruce).toBeLessThan(NEGOCIO_P.inicioTitulo);
    expect(NEGOCIO_P.inicioTitulo).toBeLessThan(NEGOCIO_P.finTitulo);
    expect(NEGOCIO_P.finTitulo).toBeLessThanOrEqual(NEGOCIO_P.finSalida);
  });

  it("cada tramo que se ve del relevo dura más de una muesca de rueda (~13 vh)", () => {
    for (const vh of [
      BOLSILLO_VH.vuelco,
      BOLSILLO_VH.zambullida,
      NEGOCIO_VH.salida,
    ]) {
      expect(vh).toBeGreaterThanOrEqual(26);
    }
  });

  it("el corte: la pantalla del portátil antes que el escenario, al principio del cruce y con reserva para el rezago", () => {
    expect(CORTE_VH.pantalla[0]).toBeGreaterThan(0);
    expect(CORTE_VH.pantalla[1]).toBeLessThanOrEqual(CORTE_VH.escenario[0]);
    expect(CORTE_VH.escenario[1] + CORTE_VH.reserva).toBeLessThanOrEqual(
      BOLSILLO_VH.cruce
    );
    // La reserva no deja sin margen al corte forzado.
    expect(CORTE_VH.reserva).toBeGreaterThan(CORTE_VH.escenario[1]);
  });

  it("encendidoEnElCorte: sobre el scroll suave, forzado sobre el real al final del cruce y apagado sin escenario fijo", () => {
    const tramo = CORTE_VH.escenario;
    // Con el escenario de «En tu negocio» aún sin pegar, nada.
    expect(encendidoEnElCorte(tramo[1] + 5, 0, tramo)).toBe(0);
    // Lo normal: el scroll suave recorre el tramo.
    expect(encendidoEnElCorte(tramo[0], tramo[0] + 1, tramo)).toBe(0);
    expect(
      encendidoEnElCorte((tramo[0] + tramo[1]) / 2, tramo[1], tramo)
    ).toBeCloseTo(0.5);
    expect(encendidoEnElCorte(tramo[1], tramo[1] + 1, tramo)).toBe(1);
    // Una rueda rápida: el suave va muy por detrás, pero el real llega al
    // final del cruce y lo fuerza antes de que «En tu bolsillo» se despegue.
    expect(
      encendidoEnElCorte(
        -20,
        BOLSILLO_VH.cruce - CORTE_VH.reserva + tramo[1],
        tramo
      )
    ).toBe(1);
    expect(
      encendidoEnElCorte(-20, BOLSILLO_VH.cruce - CORTE_VH.reserva, tramo)
    ).toBe(0);
  });

  it("aumentoQueCubre: cubre el escenario por el lado que más le falta, con holgura", () => {
    // La pantalla del teléfono tumbado en escritorio (1280×800): manda el alto.
    expect(
      aumentoQueCubre(
        { ancho: 717, alto: 328 },
        { ancho: 1280, alto: 800 },
        HOLGURA_CUBRE.telefono
      )
    ).toBeCloseTo((800 / 328) * HOLGURA_CUBRE.telefono);
    // En un móvil vertical (390×844) hace falta mucho más.
    expect(
      aumentoQueCubre(
        { ancho: 314, alto: 144 },
        { ancho: 390, alto: 844 },
        HOLGURA_CUBRE.telefono
      )
    ).toBeCloseTo((844 / 144) * HOLGURA_CUBRE.telefono);
    // La pantalla del portátil en cm: sale el aumento en px por cm, y en
    // escritorio manda el ancho.
    expect(
      aumentoQueCubre(
        { ancho: 34.5, alto: 22.3 },
        { ancho: 1280, alto: 800 },
        HOLGURA_CUBRE.portatil
      )
    ).toBeCloseTo((1280 / 34.5) * HOLGURA_CUBRE.portatil);
    expect(HOLGURA_CUBRE.telefono).toBeGreaterThan(1);
    // La cámara del portátil ya se aleja en el corte: necesita más margen.
    expect(HOLGURA_CUBRE.portatil).toBeGreaterThan(HOLGURA_CUBRE.telefono);
  });

  it("la salida arranca a la velocidad con la que acaba la zambullida", () => {
    expect(zambullida(0)).toBe(0);
    expect(zambullida(1)).toBe(1);
    expect(salida(0)).toBe(0);
    expect(salida(1)).toBe(1);
    // La zambullida arranca quieta y la salida llega quieta.
    expect(zambullida(0.25)).toBeLessThan(0.05);
    expect(salida(0.75)).toBeGreaterThan(0.95);
    // Pendientes en el corte (por vh de scroll): la misma, más o menos.
    const e = 1e-4;
    const alAcabar =
      (zambullida(1) - zambullida(1 - e)) / e / BOLSILLO_VH.zambullida;
    const alArrancar =
      (salida(e) - salida(0)) / e / (BOLSILLO_VH.cruce + NEGOCIO_VH.salida);
    expect(alArrancar / alAcabar).toBeGreaterThan(0.85);
    expect(alArrancar / alAcabar).toBeLessThan(1.15);
  });

  it("la pantalla de bloqueo y el reencuadre caben en la salida, en orden", () => {
    const finSalida = BOLSILLO_VH.cruce + NEGOCIO_VH.salida;
    // La hora entra con el portátil ya a la vista, después del corte.
    expect(BLOQUEO_VH.reloj[0]).toBeGreaterThan(CORTE_VH.escenario[1]);
    expect(BLOQUEO_VH.reloj[1]).toBeLessThanOrEqual(BLOQUEO_VH.avisos[0][0]);
    // La cámara reencuadra cuando el aviso ya está, va por delante del
    // texto (que entra con el portátil ya casi en su sitio) y acaba dentro
    // de la salida.
    expect(ENCUADRE_VH[0]).toBeGreaterThanOrEqual(BLOQUEO_VH.avisos[0][1]);
    const recorridoNegocio =
      BOLSILLO_VH.cruce + NEGOCIO_VH.salida + NEGOCIO_VH.pasos;
    expect(ENCUADRE_VH[0]).toBeLessThan(
      NEGOCIO_P.inicioTitulo * recorridoNegocio
    );
    expect(ENCUADRE_VH[1]).toBeLessThanOrEqual(finSalida);
    expect(BLOQUEO_VH.desbloqueo[1]).toBeLessThanOrEqual(finSalida);
  });

  it("marca si «En tu negocio» va con escena", () => {
    expect(hayNegocioEnEscena()).toBe(false);
    marcarNegocioEnEscena(true);
    expect(hayNegocioEnEscena()).toBe(true);
    marcarNegocioEnEscena(false);
    expect(hayNegocioEnEscena()).toBe(false);
  });
});
