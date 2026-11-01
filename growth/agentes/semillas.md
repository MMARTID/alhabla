# Semillas de descubrimiento

Dónde mirar **antes** de buscar a ciegas. La lista sale de lo que ya sabemos:
los análisis de competidores (dónde aparecen ellos), el primer run y lo que ya se
hizo a mano. Es un fichero del repo: lo edita el fundador con un PR (añadir una
semilla, marcarla «no aplica» o corregir una página).

## Cómo se usa

- Las lee el orquestador en el paso 4, foco `semillas` (`orquestador.md`), y se las
  pasa a `growth-descubrimiento`. Se procesan hasta 6 por run (3 en `ligero`), en
  el orden de este fichero.
- **Una semilla se salta si el servidor ya conoce ese dominio**: basta
  `listar_oportunidades` con `dominio` y cualquier estado. Así no hace falta
  marcar nada aquí cuando se procesa, y la regla de «un contacto por dominio cada
  90 días» sigue mandando.
- El subagente **abre la página** de la semilla (no se crea una oportunidad de una
  página que no se ha leído) y busca ahí la vía de alta: «para proveedores»,
  «añadir producto», «sugerir herramienta», un formulario de alta… Si la
  encuentra, la oportunidad apunta a esa página; si no, a la portada, y la nota
  dice que no se localizó. Qué cuesta darse de alta (gratis, de pago, con
  reseñas verificadas) lo dice la página: no se supone.
- Todas son `tipoDestino: directorio`, objetivo `TRAFICO_MARCA` y `fuenteTipo:
  directorio`. El calificador decide si pasan el umbral.

## Directorios de reseñas y comparativas de software

Aparecen en los análisis de los competidores («Mencionado en…»).

| Dominio | Página de partida | Dónde la hemos visto | Nota |
|---|---|---|---|
| `capterra.com` | https://www.capterra.com/ | fonio, ElevenLabs, PolyAI, Voiceflow | Mismo grupo que GetApp y Software Advice (Gartner Digital Markets): es probable que una sola alta sirva para los tres; compruébalo al leer |
| `getapp.com` | https://www.getapp.com/ | fonio, Retell AI | Grupo Capterra |
| `softwareadvice.com` | https://www.softwareadvice.com/ | fonio | Grupo Capterra |
| `g2.com` | https://www.g2.com/ | fonio, ElevenLabs, PolyAI, Synthflow, Retell AI, Voiceflow | El más repetido en los análisis |
| `alternativeto.net` | https://alternativeto.net/ | Bland AI, ElevenLabs, Voiceflow | Páginas de «alternativas a…» |
| `sourceforge.net` | https://sourceforge.net/ | Vapi | |
| `selecthub.com` | https://www.selecthub.com/ | ElevenLabs | |

## Directorios de herramientas de IA

| Dominio | Página de partida | Dónde la hemos visto | Nota |
|---|---|---|---|
| `stork.ai` | https://www.stork.ai/ | fonio | |
| `aiagentsdirectory.com` | https://aiagentsdirectory.com/ | Retell AI, Vapi | |
| `toolradar.com` | https://toolradar.com/ | Bland AI, Retell AI | |
| `topai.tools` | https://topai.tools/ | ElevenLabs | |

## Sector y local (España)

| Dominio | Página de partida | Estado | Nota |
|---|---|---|---|
| `beautymarket.es` | https://www.beautymarket.es/empresas/ | **Hecha** | Ficha gratuita enviada por el fundador el 31-10-2026 (oportunidad gestionada). No repetir |
| ANEPE, ANEIP, la asociación de peluquería de Asturias | (sin web comprobada) | Pista del primer run | No está confirmado que existan con esos nombres ni que acepten empresas colaboradoras: busca su web oficial y la vía de alta antes de crear nada. Si no hay una página que lo diga, no hay oportunidad |

## No aplican

Criterio del primer run; si cambia, se edita aquí.

- `openalternative.co`: directorio de alternativas de **código abierto**; Alhabla no lo es.
- Blogs de otros proveedores de IA de voz con su propia lista de «alternativas a…»
  (`cloudtalk.io`, `dasha.ai`, `happyrobot.ai`, `eesel.ai`, `retellai.com`…): es
  contenido comercial de la competencia, con ellos primeros en su propia lista.
  El servidor descarta los de competidores confirmados (código `competidor`); los
  demás se tratan igual.
