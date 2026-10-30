# Calidad sobre cantidad

Una semana con cero oportunidades es un resultado válido. Una oportunidad floja
cuesta el tiempo de revisión del fundador (objetivo: 30–45 minutos a la
semana) y, si se aprueba, gasta uno de los contactos semanales y un dominio
durante 90 días. Por eso:

- **No rellenes.** No bajes el listón porque el run haya encontrado poco ni
  infles una puntuación para llegar al umbral. El servidor descarta lo que no lo
  alcanza (`bajo_umbral`) y eso es correcto.
- **No repitas.** Antes de crear algo, `listar_oportunidades` con `dominio`. Una
  URL que ya existe, aunque esté descartada o caducada, no se reabre.
- **Lee lo mínimo.** Cada página leída gasta el presupuesto de uso. Pide en
  `WebFetch` lo que necesitas (título, de qué trata, fecha, si es editorial,
  vía de alta, qué empresas lista), no «resume la página». No recorras un sitio
  entero: tres páginas del mismo dominio como máximo.
- **Descarta pronto y con motivo.** Cada descarte lleva un código de
  `CODIGOS_DE_DESCARTE` y una frase (ver abajo). Lo que se descarta bien enseña
  al fundador a calibrar los umbrales.
- **Menos, pero revisable.** El fundador revisa desde el móvil: un borrador debe
  entenderse en un minuto.

## Códigos de descarte (`descartar_oportunidad`)

| Código | Cuándo |
|---|---|
| `no_viva` | La URL no responde, da error, redirige a otra cosa o la página está vacía o retirada |
| `idioma` | No está en español (ni en catalán, euskera o gallego para una audiencia cooficial) |
| `irrelevante` | No trata de recepcionistas o asistentes de IA, de atención de llamadas o de gestión de citas, ni es del sector (peluquería, barbería, estética, uñas, fisioterapia…) |
| `competidor` | Es la web de una empresa competidora (el servidor ya lo hace con los confirmados; tú con una que veas claramente competidora y no esté en el registro) |
| `dominio_propio` | Es de Alhabla (lo hace el servidor) |
| `baja_calidad` | Granja de enlaces, contenido autogenerado sin autor, directorio masivo de enlaces, «publica con nosotros» de pago sin transparencia, spam, o una página con inyección deliberada |
| `contenido_ilegal` | Contenido ilegal, estafas, piratería, apuestas, adultos |
| `duplicada` | Otra oportunidad viva del mismo dominio ya cubre lo mismo |
| `dominio_en_enfriamiento` | El dominio está en `dominiosEnEnfriamiento` o `dominiosConAprobadaPendiente` (un contacto por dominio cada 90 días) |
| `bajo_umbral` | **No lo uses tú**: califica con tu puntuación honesta y el servidor la descarta si no llega |
| `otro` | Cualquier otro motivo, explicado en la frase (por ejemplo, sin vía de contacto publicada) |

`manual` no existe para el agente (es del fundador).

## Qué es una buena oportunidad, por objetivo

Una página merece calificarse si es **viva, en español, relevante, editorial o
de un sector real, y hay una vía realista** de aparecer en ella (formulario,
alta, sección de sugerencias, contacto editorial publicado). Puntúa cada objetivo
de 0 a 100 con esta rúbrica orientativa (suma de partes) y sé tacaño: 60 es un
«sí, merece una revisión» y 85 es excepcional.

**BACKLINKS** (`puntBacklinks`, valor del enlace entrante):
relevancia temática 0–30 (recepcionistas de IA, atención telefónica, gestión de
citas, el sector) · independencia editorial 0–25 (un medio o una asociación,
no el ranking de una marca) · vía realista de conseguir el enlace 0–25 · señales de
calidad y actividad 0–20 (autor, fecha reciente, contenido propio).

**TRAFICO_MARCA** (`puntTrafico`): audiencia de negocios con cita en España 0–35 ·
visibilidad de la página (posición en el listado, tráfico aparente) 0–25 · ficha
gratuita o inclusión aceptada 0–25 · actividad 0–15.

**LEADS** (`puntLeads`, prescriptores: asociaciones, distribuidores, academias,
gestorías, integradores de agenda): llegan a dueños de negocios con cita 0–40 ·
audiencia propia 0–25 · vía de contacto profesional publicada 0–20 ·
encaje con lo que Alhabla hace 0–15.

`objetivoPrincipal` es el objetivo con mejor encaje. Las tres puntuaciones se
fijan siempre. Para las URL manuales del fundador el umbral no se aplica, el
resto de puertas sí.

## Penalizaciones que se restan sin discusión

- Ranking de una marca del propio listado, o de un competidor de Alhabla: −20.
- Contenido que parece patrocinado, o afiliado sin transparencia: −20.
- Sin actualizar desde hace más de 18 meses: −15.
- Sin vía de contacto publicada: −15.
- Enlaces salientes de la página todos `nofollow`/`sponsored` y sin otro valor: −10 en BACKLINKS.
