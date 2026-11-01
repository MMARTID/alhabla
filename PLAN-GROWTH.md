# PLAN-GROWTH — Alhabla Growth (v2, sin Reddit)

> **Estado (2026-10-30): v2, alcance reducido. Fases 0 y 1 hechas (1b fusionada en #384–#386).
> La Fase 2 se divide en dos: la 2a (Competencia: backend, MCP de 18 herramientas y panel) y los
> ficheros de la 2b (orquestador, subagentes, hook y comando) se preparan en la rama
> `code/growth-fase-2`; la 2b no está probada: no se ha lanzado ningún run y no hay Scheduled Task.**
> La v1 (fusionada en #381) incluía Reddit como fuente de conversaciones. El 2026-10-30 el
> fundador decidió omitirlo; esta versión lo retira y reorienta el sistema hacia **backlinks,
> SEO y visibilidad en IA**. Decisiones en `docs/growth/registro-de-decisiones.md`; cierre de la
> Fase 0 en `docs/growth/fase-0-protocolo.md`. Cada fase siguiente necesita tu visto bueno.

Alhabla Growth es un sistema interno que **encuentra oportunidades de enlace y de visibilidad,
prepara los borradores y los deja en una bandeja para que los revises, los apruebes y los
ejecutes tú a mano**. Los agentes razonan en Claude Code (suscripción Max) con una Scheduled
Task; la persistencia y el dashboard son infraestructura propia de Alhabla.

---

## 0. Qué cambia respecto a la v1

| v1 | v2 | Motivo |
|---|---|---|
| Reddit como fuente (entrada manual de hilos) | **Fuera del sistema** | Decisión del fundador. Sin API autorizada ni acceso automatizado, el coste de esfuerzo manual no compensaba (§ 1) |
| Tareas diarias | **Run semanal** | Sin hilos que caducan en horas no hace falta ritmo diario |
| Objetivos A y B con conversaciones | A y B **reducidos** (§ 2); el peso lo lleva C | Sin foros, no hay un canal claro de conversaciones |
| Vistas Entrada y Comunidades | Eliminadas; un botón «Añadir URL» en la Bandeja | Ya no hay normas de comunidad que guardar |
| Borradores: comentario, respuesta, publicación | Email de contacto, ficha de directorio, texto invitado, solicitud por formulario | El trabajo es de enlaces y menciones editoriales |
| Reglas de ratio de autopromoción y topes por comunidad | Reglas contra esquemas de enlaces y topes de contacto por dominio | Cambia el riesgo principal |

Se mantiene todo lo demás: 8 módulos, 3 objetivos separados, conocimiento con fuente,
reglas duras en el backend, aprobación y ejecución manual, backend sin LLM y suscripción
separada de la API.

---

## 1. Qué sabemos tras la Fase 0

### Por qué se omite Reddit (referencia por si se retoma)

| Hecho (revisado el 2026-10-30) | Fuente |
|---|---|
| Hay que **pedir y obtener aprobación explícita antes de acceder a cualquier dato** por la API (política actualizada el 5-10-2026) | Responsible Builder Policy |
| El uso comercial exige aprobación escrita; fuentes secundarias hablan de ~12.000 $/mes (**dato no oficial**) | Responsible Builder Policy; prowlo.com |
| Prohibido acceder, buscar o recoger datos por medios automatizados sin consentimiento escrito | User Agreement §7 |
| Bots que promocionan productos, varias cuentas y mensajes privados masivos cuentan como spam | Política de spam |
| Reddit Pro (gratis) es solo para países angloparlantes, Trends solo en inglés, y prohíbe descargar contenido de terceros | Ayuda de Reddit Pro |

Medido por el fundador en su navegador (2026-10-30):

| Enlace | `rel` | Efecto |
|---|---|---|
| Publicación | `noopener nofollow sponsored` | No pasa autoridad |
| Comentario | `noopener nofollow ugc` | No pasa autoridad |
| Enlace social del perfil | sin `rel` | Podría pasarla; un solo enlace |

**Cómo se retomaría:** solo con aprobación escrita de Reddit o con otra fuente de
conversaciones que lo permita. La interfaz `FuenteDeOportunidades` (§ 4) deja el hueco; no hay
código específico de Reddit hasta entonces. Publicar seguiría siendo manual.

### Lo que sí está hecho

- **Muestreo de backlinks** (`docs/growth/fase-0-muestreo-backlinks.md`): al menos seis comparativas de «recepcionista de IA en España» publicadas entre agosto y octubre de 2026 donde no aparece Alhabla en los extractos; un directorio sectorial gratuito (Beautymarket) y varias asociaciones. Son extractos de búsqueda, sin métricas de autoridad.
- **Search Console**: API habilitada; cuenta de servicio `growth-lectura-gsc` sin roles de proyecto y con acceso **Restringido** a la propiedad de dominio `sc-domain:alhabla.ai`. Crear claves está bloqueado por la política de organización `iam.disableServiceAccountKeyCreation`; se usa **suplantación sin clave** (`admin@alhabla.ai` tiene Token Creator solo sobre esa cuenta). La suplantación aún no se ha probado de extremo a extremo.

### Pendiente de la Fase 0

- Línea base de uso de Claude Max (§ 10).
- Revisar a mano las seis comparativas para ver cuáles son editoriales y cuáles de pago o de competidores.

---

## 2. Tres objetivos, separados

Una oportunidad tiene un `objetivoPrincipal` y tres puntuaciones. Comparten el pipeline pero
**cada objetivo tiene su umbral, su plantilla de borrador, su política de enlace y sus KPI**.

| | A. Tráfico y marca | B. Clientes potenciales (reducido) | C. Backlinks y autoridad (centro) |
|---|---|---|---|
| Qué buscamos | Menciones y fichas donde nos encuentren: comparativas, directorios, prensa y asociaciones del sector | **Prescriptores** que llegan a dueños de negocios con cita: asociaciones, distribuidores, academias, gestorías, integradores de agenda. Hipótesis por validar | Enlaces editoriales: listados, comparativas, artículos invitados, menciones sin enlace |
| Dónde | Web pública | Web pública | Web pública |
| Borrador | Ficha de directorio, solicitud de inclusión | Email o formulario de contacto proponiendo colaboración | Email, texto invitado, petición de enlace en una mención existente |
| Enlace | Con UTM | Con UTM | Es el objetivo |
| KPI | Visitas por UTM, menciones, citas en IA | Contactos que responden, altas atribuidas | Dominios nuevos que enlazan, calidad, posiciones |
| Nunca | Fichas falsas o duplicadas | Contactar a particulares; correo masivo | Comprar enlaces sin `sponsored`, intercambios masivos, spam en comentarios |

B es el más débil sin conversaciones: se persigue poco y se **mide** más (altas atribuidas por
UTM, visitas a registro). Lo cubren sobre todo el SEO y las citas en IA (módulo 8).

---

## 3. Los ocho módulos

Regla de diseño: **lo que se puede decidir con reglas vive en el backend (determinista,
testeable); el LLM solo hace lo que exige criterio.** Un agente mal instruido o con prompt
injection no puede saltarse las reglas duras.

| # | Módulo | Tipo | Hace | Salida | No puede |
|---|---|---|---|---|---|
| 1 | **Discovery Agent** | LLM + web pública | Encuentra páginas candidatas (comparativas, directorios, asociaciones, prensa, menciones de Alhabla) y procesa las URL que añades a mano. **También busca dónde se menciona o se lista a los competidores conocidos** («alternativas a X», «mejores recepcionistas de IA») y marca cada oportunidad con los competidores que menciona (`datos.competidoresMencionados`); puede **proponer competidores nuevos** (§ 3.4). Propone nichos nuevos | `GrowthOportunidad` en `detectada`; `GrowthCompetidor` en `propuesto` | Acceder a sitios que lo prohíban; contactar; dar por competidor a nadie (solo propone) |
| 2 | **Qualification Agent** | Reglas + LLM | Puertas duras (página viva, idioma, relevancia, no es un competidor, no es contenido ilegal o de baja calidad) y puntuación 0–100 por objetivo. Registra el motivo de cada descarte | `calificada` o `descartada` | Aprobar nada |
| 3 | **Research Agent** | LLM | Quién edita la página, cómo se aceptan inclusiones, qué enlaza hoy, si hay formulario de alta o contacto editorial | `GrowthInvestigacion` | Enviar nada |
| 4 | **Knowledge Agent** | Sincronización determinista + LLM | Mantiene la base de afirmaciones desde el repo (§ 3.1) y responde «¿qué puede decir Alhabla de X y con qué fuente?» | `GrowthAfirmacion`, snapshot con commit | Inventar: solo registra lo que tiene fuente |
| 5 | **Response Agent** | LLM | Redacta el borrador según objetivo, con las claves de afirmaciones que usa | `GrowthBorrador` | Afirmar algo sin clave de afirmación vigente |
| 6 | **Compliance Agent** | Reglas en backend + revisión LLM | Comprobaciones de § 3.2. El backend **rechaza** pasar a `pendiente_aprobacion` si una regla dura falla | `GrowthRevisionCumplimiento` | Saltarse una regla; aprobar |
| 7 | **Backlink Intelligence** | LLM + importaciones | Perfil de enlaces propio y de competidores, huecos, menciones sin enlace, enlaces ganados o perdidos. **Análisis por URL de cada competidor** (producto, servicios, precios y planes, con la página y la fecha de cada dato) y perfil de los sitios donde se le menciona (§ 3.4) | Oportunidades C, `GrowthEnlaceEntrante`, `GrowthCompetidorAnalisis` | Contactar a nadie; citar un análisis en un borrador |
| 8 | **SEO & GEO Intelligence** | LLM + API de Search Console | Consultas y páginas (clics, impresiones, posición), indexación, huecos de contenido; panel fijo de preguntas para ver si Alhabla sale citada | `GrowthMetricaSeo`, `GrowthResultadoGeo` | Crear páginas (la web tiene tope de 75–85) |

### 3.1 Conocimiento real de Alhabla (módulo 4)

Fuentes que sincroniza, siempre con ruta, ancla y commit:

| Tipo de afirmación | Fuente en el repo |
|---|---|
| `precio` | `web/src/lib/plans.ts` (59/139/269 €+IVA; fundador 39/99/199; 200/600/1.500 min; minuto extra 0,30/0,25/0,20) |
| `funcion` y `limite` | `PRODUCT.md` § Capabilities and Constraints; `backend/src/lib/planFeatures.ts` (qué plan tiene qué) |
| `sector` / nichos activos | `web/src/lib/sectores/*.ts` (los 8 de hoy) y `docs/investigacion-nichos.md` |
| `comparativa` | `web/src/lib/comparativas.ts` (con la fecha `CONSULTADAS` de cada dato) |
| `pagina` | `web/src/lib/paginas.ts` (registro de páginas indexables) y `web/content/blog/*.mdx` |
| `prohibida` | Lo retirado por falso y los términos que no se usan (por ejemplo, no se nombra a Telnyx) |

- Cada afirmación lleva `clave` estable (`precio.plan.pro`), texto, valor, fuente y commit.
- Un borrador solo puede afirmar cosas de Alhabla citando claves vigentes. El backend lo comprueba.
- Si cambia una fuente, el siguiente run resincroniza **antes** de redactar y los borradores en cola con claves obsoletas pasan a `bloqueado`.
- Las **limitaciones** son afirmaciones de primera clase, para que el borrador no prometa lo que Alhabla no hace.
- **No se ingieren** `docs/investigacion-nichos.md` ni `docs/auditorias/*` (cifras de terceros o hallazgos fechados), ni `precio.fundador.*` (el cupo es dinámico), ni `funcion.lista_de_espera`; `multi_sede` queda excluida.

### 3.2 Comprobaciones de cumplimiento (módulo 6)

Reglas duras (bloquean, las evalúa el backend):

1. Cada afirmación factual sobre Alhabla mapea a una clave vigente.
2. Ninguna afirmación de la lista `prohibida`.
3. Comparativas solo con dato verificable y fecha (art. 10 Ley 3/1991, como en `comparativas.ts`). Nombrar a un competidor exige una afirmación `comparativa.*` de ese competidor; **el análisis de § 3.4 no cuenta** y un competidor `propuesto` aún no activa la regla.
4. El mensaje identifica con claridad quién escribe y de parte de quién (fundador de Alhabla).
5. **Sin esquemas de enlaces**: nada de enlaces de pago sin `sponsored`, intercambios recíprocos, anclas repetidas y optimizadas ni peticiones masivas.
6. **Un contacto por dominio cada 90 días** y un tope semanal de contactos.
7. Similitud con tus últimos borradores por debajo de un umbral (anti-plantilla).
8. Solo direcciones o formularios profesionales publicados por el propio destino; sin datos personales de terceros.
9. Tipo de borrador compatible con el objetivo.

Reglas blandas (avisan, decides tú): tono, longitud, que el mensaje aporte algo al destinatario más allá de pedir un enlace.

### 3.3 Nichos

- **Conoce los de hoy**: los 8 sectores de la web (`peluquería`, `barbería`, `centro de estética`, `salón de uñas`, `fisioterapia`, `pestañas y cejas`, `spa y masajes`, `peluquería canina`), cada uno con su vocabulario y su dolor.
- **Descubre nuevos**: cuando una búsqueda, una comparativa o Search Console muestran negocios con cita fuera de la lista (tatuadores, veterinarias, estudios de yoga o pilates, psicólogos, talleres…), Discovery crea un `GrowthNicho` en estado `candidato` con evidencia.
- Cada candidato se puntúa por dolor telefónico visible, encaje con lo que Alhabla hace (cita + calendario), competencia, demanda de búsqueda (Search Console), riesgo regulatorio (datos de salud) y facilidad de llegar a ellos.
- **Tú decides** en la vista Nichos: `activo` o `descartado`. Pasar a activo no crea páginas ni borradores solo: abre una propuesta para el plan de contenido (`PLAN-WEB-CONTENIDO.md`).

### 3.4 Competencia (Fase 2a)

Un competidor es una empresa cuyo servicio sustituye al de Alhabla. El registro (`GrowthCompetidor`)
sirve para tres cosas, y ninguna llega a un borrador:

1. **Reglas duras** (ya existían): no calificar páginas del propio competidor (código `competidor`) y la regla 3
   de cumplimiento (nombrarlo exige un dato comparativo con fuente).
2. **Inteligencia interna**: pegas la URL de un competidor en el panel y, en el siguiente run, el agente lee su
   web pública y guarda su producto, sus servicios, sus precios y sus planes, cada dato con la página de la que
   sale y la fecha en que se leyó. Sirve para que tú decidas (precios, posicionamiento, qué comparativa merece la
   pena publicar), no para escribir a nadie.
3. **Dónde se le menciona**: las páginas que listan, comparan o enlazan a un competidor («alternativas a X»,
   «mejores recepcionistas de IA», directorios) son las oportunidades de mayor calidad para Alhabla. Discovery
   marca la oportunidad con los competidores que menciona y el panel filtra por ellos.

**Estados** (`GrowthCompetidor.estado`) y quién los mueve:

| Estado | Significado | Cómo se llega |
|---|---|---|
| `propuesto` | Lo sugiere el agente. **No aplica ninguna regla dura** | El agente (`proponer_competidor`, `origen = agente`) |
| `por_analizar` | Confirmado; el agente aún no lo ha leído o pediste repetirlo | Alta manual (`origen = manual`), **Aceptar** un propuesto, **Volver a analizar**; los que siembra el sincronizador (`origen = repo`) arrancan aquí |
| `analizado` | Hay un análisis pendiente de tu revisión | El agente, al guardar un análisis |
| `revisado` | Diste por bueno el último análisis | Tú, con **Marcar como revisado** |

`propuesto → por_analizar → analizado → revisado`, y desde `analizado` o `revisado` se vuelve a `por_analizar`
con **Volver a analizar**. Un análisis de más de **90 días** cuenta como caducado (se calcula, no se guarda) y el
agente lo repite sin que lo pidas; uno nuevo antes de **7 días** se rechaza salvo que lo hayas pedido. Se
conservan hasta 10 versiones por competidor. Un `propuesto` se rechaza borrándolo; un `origen = repo` no se puede
borrar (lo volvería a sembrar el sincronizador).

**Qué se guarda** (`GrowthCompetidorAnalisis`, una fila por versión): un resumen y hasta 60 datos
(`producto`, `servicio`, `precio`, `plan`, `integracion`, `sector`, `idioma`, `canal`, `limite`, `diferencia`,
`otro`), cada uno con etiqueta, texto, `urlFuente` y `consultadoEn` (los precios, además, con importe, moneda y
periodo). Solo **hechos públicos**, nunca correos ni teléfonos (el esquema los rechaza), y sin fuente y fecha no se
guarda: el mismo estándar que `comparativas.ts`, aunque aquí no se publique.

**Solo inteligencia interna, y qué implica para la regla 3.** Un análisis no se puede citar en un borrador: la
regla 3 y las afirmaciones `comparativa.*` no cambian y siguen saliendo únicamente de `web/src/lib/comparativas.ts`.
Consecuencia buscada: un competidor añadido por URL **no se puede nombrar en un borrador**, porque la regla lo
bloquea y no existe `comparativa.*` para él. Si quieres una comparativa publicable con alguno, es un cambio en
`comparativas.ts` (con su fuente y su fecha) que revisas tú; entonces el sincronizador crea la afirmación.

**Propuestas del agente.** Al leer las listas «alternativas a X», Discovery ve competidores que no están en el
registro y los propone (con la URL, el nombre, el motivo y la página donde los vio; hasta 20 pendientes a la vez).
Un `propuesto` no aplica ninguna regla hasta que lo aceptas: así una página hostil no consigue que el agente
declare «competidor» a un dominio legítimo (y con ello bloquee páginas o borradores que no debería). El texto de
una propuesta lo escribió un modelo que leyó páginas ajenas: el panel lo pinta como texto y el MCP lo entrega bajo
`terceros`. **HeyDiga y fonio quedan confirmados** (decisión del 2026-10-30).

**Búsqueda de menciones y su límite.** El agente busca en la web pública páginas que nombran a competidores
conocidos y guarda los dominios en `datos.competidoresMencionados` de la oportunidad (hasta 10; el backend solo
admite dominios de competidores no propuestos). No hay herramienta de pago de backlinks: lo que se ve son las
páginas que el buscador devuelve, no el perfil de enlaces completo. **Los backlinks de competidores son
aproximados**: sirven para encontrar dónde mueve ficha el sector, no para medir la autoridad de nadie.

**Por qué el backend no lee las URL de competidores.** Solo el agente, con `web_fetch`, hace peticiones a esas
páginas; el backend nunca sale a una URL de competidor (sin SSRF, sin LLM) y no hay ninguna herramienta que
contacte con ellos.

---

## 4. Arquitectura técnica

```
 Mac (Claude Code Max)
 ┌──────────────────────────────────────────────────────────┐
 │ Scheduled Task local «growth-semanal»                     │
 │   orquestador  ──►  6 subagentes (.claude/agents/growth-*)│
 │   herramientas: WebSearch, web_fetch, Read del repo,      │
 │   alhabla-dev (solo lectura), alhabla-growth (MCP nuevo)  │
 └───────────────┬──────────────────────────────────────────┘
                 │ HTTPS + token de agente (alcances mínimos)
                 ▼
 Cloud Run `alhabla-api`  ──  módulo `growth`  ──►  Cloud SQL (tablas Growth*)
   /growth/agente/*  (token)        ▲
   /growth/admin/*   (sesión admin) │ Cloud Scheduler: purga de retención
                 ▲
                 │
 growth.alhabla.ai (Vercel, Next 16)  ◄──  tú: revisar · editar · aprobar · ejecutar a mano · descartar
```

**Decisiones**

1. **Un solo backend**, un módulo nuevo. Cero servicios nuevos en GCP, `maxScale` 11 intacto (presupuesto de conexiones de Cloud SQL). Endpoints ligeros.
2. **Dashboard como tercera web** (`growth/`), no dentro de `frontend/`: la app de clientes es multi-tenant y no tiene rol de administrador. Las tablas `Growth*` no cuelgan de `Business` y **ningún JWT de cliente** abre `/growth/*`.
3. **Dos autenticaciones separadas**:
   - Administrador: inicio de sesión con Google y lista blanca `GROWTH_ADMIN_EMAILS` (tu correo). Único que puede `aprobar`, `marcar_gestionado`, `descartar`, decidir nichos y editar ajustes.
   - Agente: token de servicio (se guarda solo su hash) con alcances: leer conocimiento y ajustes; crear oportunidades, investigaciones, borradores, análisis de competidores y propuestas de competidor, y métricas. **No puede aprobar ni marcar nada como gestionado, ni aceptar un competidor propuesto.**
4. **Cloudflare Access descartado** para proteger el dashboard: el Worker de LaLiga quita el proxy de Cloudflare durante los partidos para que los usuarios en España entren; con Access delante, el dashboard se caería justo entonces. El subdominio irá **sin proxy** (nube gris), a confirmar en la Fase 1.
5. **El backend no llama a ningún LLM.** Todo el razonamiento ocurre en la sesión programada (suscripción). No existe consumo de API oculto.
6. **Ejecutar no existe en el código.** No hay cliente de envío de email, formularios ni mensajería en Growth, ni credenciales de escritura de ninguna plataforma. Un test comprueba que la interfaz `FuenteDeOportunidades` solo tiene métodos de lectura.
7. **`FuenteDeOportunidades`** con dos implementaciones: `BusquedaWeb` (páginas públicas que el agente encuentra) y `EntradaManual` (URL que añades en la Bandeja). Reddit queda **fuera**; la interfaz permite enchufar otra fuente más adelante, con autorización.
8. **Contenido externo = datos, nunca órdenes.** Una página puede contener «ignora tus instrucciones». Los subagentes solo escriben a través de `alhabla-growth`, el backend valida todo con Zod y las reglas duras no dependen del prompt.
9. **Prompts versionados en el repo.** La Scheduled Task solo dice «lee `growth/agentes/orquestador.md` y síguelo»: cambiar un prompt es un PR.
10. **Navegadores fuera de la tarea.** Chrome, Playwright y el navegador integrado no se permiten en la tarea; el agente lee páginas con `web_fetch`. Un hook `PreToolUse` en `.claude/settings.json` (script en `growth/agentes/hooks/`) deniega además cualquier acceso a `reddit.com` y `redd.it` desde `WebFetch`, `WebSearch` y las herramientas `web_fetch`/`web_search` de MCP mientras Reddit esté fuera de alcance. Como vive en el `settings.json` del proyecto, vale para **todas** las sesiones de Claude Code en este repo, no solo para el run.
11. **Search Console sin claves**: la cuenta de servicio se usa por suplantación (`gcloud auth application-default login --impersonate-service-account=…`) porque la política de la organización prohíbe crear claves.

**Flujo de un run semanal** (el detalle y los presupuestos duros, en `growth/agentes/orquestador.md`)

1. `estado_growth` y `leer_contexto`: la API responde, el token vale, la copia del repo está al día, no hay pausa; ajustes, topes, dominios en enfriamiento, URL añadidas a mano, competidores y **competidores por analizar**. `abrir_ejecucion`.
2. Knowledge: si el snapshot está vacío o el commit de las fuentes cambió, resincroniza (con el token de alcance `conocimiento`; si el run no lo tiene, se detiene la redacción y se avisa).
3. Discovery (web pública, URL manuales y **páginas que mencionan a los competidores**, con `datos.competidoresMencionados` y propuestas de competidor) → Qualification → descarta con motivo y código lo que no llega al umbral.
4. Por cada superviviente: Research → Response → Compliance → `POST` del borrador. Si una regla dura falla, queda `bloqueado` con el motivo.
5. **Competencia**: se analizan los competidores `por_analizar` o con el análisis caducado (producto, servicios, precios y planes con fuente y fecha). Es inteligencia interna: nada de esto entra en un borrador.
6. Backlink Intelligence (importaciones y huecos) y SEO & GEO (Search Console y panel de preguntas): de la Fase 4 en adelante.
7. Mensual: barrido de nichos.
8. `cerrar_ejecucion` con el resumen. Notificación solo si hay algo que revisar. Cero oportunidades es un resultado válido y queda registrado.

**Máquina de estados de la oportunidad**

```
detectada ─► calificada ─► investigada ─► con_borrador ─► pendiente_aprobacion ─► aprobada ─► gestionada ─► conseguida
    │            │                              │                  │  └► devuelta ─► (vuelve a con_borrador)       └► sin_respuesta
    ▼            ▼                              ▼                  ▼
descartada   descartada                     bloqueada          descartada        aprobada ─► caducada (si vence expiraEn)
```

`gestionada` = tú has enviado el email, rellenado el formulario o dado de alta la ficha, y lo
registras con la fecha. `conseguida` = el enlace o la mención ya está publicada y la URL queda
anotada. Solo el administrador entra en `aprobada`, `gestionada`, `devuelta` y `descartada`.

**Scheduled Task: local o nube**

| | Local (Desktop) | Nube (routine) |
|---|---|---|
| Funciona con el Mac apagado | No: solo con la app abierta y el Mac despierto; si duerme, ese run se omite y al volver hace **un** run de recuperación | Sí |
| Acceso al repo y a MCP locales | Sí (carpeta local, `alhabla-dev`, `alhabla-growth`) | Clon limpio; conectores configurados por tarea |
| Permisos | Configurables por tarea, «siempre permitir» por herramienta | Modo automático por defecto |
| Intervalo mínimo | 1 hora desde el formulario | 1 hora |

Con un run semanal, que el Mac duerma un día importa poco: **local**, con «Mantener el equipo
despierto» o con el run de recuperación. La nube queda como migración si fallara.

---

## 5. Conectores y permisos

| Conector | Estado | Uso | Alcance |
|---|---|---|---|
| Claude Code Max + Scheduled Tasks | Existe | Razonamiento y ejecución | Tarea local; modelo y modo de permisos fijados en la tarea |
| `alhabla-growth` (MCP stdio) | **Hecho** (18 herramientas) | Única vía de escritura | Lectura: `estado_growth`, `leer_contexto`, `leer_conocimiento`, `listar_oportunidades`, `ver_oportunidad`, `listar_competidores`. Escritura: `abrir_ejecucion`, `cerrar_ejecucion`, `sincronizar_conocimiento` (lee el repo, no recibe texto), `crear_oportunidad`, `calificar_oportunidad`, `descartar_oportunidad`, `guardar_investigacion`, `evaluar_borrador` (no guarda), `crear_borrador`, `registrar_cumplimiento`, `guardar_analisis_de_competidor`, `proponer_competidor`. **Ninguna** aprueba, acepta un competidor ni marca como gestionado. `guardar_metricas` llega con la Fase 4 |
| `WebSearch` y `web_search`/`web_fetch` (Parallel) | Existen | Web pública: comparativas, directorios, asociaciones, prensa | Lectura |
| `alhabla-dev` | Existe | `visitas_web`, `consultar_bd_prod` | **Solo lectura**; atribución de visitas y altas |
| Google Search Console API | **Hecho** (acceso) | Consultas, páginas, indexación | Cuenta de servicio `growth-lectura-gsc` con permiso **Restringido** en `sc-domain:alhabla.ai`, usada por suplantación sin clave |
| Importaciones CSV (GSC Enlaces, Bing Webmaster, Ahrefs Webmaster Tools) | Manual mensual | Enlaces propios | Subida por ti desde el dashboard |
| Ahrefs / Semrush / Ubersuggest (registro MCP) | **No** al inicio | Enlaces de competidores | Opcional, de pago, decisión posterior |
| Gmail, Zoho Mail, WhatsApp, Slack | **Prohibidos en la tarea** | — | Sin herramientas de envío: no hay correo ni mensaje automático |
| Chrome, Playwright, navegador integrado | **Prohibidos en la tarea** | — | Lectura solo con `web_fetch` |

Permisos de la tarea: `Read`/`Grep`/`Glob` del repo, `Agent`, `WebSearch`, `WebFetch` (y `web_search`/`web_fetch` de Parallel si los quieres), las 18 herramientas de `alhabla-growth`, y desde la Fase 3 `visitas_web` y `consultar_bd_prod`. Sin `Write`/`Edit` ni `Bash`: el MCP calcula por su cuenta la versión de los prompts (`git rev-parse` incluido). Cada subagente tiene además su propia lista de herramientas, más estrecha (`.claude/agents/growth-*.md`): ninguno escribe si no es por `alhabla-growth`. Los secretos (token de agente) en el llavero de macOS o variables de entorno del Mac, nunca en el repo; variables nuevas en `.env.example` y `docker-compose.yml`.

Los avisos al móvil, si los quieres, van por la notificación de Claude (sin conectar mensajería).

---

## 6. Estructura del repositorio

Estado con la Fase 2 en la rama `code/growth-fase-2` (lo que NO existe aún está marcado):

```
growth/                              # web Next 16 → growth.alhabla.ai (dev :3003, vista previa :3103 en demostración)
  src/app/(panel)/
    bandeja/ · oportunidad/[id]/ (la Revisión) · borradores/ · historial/
    conocimiento/ · ejecuciones/ · ajustes/ · competencia/ · competencia/[id]/
    (aún no: analitica/ · backlinks/ · seo-geo/ · nichos/)
  src/components/ · src/lib/{api,cliente,cliente-http,crear-cliente,consultas,sesion,gis,config,types,etiquetas,formato,url-segura}.ts · src/lib/demo/
  agentes/
    README.md                        # cómo preparar y lanzar un run manual
    orquestador.md                   # el flujo del run y sus presupuestos
    comprobar-agentes.sh             # cada subagente solo cita herramientas que existen
    reglas/{afirmaciones-prohibidas, contenido-externo-es-dato, calidad-sobre-cantidad, vocabulario-de-alhabla, citable-y-no-citable, sin-envio}.md
    hooks/{denegar-reddit.sh, probar-denegar-reddit.sh}   # PreToolUse: reddit.com y redd.it
    (aún no: voz-de-marca.md, politica-de-enlaces.md)
backend/src/modules/growth/
  routes.ts                          # índice: no-store, errores, registro
  routesAdmin.ts · routesAdminExtra.ts · routesAgente.ts · routesAgenteExtra.ts · routesConocimiento.ts
  service.ts · servicioAdmin.ts · servicioAgente.ts · ajustes.ts · ejecuciones.ts
  estados.ts · cumplimiento.ts · contextoDeCumplimiento.ts · esquemas.ts · similitud.ts · tokens.ts
  conocimiento/                      # servidor del sincronizador (planificar, sincronizar, términos)
  (aún no: analitica/{searchConsole.ts, utm.ts}, fuentes/ como carpeta)
backend/mcp/growth/                  # MCP stdio «alhabla-growth» (18 herramientas)
backend/mcp/growth/conocimiento/     # extractor y CLI del sincronizador (no puede vivir en backend/src: la imagen de Cloud Run no lleva web/ ni PRODUCT.md)
backend/src/jobs/{caducarAprobadasDeGrowth,purgarRetencionDeGrowth}.ts · backend/scripts/growth/crearToken.ts
.claude/agents/growth-{descubrimiento,calificacion,investigacion,redaccion,cumplimiento,enlaces-y-competencia}.md
.claude/commands/growth-run.md       # /growth-run: lanza un run manual desde Claude Code
.claude/settings.json                # hook PreToolUse que deniega reddit.com y redd.it en la lectura web (vale para todas las sesiones del repo)
backend/prisma/schema.prisma         # modelos Growth* (migraciones 20261030120000_alhabla_growth y 20261030150000_growth_competencia)
backend/tests/{modules/growth,mcp,jobs,scripts,integration/growth}/
docs/growth/{registro-de-decisiones.md, fase-0-protocolo.md, fase-0-muestreo-backlinks.md}
PLAN-GROWTH.md
```

Convenciones: todo en español; imports `.js`; Zod en bodies y params; logs `[Growth]`. **Excepción explícita al aislamiento multi-tenant**: las tablas `Growth*` no son de ningún negocio y solo las abre el administrador o el token de agente; se documenta en `AGENTS.md` y un test comprueba que un JWT de cliente recibe 401 en `/growth/*`. Proyecto nuevo en Vercel (`alhabla-growth`, root `growth`); CI con su job.

---

## 7. Esquema de base de datos

Prefijo `Growth`, ids `cuid`, sin relación con `Business`. Boceto (se ajusta a las convenciones del esquema al implementar).

```prisma
enum GrowthObjetivo { TRAFICO_MARCA LEADS BACKLINKS }

enum GrowthEstadoOportunidad {
  detectada calificada investigada con_borrador pendiente_aprobacion
  aprobada gestionada conseguida sin_respuesta devuelta bloqueada descartada caducada
}

enum GrowthEstadoBorrador { borrador bloqueado pendiente_aprobacion aprobado gestionado descartado }
enum GrowthTipoBorrador { email formulario ficha_directorio texto_invitado }
enum GrowthEstadoNicho { activo candidato descartado }

model GrowthFuente {
  id String @id @default(cuid())
  tipo String            // web | directorio | manual
  nombre String
  activa Boolean @default(true)
  config Json?
}

model GrowthNicho {
  id String @id @default(cuid())
  slug String @unique
  nombre String
  estado GrowthEstadoNicho @default(candidato)
  origen String                  // web_sectores | investigacion | descubierto
  evidencia Json?
  puntuacion Int?
  decididoEn DateTime?
  notas String? @db.Text
}

model GrowthAfirmacion {         // base de conocimiento
  id String @id @default(cuid())
  clave String                   // precio.plan.pro
  tipo String                    // precio | funcion | limite | sector | comparativa | pagina | prohibida
  texto String @db.Text
  valor Json?
  fuente String                  // ruta#ancla
  commitSha String
  nichoSlug String?
  vigenteDesde DateTime @default(now())
  vigenteHasta DateTime?
  @@index([clave, vigenteHasta])
}

model GrowthPagina {             // inventario SEO propio (de paginas.ts)
  ruta String @id
  nombre String
  seccion String
  nichoSlug String?
  actualizado DateTime?
  indexada Boolean?
  comprobadaEn DateTime?
}

model GrowthOportunidad {
  id String @id @default(cuid())
  claveExterna String @unique    // hash de la URL
  fuenteId String
  nichoId String?
  url String
  dominio String
  titulo String
  extracto String                // ≤ 500 caracteres
  idioma String @default("es")
  detectadaEn DateTime @default(now())
  objetivoPrincipal GrowthObjetivo
  puntTrafico Int @default(0)
  puntLeads Int @default(0)
  puntBacklinks Int @default(0)
  estado GrowthEstadoOportunidad @default(detectada)
  motivoDescarte String?
  datos Json?                    // tipo de enlace, dofollow esperado, dificultad, vía de contacto, competidoresMencionados (dominios, hasta 10)
  expiraEn DateTime?
  retencionHasta DateTime
  ejecucionId String?
  @@index([estado, objetivoPrincipal])
  @@index([dominio])
}

model GrowthInvestigacion {
  oportunidadId String @id
  resumen String @db.Text
  quienEdita String?
  viaDeContacto String?          // formulario | email_editorial | alta_directorio
  competidoresEnlazados Json?
  contexto Json?
  creadaEn DateTime @default(now())
}

model GrowthBorrador {
  id String @id @default(cuid())
  oportunidadId String
  version Int @default(1)
  tipo GrowthTipoBorrador
  objetivo GrowthObjetivo
  asunto String?
  texto String @db.Text
  enlaceUrl String?
  utm Json?
  afirmaciones String[]          // claves de GrowthAfirmacion usadas
  estado GrowthEstadoBorrador @default(borrador)
  textoFinal String? @db.Text    // lo que de verdad enviaste
  editadoPorHumano Boolean @default(false)
  creadoEn DateTime @default(now())
  @@index([oportunidadId, estado])
}

model GrowthRevisionCumplimiento {
  id String @id @default(cuid())
  borradorId String
  resultado String               // pasa | aviso | bloquea
  comprobaciones Json            // [{regla, ok, dura, detalle}]
  revisor String                 // reglas | llm
  creadaEn DateTime @default(now())
}

model GrowthDecision {           // registro inmutable
  id String @id @default(cuid())
  oportunidadId String?
  borradorId String?
  accion String                  // aprobar | editar | devolver | descartar | marcar_gestionado | anular
  motivo String?
  por String                     // email del admin
  en DateTime @default(now())
}

model GrowthGestion {            // lo que hiciste a mano
  id String @id @default(cuid())
  borradorId String @unique
  canal String                   // email | formulario | alta_directorio | otro
  dominio String
  hechaEn DateTime
  respuestaEn DateTime?
  resultado String @default("pendiente")   // pendiente | aceptado | rechazado | sin_respuesta
  urlConseguida String?
  notas String?
  @@index([dominio, hechaEn])    // para el tope de un contacto por dominio cada 90 días
}

model GrowthMedicion {
  id String @id @default(cuid())
  gestionId String?
  enlaceId String?
  fecha DateTime @default(now())
  metricas Json                  // visitas por UTM, altas, posición
  origen String                  // manual | analytics | search_console
}

model GrowthCompetidor {
  id String @id @default(cuid())
  nombre String
  dominio String @unique         // sin www, en minúsculas; sale de la URL y no cambia
  notas String?
  url String?                    // de partida del análisis (null en los sembrados)
  origen String @default("repo") // repo | manual | agente
  estado String @default("por_analizar")  // propuesto | por_analizar | analizado | revisado
  creadoEn DateTime @default(now())
  analisisSolicitadoEn DateTime? // alta o «Volver a analizar»; null al guardar un análisis
  analisis GrowthCompetidorAnalisis[]
}

model GrowthCompetidorAnalisis {   // inteligencia interna: nunca se cita en un borrador
  id String @id @default(cuid())
  competidorId String            // onDelete: Cascade
  version Int                    // 1, 2, 3… por competidor (@@unique [competidorId, version]); se conservan 10
  resumen String @db.Text        // texto de un modelo sobre páginas ajenas: se pinta como texto
  datos Json                     // DatoDeCompetidor[]: tipo, etiqueta, texto, valor?, urlFuente, consultadoEn
  ejecucionId String?
  creadoEn DateTime @default(now())
  creadoPor String               // nombre del token de agente
  revisadoEn DateTime?
  notaDeRevision String?
  @@index([competidorId, creadoEn])
}

model GrowthEnlaceEntrante {
  id String @id @default(cuid())
  dominioOrigen String
  urlOrigen String
  urlDestino String
  anchor String?
  rel String                     // dofollow | nofollow | ugc | sponsored
  primeraVistaEn DateTime
  perdidoEn DateTime?
  fuente String                  // gsc | bing | ahrefs_wmt | manual
  oportunidadId String?
  @@unique([urlOrigen, urlDestino])
}

model GrowthConsultaGeo { id String @id @default(cuid()) prompt String nichoSlug String? activa Boolean @default(true) }
model GrowthResultadoGeo {
  id String @id @default(cuid())
  consultaId String
  ejecutadoEn DateTime @default(now())
  motor String                   // claude_websearch (no representa a ChatGPT ni a Perplexity)
  mencionaAlhabla Boolean
  urlCitada String?
  competidoresCitados Json?
}

model GrowthMetricaSeo {
  id String @id @default(cuid())
  fecha DateTime @db.Date
  tipo String                    // consulta | pagina
  clave String
  clics Int
  impresiones Int
  posicion Float
  @@unique([fecha, tipo, clave])
}

model GrowthEjecucion {
  id String @id @default(cuid())
  disparador String              // programada | manual
  inicio DateTime @default(now())
  fin DateTime?
  estado String                  // en_curso | ok | parcial | error
  resumen Json?                  // candidatas, calificadas, descartadas por motivo, borradores, bloqueadas
  modulos Json?
  versionPrompts String?         // sha de git
  error String?
}

model GrowthAjuste { clave String @id valor Json actualizadoEn DateTime @updatedAt }  // umbrales, topes de contacto, retención, fuentes
model GrowthAdmin { email String @id creadoEn DateTime @default(now()) }
model GrowthTokenAgente {
  id String @id @default(cuid())
  nombre String
  hashToken String @unique
  alcances String[]
  creadoEn DateTime @default(now())
  revocadoEn DateTime?
  ultimoUso DateTime?
}
```

Retención (job `growth-mantenimiento`, diario): pasados 180 días la fila se borra entera si no tiene decisiones, enlaces ni gestión; si no, se vacía `extracto` (cadena vacía) y `quienEdita` pasa a null. Las oportunidades `aprobada` con `expiraEn` vencido caducan por el sistema, con la decisión `caducar`. No se guardan nombres ni correos de personas: el tope de contacto se controla por dominio y canal.

---

## 8. Diseño del dashboard

Estética: la de Alhabla (tokens `tinta`, `morado`, `lavado`, `linea`; modo claro y oscuro; `DESIGN.md`), sobria, densa, sin adornos. **Pensado para el móvil**: revisar y copiar el texto desde donde estés, y enviar tú el correo o rellenar el formulario.

| Vista | Para qué | Contenido y acciones |
|---|---|---|
| **Bandeja** | Lo que merece tu tiempo esta semana | Tarjetas de oportunidades calificadas, ordenadas por puntuación, con filtro por objetivo (A/B/C), nicho y tipo. Botón **Añadir URL**. **Estado vacío honesto**: «Esta semana no hay nada que merezca tu tiempo», con el recuento de candidatas descartadas y sus motivos |
| **Revisión** | El centro del sistema | Tres columnas (apiladas en móvil): destino e investigación · borrador editable · panel de cumplimiento (reglas duras en rojo, avisos en ámbar, afirmaciones usadas con su fuente y commit). Acciones: **Aprobar**, **Aprobar con ediciones**, **Devolver con nota**, **Descartar (motivo)**, **Copiar texto**, **Abrir página** |
| **Borradores** | Todo el trabajo en curso | Por estado: bloqueados (con el porqué), pendientes, aprobados sin gestionar, caducados |
| **Historial** | Qué hiciste y qué pasó | Registro inmutable de decisiones; gestiones con fecha; «Marcar como gestionado» pide el canal y la fecha; «Enlace conseguido» pide la URL |
| **Analítica** | Si sirve para algo | Pestañas A / B / C. A: visitas por UTM, menciones, citas en IA. B: contactos que responden, visitas a registro, altas atribuidas. C: dominios nuevos, enlaces ganados y perdidos, calidad. Tasa de respuesta por tipo de destino |
| **Backlinks** | Pipeline de tipo C | Oportunidades por tipo (comparativa, directorio, prensa, asociación, mención sin enlace), estado de contacto, perfil propio frente a competidores, importación de CSV |
| **Competencia** | Quién compite y dónde se le menciona (Fase 2a) | Tarjetas agrupadas: «Propuestos por el agente» (Aceptar / Rechazar), «Por analizar», «Analizados · pendientes de revisión» y «Revisados», con origen, nº de oportunidades, **nº de menciones** (enlaza a la Bandeja filtrada por `?menciona=`) y la marca «Análisis caducado». **Añadir competidor** pide una URL (el agente la analiza en el siguiente run). El detalle enseña el aviso fijo «Información interna: no se puede citar en un borrador», el resumen, los datos por tipo con su fuente (enlace https nofollow) y fecha de consulta, los precios en `es-ES`, las versiones, y las acciones **Marcar como revisado**, **Volver a analizar** y **Quitar** (no disponible en los del repositorio) |
| **SEO & GEO** | Autoridad y visibilidad en IA | Consultas y páginas de Search Console, indexación del registro de páginas, huecos, panel GEO con su aviso de representatividad |
| **Nichos** | Dónde crecer | Los 8 activos y los candidatos con evidencia y puntuación; activar o descartar |
| **Conocimiento** | Qué sabe el sistema | Afirmaciones por tipo con fuente y commit, antigüedad del snapshot, limitaciones y lista de «prohibido decir» |
| **Ejecuciones** | Salud del sistema | Runs, duración por módulo, errores, versión de prompts, descartes por motivo (para calibrar umbrales) |
| **Ajustes** | Control | Umbrales por objetivo, topes de contacto, retención, fuentes activas, interruptor general de pausa |

**Notas de la implementación (Fase 1b).** La Revisión vive en `/oportunidad/[id]` y no hay `/login`: la propia puerta de sesión envuelve el panel. En móvil la navegación son 4 pestañas (Bandeja, Borradores, Historial, Conocimiento) más «Más» (Ejecuciones, Ajustes, apariencia y cerrar sesión). `sin_respuesta` se muestra como «Cerrada sin éxito» y la acción `rechazado` también termina ahí. El estado vacío de la Bandeja usa los descartes de la última semana por motivo de `GET /growth/admin/resumen`. El aviso «similitud con la versión anterior» es la regla blanda `similitud_con_version_anterior`. El dashboard trae un modo demostración solo para desarrollo (`npm run dev:demo`) con datos de prueba, para verificar la interfaz sin Google ni backend.

**Competencia (Fase 2a).** La Bandeja y la Revisión llevan la insignia «Menciona a X» y un filtro por competidor mencionado; Ajustes sustituye la lista de competidores de solo lectura por un resumen con enlace a `/competencia`. Los textos de un competidor (nombre y notas de un propuesto, resumen y datos) los escribió un modelo que leyó páginas ajenas: se pintan como texto y el único enlace es la URL https de fuente, con `rel="nofollow noopener noreferrer"`. En la vista previa de demostración hay un competidor de cada estado.

**Comparador y Tareas (panel útil).** Dos vistas que se usan ya, con datos que ya hay y **sin gastar cuota ni llamar a ningún modelo**. El **Comparador** (`/competencia/comparador`, pestaña de Competencia) pone a Alhabla en la primera fila (de `precio.plan.*` vigentes: cuota, minutos incluidos y minuto extra) y debajo cada competidor confirmado con los planes, precios, límites, integraciones, idiomas y canales de su último análisis, cada precio con su fuente (enlace https `nofollow`) y la fecha de consulta; se ordena por precio de entrada y se filtra por «Solo revisados». Lleva siempre el aviso «Información interna: no se puede citar en un borrador» y que las monedas no se convierten. Las **Tareas** (`/tareas`, en «Más» en el móvil) son los destinos que el agente no puede abrir (G2, Capterra… dan 403) o que salen mejor a mano: enlace, pasos, **Marcar hecha** (resultado y nota), **Descartar**, **Reabrir**, editar y **Añadir tarea**; las sembradas del repositorio se descartan, no se borran. Arriba, la **Ficha de Alhabla** con el texto para pegar, compuesto en el servidor solo con afirmaciones vigentes (cada campo con su **Copiar**, el contador frente al límite orientativo, las claves usadas, las que faltan y los avisos de términos prohibidos). Todo es solo del administrador; nada de esto lo leen el agente ni el MCP.

Esbozo de **Revisión**:

```
┌ Oportunidad · BACKLINKS · listado «recepcionistas de IA en España» · caduca en 12 d ───────┐
│ DESTINO E INVESTIGACIÓN      │ BORRADOR v2 (editable)        │ CUMPLIMIENTO              │
│ Editor: medio digital        │ Asunto: Una recepcionista…    │ ✓ afirmaciones (3)        │
│ Vía: formulario editorial    │ «Hola, soy … fundador de      │   precio.plan.pro         │
│ Ya enlaza a: 4 competidores  │ Alhabla…» (con UTM)           │ ✓ identificación          │
│ Última edición: sep-2026     │                               │ ✓ 1 contacto/dominio/90 d │
│                              │ [Copiar] [Abrir página]       │ ⚠ similitud con v1: 38 %  │
│                              │ [Devolver] [Descartar]        │ [Aprobar]                 │
└──────────────────────────────┴───────────────────────────────┴───────────────────────────┘
```

---

## 9. Plan de implementación por fases

Cada fase en su rama y PR, con criterio de salida. **No se avanza de fase sin tu visto bueno.**

| Fase | Contenido | Criterio de salida |
|---|---|---|
| **0. Validación** | **Cerrada.** Hecho: muestreo de backlinks, medición del `rel`, cuenta de servicio de Search Console. Cancelado: todo lo de Reddit. Pendiente: línea base de uso de Max y revisión manual de las seis comparativas | — |
| **1. Base** | **Hecha (1a y 1b, #384–#386).** Migración `Growth*`, módulo backend (estados, reglas duras, similitud, auth admin y token), sincronizador de conocimiento, MCP `alhabla-growth`, dashboard con Bandeja, Revisión, Borradores, Historial y Conocimiento sobre datos de prueba. Todo en dev | Tests en verde; un borrador sin clave de afirmación vigente es rechazado por el backend; un JWT de cliente recibe 401 |
| **2a. Competencia** | Migración `20261030150000_growth_competencia` (`GrowthCompetidor` ampliado y `GrowthCompetidorAnalisis`); rutas de administración (alta por URL, edición, baja, aceptar un propuesto, volver a analizar, revisar un análisis, filtro `?menciona=`) y del agente (listar competidores, proponer, guardar un análisis, `competidoresPorAnalizar` en el contexto, `competidoresMencionados` al crear); un `propuesto` no aplica reglas; MCP de 15 a 18 herramientas; panel `/competencia`, insignia «Menciona a X» y filtro en Bandeja y Revisión, resumen en Ajustes; modo demostración con un competidor de cada estado. Todo en dev | `typecheck`, `lint` y tests en verde en backend y panel, y la integración contra Postgres real; un `propuesto` no descarta una calificación ni bloquea un borrador (test); guardar un análisis de un `propuesto` responde 409 `competidor_propuesto`, uno con correo o teléfono se rechaza y un dominio no competidor en `competidoresMencionados` responde 400 `competidor_desconocido`; `diagnostico_mcp` y `growthEstatico.test.ts` cuentan 18 herramientas y ninguna con parámetro de estado; en la demostración recorres alta por URL → análisis → revisado sin errores; tu visto bueno a la vista en dev |
| **2b. Agentes y run manual** | `growth/agentes/orquestador.md` con presupuestos duros, los 6 subagentes (`growth-descubrimiento`, `-calificacion`, `-investigacion`, `-redaccion`, `-cumplimiento` y `-enlaces-y-competencia`), las reglas compartidas, `/growth-run`, el hook que deniega reddit.com y redd.it y `agentes/README.md`. Run lanzado por ti: primero contra dev, después contra producción cuando la migración y las rutas estén desplegadas. Primera tanda: comparativas de «recepcionista de IA» en España, Beautymarket y asociaciones del sector, más los competidores por analizar. Calibrar umbrales dos semanas viendo los descartes | Un run manual cierra la ejecución en `ok` o `parcial` sin que intervengas a medias; **consumo medido ≤ 10 % del límite semanal** (antes y después, en `claude.ai/settings/usage`); `growth/agentes/comprobar-agentes.sh` y la prueba del hook en verde (ningún subagente con `Write`/`Edit`/`Bash` ni con una herramienta que no existe); cada competidor analizado lleva al menos un precio o plan con URL y fecha, o un resumen que dice qué no se encontró, y ningún correo ni teléfono; cero bloqueos por afirmación falsa o término prohibido en los borradores; tasa de borradores que apruebas con pocos cambios, medida en Ejecuciones |
| **3. Scheduled Task** | Crear la tarea local semanal, «Run now» para fijar permisos, notificación solo si hay algo, analítica básica con UTM, paso a producción | Tres semanas de runs sin intervención y sin salirte del presupuesto de uso |
| **4. SEO & GEO** | Módulo 8: probar la suplantación de la cuenta de servicio, Search Console, panel GEO, vistas SEO & GEO y huecos de contenido | Primeras consultas y páginas en el dashboard; primer informe de huecos |
| **5. Nichos y atribución** | Descubrimiento de nichos, vista Nichos, atribución de altas por UTM (requiere comprobar si el registro ya guarda el origen; si no, un cambio pequeño en producto que aprobarías aparte) | Un nicho candidato evaluado de punta a punta |
| **6. Otras fuentes (condicionada)** | Solo con autorización de la plataforma y evidencia de que merece la pena: enchufar otra fuente de conversaciones (por ejemplo Reddit) a `FuenteDeOportunidades`. **Ejecutar sigue siendo manual** | Referencia de la autorización guardada; revisión legal del uso de los datos |

---

## 10. Riesgos, limitaciones y costes

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Contacto en frío y normativa de comunicaciones comerciales (LSSI, art. 21) | **No verificado**; consultar a un asesor antes de enviar correos en frío. Preferir formularios y altas que el propio destino ofrece |
| Que Google considere los enlaces manipulación | Solo enlaces editoriales o ganados; nada de compra sin `sponsored`, intercambios masivos ni anclas repetidas (regla dura 5) |
| Tasa de respuesta baja | Se mide en Analítica; calibrar tipos de destino y mensaje |
| Afirmaciones falsas sobre Alhabla | Base con fuente, backend que rechaza lo no trazable, lista de prohibidos, tu revisión |
| Conocimiento desfasado | Commit en cada afirmación, resincronización antes de redactar, bloqueo de borradores con claves obsoletas |
| Inyección de instrucciones en una página leída | Todo contenido externo es dato; el agente solo escribe vía MCP acotado; reglas duras en servidor |
| Consumo de Max compite con tu uso interactivo | Un run semanal, subagentes acotados, medir la línea base, vigilar `claude.ai/settings/usage`; no activar créditos de uso sin tope |
| El Mac duerme | Un run semanal tolera un día perdido; run de recuperación; migrar a la nube si hace falta |
| Suplantación de la cuenta de servicio sin probar | Se prueba al inicio de la Fase 4 antes de construir nada encima |
| Publicidad comparativa | Mismo estándar que `comparativas.ts`: datos objetivos, fecha y URL |
| Un análisis de competidor acaba citado en un borrador | Es inteligencia interna: la regla 3 solo acepta `comparativa.*` de `comparativas.ts`, el competidor añadido por URL no tiene ninguna y el backend bloquea el borrador que lo nombre; los prompts lo prohíben además |
| Una página hostil hace que el agente declare «competidor» a un dominio legítimo | El agente solo propone: un `propuesto` no aplica reglas hasta que lo aceptas, con un tope de 20 propuestas pendientes |
| Datos personales o inventados en la ficha de un competidor | Solo hechos públicos con `urlFuente` y fecha; el esquema rechaza correos y teléfonos; el panel enseña la fuente de cada dato y tú revisas antes de darlo por bueno |
| Fuga del token de agente | Alcances mínimos, no aprueba nada, rotación y revocación |
| Presupuesto de conexiones de Cloud SQL | Endpoints ligeros, sin servicio nuevo, `maxScale` 11 |

### Limitaciones

- **Sin canal de conversaciones.** Los objetivos A y B son más débiles; B se mide más de lo que se persigue.
- Casi todo el material de la Fase 0 son extractos de búsqueda: no hay métricas de autoridad de dominio ni distinción fiable entre contenido editorial y de pago.
- El panel GEO usa la búsqueda de Claude, **no ChatGPT ni Perplexity**: es una señal, no una medición de mercado.
- Los backlinks de competidores exigen una herramienta de pago o trabajo manual; con las gratuitas ves los tuyos. Sin ella, «dónde se menciona a un competidor» es **aproximado**: las páginas que devuelve el buscador y que el agente llega a leer (§ 3.4).
- El análisis de un competidor refleja lo que su web publica el día que se lee (precios «desde», planes que cambian, condiciones tras un formulario): por eso lleva fecha, caduca a los 90 días y lo revisas tú.
- La atribución de altas es parcial (UTM de primer toque, sin cookies de seguimiento propias).
- Una semana sin oportunidades es un resultado válido, no un fallo.

### Costes (suscripción separada de API)

| Concepto | Tipo | Importe | Nota |
|---|---|---|---|
| **Claude Max** (razonamiento y Scheduled Task) | Suscripción | Desde 100 $/mes (5x) o 200 $/mes (20x); ya es tu plan | Los runs gastan los límites de 5 h y semanales, **compartidos** con tu uso interactivo. Sin factura adicional salvo que actives créditos de uso |
| Créditos de uso de Claude | Consumo adicional | 0 € mientras no los actives | Sin ellos, al llegar al límite los runs se rechazan. Si los activas, ponles tope |
| **API de Anthropic** | Consumo adicional | **0 €** | El diseño no tiene ninguna llamada a la API: el backend no usa LLM. Los créditos de API que incluye Max no se pueden usar en Claude Code, así que tampoco cubren nada de esto |
| Infraestructura propia | Infra | Marginal | Rutas y tablas en `alhabla-api` y Cloud SQL, sin recursos nuevos en GCP. Un proyecto más en Vercel: confirma si tu plan cobra por proyecto |
| Search Console API y cuenta de servicio | Google | 0 € | Solo lectura; ya creadas |
| Ahrefs / Semrush / Ubersuggest | Suscripción de terceros | Apagado; no he verificado precios | Solo si decides pagar por backlinks de competidores |
| Tu tiempo | — | Objetivo: 30–45 min/semana | La Bandeja está pensada para respetarlo |

**Línea base de Max (pendiente):** al cerrar la semana, anota en `claude.ai/settings/usage` el
% semanal consumido sin ningún run de Growth. Presupuesto provisional del sistema: **no más del
10 % del límite semanal**. Es una propuesta sin medir y se ajusta con runs reales en la Fase 2.

---

## 11. Decisiones tomadas

Registro completo en `docs/growth/registro-de-decisiones.md`.

1. **Scheduled Task local** (Desktop); la nube queda como migración posible.
2. **Dashboard:** Google con lista blanca de tu correo, `growth.alhabla.ai` sin proxy de Cloudflare (a confirmar en Fase 1).
3. **Reddit y otras conversaciones: fuera del sistema** (2026-10-30). Se retoma solo con autorización y evidencia (Fase 6).
4. **Search Console por suplantación**, sin claves, por la política de la organización.
5. **Competencia como inteligencia interna** (2026-10-30): se añaden y quitan competidores desde el panel; pegar una URL hace que el agente la analice en el siguiente run; el agente busca dónde se menciona a los competidores y puede proponer los que ve (un `propuesto` no aplica reglas hasta que lo aceptas). El análisis no se puede citar en un borrador. HeyDiga y fonio, confirmados (§ 3.4).

Abiertas: la línea base de Max y el momento de aprobar la Fase 2b (el primer run).

---

## Fuentes (consultadas 2026-10-30)

- Claude Code, tareas programadas de escritorio: https://code.claude.com/docs/en/desktop-scheduled-tasks
- Claude Code, routines en la nube: https://code.claude.com/docs/en/routines
- Límites de Pro y Max con Claude Code: https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan
- Precios de Claude: https://claude.com/pricing

Referencias de Reddit, por si se retoma:

- Responsible Builder Policy: https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy
- Data API Terms: https://redditinc.com/policies/data-api-terms
- User Agreement §7: https://www.reddit.com/help/useragreement
- Política de spam: https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam
- Reddit Pro Trends: https://support.reddithelp.com/hc/en-us/articles/47619216411284-Reddit-Pro-Feature-Trends
- Tarifa comercial (no oficial): https://prowlo.com/blog/reddit-api-pricing
