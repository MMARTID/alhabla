"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  CreditCard,
  LayoutDashboard,
  MessageSquareText,
  Mic,
  Pause,
  PhoneCall,
  Play,
  Plus,
  RotateCcw,
  SendHorizontal,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { SiWhatsapp } from "@icons-pack/react-simple-icons";

import { useMovimientoReducido } from "@/hooks/use-movimiento-reducido";
import type { NicheAccent, OwnerAssistant } from "@/lib/niche-landings";
import {
  RITMO,
  duracionDe,
  estadoDeTurnos,
  hitosAlcanzados,
  horaDelTurno,
  pasosDe,
  progresoEn,
  vistaActiva,
  type Escenario,
  type EstadoDeTurno,
  type GuionGestor,
  type Hito,
  type Turno,
  type Vista,
  type VistaAgenda,
  type VistaHorario,
  type VistaInformacion,
  type VistaResumen,
  type VistaServicios,
} from "@/lib/gestor-guiones";
import { MODELO } from "@/lib/portatil-3d";
import { Reveal } from "@/components/scroll-reveal";
import type { PortatilMontado } from "./gestor-mac-escena";
import styles from "./gestor-simulacion.module.css";

/**
 * Tu asistente en acción (2026-09-30; por sector y a otro ritmo desde el
 * 2026-10-22; en el código y el backend, «el Gestor»). A la derecha,
 * el iPhone con el WhatsApp del dueño (el mismo render de «En tu bolsillo»);
 * detrás, el portátil 3D de «En tu negocio» con el panel reaccionando a
 * cada cambio. La conversación se reproduce sola en cuanto el teléfono se
 * ve casi entero y encadena las tres situaciones de `data.examples`, con el
 * guion de la landing (`lib/gestor-guiones.ts`: la portada tiene el
 * general y cada sector el suyo, con sus nombres y sus servicios).
 *
 * Lo que se ve es lo que el Gestor hace de verdad: propone, el botón
 * ejecuta, el «Hecho» llega y el panel cambia (la honestidad de cada
 * texto está contrastada en el módulo de guiones). Nada cambia sin pulsar
 * Confirmar.
 *
 * Mecánica: el guion se compila a `pasos` (`pasosDe`): cada letra que
 * teclea el dueño, los puntos del Gestor, cada mensaje, cada botón. Un
 * cronómetro aplica un paso tras otro con la espera de cada uno y, al
 * acabar, pasa a la siguiente situación; `paso` es cuántos van aplicados.
 * Se para fuera de pantalla, con la pestaña oculta, con el ratón sobre el
 * teléfono (para leer) y con el botón de pausa. Con movimiento reducido no
 * hay cronómetro: cada situación se enseña entera.
 *
 * Los hitos (`hito` en un botón, o en una consulta del Gestor) son lo que
 * el panel refleja: la vista activa (`vistaActiva`) pinta su cambio, el
 * aviso «desde WhatsApp» entra en el panel y la pantalla destella. En
 * móvil el portátil no se monta —manda el teléfono— y lo que cambió en el
 * panel se resume en los chips de debajo.
 *
 * El portátil es three.js y se monta al acercarse (import dinámico).
 */

/** Tamaño de la pantalla del portátil (px CSS) antes de proyectarla. */
const PANTALLA_W = 1200;
const PANTALLA_H = 776;
/** A qué distancia de la pantalla se empieza a descargar three.js. */
const MARGEN_DE_CARGA = "60% 0px";
/** Filas de media hora que enseña la agenda. */
const FILAS_DE_AGENDA = 10;
/** Qué parte del teléfono (de lo que cabe en pantalla) tiene que verse para
 * que la conversación arranque, y por debajo de cuánto se para. */
const UMBRAL_DE_ARRANQUE = 0.8;
const UMBRAL_DE_PARADA = 0.2;

