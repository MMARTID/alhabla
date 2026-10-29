"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  cubicBezier,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Check, Mic, Phone } from "lucide-react";
import { SiApple, SiGooglecalendar } from "@icons-pack/react-simple-icons";

import { MicrosoftLogo } from "@/components/brand-icons";
import type { NicheAccent } from "@/lib/niche-landings";
import {
  GUION_GENERAL,
  relato,
  type GuionRelato,
  type Relato,
} from "@/lib/relato-guiones";
import { useMovimientoReducido } from "@/hooks/use-movimiento-reducido";
import { marcarRelato } from "@/lib/relato-fijo";
import { escucharScrollSuave, progresoDe } from "@/lib/scroll-suave";
import {
  ALTO_BOLSILLO_VH,
  BOLSILLO_P,
  HOLGURA_CUBRE,
  aumentoQueCubre,
  hayNegocioEnEscena,
  zambullida,
} from "@/lib/transicion-bolsillo-negocio";
import styles from "./llamada-scroll.module.css";

/**
 * «En tu bolsillo» de la portada (2026-09-26; ancla #como-funciona, a la que
 * apunta el menú): una llamada de principio a fin
 * en tres pasos, con la misma mecánica scroll-driven que
 * el antiguo «Cómo funciona» — sección alta, escenario fijo y TODO lo que se
 * mueve colgado del progreso del scroll: el teléfono se balancea y se
 * acerca, la conversación y la agenda se van rellenando, y el texto de cada
 * paso suma sus detalles a la vez que la pantalla los enseña.
 *
 * Reglas (heredadas de «Cómo funciona» y de la revisión del 2026-09-26):
 * - La PRESENCIA de cada paso cambia de golpe en la costura (1/3 y 2/3),
 *   sobre el progreso crudo: nunca conviven dos textos ni dos pantallas, y
 *   la pantalla nunca se apaga — el contenido del paso nuevo ya está a la
 *   vista en la costura.
 * - Todo lo demás va sobre un muelle suave del mismo progreso. El teléfono
 *   usa además una curva de ida y vuelta (`suave`) con los extremos en las
 *   costuras, para que el cambio de pantalla caiga en el punto de giro.
 * - Un render plano aguanta ~12° de giro en Y sin delatarse: el resto del
 *   movimiento es deriva lateral, subida y una leve inclinación.
 * - Nada fuerza la posición del scroll salvo el clic en la barra de pasos.
 *
 * Desde el 2026-09-30 la sección no termina: al acabar el tercer paso el
 * teléfono se tumba en su sitio y se le apaga la pantalla (fase «Vuelco»); y
 * desde el 2026-10-22 se zambulle: se viene hacia la cámara hasta que su
 * pantalla negra lo cubre todo, y de ese negro sale, en «En tu negocio» (que
 * solapa a esta sección), la pantalla del portátil. El reparto de los tramos
 * y cómo se encuentran están en `lib/transicion-bolsillo-negocio.ts`.
 */

type PasoCopy = {
  numero: string;
  etiqueta: string;
  pantalla: string;
  titulo: string;
  texto: string;
  detalles: [string, string, string];
};

/** El copy de los tres pasos, con el vocabulario del sector del guion. */
function pasosDe(g: GuionRelato): [PasoCopy, PasoCopy, PasoCopy] {
  const { tuCliente, tusClientes, elCliente } = g.palabras;
  return [
    {
      numero: "01",
      etiqueta: "Contesta",
      pantalla: `Lo que oye ${tuCliente}`,
      titulo: "Si no puedes cogerlo, contesta Alhabla.",
      texto:
        g.pasos?.llamada[0] ??
        "Cuando no puedes coger el teléfono, la llamada salta a Alhabla tras unos tonos. Saluda con el nombre de tu negocio y atiende como lo haría tu recepción.",
      detalles: [
        `${tusClientes} marcan el número de siempre`,
        "A cualquier hora, también en festivos",
        "Resuelve dudas de servicios, duraciones y horarios con tus datos",
      ],
    },
    {
      numero: "02",
      etiqueta: "Busca hueco",
      pantalla: "Tu agenda",
      titulo: "Busca hueco en tu agenda.",
      texto:
        g.pasos?.llamada[1] ??
        "Antes de ofrecer una hora mira tu horario y tu agenda: tu calendario de Google, Outlook o iCloud, o la de Alhabla si no usas ninguno. Nunca te monta dos citas a la vez.",
      detalles: [
        "Cuenta lo que dura el servicio y descarta lo ocupado y los huecos cortos",
        "Elige al profesional adecuado; si la hora está ocupada, propone el siguiente hueco libre",
        `Ofrece la hora y solo reserva cuando ${elCliente} dice que sí`,
      ],
    },
    {
      numero: "03",
      etiqueta: "Confirma",
      pantalla: `El WhatsApp de ${tuCliente}`,
      titulo: "La cita entra y todos se enteran.",
      texto:
        g.pasos?.llamada[2] ??
        "Queda apuntada en tu agenda sin que hayas tenido que soltar lo que estabas haciendo.",
      detalles: [
        `Si ${elCliente} acepta, le llega la confirmación por WhatsApp`,
        "Si quieres, a ti también te avisa por WhatsApp",
        "En tu panel tienes la transcripción y, con permiso, la grabación",
      ],
    },
  ];
}

