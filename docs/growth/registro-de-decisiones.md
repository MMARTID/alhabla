# Alhabla Growth — registro de decisiones

Decisiones del fundador sobre `PLAN-GROWTH.md`. Una entrada por fecha; lo posterior
sustituye a lo anterior sin borrarlo.

## 2026-10-30 (1) — Diseño aprobado

El fundador aprobó el diseño con un «Apruebo» tras ver el resumen y las recomendaciones.
Se registraron como decididas las cinco recomendadas.

| # | Decisión | Elegida | Estado |
|---|---|---|---|
| 1 | Dónde corre la Scheduled Task | Local (Desktop), con «Mantener el equipo despierto». Nube como migración posible | Vigente |
| 2 | Búsqueda indirecta de Reddit (`site:reddit.com` en un buscador) | Apagada | **Sustituida** por (2): Reddit queda fuera |
| 3 | Cuenta de Reddit | La del fundador, con divulgación cuando se mencione Alhabla | **Sustituida** por (2) |
| 4 | Acceso al dashboard | Google con lista blanca de su correo; `growth.alhabla.ai` sin proxy de Cloudflare (a confirmar en Fase 1) | Vigente |
| 5 | Fase 0 como puerta | Poco volumen de calidad en español mueve el peso a backlinks y SEO/GEO | **Resuelta** por (2), sin medir |

Reglas fijas del diseño (no cambian sin una entrada nueva aquí):

- Todo se ejecuta a mano por el fundador. Sin publicación automática, sin correos ni mensajes automáticos.
- El backend no llama a ningún LLM: el razonamiento es de la suscripción Max, sin consumo de API.
- Ninguna fase empieza sin el visto bueno del fundador.

## 2026-10-30 (2) — Reddit fuera del sistema

A petición del fundador («omitamos lo de Reddit»):

- Se cancelan el muestreo de hilos, la cuenta de Reddit para Growth y el enlace del perfil.
- El peso del sistema pasa a backlinks (objetivo C) y SEO/GEO. Los objetivos A y B quedan reducidos.
- Es una decisión **sin datos**: no se midió cuántos hilos de calidad hay en español. Es reversible; se retomaría solo con autorización de la plataforma y evidencia (Fase 6 del plan).
- `PLAN-GROWTH.md` se reescribe como v2 sin Reddit, con run semanal y borradores de enlaces y menciones editoriales.

## 2026-10-30 (3) — Search Console sin clave

- La API de Search Console está habilitada y la cuenta de servicio `growth-lectura-gsc` tiene acceso **Restringido** a `sc-domain:alhabla.ai`, sin roles de proyecto.
- La política de la organización `iam.disableServiceAccountKeyCreation` impide crear claves. No se salta.
- Se usa suplantación: `admin@alhabla.ai` tiene `roles/iam.serviceAccountTokenCreator` **solo sobre esa cuenta de servicio**, concedido a petición del fundador.
- La suplantación no está probada de extremo a extremo; se prueba al inicio de la Fase 4.

## 2026-10-30 (4) — Fase 1b: decisiones por defecto del encargo

Tomadas por el asistente al repartir la Fase 1b, a revisar por el fundador (cualquiera se puede cambiar):

