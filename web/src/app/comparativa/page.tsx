import { Scale } from "lucide-react";
import { IndiceDePaginas, PaginaGuia, Seccion, Tabla, Texto } from "@/components/pagina-guia";
import { paginasBajo } from "@/lib/paginas";
import { metadataDePagina } from "@/lib/seo";

/**
 * Índice de comparativas (2026-10-20). Con nombre solo HeyDiga y fonio
 * (decisión del usuario); el resto compara modelos de atención, no empresas.
 */
const ruta = "/comparativa";
const titulo = "Recepcionista de IA: comparativas para decidir";
const descripcion =
  "Recepcionista de IA frente a otras IAs, a una persona en plantilla, a una secretaria telefónica o a una centralita virtual: qué resuelve cada opción.";

export const metadata = metadataDePagina({ ruta, titulo, descripcion });

export default function ComparativasPage() {
  return (
    <PaginaGuia
      ruta={ruta}
      tipo="CollectionPage"
      migas={[{ name: "Comparativas", path: ruta }]}
      etiqueta={{ icono: Scale, texto: "Comparativas" }}
      titulo={titulo}
      descripcion={descripcion}
      ubicacion="comparativas"
      entradilla={
        <p>
          Antes de poner una recepcionista de IA, casi todo el mundo compara con lo que conoce: el contestador, una
          persona, una secretaria externa o la centralita de su operador. Y, si ya está decidido, con otras IAs. Aquí
          tienes cada comparación con datos, incluidas las cosas en las que Alhabla no es la mejor opción.
        </p>
      }
      relacionadas={[
        { href: "/herramientas/calculadora-de-llamadas-perdidas", titulo: "Calculadora de llamadas perdidas" },
        { href: "/blog/cuanto-cuesta-una-recepcionista-de-ia", titulo: "Cuánto cuesta una recepcionista de IA" },
        { href: "/planes", titulo: "Planes y precios" },
      ]}
      cierre="La mejor comparación es una semana con tus llamadas."
    >
      <Seccion titulo="Todas las comparativas">
        <IndiceDePaginas paginas={paginasBajo(ruta)} />
      </Seccion>

      <Seccion fondo titulo="Las cinco opciones, en una tabla">
        <Tabla
          cabecera={["Opción", "Coge la llamada", "Cierra la cita", "Fuera de horario", "Coste típico"]}
          filas={[
            ["Contestador o buzón", "No", "No", "Deja mensaje", "Gratis o casi"],
            ["Centralita virtual con menú", "Reparte", "No", "Locución y buzón", "Cuota por extensión"],
            ["Secretaria telefónica externa", "Sí, una persona", "A veces", "Según el servicio", "Cuota + por llamada"],
            ["Recepcionista en plantilla", "Sí, en su horario", "Sí", "No", "Unos 22.900 €/año en 2026"],
            ["Recepcionista de IA", "Sí, siempre", "Sí", "Sí", "Desde 59 € + IVA/mes en Alhabla"],
          ]}
          nota="El coste de la recepcionista en plantilla sale del convenio de peluquerías de 2026 más la cotización de empresa; el detalle está en su comparativa."
        />
      </Seccion>

      <Seccion titulo="Cómo leemos cada comparativa" estrecha>
        <Texto>
          <p>
            Las comparativas con otras recepcionistas de IA usan solo lo que cada empresa publica en su web, con la fecha
            y el enlace, como exige la Ley de Competencia Desleal para la publicidad comparativa. Cuando un dato no está
            publicado, lo decimos así, «no consta en su web», en lugar de suponer. Y cuando otra opción es mejor para un
            caso concreto, también lo decimos: no todos los negocios necesitan lo mismo.
          </p>
        </Texto>
      </Seccion>
    </PaginaGuia>
  );
}
