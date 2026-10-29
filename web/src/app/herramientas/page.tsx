import { Wrench } from "lucide-react";
import { LoQueHaceAlhabla } from "@/components/herramientas/lo-que-hace-alhabla";
import { IndiceDePaginas, PaginaGuia, Seccion } from "@/components/pagina-guia";
import { paginasBajo } from "@/lib/paginas";
import { metadataDePagina } from "@/lib/seo";

/**
 * Índice de las herramientas gratis. Las tarjetas salen del registro
 * (lib/paginas.ts, `paginasBajo("/herramientas")`), ordenadas por la promesa:
 * primero lo que cuestan las llamadas que no coges y lo que oye quien llama
 * cuando no puedes; después, lo que rodea a la cita. Ninguna pide email ni
 * registro.
 */
const ruta = "/herramientas";
const titulo = "Herramientas gratis para el teléfono y la agenda de tu negocio";
const descripcion =
  "Calculadora de llamadas perdidas, mensajes de contestador, guion para el teléfono, plantillas de recordatorio y política de cancelación. Gratis.";

export const metadata = metadataDePagina({
  ruta,
  titulo: "Herramientas gratis para salones, barberías y clínicas",
  descripcion,
});

const ORDEN = [
  "/herramientas/calculadora-de-llamadas-perdidas",
  "/herramientas/mensajes-de-contestador",
  "/herramientas/guion-para-atender-el-telefono",
  "/herramientas/plantillas-recordatorio-de-cita",
  "/herramientas/politica-de-cancelacion",
];

function posicion(r: string) {
  const i = ORDEN.indexOf(r);
  return i === -1 ? ORDEN.length : i;
}

export default function HerramientasPage() {
  const herramientas = [...paginasBajo(ruta)].sort(
    (a, b) => posicion(a.ruta) - posicion(b.ruta)
  );
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
          Para lo que pasa alrededor del teléfono de un negocio con cita: lo que cuestan las llamadas que no coges, qué
          oye quien llama cuando no puedes y qué mandar antes de cada cita. Gratis, sin email y sin registrarte.
        </p>
      }
      faqs={[
        {
          question: "¿Son gratis de verdad?",
          answer:
            "Sí. No piden email, no hay versión de pago y no hace falta tener cuenta en Alhabla. Te sirven con tu teléfono, tu WhatsApp y tu libreta.",
        },
        {
          question: "¿Se guarda lo que escribo en la calculadora o en el generador?",
          answer:
            "No. Las cuentas y los textos se hacen en tu navegador y no se envían a ningún sitio. Si copias el enlace de la calculadora, tus cifras van dentro del enlace; nada más.",
        },
        {
          question: "¿Para qué sectores están pensadas?",
          answer:
            "Peluquería, barbería, uñas, estética, fisioterapia, pestañas y cejas, spa y masajes y peluquería canina. Cada herramienta tiene su variante para cada uno, porque no se recuerda igual una cita de color que una de fisioterapia.",
        },
      ]}
      relacionadas={[
        { href: "/desvio-de-llamadas", titulo: "Desvío de llamadas por operador", texto: "Que las llamadas que no coges lleguen a alguien." },
        { href: "/guias/ley-y-recepcionista-de-ia", titulo: "La ley y la recepcionista de IA", texto: "Aviso de IA, grabación y mensajes, con su artículo." },
        { href: "/blog", titulo: "Blog", texto: "Guías sobre llamadas perdidas, agenda y recordatorios." },
      ]}
      cierre="Herramientas para hoy; una recepcionista de IA para cuando no llegues."
    >
      <Seccion titulo="Las cinco herramientas">
        <IndiceDePaginas paginas={herramientas} />
      </Seccion>

      <LoQueHaceAlhabla titulo="Y para las llamadas que no llegas a coger">
        <p>
          Alhabla es un asistente de IA para tu negocio que atiende tus llamadas, y lo gestionas por WhatsApp o desde el
          panel web.
        </p>
      </LoQueHaceAlhabla>
    </PaginaGuia>
  );
}
