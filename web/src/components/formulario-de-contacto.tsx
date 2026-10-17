"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2 } from "lucide-react";
import { enviarContacto } from "@/lib/api";
import { medirEvento } from "@/components/google-analytics";
import {
  describirErrorDeContacto,
  OPCIONES_DE_SEDES,
  type CampoDeContacto,
  type ErrorDeContacto,
  type Sedes,
} from "@/lib/contacto";
import { contactEmail } from "@/lib/seo";

type Valores = Record<Exclude<CampoDeContacto, "sedes">, string>;

const VACIO: Valores = { nombre: "", email: "", telefono: "", negocio: "", mensaje: "" };

const etiqueta = "text-sm font-medium text-tinta-2";
const opcional = "font-normal text-muted";

/**
 * «Hablar con nosotros»: llega por correo a hola@alhabla.ai (POST /contacto).
 * Teléfono y mensaje son opcionales; las sedes, no, porque deciden quién
 * contesta y cómo. Nada de lo que se escribe viaja en la URL ni en la
 * analítica: el evento `generate_lead` solo lleva las sedes.
 */
export function FormularioDeContacto() {
  const [valores, setValores] = useState<Valores>(VACIO);
  const [sedes, setSedes] = useState<Sedes | null>(null);
  // Trampa para bots: fuera de la vista; una persona no la ve ni la rellena.
  const [sitioWeb, setSitioWeb] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<{ nombre: string; email: string } | null>(null);
  const [error, setError] = useState<ErrorDeContacto | null>(null);
  const confirmacion = useRef<HTMLHeadingElement>(null);
  const resumenDeError = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (enviado) confirmacion.current?.focus();
  }, [enviado]);

  useEffect(() => {
    if (error) resumenDeError.current?.focus();
  }, [error]);

  const cambiar = (campo: keyof Valores) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValores((actuales) => ({ ...actuales, [campo]: e.target.value }));

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sedes) {
      const mensaje = "Indica cuántas sedes tenéis.";
      setError({ general: mensaje, campos: { sedes: mensaje } });
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await enviarContacto({
        nombre: valores.nombre,
        email: valores.email,
        telefono: valores.telefono || undefined,
        negocio: valores.negocio,
        sedes,
        mensaje: valores.mensaje || undefined,
        sitioWeb: sitioWeb || undefined,
      });
      medirEvento("generate_lead", { formulario: "contacto", sedes });
      setEnviado({ nombre: valores.nombre.trim(), email: valores.email.trim() });
    } catch (fallo) {
      setError(describirErrorDeContacto(fallo, contactEmail));
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 py-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-lavado text-morado">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 ref={confirmacion} tabIndex={-1} className="text-2xl font-bold tracking-tight text-tinta focus:outline-none">
          Mensaje enviado
        </h2>
        <p className="max-w-md text-base leading-7 text-muted">
          Gracias, {enviado.nombre}. Lo hemos recibido y te contestaremos a{" "}
          <strong className="font-semibold text-tinta">{enviado.email}</strong>
          {valores.telefono ? " o por teléfono" : ""}.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href="/planes" className="btn-primary">
            Ver planes
          </Link>
          <Link href="/" className="btn-secondary">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const errorDe = (campo: CampoDeContacto) => error?.campos[campo];
  const describir = (campo: CampoDeContacto) => (errorDe(campo) ? `contacto-${campo}-error` : undefined);
  const mensajeDeCampo = (campo: CampoDeContacto) =>
    errorDe(campo) ? (
      <p id={`contacto-${campo}-error`} className="mt-1.5 text-xs leading-5 text-error">
        {errorDe(campo)}
      </p>
    ) : null;

  return (
    <form className="space-y-5" onSubmit={enviar}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contacto-nombre" className={etiqueta}>
            Nombre
          </label>
          <input
            id="contacto-nombre"
            name="nombre"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            className="field mt-2 w-full"
            value={valores.nombre}
            onChange={cambiar("nombre")}
            aria-invalid={errorDe("nombre") ? true : undefined}
            aria-describedby={describir("nombre")}
          />
          {mensajeDeCampo("nombre")}
        </div>
        <div>
          <label htmlFor="contacto-email" className={etiqueta}>
            Email
          </label>
          <input
            id="contacto-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            className="field mt-2 w-full"
            placeholder="tucorreo@dominio.com"
            value={valores.email}
            onChange={cambiar("email")}
            aria-invalid={errorDe("email") ? true : undefined}
            aria-describedby={describir("email")}
          />
          {mensajeDeCampo("email")}
        </div>
        <div>
          <label htmlFor="contacto-telefono" className={etiqueta}>
            Teléfono <span className={opcional}>(opcional)</span>
          </label>
          <input
            id="contacto-telefono"
            name="telefono"
            type="tel"
            maxLength={30}
            autoComplete="tel"
            inputMode="tel"
            className="field mt-2 w-full"
            placeholder="600 123 456"
            value={valores.telefono}
            onChange={cambiar("telefono")}
            aria-invalid={errorDe("telefono") ? true : undefined}
            aria-describedby={describir("telefono")}
          />
          {mensajeDeCampo("telefono")}
        </div>
        <div>
          <label htmlFor="contacto-negocio" className={etiqueta}>
            Negocio
          </label>
          <input
            id="contacto-negocio"
            name="negocio"
            required
            minLength={2}
            maxLength={120}
            autoComplete="organization"
            className="field mt-2 w-full"
            placeholder="Nombre de tu negocio"
            value={valores.negocio}
            onChange={cambiar("negocio")}
            aria-invalid={errorDe("negocio") ? true : undefined}
            aria-describedby={describir("negocio")}
          />
          {mensajeDeCampo("negocio")}
        </div>
      </div>

      <fieldset aria-describedby={describir("sedes")}>
        <legend className={etiqueta}>¿Cuántas sedes tenéis?</legend>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {OPCIONES_DE_SEDES.map((opcion) => (
            <label key={opcion.valor} className="group relative block cursor-pointer">
              <input
                type="radio"
                name="sedes"
                value={opcion.valor}
                required
                className="peer sr-only"
                checked={sedes === opcion.valor}
                onChange={() => setSedes(opcion.valor)}
              />
              <span className="flex h-11 items-center justify-center gap-2 rounded-full border border-linea bg-superficie text-sm font-semibold text-tinta-2 transition peer-checked:border-morado peer-checked:bg-lavado peer-checked:text-morado-tinta peer-focus-visible:ring-4 peer-focus-visible:ring-morado/30 peer-focus-visible:ring-offset-2 group-hover:border-morado">
                {sedes === opcion.valor ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                {opcion.etiqueta}
              </span>
            </label>
          ))}
        </div>
        {mensajeDeCampo("sedes")}
      </fieldset>

      <div>
        <label htmlFor="contacto-mensaje" className={etiqueta}>
          ¿En qué te podemos ayudar? <span className={opcional}>(opcional)</span>
        </label>
        <textarea
          id="contacto-mensaje"
          name="mensaje"
          rows={4}
          maxLength={2000}
          className="field mt-2 h-auto min-h-28 w-full py-3 leading-6"
          placeholder="Cuántas llamadas recibís, qué calendario usáis, qué dudas tienes…"
          value={valores.mensaje}
          onChange={cambiar("mensaje")}
          aria-invalid={errorDe("mensaje") ? true : undefined}
          aria-describedby={describir("mensaje")}
        />
        {mensajeDeCampo("mensaje")}
      </div>

      {/* Trampa para bots: fuera de la pantalla, sin tabulación y oculta a
          los lectores de pantalla. `display: none` no vale: muchos bots se
          saltan los campos ocultos así. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="contacto-sitio-web">Deja este campo vacío</label>
        <input
          id="contacto-sitio-web"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={sitioWeb}
          onChange={(e) => setSitioWeb(e.target.value)}
        />
      </div>

      {/* Alto reservado: el error no desplaza el botón al reintentar. */}
      <p ref={resumenDeError} tabIndex={-1} role="alert" className="min-h-5 text-sm text-error focus:outline-none">
        {error?.general}
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <button type="submit" disabled={enviando} className="btn-primary w-full shrink-0 sm:w-auto">
          {enviando ? "Enviando…" : "Enviar mensaje"}
        </button>
        <p id="contacto-privacidad" className="text-xs leading-5 text-muted">
          Responsable: Miguel Martín Delgado (Alhabla). Usamos tus datos solo para contestar a tu consulta, porque
          nos la pides tú. No los cedemos a terceros; nos llegan por correo a través de Zoho Mail, nuestro proveedor.
          Puedes acceder a ellos, corregirlos o pedir que los borremos en privacidad@alhabla.ai. Más en la{" "}
          <Link
            href="/legal/privacidad#contacto"
            className="rounded font-medium text-morado-tinta underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-morado"
          >
            política de privacidad
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
