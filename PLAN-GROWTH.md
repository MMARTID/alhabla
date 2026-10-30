# PLAN-GROWTH — Alhabla Growth

> **Estado: DISEÑO APROBADO (2026-10-30), en Fase 0. No hay código ni Scheduled Task creada.**
> Decisiones en `docs/growth/registro-de-decisiones.md`; protocolo de la Fase 0 en
> `docs/growth/fase-0-protocolo.md`. Cada fase siguiente necesita tu visto bueno.
> Sustituye a la propuesta del chat de la misma fecha (cola en Notion, cinco borradores
> diarios, un Explorador que buscaba hilos de Reddit). Qué cambia y por qué, en § 0.

Alhabla Growth es un sistema interno que **encuentra oportunidades, prepara borradores y
los deja en una bandeja para que los revises, los apruebes y los publiques tú a mano**.
Los agentes razonan en Claude Code (suscripción Max) con una Scheduled Task; la
persistencia y el dashboard son infraestructura propia de Alhabla.

---

## 0. Qué cambia respecto a la propuesta anterior

| Antes | Ahora | Motivo |
|---|---|---|
| Cola de revisión en Notion | Dashboard propio `growth.alhabla.ai` | Pedido tuyo; además permite reglas duras en el backend |
| 5 borradores diarios | Umbral de calidad; **hay días con cero** | Pedido tuyo; Reddit castiga el volumen repetitivo |
| Explorador que buscaba hilos de Reddit con búsqueda web y navegador | **Reddit solo por entrada manual** (tú pegas el hilo) | § 1: el User Agreement de Reddit prohíbe el acceso automatizado sin permiso escrito. Mi propuesta anterior lo incumplía; queda corregida |
| 6 agentes | 8 módulos, 3 objetivos separados | Pedido tuyo |
| Conocimiento "leído del repo" | Base de afirmaciones con fuente y commit; el backend rechaza lo no trazable | Para que no invente funciones |

---

## 1. Reddit: restricciones comerciales verificadas (2026-10-30)

| Hecho | Fuente | Consecuencia de diseño |
|---|---|---|
| Hay que **pedir y obtener aprobación explícita antes de acceder a cualquier dato** por la API. Política actualizada el 5-10-2026 (la versión de 5-6-2026 ya lo decía) | Responsible Builder Policy | Integración con Reddit **desactivada** y modelada como adaptador futuro |
| El uso comercial exige **aprobación escrita**. Fuentes secundarias cifran la tarifa comercial en ~0,24 $/1.000 llamadas, desde ~12.000 $/mes, sin plan intermedio. **Dato no oficial: no lo he visto en las páginas de Reddit** | Responsible Builder Policy; prowlo.com | Alhabla promocionando su producto es uso comercial. Fuera de alcance; solo se pediría con evidencia de valor |
| **Prohibido acceder, buscar o recoger datos por medios automatizados** (scraping incluido) sin consentimiento escrito; solo se tolera el rastreo conforme a `robots.txt` | User Agreement §7 | Sin scraping, sin navegador automatizado sobre reddit.com, sin APIs no autorizadas |
| Spam = acciones repetidas o no solicitadas, automáticas o manuales. Ejemplos prohibidos: **un bot que promociona productos**, herramientas (bots, IA generativa) que faciliten spam, **varias cuentas**, mensajes privados masivos. La promoción no es spam por sí sola; cada subreddit decide (muchos aplican ~10 %) | Política de spam | Publica una persona, cuenta única, sin mensajes privados, tope de autopromoción y de frecuencia |
| No se pueden usar datos de Reddit para entrenar modelos ni comercializarlos; hay que **borrar lo que no se necesite** | Responsible Builder Policy; Data API Terms | Extracto máximo 500 caracteres, retención 90 días, nada de Reddit en corpus de ejemplos |
| **Reddit Pro** (gratis, beta): solo países angloparlantes, Trends solo con conversaciones públicas **en inglés**, y prohíbe descargar publicaciones o comentarios de terceros (a mano o con herramientas) | Ayuda de Reddit Pro | No sirve para España y no puede alimentar al sistema |

**Hipótesis mías, sin verificar** (se comprueban en la Fase 0): que los enlaces de usuario en
Reddit salen `nofollow`/`ugc` (si es así, su valor SEO directo es nulo y rinden por tráfico y
por citas en IA); y que en español hay pocos hilos de dueños de peluquerías en Reddit. Si la
segunda se cumple, el peso real del sistema está en backlinks, SEO y GEO, no en Reddit.

---

## 2. Tres objetivos, separados

Una oportunidad tiene un `objetivoPrincipal` y tres puntuaciones. Comparten el pipeline
pero **cada objetivo tiene su umbral, su plantilla de borrador, su política de enlace y sus KPI**.

