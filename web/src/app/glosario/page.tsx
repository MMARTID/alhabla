import Link from "next/link";
import { BookOpen } from "lucide-react";
import { PaginaGuia, Seccion } from "@/components/pagina-guia";
import { absoluteUrl, metadataDePagina } from "@/lib/seo";

/**
 * Glosario (2026-10-20): una sola página con un ancla por término, no una
 * página por término (Recepcionista.com tiene 45 de 300 palabras; aquí
 * preferimos una que valga por todas). Va con DefinedTermSet para que los
 * buscadores y los asistentes de IA citen la definición.
 */
const ruta = "/glosario";
const titulo = "Glosario de la recepcionista de IA";
const descripcion =
  "Qué es un desvío condicional, una contraseña de aplicación, un no-show o una plantilla de WhatsApp: los términos que salen al poner una recepcionista de IA.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

type Termino = { id: string; termino: string; definicion: string; enlace?: { href: string; texto: string } };

const TERMINOS: Termino[] = [
  { id: "agente-de-voz", termino: "Agente de voz con IA", definicion: "Programa que mantiene una conversación por teléfono: escucha, entiende lo que se le pide y responde con voz sintética. Una recepcionista de IA es un agente de voz especializado en atender a los clientes de un negocio y gestionar sus citas.", enlace: { href: "/blog/ia-que-contesta-llamadas", texto: "IA que contesta llamadas" } },
  { id: "aviso-de-ia", termino: "Aviso de inteligencia artificial", definicion: "Frase con la que un sistema de IA informa de que lo es al empezar a hablar con una persona. Lo exige el artículo 50 del Reglamento europeo de IA desde el 2 de agosto de 2026 y la obligación es del proveedor del sistema.", enlace: { href: "/guias/ley-y-recepcionista-de-ia", texto: "La ley y la recepcionista de IA" } },
  { id: "buzon-de-voz-en-vivo", termino: "Buzón de voz en vivo", definicion: "Función del iPhone que transcribe en pantalla el mensaje mientras quien llama lo deja. Junto con «Silenciar desconocidos» puede hacer que las llamadas de números nuevos no lleguen nunca a sonar ni a desviarse.", enlace: { href: "/desvio-de-llamadas/iphone-y-android", texto: "El desvío en iPhone y Android" } },
  { id: "caldav", termino: "CalDAV", definicion: "Protocolo abierto para leer y escribir calendarios en un servidor. Es el que usa iCloud y por el que Alhabla se conecta al Calendario de Apple.", enlace: { href: "/integraciones/icloud", texto: "Calendario de Apple (iCloud)" } },
  { id: "centralita-virtual", termino: "Centralita virtual", definicion: "Sistema telefónico en la nube con extensiones, horarios, locuciones y menús de opciones («pulse 1»). Reparte las llamadas entre personas; no las resuelve por sí misma.", enlace: { href: "/comparativa/recepcionista-de-ia-vs-centralita-virtual", texto: "Centralita virtual o recepcionista de IA" } },
  { id: "codigo-de-desvio", termino: "Código de desvío", definicion: "Secuencia que se marca en el teléfono para activar o quitar un desvío, como **61*número# (si no contesta) o ##61# (quitarlo). Siguen la norma GSM, aunque cada operador publica los suyos y en los fijos cambian.", enlace: { href: "/desvio-de-llamadas", texto: "Desvío de llamadas por operador" } },
  { id: "contrasena-de-aplicacion", termino: "Contraseña de aplicación", definicion: "Contraseña de 16 letras que genera Apple para que una app de otra empresa acceda a tu calendario sin conocer la contraseña de tu cuenta. Exige la autenticación de doble factor y se anula sola si cambias la contraseña principal.", enlace: { href: "/integraciones/icloud", texto: "Cómo generarla" } },
  { id: "desvio-condicional", termino: "Desvío condicional", definicion: "Desvío que solo se activa en ciertas condiciones: si no contestas en unos segundos, si comunicas o si el móvil está apagado o sin cobertura. Es el que permite que tu teléfono suene primero y la recepcionista coja lo que tú no puedes.", enlace: { href: "/blog/desvio-de-llamadas-si-no-contesta", texto: "Desvío si no contesta" } },
  { id: "desvio-incondicional", termino: "Desvío incondicional", definicion: "Desvío de todas las llamadas, sin que suene tu teléfono. Es el único que ofrecen el menú de Ajustes del iPhone y las líneas MultiSIM de algunos operadores.", enlace: { href: "/desvio-de-llamadas", texto: "Tipos de desvío" } },
  { id: "encargado-del-tratamiento", termino: "Encargado del tratamiento", definicion: "Empresa que trata datos personales por cuenta de otra, como el proveedor de una recepcionista de IA con los datos de los clientes de un negocio. Se regula con un contrato del artículo 28 del RGPD; en España no hay un documento aparte tipo «BAA» como en Estados Unidos.", enlace: { href: "/guias/ley-y-recepcionista-de-ia", texto: "La ley y la recepcionista de IA" } },
  { id: "gestor", termino: "Gestor", definicion: "En Alhabla, el chat de WhatsApp con el que el dueño cambia su propia agenda: ausencias, cierres, precios u horarios. Propone cada cambio y no aplica nada sin que pulses «Confirmar».", enlace: { href: "/agenda-por-whatsapp", texto: "El Gestor por WhatsApp" } },
  { id: "lengua-cooficial", termino: "Lengua cooficial", definicion: "Lengua oficial junto al castellano en una comunidad autónoma: catalán en Cataluña y Baleares (valenciano en la Comunitat Valenciana), euskera en Euskadi y en la zona vascófona de Navarra, gallego en Galicia.", enlace: { href: "/recepcionista-ia-en-catalan", texto: "Atención en catalán" } },
  { id: "lista-de-espera", termino: "Lista de espera", definicion: "Clientes que querían una hora que estaba ocupada y piden que les avisen si se libera. Bien llevada, convierte cada cancelación en una cita nueva.", enlace: { href: "/blog/lista-de-espera-huecos-libres", texto: "Lista de espera y huecos libres" } },
  { id: "minuto-incluido", termino: "Minuto incluido y minuto extra", definicion: "Los planes de una recepcionista de IA incluyen un número de minutos de llamada al mes; si se superan, se paga cada minuto adicional. Conviene saber qué cuenta como minuto: en Alhabla, la duración de las llamadas que atiende la recepcionista.", enlace: { href: "/planes", texto: "Planes y precios" } },
  { id: "multisim", termino: "MultiSIM", definicion: "Servicio de algunos operadores para usar el mismo número en varios dispositivos. En Movistar y O2 solo permite el desvío de todas las llamadas, no el condicional.", enlace: { href: "/desvio-de-llamadas/movistar", texto: "Desvío en Movistar" } },
  { id: "no-show", termino: "No-show (ausencia)", definicion: "Cliente que no se presenta a su cita sin avisar. Los recordatorios y una política de cancelación clara son las dos formas más sencillas de reducirlos.", enlace: { href: "/herramientas/politica-de-cancelacion", texto: "Política de cancelación" } },
  { id: "numero-geografico", termino: "Número geográfico", definicion: "Número fijo español asociado a una provincia (empieza por 8 o 9 con el prefijo provincial). El número de Alhabla al que desvías tus llamadas es de este tipo.", enlace: { href: "/desvio-de-llamadas", texto: "Desvío de llamadas" } },
  { id: "plantilla-de-whatsapp", termino: "Plantilla de WhatsApp", definicion: "Mensaje con formato fijo que Meta aprueba antes de que una empresa pueda enviarlo a un cliente que no le ha escrito. Las confirmaciones y los recordatorios de cita van siempre en plantillas.", enlace: { href: "/integraciones/whatsapp", texto: "WhatsApp para citas" } },
  { id: "recepcionista-de-ia", termino: "Recepcionista de IA", definicion: "Agente de voz que atiende el teléfono de un negocio en su nombre: resuelve dudas con la información del negocio, consulta la agenda y reserva, cambia o cancela citas. A diferencia de un contestador, cierra la gestión en la misma llamada.", enlace: { href: "/", texto: "Qué es Alhabla" } },
  { id: "transcripcion", termino: "Transcripción", definicion: "Texto de lo que se dijo en una llamada, turno a turno. Es un tratamiento de datos personales aunque no se grabe el audio, y hay que informar de su conservación.", enlace: { href: "/guias/ley-y-recepcionista-de-ia", texto: "Grabar y transcribir" } },
  { id: "transferencia", termino: "Transferencia de llamada", definicion: "Pasar una llamada en curso a otra persona. Es «ciega» si se pasa sin más y «con aviso» si antes quien recibe oye quién llama y para qué; Alhabla hace la segunda cuando pasa la llamada al móvil del dueño.", enlace: { href: "/comparativa/alhabla-vs-fonio", texto: "Comparativa con fonio" } },
  { id: "ventana-de-24-horas", termino: "Ventana de 24 horas de WhatsApp", definicion: "Periodo que abre un cliente al escribir a una empresa: durante 24 horas la empresa puede responderle con mensajes libres. Fuera de esa ventana solo puede iniciar la conversación con una plantilla aprobada.", enlace: { href: "/integraciones/whatsapp", texto: "WhatsApp para citas" } },
  { id: "volte", termino: "VoLTE", definicion: "Llamadas de voz por la red 4G. Con VoLTE activo, algunos operadores avisan de que los códigos de desvío pueden no funcionar y hay que configurarlo desde los ajustes del teléfono.", enlace: { href: "/desvio-de-llamadas/o2", texto: "Desvío en O2" } },
];

