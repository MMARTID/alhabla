/**
 * La transición entre «En tu bolsillo» (`components/llamada-scroll.tsx`) y
 * «En tu negocio» (`components/en-tu-negocio.tsx` y su escena three.js) en
 * la portada y en las landings de sector: las dos secciones son una sola
 * tira continua, y el relevo es una zambullida en la pantalla.
 *
 *   «En tu bolsillo»                           │ «En tu negocio»
 *   pasos ─ vuelco ─ zambullida ─ cruce ───────│─── salida (zoom out) ─ pasos
 *                                  ▲ corte
 *
 * - Vuelco: el teléfono se tumba (−90°) casi en su sitio, crece un poco y
 *   su pantalla se apaga: queda una pieza negra apaisada.
 * - Zambullida: el teléfono tumbado se va al centro del escenario y se viene
 *   hacia la cámara acelerando (`zambullida`, ease-in cúbico; con un leve
 *   giro en Y que se endereza al llegar) hasta que su pantalla negra cubre
 *   el escenario entero y de sobra (`HOLGURA_CUBRE.telefono`): el marco sale
 *   de cuadro y solo queda negro. Cuánto hay que ampliarlo depende del
 *   tamaño de la pantalla y del escenario (unas 3× en escritorio, 6× en un
 *   móvil vertical): lo mide «En tu bolsillo» con `aumentoQueCubre`.
 * - Cruce: los dos escenarios fijos, todo negro. En sus primeros vh, el
 *   corte (`CORTE_VH`): la pantalla HTML del portátil de «En tu negocio»
 *   —bloqueada, negra— se enciende encima, con la cámara tan pegada que
 *   también cubre el escenario entero (`HOLGURA_CUBRE.portatil`), y después,
 *   ya tapados por ella, el fondo del escenario y el lienzo 3D. Negro sobre
 *   negro: aunque el bucle de framer-motion y el rAF de la escena vayan un
 *   fotograma desacompasados, no se ve nada. El resto del cruce es reserva
 *   (ver `encendidoEnElCorte`): el scroll suave va por detrás del real, y
 *   «En tu negocio» tiene que estar opaco antes de que el escenario de «En
 *   tu bolsillo» se despegue, pase lo que pase con la rueda.
 * - Salida: desde el principio del cruce la cámara se aleja desde dentro de
 *   la pantalla del portátil (`salida`, ease-out quíntico que arranca a la
 *   velocidad con la que acababa la zambullida —misma pendiente en escala
 *   logarítmica— y frena pronto) hasta el encuadre del paso 1, descubriendo
 *   el MacBook 3D. En la pantalla, ya casi entera, aparecen la hora y el
 *   aviso de WhatsApp de la cita nueva (`components/pantalla-bloqueo.tsx`),
 *   da tiempo a leerlo, y la pantalla se desbloquea al panel mientras entra
 *   el texto de «En tu negocio».
 *
 * Cada tramo que se ve tiene scroll de sobra (una muesca de rueda son ~13
 * vh): con tramos de 16 vh, como al principio, el relevo se resolvía de golpe.
 *
 * (Hasta el 2026-10-22 entre el vuelco y el portátil había un rectángulo
 * negro plano que nacía sobre la silueta del teléfono tumbado y se estiraba
 * —animando tamaño y posición— hasta la pantalla del portátil, con una
 * copia de la pantalla de bloqueo dentro; alrededor aparecía el portátil ya
 * enorme y recortado. Se veía como un cuadrado sin profundidad, de esquinas
 * casi rectas y de mala calidad. Hasta el 2026-10-01 el teléfono se iba a
 * una esquina y se cruzaba con la tapa cerrada vista desde arriba.)
 *
 * Todo se mide en vh de scroll; de aquí salen las alturas de las dos
 * secciones, el solape y los puntos del progreso (`p`, de 0 a 1) de cada una.
 */

/** Scroll, en vh, de cada tramo de «En tu bolsillo». */
export const BOLSILLO_VH = {
  /** Los tres pasos de la llamada (antes, toda la sección: 340 − 100). */
  pasos: 256,
  vuelco: 60,
  zambullida: 64,
  /**
   * El cruce, con los dos escenarios fijos: el corte va al principio
   * (`CORTE_VH`) y lo demás es reserva para el rezago del scroll suave.
   */
  cruce: 30,
} as const;

