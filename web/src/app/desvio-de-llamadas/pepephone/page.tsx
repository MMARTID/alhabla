import Link from "next/link";
import { MousePointerClick } from "lucide-react";
import { Codigo } from "@/components/desvio/codigo";
import { ComprobarDesvio } from "@/components/desvio/comprobar-desvio";
import {
  Fuentes,
  Nota,
  PaginaGuia,
  Pasos,
  Seccion,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Desvío en Pepephone (datos del 2026-10-20), con pepephone.com/ayuda.
 * Pepephone no publica códigos de desvío: los tres condicionales se eligen en
 * Mi Pepephone › Ajustes de la línea, y esa misma pantalla es la del buzón.
 * El único código que publica es el de alargar los tonos antes de su buzón
 * (22177); para otro número no lo documenta. El fijo «a lo Pepe» va por la
 * red móvil y su desvío no está documentado.
 */

const ruta = "/desvio-de-llamadas/pepephone";
const titulo = "Desviar llamadas en Pepephone a tu recepcionista de IA";
const descripcion =
  "Pepephone no usa códigos: el desvío si no atiendes, comunicando o sin cobertura se elige en Mi Pepephone. Paso a paso, y qué pasa con tu buzón.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Puedo elegir cuántos segundos suena antes?",
    answer:
      "Pepephone publica *61*22177**30# para que su buzón salte a los 30 segundos. Para el desvío a otro número no lo documenta. Si pruebas con el número de Alhabla en lugar del 22177, comprueba después con *#61# lo que ha guardado la red.",
  },
  {
    question: "¿Cuánto cuesta el desvío en Pepephone?",
    answer:
      "Su ayuda no lo dice. Pregúntalo antes de activarlo si tu tarifa no tiene llamadas ilimitadas.",
  },
  {
    question: "Tengo el «Teléfono fijo a lo Pepe». ¿Se puede desviar?",
    answer:
      "Pepephone no lo documenta. Ese fijo es una caja de voz con una SIM que va por la red móvil. Pregúntaselo a Pepephone o usa el número de Alhabla como principal.",
  },
];

export default function DesvioPepephonePage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "Pepephone", path: ruta },
      ]}
      etiqueta={{ icono: MousePointerClick, texto: "Pepephone · Mi Pepephone" }}
      titulo={titulo}
      entradilla={
        <p>
          En Pepephone no hace falta marcar nada: el desvío se elige en Mi
          Pepephone, en «Ajustes de la línea», para tres situaciones. En las
          tres eliges «otro número» y escribes el de tu recepcionista.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Ver los pasos", href: "#pasos" }}
      ubicacion="desvio_pepephone"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en Pepephone"
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Todos los operadores",
          texto: "Desviar o dar el número de Alhabla, y cómo quitarlo.",
        },
        {
          href: "/desvio-de-llamadas/iphone-y-android",
          titulo: "El ajuste del iPhone que se queda llamadas",
          texto: "Silenciar desconocidos y el Buzón de voz en vivo.",
        },
        {
          href: "/desvio-de-llamadas/lowi",
          titulo: "Desvío en Lowi",
          texto: "También se gestiona desde su área de cliente.",
        },
      ]}
      cierre="Tres opciones en Mi Pepephone, y tus llamadas atendidas."
    >
      <Seccion
        id="pasos"
        titulo="En Mi Pepephone, paso a paso"
        entradilla={
          <p>Ten a mano tu número de Alhabla: lo vas a escribir tres veces.</p>
        }
      >
        <Pasos
          pasos={[
            {
              titulo: "Entra en Mi Pepephone y elige tu línea",
              texto: "La del móvil que das a tus clientes.",
            },
            {
              titulo: "Abre «Ajustes de la línea»",
              texto:
                "Ahí están las tres situaciones: «si no atiendo», «comunicando» y «sin cobertura».",
            },
            {
              titulo: "En «si no atiendo», elige «otro número»",
              texto:
                "Escribe el número de Alhabla con sus 9 cifras, sin espacios.",
            },
            {
              titulo: "Repite en «comunicando» y en «sin cobertura»",
              texto:
                "Así ninguna de las tres situaciones sigue yendo al buzón ni al SMS de aviso.",
            },
          ]}
        />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Nota tipo="importante" titulo="Es la misma pantalla que el buzón">
            <p>
              Pepephone lo avisa ahí mismo: esa configuración aplica a tu buzón
              de voz. Cada situación va a un solo destino, así que al elegir el
              número de Alhabla el buzón deja de coger esas llamadas. Para
              volver atrás, elige «buzón» otra vez; no hace falta ningún código.
            </p>
          </Nota>
          <ComprobarDesvio>
            <p>
              Desde el móvil, marca <Codigo>*#61#</Codigo>: verás a dónde va el
              desvío si no atiendes.
            </p>
          </ComprobarDesvio>
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-6 text-muted">
          ¿Tu número de cara al público es el fijo de Pepephone? No documenta
          cómo desviarlo: mientras tanto,{" "}
          <Link
            href="/desvio-de-llamadas#cual"
            className="font-semibold text-morado-tinta underline underline-offset-4"
          >
            da el número de Alhabla como principal
          </Link>
          .
        </p>
      </Seccion>

      <Fuentes
        consultadas="2026-10-20"
        fuentes={[
          {
            nombre: "Pepephone: activar y desactivar el desvío de llamadas",
            url: "https://www.pepephone.com/ayuda/como-activar-y-desactivar-desvio-de-llamadas",
          },
          {
            nombre: "Pepephone: alargar los tonos antes del contestador",
            url: "https://www.pepephone.com/ayuda/como-puedo-alargar-los-tonos-de-llamada-en-mi-linea-de-pepephone-antes-de-que-salte-el-contestador",
          },
          {
            nombre: "Pepephone: cómo funciona el teléfono fijo",
            url: "https://www.pepephone.com/ayuda/como-funciona-el-servicio-de-telefono-fijo-de-pepephone",
          },
        ]}
      />
    </PaginaGuia>
  );
}
