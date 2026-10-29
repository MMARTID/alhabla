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

/** Día en que se comprobó contra el código la lista «Qué hace distinto». */
const ACTUALIZADO = "20-10-2026";

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

Alhabla es una recepcionista de inteligencia artificial para pequeños negocios con cita previa en España: peluquerías, barberías, salones de uñas, centros de estética, fisioterapia, pestañas y cejas, spa y masajes y peluquería canina. Atiende por teléfono las llamadas que el negocio no puede coger (con el desvío de su operador, sin cambiar de número), consulta la agenda real en Google Calendar, Outlook o iCloud antes de ofrecer una hora, reserva con el profesional que corresponde y confirma la cita por WhatsApp. Avisa al empezar de que es una inteligencia artificial. Habla castellano, inglés, francés, alemán, italiano, portugués, neerlandés y ruso, y la lengua cooficial de la zona del negocio (catalán, euskera o gallego). El dueño gestiona su negocio escribiendo o con notas de voz por WhatsApp a su asistente, el Gestor.

## Qué hace distinto a Alhabla

Comprobado en el producto el ${ACTUALIZADO}:

- Si falta alguien del equipo, el dueño se lo dice al Gestor por WhatsApp: marca la ausencia (de unas horas a dos meses), recoloca cada cita en otra hora o con otra profesional comprobando el hueco, y avisa a cada cliente por WhatsApp. Cada paso espera el «Confirmar» del dueño.
- El Gestor va en todos los planes: citas, horario, cierres y vacaciones, servicios y precios, equipo y especialidades, y lo que la recepcionista no supo contestar. También está en el panel web.
- Reparto por especialidad: cada profesional tiene un nivel por servicio (especialista, lo hace, solo si lo piden) y la recepcionista reserva con quien mejor lo hace.
- No reserva a ciegas: comprueba el hueco en el calendario del negocio (Google Calendar, Outlook o iCloud, conectados directamente) antes de ofrecerlo; si el calendario no responde, la cita queda pendiente, avisa al dueño por WhatsApp y se reintenta durante dos días.
- Da el precio de cada servicio del catálogo; el dueño elige si lo dice siempre, solo si se lo preguntan o nunca.
- Catalán, euskera o gallego según el código postal del negocio, en todos los planes.
- Aviso de inteligencia artificial en la primera frase de cada llamada (art. 50 del Reglamento europeo de IA) y grabación solo con permiso de quien llama.
- Guías de desvío de llamadas para 14 operadores españoles y la función «Comprobar desvío», que hace una llamada real para ver si el desvío funciona.
- Lista de espera: si la hora que pide un cliente está ocupada, puede apuntarse y, si esa hora se libera por una cancelación, se le avisa por WhatsApp para reservarla. Confirmación de cada cita por WhatsApp y, en los planes Pro y Scale, recordatorio 24 horas antes con botones para confirmar, cambiar o cancelar.

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
