import Link from "next/link";
import { Smartphone } from "lucide-react";
import { Codigo } from "@/components/desvio/codigo";
import {
  CampoNumeroDeAlhabla,
  ConNumeroDeAlhabla,
  TablaDeCodigos,
} from "@/components/desvio/codigos-de-desvio";
import { ComprobarDesvio } from "@/components/desvio/comprobar-desvio";
import {
  Fuentes,
  Nota,
  PaginaGuia,
  Seccion,
  Texto,
} from "@/components/pagina-guia";
import { metadataDePagina } from "@/lib/seo";

/**
 * Desvío en R, el operador gallego (datos del 2026-10-20), con
 * mundo-r.com/ayuda-clientes y su blog. Lo propio de R: el texto de su ayuda
 * del móvil enseña los códigos incompletos (se dan los estándar), deja
 * hacerlo todo desde la app (móvil y fijo), cobra el desvío a otro número
 * como llamada de tu línea pero no el desvío al contestador, y en el fijo no
 * publica cómo quitar el «si comunicas».
 */

const ruta = "/desvio-de-llamadas/r-galicia";
const titulo = "Desviar llamadas en R (Galicia) a tu recepcionista de IA";
const descripcion =
  "Códigos de R para el móvil y el fijo, y la forma más fácil: la app de R, que desvía el fijo si no contestas «en un tiempo determinado».";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

const faqs = [
  {
    question: "¿Puedo elegir cuántos segundos suena?",
    answer:
      "R no publica un código para eso. En la app y en el área de clientes, el desvío del fijo si no contestas se configura «en un tiempo determinado»; para el móvil no da detalles.",
  },
  {
    question: "¿Cómo vuelvo al contestador de R?",
    answer:
      "En el fijo, la app de R ofrece en la misma pantalla «a un número» o «al contestador»: basta con cambiar de una a otra. En el móvil, quita el desvío con ##61# (o desde la app) y vuelve a poner el contestador desde la app o el área de clientes.",
  },
  {
    question: "¿La recepcionista habla gallego?",
    answer:
      "Si tu negocio está en Galicia y su dirección lleva el código postal, sí: atiende en gallego a quien llama en gallego, sin que tengas que configurar nada más. Si la dirección no lo lleva, elige el gallego como idioma principal en tu panel, en «Cómo atiende».",
  },
];

