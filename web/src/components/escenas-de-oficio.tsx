"use client";

import Link from "next/link";
import { ArrowRight, Check, PhoneCall } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Reveal } from "@/components/scroll-reveal";
import {
  ESCENAS_DE_OFICIO,
  enFrase,
  type EscenaDeOficio,
} from "@/lib/escenas-de-oficio";
import { NICHE_ACCENTS } from "@/lib/niche-accents";
import styles from "./escenas-de-oficio.module.css";

/**
 * «Elige tu oficio y mira la llamada que entra.»: los ocho sectores de la
 * portada, cada uno como el segundo en que suena el teléfono en ese oficio
 * y la cita que sale de la llamada. Sustituye al acordeón de fotos de banco
 * (30-10-2026: al fundador no le gustaban las fotos). Es producto dibujado,
 * con el vocabulario del relato de arriba: la burbuja de quien llama y la
 * ficha de la agenda en el color del sector.
 *
 * Rejilla de 4 × 2 desde lg (en 1024 la tarjeta se estrecha y la hora pasa
 * encima de la cita: consulta de contenedor en el CSS), de 2 columnas desde
 * md y, en el móvil, un carrusel de scroll nativo con anclaje, que enseña
 * una escena entera y asoma la siguiente.
 *
 * Cada tarjeta lleva a su landing. Con ratón, la tarjeta entera es el
 * enlace y al pasar por encima sube el cajón (el detalle y «Ver …»); en
 * táctil, la escena que queda en el centro de la pantalla se abre sola a los
 * tres segundos y un toque abre o cierra, y el enlace es el del cajón; con
 * teclado, se abre al llegar a ese enlace. El cajón está siempre en el DOM.
 *
 * El movimiento (CSS, en escenas-de-oficio.module.css) solo lo arranca este
 * componente: las tarjetas que no se ven al cargar pasan a «espera» y
 * suenan una vez al entrar en pantalla. El HTML del servidor sale resuelto.
 */

type Fase = "hecha" | "espera" | "suena";
type Momento = { fase: Fase; retraso: number };

/** Entre una tarjeta y la siguiente que suenan a la vez. */
const ESCALONADO_MS = 110;
/** Lo menos que mide el hilo (su `flex-basis` en el CSS). */
const HILO_MINIMO_PX = 16;
/** Lo que espera la escena del centro, en táctil, antes de abrirse sola:
 * el timbre ya ha terminado y ha dado tiempo a leerla. */
const ABRIR_SOLA_MS = 3000;