const COSTURA_1 = 1 / 3;
const COSTURA_2 = 2 / 3;
/** Momento en que aparece cada detalle del texto, paso a paso. */
const MOMENTOS: [number, number, number][] = [
  [0.04, 0.12, 0.2],
  [0.4, 0.47, 0.54],
  [0.68, 0.72, 0.76],
];
/** Al pulsar un paso en la barra se cae con todo ya a la vista. */
const ANCLAS = [0.3, 0.62, 0.88] as const;

/**
 * Los tres pasos ocupan el progreso 0→FIN_PASOS de la sección; de ahí a
 * FIN_VUELCO va el vuelco, hasta INICIO_CRUCE la zambullida y el resto es el
 * cruce con «En tu negocio». Todo lo de arriba (costuras, momentos, anclas)
 * va sobre el progreso de los pasos, que es el de antes estirado a 0→1.
 */
const {
  finPasos: FIN_PASOS,
  finVuelco: FIN_VUELCO,
  inicioCruce: INICIO_CRUCE,
} = BOLSILLO_P;
/**
 * El cuerpo del teléfono dentro de su imagen (public/telefono/frente.svg),
 * sin los botones ni el margen transparente: alto como fracción del alto del
 * elemento (tumbado, es el ancho de la silueta).
 */
const CUERPO_ALTO = 2704 / 2859;
/**
 * La pantalla del teléfono (`.hueco`, ver el CSS) como fracción del ancho y
 * del alto del elemento: es lo que tiene que cubrir el escenario al final de
 * la zambullida.
 */
const HUECO = { ancho: 0.892, alto: 0.911 } as const;
/**
 * El giro en Y de la zambullida, en grados: el teléfono se ladea un poco al
 * arrancar y se endereza al llegar, para que el acercamiento tenga volumen y
 * no sea un simple aumento.
 */
const LADEO_ZAMBULLIDA = 7;
/**
 * Tumbado, la silueta del teléfono mide esto por el alto que tenía de pie:
 * crece un poco, para que la cámara de «En tu negocio» tenga de dónde
 * alejarse. En móvil, todo el ancho de la pantalla menos el margen.
 */
const CRECE_TUMBADO = 1.2;
/** Margen mínimo, en px, entre el teléfono tumbado y el borde del escenario. */
const MARGEN_TUMBADO = 32;

/** Ida y vuelta para movimiento en pantalla (ease-in-out fuerte). */
const suave = cubicBezier(0.65, 0, 0.35, 1);
/** Ease-in-out cúbico, el del vuelco. */
const cubico = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const acotar = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
/** Posición de `v` dentro del tramo [a, b], acotada a [0, 1]. */
const tramo = (v: number, a: number, b: number) => acotar((v - a) / (b - a));

/** Aparece en [a, a + d] subiendo un poco: opacidad y desplazamiento. */
function useAparece(p: MotionValue<number>, a: number, d = 0.03, desde = 10) {
  const opacity = useTransform(p, [a, a + d], [0, 1]);
  const y = useTransform(p, [a, a + d], [desde, 0]);
  return { opacity, y };
}

function useEsMovil() {
  const [movil, setMovil] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const cambiar = () => setMovil(mq.matches);
    cambiar();
    mq.addEventListener("change", cambiar);
    return () => mq.removeEventListener("change", cambiar);
  }, []);
  return movil;
}

/**
 * Color del sector en la sección (antetítulo, riel de pasos, iconos, brillo):
 * el de su landing, o el morado de marca en la portada. Las pantallas del
 * teléfono son las de Alhabla y no cambian de color.
 */
/**
 * El acento del sector también tiñe lo que pasa dentro del iPhone: la
 * pantalla de llamada, las burbujas de Alhabla (con `deep`, que con texto
 * blanco pasa AA en los ocho), la onda y la cita nueva. Sin acento (la
 * portada), cada variable cae en su morado de siempre.
 */
function estiloAcento(acento?: NicheAccent): CSSProperties | undefined {
  if (!acento) return undefined;
  return {
    "--acento": acento.strong,
    "--acento-tinta": acento.deep,
    "--acento-suave": acento.soft,
    "--acento-burbuja": acento.deep,
    "--acento-claro": `color-mix(in srgb, ${acento.strong} 65%, #ffffff)`,
    "--llamada-fondo": `color-mix(in srgb, ${acento.strong} 45%, #0a0a0a)`,
    "--llamada-fondo-2": `color-mix(in srgb, ${acento.strong} 18%, #0a0a0a)`,
  } as CSSProperties;
}

