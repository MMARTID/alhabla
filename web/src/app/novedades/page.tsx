import { Sparkles } from "lucide-react";
import { PaginaGuia, Seccion } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Novedades del producto (2026-10-20), sacadas de los PR fusionados en main
 * (git log). Solo lo que nota un negocio o su cliente; nada interno
 * (infraestructura, migraciones, documentación). Añadir arriba cada mes y
 * actualizar `actualizado` en lib/paginas.ts: es la página que más cambia y
 * le dice a Google que el sitio está vivo.
 */
const ruta = "/novedades";
const titulo = "Novedades de Alhabla, mes a mes";
const descripcion =
  "Lo que ha cambiado en tu recepcionista de IA: idiomas nuevos, aviso de IA, grabación con permiso, precios y mejoras de la agenda y el WhatsApp.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

type Novedad = { titulo: string; texto: string };
const MESES: { mes: string; fecha: string; novedades: Novedad[] }[] = [
  {
    mes: "Octubre de 2026",
    fecha: "2026-10",
    novedades: [
      {
        titulo: "Precios más claros y con más minutos",
        texto: "Los planes se publican sin IVA, como en el resto del sector, y suben los minutos: Inicio 59 € con 200, Pro 139 € con 600 y Scale 269 € con 1.500. Los 15 primeros negocios tienen precio de fundador.",
      },
      {
        titulo: "Hablar con una persona antes de contratar",
        texto: "Nuevo formulario de contacto y WhatsApp del equipo para resolver dudas sin compromiso.",
      },
      {
        titulo: "Grabación solo con permiso",
        texto: "La recepcionista pide permiso para grabar mientras busca hueco y explica para qué. A quien ya aceptó se lo recuerda al descolgar; si dice que no, solo queda la transcripción.",
      },
      {
        titulo: "Te reconoce si ya has llamado",
        texto: "A quien ya reservó con ese teléfono lo saluda por su nombre y le propone repetir lo de la última vez.",
      },
      {
        titulo: "Aviso de inteligencia artificial en la primera frase",
        texto: "Desde el 2 de agosto de 2026 la ley europea lo exige: cada llamada empieza diciendo el nombre del negocio y que atiende una inteligencia artificial, en el idioma del saludo.",
      },
      {
        titulo: "Ruso, y cada cliente en su idioma",
        texto: "Se suma el ruso a los idiomas de todos los planes, la recepcionista recuerda en qué idioma habla cada cliente y nombra los servicios en ese idioma.",
      },
      {
        titulo: "La hora libre más cercana",
        texto: "Si no hay hueco a la hora que pide el cliente, ofrece la más próxima en lugar de preguntar otra vez.",
      },
      {
        titulo: "Si algo falla, toma el recado",
        texto: "Si un problema técnico impide reservar, la recepcionista no cuelga sin más: toma nota y te avisa para que llames tú.",
      },
      {
        titulo: "Catalán, euskera y gallego, automáticos",
        texto: "La lengua cooficial se activa sola por el código postal del negocio, con voces que la hablan de verdad, y se puede elegir como idioma principal.",
      },
      {
        titulo: "Panel nuevo, también en el móvil y en modo oscuro",
        texto: "El panel se rediseña para el escritorio y el móvil, y sigue el modo claro u oscuro de tu dispositivo.",
      },
      {
        titulo: "El Gestor entiende notas de voz",
        texto: "Puedes mandarle un audio por WhatsApp en lugar de escribir: lo entiende igual que un mensaje.",
      },
    ],
  },
  {
    mes: "Septiembre de 2026",
    fecha: "2026-09",
    novedades: [
      {
        titulo: "El Gestor por WhatsApp",
        texto: "El dueño cambia horarios, ausencias, precios y citas escribiendo a Alhabla por WhatsApp. Nada cambia sin su «Confirmar».",
      },
      {
        titulo: "Outlook y Calendario de Apple",
        texto: "Además de Google Calendar, las citas pueden entrar en Outlook o en el calendario de iCloud del iPhone. En Google ya se puede elegir en qué calendario.",
      },
      {
        titulo: "Cada servicio, con quien mejor lo hace",
        texto: "Marcas por profesional quién es especialista, quién lo hace y a quién reservar solo si lo piden, y la recepcionista reparte así las citas.",
      },
      {
        titulo: "Cambiar una cita sin llamar",
        texto: "El cliente puede mover o cancelar su cita respondiendo al WhatsApp de confirmación.",
      },
      {
        titulo: "Escucha la demo en la web",
        texto: "En cada página de sector puedes hablar con una recepcionista de ejemplo desde el navegador, sin registrarte.",
      },
      {
        titulo: "Primeras llamadas reales",
        texto: "Alhabla atiende sus primeras llamadas de clientes reales y abre el registro a negocios de toda España.",
      },
    ],
  },
];

export default function NovedadesPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="CollectionPage"
      migas={[{ name: "Novedades", path: ruta }]}
      etiqueta={{ icono: Sparkles, texto: "Novedades" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="novedades"
      imagen={null}
      entradilla={
        <p>
          Alhabla mejora cada semana con lo que vemos en las llamadas reales y lo que nos cuentan los negocios. Aquí está
          lo que ha cambiado y notarás, sin tecnicismos. Si echas algo en falta, escríbenos: muchas de estas mejoras
          empezaron así.
        </p>
      }
      relacionadas={[
        { href: "/sobre-alhabla", titulo: "Sobre Alhabla" },
        { href: "/integraciones", titulo: "Integraciones" },
        { href: "/contacto", titulo: "Proponer una mejora" },
      ]}
    >
      {MESES.map(({ mes, fecha, novedades }, i) => (
        <Seccion key={fecha} titulo={mes} fondo={i % 2 === 1} estrecha>
          <ol className="space-y-5 border-l-2 border-lavado-borde pl-6">
            {novedades.map(({ titulo: t, texto }) => (
              <li key={t} className="relative">
                <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-morado" aria-hidden="true" />
                <h3 className="text-base font-bold text-tinta">{t}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{texto}</p>
              </li>
            ))}
          </ol>
        </Seccion>
      ))}
    </PaginaGuia>
  );
}