| | A. Tráfico y marca | B. Clientes potenciales | C. Backlinks y autoridad |
|---|---|---|---|
| Qué buscamos | Conversaciones donde aportar valor y ser mencionados | Dueños de negocios con cita que describen el dolor (llamadas perdidas, agenda, no-shows) | Enlaces editoriales: listicles, directorios, prensa y asociaciones del sector, menciones sin enlace |
| Dónde | Reddit (manual), foros y Q&A públicos | Igual, más los nichos nuevos | Sobre todo **fuera de Reddit** (enlace `nofollow`) |
| Borrador | Respuesta útil, normalmente sin enlace | Respuesta que ayuda; si menciona Alhabla, con divulgación | Email de contacto, ficha de directorio o texto para artículo invitado |
| Enlace | Solo si aporta; con UTM y divulgación | Solo si lo piden o encaja; UTM | Es el objetivo |
| KPI | Visitas por UTM, menciones, citas en IA | Conversaciones útiles, visitas a registro, altas atribuidas | Dominios nuevos que enlazan, calidad, posiciones |
| Nunca | Mensaje privado, plantillas repetidas | Perfilar personas, sacar contactos, DM | Comprar enlaces, esquemas de intercambio, spam en comentarios |

---

## 3. Los ocho módulos

Regla de diseño: **lo que se puede decidir con reglas vive en el backend (determinista,
testeable); el LLM solo hace lo que exige criterio.** Un agente mal instruido o con
prompt injection no puede saltarse las reglas duras.

| # | Módulo | Tipo | Hace | Salida | No puede |
|---|---|---|---|---|---|
| 1 | **Discovery Agent** | LLM + fuentes | Convierte en candidatos: la cola de entrada manual (hilos que pegas) y la web pública no-Reddit (foros, Q&A, blogs, directorios, listicles). Propone nichos nuevos | `GrowthOportunidad` en `detectada` | Tocar reddit.com por ninguna vía automática |
| 2 | **Qualification Agent** | Reglas + LLM | Puertas duras (abierto, reciente, comunidad apta, sin datos sensibles) y puntuación 0–100 por objetivo. Registra el motivo de cada descarte | `calificada` o `descartada` | Aprobar nada |
| 3 | **Research Agent** | LLM | Intención, competidores mencionados, reglas de la comunidad que ya guardaste, qué se respondió ya | `GrowthInvestigacion` | Leer Reddit por su cuenta |
| 4 | **Knowledge Agent** | Sincronización determinista + LLM | Mantiene la base de afirmaciones desde el repo (§ 3.1) y responde "¿qué puede decir Alhabla de X y con qué fuente?" | `GrowthAfirmacion`, snapshot con commit | Inventar: solo registra lo que tiene fuente |
| 5 | **Response Agent** | LLM | Redacta el borrador según objetivo, con las claves de afirmaciones que usa | `GrowthBorrador` | Afirmar algo sin clave de afirmación vigente |
| 6 | **Compliance Agent** | Reglas en backend + revisión LLM | Comprobaciones de § 3.2. El backend **rechaza** pasar a `pendiente_aprobacion` si una regla dura falla | `GrowthRevisionCumplimiento` | Saltarse una regla; aprobar |
| 7 | **Backlink Intelligence** | LLM + importaciones | Perfil de enlaces propio y de competidores, huecos, oportunidades de tipo C, menciones sin enlace | Oportunidades C, `GrowthEnlaceEntrante` | Contactar a nadie |
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
| `prohibida` | Lista de lo retirado por falso (Telnyx no se nombra, etc.) y términos que no se usan |

- Cada afirmación lleva `clave` estable (`precio.plan.pro`), texto, valor, fuente y commit.
- Un borrador solo puede afirmar cosas de Alhabla citando claves vigentes. El backend lo comprueba.
- Si cambia `plans.ts`, `PRODUCT.md` u otra fuente, el siguiente run resincroniza **antes** de redactar y los borradores en cola con claves obsoletas pasan a `bloqueado`.
- Las **limitaciones** son afirmaciones de primera clase, para que el Response Agent las diga cuando alguien pregunta por algo que Alhabla no hace.

### 3.2 Comprobaciones de cumplimiento (módulo 6)

Reglas duras (bloquean, las evalúa el backend):

1. Cada afirmación factual sobre Alhabla mapea a una clave vigente.
2. Ninguna afirmación de la lista `prohibida`.
3. Comparativas solo con dato verificable y fecha (art. 10 Ley 3/1991, como en `comparativas.ts`).
4. Si menciona Alhabla, hay divulgación ("soy el fundador de Alhabla").
5. Política de enlace de la comunidad respetada; reglas de la comunidad revisadas hace ≤ 30 días.
6. Ratio de autopromoción de tus últimas publicaciones por debajo del tope (por defecto 10 %) y tope semanal por comunidad.
7. Similitud con tus últimos borradores/publicaciones por debajo de un umbral (anti-plantilla).
8. Sin datos personales de terceros; sin DM; sin petición de contacto.
9. Tipo de borrador compatible con el objetivo.

