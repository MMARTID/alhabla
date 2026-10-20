import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Check, Lightbulb, Mic, Scissors, Users } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { nicheLinks } from "@/lib/niche-landings";
import { TRIAL_REASSURANCE } from "@/lib/plans";
import {
  absoluteUrl,
  buildBreadcrumbStructuredData,
  buildFaqPageStructuredData,
  ogImages,
  siteName,
  websiteId,
} from "@/lib/seo";

/**
 * El Gestor por WhatsApp, 2026-10-20: lo que ningún competidor ofrece (el
 * dueño cambia su agenda escribiendo o con notas de voz). La ruta no puede
 * ser /gestor: next.config.mjs la redirige a la app.
 *
 * Cada ejemplo sale de una acción o tool real del Gestor
 * (backend/src/modules/gestor): listar_agenda, buscar_hueco, anadir_cita,
 * mover_cita, cancelar_cita, avisar_cliente, marcar_ausencia (propone a quién
 * pasar las citas), bloquear_franja, cerrar_dia (con `hastaFecha` para
 * vacaciones), fijar_horario, editar_servicio, retirar_servicio,
 * crear_profesionales, fijar_especialidad, dudas_sin_respuesta +
 * actualizar_informacion («enseñar a la recepcionista»). Toda acción pasa por
 * proponer_accion y espera el «Confirmar». Las notas de voz llegan
 * transcritas por Telnyx (modules/whatsapp/router.ts); el idioma de la
 * respuesta lo fija lib/gestorPayload.ts.
 */

const titulo = "Gestiona tu agenda por WhatsApp con IA";
const descripcion =
  "Escríbele o mándale una nota de voz a tu Gestor: mueve citas, marca una baja o cambia un precio. Te propone el cambio y no hace nada sin tu «Confirmar».";
const ruta = "/agenda-por-whatsapp";

export const metadata: Metadata = {
  title: titulo,
  description: descripcion,
  alternates: { canonical: absoluteUrl(ruta) },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: absoluteUrl(ruta),
    siteName,
    title: `${titulo} | ${siteName}`,
    description: descripcion,
    images: ogImages(ruta, `${titulo} | ${siteName}`),
  },
  twitter: {
    card: "summary_large_image",
    title: `${titulo} | ${siteName}`,
    description: descripcion,
    images: ogImages(ruta, `${titulo} | ${siteName}`),
  },
};

const grupos = [
  {
    titulo: "Tu agenda",
    icono: CalendarClock,
    ejemplos: [
      "«¿Qué tengo mañana?»",
      "«¿Cuándo hay hueco para un tinte el jueves?»",
      "«Apúntame a Carmen el viernes a las 17:00 para corte»",
      "«Mueve la cita de las 5 al sábado y avísale»",
    ],
  },
  {
    titulo: "Tu equipo",
    icono: Users,
    ejemplos: [
      "«Marta no viene mañana»: te propone a quién pasar sus citas",
      "«Laura es la especialista en color»",
      "«Ha entrado Pablo, hace cortes de caballero»",
    ],
  },
  {
    titulo: "Horario y servicios",
    icono: Scissors,
    ejemplos: [
      "«Cerramos el sábado por la tarde»",
      "«Vacaciones del 1 al 15 de agosto»",
      "«Los martes abrimos a las 10»",
      "«El corte de caballero pasa a 18 €» o «ya no hacemos alisado»",
    ],
  },
  {
    titulo: "Lo que tu recepcionista no supo",
    icono: Lightbulb,
    ejemplos: [
      "«¿Qué te han preguntado que no supiste?»",
      "«Sí, aceptamos Bizum»: y a partir de ahí lo contesta ella",
    ],
  },
] as const;

const faqs = [
  {
    question: "¿Necesito WhatsApp Business?",
    answer:
      "No. Hablas con tu Gestor desde tu WhatsApp de siempre: es un chat más, con el número de Alhabla. Lo activas en Ajustes › Teléfono › Tu móvil enviando un mensaje que ya viene escrito.",
  },
  {
    question: "¿Puede cambiar algo sin que yo lo sepa?",
    answer:
      "No. Te propone cada cambio con lo que va a hacer y espera a que pulses «Confirmar». Si no confirmas, no toca nada.",
  },
  {
    question: "¿Le puedo hablar en vez de escribir?",
    answer:
      "Sí. Le mandas una nota de voz como a cualquier contacto y la entiende igual que un mensaje escrito. Si no se pudo entender, te lo dice.",
  },
  {
    question: "¿Y si prefiero hacerlo desde el ordenador?",
    answer: "El mismo Gestor está en tu panel web, con la agenda al lado. Lo que hagas en un sitio se ve en el otro.",
  },
  {
    question: "¿Está en todos los planes?",
    answer: "Sí. El Gestor por WhatsApp va incluido en todos los planes, también en el de entrada.",
  },
  {
    question: "¿En qué idioma me contesta?",
    answer: "En castellano, o en catalán, gallego, euskera o inglés si le escribes en ese idioma.",
  },
];

const datosEstructurados = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${absoluteUrl(ruta)}#webpage`,
      name: `${titulo} | ${siteName}`,
      description: descripcion,
      url: absoluteUrl(ruta),
      inLanguage: "es-ES",
      isPartOf: { "@id": websiteId() },
    },
    buildBreadcrumbStructuredData([{ name: "Agenda por WhatsApp", path: ruta }]),
    buildFaqPageStructuredData(faqs),
  ],
};

