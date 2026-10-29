import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

/**
 * Tu asistente en acción (gestor-simulacion.tsx) con el guion de un sector: la
 * conversación arranca sola cuando el teléfono se ve casi entero, el dueño
 * teclea en tiempo real, el panel anuncia cada cambio al pulsar
 * «Confirmar», se puede pausar o saltar de situación y, con movimiento
 * reducido, cada situación se enseña entera sin cronómetro.
 */

const { reducido } = vi.hoisted(() => ({ reducido: { valor: false } }));

vi.mock("framer-motion", async (original) => ({
  ...(await original<typeof import("framer-motion")>()),
  useReducedMotion: () => reducido.valor,
}));

import { GestorSimulacionSection } from "@/components/gestor-simulacion";
import { GUIONES_GESTOR } from "@/lib/gestor-guiones";
import { NICHE_ACCENTS } from "@/lib/niche-accents";
import type { OwnerAssistant } from "@/lib/niche-landings";

const guion = GUIONES_GESTOR.fisioterapia;

/** Los textos de la sección los pone cada página; aquí, unos propios para
 * no depender de los datos de una landing concreta. */
const textos: OwnerAssistant = {
  badge: "Incluida en todos los planes",
  title: "Y si a mediodía falta alguien, se lo dices a tu asistente.",
  description: "Le escribes por WhatsApp y ella se encarga, siempre con tu «Confirmar».",
  examples: [
    { title: "Si alguien del equipo falta", description: "Pablo está de baja hoy." },
    { title: "Si cierras un día", description: "Un festivo." },
    { title: "Si cambias un precio", description: "Una sesión sube." },
  ],
  closing: "Con tus clientes manda Alhabla. Con tu agenda mandas tú.",
};

const avisos: { el: Element; aviso: IntersectionObserverCallback }[] = [];

class ObservadorFalso {
  constructor(private readonly aviso: IntersectionObserverCallback) {}
  observe(el: Element) {
    avisos.push({ el, aviso: this.aviso });
  }
  unobserve() {}
  disconnect() {
    for (let i = avisos.length - 1; i >= 0; i--) {
      if (avisos[i].aviso === this.aviso) avisos.splice(i, 1);
    }
  }
}

/** jsdom no trae PointerEvent: el mínimo que lee el componente. */
class EventoDePuntero extends MouseEvent {
  readonly pointerType: string;
  constructor(tipo: string, init: PointerEventInit = {}) {
    super(tipo, init);
    this.pointerType = init.pointerType ?? "";
    Object.defineProperty(this, "movementX", { value: init.movementX ?? 0 });
    Object.defineProperty(this, "movementY", { value: init.movementY ?? 0 });
  }
}

/** El teléfono de la simulación (hay un marco con su render). */
function telefono(): HTMLElement {
  const marco = document.querySelector("img[src='/telefono/frente.svg']");
  if (!marco?.parentElement) throw new Error("No está el teléfono");
  return marco.parentElement;
}