Reglas blandas (avisan, decides tú): tono, longitud, que la respuesta funcione sin el enlace, que no suene a anuncio.

### 3.3 Nichos

- **Conoce los de hoy**: los 8 sectores de la web (`peluquería`, `barbería`, `centro de estética`, `salón de uñas`, `fisioterapia`, `pestañas y cejas`, `spa y masajes`, `peluquería canina`), cada uno con su vocabulario y su dolor.
- **Descubre nuevos**: cuando un hilo o una búsqueda muestra un negocio con cita fuera de la lista (tatuadores, veterinarias, estudios de yoga o pilates, psicólogos, talleres…), Discovery crea un `GrowthNicho` en estado `candidato` con evidencia.
- Cada candidato se puntúa por dolor telefónico visible, encaje con lo que Alhabla hace (cita + calendario), competencia, demanda de búsqueda (Search Console), riesgo regulatorio (datos de salud) y facilidad de llegar a ellos.
- **Tú decides** en la vista Nichos: `activo` o `descartado`. Pasar a activo no crea páginas ni borradores solo: abre una propuesta para el plan de contenido (`PLAN-WEB-CONTENIDO.md`).

---

## 4. Arquitectura técnica definitiva

```
 Mac (Claude Code Max)
 ┌──────────────────────────────────────────────────────────┐
 │ Scheduled Task local «growth-diario» (L–V)                │
 │   orquestador  ──►  8 subagentes (.claude/agents/growth-*)│
 │   herramientas: WebSearch, web_fetch (hook: sin reddit),  │
 │   Read del repo, alhabla-dev (solo lectura),              │
 │   alhabla-growth (MCP nuevo, acotado)                     │
 └───────────────┬──────────────────────────────────────────┘
                 │ HTTPS + token de agente (alcances mínimos)
                 ▼
 Cloud Run `alhabla-api`  ──  módulo `growth`  ──►  Cloud SQL (tablas Growth*)
   /growth/agente/*  (token)        ▲
   /growth/admin/*   (sesión admin) │ Cloud Scheduler: purga de retención
                 ▲
                 │
 growth.alhabla.ai (Vercel, Next 16)  ◄──  tú: revisar · editar · aprobar · publicar a mano · descartar
```

**Decisiones**

1. **Un solo backend**, un módulo nuevo. Cero servicios nuevos en GCP, `maxScale` 11 intacto (presupuesto de conexiones de Cloud SQL). Los endpoints son ligeros.
2. **Dashboard como tercera web** (`growth/`), no dentro de `frontend/`: la app de clientes es multi-tenant y no tiene rol de administrador. Las tablas `Growth*` no cuelgan de `Business` y **ningún JWT de cliente** abre `/growth/*`.
3. **Dos autenticaciones separadas**:
   - Administrador: inicio de sesión con Google y lista blanca `GROWTH_ADMIN_EMAILS` (tu correo). Único que puede `aprobar`, `marcar_publicado`, `descartar`, decidir nichos y editar ajustes.
   - Agente: token de servicio (se guarda solo su hash) con alcances: leer conocimiento y ajustes; crear oportunidades, investigaciones, borradores y métricas. **No puede aprobar ni marcar publicado.**
4. **Cloudflare Access descartado** para proteger el dashboard: el Worker de LaLiga quita el proxy de Cloudflare durante los partidos para que los usuarios en España entren; con Access delante, tu dashboard se caería justo entonces. El subdominio irá **sin proxy** (nube gris), a confirmar en la Fase 1.
5. **El backend no llama a ningún LLM.** Todo el razonamiento ocurre en la sesión programada (suscripción). Así no existe consumo de API oculto.
6. **Publicar no existe en el código.** No hay adaptador con método `publicar`, ni credenciales de escritura de Reddit, ni cliente de envío de email o WhatsApp en Growth. Un test comprueba que la interfaz `FuenteDeOportunidades` solo tiene métodos de lectura.
7. **Reddit como adaptador**, con tres implementaciones: `EntradaManual` (activa), `BusquedaIndirecta` (apagada por defecto, ver decisión 2 de § 11) y `RedditOficial` (apagada, solo lectura, exige `estadoAutorizacion = aprobada` con referencia escrita antes de poder activarse).
8. **Contenido externo = datos, nunca órdenes.** Un hilo pegado puede contener "ignora tus instrucciones". Los subagentes solo escriben a través de `alhabla-growth`, el backend valida todo con Zod y las reglas duras no dependen del prompt.
9. **Prompts versionados en el repo.** La Scheduled Task solo dice "lee `growth/agentes/orquestador.md` y síguelo": cambiar un prompt es un PR.
10. **Defensa en profundidad contra Reddit**: hook `PreToolUse` en `.claude/settings.json` que deniega cualquier `web_fetch`, navegador o `curl` hacia `reddit.com`/`redd.it`; instrucción explícita en el orquestador; y los conectores de Chrome y Playwright no se permiten en la tarea.