export function EscenasDeOficio() {
  const tarjetas = useRef<(HTMLLIElement | null)[]>([]);
  const [momentos, setMomentos] = useState<Momento[]>(() =>
    ESCENAS_DE_OFICIO.map(() => ({ fase: "hecha", retraso: 0 }))
  );
  const [abierta, setAbierta] = useState<number | null>(null);
  const [enElCentro, setEnElCentro] = useState(0);
  // En cuanto alguien toca una tarjeta, manda él: ya no se abre ninguna sola.
  const tocada = useRef(false);

  // El timbre: la primera noticia del observador dice si la tarjeta ya se
  // veía al cargar (se queda resuelta) o no (espera y suena al entrar).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const elementos = tarjetas.current.filter(
      (el): el is HTMLLIElement => el !== null
    );
    const decididas = new Set<number>();

    const observador = new IntersectionObserver(
      (entradas) => {
        const cambios = new Map<number, Momento>();
        let enCola = 0;
        const ordenadas = [...entradas].sort(
          (a, b) => indiceDe(a.target) - indiceDe(b.target)
        );
        for (const entrada of ordenadas) {
          const i = indiceDe(entrada.target);
          if (!decididas.has(i)) {
            decididas.add(i);
            if (entrada.intersectionRatio > 0) {
              observador.unobserve(entrada.target);
            } else {
              cambios.set(i, { fase: "espera", retraso: 0 });
            }
            continue;
          }
          if (entrada.intersectionRatio >= 0.55) {
            cambios.set(i, {
              fase: "suena",
              retraso: enCola++ * ESCALONADO_MS,
            });
            observador.unobserve(entrada.target);
          }
        }
        if (cambios.size) {
          setMomentos((antes) => antes.map((m, i) => cambios.get(i) ?? m));
        }
      },
      { threshold: [0, 0.55] }
    );
    elementos.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, []);

  // La escena del centro de la pantalla: los puntos del carrusel y, en
  // táctil, la que se abre sola. Una banda en el 40 % central de la ventana;
  // gana la que más asoma en ella (en el carrusel, la anclada, no la tira de
  // la anterior que queda en el borde) y, a la par, la primera.
  useEffect(() => {
    const tactil = window.matchMedia("(hover: none)").matches;
    const reducir = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const enBanda = new Map<number, number>();
    let candidata: number | null = null;
    let temporizador: number | undefined;

    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          const i = indiceDe(entrada.target);
          if (entrada.isIntersecting) enBanda.set(i, entrada.intersectionRatio);
          else enBanda.delete(i);
        }
        let nueva: number | null = null;
        for (const [i, ratio] of enBanda) {
          const mejor = nueva === null ? -1 : (enBanda.get(nueva) ?? -1);
          if (
            ratio > mejor + 0.01 ||
            (Math.abs(ratio - mejor) <= 0.01 && i < (nueva ?? Infinity))
          ) {
            nueva = i;
          }
        }
        if (nueva !== null) setEnElCentro(nueva);
        if (!tactil || reducir || tocada.current || nueva === candidata) {
          return;
        }
        candidata = nueva;
        window.clearTimeout(temporizador);
        if (nueva !== null) {
          temporizador = window.setTimeout(() => {
            if (!tocada.current) setAbierta(nueva);
          }, ABRIR_SOLA_MS);
        }
      },
      {
        rootMargin: "-30% 0px -30% 0px",
        threshold: Array.from({ length: 11 }, (_, k) => k / 10),
      }
    );
    tarjetas.current.forEach((el) => el && observador.observe(el));
    return () => {
      observador.disconnect();
      window.clearTimeout(temporizador);
    };
  }, []);

  // Lo que sube cada parte al abrir, como un chat que avanza lo justo: la
  // cita y el cajón, lo que mide el cajón; el hilo se acorta primero (hasta
  // su mínimo) y la frase solo sube lo que el hilo no absorbe. Cambia con el
  // ancho y con el alto de la fila.
  useEffect(() => {
    const medir = (tarjeta: HTMLElement) => {
      const cajon = tarjeta.querySelector<HTMLElement>("[data-cajon]");
      const hilo = tarjeta.querySelector<HTMLElement>("[data-hilo]");
      if (!cajon || !hilo) return;
      const subida = cajon.offsetHeight;
      const largo = hilo.offsetHeight;
      const holgura = Math.max(0, largo - HILO_MINIMO_PX);
      const absorbe = Math.min(subida, holgura);
      tarjeta.style.setProperty("--subida", `${subida}px`);
      tarjeta.style.setProperty("--subida-arriba", `${subida - absorbe}px`);
      tarjeta.style.setProperty(
        "--hilo-escala",
        largo > 0 ? String((largo - absorbe) / largo) : "1"
      );
    };
    const medidor = new ResizeObserver((entradas) => {
      for (const entrada of entradas) {
        const tarjeta = (entrada.target as HTMLElement).closest("li");
        if (tarjeta) medir(tarjeta);
      }
    });
    tarjetas.current.forEach((el) => {
      el?.querySelectorAll<HTMLElement>("[data-cajon], [data-cuerpo]").forEach(
        (parte) => medidor.observe(parte)
      );
    });
    return () => medidor.disconnect();
  }, []);

  const alternar = (i: number) => {
    tocada.current = true;
    setAbierta((actual) => (actual === i ? null : i));
  };

  return (
    <section
      id="sectores"
      aria-labelledby="sectores-titulo"
      className="scroll-m-20 border-b border-linea py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2
            id="sectores-titulo"
            className="max-w-3xl text-balance text-3xl font-black tracking-tight text-tinta sm:text-5xl"
          >
            Elige tu oficio y mira la llamada que entra.
          </h2>
        </Reveal>

        <ul
          className={`${styles.pista} -mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 py-1 sm:-mx-6 sm:mt-14 sm:scroll-px-6 sm:gap-6 sm:px-6 md:mx-0 md:grid md:snap-none md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:py-0 lg:grid-cols-4 lg:gap-3 xl:gap-5`}
        >
          {ESCENAS_DE_OFICIO.map((escena, i) => (
            <Escena
              key={escena.slug}
              escena={escena}
              momento={momentos[i]}
              abierta={abierta === i}
              onAlternar={() => alternar(i)}
              registrar={(el) => {
                tarjetas.current[i] = el;
              }}
              indice={i}
            />
          ))}
        </ul>

        {/* Por dónde va el carrusel: solo dibujo, el gesto es el del dedo. */}
        <div
          className="mt-5 flex justify-center gap-1.5 md:hidden"
          aria-hidden="true"
        >
          {ESCENAS_DE_OFICIO.map(({ slug }, i) => (
            <span
              key={slug}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === enElCentro ? "w-5 bg-tinta" : "w-1.5 bg-linea-fuerte"
              }`}
            />
          ))}
        </div>

        {/* Quien llama y quien atiende son de ejemplo, como en las landings;
            y las ocho citas, un mismo jueves. */}
        <p className="mt-4 text-center text-xs leading-5 text-apagado md:mt-5 md:text-left">
          Un jueves de ejemplo, con nombres inventados.
        </p>
      </div>
    </section>
  );
}

function Escena({
  escena,
  momento,
  abierta,
  onAlternar,
  registrar,
  indice,
}: {
  escena: EscenaDeOficio;
  momento: Momento;
  abierta: boolean;
  onAlternar: () => void;
  registrar: (el: HTMLLIElement | null) => void;
  indice: number;
}) {
  const acento = NICHE_ACCENTS[escena.slug];
  const href = `/${escena.slug}`;
  const idCajon = `escena-${escena.slug}-cajon`;
  const [dia, hora] = escena.cita.cuando.split(" ");

  return (
    <li
      ref={registrar}
      data-indice={indice}
      data-fase={momento.fase === "hecha" ? undefined : momento.fase}
      data-abierta={abierta ? "true" : undefined}
      className={`${styles.escena} w-[84%] max-w-[22rem] shrink-0 snap-start md:w-auto md:max-w-none`}
      style={
        {
          "--acento": acento.strong,
          "--acento-suave": acento.soft,
          "--acento-tinta": acento.deep,
          "--retraso": `${momento.retraso}ms`,
        } as CSSProperties
      }
    >
      {/* Con ratón, toda la tarjeta lleva a la landing (el lector de
          pantalla y el teclado usan el enlace del cajón). */}
      <Link
        href={href}
        className={styles.cubierta}
        tabIndex={-1}
        aria-hidden="true"
      >
        <span className="sr-only">{escena.enlace}</span>
      </Link>
      {/* En táctil, un toque abre o cierra el cajón. */}
      <button
        type="button"
        className={styles.toque}
        onClick={onAlternar}
        aria-expanded={abierta}
        aria-controls={idCajon}
        aria-label={`Más sobre ${escena.oficio.toLocaleLowerCase("es-ES")}`}
      />

      <div className={styles.cabecera}>
        <h3 className="text-lg font-bold leading-6 tracking-tight text-tinta">
          {escena.oficio}
        </h3>
        <span className={styles.timbre} aria-hidden="true">
          <PhoneCall strokeWidth={2.2} />
        </span>
      </div>

      <div className={styles.visor}>
        <div className={styles.carril}>
          <div className={styles.cuerpo} data-cuerpo>
            <p className={styles.momento}>
              <strong>Suena</strong> y estás {enFrase(escena.momento)}.
            </p>

            <div className={styles.burbuja}>
              <span className={styles.quien}>{escena.llamada.quien} llama</span>
              <p className={styles.dice}>{escena.llamada.dice}</p>
            </div>

            <span className={styles.hilo} aria-hidden="true" data-hilo />

            <div className={styles.cita}>
              <span className={styles.hueco} aria-hidden="true">
                <span className={styles.hora}>
                  {dia} <b>{hora}</b>
                </span>
                <span>Hueco libre</span>
              </span>
              <div className={styles.ficha}>
                <span className={styles.hora}>
                  {dia} <b>{hora}</b>
                </span>
                <span>
                  <span className={styles.estado}>
                    Cita reservada<span className="sr-only">:</span>
                  </span>{" "}
                  <span className={styles.servicio}>
                    {escena.cita.servicio}
                  </span>{" "}
                  <span className={styles.con}>con {escena.cita.con}</span>
                </span>
                <span className={styles.check} aria-hidden="true">
                  <Check strokeWidth={3} />
                </span>
              </div>
            </div>
          </div>

          <div className={styles.cajon} id={idCajon} data-cajon>
            <p className={styles.detalle}>{escena.detalle}</p>
            <Link href={href} className={styles.enlace}>
              {escena.enlace}
              <ArrowRight className={styles.flecha} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

function indiceDe(el: Element): number {
  return Number((el as HTMLElement).dataset.indice ?? -1);
}