export function LlamadaScroll({
  guion = GUION_GENERAL,
  acento,
  antetitulo = true,
}: {
  guion?: GuionRelato;
  acento?: NicheAccent;
  /** «En tu bolsillo» encima de los pasos. En las landings de sector lo
   * sustituye la pregunta de la dueña que abre la escena: queda solo para
   * lectores de pantalla. */
  antetitulo?: boolean;
}) {
  const pasos = useMemo(() => pasosDe(guion), [guion]);
  const r = useMemo(() => relato(guion), [guion]);
  // Con movimiento reducido, la versión quieta llega tras montar: el servidor
  // no sabe la preferencia y pinta el escenario (ver useMovimientoReducido).
  const reducir = useMovimientoReducido();
  const movil = useEsMovil();
  const seccion = useRef<HTMLElement>(null);
  const escenario = useRef<HTMLDivElement>(null);
  const columnaTelefono = useRef<HTMLDivElement>(null);
  const telefono = useRef<HTMLDivElement>(null);
  const [paso, setPaso] = useState(0);
  const { scrollYProgress: p } = useScroll({
    target: seccion,
    offset: ["start start", "end end"],
  });
  // El progreso suavizado: el del scroll suave compartido con «En tu
  // negocio» (ver lib/scroll-suave.ts), para que en el relevo las dos
  // secciones se muevan como una sola pieza.
  const s = useMotionValue(0);
  useEffect(() => {
    const el = seccion.current;
    if (!el) return;
    return escucharScrollSuave((y) => s.set(progresoDe(el, y)));
  }, [reducir, s]);
  // El progreso de los tres pasos (0→FIN_PASOS estirado a 0→1), crudo y
  // suavizado: es lo que ven las costuras, las pantallas y los textos.
  const pp = useTransform(p, (v) => Math.min(1, v / FIN_PASOS));
  const sp = useTransform(s, (v) => Math.min(1, v / FIN_PASOS));
  /**
   * La salida del escenario, solo cuando «En tu negocio» no lo releva (sin
   * WebGL o sin modelo, esa sección va quieta y no solapa a esta).
   *
   * `p` llega a 1 justo cuando el escenario deja de estar pegado, y a partir
   * de ahí queda todavía una pantalla entera de scroll en la que el escenario
   * se va hacia arriba: es como funciona `position: sticky`, no se puede
   * quitar. Para que no parezca una avería, ese tramo es una despedida: el
   * escenario se desvanece y sube un poco mientras entra la sección
   * siguiente. Con la escena 3D delante no hace falta: el cruce acaba con el
   * escenario aún fijo y el de «En tu negocio» encima.
   */
  const { scrollYProgress: salida } = useScroll({
    target: seccion,
    offset: ["end end", "end start"],
  });
  const opacidadSalida = useTransform(salida, (v) =>
    hayNegocioEnEscena() ? 1 : 1 - tramo(v, 0, 0.55)
  );
  const ySalida = useTransform(salida, (v) =>
    hayNegocioEnEscena() ? 0 : -64 * v
  );

  useMotionValueEvent(pp, "change", (v) => {
    const siguiente = v >= COSTURA_2 ? 2 : v >= COSTURA_1 ? 1 : 0;
    setPaso((actual) => (actual === siguiente ? actual : siguiente));
  });

  // Presencia discreta en las costuras, sobre el progreso crudo.
  const vis1 = useTransform(
    pp,
    [0, COSTURA_1 - 0.001, COSTURA_1, 1],
    ["visible", "visible", "hidden", "hidden"]
  );
  const vis2 = useTransform(
    pp,
    [0, COSTURA_1 - 0.001, COSTURA_1, COSTURA_2 - 0.001, COSTURA_2, 1],
    ["hidden", "hidden", "visible", "visible", "hidden", "hidden"]
  );
  const vis3 = useTransform(
    pp,
    [0, COSTURA_2 - 0.001, COSTURA_2, 1],
    ["hidden", "hidden", "visible", "visible"]
  );

  // El texto de cada paso sale hacia arriba y el siguiente entra desde abajo.
  const copy1Y = useTransform(sp, [0.3, COSTURA_1], [0, -20]);
  const copy2Y = useTransform(
    sp,
    [COSTURA_1, 0.36, 0.64, COSTURA_2],
    [20, 0, 0, -20]
  );
  const copy3Y = useTransform(sp, [COSTURA_2, 0.69], [20, 0]);

  // El teléfono se balancea durante todo el recorrido. En móvil, con menos
  // amplitud: allí el teléfono llena su hueco y no puede irse lejos.
  const k = movil ? 0.45 : 1;
  const giroY = useTransform(
    sp,
    [0, 0.08, COSTURA_1, COSTURA_2, 0.95, 1],
    [-12, -6, 9, -9, 4, 4].map((v) => v * k),
    { ease: suave }
  );
  const giroX = useTransform(sp, [0, 0.08, 1], [6 * k, 3 * k, 3 * k]);
  const deriva = useTransform(
    sp,
    [0, COSTURA_1, COSTURA_2, 1],
    [-18, 14, -14, 0].map((v) => v * k),
    { ease: suave }
  );
  const subida = useTransform(
    sp,
    [0, COSTURA_1, COSTURA_2, 1],
    [0, -10, -2, -12].map((v) => v * k),
    { ease: suave }
  );
  const inclina = useTransform(
    sp,
    [0, COSTURA_1, COSTURA_2, 1],
    [-1.5, 1.2, -1.2, 0].map((v) => v * k),
    { ease: suave }
  );
  // Paso 2: se acerca al hueco mientras el buscador recorre la agenda.
  const zoom = useTransform(
    sp,
    [0.43, 0.48, 0.56, 0.61],
    [1, movil ? 1.06 : 1.16, movil ? 1.06 : 1.16, 1],
    { ease: suave }
  );

  /**
   * Vuelco (FIN_PASOS→FIN_VUELCO): el teléfono se tumba a −90° casi en su
   * sitio, crece un poco y queda apaisado (ver `medir`), que es donde «En tu
   * negocio» pondrá la pantalla del portátil.
   * Los giros en 3D se apagan, con un balanceo leve en Y a mitad de camino.
   * En la segunda mitad del giro su pantalla se apaga: negra, como la del
   * portátil que lo releva. Todo con easing cúbico, sobre el muelle.
   */
  const tVuelco = useTransform(s, [FIN_PASOS, FIN_VUELCO], [0, 1]);
  const tv = useTransform(tVuelco, cubico);
  // Dónde y a qué escala acaba el teléfono tumbado: depende del layout, se
  // mide (ver `medir`).
  const xFinal = useMotionValue(0);
  const yFinal = useMotionValue(0);
  const escalaFinal = useMotionValue(1);
  /**
   * Zambullida (FIN_VUELCO→INICIO_CRUCE): el teléfono tumbado se va al
   * centro del escenario y se viene hacia la cámara acelerando (la curva
   * `zambullida`, en escala logarítmica para que el crecimiento sea parejo)
   * hasta que su pantalla negra cubre el escenario entero y de sobra: el
   * marco sale de cuadro y solo queda negro, que es donde «En tu negocio»
   * hace el corte a la pantalla de su portátil. Por el camino se ladea un
   * poco en Y y se endereza al llegar. Cuánto ampliar y a dónde ir dependen
   * del layout, se miden (ver `medir`). Solo transform: nada de animar
   * tamaño o posición, y nada se desenfoca porque lo único a la vista es
   * negro. Sin escena 3D no hay relevo: el teléfono se queda tumbado.
   */
  const tZambullida = useTransform(s, [FIN_VUELCO, INICIO_CRUCE], [0, 1]);
  const tz = useTransform(tZambullida, (t) =>
    hayNegocioEnEscena() ? zambullida(t) : 0
  );
  const lnCubre = useMotionValue(0);
  const xCentro = useMotionValue(0);
  const yCentro = useMotionValue(0);
  const ladeo = useTransform([tZambullida, tz], ([t, d]: number[]) =>
    d > 0 ? -LADEO_ZAMBULLIDA * Math.sin(Math.PI * t) : 0
  );
  const rotateY = useTransform(
    [giroY, tv, ladeo],
    ([g, t, l]: number[]) => g * (1 - t) - 8 * Math.sin(Math.PI * t) + l
  );
  const rotateX = useTransform([giroX, tv], ([g, t]: number[]) => g * (1 - t));
  const rotate = useTransform([inclina, tv], ([r, t]: number[]) => r - 90 * t);
  // A mitad del giro el teléfono encoge un poco: en diagonal es más ancho y
  // así no se mete en la columna del texto mientras este se va.
  const scale = useTransform(
    [zoom, tv, escalaFinal, tz, lnCubre],
    ([z, t, ef, d, ln]: number[]) =>
      z *
      (1 + (ef - 1) * t) *
      (1 - 0.08 * Math.sin(Math.PI * t)) *
      Math.exp(ln * d)
  );
  const x = useTransform(
    [deriva, tv, xFinal, tz, xCentro],
    ([dr, t, xf, d, xc]: number[]) => dr * (1 - t) + xf * t + (xc - xf) * d
  );
  const y = useTransform(
    [subida, tv, yFinal, tz, yCentro],
    ([sb, t, yf, d, yc]: number[]) => sb * (1 - t) + yf * t + (yc - yf) * d
  );
  const originY = useTransform(tVuelco, [0, 0.25], [0.36, 0.5]);
  // El texto, el rótulo y la barra de pasos se van mientras el teléfono
  // empieza a girar; la sombra del teléfono también.
  const opacidadTexto = useTransform(tVuelco, [0.05, 0.4], [1, 0]);
  const yTexto = useTransform(tVuelco, [0.05, 0.4], [0, -24]);
  const visTexto = useTransform(tVuelco, (t) =>
    t >= 0.4 ? "hidden" : "visible"
  );
  const pantallaApagada = useTransform(tVuelco, [0.4, 0.95], [0, 1]);
  // La sombra acompaña: se estrecha al girar y se aclara al subir.
  const sombraX = useTransform(giroY, (v) => 1 - Math.abs(v) / 60);
  const sombraO = useTransform(
    [subida, tVuelco],
    ([sb, t]: number[]) =>
      (1 - 0.2 * tramo(sb, 0, -14)) * (1 - tramo(t, 0, 0.3))
  );

  // Riel de pasos (vertical, a la izquierda del texto): cada tramo se llena
  // con su parte del progreso suavizado.
  const barra1 = useTransform(sp, [0, COSTURA_1], [0, 1]);
  const barra2 = useTransform(sp, [COSTURA_1, COSTURA_2], [0, 1]);
  const barra3 = useTransform(sp, [COSTURA_2, 1], [0, 1]);

  /**
   * Mide dónde descansa el teléfono dentro del escenario (que, pegado, ocupa
   * la pantalla) y calcula dónde y a qué escala queda tumbado: centrado en
   * alto en el escenario (bajo la cabecera), con su silueta apaisada
   * CRECE_TUMBADO veces su alto de pie y, en escritorio, tan centrado en su
   * columna como quepa sin salirse; en móvil y tableta, en el centro (allí el
   * teléfono de pie va abajo, bajo el texto, y tumbado ahí dejaba media
   * pantalla vacía). Y la zambullida: cuánto más hay que ampliarlo, ya
   * tumbado y en el centro del escenario, para que su pantalla lo cubra
   * entero. Se repite al cambiar el tamaño de algo.
   */
  useEffect(() => {
    const esc = escenario.current;
    const col = columnaTelefono.current;
    const tel = telefono.current;
    if (!esc || !col || !tel) return;
    const medir = () => {
      const ancho = esc.clientWidth;
      const alto = esc.clientHeight;
      const h = tel.offsetHeight;
      const w = tel.offsetWidth;
      const centroX = col.offsetLeft + tel.offsetLeft + w / 2;
      const centroY = col.offsetTop + tel.offsetTop + h / 2;
      const escritorio = window.innerWidth >= 1024;
      const cabe = Math.max(0, ancho - 2 * MARGEN_TUMBADO);
      const silueta = escritorio
        ? Math.min(cabe, CRECE_TUMBADO * CUERPO_ALTO * h)
        : cabe;
      const e = h > 0 ? silueta / (CUERPO_ALTO * h) : 1;
      const x = escritorio
        ? Math.max(
            MARGEN_TUMBADO + silueta / 2,
            Math.min(centroX, ancho - MARGEN_TUMBADO - silueta / 2)
          )
        : ancho / 2;
      // El centro del hueco que deja la cabecera (el padding de arriba del
      // escenario) y el margen de abajo.
      const estilo = getComputedStyle(esc);
      const yTumbado =
        (parseFloat(estilo.paddingTop) +
          alto -
          parseFloat(estilo.paddingBottom)) /
        2;
      xFinal.set(x - centroX);
      yFinal.set(yTumbado - centroY);
      escalaFinal.set(e);
      // La pantalla tumbada, en px del escenario (su alto de pie es el ancho
      // tumbado), y lo que hay que ampliarla, en logaritmo, para cubrir el
      // escenario entero (la cabecera queda encima, da igual) desde su centro.
      const pantalla = { ancho: HUECO.alto * h * e, alto: HUECO.ancho * w * e };
      lnCubre.set(
        h > 0 && w > 0
          ? Math.log(
              aumentoQueCubre(pantalla, { ancho, alto }, HOLGURA_CUBRE.telefono)
            )
          : 0
      );
      xCentro.set(ancho / 2 - centroX);
      yCentro.set(alto / 2 - centroY);
    };
    const observador = new ResizeObserver(medir);
    observador.observe(esc);
    observador.observe(col);
    observador.observe(tel);
    medir();
    return () => observador.disconnect();
  }, [reducir, xFinal, yFinal, escalaFinal, lnCubre, xCentro, yCentro]);

  // Mientras el escenario está fijo, el botón de «Configurar cookies» se
  // esconde (tapaba la barra de pasos en móvil). Ver lib/relato-fijo.ts.
  useEffect(() => {
    const el = seccion.current;
    if (!el) return;
    return marcarRelato(el);
  }, [reducir]);

  const irA = useCallback(
    (i: number) => {
      const el = seccion.current;
      if (!el) return;
      const recorrido = el.offsetHeight - window.innerHeight;
      const top =
        window.scrollY +
        el.getBoundingClientRect().top +
        recorrido * ANCLAS[i] * FIN_PASOS;
      window.scrollTo({ top, behavior: reducir ? "auto" : "smooth" });
    },
    [reducir]
  );

  if (reducir) return <VersionQuieta pasos={pasos} acento={acento} />;

  return (
    <section
      ref={seccion}
      id="como-funciona"
      className={styles.seccion}
      style={{ height: `${ALTO_BOLSILLO_VH}vh`, ...estiloAcento(acento) }}
      aria-labelledby="llamada-titulo"
    >
      <motion.div
        ref={escenario}
        className={styles.escenario}
        style={{ opacity: opacidadSalida, y: ySalida }}
      >
        <div className={styles.rejilla}>
          <motion.div
            className={styles.columnaTexto}
            style={{ opacity: opacidadTexto, y: yTexto, visibility: visTexto }}
          >
            <h2
              id="llamada-titulo"
              className={antetitulo ? styles.antetitulo : "sr-only"}
            >
              En tu bolsillo
            </h2>
            <div className={styles.copias} aria-hidden="true">
              <Copia
                paso={pasos[0]}
                y={copy1Y}
                visibility={vis1}
                p={sp}
                momentos={MOMENTOS[0]}
              />
              <Copia
                paso={pasos[1]}
                y={copy2Y}
                visibility={vis2}
                p={sp}
                momentos={MOMENTOS[1]}
              />
              <Copia
                paso={pasos[2]}
                y={copy3Y}
                visibility={vis3}
                p={sp}
                momentos={MOMENTOS[2]}
              />
            </div>
            <nav className={styles.barraPasos} aria-label="Pasos de la llamada">
              {[barra1, barra2, barra3].map((relleno, i) => (
                <button
                  key={pasos[i].numero}
                  type="button"
                  onClick={() => irA(i)}
                  aria-current={paso === i ? "step" : undefined}
                  aria-label={`Ir al paso ${pasos[i].numero}: ${pasos[i].etiqueta}`}
                  className={styles.botonPaso}
                >
                  <span className={styles.pista}>
                    <motion.span
                      className={styles.relleno}
                      style={{ scaleY: relleno }}
                    />
                  </span>
                </button>
              ))}
            </nav>
          </motion.div>

          <div
            ref={columnaTelefono}
            className={styles.columnaTelefono}
            aria-hidden="true"
          >
            <motion.span
              className={styles.brillo}
              style={{ opacity: opacidadTexto }}
            />
            <motion.p
              className={styles.rotulo}
              style={{ opacity: opacidadTexto, y: yTexto }}
            >
              <motion.span style={{ visibility: vis1 }}>
                {pasos[0].pantalla}
              </motion.span>
              <motion.span style={{ visibility: vis2 }}>
                {pasos[1].pantalla}
              </motion.span>
              <motion.span style={{ visibility: vis3 }}>
                {pasos[2].pantalla}
              </motion.span>
            </motion.p>
            <motion.div
              ref={telefono}
              className={styles.telefono}
              style={{
                x,
                y,
                rotateY,
                rotateX,
                rotate,
                scale,
                originY,
                transformPerspective: 1400,
              }}
            >
              <motion.div
                className={styles.sombra}
                style={{ scaleX: sombraX, opacity: sombraO }}
              />
              <div className={styles.hueco}>
                <span className={styles.isla} />
                <motion.div
                  className={styles.capa}
                  style={{ visibility: vis1 }}
                >
                  <Estado oscuro />
                  <PantallaLlamada
                    p={sp}
                    r={r}
                    cliente={guion.cliente.nombre}
                  />
                </motion.div>
                <motion.div
                  className={styles.capa}
                  style={{ visibility: vis2 }}
                >
                  <Estado oscuro={false} />
                  <PantallaAgenda p={sp} r={r} guion={guion} />
                </motion.div>
                <motion.div
                  className={styles.capa}
                  style={{ visibility: vis3 }}
                >
                  <Estado oscuro={false} />
                  <PantallaWhatsApp p={sp} r={r} guion={guion} />
                </motion.div>
                <motion.div
                  className={styles.apagada}
                  style={{ opacity: pantallaApagada }}
                />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- render local, el marco del teléfono */}
              <img
                src="/telefono/frente.svg"
                alt=""
                className={styles.marco}
                width={1335}
                height={2859}
              />
            </motion.div>
            {/* Móvil: el teléfono se corta por abajo con un degradado, que se
                va con el texto al empezar el vuelco. */}
            <motion.div
              className={styles.velo}
              style={{ opacity: opacidadTexto }}
            />
          </div>
        </div>
      </motion.div>

      <ol className="sr-only">
        {pasos.map((pc) => (
          <li key={pc.numero}>
            <strong>{pc.titulo}</strong> {pc.texto} {pc.detalles.join(". ")}.
          </li>
        ))}
      </ol>
    </section>
  );
}

