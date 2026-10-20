import { Headset } from "lucide-react";
import { ListaCheck, Nota, PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Recepcionista de IA frente a un servicio de secretaria telefónica externa
 * (2026-10-20). Búsquedas reales: «cuanto cuesta una secretaria virtual» (1.ª
 * en su semilla), «secretaria virtual precios», «secretaria virtual
 * tarifas». Sin nombres de proveedores (el usuario solo aprobó comparativas
 * con nombre para HeyDiga y fonio): se compara el modelo, no una empresa, y
 * sin cifras de terceros que no podamos enlazar.
 */
const ruta = "/comparativa/recepcionista-de-ia-vs-secretaria-telefonica";
const titulo = "Secretaria virtual o recepcionista de IA: qué te conviene";
const descripcion =
  "Una secretaria telefónica externa toma recados; una recepcionista de IA reserva en tu agenda. Cómo cobra cada una y qué resuelve en un negocio con citas.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function VsSecretariaPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="Article"
      migas={[
        { name: "Comparativas", path: "/comparativa" },
        { name: "IA frente a secretaria telefónica", path: ruta },
      ]}
      etiqueta={{ icono: Headset, texto: "Secretaria telefónica" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="vs_secretaria"
      entradilla={
        <p>
          Antes de la IA, la forma de no perder llamadas sin contratar a nadie era un servicio de secretaria telefónica:
          personas en un centro de llamadas que cogen el teléfono con el nombre de tu negocio. Sigue siendo una buena
          opción para algunos negocios. Para un salón o una clínica que vive de las citas, hay una diferencia que lo
          cambia todo: quién mete la cita en la agenda.
        </p>
      }
      faqs={[
        {
          question: "¿Qué es exactamente una secretaria virtual?",
          answer:
            "Un servicio externo en el que personas de un centro de llamadas atienden tu teléfono con el nombre de tu empresa, normalmente con el desvío de tu operador. Toman nota y te pasan el recado por correo, SMS o una app; algunos también gestionan una agenda.",
        },
        {
          question: "¿Cómo suelen cobrar?",
          answer:
            "Lo habitual es una cuota mensual con un número de llamadas incluidas y un precio por llamada a partir de ahí, o un bono de llamadas. Por eso el coste sube con tu volumen y conviene preguntar qué cuenta como llamada (también las de pocos segundos o las que se cortan).",
        },
        {
          question: "¿Una secretaria humana reserva en mi agenda?",
          answer:
            "Algunas sí, si les das acceso a tu calendario o a su propia agenda. Otras solo toman el recado y tú devuelves la llamada. Pregúntalo antes: en un negocio con citas, la mitad del valor está en que el cliente cuelgue con la hora cerrada.",
        },
        {
          question: "¿Y si mi cliente quiere hablar con una persona?",
          answer:
            "Ahí la secretaria humana es mejor por definición. Con Alhabla, si publicas su número como principal, la recepcionista puede pasar la llamada a tu móvil cuando el cliente lo pide, con un aviso previo de quién es.",
        },
      ]}
      relacionadas={[
        { href: "/comparativa/recepcionista-de-ia-vs-recepcionista-humana", titulo: "IA frente a una recepcionista en plantilla" },
        { href: "/comparativa/recepcionista-de-ia-vs-centralita-virtual", titulo: "IA frente a una centralita virtual" },
        { href: "/blog/contestador-automatico-vs-recepcionista-virtual", titulo: "Contestador automático o recepcionista" },
        { href: "/planes", titulo: "Planes y precios de Alhabla" },
      ]}
      cierre="Que el cliente cuelgue con la cita hecha, no con un recado."
    >
      <Seccion titulo="Las dos, frente a frente">
        <Tabla
          cabecera={["", "Secretaria telefónica externa", "Recepcionista de IA (Alhabla)"]}
          destacada={2}
          filas={[
            ["Quién contesta", "Una persona de un centro de llamadas", "Una IA que avisa de que lo es, con el nombre de tu negocio"],
            ["Qué hace con la llamada", "Toma nota y te pasa el recado; a veces reserva", "Mira tu agenda real y cierra la cita"],
            ["Horario", "El del servicio; las 24 h suelen costar más", "Las 24 horas, todos los días, en todos los planes"],
            ["Cómo cobra", "Cuota + precio por llamada o bono", "Cuota mensual con minutos incluidos"],
            ["Conoce tus servicios", "Lo que pongas en su ficha", "Tu catálogo con duración, precio y quién hace cada cosa"],
            ["Idiomas", "Los del equipo que le toque", "11, con catalán, euskera y gallego"],
            ["Confirmación al cliente", "Depende del servicio", "Por WhatsApp, siempre"],
            ["Si el cliente quiere a una persona", "Ya es una persona", "Puede pasarte la llamada al móvil"],
          ]}
          nota="Descripción general de cómo funcionan estos servicios en España; cada proveedor tiene sus condiciones. Compara siempre con su página de precios."
        />
      </Seccion>

      <Seccion fondo titulo="El recado es la mitad del trabajo" estrecha>
        <Texto>
          <p>
            Imagina el sábado a las 11:00: tienes tres clientas en el salón y entran cuatro llamadas. Con una secretaria
            externa que toma recados, a las 14:00 tienes cuatro mensajes «llamar a Marta, quiere mechas la semana que
            viene». Tienes que devolver cuatro llamadas, dos no contestan y una ya ha reservado en otro sitio.
          </p>
          <p>
            Con una recepcionista que reserva, a las 14:00 tienes cuatro citas en el calendario y cuatro clientas que ya
            han recibido la confirmación por WhatsApp. No es que una persona lo haga peor: es que, si no tiene tu agenda,
            no puede cerrar.
          </p>
        </Texto>
      </Seccion>

      <Seccion titulo="Cuándo elegir cada una">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-bold text-tinta">Una secretaria telefónica, si…</h3>
            <div className="mt-4">
              <ListaCheck
                items={[
                  "Tus llamadas son consultas complejas que necesitan criterio humano (un despacho, una inmobiliaria).",
                  "Quieres que siempre conteste una persona, cueste lo que cueste.",
                  "No trabajas con citas o tu agenda no está en un calendario digital.",
                ]}
              />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold text-tinta">Una recepcionista de IA, si…</h3>
            <div className="mt-4">
              <ListaCheck
                items={[
                  "Casi todas las llamadas son para pedir, cambiar o cancelar una cita.",
                  "Tienes picos de llamadas y no quieres pagar cada una.",
                  "Te llaman fuera de horario, en domingo o en otros idiomas.",
                ]}
              />
            </div>
          </div>
        </div>
        <div className="mt-8">
          <Nota tipo="consejo" titulo="Una pregunta para cualquier proveedor">
            «Si un cliente llama a las 22:00 un domingo para pedir hora el martes, ¿cuelga con la cita hecha?». Si la
            respuesta es «te dejamos el recado», ya sabes lo que estás comprando.
          </Nota>
        </div>
      </Seccion>
    </PaginaGuia>
  );
}