**Flujo de un run**

1. `GET /growth/agente/contexto`: ajustes, comunidades, cola de entrada manual, snapshot de conocimiento.
2. Knowledge: si cambió el commit de las fuentes, resincroniza.
3. Discovery (cola manual + web no-Reddit) → Qualification → descarta con motivo lo que no llega al umbral.
4. Por cada superviviente: Research → Response → Compliance → `POST` del borrador. Si una regla dura falla, queda `bloqueado` con el motivo.
5. Semanal: Backlink Intelligence y SEO & GEO. Mensual: barrido de nichos.
6. Notificación solo si hay algo que revisar. Cero oportunidades = cero avisos y el run queda registrado como "sin oportunidades que lo merezcan".

**Máquina de estados de la oportunidad**

```
detectada ─► calificada ─► investigada ─► con_borrador ─► pendiente_aprobacion ─► aprobada ─► publicada ─► medida
    │            │                              │                  │  └► devuelta ─► (vuelve a con_borrador)
    ▼            ▼                              ▼                  ▼
descartada   descartada                     bloqueada          descartada        aprobada ─► caducada (si vence expiraEn)
```

Solo el administrador puede entrar en `aprobada`, `publicada`, `devuelta` y `descartada` (por humano).

**Scheduled Task: local o en la nube**

| | Local (Desktop) | Nube (routine) |
|---|---|---|
| Funciona con el Mac apagado | No: solo con la app abierta y el Mac despierto; si duerme, ese run se omite y al volver hace **un** run de recuperación | Sí |
| Acceso al repo y a MCP locales | Sí (carpeta local, `alhabla-dev`, `alhabla-growth`) | Clon limpio; conectores configurados por tarea |
| Permisos | Configurables por tarea, "siempre permitir" por herramienta | Modo automático por defecto |
| Intervalo mínimo | 1 hora desde el formulario | 1 hora |
| Límite diario | Sin tope específico | Tope de routines/día según plan (15 en Max según la nota de lanzamiento de abril; **comprobar vigente**) |

**Recomendación**: local en las Fases 2–3 (más fácil de depurar y de acotar), con "Mantener el equipo despierto". Migrar a la nube si fallan los runs por el Mac, exponiendo el módulo Growth como MCP remoto.

---

## 5. Conectores y permisos

| Conector | Estado | Uso | Alcance |
|---|---|---|---|
| Claude Code Max + Scheduled Tasks | Existe | Razonamiento y ejecución | Tarea local; modelo y modo de permisos fijados en la tarea |
| `alhabla-growth` (MCP stdio) | **Nuevo** | Única vía de escritura | Herramientas: `contexto`, `leer_conocimiento`, `crear_oportunidad`, `descartar_oportunidad` (motivo), `guardar_investigacion`, `crear_borrador`, `registrar_cumplimiento`, `guardar_metricas`, `cerrar_ejecucion`. **Ninguna** aprueba o publica |
| `WebSearch` y `web_search`/`web_fetch` (Parallel) | Existen | Web pública no-Reddit: foros, Q&A, listicles, directorios, prensa | Lectura. Bloqueo de reddit.com por hook |
| `alhabla-dev` | Existe | `visitas_web`, `consultar_bd_prod` | **Solo lectura**; atribución de visitas y altas |
| Google Search Console API | **Nuevo** | Consultas, páginas, indexación | Cuenta de servicio con permiso de **solo lectura** en la propiedad |
| Importaciones CSV (GSC Enlaces, Bing Webmaster, Ahrefs Webmaster Tools) | Manual mensual | Enlaces propios | Subida por ti desde el dashboard |
| Ahrefs / Semrush / Ubersuggest (registro MCP) | **No** al inicio | Enlaces de competidores | Opcional, de pago, decisión posterior |
| Gmail, Zoho Mail, WhatsApp, Slack | **Prohibidos en la tarea** | — | Sin herramientas de envío: no hay DM, ni email, ni mensaje automático |
| Chrome, Playwright, navegador integrado | **Prohibidos en la tarea** | — | Evitan cualquier acceso automatizado a Reddit |
| Reddit API | **Apagado** | Futuro | Solo con aprobación escrita; lectura únicamente |

Permisos de la tarea: `Read`/`Grep` del repo, `Agent`, `WebSearch`, `web_search`/`web_fetch`, herramientas de `alhabla-growth`, `visitas_web` y `consultar_bd_prod`. Sin `Write`/`Edit` ni `Bash` salvo `git rev-parse`. Los secretos (token de agente, cuenta de servicio) en el llavero de macOS o en variables de entorno del Mac, nunca en el repo; variables nuevas en `.env.example` y `docker-compose.yml`.

Los avisos al móvil, si los quieres, van por la notificación de Claude (sin conectar mensajería).

---

## 6. Estructura del repositorio