export default function GlosarioPage() {
  const url = absoluteUrl(ruta);
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Glosario", path: ruta }]}
      etiqueta={{ icono: BookOpen, texto: "Glosario" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="glosario"
      imagen={null}
      grafo={[
        {
          "@type": "DefinedTermSet",
          "@id": `${url}#terminos`,
          name: titulo,
          hasDefinedTerm: TERMINOS.map((t) => ({
            "@type": "DefinedTerm",
            "@id": `${url}#${t.id}`,
            name: t.termino,
            description: t.definicion,
            inDefinedTermSet: `${url}#terminos`,
          })),
        },
      ]}
      entradilla={
        <p>
          Poner una recepcionista de IA mezcla palabras de telefonía, de calendarios, de WhatsApp y de protección de
          datos. Aquí están todas, explicadas en dos o tres frases y con el enlace a la guía donde se usan.
        </p>
      }
      relacionadas={[
        { href: "/desvio-de-llamadas", titulo: "Desvío de llamadas por operador" },
        { href: "/integraciones", titulo: "Integraciones" },
        { href: "/guias/ley-y-recepcionista-de-ia", titulo: "La ley y la recepcionista de IA" },
      ]}
    >
      <Seccion titulo="Índice">
        <ul className="flex flex-wrap gap-2">
          {TERMINOS.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="badge-soft hover:border-lavado-borde">
                {t.termino}
              </a>
            </li>
          ))}
        </ul>
      </Seccion>
      <Seccion fondo titulo="Términos, de la A a la Z" estrecha>
        <dl className="space-y-8">
          {TERMINOS.map((t) => (
            <div key={t.id} id={t.id} className="scroll-m-24">
              <dt className="text-lg font-bold text-tinta">{t.termino}</dt>
              <dd className="mt-2 text-base leading-7 text-apagado">
                {t.definicion}
                {t.enlace ? (
                  <>
                    {" "}
                    <Link href={t.enlace.href} className="font-semibold text-morado-tinta underline underline-offset-4">
                      {t.enlace.texto}
                    </Link>
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </Seccion>
    </PaginaGuia>
  );
}