/** Scroll, en vh, de cada tramo de «En tu negocio» que se añade delante. */
export const NEGOCIO_VH = {
  /** La salida (zoom out) sigue al cruce; la cámara ya se mueve en él. */
  salida: 80,
  /** Los tres pasos del panel (antes, toda la sección: 360 − 100). */
  pasos: 260,
} as const;

const RECORRIDO_BOLSILLO =
  BOLSILLO_VH.pasos +
  BOLSILLO_VH.vuelco +
  BOLSILLO_VH.zambullida +
  BOLSILLO_VH.cruce;
const RECORRIDO_NEGOCIO =
  BOLSILLO_VH.cruce + NEGOCIO_VH.salida + NEGOCIO_VH.pasos;

/** Alto de cada sección: su recorrido más la pantalla del escenario fijo. */
export const ALTO_BOLSILLO_VH = RECORRIDO_BOLSILLO + 100;
export const ALTO_NEGOCIO_VH = RECORRIDO_NEGOCIO + 100;
/**
 * Cuánto sube «En tu negocio» sobre «En tu bolsillo» (margen negativo): una
 * pantalla, para que su escenario se pegue arriba en cuanto empieza el
 * cruce, más el cruce, que transcurre con los dos escenarios fijos.
 */
export const SOLAPE_NEGOCIO_VH = 100 + BOLSILLO_VH.cruce;

/** Puntos del progreso (0–1) de «En tu bolsillo». */
export const BOLSILLO_P = {
  finPasos: BOLSILLO_VH.pasos / RECORRIDO_BOLSILLO,
  finVuelco: (BOLSILLO_VH.pasos + BOLSILLO_VH.vuelco) / RECORRIDO_BOLSILLO,
  inicioCruce:
    (BOLSILLO_VH.pasos + BOLSILLO_VH.vuelco + BOLSILLO_VH.zambullida) /
    RECORRIDO_BOLSILLO,
} as const;

/**
 * Cuándo entra el texto de «En tu negocio», en vh desde que empieza el cruce:
 * al final de la salida, con la cámara ya casi quieta, a la vez que la
 * pantalla se desbloquea (`BLOQUEO_VH.desbloqueo`), para que el escenario
 * no se quede sin texto. Empieza cuando el reencuadre (`ENCUADRE_VH`) ya va
 * por la mitad: con los dos a la vez, el portátil, aún grande, rozaba el
 * titular mientras se apartaba.
 */
const TITULO_VH = [80, BOLSILLO_VH.cruce + NEGOCIO_VH.salida] as const;

/**
 * Cuándo lleva la cámara la pantalla del centro del escenario a su sitio en
 * el hueco del paso 1 (`[empieza, acaba]`, en vh desde que empieza el
 * cruce): se aleja recto, sin desplazarse, mientras se leen la hora y el
 * aviso, y solo al final, justo antes de que entre el texto, reencuadra (en
 * escritorio el hueco cae a la derecha del texto; en móvil, debajo). Si
 * reencuadrara desde el principio, la pantalla, aún enorme, se iría de lado
 * en vez de salir recta hacia la cámara.
 */
export const ENCUADRE_VH = [56, 100] as const;

/** Puntos del progreso (0–1) de «En tu negocio». */
export const NEGOCIO_P = {
  finCruce: BOLSILLO_VH.cruce / RECORRIDO_NEGOCIO,
  finSalida: (BOLSILLO_VH.cruce + NEGOCIO_VH.salida) / RECORRIDO_NEGOCIO,
  inicioTitulo: TITULO_VH[0] / RECORRIDO_NEGOCIO,
  finTitulo: TITULO_VH[1] / RECORRIDO_NEGOCIO,
} as const;

/**
 * El reloj del relevo: vh de scroll desde que empieza el cruce (que es donde
 * empieza «En tu negocio»). Sobre él van el corte, la pantalla de bloqueo y
 * el texto. Vale tanto para el progreso suavizado como para el crudo.
 */
export function vhDesdeElCruce(p: number): number {
  return p * RECORRIDO_NEGOCIO;
}

/**
 * El corte, en vh desde que empieza el cruce (`[empieza, acaba]`): primero
 * se enciende la pantalla HTML del portátil, negra, sobre el negro del
 * teléfono; y después, ya debajo de ella, el fondo del escenario y el
 * lienzo 3D. Lo primero siempre antes que lo segundo: si no, se vería el
 * fondo claro sobre el teléfono.
 */
