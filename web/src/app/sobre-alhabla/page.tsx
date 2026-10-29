import { Heart } from "lucide-react";
import { ListaCheck, PaginaGuia, Seccion, Texto } from "@/components/pagina-guia";
import { absoluteUrl, contactEmail, metadataDePagina, organizationId } from "@/lib/seo";

/**
 * Sobre Alhabla (2026-10-20; a la mitad desde el 2026-10-29): quién está
 * detrás, su promesa con sus palabras y la regla de confianza, para quien
 * compra y para los buscadores (E-E-A-T). Solo datos que ya son públicos: el
 * titular y el domicilio profesional salen del aviso legal. Sin cifras de
 * clientes: todavía no hay casos que se puedan contar.
 */
const ruta = "/sobre-alhabla";
const titulo = "Sobre Alhabla: quién está detrás y por qué";
const descripcion =
  "«No quiero que nadie pierda ninguna llamada.» Alhabla nace en Sant Celoni (Barcelona) para los negocios con cita. Quién la hace y qué no hará nunca.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function SobrePage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="AboutPage"
      migas={[{ name: "Sobre Alhabla", path: ruta }]}
      etiqueta={{ icono: Heart, texto: "Sobre Alhabla" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="sobre"
      cta={{ texto: "Hablar con nosotros", href: "/contacto" }}
      ctaSecundario={{ texto: "Ver planes", href: "/planes" }}
      grafo={[
        {
          "@type": "Person",
          "@id": `${absoluteUrl(ruta)}#fundador`,
          name: "Miguel Martín Delgado",
          jobTitle: "Fundador",
          worksFor: { "@id": organizationId() },
        },
        {
          "@type": "Organization",
          "@id": organizationId(),
          founder: { "@id": `${absoluteUrl(ruta)}#fundador` },
          foundingDate: "2026",
          address: { "@type": "PostalAddress", addressLocality: "Sant Celoni", addressRegion: "Barcelona", addressCountry: "ES" },
          email: contactEmail,
        },
      ]}
      entradilla={
        <p>
          «No quiero que nadie pierda ninguna llamada.» Así resume Miguel Martín, fundador de Alhabla, por qué existe: en
          una peluquería, una cabina de estética o una camilla de fisioterapia, el teléfono suena justo cuando no se puede
          coger.
        </p>
      }
      faqs={[
        {
          question: "¿Quién hay detrás de Alhabla?",
          answer:
            "Alhabla la hace Miguel Martín Delgado, como autónomo, desde Sant Celoni (Barcelona). Los datos del titular están en el aviso legal.",
        },
        {
          question: "¿Desde cuándo existe?",
          answer:
            "Desde 2026. Las primeras llamadas por teléfono, en un número real, se atendieron en septiembre, y en la página de novedades contamos, mes a mes, lo que hemos ido mejorando.",
        },
        {
          question: "¿Puedo hablar con una persona antes de contratar?",
          answer: `Sí. Escríbenos desde el formulario de contacto o por WhatsApp, o a ${contactEmail}. Te contesta una persona del equipo.`,
        },
      ]}
      relacionadas={[
        { href: "/novedades", titulo: "Novedades", texto: "Qué ha cambiado en Alhabla, mes a mes." },
        { href: "/prensa", titulo: "Prensa", texto: "Datos, logotipos y contacto para medios." },
        { href: "/guias/ley-y-recepcionista-de-ia", titulo: "La ley y la recepcionista de IA" },
        { href: "/legal/aviso-legal", titulo: "Aviso legal" },
      ]}
      cierre="Ninguna llamada sin respuesta, y tu agenda siempre en tus manos."
    >
      <Seccion titulo="Con tus clientes manda Alhabla. Con tu agenda mandas tú." estrecha>
        <Texto>
          <p>
            Lo único que hace sin preguntarte es atender a tus clientes: reservar, cambiar o cancelar su cita cuando te
            lo piden por teléfono o por WhatsApp. Todo lo que toca tu negocio te lo propone y espera a tu «Confirmar».
          </p>
        </Texto>
        <div className="mt-5">
          <ListaCheck
            items={[
              "Nunca se hace pasar por una persona: lo dice en la primera frase de cada llamada.",
              "Nunca reserva a ciegas: si no puede comprobar tu agenda, no da la hora.",
              "Nunca graba sin permiso: si el cliente dice que no, no se guarda el audio.",
              "Nunca cambia tu agenda por su cuenta: lo que le pides a tu asistente espera a que pulses «Confirmar».",
              "Nunca manda publicidad a tus clientes en nombre de tu negocio.",
            ]}
          />
        </div>
      </Seccion>

      <Seccion fondo titulo="Cómo nació" estrecha>
        <Texto>
          <p>
            La idea empezó pensando en bares. Acabó en los negocios con cita (peluquerías, barberías, estética,
            fisioterapia) porque ahí cada llamada es una cita concreta y se podía hacer bien desde el primer día.
          </p>
          <p>
            Nace en Sant Celoni, en el Vallès Oriental, pensada para cómo se trabaja aquí: el tuteo, los horarios
            partidos, las lenguas cooficiales y el WhatsApp como canal de todo. Si tienes un negocio y quieres contarnos
            cómo es tu día, nos encantará escucharte.
          </p>
        </Texto>
      </Seccion>
    </PaginaGuia>
  );
}