export default function AgendaPorWhatsappPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="min-h-screen bg-white text-tinta">
        <nav aria-label="Migas de pan" className="mx-auto max-w-5xl px-4 pt-6 text-sm text-muted sm:px-6 lg:px-8">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-tinta">
                Inicio
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-tinta">
              Agenda por WhatsApp
            </li>
          </ol>
        </nav>

        <section className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.1fr_1fr] lg:px-8">
          <div>
            <span className="badge-soft">Tu Gestor · incluido en todos los planes</span>
            <h1 className="mt-5 text-balance text-4xl font-black leading-[1.05] tracking-[-0.03em] sm:text-5xl">
              {titulo}
            </h1>
            <p className="mt-5 text-lg leading-8 text-muted">
              Tu recepcionista de IA atiende a tus clientes. Tu Gestor te atiende a ti: le escribes o le mandas una nota
              de voz por WhatsApp lo que cambia en el día a día, te propone el cambio y, cuando pulsas «Confirmar», queda
              en tu agenda.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/planes" className="btn-primary h-12 px-6" data-evento="clic_probar" data-ubicacion="gestor">
                Probar Alhabla 7 días <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="#que-pedirle" className="btn-secondary h-12 px-6">
                Qué le puedes pedir
              </Link>
            </div>
            <p className="mt-3 text-sm text-muted">{TRIAL_REASSURANCE}</p>
          </div>

          <figure className="panel p-6" aria-label="Ejemplo de conversación con el Gestor">
            <ol className="space-y-3 text-sm leading-6">
              <li className="ml-8 rounded-2xl border border-[#e5e5e5] px-4 py-3 text-tinta">Marta no viene mañana, está con fiebre</li>
              <li className="rounded-2xl bg-lavado px-4 py-3 text-tinta">
                Entendido, dejo de ofrecer hueco con Marta. Tenía unas mechas a las 11:00: ¿se las paso a Laura, que tiene
                hueco a esa hora?
              </li>
              <li className="ml-8 flex justify-end gap-2">
                <span className="rounded-[10px] bg-tinta px-3 py-1.5 text-xs font-semibold text-white">Confirmar</span>
                <span className="rounded-[10px] border border-[#e5e5e5] px-3 py-1.5 text-xs font-semibold text-tinta">
                  Cancelar
                </span>
              </li>
              <li className="rounded-2xl bg-lavado px-4 py-3 text-tinta">
                Hecho ✓ Las mechas de las 11:00 ya están con Laura. ¿Aviso a la clienta por WhatsApp?
              </li>
            </ol>
            <figcaption className="mt-4 text-xs leading-5 text-muted">
              Ejemplo ilustrativo; los nombres son inventados.
            </figcaption>
          </figure>
        </section>

        <section id="que-pedirle" className="scroll-m-20 border-y border-[#e5e5e5] py-14 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Lo que le puedes pedir, como a una persona.</h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
              Sin menús ni formularios: le hablas como le hablarías a quien lleva tu mostrador. Estos son ejemplos de lo
              que entiende hoy.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {grupos.map(({ titulo: tituloGrupo, icono: Icono, ejemplos }) => (
                <li key={tituloGrupo} className="panel p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lavado text-morado">
                    <Icono className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-tinta">{tituloGrupo}</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
                    {ejemplos.map((ejemplo) => (
                      <li key={ejemplo} className="flex items-start gap-2">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-morado" aria-hidden="true" />
                        {ejemplo}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="panel p-6">
              <h2 className="text-lg font-bold text-tinta">Nada cambia sin tu «Confirmar»</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Antes de tocar la agenda te dice exactamente qué va a hacer. Si no confirmas, no pasa nada.
              </p>
            </div>
            <div className="panel p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lavado text-morado">
                <Mic className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-tinta">También con notas de voz</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Con las manos ocupadas, mándale un audio. Lo entiende igual que un mensaje escrito.
              </p>
            </div>
            <div className="panel p-6">
              <h2 className="text-lg font-bold text-tinta">Y te avisa de cada cita nueva</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Cuando tu recepcionista de IA reserva una cita, te llega el aviso al mismo WhatsApp.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-[#e5e5e5] py-14 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Preguntas sobre el Gestor</h2>
            <div className="mt-8 grid items-start gap-3 sm:grid-cols-2">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="group rounded-2xl border border-[#e5e5e5] bg-white p-5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-semibold leading-6 text-tinta marker:content-none">
                    {question}
                    <span className="mt-1 text-lg leading-none text-morado transition group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 border-t border-[#e5e5e5] pt-3 text-sm leading-6 text-muted">{answer}</p>
                </details>
              ))}
            </div>

            <h2 className="mt-14 text-xl font-bold text-tinta">Cómo trabaja en tu sector</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {nicheLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="btn-secondary h-10 px-4 text-sm">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-[#0a0a0a] text-white">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <h2 className="max-w-xl text-3xl font-black tracking-tight sm:text-4xl">
              Tu agenda, en el mismo sitio que tus mensajes.
            </h2>
            <Link href="/planes" className="btn-purple" data-evento="clic_probar" data-ubicacion="gestor_cierre">
              Empezar ahora <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados) }} />
    </>
  );
}