function Copia({
  paso,
  y,
  visibility,
  p,
  momentos,
}: {
  paso: PasoCopy;
  y: MotionValue<number>;
  visibility: MotionValue<string>;
  p: MotionValue<number>;
  momentos: [number, number, number];
}) {
  return (
    <motion.div className={styles.copia} style={{ y, visibility }}>
      <p className={styles.numero}>
        {paso.numero} · {paso.etiqueta}
      </p>
      <h3 className={styles.titulo}>{paso.titulo}</h3>
      <p className={styles.texto}>{paso.texto}</p>
      <ul className={styles.detalles}>
        {paso.detalles.map((d, i) => (
          <Detalle key={d} p={p} a={momentos[i]}>
            {d}
          </Detalle>
        ))}
      </ul>
    </motion.div>
  );
}

function Detalle({
  p,
  a,
  children,
}: {
  p: MotionValue<number>;
  a: number;
  children: ReactNode;
}) {
  const { opacity, y } = useAparece(p, a, 0.03, 8);
  return (
    <motion.li className={styles.detalle} style={{ opacity, y }}>
      <Check className={styles.detalleIcono} aria-hidden="true" />
      <span>{children}</span>
    </motion.li>
  );
}

/* ── Pantallas ───────────────────────────────────────────────────── */