1. Alcance de token nuevo `conocimiento` (además de `leer` y `escribir`), en un token aparte. La herramienta `sincronizar_conocimiento` del MCP no recibe afirmaciones del modelo: lee los ficheros del repo con un parser determinista.
2. Sesión del dashboard: el ID token de Google como Bearer (~1 h), renovado con Google Identity Services, sin sesión propia. Alternativa si la renovación falla en el iPhone: `POST /growth/admin/sesion` con un JWT propio de 8-12 h.
3. Ajustes iniciales: `topeSemanal` 5 (0-20), `umbralDeSimilitud` 0,6 (0,4-0,9), umbrales por objetivo 60/60/60 (sin medir; se calibran con los descartes) y `pausa` falsa.
4. Al calificar, el backend aplica las puertas duras (dominio propio, competidor, umbral) con auto-descarte firmado por `sistema`; las URL de fuente manual están exentas del umbral, no de las demás puertas.
5. Una URL ya existente (aunque esté descartada o caducada) responde 200 con `creada: false`; no se reabre.
6. `rechazado` => `gestion.resultado = "rechazado"` y la oportunidad pasa a `sin_respuesta` («Cerrada sin éxito»).
7. Del contacto solo se guarda `urlContacto` (URL), nunca correos ni teléfonos.
8. Los topes cuentan gestiones hechas + oportunidades `aprobada` sin gestionar, y se comprueban también al aprobar.
9. Solo caduca `aprobada` (por el job); aprobar rechaza una oportunidad con `expiraEn` vencida. Una `pendiente_aprobacion` vencida no caduca sola.
10. Fuera de la 1b: nichos, fuentes y tokens en el dashboard (los tokens, por script), POST/DELETE de competidores y las rutas de métricas y de nichos del agente.
11. Paginación por página y límite con total.
12. Competidores sembrados por el sincronizador: los 7 de `comparativas.ts` (Retell AI, Vapi, Bland AI, Synthflow, ElevenLabs, PolyAI y Voiceflow), no HeyDiga ni fonio. **Pendiente de confirmar** qué empresas cuentan como competidor a efectos de la regla de comparativas.
13. Un solo job de Scheduler, `growth-mantenimiento` (05:20 Europe/Madrid): caduca aprobadas, aplica la retención de 180 días y pone `quienEdita` a null en lo vencido. La caducidad descarta todos los borradores abiertos de la oportunidad. La purga no borra filas con decisiones, enlaces ni gestión. Está en `JOBS_QUE_NO` del MCP de desarrollo.
14. Términos prohibidos: solo los explícitos del repo, como palabra entera. **Sin emitir, a decidir por el fundador:** «API», «modelo», «agente de voz», «el Gestor», «persona real», «ausencias» y «Agente»; tampoco se emiten `precio.fundador.*`, `funcion.lista_de_espera` ni `multi_sede`, ni se ingieren `docs/investigacion-nichos.md` y `docs/auditorias/*`.
15. Al cambiar el tipo, el texto o el valor de una afirmación que cita un borrador en `pendiente_aprobacion` o `aprobada` sin gestionar, el sincronizador lo pasa a `bloqueado` (y la oportunidad a `bloqueada`). Hay una guarda de cierres masivos (más de 25, o más del 30 % con más de 5, o un tipo vaciado).
16. El MCP no expone ningún parámetro de estado en lo que escribe y no reintenta lo no idempotente (`abrir_ejecucion`, `crear_borrador`, `registrar_cumplimiento`); `calificar_oportunidad` exige las tres puntuaciones; el MCP valida los cuerpos con los mismos esquemas del backend.
17. Detalles de implementación: la guardia de pausa es un `preHandler` por ruta; `hechaEn` admite hasta 5 minutos de futuro (reloj del móvil); aprobar separa los fallos del texto (bloquean y se guardan) de las restricciones de agenda (409 sin tocar el borrador); la «última revisión» es la de las reglas, no la del modelo; el cierre de una ejecución es `POST /growth/agente/ejecuciones/:id/cierre` y el resumen lo calcula el servidor.
18. El modo demostración del dashboard solo existe en desarrollo, con triple seguro (condición literal en dos puntos, error al cargar en producción y paso de CI con una sentinela). La navegación móvil usa 4 pestañas más «Más».

## 2026-10-30 (5) — Correcciones tras la revisión adversarial de la 1b

Tres revisores independientes (seguridad y corrección del backend, sincronizador y jobs, extremo a extremo con base de datos real) encontraron fallos, y se corrigieron antes de abrir los PR. Decisiones de esa tanda, a revisar:

1. **Competidores:** además de los 7 de `comparativas.ts`, se siembran **HeyDiga (heydiga.com) y fonio (fonio.ai)**. Pendiente de que el fundador los confirme. La regla de comparativas detecta al competidor por alias (nombre con y sin espacios, sin «AI», dominio y su primera etiqueta).
2. **Un token con alcance `conocimiento` solo puede endurecer las prohibiciones**: retirar una `prohibida`, quitar un término o pasar `palabrasEnteras` a falso es 409 `prohibida_debilitada`; renombrar una clave cuenta como retirada. Un debilitamiento deliberado o un cambio masivo legítimo exige un administrador y **todavía no existe esa ruta** (`forzarCierres` no está expuesto).
3. **Guardas de cierres por tipo:** más de 2 o más del 25 % de un tipo, más del 60 % y 30 cambios en total contando modificaciones, o un tipo vaciado.
4. **Aprobar y editar no bloquean el texto por reglas de agenda**: responden 409 con su código (`tope_semanal`, `dominio_en_enfriamiento`, `dominio_ya_aprobado`) sin cambiar nada. Consecuencia: con el tope semanal lleno no se puede ni corregir una errata de un pendiente (alternativa si molesta: guardar y avisar).
5. **Un orden único de bloqueo** (`growth_aprobar` → `growth_conocimiento` → filas) para aprobar, editar, devolver, descartar, crear borradores y el sincronizador; deadlocks y timeouts responden 409 `conflicto`.
6. **La similitud dura** compara solo con borradores anteriores de otras oportunidades (pendientes, aprobados, gestionados, de los últimos 180 días).
7. **Aperturas de ejecución casi simultáneas** (menos de 30 s) devuelven la misma (`reutilizada: true`) en lugar de cerrar la anterior como interrumpida.
8. **Texto de páginas ajenas:** todo bajo `terceros` en lo que ve el agente (oportunidad, investigación y última decisión).
9. **Detalle del administrador:** `acciones` solo con las alcanzables; la pestaña «caducados» se define por el estado de la oportunidad.
10. **Notas de la gestión:** lo que se anota al cerrar (`rechazado`, `sin_respuesta`) se suma a lo anotado al marcar como gestionado.
11. **Pendiente del fundador, producto:** `PRODUCT.md` dice que el recordatorio es de todos los planes y `plans.ts`/`planFeatures.ts` lo limitan a Pro y Scale; los términos «Nunca» de `PRODUCT.md` que no se aplican por ambiguos (agente de voz, el Gestor, modelo, API, proveedores) quedan por decidir.

## 2026-10-30 (6) — Competencia, antes de la Fase 2

El fundador pidió, antes de lanzar el primer run, poder gestionar la competencia desde el panel, que el agente analice la web de un competidor a partir de su URL y que busque dónde se menciona a los competidores. Decidido:

1. **Alta, edición y baja desde el panel.** Añadir un competidor pide una URL; el dominio sale de ella y no cambia. Los 9 sembrados desde el repositorio (`origen = repo`) no se pueden quitar: los volvería a sembrar el sincronizador.
2. **Análisis por URL en el siguiente run.** El competidor entra como `por_analizar` y el agente guarda su producto, sus servicios, sus precios y sus planes, cada dato con la página y la fecha en que se leyó. Un análisis caduca a los 90 días y el agente lo repite; no se admite uno nuevo antes de 7 días salvo que lo pidas con «Volver a analizar». Se conservan 10 versiones. Solo hechos públicos: nunca correos ni teléfonos.
3. **Solo inteligencia interna.** Un análisis no se puede citar en un borrador. La regla dura 3 (`comparativa_con_fuente`) y las afirmaciones `comparativa.*` no cambian y siguen saliendo solo de `web/src/lib/comparativas.ts`. Consecuencia buscada: un competidor añadido por URL no se puede nombrar en un borrador, porque el backend lo bloquea y no hay `comparativa.*` para él.
4. **HeyDiga y fonio, confirmados** como competidores (cierra el punto 1 de la entrada (5); siguen sembrados por el sincronizador).
5. **El agente propone, tú decides.** Al leer las listas «alternativas a X» el agente puede proponer competidores nuevos (`proponer_competidor`, hasta 20 pendientes). Un competidor `propuesto` **no aplica ninguna regla dura** (ni la puerta de «es un competidor» al calificar, ni la regla 3, ni el aviso de dominio) hasta que lo aceptas en el panel. Así una página hostil no consigue que el agente declare «competidor» a un dominio legítimo. Rechazarlo es borrarlo.
6. **Menciones.** Discovery busca páginas que listan o comparan a los competidores conocidos y marca la oportunidad con los dominios que menciona (`datos.competidoresMencionados`, hasta 10, solo de competidores no propuestos). El panel filtra la Bandeja por competidor. Sin herramienta de pago de backlinks, el resultado es aproximado.
7. **El backend nunca visita la URL de un competidor.** Solo lo hace el agente con `web_fetch`; el backend sigue sin llamar a ningún LLM. El MCP pasa de 15 a 18 herramientas (`listar_competidores`, `guardar_analisis_de_competidor`, `proponer_competidor`) y ninguna acepta un competidor ni aprueba nada.
8. **Fase 2 dividida:** 2a Competencia (backend, MCP y panel) y 2b Agentes y run manual (`PLAN-GROWTH.md` § 9). Presupuesto de uso provisional del run, sin medir: no más del 10 % del límite semanal; la línea base sigue pendiente.
9. **Decisiones de los agentes (Fase 2b), por defecto del encargo y a revisar:** 6 subagentes (Knowledge es el sincronizador determinista y SEO & GEO es de la Fase 4); presupuestos duros por run escritos en `growth/agentes/orquestador.md` (provisionales hasta medir); el run se lanza con `/growth-run` desde Claude Code, con el token de alcances `leer` y `escribir` y sin `Bash`; un hook en `.claude/settings.json` deniega reddit.com y redd.it en la lectura web de **todas** las sesiones del repo.