export default function DesvioRGaliciaPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      migas={[
        { name: "Desvío de llamadas", path: "/desvio-de-llamadas" },
        { name: "R (Galicia)", path: ruta },
      ]}
      etiqueta={{ icono: Smartphone, texto: "R · móvil y fijo" }}
      titulo={titulo}
      entradilla={
        <p>
          Con R puedes desviar tanto el móvil como el fijo desde su app, sin
          marcar ningún código. Si prefieres el teclado, aquí tienes los códigos
          completos: en la web de R algunos aparecen a medias.
        </p>
      }
      descripcion={descripcion}
      ctaSecundario={{ texto: "Desde la app de R", href: "#app" }}
      ubicacion="desvio_r"
      faqs={faqs}
      tituloFaqs="Preguntas sobre el desvío en R"
      relacionadas={[
        {
          href: "/desvio-de-llamadas",
          titulo: "Todos los operadores",
          texto: "Desviar o dar el número de Alhabla, y cómo quitarlo.",
        },
        {
          href: "/recepcionista-ia-en-gallego",
          titulo: "Atención en gallego",
          texto: "En Galicia atiende en gallego a quien llama en gallego.",
        },
        {
          href: "/desvio-de-llamadas/telecable",
          titulo: "Desvío en Telecable",
          texto: "Del mismo grupo, con segundos de 5 a 30.",
        },
      ]}
      cierre="Con R, en castellano o en gallego, cada llamada tiene respuesta."
    >
      <ConNumeroDeAlhabla>
        <Seccion
          id="movil"
          titulo="En tu móvil R"
          entradilla={
            <p>
              En la web de R, varios códigos salen cortados (el inmediato
              aparece como «*21… #»). Estos son los completos: márcalos desde el
              móvil que quieres desviar y pulsa llamar.
            </p>
          }
        >
          <div className="grid gap-6">
            <CampoNumeroDeAlhabla />
            <TablaDeCodigos
              titulo="Móvil R"
              filas={[
                {
                  tipo: "Si no contestas",
                  recomendado: true,
                  activar: "**61*{N}#",
                  quitar: "##61#",
                  consultar: "*#61#",
                  detalle: "El único que la web de R muestra entero.",
                },
                {
                  tipo: "Si comunicas",
                  recomendado: true,
                  activar: "**67*{N}#",
                  quitar: "##67#",
                  consultar: "*#67#",
                },
                {
                  tipo: "Apagado o sin cobertura",
                  recomendado: true,
                  activar: "**62*{N}#",
                  quitar: "##62#",
                  consultar: "*#62#",
                },
                {
                  tipo: "Inmediato",
                  activar: "**21*{N}#",
                  quitar: "##21#",
                  consultar: "*#21#",
                },
              ]}
            />
          </div>
          <div className="mt-8">
            <Texto>
              <p>
                <strong>Qué pagas.</strong> R lo dice en una frase: las llamadas
                desviadas a otro número se cobran como llamadas desde tu línea;
                al contestador, gratis. El de Alhabla es un fijo nacional: si tu
                tarifa incluye esas llamadas, no notarás la diferencia.
              </p>
            </Texto>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div id="app" className="scroll-m-20">
              <Nota tipo="consejo" titulo="Sin códigos: desde la app de R">
                <p>
                  <strong>Móvil:</strong> configurar › configurar móbilR ›
                  configurar desvíos, y escribe el número de Alhabla.{" "}
                  <strong>Fijo:</strong> Teléfono › Configurar teléfono ›
                  Configurar desvíos del teléfono fijo, y elige «a un número»
                  en lugar del contestador. También desde el área de clientes
                  de la web; la confirmación llega en 20 o 30 segundos.
                </p>
              </Nota>
            </div>
            <ComprobarDesvio>
              <p>
                En el móvil, marca <Codigo>*#61#</Codigo>: tiene que salir el
                número de Alhabla.
              </p>
            </ComprobarDesvio>
          </div>
        </Seccion>

        <Seccion
          id="fijo"
          fondo
          titulo="Los códigos del fijo"
          entradilla={
            <p>
              Para el fijo, R los publica completos, salvo uno: el de quitar el
              desvío si comunicas. Ese, desde la app o el área de clientes.
            </p>
          }
        >
          <TablaDeCodigos
            titulo="Fijo R"
            filas={[
              {
                tipo: "Si no contestas",
                recomendado: true,
                activar: "*61*{N}#",
                quitar: "#61#",
              },
              {
                tipo: "Si comunicas",
                activar: "*67*{N}#",
                detalle: "R no publica el código para quitarlo.",
              },
              { tipo: "Todas", activar: "*21*{N}#", quitar: "#21#" },
            ]}
            nota="R no publica código de consulta para el fijo: la prueba es «Comprobar desvío»."
          />
          <div className="mt-8">
            <Texto>
              <p>
                Con el código postal de Galicia en la dirección de tu negocio,
                la recepcionista atiende en gallego a quien llama en gallego:{" "}
                <Link href="/recepcionista-ia-en-gallego">cómo funciona</Link>.
              </p>
            </Texto>
          </div>
        </Seccion>

        <Fuentes
          consultadas="2026-10-20"
          fuentes={[
            {
              nombre: "R: desvío de llamadas del móvil",
              url: "https://mundo-r.com/es/ayuda-clientes/desvio-movil-r",
            },
            {
              nombre: "R: desvío de llamadas del fijo",
              url: "https://mundo-r.com/es/ayuda-clientes/desvio-llamadas",
            },
            {
              nombre: "Blog de R: configurar el desvío del fijo",
              url: "https://blog.mundo-r.com/es/como-configurar-desvio-llamadas-telefono-fijo-r",
            },
          ]}
        />
      </ConNumeroDeAlhabla>
    </PaginaGuia>
  );
}