export function GestorSimulacionSection({
  data,
  guion,
  accent,
  masInfoHref,
}: {
  data: OwnerAssistant;
  guion: GuionGestor;
  /** El color de la landing de sector; la portada va con el morado. */
  accent?: NicheAccent;
  /** Enlace a la página de tu asistente (/agenda-por-whatsapp). */
  masInfoHref?: string;
}) {
  // Con movimiento reducido, la versión quieta llega tras montar: el servidor
  // no sabe la preferencia (ver useMovimientoReducido).
  const reducir = useMovimientoReducido();
  const telefonoEl = useRef<HTMLDivElement>(null);
  const macEl = useRef<HTMLDivElement>(null);
  const lienzoEl = useRef<HTMLDivElement>(null);
  const pantallaEl = useRef<HTMLDivElement>(null);
  const portatil = useRef<PortatilMontado | null>(null);
  const [escenario, setEscenario] = useState(0);
  const [paso, setPaso] = useState(0);
  const [aLaVista, setALaVista] = useState(false);
  const [pestanaVisible, setPestanaVisible] = useState(true);
  const [pausado, setPausado] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [sinMac, setSinMac] = useState(false);

  const actual = guion.escenarios[escenario];
  const pasos = useMemo(() => pasosDe(actual), [actual]);
  const duracion = useMemo(() => duracionDe(actual), [actual]);
  const activo = aLaVista && pestanaVisible && !pausado && !leyendo;
  const aplicados = reducir ? pasos.length : paso;
  const { estados, letras } = estadoDeTurnos(actual, pasos, aplicados);
  const hitos = hitosAlcanzados(actual, estados);
  const vista = vistaActiva(actual, hitos);
  const progreso = reducir ? 1 : progresoEn(pasos, paso, duracion);
  // El portátil lee estos dos al montar sin volver a suscribirse.
  const activoRef = useRef(activo);
  const reducirRef = useRef(reducir);
  useEffect(() => {
    activoRef.current = activo;
    reducirRef.current = reducir;
  }, [activo, reducir]);

  // Solo corre con el teléfono a la vista y la pestaña delante. Arranca
  // cuando el teléfono se ve casi entero: la conversación crece desde
  // abajo, junto a la caja de escribir, y con solo el borde de arriba a la
  // vista el visitante se perdía el primer mensaje. «Casi entero» es sobre
  // lo que cabe: en una pantalla más baja que el teléfono también arranca.
  // Se para cuando casi ha salido (dos umbrales, para que no se encienda y
  // se apague en el borde).
  useEffect(() => {
    const el = telefonoEl.current;
    if (!el) return;
    const enPantalla = new IntersectionObserver(
      ([entrada]) => {
        const cabe = Math.min(entrada.boundingClientRect.height, entrada.rootBounds?.height ?? window.innerHeight);
        const visto = cabe > 0 ? entrada.intersectionRect.height / cabe : 0;
        setALaVista((antes) => (antes ? visto > UMBRAL_DE_PARADA : visto >= UMBRAL_DE_ARRANQUE));
      },
      { threshold: Array.from({ length: 21 }, (_, i) => i / 20) }
    );
    enPantalla.observe(el);
    const alCambiarPestana = () => setPestanaVisible(!document.hidden);
    document.addEventListener("visibilitychange", alCambiarPestana);
    return () => {
      enPantalla.disconnect();
      document.removeEventListener("visibilitychange", alCambiarPestana);
    };
  }, []);

  // El cronómetro: tras cada paso, su espera; al acabar, siguiente situación.
  useEffect(() => {
    if (reducir || !activo) return;
    const espera = paso === 0 ? RITMO.inicial : paso >= pasos.length ? RITMO.final : pasos[paso - 1].espera;
    const id = window.setTimeout(() => {
      if (paso >= pasos.length) {
        setEscenario((e) => (e + 1) % guion.escenarios.length);
        setPaso(0);
      } else {
        setPaso((p) => p + 1);
      }
    }, espera);
    return () => window.clearTimeout(id);
  }, [reducir, activo, paso, pasos, guion.escenarios.length]);

  // El portátil 3D: solo en escritorio, y solo cuando la sección se acerca.
  useEffect(() => {
    const raiz = macEl.current;
    const lienzo = lienzoEl.current;
    const pantalla = pantallaEl.current;
    if (!raiz || !lienzo || !pantalla) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    let cancelado = false;
    const cerca = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        cerca.disconnect();
        import("./gestor-mac-escena")
          .then(({ montarPortatil }) => {
            if (cancelado) return;
            // Sin WebGL, `montarPortatil` lanza; si el modelo no llega,
            // avisa después. En los dos casos, la pantalla plana.
            const montado = montarPortatil({
              lienzo,
              pantallaHtml: pantalla,
              anchoHtml: PANTALLA_W,
              altoHtml: PANTALLA_H,
              alFallar: () => {
                if (!cancelado) setSinMac(true);
              },
            });
            portatil.current = montado;
            if (activoRef.current) montado.abrir(!reducirRef.current);
          })
          .catch(() => {
            if (!cancelado) setSinMac(true);
          });
      },
      { rootMargin: MARGEN_DE_CARGA }
    );
    cerca.observe(raiz);
    return () => {
      cancelado = true;
      cerca.disconnect();
      portatil.current?.desmontar();
      portatil.current = null;
    };
  }, []);

  // La tapa se abre la primera vez que la sección está a la vista.
  useEffect(() => {
    if (aLaVista && pestanaVisible) portatil.current?.abrir(!reducir);
  }, [aLaVista, pestanaVisible, reducir]);

  // Pantalla plana (sin 3D): a la escala que quepa en el hueco.
  useEffect(() => {
    if (!sinMac) return;
    const raiz = macEl.current;
    if (!raiz) return;
    const medir = () => {
      const r = raiz.getBoundingClientRect();
      raiz.style.setProperty("--k", String(Math.min(r.width / PANTALLA_W, r.height / PANTALLA_H)));
    };
    const alCambiarTamano = new ResizeObserver(medir);
    alCambiarTamano.observe(raiz);
    medir();
    return () => alCambiarTamano.disconnect();
  }, [sinMac]);

  const elegir = (i: number) => {
    setEscenario(i);
    setPaso(0);
    setPausado(false);
  };

  const a = accent;
  const enPausa = !reducir && (pausado || leyendo);
  const ultimoHito = [...hitos].reverse().find((h) => actual.avisos[h]);
  const aviso = ultimoHito ? actual.avisos[ultimoHito] : undefined;
  // En móvil, el sitio de los chips es el de la situación que más avisos da.
  const filasDeHechos = Math.max(...guion.escenarios.map((e) => Object.keys(e.avisos).length));

  return (
    <section
      className={styles.seccion}
      aria-labelledby="gestor-titulo"
      style={
        a
          ? ({ "--acento": a.strong, "--acento-suave": a.soft, "--acento-tinta": a.deep } as CSSProperties)
          : undefined
      }
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={styles.cabecera}>
          <Reveal>
            <span
              className={a ? styles.badgeSector : "badge-soft gap-2"}
              style={a ? ({ backgroundColor: a.soft, color: a.deep, "--tw-ring-color": `${a.strong}33` } as CSSProperties) : undefined}
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {data.badge}
            </span>
            <h2 id="gestor-titulo" className={styles.titulo}>
              {data.title}
            </h2>
            <p className={styles.descripcion}>{data.description}</p>
          </Reveal>

          <Reveal delay={0.1} y={12}>
            <div className={styles.situaciones} role="group" aria-label="Situaciones de ejemplo">
              {data.examples.map((ejemplo, i) => (
                <button
                  key={ejemplo.title}
                  type="button"
                  className={styles.situacion}
                  aria-pressed={i === escenario}
                  onClick={() => elegir(i)}
                  style={{ "--p": i === escenario ? progreso : 0 } as CSSProperties}
                >
                  <span className={styles.situacionNumero}>0{i + 1}</span>
                  <span className={styles.situacionTitulo}>{ejemplo.title}</span>
                  <span className={styles.situacionTexto}>
                    <span>{ejemplo.description}</span>
                  </span>
                  <span className={styles.progreso} aria-hidden="true">
                    <span />
                  </span>
                </button>
              ))}
            </div>
            {reducir ? null : (
              <div className={styles.controles}>
                <button type="button" className={styles.control} onClick={() => setPausado((p) => !p)} aria-pressed={pausado}>
                  {pausado ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                  {pausado ? "Seguir" : "Pausar"}
                </button>
                <button type="button" className={styles.control} onClick={() => elegir(escenario)}>
                  <RotateCcw aria-hidden="true" />
                  Ver otra vez
                </button>
                <span className={styles.pista}>Deja el ratón sobre el teléfono para leer con calma.</span>
              </div>
            )}
          </Reveal>
        </div>

        <div className={styles.escenario} aria-hidden="true">
          <div ref={macEl} className={styles.mac} data-plana={sinMac ? "" : undefined}>
            <div ref={lienzoEl} className={styles.lienzo} />
            <div ref={pantallaEl} className={styles.pantalla}>
              <PantallaMac escenario={actual} vista={vista} hitos={hitos} negocio={guion.negocio} aviso={aviso} ultimoHito={ultimoHito} />
            </div>
          </div>

          <div
            ref={telefonoEl}
            className={styles.telefono}
            // Un ratón que de verdad se mueve sobre el teléfono pausa para
            // leer. Solo con movimiento: al hacer scroll bajo un ratón quieto
            // Chrome dispara eventos sintéticos (movimiento cero) y la
            // simulación se quedaría parada antes de empezar.
            onPointerMove={(e) => {
              if (e.pointerType === "mouse" && (e.movementX !== 0 || e.movementY !== 0)) setLeyendo(true);
            }}
            onPointerLeave={() => setLeyendo(false)}
          >
            <span className={styles.sombraTelefono} />
            <div className={styles.hueco}>
              <span className={styles.isla} />
              <div className={styles.estado}>
                <span>{actual.reloj}</span>
                <span>5G</span>
              </div>
              <PantallaWhatsApp escenario={actual} estados={estados} letras={letras} />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- render local, el marco del teléfono */}
            <img src="/telefono/frente.svg" alt="" className={styles.marco} width={1335} height={2859} />
            {enPausa ? (
              <span className={styles.enPausa}>
                <Pause aria-hidden="true" />
                En pausa
              </span>
            ) : null}
          </div>
        </div>

        <ul className={styles.hechos} aria-hidden="true" style={{ "--filas": filasDeHechos } as CSSProperties}>
          {hitos
            .filter((hito) => actual.avisos[hito])
            .map((hito) => (
              <li key={`${actual.id}-${hito}`} className={styles.hecho}>
                <Check strokeWidth={2.5} aria-hidden="true" />
                {actual.avisos[hito].titulo}
              </li>
            ))}
        </ul>

        <Reveal y={8}>
          <p className={styles.cierre}>{data.closing}</p>
          {masInfoHref ? (
            <Link href={masInfoHref} className={styles.masInfo}>
              Todo lo que puedes pedirle a tu asistente
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </Reveal>
        {/* Crédito que exige la licencia CC BY 4.0 del modelo: no quitar. */}
        <p className={styles.credito}>
          Modelo 3D{" "}
          <a href={MODELO.origen} target="_blank" rel="noopener noreferrer">
            «{MODELO.titulo}»
          </a>
          , de{" "}
          <a href={MODELO.autor} target="_blank" rel="noopener noreferrer">
            jackbaeten
          </a>{" "}
          (
          <a href={MODELO.licencia} target="_blank" rel="noopener noreferrer">
            CC BY 4.0
          </a>
          ), sin el logo y con la pantalla de Alhabla.
        </p>
      </div>

      {/* Las tres conversaciones, para quien no ve la simulación. */}
      <ol className="sr-only">
        {guion.escenarios.map((esc, i) => (
          <li key={esc.id}>
            <strong>{data.examples[i].title}.</strong>{" "}
            {esc.turnos
              .map((t) => (t.de === "gestor" ? `Tu asistente: ${t.texto}` : t.de === "boton" ? `Pulsas «${t.texto}».` : `Tú: ${t.texto}`))
              .join(" ")}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ── El WhatsApp del dueño ───────────────────────────────────────── */

function PantallaWhatsApp({
  escenario,
  estados,
  letras,
}: {
  escenario: Escenario;
  estados: EstadoDeTurno[];
  letras: number;
}) {
  const tecleando = escenario.turnos.findIndex((_, i) => estados[i] === "tecleando");
  const borrador = tecleando >= 0 ? (escenario.turnos[tecleando] as Extract<Turno, { de: "dueno" }>).texto.slice(0, letras) : "";
  return (
    <div className={styles.wa}>
      <div className={styles.waCabecera}>
        <span className={styles.waAvatar}>
          {/* eslint-disable-next-line @next/next/no-img-element -- isotipo local */}
          <img src="/brand/alhabla-isotipo.svg" alt="" className={styles.waLogo} />
        </span>
        <div>
          <p className={styles.waNombre}>Alhabla</p>
          <p className={styles.waSub}>Cuenta de empresa</p>
        </div>
      </div>
      <div className={styles.waChat}>
        <span className={styles.waFecha}>Hoy</span>
        {escenario.turnos.map((turno, i) => {
          const estado = estados[i];
          if (estado === "oculto" || estado === "tecleando") return null;
          // La clave lleva la situación: al cambiar, las burbujas vuelven a
          // entrar con su animación.
          const clave = `${escenario.id}-${i}`;
          const hora = horaDelTurno(escenario.reloj, i);
          if (turno.de === "dueno" || turno.de === "boton") {
            return (
              <div key={clave} className={`${styles.burbuja} ${styles.burbujaDueno}`}>
                {turno.texto}
                <span className={styles.hora}>{hora} ✓✓</span>
              </div>
            );
          }
          if (estado === "escribiendo") {
            return (
              <div key={clave} className={styles.escribiendo}>
                <i />
                <i />
                <i />
              </div>
            );
          }
          // Botones bajo la propuesta; cuando el dueño pulsa uno (el turno
          // siguiente), se queda marcado y el otro se apaga.
          const siguiente = escenario.turnos[i + 1];
          const pulsado = turno.botones && siguiente?.de === "boton" && estados[i + 1] === "visible" ? siguiente.texto : null;
          return (
            <Fragment key={clave}>
              <div className={`${styles.burbuja} ${styles.burbujaGestor}`} data-hecho={turno.texto.startsWith("Hecho:") ? "" : undefined}>
                {turno.texto}
                <span className={styles.hora}>{hora}</span>
              </div>
              {turno.botones ? (
                <div className={styles.botones}>
                  {turno.botones.map((boton) => (
                    <span
                      key={boton}
                      className={styles.boton}
                      data-pulsado={pulsado === boton ? "" : undefined}
                      data-descartado={pulsado && pulsado !== boton ? "" : undefined}
                    >
                      {boton}
                    </span>
                  ))}
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
      <div className={styles.waEscribir}>
        <span className={styles.waCaja} data-borrador={borrador ? "" : undefined}>
          {borrador || "Mensaje"}
        </span>
        <span className={styles.waMicro}>
          {borrador ? <SendHorizontal color="#fff" strokeWidth={2.4} /> : <Mic color="#fff" strokeWidth={2.4} />}
        </span>
      </div>
    </div>
  );
}

/* ── El panel del negocio (pantalla del portátil) ────────────────── */

function Item({ icono: Icono, activo, children }: { icono: LucideIcon; activo?: boolean; children: ReactNode }) {
  return (
    <div className={styles.item} data-activo={activo ? "" : undefined}>
      <Icono strokeWidth={2} />
      {children}
    </div>
  );
}

function PantallaMac({
  escenario,
  vista,
  hitos,
  negocio,
  aviso,
  ultimoHito,
}: {
  escenario: Escenario;
  vista: Vista;
  hitos: Hito[];
  negocio: string;
  aviso?: { titulo: string; detalle: string };
  ultimoHito?: Hito;
}) {
  const enAgenda = vista.tipo === "agenda";
  const enPanel = vista.tipo === "resumen";
  return (
    <>
      <div className={styles.menu}>
        <b>Alhabla</b>
        <span>Archivo</span>
        <span>Editar</span>
        <span>Ver</span>
        <span>Ventana</span>
        <i className={styles.notch} />
        <span className={styles.menuHora}>
          {escenario.diaCorto} {escenario.reloj}
        </span>
      </div>
      <div className={styles.app}>
        <aside className={styles.lateral}>
          <div className={styles.marca}>
            {/* eslint-disable-next-line @next/next/no-img-element -- isotipo local, dentro de la pantalla proyectada */}
            <img src="/brand/alhabla-isotipo.svg" alt="" />
            <div>
              <b>Alhabla</b>
              <small>{negocio}</small>
            </div>
          </div>
          <p className={styles.grupo}>OPERACIÓN</p>
          <Item icono={LayoutDashboard} activo={enPanel}>
            Panel
          </Item>
          <Item icono={CalendarDays} activo={enAgenda}>
            Agenda
          </Item>
          <Item icono={PhoneCall}>Llamadas</Item>
          <p className={styles.grupo}>TU EQUIPO DE IA</p>
          <Item icono={Bot} activo={!enAgenda && !enPanel}>
            Recepcionista
          </Item>
          <Item icono={MessageSquareText}>Tu asistente</Item>
          <div className={styles.pie}>
            <p className={styles.grupo}>CUENTA</p>
            <Item icono={Settings}>Ajustes</Item>
            <Item icono={CreditCard}>Facturación</Item>
          </div>
        </aside>
        <div className={styles.principal}>
          {vista.tipo === "agenda" ? (
            <VistaAgendaDelDia vista={vista} hitos={hitos} />
          ) : vista.tipo === "resumen" ? (
            <VistaDelPanel vista={vista} hitos={hitos} negocio={negocio} />
          ) : (
            <VistaAgente vista={vista} hitos={hitos} />
          )}
          {aviso ? (
            <div key={`${escenario.id}-${ultimoHito}`} className={styles.aviso}>
              <span className={styles.avisoIcono}>
                <SiWhatsapp aria-hidden="true" />
              </span>
              <div>
                <b>{aviso.titulo}</b>
                <small>{aviso.detalle} · confirmado por WhatsApp</small>
              </div>
            </div>
          ) : null}
          {/* La pantalla destella cuando aterriza un cambio: causa en el
              teléfono, efecto en el panel. */}
          {ultimoHito ? <i key={`${escenario.id}-${ultimoHito}-destello`} className={styles.destello} /> : null}
        </div>
      </div>
    </>
  );
}

/* 1 · La agenda del día, por profesional. Filas de media hora. */

function VistaAgendaDelDia({ vista, hitos }: { vista: VistaAgenda; hitos: Hito[] }) {
  const ausencia = vista.ausencia && hitos.includes(vista.ausencia.hito) ? vista.ausencia : null;
  const desdeFila = ausencia?.fila ?? 0;
  const hastaFila = desdeFila + (ausencia?.filas ?? FILAS_DE_AGENDA);
  const celdas: ReactNode[] = [];
  for (let fila = 0; fila < FILAS_DE_AGENDA; fila++) {
    if (fila % 2 === 0) {
      celdas.push(
        <span key={`h${fila}`} className={styles.horaEtiqueta} style={{ gridRow: fila + 1 }}>
          {vista.desdeHora + fila / 2}:00
        </span>
      );
    }
    for (let col = 0; col < vista.profesionales.length; col++) {
      const rayada = ausencia !== null && col === ausencia.col && fila >= desdeFila && fila < hastaFila;
      celdas.push(
        <i
          key={`c${fila}-${col}`}
          className={styles.celda}
          style={{ gridColumn: col + 2, gridRow: fila + 1 }}
          data-media={fila % 2 ? "" : undefined}
          data-ausente={rayada ? "" : undefined}
        />
      );
    }
  }
  const c = vista.cita;
  const movida = c?.movida && hitos.includes(c.movida.hito) ? c.movida : null;
  const existe = !c?.nueva || hitos.includes(c.nueva);
  const whatsapp = c?.whatsapp && hitos.includes(c.whatsapp.hito) ? c.whatsapp.etiqueta : null;
  const huerfana = ausencia !== null && c !== undefined && c.cita.col === ausencia.col && !movida;
  const cuerpo = c ? (
    <>
      <b>{c.cita.titulo}</b>
      <small>
        {c.cita.cliente} · {c.horas}
      </small>
    </>
  ) : null;
  const etiquetaWa = whatsapp ? (
    <span className={styles.etiquetaWa}>
      <SiWhatsapp aria-hidden="true" />
      {whatsapp}
    </span>
  ) : null;
  return (
    <>
      <header className={styles.cab}>
        <span className={styles.ico}>
          <CalendarDays strokeWidth={2} />
        </span>
        <div>
          <p className={styles.h1}>Agenda</p>
          <p>Las citas que ha reservado tu recepcionista y las que has apuntado tú.</p>
        </div>
      </header>
      <div className={styles.barra}>
        <span className={`${styles.chip} ${styles.chipActivo}`}>Día</span>
        <span className={styles.chip}>7 días</span>
        <span className={styles.chip}>30 días</span>
        <span className={styles.diaActual}>{vista.dia}</span>
      </div>
      <div className={styles.agenda}>
        <div className={styles.columnas}>
          <span />
          {vista.profesionales.map((nombre, col) => (
            <div key={nombre} className={styles.columnaCab} data-ausente={ausencia && col === ausencia.col ? "" : undefined}>
              {nombre}
              {ausencia && col === ausencia.col ? <span className={styles.chip}>{ausencia.etiqueta}</span> : null}
            </div>
          ))}
        </div>
        <div className={styles.rejilla}>
          {celdas}
          {vista.citas.map((cita) => (
            <div
              key={`${cita.col}-${cita.fila}`}
              className={`${styles.cita} ${styles.citaGris}`}
              style={{ gridColumn: cita.col + 2, gridRow: `${cita.fila + 1} / span ${cita.filas}` }}
            >
              <b>{cita.titulo}</b>
              <small>{cita.cliente}</small>
            </div>
          ))}
          {c && existe ? (
            // En su columna hasta que se mueve; entonces entra en la otra (o
            // se va a otro día y aquí queda su hueco).
            <div
              className={styles.cita}
              style={{ gridColumn: c.cita.col + 2, gridRow: `${c.cita.fila + 1} / span ${c.cita.filas}` }}
              data-huerfana={huerfana ? "" : undefined}
              data-sale={movida && movida.col !== undefined ? "" : undefined}
              data-fuera={movida && movida.destino ? "" : undefined}
              data-entra={c.nueva ? "" : undefined}
            >
              {cuerpo}
              {huerfana ? <small>Sin quien la atienda</small> : null}
              {movida?.destino ? <span className={styles.destino}>→ {movida.destino}</span> : null}
              {movida?.destino || !movida ? etiquetaWa : null}
            </div>
          ) : null}
          {c && movida && movida.col !== undefined ? (
            <div
              className={styles.cita}
              style={{ gridColumn: movida.col + 2, gridRow: `${c.cita.fila + 1} / span ${c.cita.filas}` }}
              data-entra=""
            >
              {cuerpo}
              {etiquetaWa}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

/* 2 · «Tu recepcionista»: el horario, el catálogo o la información del negocio. */

function VistaAgente({ vista, hitos }: { vista: VistaHorario | VistaServicios | VistaInformacion; hitos: Hito[] }) {
  return (
    <>
      <header className={styles.cab}>
        <span className={styles.ico}>
          <Bot strokeWidth={2} />
        </span>
        <div>
          <p className={styles.h1}>Tu recepcionista</p>
          <p>Configura cómo atiende, qué puede reservar y qué información utiliza al hablar con tus clientes.</p>
        </div>
        <span className={styles.botonPanel}>Probar la recepcionista</span>
      </header>
      {vista.tipo === "horario" ? (
        <VistaDelHorario vista={vista} cerrado={hitos.includes(vista.nuevo.hito)} />
      ) : vista.tipo === "servicios" ? (
        <VistaDeServicios vista={vista} hitos={hitos} />
      ) : (
        <VistaDeInformacion vista={vista} ensenado={hitos.includes(vista.nueva.hito)} />
      )}
    </>
  );
}

function DiaEspecialFila({ dia, nuevo }: { dia: VistaHorario["especiales"][number]; nuevo?: boolean }) {
  return (
    <div className={styles.especial} data-nuevo={nuevo ? "" : undefined}>
      <span className={styles.fecha}>
        {dia.fecha[0]}
        <b>{dia.fecha[1]}</b>
      </span>
      <div>
        <b>{dia.titulo}</b>
        <small>{dia.detalle}</small>
      </div>
      <span className={`${styles.chip} ${nuevo ? styles.chipMorado : ""}`}>{dia.chip}</span>
    </div>
  );
}

function VistaDelHorario({ vista, cerrado }: { vista: VistaHorario; cerrado: boolean }) {
  return (
    <div className={styles.seccionPanel}>
      <p className={styles.h2}>Disponibilidad</p>
      <p>Define cuándo puede reservar tu recepcionista y cuántas citas puede confirmar a la vez.</p>
      <div className={styles.dosTarjetas}>
        <div className={`${styles.tarjeta} ${styles.tarjetaCuerpo}`}>
          <div className={styles.tarjetaCab}>
            <div>
              <p className={styles.h2}>Horario de apertura</p>
              <p>Solo ofrece huecos dentro de estas horas.</p>
            </div>
            <span className={`${styles.chip} ${styles.chipOk}`}>Sincronizado</span>
          </div>
          <div className={styles.semana}>
            {vista.semana.map(([dia, tramos]) => (
              <div key={dia} className={styles.diaFila}>
                <b>{dia}</b>
                {tramos ? <span>{tramos}</span> : <span className={styles.diaCerrado}>Cerrado</span>}
              </div>
            ))}
          </div>
        </div>
        <div className={`${styles.tarjeta} ${styles.tarjetaCuerpo}`}>
          <div className={styles.tarjetaCab}>
            <div>
              <p className={styles.h2}>Días especiales</p>
              <p>Cierres y horarios distintos a los de la semana.</p>
            </div>
          </div>
          <div className={styles.especiales}>
            {vista.especiales.map((dia) => (
              <DiaEspecialFila key={dia.titulo} dia={dia} />
            ))}
            {cerrado ? <DiaEspecialFila dia={vista.nuevo} nuevo /> : null}
            <span className={styles.anadir}>
              <Plus strokeWidth={2.5} />
              Añadir día especial
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VistaDeServicios({ vista, hitos }: { vista: VistaServicios; hitos: Hito[] }) {
  const cambio = vista.cambio && hitos.includes(vista.cambio.hito) ? vista.cambio : null;
  const nuevo = vista.nuevo && hitos.includes(vista.nuevo.hito) ? vista.nuevo : null;
  const filas = nuevo ? [...vista.servicios, nuevo] : vista.servicios;
  return (
    <div className={styles.seccionPanel}>
      <p className={styles.h2}>Catálogo y equipo</p>
      <p>Los servicios y las personas disponibles determinan qué puede ofrecer y reservar por teléfono.</p>
      <div className={`${styles.tarjeta} ${styles.tarjetaCuerpo}`} style={{ marginTop: 14 }}>
        <div className={styles.tarjetaCab}>
          <div>
            <p className={styles.h2}>Servicios</p>
            <p>Lo que la recepcionista puede ofrecer, con su duración y su precio.</p>
          </div>
          <span className={styles.chip}>{filas.length} activos</span>
        </div>
        <div className={styles.servicios}>
          {filas.map((servicio) => {
            const esteCambia = cambio?.nombre === servicio.nombre ? cambio : null;
            const esNuevo = nuevo?.nombre === servicio.nombre;
            return (
              <div
                key={servicio.nombre}
                className={styles.servicioFila}
                data-cambiado={esteCambia ? "" : undefined}
                data-nuevo={esNuevo ? "" : undefined}
              >
                <div>
                  <b>{servicio.nombre}</b>
                  <small>Todo el equipo</small>
                </div>
                <span className={styles.duracion}>
                  {esteCambia?.duracion !== undefined ? (
                    <>
                      <s className={styles.valorViejo}>{servicio.duracion} min</s>
                      <span className={styles.valorNuevo}>{esteCambia.duracion} min</span>
                    </>
                  ) : (
                    `${servicio.duracion} min`
                  )}
                </span>
                <span className={styles.precio}>
                  {esteCambia?.precio !== undefined ? (
                    <>
                      <s className={styles.valorViejo}>{servicio.precio} €</s>
                      <span className={styles.valorNuevo}>{esteCambia.precio} €</span>
                    </>
                  ) : (
                    `${servicio.precio} €`
                  )}
                </span>
                <span className={`${styles.chip} ${styles.chipOk}`}>Activo</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VistaDeInformacion({ vista, ensenado }: { vista: VistaInformacion; ensenado: boolean }) {
  return (
    <div className={styles.seccionPanel}>
      <p className={styles.h2}>Información del negocio</p>
      <p>Dirección, contacto y políticas útiles: lo que la recepcionista cuenta cuando se lo preguntan.</p>
      <div className={`${styles.tarjeta} ${styles.tarjetaCuerpo}`} style={{ marginTop: 14 }}>
        <div className={styles.tarjetaCab}>
          <div>
            <p className={styles.h2}>Lo que sabe la recepcionista</p>
            <p>Frases cortas; las lee tal cual en cada llamada.</p>
          </div>
          <span className={`${styles.chip} ${styles.chipOk}`}>Sincronizado</span>
        </div>
        <div className={styles.informacion}>
          {vista.lineas.map((linea) => (
            <p key={linea} className={styles.linea}>
              {linea}
            </p>
          ))}
          {ensenado ? (
            <p className={styles.linea} data-nueva="">
              {vista.nueva.texto}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* 3 · El panel de inicio: las cifras que el Gestor resume. */

function VistaDelPanel({ vista, hitos, negocio }: { vista: VistaResumen; hitos: Hito[]; negocio: string }) {
  const resalta = hitos.includes(vista.hito);
  return (
    <>
      <header className={styles.cab}>
        <span className={styles.ico}>
          <LayoutDashboard strokeWidth={2} />
        </span>
        <div>
          <p className={styles.h1}>Panel</p>
          <p>Cómo va {negocio} esta semana: lo que ha atendido tu recepcionista y lo que te queda por resolver.</p>
        </div>
      </header>
      <div className={styles.seccionPanel}>
        <p className={styles.h2}>Esta semana</p>
        <div className={styles.cifras}>
          {vista.cifras.map(([etiqueta, valor]) => (
            <div key={etiqueta} className={`${styles.tarjeta} ${styles.cifra}`} data-resalta={resalta ? "" : undefined}>
              <small>{etiqueta}</small>
              <b>{valor}</b>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