## 2026-10-31 (7) — Tras el primer run real

El primer run (`competencia ligero`, 31-10-2026, ejecución cerrada como `parcial`) analizó fonio (21 datos, con fuente y fecha) y HeyDiga (7 datos de prensa, sin web). No movió el consumo semanal de Max (42 % antes y después) y subió la ventana de 5 horas del 4 % al 5 %, con esta conversación incluida.

1. **Corrección del dominio de HeyDiga:** es `heydiga.com`, no `heydiga.ai` (que no resuelve; la auditoría del 27-10 ya citaba `heydiga.com/es/precios`). Se corrige la siembra del sincronizador (`COMPETIDORES_ADICIONALES`). En producción la fila sembrada con el dominio viejo se renombra a mano **antes** de la siguiente sincronización: el sincronizador solo da de alta y, si no, crearía una fila duplicada.
2. **Modelos fijados en todos los subagentes:** redacción pasa de `inherit` a `opus` (esfuerzo alto) y cumplimiento de `inherit` a `sonnet`; el resto sigue en `sonnet`, esfuerzo medio. Con `inherit` el coste dependía de cómo se abriera la sesión. Tabla y motivos en `growth/agentes/README.md`. La calificación es candidata a `haiku` cuando los umbrales estén calibrados.
3. **`ligero` se aplica también al reparto por competidor:** hasta 2 competidores, con 3 páginas y 1 búsqueda cada uno (la sesión del run lo interpretó así por sí sola y el documento no lo decía).
4. **Los subagentes arrancaron en segundo plano** aunque el orquestador pide primer plano, y funcionaron con `WebFetch` y `WebSearch`. Se vigila en los siguientes runs.

## 2026-10-31 (8) — Semillas de descubrimiento

El primer run completo (`ligero`) dio 3 candidatas y 1 borrador (la ficha de Beautymarket, que el fundador envió). Gastó 7 de 13 búsquedas y 11 de 32 páginas: el límite no fue el presupuesto sino la estrategia de búsqueda (unas pocas consultas genéricas; las de asociaciones devolvieron BOE y noticias locales). Mientras, los análisis de los competidores ya listaban, con su URL, los directorios donde ellos aparecen.

1. **Nuevo foco `semillas`**, el primero del paso 4: el descubrimiento **abre** una lista corta de páginas conocidas (`growth/agentes/semillas.md`) en vez de buscar. Presupuesto 2 búsquedas / 8 páginas / 6 oportunidades; hasta 6 semillas por run (3 en `ligero`).
2. **Una semilla se salta si el servidor ya conoce el dominio** (`listar_oportunidades` con `dominio`): no hay que marcar nada al procesarla.
3. **La lista sale de los datos**, no de suposiciones: Capterra, GetApp, Software Advice, G2, AlternativeTo, SourceForge y SelectHub (reseñas y comparativas), Stork, AI Agents Directory, Toolradar y topai.tools (directorios de IA), Beautymarket (hecha) y las pistas ANEPE, ANEIP y la asociación de peluquería de Asturias (sin web comprobada). Se descartan de antemano `openalternative.co` (solo código abierto) y los blogs de otros proveedores de IA de voz.
4. **Topes del run al alza, sin tocar `ligero`:** búsquedas 26 → 28, páginas 64 → 72, oportunidades nuevas 20 → 26, subagentes 36 → 37. Sigue pendiente medir el coste de un run completo.
