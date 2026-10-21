import { PhoneCall } from "lucide-react";
import { Conversacion, Fuentes, ListaCheck, Nota, PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Recepcionista de IA frente a una centralita virtual con menú de voz (IVR)
 * (2026-10-20). Búsquedas reales: «centralita virtual ia» (7.ª en «centralita
 * virtual»), «centralita virtual para pymes / para autonomos», «locucion
 * centralita». Sin nombres de proveedores. La Ley 10/2025 (art. 8.1) se cita
 * con su alcance real: solo obliga a grandes empresas y servicios básicos.
 */
const ruta = "/comparativa/recepcionista-de-ia-vs-centralita-virtual";
const titulo = "Centralita virtual o recepcionista de IA para tu negocio";
const descripcion =
  "Una centralita virtual reparte llamadas con un «pulse 1»; una recepcionista de IA entiende lo que te piden y reserva la cita. Qué resuelve cada una.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function VsCentralitaPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="Article"
      migas={[
        { name: "Comparativas", path: "/comparativa" },
        { name: "IA frente a centralita virtual", path: ruta },
      ]}
      etiqueta={{ icono: PhoneCall, texto: "Centralita virtual" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="vs_centralita"
      entradilla={
        <p>
          Una centralita virtual es un sistema telefónico en la nube: números, extensiones, horarios, un mensaje de
          bienvenida y el clásico «para reservar, pulse 1». Es útil para repartir llamadas entre varias personas. Pero si
          al otro lado del «pulse 1» no hay nadie libre, la llamada acaba igual que antes: en un buzón.
        </p>
      }
      faqs={[
        {
          question: "¿Una centralita virtual con IA no es lo mismo?",
          answer:
            "Depende de qué haga la IA. Muchas centralitas usan IA para transcribir el buzón, resumir llamadas o entender «quiero hablar con administración» en lugar de pulsar teclas. Eso enruta mejor la llamada, pero no la resuelve: alguien tiene que coger el teléfono o devolverlo. Una recepcionista de IA resuelve la cita en la misma llamada.",
        },
        {
          question: "¿Puedo tener las dos?",
          answer:
            "Sí. Si tu centralita permite desviar a un número externo cuando nadie contesta o fuera de horario, ese número puede ser el de tu recepcionista de IA. Así la centralita reparte en horas de trabajo y la IA coge lo que se queda sin atender.",
        },
        {
          question: "¿Es legal atender solo con un contestador o un menú automático?",
          answer:
            "La Ley 10/2025 prohíbe usar contestadores automáticos como medio exclusivo de atención, pero solo obliga a grandes empresas y a servicios básicos como luz o telecomunicaciones. Para un pequeño negocio no es obligatoria, aunque la ley de consumidores pide atención personal directa en la atención telefónica: deja siempre una vía para hablar con una persona.",
        },
        {
          question: "¿Qué es una «locución» de centralita?",
          answer:
            "El mensaje grabado que suena al llamar: bienvenida, horario o menú de opciones. En las herramientas tienes textos de contestador y de fuera de horario para tu negocio.",
        },
      ]}
      relacionadas={[
        { href: "/herramientas/mensajes-de-contestador", titulo: "Mensajes de contestador y de fuera de horario" },
        { href: "/comparativa/recepcionista-de-ia-vs-secretaria-telefonica", titulo: "IA frente a una secretaria telefónica" },
        { href: "/blog/contestador-automatico-vs-recepcionista-virtual", titulo: "Contestador automático o recepcionista" },
        { href: "/desvio-de-llamadas", titulo: "Desvío de llamadas por operador" },
      ]}
      cierre="Menos «pulse 1» y más citas cerradas."
    >
      <Seccion titulo="La misma llamada, con cada sistema">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-bold text-tinta">Centralita con menú</h3>
            <div className="mt-4">
              <Conversacion
                etiqueta="Ejemplo de llamada a una centralita con menú"
                pie="Ejemplo ilustrativo de un menú de voz típico."
                turnos={[
                  { quien: "recepcionista", texto: "Bienvenido a Centro Estética Luz. Para pedir cita, pulse 1. Para otras consultas, pulse 2." },
                  { quien: "cliente", texto: "(pulsa 1)" },
                  { quien: "recepcionista", texto: "En este momento todas nuestras líneas están ocupadas. Deje su mensaje después de la señal." },
                ]}
              />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-tinta">Recepcionista de IA</h3>
            <div className="mt-4">
              <Conversacion
                etiqueta="Ejemplo de la misma llamada atendida por una recepcionista de IA"
                turnos={[
                  { quien: "recepcionista", texto: "Centro Estética Luz, te atiende su asistente de inteligencia artificial. ¿En qué te ayudo?" },
                  { quien: "cliente", texto: "Quería una limpieza facial esta semana, por la tarde." },
                  { quien: "recepcionista", texto: "El jueves a las 18:00 tengo hueco con Elena, son 60 minutos. ¿Te la reservo?" },
                  { quien: "cliente", texto: "Sí, perfecto." },
                ]}
              />
            </div>
          </div>
        </div>
      </Seccion>

      <Seccion fondo titulo="Qué resuelve cada una">
        <Tabla
          cabecera={["", "Centralita virtual", "Recepcionista de IA"]}
          destacada={2}
          filas={[
            ["Repartir llamadas entre extensiones", "Sí, es su función", "No: atiende ella"],
            ["Entender lo que pide el cliente con sus palabras", "Con menús o reconocimiento básico", "Sí, conversando"],
            ["Reservar la cita en tu agenda", "No", "Sí, mirando la agenda real"],
            ["Atender fuera de horario", "Locución y buzón", "Atiende y reserva"],
            ["Confirmar y recordar la cita", "No", "Por WhatsApp: confirmación en todos los planes, recordatorio en Pro y Scale"],
            ["Cambiar tu agenda sin abrir un panel", "No", "Escribiendo al Gestor por WhatsApp, con tu «Confirmar»"],
            ["Llamadas salientes y equipo en oficina", "Sí", "No"],
            ["Coste", "Cuota por usuario o extensión", "Cuota con minutos incluidos"],
          ]}
        />
      </Seccion>

      <Seccion titulo="Cuándo tiene sentido cada una" estrecha>
        <Texto>
          <p>
            Una centralita virtual encaja cuando hay varias personas que cogen el teléfono y hay que repartirlas: una
            oficina, una clínica con recepción, administración y varias consultas. Una recepcionista de IA encaja cuando
            el problema no es repartir, sino que no hay nadie libre para coger: el salón donde todo el equipo tiene las
            manos ocupadas.
          </p>
        </Texto>
        <div className="mt-6">
          <ListaCheck
            items={[
              "Si ya tienes centralita, no la quites: configura su desvío de «no contesta» y de «fuera de horario» al número de la recepcionista.",
              "Si no la tienes y eres un negocio de una a diez personas, probablemente no la necesitas: con el desvío de tu operador basta.",
            ]}
          />
        </div>
        <div className="mt-6">
          <Nota tipo="importante" titulo="Ojo con las centralitas de algunos operadores">
            Algunas centralitas de empresa de los operadores usan códigos de desvío propios, distintos de los del móvil. En
            la guía de <a className="font-semibold underline" href="/desvio-de-llamadas/orange">Orange</a> tienes los de su
            centralita para pymes.
          </Nota>
        </div>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          { nombre: "Ley 10/2025 de servicios de atención a la clientela, art. 8", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2025-26698" },
          { nombre: "Ley general para la defensa de los consumidores, art. 21", url: "https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555" },
        ]}
      />
    </PaginaGuia>
  );
}