```
growth/                              # nueva web Next 16 → growth.alhabla.ai (dev :3003, vista previa :3103)
  src/app/(panel)/
    bandeja/ · oportunidad/[id]/ · borradores/ · revision/ · historial/
    analitica/ · backlinks/ · seo-geo/ · nichos/ · conocimiento/ · comunidades/
    entrada/ · ejecuciones/ · ajustes/
  src/components/ · src/lib/api.ts
  agentes/
    orquestador.md                   # lo que lee la Scheduled Task
    reglas/{politica-reddit.md, voz-de-marca.md, afirmaciones-prohibidas.md}
backend/src/modules/growth/
  routes.ts                          # /growth/admin/* y /growth/agente/*
  service.ts · estados.ts · puntuacion.ts · cumplimiento.ts · similitud.ts
  conocimiento/sincronizar.ts        # lee plans.ts, PRODUCT.md, sectores, paginas, comparativas
  fuentes/{FuenteDeOportunidades.ts, entradaManual.ts, redditOficial.ts}   # redditOficial apagado
  analitica/{searchConsole.ts, utm.ts}
backend/mcp/growth/                  # MCP stdio «alhabla-growth»
.claude/agents/growth-{discovery,qualification,research,knowledge,response,compliance,backlinks,seo-geo}.md
.claude/settings.json                # hook que bloquea reddit.com en la tarea de Growth
backend/prisma/schema.prisma         # modelos Growth* + migración
backend/tests/growth/                # estados, cumplimiento, similitud, sincronización, alcances del token
docs/growth/{registro-de-decisiones.md, politica-reddit.md}
PLAN-GROWTH.md
```

Convenciones: todo en español; imports `.js`; Zod en bodies y params; logs `[Growth]`. **Excepción explícita al aislamiento multi-tenant**: las tablas `Growth*` no son de ningún negocio y solo las abre el administrador o el token de agente; se documenta en `AGENTS.md` y un test comprueba que un JWT de cliente recibe 403 en `/growth/*`. Proyecto nuevo en Vercel (`alhabla-growth`, root `growth`); CI con su job.

---

## 7. Esquema de base de datos

Prefijo `Growth`, ids `cuid`, sin relación con `Business`. Boceto (se ajusta a las convenciones del esquema al implementar).

