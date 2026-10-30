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

1. **Competidores:** además de los 7 de `comparativas.ts`, se siembran **HeyDiga (heydiga.ai) y fonio (fonio.ai)**. Pendiente de que el fundador los confirme. La regla de comparativas detecta al competidor por alias (nombre con y sin espacios, sin «AI», dominio y su primera etiqueta).
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