/** Se ve `fraccion` (0–1) del teléfono, en una pantalla donde cabe entero. */
function verTelefono(fraccion: number) {
  const el = telefono();
  const alto = 600;
  for (const { el: observado, aviso } of [...avisos]) {
    if (observado !== el) continue;
    act(() =>
      aviso(
        [
          {
            target: el,
            isIntersecting: fraccion > 0,
            boundingClientRect: { height: alto },
            intersectionRect: { height: alto * fraccion },
            rootBounds: { height: 800 },
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      )
    );
  }
}

/** Avanza el reloj de diez en diez milisegundos, dejando que React programe
 * cada paso, hasta que se cumple la condición. Devuelve lo que ha tardado. */
function avanzarHasta(condicion: () => boolean, maxMs = 20_000): number {
  for (let t = 0; t <= maxMs; t += 10) {
    if (condicion()) return t;
    act(() => {
      vi.advanceTimersByTime(10);
    });
  }
  throw new Error(`No se cumplió en ${maxMs} ms`);
}

function avanzar(ms: number) {
  for (let t = 0; t < ms; t += 10) {
    act(() => {
      vi.advanceTimersByTime(10);
    });
  }
}

/** Lo que hay escrito en la caja de abajo del WhatsApp. */
function borrador(): string {
  return within(telefono()).getByText((_, el) => el?.tagName === "SPAN" && el.className.includes("waCaja"))
    .textContent ?? "";
}

/** Una burbuja del chat (un `div`; la caja de escribir es un `span` y
 * también lleva el texto mientras se teclea). */
function burbuja(texto: string | RegExp): HTMLElement | null {
  return within(telefono()).queryByText(texto, { selector: "div" });
}

/** El dueño ya lleva unas letras escritas (sin escribir, la caja dice
 * «Mensaje»). */
const tecleando = () => borrador() !== "Mensaje" && borrador().length > 3;

function pintar() {
  return render(
    <GestorSimulacionSection
      data={textos}
      guion={guion}
      accent={NICHE_ACCENTS.fisioterapia}
      masInfoHref="/agenda-por-whatsapp"
    />
  );
}

describe("GestorSimulacionSection", () => {
  beforeEach(() => {
    avisos.length = 0;
    reducido.valor = false;
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", ObservadorFalso);
    vi.stubGlobal("PointerEvent", EventoDePuntero);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("pinta las situaciones del sector y las tres conversaciones para lectores de pantalla", () => {
    pintar();
    expect(screen.getByRole("heading", { level: 2, name: textos.title })).toBeInTheDocument();
    const situaciones = within(screen.getByRole("group", { name: "Situaciones de ejemplo" })).getAllByRole("button");
    expect(situaciones.map((b) => b.querySelector("span:nth-child(2)")?.textContent)).toEqual(
      textos.examples.map((e) => e.title)
    );
    expect(situaciones[0]).toHaveAttribute("aria-pressed", "true");
    // La versión en texto lleva los tres guiones enteros, con su vocabulario.
    const lista = document.querySelector("ol.sr-only") as HTMLElement;
    expect(lista.querySelectorAll("li")).toHaveLength(3);
    expect(lista.textContent).toContain("Tú: Pablo está de baja hoy");
    expect(lista.textContent).toContain("Pulsas «Confirmar».");
    expect(lista.textContent).toContain("¿Le aviso a Andrés por WhatsApp de la nueva hora?");
    expect(screen.getByRole("link", { name: /Todo lo que puedes pedirle a tu asistente/ })).toHaveAttribute(
      "href",
      "/agenda-por-whatsapp"
    );
  });

  it("no arranca hasta que el teléfono se ve casi entero, y el dueño teclea en tiempo real", () => {
    pintar();
    // Con solo la mitad del teléfono a la vista no pasa nada.
    verTelefono(0.5);
    avanzar(2000);
    expect(borrador()).toBe("Mensaje");

    verTelefono(0.9);
    const primero = "Pablo está de baja hoy";
    avanzarHasta(tecleando);
    // Letra a letra: un trozo del mensaje, todavía sin enviar.
    expect(primero.startsWith(borrador())).toBe(true);
    expect(borrador().length).toBeLessThan(primero.length);
    expect(burbuja(primero)).toBeNull();

    // Enviado: la burbuja, y la caja vacía otra vez.
    avanzarHasta(() => burbuja(primero) !== null, 3000);
    expect(borrador()).toBe("Mensaje");
  });

  it("el panel anuncia el cambio cuando el dueño pulsa Confirmar, y no antes", () => {
    pintar();
    verTelefono(1);
    const propuesta = /^¿Confirmas\? Marcar a Pablo como ausente hoy \(baja\)/;
    avanzarHasta(() => burbuja(propuesta) !== null, 6000);
    // La propuesta, con sus botones, todavía no cambia nada.
    expect(within(telefono()).getByText("Confirmar")).toBeInTheDocument();
    expect(screen.queryAllByText("Pablo, ausente hoy")).toHaveLength(0);

    // Al pulsar Confirmar, el aviso en el panel y el chip de móvil.
    const tarda = avanzarHasta(() => screen.queryAllByText("Pablo, ausente hoy").length > 0, 4000);
    expect(tarda).toBeGreaterThan(0);
    expect(screen.getAllByText("Pablo, ausente hoy")).toHaveLength(2);
    expect(screen.getByText(/· confirmado por WhatsApp$/)).toBeInTheDocument();
    // Y después, el «Hecho» que escribe la acción.
    avanzarHasta(() => burbuja(/^Hecho: Pablo no está hoy\./) !== null, 3000);
  });

  it("con el ratón sobre el teléfono se pausa para leer, y sigue al salir", () => {
    pintar();
    verTelefono(1);
    avanzarHasta(tecleando);
    fireEvent.pointerMove(telefono(), { pointerType: "mouse", movementX: 4, movementY: 1 });
    expect(screen.getByText("En pausa")).toBeInTheDocument();
    const quieto = borrador();
    avanzar(1500);
    expect(borrador()).toBe(quieto);

    fireEvent.pointerLeave(telefono());
    expect(screen.queryByText("En pausa")).toBeNull();
    avanzarHasta(() => borrador() !== quieto, 1000);
  });

  it("el botón Pausar para el cronómetro y elegir otra situación la empieza desde el principio", () => {
    pintar();
    verTelefono(1);
    avanzarHasta(tecleando);
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    expect(screen.getByRole("button", { name: "Seguir" })).toHaveAttribute("aria-pressed", "true");
    const quieto = borrador();
    avanzar(1500);
    expect(borrador()).toBe(quieto);

    const situaciones = within(screen.getByRole("group", { name: "Situaciones de ejemplo" })).getAllByRole("button");
    fireEvent.click(situaciones[1]);
    expect(situaciones[1]).toHaveAttribute("aria-pressed", "true");
    expect(situaciones[0]).toHaveAttribute("aria-pressed", "false");
    // Elegir una situación quita la pausa y arranca su guion: otra hora en
    // el reloj del teléfono y el primer mensaje de esa situación.
    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
    expect(within(telefono()).getByText(guion.escenarios[1].reloj)).toBeInTheDocument();
    avanzarHasta(() => burbuja(/^Irene no está el jueves de 9 a 12/) !== null, 4000);
  });

  it("con movimiento reducido no hay cronómetro: la situación se ve entera y sin controles", () => {
    reducido.valor = true;
    pintar();
    expect(screen.queryByRole("button", { name: "Pausar" })).toBeNull();
    const ultimo = guion.escenarios[0].turnos.at(-1)!.texto;
    expect(burbuja(ultimo)).toBeInTheDocument();
    for (const { titulo } of Object.values(guion.escenarios[0].avisos)) {
      expect(screen.getAllByText(titulo).length).toBeGreaterThan(0);
    }
    // Se puede ver otra situación, también entera.
    fireEvent.click(within(screen.getByRole("group", { name: "Situaciones de ejemplo" })).getAllByRole("button")[2]);
    expect(burbuja(guion.escenarios[2].turnos.at(-1)!.texto)).toBeInTheDocument();
  });
});
