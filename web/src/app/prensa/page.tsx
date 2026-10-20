import Image from "next/image";
import { Download, Newspaper } from "lucide-react";
import { PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { plans, TRIAL_DAYS } from "@/lib/plans";
import { contactEmail, metadataDePagina } from "@/lib/seo";

/**
 * Sala de prensa (2026-10-20). HeyDiga, fonio y Habla tienen la suya y salen
 * en medios; Alhabla todavía no ha salido en ninguno, así que aquí no hay
 * «Alhabla en los medios» inventado: solo el kit para que un periodista
 * pueda escribir sin pedir nada (texto, datos, logotipos y contacto).
 */
const ruta = "/prensa";
const titulo = "Prensa: datos, logotipos y contacto de Alhabla";
const descripcion =
  "Kit de prensa de Alhabla, la recepcionista de IA para negocios con cita previa: descripción, datos clave, logotipos para descargar y contacto.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const desde = plans[0].price;

export default function PrensaPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Prensa", path: ruta }]}
      etiqueta={{ icono: Newspaper, texto: "Sala de prensa" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="prensa"
      imagen={null}
      cta={null}
      ctaSecundario={{ texto: "Escribir a prensa", href: `mailto:${contactEmail}?subject=Prensa` }}
      entradilla={
        <p>
          Si estás escribiendo sobre inteligencia artificial en el pequeño comercio, el sector de la belleza o las
          lenguas cooficiales en la atención al cliente, aquí tienes lo que necesitas sobre Alhabla. Puedes usar los
          textos y los logotipos libremente para hablar de nosotros.
        </p>
      }
      relacionadas={[
        { href: "/sobre-alhabla", titulo: "Sobre Alhabla" },
        { href: "/novedades", titulo: "Novedades del producto" },
        { href: "/guias/ley-y-recepcionista-de-ia", titulo: "La ley y la recepcionista de IA", texto: "El artículo 50 del Reglamento de IA explicado para pequeños negocios." },
      ]}
    >
      <Seccion titulo="Alhabla en una frase y en un párrafo" estrecha>
        <div className="space-y-6">
          <div className="panel p-6">
            <p className="text-sm font-semibold text-morado-tinta">En una frase</p>
            <p className="mt-2 text-base leading-7 text-tinta">
              Alhabla es una recepcionista de inteligencia artificial que contesta el teléfono de peluquerías, barberías,
              centros de estética y clínicas de fisioterapia cuando el equipo no puede, reserva en su agenda y confirma la
              cita por WhatsApp.
            </p>
          </div>
          <div className="panel p-6">
            <p className="text-sm font-semibold text-morado-tinta">En un párrafo</p>
            <p className="mt-2 text-base leading-7 text-tinta">
              Alhabla nace en 2026 en Sant Celoni (Barcelona) para que ningún negocio de barrio pierda un cliente por tener
              las manos ocupadas. El negocio conserva su número de teléfono y desvía a Alhabla las llamadas que no puede
              coger. La recepcionista avisa de que es una inteligencia artificial, consulta la agenda real en Google
              Calendar, Outlook o iCloud, reserva con el profesional adecuado y envía la confirmación por WhatsApp. Atiende
              en castellano, catalán, euskera, gallego y ocho idiomas más, y el dueño cambia su agenda escribiéndole por
              WhatsApp. Cuesta desde {desde} € al mes más IVA, sin permanencia.
            </p>
          </div>
        </div>
      </Seccion>

      <Seccion fondo titulo="Datos clave">
        <Tabla
          cabecera={["Dato", "Alhabla"]}
          filas={[
            ["Nombre", "Alhabla"],
            ["Qué es", "Recepcionista de IA por teléfono y WhatsApp para negocios con cita previa"],
            ["Origen", "Sant Celoni (Barcelona), 2026"],
            ["Titular", "Miguel Martín Delgado (autónomo)"],
            ["Sectores", "Peluquerías, barberías, salones de uñas, centros de estética, fisioterapia, pestañas y cejas, spa y masajes, peluquería canina"],
            ["Idiomas", "Castellano, catalán, euskera, gallego, inglés, francés, alemán, italiano, portugués, neerlandés y ruso"],
            ["Calendarios", "Google Calendar, Outlook y Calendario de Apple (iCloud)"],
            ["Precio", `Desde ${desde} € + IVA al mes; ${TRIAL_DAYS} días de prueba; sin permanencia`],
            ["Web", "alhabla.ai"],
            ["Contacto de prensa", contactEmail],
          ]}
        />
      </Seccion>

      <Seccion titulo="Logotipos">
        <div className="grid gap-4 sm:grid-cols-2">
          <figure className="panel flex flex-col items-center gap-4 p-8">
            <Image src="/brand/alhabla-isotipo.svg" alt="Isotipo de Alhabla" width={120} height={120} unoptimized className="h-28 w-28" />
            <figcaption className="text-center text-sm text-muted">Isotipo en SVG, para cualquier tamaño.</figcaption>
            <a href="/brand/alhabla-isotipo.svg" download className="btn-secondary h-10 px-4 text-sm">
              <Download className="h-4 w-4" aria-hidden="true" /> Descargar SVG
            </a>
          </figure>
          <figure className="panel flex flex-col items-center gap-4 p-8">
            <Image src="/brand/alhabla-isotipo.png" alt="Isotipo de Alhabla en PNG" width={120} height={120} unoptimized className="h-28 w-28" />
            <figcaption className="text-center text-sm text-muted">Isotipo en PNG de alta resolución.</figcaption>
            <a href="/brand/alhabla-isotipo.png" download className="btn-secondary h-10 px-4 text-sm">
              <Download className="h-4 w-4" aria-hidden="true" /> Descargar PNG
            </a>
          </figure>
        </div>
        <div className="mt-6">
          <Texto>
            <p>
              El nombre se escribe Alhabla, con mayúscula inicial y todo junto. Colores de marca: negro tinta (#0a0a0a),
              blanco y morado (#8b5cf6). Por favor, no deformes el isotipo ni lo pongas sobre fondos que no dejen leerlo.
            </p>
          </Texto>
        </div>
      </Seccion>

      <Seccion fondo titulo="Temas sobre los que podemos hablar" estrecha>
        <Texto>
          <ul className="list-disc space-y-2 pl-5">
            <li>Cuántas citas pierde un pequeño negocio por no coger el teléfono y por qué pasa en las horas de más trabajo.</li>
            <li>Qué cambia para un comercio el aviso obligatorio de inteligencia artificial desde el 2 de agosto de 2026.</li>
            <li>Atender en catalán, euskera y gallego con IA: lo que dicen los datos de uso de cada lengua.</li>
            <li>IA para autónomos: qué puede hacer hoy por menos de lo que cuesta una hora de trabajo al día.</li>
          </ul>
          <p>
            Para entrevistas, datos o una demostración en directo, escribe a{" "}
            <a href={`mailto:${contactEmail}?subject=Prensa`}>{contactEmail}</a> con «Prensa» en el asunto.
          </p>
        </Texto>
      </Seccion>
    </PaginaGuia>
  );
}
