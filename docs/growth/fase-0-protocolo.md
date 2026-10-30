# Fase 0 — Protocolo de validación

Sin código. Dura 1–2 semanas y cuesta unos 15–20 minutos al día. Su único producto es
**la decisión de dónde poner el esfuerzo**: Reddit, backlinks o SEO/GEO. Todo lo de
Reddit lo haces tú a mano, con tus ojos, en tu navegador; nada de esto lo hace una
herramienta.

## A. Tu cuenta de Reddit (a diario)

- Usa tu cuenta personal. No crees otras, ni de marca ni de apoyo.
- **Durante la Fase 0 no menciones Alhabla ni pongas ningún enlace.** Participa por interés
  real: responde a quien puedas ayudar, sobre todo en tu terreno (negocios con cita,
  autónomos, atención al cliente).
- Antes de comentar en una comunidad, lee sus normas. Apunta si prohíben enlaces, herramientas
  o contenido hecho con IA.
- Sin mensajes privados a nadie.

Sirve para dos cosas: que la cuenta tenga historial cuando toque mencionar Alhabla, y que
sepas por experiencia propia cómo reacciona cada comunidad.

## B. Muestreo de hilos (7 días seguidos)

**Cómo buscar** (a mano): el buscador de Reddit y la sección de comunidades relacionadas.
Reddit Pro no sirve (solo inglés). Prueba con estas palabras: peluquería, barbería, centro
de estética, uñas, fisioterapia, pestañas, cita previa, agenda, no-shows, "no puedo coger el
teléfono", llamadas perdidas, recepcionista, software de reservas, autónomo con cita.

**Dónde mirar** (tipos de comunidad; los nombres exactos no están verificados, búscalos
tú): generalistas de España, de autónomos y emprendimiento, de cada oficio (peluquería,
barbería, estética, fisioterapia) y de herramientas o IA para pequeños negocios.

**Qué anotar** por cada hilo candidato (hoja de cálculo, una fila):

| Columna | Valores |
|---|---|
| Fecha, URL, comunidad, título | texto |
| Antigüedad del hilo | horas o días |
| ¿Quien pregunta es dueño o profesional del sector? | sí / no / no se sabe |
| Dolor | llamadas perdidas · agenda · no-shows · otro |
| ¿Sigue abierto a respuestas? | sí / no |
| ¿La comunidad permite mencionar herramientas? | sí / no / solo en hilo semanal / no se sabe |
| Objetivo que encajaría | A tráfico y marca · B cliente potencial · C backlink |
| ¿Habrías respondido? Una línea de qué dirías | texto |
| Calidad | 0 (ruido) · 1 (flojo) · 2 (bueno) · 3 (muy bueno) |

**Hilo de calidad** = publicado en los últimos 7 días, el dolor encaja con lo que hace
Alhabla, se puede aportar una respuesta útil **sin** promoción y la comunidad no veta
herramientas. Puntúa 2 o 3.

**Puerta de decisión** (media de las semanas medidas):

| Hilos de calidad por semana | Decisión |
|---|---|
| 3 o más | Reddit merece un módulo propio; seguimos el diseño tal cual |
| 1 o 2 | Reddit queda como canal menor: solo entrada manual, sin esfuerzo de agentes dedicado |
| 0 | Reddit se descarta como fuente; el peso pasa a backlinks (C) y SEO/GEO |

## C. Comprobar el `rel` de los enlaces de Reddit

Mide si un enlace de Reddit pasa autoridad. En el navegador de escritorio, abre un
comentario o una publicación que contenga un enlace externo, clic derecho sobre el enlace →
**Inspeccionar** y lee el atributo `rel` (`nofollow`, `ugc`, `sponsored`, `noopener`…).
Hazlo con tres enlaces distintos: en un comentario, en una publicación de enlace y en el
perfil de un usuario. Anota qué sale. Es leer el HTML de una página que tú has abierto.

## D. Cuenta de servicio de Search Console (lectura)

La necesita el módulo SEO & GEO en la Fase 4. Puedes dejarla preparada ya:

1. En Google Cloud Console, habilita la **Search Console API** en el proyecto que prefieras.
2. Crea una cuenta de servicio `growth-lectura-gsc` **sin roles** de proyecto.
3. Crea su clave JSON y guárdala **fuera del repo** (por ejemplo `~/.alhabla-growth/` con
   permisos `600`, o el llavero de macOS). Nunca en `.env` del repo.
4. En Search Console → *Configuración* → *Usuarios y permisos*, añade el correo de la
   cuenta de servicio con permiso **Restringido** (solo lectura) en la propiedad de
   `alhabla.ai`.
5. Apunta si la propiedad es de **dominio** (`sc-domain:alhabla.ai`) o de prefijo de URL;
   cambia cómo se pide a la API.

Si prefieres que lo haga contigo paso a paso, dímelo; no toco tu cuenta de Google ni tu
proyecto de GCP sin tu confirmación.

## E. Medir el consumo de Claude Max

Los runs saldrán de tus límites de 5 horas y semanales, compartidos con tu uso normal.
Para saber el margen:

- Al cerrar cada semana de la Fase 0, anota en `claude.ai/settings/usage` el **% semanal
  consumido** sin ningún run de Growth. Es tu línea base.
- Presupuesto provisional del sistema: **no más del 10–15 % del límite semanal**. Es una
  propuesta mía sin medir; se ajusta en la Fase 2 con runs reales.
- No actives los créditos de uso (consumo adicional) para esto, o ponles un tope.

## F. Qué hago yo mientras

Muestreo inicial para el objetivo C con búsqueda web pública, sin tocar Reddit:
`docs/growth/fase-0-muestreo-backlinks.md`.

## Entregable de la Fase 0

Un mensaje tuyo con: la hoja del muestreo (o su resumen), el `rel` observado, si la cuenta
de servicio está lista y tu % semanal base. Con eso decido contigo si se pasa a la Fase 1 y
con qué peso para Reddit.
