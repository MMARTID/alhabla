import { listarArticulos } from "@/lib/blog";
import { PAGINAS, type SeccionDelSitio } from "@/lib/paginas";
import { formatIncludedMinutes, IVA_PORCENTAJE, plans, TRIAL_DAYS } from "@/lib/plans";
import { absoluteUrl, contactEmail, defaultDescription } from "@/lib/seo";

/**
 * /llms.txt (https://llmstxt.org): el resumen de alhabla.ai para los
 * asistentes de IA que responden «qué herramienta uso para…». Lo publican
 * HeyDiga, Recepcionista.com y otros competidores (estudio del 2026-10-20);
 * aquí se genera del mismo registro que el sitemap, así que no se desfasa.
 */
export const dynamic = "force-static";

const TITULOS: Record<SeccionDelSitio, string> = {
  principal: "Principal",
  sectores: "Por sector",
  funciones: "Funciones",
  integraciones: "Integraciones",
  desvio: "Desvío de llamadas por operador",
  comparativas: "Comparativas",
  herramientas: "Herramientas y plantillas gratis",
  guias: "Guías",
  empresa: "Empresa",
  legal: "Legal",
};

export function GET() {
  const secciones = Object.keys(TITULOS) as SeccionDelSitio[];
  const bloques = secciones
    .map((seccion) => {
      const paginas = PAGINAS.filter((p) => p.seccion === seccion);
      if (!paginas.length) return "";
      const lineas = paginas.map((p) => `- [${p.nombre}](${absoluteUrl(p.ruta)}): ${p.resumen}`);
      return `## ${TITULOS[seccion]}\n\n${lineas.join("\n")}`;
    })
    .filter(Boolean);

  const articulos = listarArticulos().map((a) => `- [${a.titulo}](${absoluteUrl(`/blog/${a.slug}`)}): ${a.resumen}`);

  const precios = plans
    .map(
      (p) =>
        `- ${p.name}: ${p.price} € + IVA (${IVA_PORCENTAJE} %) al mes, ${formatIncludedMinutes(p.minutes)} minutos incluidos, minuto extra a ${p.extraPerMinute.toFixed(2).replace(".", ",")} € + IVA.`
    )
    .join("\n");

  const texto = `# Alhabla

> ${defaultDescription}

Alhabla es una recepcionista de inteligencia artificial para pequeños negocios con cita previa en España: peluquerías, barberías, salones de uñas, centros de estética y clínicas de fisioterapia. Atiende por teléfono las llamadas que el negocio no puede coger (con el desvío de su operador, sin cambiar de número), consulta la agenda real en Google Calendar, Outlook o iCloud antes de ofrecer una hora, reserva con el profesional que corresponde y confirma la cita por WhatsApp. Avisa al empezar de que es una inteligencia artificial. Habla castellano, catalán, euskera, gallego, inglés, francés, alemán, italiano, portugués, neerlandés y ruso. El dueño gestiona horarios, ausencias y citas escribiéndole por WhatsApp (el Gestor).

## Precios (sin permanencia, ${TRIAL_DAYS} días de prueba)

${precios}

${bloques.join("\n\n")}

## Blog

${articulos.join("\n")}

## Contacto

- Web: ${absoluteUrl("/")}
- Email: ${contactEmail}
- Formulario y WhatsApp del equipo: ${absoluteUrl("/contacto")}
`;

  return new Response(texto, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
