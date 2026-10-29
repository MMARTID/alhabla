"use client";

import { FileText, MessageCircle, StickyNote } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { BotonCopiar } from "@/components/herramientas/boton-copiar";
import {
  ANTELACIONES,
  EJEMPLOS_DE_POLITICA,
  generarPolitica,
  POLITICA_POR_DEFECTO,
  type Ambito,
  type Politica,
} from "@/components/herramientas/politica-de-cancelacion";

/**
 * Generador de /herramientas/politica-de-cancelacion. Con unas pocas
 * decisiones (plazo, señal, qué pasa si no vienen, retraso, cómo se avisa)
 * escribe tres textos: el cartel del mostrador, el de la web y la frase que
 * va al final del mensaje de confirmación.
 *
 * El HTML del servidor sale con los textos de los valores por defecto, así
 * que sin JavaScript se lee un ejemplo completo.
 */

export function GeneradorPoliticaCancelacion() {
  const [p, setP] = useState<Politica>(POLITICA_POR_DEFECTO);
  const [ejemplo, setEjemplo] = useState("");
  const textos = generarPolitica(p);
  const cambiar = <K extends keyof Politica>(campo: K, valor: Politica[K]) => setP((actual) => ({ ...actual, [campo]: valor }));
  const ids = {
    ejemplo: useId(),
    negocio: useId(),
    telefono: useId(),
    antelacion: useId(),
    cantidad: useId(),
    ambito: useId(),
    minutos: useId(),
    max: useId(),
    retraso: useId(),
  };

  const partirDe = (id: string) => {
    setEjemplo(id);
    const elegido = EJEMPLOS_DE_POLITICA.find((e) => e.id === id);
    // Se conservan el nombre, el teléfono y los canales: son tuyos, no del sector.
    if (elegido)
      setP((actual) => ({
        ...POLITICA_POR_DEFECTO,
        negocio: actual.negocio,
        telefono: actual.telefono,
        porWhatsapp: actual.porWhatsapp,
        porTelefono: actual.porTelefono,
        enElLocal: actual.enElLocal,
        ...elegido.valores,
      }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
      <form className="panel space-y-6 p-5 sm:p-6" onSubmit={(e) => e.preventDefault()} aria-label="Tu política">
        <div>
          <label htmlFor={ids.ejemplo} className="text-sm font-semibold text-tinta">
            Partir del ejemplo de un sector <span className="font-normal text-muted">(opcional)</span>
          </label>
          <select id={ids.ejemplo} className="field mt-2 w-full" value={ejemplo} onChange={(e) => partirDe(e.target.value)}>
            <option value="">Sin ejemplo</option>
            {EJEMPLOS_DE_POLITICA.map(({ id, nombre }) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id={ids.negocio} etiqueta="Nombre del negocio">
            <input id={ids.negocio} className="field w-full" value={p.negocio} onChange={(e) => cambiar("negocio", e.target.value)} autoComplete="organization" />
          </Campo>
          <Campo id={ids.telefono} etiqueta="Teléfono para avisar">
            <input id={ids.telefono} className="field w-full" value={p.telefono} onChange={(e) => cambiar("telefono", e.target.value)} inputMode="tel" autoComplete="tel" />
          </Campo>
        </div>

        <Campo id={ids.antelacion} etiqueta="Antelación para anular sin coste">
          <select id={ids.antelacion} className="field w-full" value={p.antelacion} onChange={(e) => cambiar("antelacion", Number(e.target.value))}>
            {ANTELACIONES.map((h) => (
              <option key={h} value={h}>
                {h} horas
              </option>
            ))}
          </select>
        </Campo>

        <fieldset>
          <legend className="text-sm font-semibold text-tinta">Señal</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(
              [
                ["no", "Sin señal"],
                ["fija", "Importe fijo"],
                ["porcentaje", "Porcentaje"],
              ] as const
            ).map(([valor, texto]) => (
              <Opcion key={valor} nombre="senal" valor={valor} actual={p.senal} onElegir={(v) => cambiar("senal", v)}>
                {texto}
              </Opcion>
            ))}
          </div>
          {p.senal !== "no" ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Campo id={ids.cantidad} etiqueta={p.senal === "fija" ? "Importe (€)" : "Porcentaje del precio (%)"}>
                <input id={ids.cantidad} type="number" min={1} className="field w-full" value={p.cantidad} onChange={(e) => cambiar("cantidad", e.target.value)} />
              </Campo>
              <Campo id={ids.ambito} etiqueta="A qué citas">
                <select id={ids.ambito} className="field w-full" value={p.ambito} onChange={(e) => cambiar("ambito", e.target.value as Ambito)}>
                  <option value="todas">A todas</option>
                  <option value="largos">Solo a servicios largos</option>
                  <option value="nuevos">Solo a la primera cita</option>
                </select>
              </Campo>
              {p.ambito === "largos" ? (
                <Campo id={ids.minutos} etiqueta="Largo es más de (minutos)">
                  <input id={ids.minutos} type="number" min={15} step={15} className="field w-full" value={p.minutosLargos} onChange={(e) => cambiar("minutosLargos", e.target.value)} />
                </Campo>
              ) : null}
              <label className="flex items-start gap-3 text-sm leading-6 text-tinta sm:col-span-2">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-morado" checked={p.reciproca} onChange={(e) => cambiar("reciproca", e.target.checked)} />
                Si anulamos nosotros, devolvemos la señal y otra cantidad igual
              </label>
              <p className="text-xs leading-5 text-muted sm:col-span-2">
                La ley no fija un porcentaje máximo: pide que no sea desproporcionada. Una parte del precio que cubra el
                hueco perdido se defiende mejor que el precio entero.
              </p>
            </div>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-tinta">Si alguien no viene sin avisar</legend>
          <div className="mt-2 grid gap-2">
            {(
              [
                ["aviso", "Le escribimos para recordarle la política"],
                ["senal", "Le pedimos señal para la siguiente cita"],
                ["dejar", "Dejamos de darle cita si falta varias veces sin avisar"],
              ] as const
            ).map(([valor, texto]) => (
              <Opcion key={valor} nombre="ausencias" valor={valor} actual={p.ausencias} onElegir={(v) => cambiar("ausencias", v)}>
                {texto}
              </Opcion>
            ))}
          </div>
          {p.ausencias === "dejar" ? (
            <div className="mt-4 max-w-[12rem]">
              <Campo id={ids.max} etiqueta="Veces sin venir">
                <input id={ids.max} type="number" min={1} max={10} className="field w-full" value={p.maxAusencias} onChange={(e) => cambiar("maxAusencias", e.target.value)} />
              </Campo>
            </div>
          ) : null}
        </fieldset>

        <Campo id={ids.retraso} etiqueta="Minutos de cortesía si llegan tarde (0 = no decir nada)">
          <input id={ids.retraso} type="number" min={0} max={60} step={5} className="field w-28" value={p.retraso} onChange={(e) => cambiar("retraso", e.target.value)} />
        </Campo>

        <fieldset>
          <legend className="text-sm font-semibold text-tinta">Cómo te avisan</legend>
          <div className="mt-2 space-y-2 text-sm text-tinta">
            {(
              [
                ["porWhatsapp", "Respondiendo al WhatsApp de confirmación"],
                ["porTelefono", "Llamando por teléfono"],
                ["enElLocal", "En el mostrador"],
              ] as const
            ).map(([campo, texto]) => (
              <label key={campo} className="flex items-center gap-3">
                <input type="checkbox" className="h-4 w-4 accent-morado" checked={p[campo]} onChange={(e) => cambiar(campo, e.target.checked)} />
                {texto}
              </label>
            ))}
          </div>
        </fieldset>
      </form>

      <div className="space-y-4">
        <Resultado icono={StickyNote} titulo="Para el cartel del mostrador" texto={textos.cartel} />
        <Resultado icono={FileText} titulo="Para tu web o tu perfil" texto={textos.web} />
        <Resultado icono={MessageCircle} titulo="Para el final del mensaje de confirmación" texto={textos.confirmacion} />
      </div>
    </div>
  );
}

function Campo({ id, etiqueta, children }: { id: string; etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-tinta">
        {etiqueta}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Opcion<T extends string>({
  nombre,
  valor,
  actual,
  onElegir,
  children,
}: {
  nombre: string;
  valor: T;
  actual: T;
  onElegir: (valor: T) => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2.5 text-sm transition ${
        actual === valor ? "border-morado bg-lavado text-tinta" : "border-linea bg-superficie text-apagado hover:border-tinta"
      }`}
    >
      <input type="radio" name={nombre} value={valor} checked={actual === valor} onChange={() => onElegir(valor)} className="h-4 w-4 accent-morado" />
      {children}
    </label>
  );
}

function Resultado({ icono: Icono, titulo, texto }: { icono: typeof FileText; titulo: string; texto: string }) {
  return (
    <section className="panel p-5 sm:p-6" aria-label={titulo}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-tinta">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lavado text-morado">
            <Icono className="h-4 w-4" aria-hidden="true" />
          </span>
          {titulo}
        </h3>
        <BotonCopiar texto={texto} etiqueta={`el texto ${titulo.toLowerCase()}`} />
      </div>
      <p className="mt-4 whitespace-pre-line text-sm leading-6 text-tinta">{texto}</p>
    </section>
  );
}