```prisma
enum GrowthObjetivo { TRAFICO_MARCA LEADS BACKLINKS }

enum GrowthEstadoOportunidad {
  detectada calificada investigada con_borrador pendiente_aprobacion
  aprobada publicada medida devuelta bloqueada descartada caducada
}

enum GrowthEstadoBorrador { borrador bloqueado pendiente_aprobacion aprobado publicado descartado }
enum GrowthTipoBorrador { comentario respuesta publicacion email ficha_directorio texto_invitado }
enum GrowthEstadoNicho { activo candidato descartado }
enum GrowthAutorizacion { sin_autorizar solicitada aprobada }

model GrowthFuente {
  id String @id @default(cuid())
  tipo String            // reddit_manual | reddit_oficial | web | directorio
  nombre String
  activa Boolean @default(false)
  autorizacion GrowthAutorizacion @default(sin_autorizar)
  referenciaAutorizacion String?   // el escrito de Reddit, si algún día existe
  config Json?
}

model GrowthComunidad {          // un subreddit u otro foro
  id String @id @default(cuid())
  fuenteId String
  nombre String                  // r/…
  url String
  idioma String @default("es")
  reglasTexto String? @db.Text   // pegadas por ti
  reglasRevisadasEn DateTime?
  politicaEnlaces String @default("desconocida") // permite | prohibe | hilo_semanal | desconocida
  permiteAutopromo Boolean @default(false)
  prohibeIA Boolean @default(false)
  limiteSemanal Int @default(1)
  estado String @default("observando")           // observando | apta | vetada
  notas String? @db.Text
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

model GrowthEntradaManual {      // la cola que alimentas tú
  id String @id @default(cuid())
  url String
  comunidad String?
  textoPegado String @db.Text    // se purga a los 90 días
  nota String?
  creadaEn DateTime @default(now())
  procesadaEn DateTime?
  oportunidadId String?
}

model GrowthOportunidad {
  id String @id @default(cuid())
  claveExterna String @unique    // hash de la URL
  fuenteId String
  comunidadId String?
  nichoId String?
  url String
  titulo String
  extracto String                // ≤ 500 caracteres
  idioma String @default("es")
  publicadaEn DateTime?
  detectadaEn DateTime @default(now())
  objetivoPrincipal GrowthObjetivo
  puntTrafico Int @default(0)
  puntLeads Int @default(0)
  puntBacklinks Int @default(0)
  estado GrowthEstadoOportunidad @default(detectada)
  motivoDescarte String?
  datos Json?                    // tipo C: dominio, tipoEnlace, dificultad, dofollowEsperado
  expiraEn DateTime?
  retencionHasta DateTime
  ejecucionId String?
  @@index([estado, objetivoPrincipal])
}

model GrowthInvestigacion {
  oportunidadId String @id
  resumen String @db.Text
  intencion String
  competidores Json?
  contexto Json?
  reglasAplicables Json?
  creadaEn DateTime @default(now())
}

model GrowthBorrador {
  id String @id @default(cuid())
  oportunidadId String
  version Int @default(1)
  tipo GrowthTipoBorrador
  objetivo GrowthObjetivo
  texto String @db.Text
  enlaceUrl String?
  utm Json?
  afirmaciones String[]          // claves de GrowthAfirmacion usadas
  divulgacion Boolean @default(false)
  estado GrowthEstadoBorrador @default(borrador)
  textoFinal String? @db.Text    // lo que de verdad publicaste
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
  accion String                  // aprobar | editar | devolver | descartar | marcar_publicado | anular
  motivo String?
  por String                     // email del admin
  en DateTime @default(now())
}

model GrowthPublicacion {
  id String @id @default(cuid())
  borradorId String @unique
  plataforma String
  urlPublicada String
  cuenta String
  esAutopromo Boolean @default(false)
  publicadaEn DateTime
  retiradaPorModeracion Boolean @default(false)
  notas String?
}

model GrowthMedicion {
  id String @id @default(cuid())
  publicacionId String?
  enlaceId String?
  fecha DateTime @default(now())
  metricas Json                  // votos, respuestas, visitas por UTM, altas
  origen String                  // manual | analytics | search_console
}

model GrowthCompetidor { id String @id @default(cuid()) nombre String dominio String @unique notas String? }

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
  resumen Json?                  // candidatos, calificadas, descartadas por motivo, borradores, bloqueadas
  modulos Json?
  versionPrompts String?         // sha de git
  error String?
}

model GrowthAjuste { clave String @id valor Json actualizadoEn DateTime @updatedAt }  // umbrales, tope de ratio, retención, fuentes
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

Retención: una tarea de Cloud Scheduler borra `textoPegado` y `extracto` pasados 90 días (las decisiones y métricas se conservan sin texto de terceros). No se guardan nombres de usuario de Reddit salvo lo imprescindible en la URL.

---

## 8. Diseño del dashboard

Estética: la de Alhabla (tokens `tinta`, `morado`, `lavado`, `linea`; modo claro y oscuro; `DESIGN.md`), sobria, densa, sin adornos. **Pensado para el móvil**: revisar y copiar el texto en el sofá, abrir el hilo en la app de Reddit y publicar tú.

| Vista | Para qué | Contenido y acciones |
|---|---|---|
| **Bandeja** | Lo que merece tu tiempo hoy | Tarjetas de oportunidades calificadas, ordenadas por puntuación, con filtro por objetivo (A/B/C), nicho y fuente; chip de caducidad. **Estado vacío honesto**: "Hoy no hay nada que merezca tu tiempo", con el recuento de candidatos descartados y sus motivos |
| **Entrada** | Alimentar a Reddit a mano | Pegar URL + texto del hilo + nota; elegir comunidad; botón "Pegar reglas de la comunidad". Es el único modo de que un hilo de Reddit entre |
| **Revisión** | El centro del sistema | Tres columnas (apiladas en móvil): contexto del hilo e investigación · borrador editable · panel de cumplimiento (reglas duras en rojo, avisos en ámbar, afirmaciones usadas con su fuente y commit). Acciones: **Aprobar**, **Aprobar con ediciones**, **Devolver con nota**, **Descartar (motivo)**, **Copiar texto**, **Abrir hilo** |
| **Borradores** | Todo el trabajo en curso | Por estado: bloqueados (con el porqué), pendientes, aprobados sin publicar, caducados |
| **Historial** | Qué hiciste y qué pasó | Registro inmutable de decisiones; publicaciones con enlace; "Marcar como publicado" exige pegar la URL de tu comentario; marca si la moderación la retiró |
| **Analítica** | Si sirve para algo | Pestañas A / B / C. A: visitas por UTM, menciones, citas en IA. B: conversaciones, visitas a registro, altas atribuidas. C: dominios nuevos, enlaces ganados/perdidos, calidad. Embudo por fuente y comunidad; coste por hora tuya |
| **Backlinks** | Pipeline de tipo C | Oportunidades por tipo (listicle, directorio, prensa, asociación, mención sin enlace), estado de contacto (lo registras tú), perfil propio vs competidores, importación de CSV |
| **SEO & GEO** | Autoridad y visibilidad en IA | Consultas y páginas de Search Console, indexación del registro de páginas, huecos, panel GEO con su aviso de representatividad |
| **Nichos** | Dónde crecer | Los 8 activos y los candidatos con evidencia y puntuación; activar o descartar |
| **Conocimiento** | Qué sabe el sistema | Afirmaciones por tipo con fuente y commit, antigüedad del snapshot, limitaciones y lista de "prohibido decir" |
| **Comunidades** | Las reglas | Reglas pegadas, política de enlaces, límites, fecha de revisión; caducadas en ámbar |
| **Ejecuciones** | Salud del sistema | Runs, duración por módulo, errores, versión de prompts, descartes por motivo (para calibrar umbrales) |
| **Ajustes** | Control | Umbrales por objetivo, tope de ratio de autopromoción, tope semanal por comunidad, retención, fuentes activas, interruptor general de pausa |

Esbozo de **Revisión**:

```
┌ Oportunidad · LEADS · r/emprendedores · caduca en 31 h ───────────────────────────┐
│ HILO (pegado por ti)        │ BORRADOR v2 (editable)        │ CUMPLIMIENTO        │
│ «Pierdo clientes porque no  │ «Te entiendo, en mi caso …»   │ ✓ afirmaciones (3)  │
│ cojo el teléfono…»          │ (sin enlace)                  │   precio.plan.pro   │
│                             │                                │ ✓ divulgación       │
│ INVESTIGACIÓN               │ Enlace: ninguno (UTM listo)    │ ✓ ratio 6 % < 10 %  │
│ Intención: busca recepción  │                                │ ⚠ reglas hace 24 d  │
│ Competidores: —             │ [Copiar] [Abrir hilo]          │                     │
│ Reglas del sub: sin enlaces │ [Devolver] [Descartar]         │ [Aprobar]           │
└─────────────────────────────┴───────────────────────────────┴─────────────────────┘
```

---

## 9. Plan de implementación por fases

Cada fase en su rama y PR, con criterio de salida. **No se avanza de fase sin tu visto bueno.**

| Fase | Contenido | Criterio de salida |
|---|---|---|
| **0. Validación (1–2 semanas, sin código)** | (a) Participar en Reddit con tu cuenta, sin promoción. (b) Muestreo manual de 7 días en los subreddits candidatos: ¿cuántos hilos relevantes en español por semana? (c) Mirar el `rel` real de un enlace. (d) Crear la cuenta de servicio de Search Console. (e) Un run de prueba a mano para medir el consumo de Max | **Puerta**: si hay menos de ~3 hilos de calidad por semana, Reddit queda como canal menor y el esfuerzo se mueve a C y SEO/GEO |
| **1. Base** | Migración `Growth*`, módulo backend (estados, reglas duras, similitud, auth admin y token), sincronizador de conocimiento, MCP `alhabla-growth`, dashboard con Bandeja, Entrada, Revisión, Borradores e Historial sobre datos de prueba. Todo en dev | Tests en verde; un borrador sin clave de afirmación vigente es rechazado por el backend; un JWT de cliente recibe 403 |
| **2. Agentes (manual)** | Subagentes 1, 2, 3, 5, 6 y orquestador; run lanzado por ti, con entrada manual y fuentes web no-Reddit. Calibrar umbrales dos semanas viendo los descartes | Tasa de borradores que apruebas con pocos cambios; cero bloqueos por afirmación falsa en producción |
| **3. Scheduled Task** | Crear la tarea local L–V, "Run now" para fijar permisos, notificación solo si hay algo, analítica básica con UTM, paso a producción | Una semana de runs sin intervención y sin salirte del presupuesto de uso |
| **4. Backlinks y SEO/GEO** | Módulos 7 y 8, importaciones CSV, Search Console, panel GEO, vistas Backlinks y SEO & GEO (tareas semanales) | Primeras oportunidades C aprobadas y medidas |
| **5. Nichos y atribución** | Descubrimiento de nichos, vista Nichos, atribución de altas por UTM (requiere comprobar si el registro ya guarda el origen; si no, un cambio pequeño en producto que aprobarías aparte) | Un nicho candidato evaluado de punta a punta |
| **6. Reddit autorizado (condicionada)** | Solo si hay aprobación escrita de Reddit: activar `RedditOficial` en solo lectura. **Publicar sigue siendo manual** | Referencia de la autorización guardada; revisión legal del uso de los datos |

---

## 10. Riesgos, limitaciones y costes

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Sanción o *shadowban* de la cuenta | Persona real, cuenta única, divulgación, ratio y topes, sin DM, sin plantillas, tú publicas |
| Reddit rinde poco en español | Puerta de la Fase 0; el sistema no depende de Reddit |
| Afirmaciones falsas sobre Alhabla | Base con fuente, backend que rechaza lo no trazable, lista de prohibidos, tu revisión |
| Conocimiento desfasado | Commit en cada afirmación, resincronización antes de redactar, bloqueo de borradores con claves obsoletas |
| Inyección de instrucciones en un hilo pegado | Todo contenido externo es dato; el agente solo escribe vía MCP acotado; reglas duras en servidor |
| Consumo de Max compite con tu uso interactivo | Un run diario, subagentes acotados, medir en Fase 0, vigilar `claude.ai/settings/usage`; no activar créditos de uso sin tope |
| El Mac duerme | "Mantener despierto"; un run de recuperación; migrar a la nube si hace falta |
| Datos personales (RGPD) | Extracto mínimo, 90 días, sin perfilar ni extraer contactos, sin DM |
| Enlaces que Google considere manipulación | Solo enlaces editoriales o ganados: nada de compra, intercambios masivos ni spam en comentarios |
| Publicidad comparativa | Mismo estándar que `comparativas.ts`: datos objetivos, fecha y URL |
| Fuga del token de agente | Alcances mínimos, no aprueba nada, rotación y revocación |
| Presupuesto de conexiones de Cloud SQL | Endpoints ligeros, sin servicio nuevo, `maxScale` 11 |

### Limitaciones

- Reddit **no se lee solo**: lo que entre lo pegas tú. No hay vía oficial gratuita en español (Reddit Pro es solo inglés y prohíbe descargar contenido).
- Votos, respuestas y retiradas por moderación de lo que publiques se anotan a mano.
- El panel GEO usa la búsqueda de Claude, **no ChatGPT ni Perplexity**: es una señal, no una medición de mercado.
- Los backlinks de competidores exigen una herramienta de pago o trabajo manual; con las gratuitas ves los tuyos.
- La atribución de altas es parcial (UTM de primer toque, sin cookies de seguimiento propias).
- Un día sin oportunidades es un resultado válido, no un fallo.

### Costes (suscripción separada de API)

| Concepto | Tipo | Importe | Nota |
|---|---|---|---|
| **Claude Max** (razonamiento y Scheduled Task) | Suscripción | Desde 100 $/mes (5x) o 200 $/mes (20x); ya es tu plan | Los runs gastan los límites de 5 h y semanales, **compartidos** con tu uso interactivo. Sin factura adicional salvo que actives créditos de uso |
| Créditos de uso de Claude | Consumo adicional | 0 € mientras no los actives | Sin ellos, al llegar al límite los runs se rechazan. Si los activas, ponles tope |
| **API de Anthropic** | Consumo adicional | **0 €** | El diseño no tiene ninguna llamada a la API: el backend no usa LLM. Los créditos de API que incluye Max no se pueden usar en Claude Code, así que tampoco cubren nada de esto |
| Infraestructura propia | Infra | Marginal | Rutas y tablas en `alhabla-api` y Cloud SQL, sin recursos nuevos en GCP. Un proyecto más en Vercel: confirma si tu plan cobra por proyecto |
| Search Console API | API de Google | 0 € | Cuenta de servicio de solo lectura |
| Ahrefs / Semrush / Ubersuggest | Suscripción de terceros | Apagado; no he verificado precios | Solo si decides pagar por backlinks de competidores |
| Reddit API comercial | Contrato | ~12.000 $/mes según fuentes secundarias, **sin confirmar** | Fuera de alcance |
| Tu tiempo | — | Objetivo: 15–20 min/día | Es el recurso escaso; la Bandeja está pensada para respetarlo |

---

## 11. Decisiones tomadas (2026-10-30)

Aprobadas con las recomendaciones del diseño; el registro está en `docs/growth/registro-de-decisiones.md`.

1. **Scheduled Task local** (Desktop) al principio; la nube queda como migración posible.
2. **Búsqueda indirecta de Reddit apagada.** El User Agreement prohíbe "buscar o recoger datos" por medios automatizados y la frontera es discutible.
3. **Cuenta de Reddit: la tuya, como fundador**, con divulgación natural.
4. **Acceso al dashboard:** Google con lista blanca de tu correo, subdominio `growth.alhabla.ai` sin proxy de Cloudflare.
5. **Fase 0 como puerta:** si el muestreo da poco en español, el peso pasa a backlinks y SEO/GEO.

---

## Fuentes (consultadas 2026-10-30)

- Reddit, Responsible Builder Policy: https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy
- Reddit, Data API Terms: https://redditinc.com/policies/data-api-terms
- Reddit, Developer Terms: https://redditinc.com/policies/developer-terms
- Reddit, User Agreement §7: https://www.reddit.com/help/useragreement
- Reddit, política de spam: https://support.reddithelp.com/hc/en-us/articles/360043504051-Spam
- Reddit, "How do I keep spam out of my community?": https://support.reddithelp.com/hc/en-us/articles/28012014962580-How-do-I-keep-spam-out-of-my-community
- Reddit, Public Content Policy: https://support.reddithelp.com/hc/en-us/articles/26410290525844-Public-Content-Policy
- Reddit Pro Trends: https://support.reddithelp.com/hc/en-us/articles/47619216411284-Reddit-Pro-Feature-Trends
- Tarifa comercial (no oficial): https://prowlo.com/blog/reddit-api-pricing
- Claude Code, tareas programadas de escritorio: https://code.claude.com/docs/en/desktop-scheduled-tasks
- Claude Code, routines en la nube: https://code.claude.com/docs/en/routines
- Límites de Pro y Max con Claude Code: https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan
- Precios de Claude: https://claude.com/pricing
