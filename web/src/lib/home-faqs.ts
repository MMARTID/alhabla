// Las dudas que quedan justo antes del CTA de cierre de la portada: seis, y
// ninguna que ya respondan las secciones de arriba (número de siempre y
// desvío, reservas sin solapes, recados, tu asistente, ausencias, grabación en
// el panel, permanencia). La lista completa por sector vive en las landings de
// nicho.
//
// Vive en un módulo de datos aparte (no dentro de `main-landing.tsx`, que es
// "use client") porque `page.tsx` la necesita también para el JSON-LD
// FAQPage: importar una constante desde un archivo cliente en un componente
// de servidor rompe el build de Next (RSC la envuelve como referencia de
// cliente y `.map()` deja de poder llamarse en el servidor).
export const HOME_QUICK_FAQS = [
  {
    question: "¿Sabe el cliente que habla con una IA?",
    answer:
      "Sí. Cada llamada empieza con el nombre de tu negocio y «te atiende su asistente de inteligencia artificial», como pide el Reglamento europeo de IA. Y solo se graba si el cliente da permiso.",
  },
  {
    question: "¿Necesito conectar un calendario?",
    answer:
      "No. Si usas Google Calendar, Outlook o iCloud, las citas entran ahí. Si no usas ninguno, van a la agenda de Alhabla: la ves en el panel, apuntas citas y ausencias desde ahí o por WhatsApp, y la tienes en el calendario del móvil con un enlace.",
  },
  {
    question: "¿En qué idiomas atiende?",
    answer:
      "En castellano y siete idiomas más (inglés, francés, alemán, italiano, portugués, neerlandés y ruso), y en catalán, euskera o gallego según dónde esté tu negocio. En todos los planes.",
  },
  {
    question: "¿Y si el cliente quiere hablar con una persona?",
    answer:
      "Con el desvío, lo normal es que tu teléfono suene primero y la recepcionista coja lo que tú no puedes. Y si das el número de Alhabla como principal, te pasa la llamada al móvil cuando el cliente lo pide.",
  },
  {
    question: "¿Me cobráis durante la prueba?",
    answer:
      "No. Se pide tarjeta al empezar, pero no se cobra nada hasta que acaban los 7 días. Si cancelas antes, no pagas nada.",
  },
  {
    question: "¿Qué pasa si supero los minutos incluidos?",
    answer:
      "Sigue atendiendo. Te avisamos por correo al llegar al 80 % y cada minuto de más se cobra al precio de tu plan, que ves antes de contratar.",
  },
] as const;
