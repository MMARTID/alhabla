import { Heart } from "lucide-react";
import { ListaCheck, PaginaGuia, Seccion, Tarjetas, Texto } from "@/components/pagina-guia";
import { absoluteUrl, contactEmail, metadataDePagina, organizationId } from "@/lib/seo";

/**
 * Sobre Alhabla (2026-10-20): quién está detrás y por qué, para la confianza
 * de quien compra y para los buscadores (E-E-A-T). Solo datos que ya son
 * públicos: el titular y el domicilio profesional salen del aviso legal; el
 * propósito y los valores, del estudio comercial del 16-10-2026. Sin cifras
 * de clientes: todavía no hay casos que se puedan contar.
 */
const ruta = "/sobre-alhabla";
const titulo = "Sobre Alhabla: quién está detrás y por qué";
const descripcion =
  "Alhabla nace en Sant Celoni (Barcelona) para que ningún negocio de barrio pierda un cliente por tener las manos ocupadas. Quién la hace y qué no hará nunca.";

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
      imagen={null}
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
          En una peluquería, una cabina de estética o una camilla de fisioterapia, el teléfono suena justo cuando no se
          puede coger. Cada llamada sin respuesta es una cita que se va a otro sitio. Alhabla existe para que el oficio y
          la atención no compitan entre sí.
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
          answer: `Sí. Escríbenos desde el formulario de contacto o por WhatsApp, o a ${contactEmail}. Respondemos nosotros, no un bot.`,
        },
      ]}
      relacionadas={[
        { href: "/novedades", titulo: "Novedades", texto: "Qué ha cambiado en Alhabla, mes a mes." },
        { href: "/prensa", titulo: "Prensa", texto: "Datos, logotipos y contacto para medios." },
        { href: "/guias/ley-y-recepcionista-de-ia", titulo: "La ley y la recepcionista de IA" },
        { href: "/legal/aviso-legal", titulo: "Aviso legal" },
      ]}
      cierre="Que tu negocio no tenga que parar para atender el teléfono."
    >
      <Seccion titulo="Por qué existe" estrecha>
        <Texto>
          <p>
            Las grandes cadenas tienen recepción: alguien cuyo trabajo es coger el teléfono. El salón de barrio, no. La
            peluquera corta, el barbero afeita y la fisioterapeuta trata, y el teléfono suena igual. Contratar a alguien
            solo para eso cuesta más de lo que factura una persona en muchos negocios pequeños, y un contestador no
            reserva nada.
          </p>
          <p>
            Alhabla pone al alcance de un autónomo una recepción que antes solo pagaban los grandes: atiende a cualquier
            hora, mira la agenda real, reserva con quien toca y confirma por WhatsApp. El negocio pequeño compite en
            servicio, no en presupuesto.
          </p>
        </Texto>
      </Seccion>

      <Seccion fondo titulo="Lo que creemos">
        <Tarjetas
          items={[
            { titulo: "Manos para el oficio", texto: "Quien corta, trata o rehabilita no debería elegir entre el cliente que tiene delante y el que llama." },
            { titulo: "Cada uno, en su lengua", texto: "Castellano y siete idiomas más, y la lengua cooficial de tu zona: catalán, euskera o gallego. También para quien prefiere llamar antes que escribir." },
            { titulo: "Honestidad por diseño", texto: "Dice que es una inteligencia artificial, nunca promete un hueco que no existe y pregunta antes de grabar." },
            { titulo: "Tecnología que suma personas", texto: "Cubre las llamadas que hoy nadie coge. El trato personal sigue siendo del equipo y el dueño decide siempre." },
            { titulo: "Menos huecos vacíos", texto: "Cada cita que se pierde es tiempo de un profesional que nadie aprovecha. Llenar la agenda es cuidar ese trabajo." },
            { titulo: "Precios claros", texto: "Cuota sin IVA y minuto extra publicados, sin permanencia y sin hablar con un comercial para saber cuánto cuesta." },
          ]}
        />
      </Seccion>

      <Seccion titulo="Lo que tu recepcionista no hará nunca" estrecha>
        <ListaCheck
          items={[
            "Hacerse pasar por una persona. Lo dice en la primera frase de cada llamada.",
            "Reservar a ciegas. Si no puede comprobar tu agenda, no da la hora.",
            "Grabar sin permiso. Si el cliente dice que no, no se guarda el audio.",
            "Cambiar tu agenda por su cuenta. Lo que le pides por WhatsApp espera a que pulses «Confirmar».",
            "Mandar publicidad a tus clientes en nombre de tu negocio.",
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Hecho en España, para negocios de aquí" estrecha>
        <Texto>
          <p>
            Alhabla nace en Sant Celoni, en el Vallès Oriental, y está pensada para cómo se trabaja en una
            peluquería o un centro de estética en España: el tuteo, los horarios partidos, el sábado por la mañana, las
            lenguas cooficiales y el WhatsApp como canal de todo. Si tienes un negocio y quieres contarnos cómo es tu día,
            nos encantará escucharte.
          </p>
        </Texto>
      </Seccion>
    </PaginaGuia>
  );
}
