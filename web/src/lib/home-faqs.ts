// Las dudas que más frenan una decisión justo antes del CTA de cierre de la
// portada (8 desde el 2026-09-26: se añadieron las de recados, solapes,
// grabaciones y El Gestor; 10 desde el 2026-10-20, con las ausencias y el
// aviso de IA). La lista completa por sector vive en las
// landings de nicho.
//
// Vive en un módulo de datos aparte (no dentro de `main-landing.tsx`, que es
// "use client") porque `page.tsx` la necesita también para el JSON-LD
// FAQPage: importar una constante desde un archivo cliente en un componente
// de servidor rompe el build de Next (RSC la envuelve como referencia de
// cliente y `.map()` deja de poder llamarse en el servidor).
export const HOME_QUICK_FAQS = [
  {
    question: "¿Mantengo mi número de teléfono de siempre?",
    answer: "Sí, completamente. Alhabla atiende mediante un desvío desde tu móvil o fijo habitual; no publicas un número nuevo ni avisas a nadie.",
  },
  {
    question: "¿Es difícil de configurar?",
    answer: "No. Activas el desvío marcando un código en tu teléfono, con la guía de tu operador, y desde el panel lo compruebas: Alhabla te llama y te dice si salta o por qué no.",
  },
  {
    question: "¿Hay permanencia?",
    answer: "No. Empiezas con el plan que mejor encaje y lo cambias cuando lo necesites, sin contratos largos.",
  },
  {
    question: "¿Y si le preguntan algo que no sabe?",
    answer: "No se lo inventa. Responde solo con los datos de tu negocio (servicios, precios, horario y equipo) y, si la pregunta se sale de ahí, toma un recado y te llega por WhatsApp para que respondas tú.",
  },
  {
    question: "¿Puede reservar encima de una cita que ya tengo?",
    answer: "No. Comprueba tu calendario antes de ofrecer una hora. Y si no usas ninguno, reserva en la agenda de Alhabla: ahí ve lo que ha reservado y lo que tú apuntes desde el panel o por WhatsApp.",
  },
  {
    question: "¿Necesito conectar un calendario?",
    answer: "No. Puedes conectar Google Calendar, Outlook o iCloud para que las citas entren donde ya miras tu agenda, o usar la agenda de Alhabla sin conectar nada: la ves en el panel, la apuntas por WhatsApp y te la suscribes en el calendario del móvil con un enlace de solo lectura.",
  },
  {
    question: "¿Puedo escuchar lo que ha hablado con mis clientes?",
    answer: "Sí. En tu panel tienes cada llamada con su transcripción y cómo terminó: cita reservada, cambio, recado o consulta resuelta. Y su grabación, si el cliente ha dado permiso: la recepcionista se lo pide.",
  },
  {
    question: "¿Y si prefiero cambiar algo sin entrar al panel?",
    answer: "Se lo dices por WhatsApp. El Gestor cambia precios, horarios, cierres y citas, pero siempre te propone el cambio primero y solo lo aplica cuando pulsas «Confirmar».",
  },
  {
    question: "¿Y si un día falta alguien de mi equipo?",
    answer: "Escribes al Gestor «Marta no viene mañana». Al confirmar, deja de darle citas y te dice cuántas tenía; le dices a quién pasar cada una, confirmas el cambio y te pregunta si avisa al cliente por WhatsApp.",
  },
  {
    question: "¿Sabe el cliente que habla con una IA?",
    answer: "Sí. Cada llamada empieza con el nombre de tu negocio y el aviso de que atiende su asistente de inteligencia artificial, como pide el Reglamento europeo de IA. Y solo graba si el cliente da permiso.",
  },
  {
    question: "¿Qué pasa si supero los minutos incluidos?",
    answer: "Sin sorpresas: cada plan muestra el coste por minuto adicional antes de contratar.",
  },
] as const;
