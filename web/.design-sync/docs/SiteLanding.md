---
category: Páginas
---
Una landing de sector entera (`/peluqueria`, `/barberia`, `/salon-de-unas`,
`/centro-de-estetica`, `/fisioterapia`). Una página, no una pieza: úsala como
referencia o punto de partida para proponer cambios en una landing de sector.

Recibe `content`, un `NicheLandingContent` de `nicheLandings`, y todo sale de
ahí: el copy, el color del sector (`accent`) y el guion del relato (quién
llama, qué servicio, qué profesionales, «tu clienta» o «tu paciente»). Lo que
cuenta cada landing es propio de su oficio a propósito: la web pasa en CI una
auditoría de contenido duplicado entre páginas, así que no copies texto de una
landing a otra.

De arriba abajo: hero (`LandingHero`), datos del sector
(`SectorDataSection`), ciudades e idiomas, reparto por especialidad, guía del
oficio, el Gestor en acción (`GestorSimulacionSection` con el guion del
sector), lo que recibe el cliente por WhatsApp, beneficios, el
relevo iPhone → portátil 3D con el guion del sector, la calculadora de
pérdidas (`RevenueLossCalculator`), precios, preguntas y el cierre negro.

Sin `content` devuelve la portada (`MainLanding`). La tarjeta enseña el primer
viewport de cada sector.
