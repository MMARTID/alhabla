import { Scale } from "lucide-react";
import { Fuentes, ListaCheck, Nota, PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { formatIncludedMinutes, plans } from "@/lib/plans";
import { metadataDePagina } from "@/lib/seo";

/**
 * Alhabla frente a fonio (2026-10-20). Mismas reglas que la de HeyDiga
 * (art. 10 de la Ley 3/1991): datos publicados, fechados y enlazados. fonio
 * es austriaca, vende sobre todo a empresas de habla alemana y publica precios
 * muy bajos por minuto; la diferencia real está en la reserva por profesional,
 * WhatsApp con el cliente y las lenguas cooficiales.
 */
const ruta = "/comparativa/alhabla-vs-fonio";
const titulo = "Alhabla vs fonio: qué incluye cada recepcionista de IA";
const descripcion =
  "Precio, llamadas a la vez, WhatsApp, idiomas y reservas de Alhabla y fonio para un salón o una clínica en España, con los datos publicados a 20-10-2026.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const [inicio, pro, scale] = plans;
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

export default function VsFonioPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="Article"
      migas={[
        { name: "Comparativas", path: "/comparativa" },
        { name: "Alhabla vs fonio", path: ruta },
      ]}
      etiqueta={{ icono: Scale, texto: "Comparativa" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="vs_fonio"
      entradilla={
        <>
          <p>
            fonio es un asistente telefónico de IA austriaco con precios por minuto muy bajos y muchas integraciones
            pensadas para empresas de servicios. Alhabla es una recepcionista de IA hecha para negocios con cita previa en
            España. Si comparas solo el precio del minuto, gana fonio; si comparas lo que necesita una peluquería o un
            centro de estética, cambia la cuenta.
          </p>
        </>
      }
      faqs={[
        {
          question: "fonio es más barato por minuto. ¿Por qué pagar más?",
          answer: `Es verdad: fonio Solo da 1.000 minutos por 119 € (99 € con pago anual) y Alhabla Pro ${formatIncludedMinutes(pro.minutes)} por ${pro.price} €. A cambio, el plan Solo de fonio atiende una sola llamada a la vez, confirma las citas por SMS o correo y no publica reparto por profesional; Alhabla confirma por WhatsApp y reserva con quien toca. Si tienes pocas llamadas y no te importan esas diferencias, fonio te sale más barato.`,
        },
        {
          question: "¿fonio habla catalán, euskera y gallego?",
          answer:
            "Según su ayuda, su lista de idiomas incluye el catalán pero no el euskera ni el gallego, y el cambio de idioma hay que permitirlo en sus instrucciones. Alhabla atiende en las tres lenguas cooficiales y las activa sola por el código postal.",
        },
        {
          question: "¿Dónde guarda los datos cada uno?",
          answer:
            "fonio publica servidores en Alemania y telefonía de Twilio. Alhabla trabaja con proveedores que pueden tratar datos fuera del Espacio Económico Europeo con las garantías del RGPD; están en nuestra política de privacidad.",
        },
        {
          question: "¿Se puede probar fonio gratis?",
          answer:
            "Sí: publica 14 días de prueba y garantía de devolución de 30 días, y puedes generar una demo desde la web de tu negocio. Alhabla tiene 7 días de prueba y una demo en la web por sector.",
        },
        {
          question: "¿Quién ha hecho esta comparativa?",
          answer:
            "Alhabla, con los datos que fonio publica en fonio.ai y en su centro de ayuda fonio.info, enlazados abajo. Si algo ha cambiado, escríbenos y lo corregimos.",
        },
      ]}
      relacionadas={[
        { href: "/comparativa/alhabla-vs-heydiga", titulo: "Alhabla vs HeyDiga" },
        { href: "/comparativa", titulo: "Todas las comparativas" },
        { href: "/integraciones/whatsapp", titulo: "WhatsApp para confirmar y recordar citas" },
        { href: "/herramientas/calculadora-de-llamadas-perdidas", titulo: "Calculadora de llamadas perdidas" },
      ]}
      cierre="Compara con tus llamadas: 7 días de prueba, sin permanencia."
    >
      <Seccion titulo="Precio" entradilla={<p>Cuotas mensuales sin IVA del asistente de voz.</p>}>
        <Tabla
          cabecera={["Plan", "Cuota mensual", "Minutos", "€ por minuto incluido", "Minuto extra"]}
          filas={[
            [`Alhabla ${inicio.name}`, `${inicio.price} €`, formatIncludedMinutes(inicio.minutes), eur(inicio.price / inicio.minutes), eur(inicio.extraPerMinute)],
            ["fonio Solo", "119 € (99 € anual)", "1.000", "0,12 € (0,10 € anual)", "0,15 € (paquetes de 100)"],
            [`Alhabla ${pro.name}`, `${pro.price} €`, formatIncludedMinutes(pro.minutes), eur(pro.price / pro.minutes), eur(pro.extraPerMinute)],
            [`Alhabla ${scale.name}`, `${scale.price} €`, formatIncludedMinutes(scale.minutes), eur(scale.price / scale.minutes), eur(scale.extraPerMinute)],
            ["fonio Team", "359 € (299 € anual)", "3.600", "0,10 € (0,08 € anual)", "0,15 € (paquetes de 100)"],
          ]}
          nota="fonio cobra aparte cada número adicional (9 €/mes) y ofrece paquetes de configuración opcionales; Alhabla no tiene pago anual. Datos de fonio en fonio.ai/es/precios, consultada el 20-10-2026."
        />
      </Seccion>

      <Seccion fondo titulo="Lo que necesita un negocio con cita previa">
        <Tabla
          cabecera={["", "Alhabla", "fonio"]}
          destacada={1}
          filas={[
            ["Llamadas a la vez en el plan de entrada", "Sin cifra publicada", "1 en Solo; 3 en Team"],
            ["Reserva con el profesional que piden", "Sí, y reparto por especialidad", "No consta de forma explícita: cada tipo de cita escribe en un calendario"],
            ["Calendarios", "Google, Outlook e iCloud (este, en beta)", "Google, Calendly, Cal.com, SimplyBook.me, eTermin; Outlook vía su planificador"],
            ["Programas de reservas de belleza (Booksy, Treatwell, Koibox)", "No", "No constan"],
            ["Confirmación de la cita al cliente", "Por WhatsApp", "Por SMS o correo"],
            ["WhatsApp con el cliente", "Confirmación, recordatorios (Pro y Scale) y conversación incluidos", "Chatbot de WhatsApp como producto aparte, desde 79 €/mes"],
            ["El dueño cambia su agenda por WhatsApp", "Sí (el Gestor)", "No consta"],
            ["Catalán / euskera / gallego", "Sí / sí / sí, automáticos por código postal", "Sí / no / no, según su lista"],
            ["Aviso de que es una IA", "Fijo en la primera frase", "Lo configura el cliente en el saludo"],
            ["Grabación", "Solo con permiso del cliente", "Opcional; se borra a los 30 días"],
            ["Pasar la llamada a una persona", "Con aviso previo al dueño", "Transferencia ciega (con aviso, solo con su centralita)"],
            ["Datos", "Proveedores con garantías para fuera del EEE", "Servidores en Alemania; telefonía de Twilio"],
            ["Soporte", "Formulario y WhatsApp del equipo, en español", "Correo; primero responde una IA"],
            ["Prueba", "7 días", "14 días y devolución en 30 días"],
          ]}
          nota="Datos de fonio en fonio.ai/es/precios, fonio.ai/es/integraciones y su centro de ayuda fonio.info (idiomas, citas, transferencia, WhatsApp, alojamiento de datos), consultados el 20-10-2026. «No consta» significa que no aparece en su web pública."
        />
      </Seccion>

      <Seccion titulo="Dónde es mejor fonio">
        <ListaCheck
          items={[
            "Precio por minuto: con 1.000 minutos por 119 € (o 99 € al año) es de lo más barato del mercado.",
            "Más días para probar (14) y garantía de devolución de 30 días.",
            "Más integraciones con calendarios de reservas genéricos (Calendly, Cal.com, SimplyBook.me).",
            "Datos alojados en Alemania, según publica.",
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Dónde es mejor Alhabla">
        <ListaCheck
          items={[
            "Reserva con el estilista o la esteticista que pide el cliente, y reparte por especialidad cuando no pide a nadie.",
            "Confirma y recuerda por WhatsApp, que es lo que mira tu clientela, sin pagar un chatbot aparte.",
            "Euskera y gallego, además de catalán, sin configurar nada.",
            "El aviso de IA va fijo en la primera frase: no depende de que tú lo configures bien.",
            "Si se pasa la llamada a tu móvil, primero oyes quién es y qué quiere.",
          ]}
        />
      </Seccion>

      <Seccion titulo="La pregunta que lo decide" estrecha>
        <Texto>
          <p>
            ¿Tus clientes piden a una profesional concreta? Entonces necesitas que la reserva respete la agenda de esa
            persona, no solo un calendario general. ¿Te escriben más por WhatsApp que por correo? Entonces la confirmación
            tiene que llegar por WhatsApp. Si las dos respuestas son «no», fonio puede ser suficiente y más barato. Si
            alguna es «sí», prueba Alhabla. Y si te llaman varias personas a la vez a menudo, pregunta a cada proveedor
            cuántas llamadas simultáneas atiende en tu plan: el plan Solo de fonio, una.
          </p>
        </Texto>
        <div className="mt-6">
          <Nota titulo="Sobre esta comparativa">
            Comparación de características publicadas, hecha por Alhabla el 20 de octubre de 2026 según el artículo 10 de
            la Ley 3/1991 de Competencia Desleal. fonio es una marca de su titular; Alhabla no tiene relación con ella. Si
            un dato ha cambiado, escríbenos a hola@alhabla.ai.
          </Nota>
        </div>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "fonio: precios", url: "https://fonio.ai/es/precios/" },
          { nombre: "fonio: integraciones", url: "https://fonio.ai/es/integraciones/" },
          { nombre: "fonio: idiomas y multilingüismo", url: "https://fonio.info/es/get-started/languages" },
          { nombre: "fonio: transferir llamada", url: "https://fonio.info/es/actions/call-transfer" },
          { nombre: "fonio: mensajes de WhatsApp después de una llamada", url: "https://fonio.info/es/actions/whatsapp-messages" },
          { nombre: "fonio: alojamiento y retención de datos", url: "https://fonio.info/es/legal/hosting-and-data" },
          { nombre: "Ley 3/1991 de Competencia Desleal, art. 10", url: "https://www.boe.es/buscar/act.php?id=BOE-A-1991-628" },
        ]}
      />
    </PaginaGuia>
  );
}