function Estado({ oscuro }: { oscuro: boolean }) {
  return (
    <div
      className={styles.estado}
      style={{ color: oscuro ? "#fff" : "#0a0a0a" }}
    >
      <span>17:02</span>
      <span>5G</span>
    </div>
  );
}

function Aparece({
  p,
  a,
  className,
  children,
}: {
  p: MotionValue<number>;
  a: number;
  className?: string;
  children: ReactNode;
}) {
  const { opacity, y } = useAparece(p, a, 0.025, 12);
  return (
    <motion.div className={className} style={{ opacity, y }}>
      {children}
    </motion.div>
  );
}

const ONDA = [0.3, 0.55, 0.8, 0.45, 0.95, 0.6, 0.35, 0.7, 0.5, 0.25, 0.65, 0.4];

function BarraOnda({
  p,
  i,
  base,
}: {
  p: MotionValue<number>;
  i: number;
  base: number;
}) {
  // La onda «habla» con el scroll mientras dura la conversación.
  const escala = useTransform(p, (v) =>
    v < 0.05 || v > 0.3
      ? base * 0.35
      : 0.25 + 0.75 * Math.abs(Math.sin(v * 140 + i * 0.9)) * base
  );
  return <motion.span style={{ scaleY: escala }} />;
}

function PantallaLlamada({
  p,
  r,
  cliente,
}: {
  p: MotionValue<number>;
  r: Relato;
  cliente: string;
}) {
  // Antes de descolgar: «Llamada entrante». Después, el contador corre con
  // el scroll.
  const entrante = useTransform(p, [0, 0.025, 0.03], [1, 1, 0]);
  const enCurso = useTransform(p, [0.025, 0.03], [0, 1]);
  const contador = useTransform(p, [0.03, COSTURA_1], [0, 48], { clamp: true });
  const reloj = useTransform(
    contador,
    (v) => `Alhabla · 00:${String(Math.round(v)).padStart(2, "0")}`
  );

  return (
    <div className={`${styles.pantalla} ${styles.llamada}`}>
      <div className={styles.llamante}>
        <p className={styles.llamanteNombre}>{cliente}</p>
        <div className={styles.llamanteDatoCaja}>
          <motion.p
            className={styles.llamanteDato}
            style={{ opacity: entrante }}
          >
            Llamada entrante…
          </motion.p>
          <motion.p
            className={styles.llamanteDato}
            style={{ opacity: enCurso }}
          >
            {reloj}
          </motion.p>
        </div>
      </div>
      <div className={styles.transcripcion}>
        <Aparece
          p={p}
          a={0.05}
          className={`${styles.burbuja} ${styles.burbujaAlhabla}`}
        >
          <span className={styles.quien}>Alhabla</span>
          {r.saludo}
        </Aparece>
        <Aparece
          p={p}
          a={0.1}
          className={`${styles.burbuja} ${styles.burbujaCliente}`}
        >
          <span className={styles.quien}>{cliente}</span>
          {r.pide}
        </Aparece>
        <Aparece
          p={p}
          a={0.17}
          className={`${styles.burbuja} ${styles.burbujaAlhabla}`}
        >
          <span className={styles.quien}>Alhabla</span>
          {r.ofrece}
        </Aparece>
        <Aparece
          p={p}
          a={0.24}
          className={`${styles.burbuja} ${styles.burbujaCliente}`}
        >
          <span className={styles.quien}>{cliente}</span>
          {r.franja}
        </Aparece>
      </div>
      <div className={styles.onda}>
        {ONDA.map((base, i) => (
          <BarraOnda key={i} p={p} i={i} base={base} />
        ))}
      </div>
      <span className={styles.colgar}>
        <Phone color="#fff" strokeWidth={2.4} />
      </span>
    </div>
  );
}

