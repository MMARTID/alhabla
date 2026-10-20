import Link from "next/link";
import { PhoneCall } from "lucide-react";
import { BotonImprimir } from "@/components/herramientas/boton-imprimir";
import { Conversacion, Nota, PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Guion para atender el teléfono del salón (2026-10-20). Para quien coge el
 * teléfono con una clienta delante: seis pasos, tres situaciones difíciles,
 * errores comunes y una variante por sector. El bloque `#guion-imprimible`
 * es lo único que sale al imprimir (CSS de abajo, con `:has()`), para
 * dejarlo pegado junto al teléfono.
 *
 * Lo que dice de la recepcionista de IA, ajustado a los hechos del
 * producto: avisa de que es una IA, mira la agenda real antes de ofrecer,
 * reserva con quien piden por su nombre, confirma por WhatsApp, y la
 * grabación de audio es solo con permiso del cliente.
 */
const ruta = "/herramientas/guion-para-atender-el-telefono";
const titulo = "Guion para atender el teléfono del salón";
const descripcion =
  "Qué decir al coger el teléfono del salón: saludo, servicio, dos horas a elegir, datos y confirmación. Con variantes por sector y versión para imprimir.";

export const metadata = metadataDePagina({
  ruta,
  titulo: "Guion para atender el teléfono en un salón o clínica",
  descripcion,
});

/** Al imprimir, fuera todo lo que no es el guion ni lo contiene. */
const CSS_DE_IMPRESION = `
@media print {
  body *:not(:has(#guion-imprimible)):not(#guion-imprimible):not(#guion-imprimible *) { display: none !important; }
  main, main section, main section > div { padding: 0 !important; margin: 0 !important; border: 0 !important; background: none !important; }
  @page { margin: 14mm; }
}
`;

const PASOS = [
  {
    titulo: "Saluda con el nombre del negocio y el tuyo",
    frase: "«Peluquería Nerea, te atiende Carmen. ¿En qué te ayudo?»",
    porQue: "Quien llama sabe en el primer segundo que ha marcado bien, y tu nombre lo hace personal. «¿Sí?» o «dígame» suenan a que molesta.",
  },
  {
    titulo: "Averigua el servicio y con quién",
    frase: "«¿Qué te vas a hacer?» · «¿Tienes preferencia por alguien?»",
    porQue: "El servicio dice cuánto tiempo reservar; la persona, en qué columna de la agenda mirar. Pregunta lo justo para saber la duración: «¿solo corte o también color?».",
  },
  {
    titulo: "Ofrece dos horas concretas",
    frase: "«Tengo el jueves a las cinco o el viernes a las diez y media. ¿Cuál te viene mejor?»",
    porQue: "Elegir entre dos es fácil. «¿Cuándo te viene bien?» abre una negociación de cinco minutos con la agenda en la mano.",
  },
  {
    titulo: "Pide nombre y teléfono",
    frase: "«¿A nombre de quién la pongo? ¿Y un móvil por si hay que avisarte? Te llegará la confirmación por WhatsApp.»",
    porQue: "Sin teléfono no hay recordatorio ni forma de avisar si algo cambia. Decir para qué lo usarás es, además, lo que pide la protección de datos.",
  },
  {
    titulo: "Repite y confirma",
    frase: "«Te lo repito: jueves 23 a las cinco, corte y color con Marta, a nombre de Laura. ¿Correcto?»",
    porQue: "Aquí se cazan los errores de día y de hora, que son los que acaban en ausencia. Apunta mientras lo dices, no después de colgar.",
  },
  {
    titulo: "Despide con lo que viene después",
    frase: "«Ahora te llega el mensaje con la cita. Si no puedes venir, avísanos con 24 horas. ¡Hasta el jueves!»",
    porQue: "La política de cancelación dicha con naturalidad, y el cliente sabe qué esperar. Así nadie llama luego para preguntar si quedó apuntado.",
  },
] as const;

const SITUACIONES = [
  {
    titulo: "Si no hay hueco",
    texto:
      "No te quedes en «está lleno». Ofrece lo más cercano (otro día, otra profesional, primera hora) y, si insiste en ese día, apúntalo en la lista de espera: «Si se libera algo el sábado, te escribo».",
  },
  {
    titulo: "Si preguntan el precio de algo que depende",
    texto:
      "Da una horquilla y di de qué depende, nunca un precio cerrado que luego no sea: «Un color empieza en tanto y depende del largo y de si lleva mechas; te lo confirma Marta al verte».",
  },
  {
    titulo: "Si llaman para anular",
    texto:
      "Da las gracias por avisar, anúlala y ofrece otra fecha en la misma llamada: «Gracias por decírmelo. ¿Te busco otro día?». El hueco que queda, para la lista de espera.",
  },
  {
    titulo: "Si suena con una clienta en el sillón",
    texto:
      "Pide permiso a quien tienes delante, coge y sé breve: «¿Me dejas tu nombre y te llamo en diez minutos?». Y llama. Una devolución que no llega es peor que no haber cogido.",
  },
] as const;

export default function GuionParaAtenderElTelefonoPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Herramientas", path: "/herramientas" },
        { name: "Guion para el teléfono", path: ruta },
      ]}
      etiqueta={{ icono: PhoneCall, texto: "Herramienta gratis" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="guion_telefono"
      ctaSecundario={{ texto: "Ir al guion", href: "#guion" }}
      entradilla={
        <p>
          Lo que tiene que pasar en una llamada para que termine en una cita bien apuntada: seis pasos, qué decir en
          cada uno y qué hacer cuando la llamada se tuerce. Con una variante para cada sector y una versión para
          imprimir y dejar junto al teléfono.
        </p>
      }
      faqs={[
        {
          question: "¿Tengo que decir mi nombre al coger el teléfono?",
          answer:
            "No es obligatorio, pero ayuda: el cliente sabe con quién ha hablado si luego hay un malentendido, y la conversación arranca más cercana. En un salón con varias personas cogiendo el teléfono, evita también el «¿quién me atendió?».",
        },
        {
          question: "¿Tutear o tratar de usted?",
          answer:
            "Lo que se haga en tu mostrador. En la mayoría de salones y barberías se tutea; en clínicas y centros con clientela mayor, el usted es más seguro al principio. Si el cliente te tutea, síguele.",
        },
        {
          question: "¿Cuánto debería durar una llamada para pedir cita?",
          answer:
            "Con el guion, un par de minutos. Si se alarga mucho es porque se ha negociado la hora sin mirar la agenda o porque el cliente pregunta cosas que podrían estar en tu web: apúntalas y ponlas allí.",
        },
        {
          question: "¿Qué hago si el cliente no sabe qué servicio quiere?",
          answer:
            "Pregunta lo justo para saber la duración y reserva lo más probable. Si de verdad no se puede saber sin verle, ofrece una valoración corta o reserva el servicio largo: es mejor que sobre tiempo a que falte.",
        },
        {
          question: "¿Puedo tener el guion impreso junto al teléfono?",
          answer:
            "Para eso está el botón de imprimir: sale solo el guion y las situaciones difíciles, en una hoja. Lo útil es que quien coge el teléfono sea quien sea, lo haga igual.",
        },
        {
          question: "¿La recepcionista de IA sigue este mismo guion?",
          answer:
            "Sigue la misma lógica: saluda con el nombre del negocio avisando de que es una inteligencia artificial, pregunta servicio y profesional, mira la agenda real, ofrece horas libres, toma nombre y teléfono y confirma por WhatsApp. Lo que no tiene es la memoria de quien conoce a la clienta desde hace años.",
        },
      ]}
      relacionadas={[
        { href: "/herramientas/mensajes-de-contestador", titulo: "Mensajes de contestador", texto: "Para las llamadas que no puedes coger." },
        { href: "/herramientas/politica-de-cancelacion", titulo: "Política de cancelación", texto: "La frase del último paso, con tus plazos." },
        { href: "/herramientas/calculadora-de-llamadas-perdidas", titulo: "Calculadora de llamadas perdidas", texto: "Lo que cuestan las que no llegas a coger." },
        { href: "/blog/lista-de-espera-huecos-libres", titulo: "Lista de espera para huecos libres", texto: "El «te escribo si se libera» que llena huecos." },
        { href: "/blog/que-hace-una-recepcionista-virtual", titulo: "Qué hace una recepcionista de IA", texto: "Lo que resuelve en una llamada y lo que no." },
      ]}
      cierre="Que cada llamada termine en una cita bien apuntada."
    >
      <style>{CSS_DE_IMPRESION}</style>

      <Seccion id="guion" titulo="El guion, en seis pasos">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <BotonImprimir />
          <p className="text-sm text-muted">Al imprimir sale solo el guion y las situaciones difíciles, en una hoja.</p>
        </div>
        <div id="guion-imprimible" className="print:text-[10.5pt] print:leading-snug print:text-black">
          <p className="hidden text-lg font-black print:block">Guion para el teléfono · ______________________</p>
          <ol className="grid gap-3 print:mt-3 print:gap-1.5">
            {PASOS.map(({ titulo: t, frase, porQue }, i) => (
              <li key={t} className="flex gap-4 rounded-2xl border border-linea bg-lienzo p-5 print:break-inside-avoid print:rounded-none print:border-0 print:border-b print:p-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lavado text-sm font-bold text-morado-tinta print:h-6 print:w-6 print:bg-transparent print:text-black">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base font-bold text-tinta print:text-black">{t}</h3>
                  <p className="mt-1 text-base font-medium leading-7 text-morado-tinta print:leading-snug print:text-black">{frase}</p>
                  <p className="mt-1 text-sm leading-6 text-muted print:hidden">{porQue}</p>
                </div>
              </li>
            ))}
          </ol>

          <h3 className="mt-10 text-xl font-black tracking-tight text-tinta print:mt-4 print:text-base">Cuando la llamada se tuerce</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 print:mt-2 print:block print:space-y-1.5">
            {SITUACIONES.map(({ titulo: t, texto }) => (
              <li key={t} className="panel p-5 print:break-inside-avoid print:rounded-none print:border-0 print:p-0">
                <p className="text-sm font-bold text-tinta print:text-black">{t}</p>
                <p className="mt-1 text-sm leading-6 text-apagado print:leading-snug print:text-black">{texto}</p>
              </li>
            ))}
          </ul>
          <p className="hidden pt-3 text-xs print:block">alhabla.ai/herramientas/guion-para-atender-el-telefono</p>
        </div>
      </Seccion>

      <Seccion
        fondo
        titulo="Errores que cuestan citas"
        entradilla={<p>Ninguno parece grave en el momento. Todos acaban en un cliente que no viene o que no vuelve a llamar.</p>}
      >
        <Tabla
          cabecera={["Lo que pasa", "Por qué cuesta", "Mejor así"]}
          filas={[
            ["Coger con prisa: «¿Sí?»", "Quien llama duda de si ha marcado bien y siente que molesta.", "El nombre del negocio, aunque sea deprisa."],
            ["«¿Cuándo te viene bien?» sin mirar la agenda", "Te dirán la hora que ya tienes ocupada, y vuelta a empezar.", "Abre la agenda primero y ofrece dos huecos."],
            ["Apuntar en un papel «para pasarlo luego»", "El papel se pierde o se pasa mal, y aparece una cita doble.", "Directamente en la agenda, mientras hablas."],
            ["No repetir los datos", "Jueves y viernes, cinco y quince: los errores de oído no se ven hasta el día.", "Repite día, hora, servicio y nombre antes de colgar."],
            ["Un precio cerrado de algo que depende", "El día de la cita el precio es otro y empieza mal.", "Una horquilla y de qué depende."],
            ["Dejar en espera sin decir cuánto", "Al minuto la gente cuelga, y no vuelve a llamar.", "«¿Te importa esperar un minuto?» y vuelve antes."],
            ["Prometer que llamarás y no hacerlo", "Para el cliente es peor que no haber cogido.", "Apunta el nombre y el teléfono y llama en el rato que dijiste."],
          ]}
        />
      </Seccion>

      <Seccion
        titulo="La pregunta que cambia en cada sector"
        entradilla={
          <p>
            Los seis pasos son los mismos. Lo que cambia es la pregunta del paso 2, la que te dice cuánto tiempo reservar,
            y algún detalle del saludo.
          </p>
        }
      >
        <Tabla
          cabecera={["Sector", "La pregunta clave", "Por qué"]}
          filas={[
            ["Peluquería", "«¿Es corte, color o las dos cosas? ¿El último color te lo hiciste aquí?»", "Un color puede triplicar el tiempo de un corte, y si es de otro salón quizá haya que corregir."],
            ["Barbería", "«¿Corte, barba o los dos? ¿Con quién sueles venir?»", "Las citas son cortas y la clientela es fiel a su barbero: reserva con él."],
            ["Salón de uñas", "«¿Manos, pies o las dos? ¿Llevas algo puesto que haya que retirar?»", "La retirada de gel o acrílico de otro salón cambia la duración."],
            ["Centro de estética", "«¿Es la primera vez que te haces este tratamiento?»", "Una primera vez puede necesitar valoración o ficha, y más tiempo de cabina."],
            ["Fisioterapia", "«¿Es primera visita o ya vienes a tratamiento?»", "Basta para saber la duración. Los detalles de salud, en consulta, no por teléfono ni delante de otros pacientes."],
            ["Pestañas y cejas", "«¿Juego completo o relleno? ¿Cuándo te hiciste el último?»", "Un relleno tardío puede acabar siendo casi un juego nuevo."],
            ["Spa y masajes", "«¿Es para ti o es un regalo? ¿Para cuántas personas?»", "Las reservas de pareja necesitan dos cabinas o una doble, y el regalo cambia a quién confirmar."],
            ["Peluquería canina", "«¿Qué raza y tamaño es? ¿Cuándo le cortaron el pelo por última vez?»", "El tamaño y los nudos deciden si es una hora o la mañana entera."],
          ]}
        />
      </Seccion>

      <Seccion
        fondo
        titulo="Cómo lo hace una recepcionista de IA"
        entradilla={
          <p>
            Cuando no puedes coger, las llamadas que desvías a una recepcionista de IA siguen la misma lógica. Así suena
            en una peluquería un jueves por la tarde.
          </p>
        }
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <Conversacion
            etiqueta="Ejemplo de llamada atendida por la recepcionista de IA"
            turnos={[
              { quien: "recepcionista", texto: "Peluquería Nerea, te atiende su asistente de inteligencia artificial. ¿En qué te ayudo?" },
              { quien: "cliente", texto: "Hola, quería hora para cortarme el pelo, si puede ser con Marta." },
              { quien: "recepcionista", texto: "Claro, miro la agenda de Marta. Mientras tanto: ¿te parece bien que se grabe la llamada para que el negocio pueda escucharla?" },
              { quien: "cliente", texto: "Sí, vale." },
              { quien: "recepcionista", texto: "Gracias. Con Marta tengo el jueves a las cinco o el viernes a las diez y media. ¿Cuál te viene mejor?" },
              { quien: "cliente", texto: "El viernes." },
              { quien: "recepcionista", texto: "Perfecto. ¿A nombre de quién la pongo?" },
              { quien: "cliente", texto: "Laura Gómez." },
              { quien: "recepcionista", texto: "Hecho, Laura: viernes a las diez y media, corte con Marta. Te llega ahora la confirmación por WhatsApp." },
            ]}
          />
          <Texto>
            <p>
              Avisa al empezar de que es una inteligencia artificial y dice el nombre de tu negocio. Antes de ofrecer una
              hora mira tu agenda real y tu horario, y si piden a alguien por su nombre, reserva con esa persona. Al
              terminar, el cliente recibe la cita por WhatsApp.
            </p>
            <p>
              Los precios y las duraciones son los que configuras en cada servicio. Lo que se habló queda en la
              transcripción de la llamada. La grabación de audio, solo si el cliente acepta cuando se lo pregunta; si
              dice que no, queda solo la transcripción.
            </p>
            <p>
              Lo que no tiene es lo que da conocer a alguien desde hace años: no sabe qué es «lo de siempre» de tu
              clienta, así que lo pregunta. Por eso funciona mejor como el que coge lo que tú no puedes coger, no como
              sustituto del mostrador. Cómo llegan esas llamadas, en la{" "}
              <Link href="/desvio-de-llamadas">guía de desvío por operador</Link>.
            </p>
          </Texto>
        </div>
        <div className="mt-8">
          <Nota tipo="consejo" titulo="Pruébalo como si fueras cliente">
            Antes de dar el guion por bueno, llama a tu negocio desde otro móvil y pide cita como lo haría un cliente. Lo
            que te incomode a ti como cliente, cámbialo.
          </Nota>
        </div>
      </Seccion>
    </PaginaGuia>
  );
}
