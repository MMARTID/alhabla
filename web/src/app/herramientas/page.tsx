import Link from "next/link";
import { Wrench } from "lucide-react";
import { IndiceDePaginas, PaginaGuia, Pasos, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { paginasBajo } from "@/lib/paginas";
import { metadataDePagina } from "@/lib/seo";

/**
 * Índice de las herramientas gratis (2026-10-20). Las tarjetas salen del
 * registro (lib/paginas.ts, `paginasBajo("/herramientas")`); el resto de la
 * página es lo que el índice aporta por sí mismo: por cuál empezar según el
 * problema, cómo están hechas y un plan de una semana que las usa en orden.
 * Ninguna pide email ni registro.
 */
const ruta = "/herramientas";
const titulo = "Herramientas gratis para el teléfono y la agenda de tu negocio";
const descripcion =
  "Calculadora de llamadas perdidas, plantillas de recordatorio, guion para el teléfono, mensajes de contestador y política de cancelación. Gratis.";

export const metadata = metadataDePagina({
  ruta,
  titulo: "Herramientas gratis para salones, barberías y clínicas",
  descripcion,
});

const A = "/herramientas";

export default function HerramientasPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[{ name: "Herramientas", path: ruta }]}
      etiqueta={{ icono: Wrench, texto: "Herramientas gratis" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="herramientas"
      tipo="CollectionPage"
      entradilla={
        <p>
          Cinco herramientas para lo que pasa alrededor del teléfono de un negocio con cita previa: lo que cuestan las
          llamadas que no coges, qué mandar antes de cada cita, qué decir al descolgar, qué oye quien llama cuando no
          puedes y qué pasa si alguien no viene. Gratis, sin email y sin registrarte.
        </p>
      }
      faqs={[
        {
          question: "¿Son gratis de verdad?",
          answer:
            "Sí. No piden email, no hay versión de pago y no hace falta tener cuenta en Alhabla. Las hicimos porque son las preguntas que nos hacen los negocios antes de contratar, y la respuesta les sirve aunque no contraten.",
        },
        {
          question: "¿Se guarda lo que escribo en la calculadora o en el generador?",
          answer:
            "No. Las cuentas y los textos se hacen en tu navegador y no se envían a ningún sitio. Si copias el enlace de la calculadora, tus cifras van dentro del enlace; nada más.",
        },
        {
          question: "¿Puedo usar las plantillas tal cual en mi negocio?",
          answer:
            "Sí, y cambiarlas todo lo que quieras: el tono de tu mostrador vale más que el nuestro. Lo que conviene respetar son las notas legales de cada página, como no meter promociones en un recordatorio, que están comprobadas en el texto de cada norma.",
        },
        {
          question: "¿Para qué sectores están pensadas?",
          answer:
            "Peluquería, barbería, uñas, estética, fisioterapia, pestañas y cejas, spa y masajes y peluquería canina. Cada herramienta tiene su variante para cada uno, porque no se recuerda igual una cita de color que una de fisioterapia.",
        },
        {
          question: "¿Me sirven si no uso Alhabla?",
          answer:
            "Sí. Están escritas para que las uses con tu teléfono, tu WhatsApp y tu libreta. Donde Alhabla hace algo de eso por ti, lo decimos en un apartado aparte y sin exagerar.",
        },
      ]}
      relacionadas={[
        { href: "/desvio-de-llamadas", titulo: "Desvío de llamadas por operador", texto: "Que las llamadas que no coges lleguen a alguien." },
        { href: "/guias/ley-y-recepcionista-de-ia", titulo: "La ley y la recepcionista de IA", texto: "Aviso de IA, grabación y recordatorios, con su artículo." },
        { href: "/glosario", titulo: "Glosario", texto: "Desvío condicional, no-show y el resto de términos." },
        { href: "/blog", titulo: "Blog", texto: "Guías sobre llamadas perdidas, agenda y recordatorios." },
      ]}
      cierre="Herramientas para hoy; una recepcionista de IA para cuando no llegues."
    >
      <Seccion titulo="Las cinco herramientas">
        <IndiceDePaginas paginas={paginasBajo(ruta)} />
      </Seccion>

      <Seccion
        fondo
        titulo="Por cuál empezar, según lo que te pasa"
        entradilla={<p>No hace falta usarlas todas. Busca la frase que más se parece a tu semana.</p>}
      >
        <Tabla
          cabecera={["Lo que te pasa", "Empieza por", "Para qué te sirve"]}
          filas={[
            [
              "«Suena el teléfono y no llego a cogerlo»",
              <Link key="c" href={`${A}/calculadora-de-llamadas-perdidas`} className="font-semibold text-morado-tinta underline underline-offset-4">Calculadora de llamadas perdidas</Link>,
              "Poner un número a esas llamadas antes de decidir nada, con tus cifras y no con las de un folleto.",
            ],
            [
              "«Me reservan y luego no vienen»",
              <Link key="p" href={`${A}/plantillas-recordatorio-de-cita`} className="font-semibold text-morado-tinta underline underline-offset-4">Plantillas de recordatorio</Link>,
              "Confirmar cada cita por escrito y recordarla con tiempo para dar el hueco a otra persona.",
            ],
            [
              "«Me anulan con una hora de margen»",
              <Link key="pc" href={`${A}/politica-de-cancelacion`} className="font-semibold text-morado-tinta underline underline-offset-4">Política de cancelación</Link>,
              "Fijar un plazo, decidir si pides señal y escribirlo de forma que se cumpla y que la ley no lo tumbe.",
            ],
            [
              "«Cada uno coge el teléfono a su manera»",
              <Link key="g" href={`${A}/guion-para-atender-el-telefono`} className="font-semibold text-morado-tinta underline underline-offset-4">Guion para el teléfono</Link>,
              "Que cualquiera que descuelgue cierre la cita igual de bien, con una hoja impresa junto al teléfono.",
            ],
            [
              "«Me llaman y me escriben con el local cerrado»",
              <Link key="m" href={`${A}/mensajes-de-contestador`} className="font-semibold text-morado-tinta underline underline-offset-4">Mensajes de contestador</Link>,
              "Que quien llama o escribe a deshoras sepa cuándo abres y qué hacer, en el buzón y en WhatsApp Business.",
            ],
          ]}
        />
      </Seccion>

      <Seccion
        titulo="Una semana para ordenar el teléfono"
        entradilla={<p>Si quieres hacerlo todo, este es el orden que tiene sentido. Un rato al día, sin cerrar el local.</p>}
      >
        <Pasos
          pasos={[
            {
              titulo: "Lunes: cuenta",
              texto: "Empieza a apuntar las llamadas que no coges. El viernes tendrás el dato que más pesa en la calculadora.",
            },
            {
              titulo: "Martes: decide tu política",
              texto: "Plazo para anular, señal sí o no, qué pasa con las ausencias. Con el generador, en diez minutos; imprime el cartel.",
            },
            {
              titulo: "Miércoles: prepara los mensajes",
              texto: "Copia las plantillas de tu sector a las respuestas rápidas de WhatsApp Business y añade al final la frase de tu política.",
            },
            {
              titulo: "Jueves: el guion",
              texto: "Imprímelo, déjalo junto al teléfono y repásalo con quien lo coja. Haz una llamada de prueba desde otro móvil.",
            },
            {
              titulo: "Viernes: el contestador y la cuenta",
              texto: "Graba el mensaje de fuera de horario, activa el de ausencia en WhatsApp y mete tus llamadas de la semana en la calculadora.",
            },
          ]}
        />
      </Seccion>

      <Seccion fondo titulo="Cómo están hechas">
        <Texto>
          <p>
            <strong>Sin pedirte nada.</strong> Ninguna herramienta tiene formulario de contacto ni descarga a cambio del
            email. Lo que escribes en la calculadora o en el generador se queda en tu navegador.
          </p>
          <p>
            <strong>Con la ley leída en su fuente.</strong> Cuando una plantilla o un texto toca algo legal (el
            consentimiento para los recordatorios, la información mínima en una clínica, lo que puede ser abusivo en una
            política de cancelación), lo hemos comprobado en el texto del BOE o en la guía de la AEPD, y lo citamos con
            su artículo y su fecha de consulta. Lo de WhatsApp Business, en su servicio de ayuda oficial.
          </p>
          <p>
            <strong>Para leerse sin trucos.</strong> Las plantillas y los textos están en la página aunque tu navegador
            no cargue nada más; el botón de copiar es una ayuda, no un requisito. El guion se imprime en una hoja.
          </p>
          <p>
            <strong>Sin cifras inventadas.</strong> La calculadora no trae estadísticas del sector porque no conocemos
            ninguna fiable para pequeños negocios en España: trae valores de partida, dice que lo son y te explica la
            cuenta para que la hagas con los tuyos.
          </p>
        </Texto>
      </Seccion>

      <Seccion titulo="Lo que una plantilla no resuelve">
        <Texto>
          <p>
            Una plantilla hay que mandarla, un guion hay que seguirlo con una clienta delante y un contestador solo
            apunta recados. Todo eso funciona mientras alguien tenga tiempo de hacerlo. Cuando no lo hay, que es justo
            cuando suena el teléfono, la llamada se pierde igual.
          </p>
          <p>
            Para eso existe una <Link href="/">recepcionista de IA</Link>: coge las llamadas que tú no puedes, da la cita en
            tu agenda real y la confirma por WhatsApp. No sustituye a estas herramientas; hace por ti la parte que no te
            da tiempo. Los <Link href="/planes">planes y precios</Link> están publicados, con su prueba.
          </p>
        </Texto>
      </Seccion>
    </PaginaGuia>
  );
}