/** La fila que sirve y el momento en que el buscador pasa por cada una. */
const LIBRE = 3;
const REVISA = [0.43, 0.455, 0.48, 0.505] as const;

function PantallaAgenda({
  p,
  r,
  guion,
}: {
  p: MotionValue<number>;
  r: Relato;
  guion: GuionRelato;
}) {
  // El marcador baja fila a fila; las que no valen se apagan al pasar.
  const marcadorY = useTransform(
    p,
    [0.41, ...REVISA],
    ["0%", "0%", "100%", "200%", "300%"]
  );
  const marcador = useTransform(p, [0.41, 0.43, 0.5, 0.515], [0, 1, 1, 0]);
  // «Libre» se va y «Nueva» entra sin cruzarse: nunca dos textos a la vez.
  const libre = useTransform(p, [0.51, 0.511], [1, 0]);
  const reservada = useTransform(p, [0.512, 0.53], [0, 1]);
  const reservadaEscala = useTransform(p, [0.512, 0.54], [0.94, 1]);

  return (
    <div className={`${styles.pantalla} ${styles.agenda}`}>
      <Aparece p={p} a={0.336} className={styles.buscando}>
        <span className={styles.buscandoEtiqueta}>Buscando hueco · mañana</span>
        <span className={styles.buscandoServicio}>
          {guion.servicio.nombre} · {guion.servicio.minutos} min
        </span>
      </Aparece>
      <div className={styles.franjas}>
        <motion.span
          className={styles.marcador}
          style={{ y: marcadorY, opacity: marcador }}
        />
        {r.agenda.map((fila, i) => (
          <Fila key={fila.hora} p={p} i={i}>
            <span className={styles.franjaHora}>{fila.hora}</span>
            {i === LIBRE ? (
              <span className={styles.celda}>
                <motion.span className={styles.cita} style={{ opacity: libre }}>
                  <span className={styles.citaTitulo}>{fila.titulo}</span>
                  {fila.detalle}
                </motion.span>
                <motion.span
                  className={styles.citaNueva}
                  style={{ opacity: reservada, scale: reservadaEscala }}
                >
                  <span className={styles.etiquetaNueva}>Nueva</span>
                  <span className={styles.citaTitulo}>
                    {guion.servicio.nombre}
                  </span>
                  {guion.cliente.nombre} · con {guion.profesional}
                </motion.span>
              </span>
            ) : (
              <span className={styles.cita}>
                <span className={styles.citaTitulo}>{fila.titulo}</span>
                {fila.detalle}
              </span>
            )}
          </Fila>
        ))}
      </div>
      <Aparece p={p} a={0.55} className={styles.calendarios}>
        <SiGooglecalendar color="default" />
        <MicrosoftLogo />
        <SiApple color="#0a0a0a" />
        <span>Guardada en tu calendario</span>
      </Aparece>
    </div>
  );
}