export const CORTE_VH = {
  pantalla: [0.5, 1.5],
  escenario: [1.5, 3],
  /**
   * Por si el scroll suave va muy por detrás del real (una rueda rápida), el
   * corte se fuerza también sobre el scroll real a esta distancia del final
   * del cruce: lo que sea, antes de que «En tu bolsillo» se despegue.
   */
  reserva: 8,
} as const;

/**
 * Cuánto está ya encendida (0–1) una pieza de «En tu negocio» en el corte,
 * en su tramo de `CORTE_VH`: sobre el scroll suave y, de reserva, sobre el
 * real al final del cruce. Con el escenario de «En tu negocio» aún sin
 * pegar (crudo en 0, hacia arriba o hacia abajo), apagada: cuando se
 * despega, debajo está el teléfono cubriéndolo todo de negro.
 */
export function encendidoEnElCorte(
  vhSuave: number,
  vhCrudo: number,
  [empieza, acaba]: readonly [number, number]
): number {
  if (vhCrudo <= 0) return 0;
  const forzado = BOLSILLO_VH.cruce - CORTE_VH.reserva;
  return Math.max(
    tramo(vhSuave, empieza, acaba),
    tramo(vhCrudo, empieza + forzado, acaba + forzado)
  );
}

/**
 * Las dos curvas del relevo, de 0 a 1 sobre su tramo. La zambullida arranca
 * quieta y llega lanzada; la salida arranca lanzada y frena pronto, para que
 * la cámara esté casi quieta mientras se lee la pantalla de bloqueo. En el
 * corte las dos pendientes casan (la zambullida acaba a 3/zambullida por vh
 * en escala logarítmica, la salida arranca a 5/(cruce + salida)): el ojo
 * sigue un solo movimiento a través del negro.
 */
export const zambullida = (t: number) => t * t * t;
export const salida = (t: number) => 1 - Math.pow(1 - t, 5);

/**
 * Cuánto hay que ampliar el teléfono para que su pantalla cubra el
 * escenario, y cuánto más cerca de la pantalla del portátil ha de estar la
 * cámara para lo mismo: de sobra, para que las esquinas redondeadas y el
 * marco queden fuera de cuadro y un fotograma de desfase no enseñe nada. Al
 * portátil, más, porque su cámara ya se está alejando en el corte.
 */
export const HOLGURA_CUBRE = { telefono: 1.2, portatil: 1.3 } as const;

/** Un tamaño en px del escenario (o en cm, para la pantalla 3D). */
export type Tamano = { ancho: number; alto: number };

/**
 * Factor por el que hay que multiplicar `pantalla` (centrada en el
 * escenario) para que cubra `escenario` entero, con la holgura dada. Con la
 * pantalla en cm, sale el aumento en px por cm.
 */
export function aumentoQueCubre(
  pantalla: Tamano,
  escenario: Tamano,
  holgura: number
): number {
  return (
    holgura *
    Math.max(escenario.ancho / pantalla.ancho, escenario.alto / pantalla.alto)
  );
}

/**
 * Cuándo aparece cada cosa de la pantalla de bloqueo, en vh desde que
 * empieza el cruce (`[empieza, acaba]`): la hora en cuanto la pantalla del
 * portátil se ve casi entera, el aviso de WhatsApp de la cita nueva cuando
 * la cámara ya casi ha frenado, y el desbloqueo al final de la salida, con
 * tiempo de sobra para leerlo.
 */
export const BLOQUEO_VH = {
  reloj: [8, 20],
  avisos: [[26, 44]],
  desbloqueo: [76, 98],
} as const;

/**
 * La pantalla HTML del portátil (`.mx` de «En tu negocio»), en px CSS antes
 * de proyectarla.
 */
export const PANTALLA_HTML = { ancho: 1200, alto: 776 } as const;

const acotar = (v: number) => Math.min(1, Math.max(0, v));
/** Posición de `v` dentro del tramo [a, b], acotada a [0, 1]. */
const tramo = (v: number, a: number, b: number) => acotar((v - a) / (b - a));

let negocioEnEscena = false;

/**
 * «En tu negocio» avisa de que va con la escena 3D (no la versión quieta):
 * solo entonces «En tu bolsillo» zambulle el teléfono y deja que el portátil
 * lo releve. Sin escena, se despide como antes.
 */
export function marcarNegocioEnEscena(activo: boolean) {
  negocioEnEscena = activo;
}

export function hayNegocioEnEscena() {
  return negocioEnEscena;
}
