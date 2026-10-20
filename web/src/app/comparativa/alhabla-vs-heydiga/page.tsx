import { Scale } from "lucide-react";
import { Fuentes, ListaCheck, Nota, PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { formatIncludedMinutes, plans } from "@/lib/plans";
import { metadataDePagina } from "@/lib/seo";

/**
 * Alhabla frente a HeyDiga (2026-10-20). Comparación del art. 10 de la Ley
 * 3/1991 de Competencia Desleal: solo características esenciales, objetivas
 * y verificables, con la fecha y la URL de donde sale cada dato (copias de
 * las páginas guardadas el 20-10-2026). Donde HeyDiga es mejor se dice. Lo
 * que su web no publica se escribe «no consta en su web», nunca «no lo
 * tiene». Al cambiar sus precios o los nuestros, actualizar esta página y su
 * `actualizado` en lib/paginas.ts.
 */
const ruta = "/comparativa/alhabla-vs-heydiga";
const titulo = "Alhabla vs HeyDiga: comparativa de recepcionistas de IA";
const descripcion =
  "Precio por minuto, idiomas, calendarios, WhatsApp y seguridad de Alhabla y HeyDiga, con los datos que publica cada uno a 20 de octubre de 2026.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const [inicio, pro, scale] = plans;
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const porMinuto = (precio: number, minutos: number) => eur(precio / minutos);

export default function VsHeydigaPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="Article"
      migas={[
        { name: "Comparativas", path: "/comparativa" },
        { name: "Alhabla vs HeyDiga", path: ruta },
      ]}
      etiqueta={{ icono: Scale, texto: "Comparativa" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="vs_heydiga"
      entradilla={
        <>
          <p>
            HeyDiga y Alhabla hacen lo mismo en lo básico: una inteligencia artificial coge el teléfono de tu negocio y
            reserva citas. Cambian el precio, a quién se dirigen y lo que va incluido. Esta página compara solo lo que
            cada uno publica en su web, con fecha y enlace, para que decidas con datos.
          </p>
          <p className="text-base">
            Dicho claro: si tu negocio vive en Booksy o Treatwell, o eres una cadena que necesita certificaciones de
            seguridad, HeyDiga tiene hoy más que ofrecerte.
          </p>
        </>
      }
      faqs={[
        {
          question: "¿Cuál es más barato?",
          answer: `Depende del volumen. Con 200 minutos, HeyDiga Lite cuesta 49 € y Alhabla Inicio ${inicio.price} € (sin IVA). Con unos 500-600 minutos, HeyDiga Start son 99 € por 500 y Alhabla Pro ${pro.price} € por ${pro.minutes}. HeyDiga no publica el precio del minuto extra; Alhabla sí: de ${eur(scale.extraPerMinute)} a ${eur(inicio.extraPerMinute)} + IVA.`,
        },
        {
          question: "¿Cuál habla catalán, euskera y gallego?",
          answer:
            "Alhabla los activa sola por el código postal del negocio y publica la lista completa de idiomas. HeyDiga dice que habla 50 idiomas y detecta el de quien llama, pero no publica la lista, así que no podemos confirmar las lenguas cooficiales.",
        },
        {
          question: "Uso Booksy. ¿Cuál me conviene?",
          answer:
            "HeyDiga publica integración con Booksy, Treatwell, Koibox y otros programas de reservas desde su plan Start. Alhabla no se integra con ellos: reserva en Google Calendar, Outlook o iCloud. Si tu agenda está en Booksy, HeyDiga encaja mejor.",
        },
        {
          question: "¿Puedo probar los dos antes de pagar?",
          answer:
            "Sí. Alhabla tiene 7 días de prueba y una demo en la web para escuchar cómo atiende tu sector. HeyDiga ofrece una demo de voz con el nombre de tu negocio y un periodo de prueba cuya duración no consta en su web pública.",
        },
        {
          question: "¿Esta comparativa es imparcial?",
          answer:
            "La escribe Alhabla, así que tenlo en cuenta. Para compensarlo, solo usamos datos que HeyDiga publica, con el enlace a cada uno, y decimos dónde es mejor. Si ves un dato desactualizado, escríbenos y lo corregimos.",
        },
      ]}
      relacionadas={[
        { href: "/comparativa/alhabla-vs-fonio", titulo: "Alhabla vs fonio" },
        { href: "/comparativa", titulo: "Todas las comparativas" },
        { href: "/planes", titulo: "Planes y precios de Alhabla" },
        { href: "/integraciones", titulo: "Integraciones de Alhabla" },
      ]}
      cierre="Pruébalo 7 días y compara con tus propias llamadas."
    >
      <Seccion titulo="Precio por minuto incluido" entradilla={<p>Cuotas mensuales sin IVA. Los dos son sin permanencia.</p>}>
        <Tabla
          cabecera={["Plan", "Cuota", "Minutos", "€ por minuto incluido", "Minuto extra"]}
          filas={[
            ["HeyDiga Lite", "49 €", "200", eur(49 / 200), "No consta en su web"],
            [`Alhabla ${inicio.name}`, `${inicio.price} €`, formatIncludedMinutes(inicio.minutes), porMinuto(inicio.price, inicio.minutes), `${eur(inicio.extraPerMinute)}`],
            ["HeyDiga Start", "99 €", "500", eur(99 / 500), "No consta en su web"],
            [`Alhabla ${pro.name}`, `${pro.price} €`, formatIncludedMinutes(pro.minutes), porMinuto(pro.price, pro.minutes), `${eur(pro.extraPerMinute)}`],
            ["HeyDiga Growth", "169 €", "900", eur(169 / 900), "No consta en su web"],
            ["HeyDiga Pro", "279 €", "desde 1.500", eur(279 / 1500), "No consta en su web"],
            [`Alhabla ${scale.name}`, `${scale.price} €`, formatIncludedMinutes(scale.minutes), porMinuto(scale.price, scale.minutes), `${eur(scale.extraPerMinute)}`],
          ]}
          nota="Qué cuenta como minuto: HeyDiga dice contar solo el tiempo en que el agente está hablando; Alhabla suma la duración de las llamadas que atiende la recepcionista (las que coges tú no cuentan). Precios de HeyDiga en heydiga.com/es/precios, consultada el 20-10-2026."
        />
      </Seccion>

      <Seccion fondo titulo="Qué incluye cada uno">
        <Tabla
          cabecera={["", "Alhabla", "HeyDiga"]}
          destacada={1}
          filas={[
            ["Calendarios", "Google Calendar, Outlook e iCloud (este, en beta)", "Google Calendar; Outlook e iCloud no constan"],
            ["Programas de reservas (Booksy, Treatwell…)", "No se integra", "28 integraciones, desde el plan Start"],
            ["Reserva con el profesional que piden", "Sí, y reparte por especialidad (especialista / lo hace / solo si lo piden)", "Sí, con agenda por persona; configura quién hace cada servicio"],
            ["Lenguas cooficiales", "Catalán, euskera y gallego, automáticas por código postal", "50 idiomas sin lista publicada"],
            ["Confirmación por WhatsApp", "Todos los planes", "Avisos en todos los planes"],
            ["Recordatorios", "Por WhatsApp en Pro y Scale", "Por WhatsApp y por llamada desde Start"],
            ["Conversación por WhatsApp con clientes", "Incluida", "+39 €/mes"],
            ["El dueño cambia su agenda por WhatsApp", "Sí (el Gestor), en todos los planes", "No consta en su web"],
            ["Llamadas a la vez", "Sin cifra publicada", "5 (Lite) a 25 (Pro)"],
            ["Pasar la llamada a una persona", "A tu móvil, con aviso previo, si usas Alhabla como número principal", "En todos los planes, a un número o extensión"],
            ["Aviso de que es una IA", "En la primera frase, con el nombre del negocio", "Se presenta como asistente virtual desde el inicio"],
            ["Grabación", "Solo con permiso del cliente", "Solo si el negocio la activa"],
            ["Dónde están los datos", "Proveedores con transferencias fuera del EEE con garantías (ver privacidad)", "Servidores en la UE"],
            ["Certificaciones", "No publicamos ninguna", "ENS categoría media e ISO 27001"],
            ["Alta", "Autoservicio en todos los planes", "Autoservicio en Lite; demo comercial en el resto"],
          ]}
          nota="Datos de HeyDiga: heydiga.com/es/precios, /es/integraciones, /es/preguntas-frecuentes, /es/negocios/peluquerias-y-salones-de-belleza y /es/habilidades/reserva, consultadas el 20-10-2026. «No consta» significa que no aparece en su web pública, no que el producto no lo tenga."
        />
      </Seccion>

      <Seccion titulo="Dónde es mejor HeyDiga">
        <ListaCheck
          items={[
            "Si tu agenda vive en Booksy, Treatwell, Koibox u otro programa de reservas: tienen integración y nosotros no.",
            "Si eres una cadena o necesitas cumplimiento formal: publican servidores en la UE, ENS e ISO 27001, y un plan con API y reservas entre centros.",
            "Si recibes muchas llamadas a la vez y quieres una cifra garantizada por contrato.",
            "Si buscas el precio más bajo con unos 200 minutos al mes: su plan Lite cuesta 10 € menos que nuestro Inicio.",
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Dónde es mejor Alhabla">
        <ListaCheck
          items={[
            "Si tu agenda está en Outlook o en el calendario del iPhone, no solo en Google.",
            "Si tu negocio está en Cataluña, Baleares, Euskadi o Galicia y quieres que conteste en la lengua de tus clientes sin configurar nada.",
            "Si quieres cambiar horarios, ausencias o precios escribiendo por WhatsApp, sin abrir un panel.",
            "Si quieres saber de antemano cuánto pagarás si te pasas de minutos: publicamos el precio del minuto extra.",
            "Si prefieres darte de alta solo y hoy mismo en cualquier plan, sin demo comercial.",
          ]}
        />
      </Seccion>

      <Seccion titulo="Cómo decidir en una tarde" estrecha>
        <Texto>
          <p>
            Haz la misma prueba con los dos. Llama como si fueras un cliente difícil: pide un servicio que depende (unas
            mechas, un tratamiento), pide a una profesional por su nombre, cambia de idea a mitad de llamada y pregunta
            un precio. Fíjate en tres cosas: si te ofrece una hora que de verdad está libre en tu agenda, si entiende a
            la primera y cómo cierra la cita. Con eso y la tabla de arriba tienes la respuesta.
          </p>
        </Texto>
        <div className="mt-6">
          <Nota titulo="Sobre esta comparativa">
            Comparación de características publicadas, hecha por Alhabla el 20 de octubre de 2026 según el artículo 10 de
            la Ley 3/1991 de Competencia Desleal. HeyDiga es una marca de HEYDIGA TECH, S.L.; Alhabla no tiene relación
            con ella. Si un dato ha cambiado, escríbenos a hola@alhabla.ai y lo corregimos.
          </Nota>
        </div>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "HeyDiga: precios", url: "https://heydiga.com/es/precios" },
          { nombre: "HeyDiga: integraciones", url: "https://heydiga.com/es/integraciones" },
          { nombre: "HeyDiga: preguntas frecuentes", url: "https://heydiga.com/es/preguntas-frecuentes" },
          { nombre: "HeyDiga: peluquerías y salones de belleza", url: "https://heydiga.com/es/negocios/peluquerias-y-salones-de-belleza" },
          { nombre: "HeyDiga: reserva de citas", url: "https://heydiga.com/es/habilidades/reserva" },
          { nombre: "HeyDiga: atención en varios idiomas", url: "https://heydiga.com/es/casos-de-uso/atencion-en-varios-idiomas" },
          { nombre: "Ley 3/1991 de Competencia Desleal, art. 10", url: "https://www.boe.es/buscar/act.php?id=BOE-A-1991-628" },
        ]}
      />
    </PaginaGuia>
  );
}