function Fila({
  p,
  i,
  children,
}: {
  p: MotionValue<number>;
  i: number;
  children: ReactNode;
}) {
  const { opacity, y } = useAparece(p, 0.338 + i * 0.008, 0.02, 10);
  // Las filas que el buscador descarta se apagan al pasar por ellas.
  const revisa: number | undefined = REVISA[i];
  const apagado = useTransform(
    p,
    revisa === undefined ? [0, 1] : [revisa, revisa + 0.01],
    revisa === undefined || i === LIBRE ? [1, 1] : [1, 0.45]
  );
  const opacidad = useTransform(
    [opacity, apagado],
    ([a, b]: number[]) => a * b
  );
  return (
    <motion.div className={styles.franja} style={{ opacity: opacidad, y }}>
      {children}
    </motion.div>
  );
}

function PantallaWhatsApp({
  p,
  r,
  guion,
}: {
  p: MotionValue<number>;
  r: Relato;
  guion: GuionRelato;
}) {
  return (
    <div className={`${styles.pantalla} ${styles.whatsapp}`}>
      <div className={styles.waCabecera}>
        <span className={styles.waAvatar}>
          {/* eslint-disable-next-line @next/next/no-img-element -- isotipo local */}
          <img
            src="/brand/alhabla-isotipo.svg"
            alt=""
            className={styles.waLogo}
          />
        </span>
        <div>
          <p className={styles.waNombre}>Alhabla Reservas</p>
          <p className={styles.waSub}>Cuenta de empresa</p>
        </div>
      </div>
      <div className={styles.waChat}>
        <Aparece p={p} a={0.668} className={styles.waFecha}>
          Hoy
        </Aparece>
        <Aparece p={p} a={0.672} className={styles.waMensaje}>
          Hola, {guion.cliente.nombre}. Tu cita está confirmada:
          <br />
          <strong>{guion.servicio.nombre}</strong>
          <br />
          {r.cita}
          <br />
          {guion.negocio}
          <span className={styles.waHora}>17:03</span>
        </Aparece>
        <Aparece
          p={p}
          a={0.75}
          className={`${styles.waMensaje} ${styles.waMio}`}
        >
          ¡Genial, gracias!
          <span className={styles.waHora}>17:04 ✓✓</span>
        </Aparece>
      </div>
      <div className={styles.waEscribir}>
        <span className={styles.waCaja}>Mensaje</span>
        <span className={styles.waMicro}>
          <Mic color="#fff" strokeWidth={2.4} />
        </span>
      </div>
    </div>
  );
}

/** Movimiento reducido: los tres pasos a la vista, sin escenario fijo. */
function VersionQuieta({
  pasos,
  acento,
}: {
  pasos: PasoCopy[];
  acento?: NicheAccent;
}) {
  return (
    <section
      id="como-funciona"
      className="border-y border-[#e5e5e5] bg-[#fafafa] py-16 sm:py-24"
      style={estiloAcento(acento)}
      aria-labelledby="llamada-titulo-quieta"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2
          id="llamada-titulo-quieta"
          className="max-w-3xl text-3xl font-black tracking-tight text-[#0a0a0a] sm:text-4xl"
        >
          En tu bolsillo: una llamada, de principio a fin.
        </h2>
        <ol className="mt-10 grid gap-5 lg:grid-cols-3">
          {pasos.map((pc) => (
            <li
              key={pc.numero}
              className="rounded-3xl border border-[#e5e5e5] bg-white p-7"
            >
              <p className="text-sm font-bold text-[var(--acento-tinta,#6d28d9)]">
                {pc.numero} · {pc.etiqueta}
              </p>
              <h3 className="mt-4 text-xl font-bold tracking-tight text-[#0a0a0a]">
                {pc.titulo}
              </h3>
              <p className="mt-2 text-base leading-7 text-[#52525b]">
                {pc.texto}
              </p>
              <ul className="mt-4 space-y-2">
                {pc.detalles.map((d) => (
                  <li
                    key={d}
                    className="flex items-start gap-2 text-sm leading-6 text-[#27272a]"
                  >
                    <Check
                      className="mt-1 h-4 w-4 shrink-0 text-[var(--acento,#8b5cf6)]"
                      aria-hidden="true"
                    />
                    {d}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
