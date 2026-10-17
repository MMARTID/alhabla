# Alhabla

SaaS multi-tenant de recepcionistas de voz con IA para pequeños negocios en España
(peluquerías, barberías, salones de uñas, centros de estética, clínicas de fisioterapia).
Los agentes de voz atienden llamadas, consultan horario y disponibilidad, y reservan citas
en el calendario de Google, Outlook o Apple/iCloud del negocio. Desde septiembre de 2026 hablan
también por WhatsApp con el dueño (avisos y el Gestor) y con sus clientes.

Backend Fastify 5 + Prisma/PostgreSQL (el estado temporal también: cerrojos, límite de peticiones,
cachés y claves de un solo uso; Redis solo queda como espejo de los cerrojos mientras exista
`REDIS_URL`, ver AGENTS.md § Corte de Redis a Postgres). Dos webs Next.js 16 App Router (React 19) con Tailwind 3
(desde el 2026-09-21, `docs/historico/PLAN-APP-DOMINIO.md`): **la app** en `frontend/` (puerto 3001,
`app.alhabla.ai`, TanStack Query, sesión JWT en `localStorage`) y **la web pública** en `web/`
(puerto 3002, `alhabla.ai`: landing, sectores, planes, legal, registro de cuenta y blog en MDX,
sin sesión). El registro crea la cuenta en la web y entra en la app con un pase de un solo uso
(`POST /auth/pase/canjear`). Voz vía **Telnyx AI Assistants** (el único orquestador: Retell.ai,
el respaldo que nunca cogió una llamada, se retiró el 2026-10-17, `PLAN-RETIRAR-RETELL.md`);
telefonía y WhatsApp por Telnyx, pagos Stripe.

**Producción** (desde 2026-09-01): backend en Google Cloud Run, **un solo servicio**,
`alhabla-api` (`https://api.alhabla.ai`, tráfico público). Los jobs en segundo plano (antes
BullMQ en un servicio `alhabla-worker` aparte) migraron el 2026-09-03 a Cloud Tasks/Cloud
Scheduler, que llaman de vuelta a `alhabla-api` — ya no hace falta un servicio siempre
encendido. Las dos webs en Vercel (proyectos `alhabla-frontend`, root `frontend`, dominio
`app.alhabla.ai`; y `alhabla-web`, root `web`, dominio `alhabla.ai`). `alhabla.ai` redirige con
301 toda ruta de la app a `app.alhabla.ai`. `alhabla-api` tiene un **máximo de 11 instancias**:
es el presupuesto de conexiones de Cloud SQL (`max_connections` 50; 4 por instancia en el peor
caso), y el deploy se para si alguien lo sube. El DNS está en Cloudflare, y el Worker
`alhabla-failover-laliga` (`infra/cloudflare/failover-laliga/`) quita y vuelve a poner por sí solo el
proxy de `alhabla.ai`, `www` y `app` cuando LaLiga hace bloquear las IPs de Cloudflare: no se
tocan a mano. Detalle completo, IDs de recursos y comandos reales en `AGENTS.md` § Deployment
Notes.

## Reglas que no se negocian

- **Todo en español.** Copy de UI, comentarios, nombres de variables y lógica de negocio.
  Solo se aceptan términos técnicos en inglés (`routes.ts`, `service.ts`, `prisma`, `fastify`).
- **Imports con extensión `.js`** en rutas TypeScript — requisito de ESM:
  `import { prisma } from "../../lib/prisma.js";`
- **Aislamiento multi-tenant:** toda consulta con ámbito de negocio se filtra por
  `request.user.businessId` del token JWT. Nunca aceptes un `businessId` del body para
  lecturas ni escrituras.
- **Los adaptadores son la única vía a las APIs de voz.** Telnyx pasa por
  `backend/src/adapters/telnyx/TelnyxAdapter.ts` (números) y `TelnyxAiAdapter.ts` (assistants), y
  WhatsApp por `adapters/whatsapp/WhatsAppAdapter.ts`. Jamás llames a esas APIs desde un route
  handler. `adapters/retell/RetellAdapter.ts` solo queda para limpiar la cuenta de Retell, hasta
  la PR 3 del plan.
- **No toques la verificación de firmas de webhooks.** Telnyx (Ed25519) se comprueba en un único
  `preHandler` (`backend/src/plugins/firmaTelnyx.ts`) que protege todas las rutas de
  `modules/webhooksTelnyx/routes.ts` — una ruta firmada nueva va en ese plugin; firma de Stripe
  con `rawBody: true`.
- **Nunca commitees `.env`.** En la raíz hay `.env`, `.env.bak` y `.env.google` con
  credenciales reales; están en `.gitignore`. `docker-compose.yml` vive en la raíz y lee
  ese `.env` (build context de `backend`/`backend-dev` es `./backend`).

## Convenciones

- Prettier: `semi: true`, `trailingComma: "es5"`, `singleQuote: false`, `printWidth: 80`,
  `tabWidth: 2`.
- Alias: backend `"@/*"` → `"./src/*"` (es decir, `backend/src/`); frontend `"@/*"` → `"./src/*"`.
- Validación con Zod en bodies y params; `400` con `error.errors` en `ZodError`.
- Logs prefijados con el módulo entre corchetes: `[Agent]`, `[Calendar]`, `[Job]`.
  `fastify.log` dentro de rutas, `console.log`/`console.error` en arranque y workers.
- Rutas autenticadas: `onRequest: fastify.authenticate` o
  `preValidation: [fastify.authenticate]`.
- Frontend: TanStack Query para todo el estado de servidor (`staleTime: 30s`, sin retry,
  sin refetch on focus). `useBusiness()` para estado de auth.
- Nueva variable de entorno ⇒ añadirla a `.env.example` **y** a `docker-compose.yml`
  (servicios `backend` y `backend-dev`). Sin defaults reales para secretos.
- Un componente que usan las dos webs (`brand-mark`, `particle-*`, `google-auth-button`,
  `range-slider`, `google-analytics`…) vive copiado, idéntico byte a byte, en las dos: si lo
  cambias en una, copia el fichero a la otra; lo que varía entre app y web va por props. La
  lista está en `scripts/comprobar-copias-compartidas.sh` y CI (job «Copias compartidas
  app/web») falla si alguna copia difiere.

## Diseño (frontend)

Estética SaaS conservadora y profesional para negocios tradicionales españoles. Nada de
look de startup ni de app de consumo. Rediseño negro/blanco/morado (agosto 2026, commit
`eeab7f4`). **Desde octubre de 2026 la app tiene modo oscuro** (por defecto el del sistema, con
selector en Cuenta): cada color es un token con su valor claro y su valor oscuro en
`frontend/src/app/globals.css` (canales RGB en `:root` y `:root[data-tema="oscuro"]`) y una
clase de Tailwind con el mismo nombre (`tailwind.config.ts`). **Nada de hex en las clases**
(`bg-[#f3eeff]`): se usa el token (`bg-lavado`), o no cambiará en oscuro.

| Token (clase) | Claro | Uso |
|---------------|-------|-----|
| `lienzo` / `superficie` / `elevada` | `#ffffff` | Fondo de página, paneles, lo que flota |
| `relleno` / `relleno-fuerte` | `#fafafa` / `#f4f4f5` | Rellenos suaves, esqueletos |
| `linea` / `linea-suave` / `linea-fuerte` | `#e5e5e5` / `#f0f0f0` / `#d4d4d8` | Bordes |
| `tinta` (+ `sobre-tinta`) | `#0a0a0a` | Texto principal y botón primario; se invierte en oscuro, y el texto encima con él |
| `apagado` / `tenue` | `#52525b` / `#a1a1aa` | Texto secundario (`.text-muted`) |
| `morado` / `morado-tinta` / `lavado` / `lavado-borde` | `#8b5cf6` / `#6d28d9` / `#f3eeff` / `#ddd6fe` | Acento: iconos, focus, badges |
| `exito` / `aviso` / `error` (+ `-fondo`, `-borde`) | `#2c7334` / `#806012` / `#c53030` | Estados |
| `urgente` (+ `-fondo`) | `#b42318` | Lo que pide actuar (cita que se cayó): rojo sobrio solo en el icono, tarjeta blanca |
| `peligro` | `#c53030` | Botones de borrar (texto blanco en los dos temas) |
| `oscuro` | `#0a0a0a` | Superficies oscuras en los dos temas (próxima cita, transcripción) |

Clases base (`.panel`, `.field`, `.btn-primary`, `.btn-secondary`, `.btn-purple`,
`.badge-soft`): `rounded-[10px]` en botones e inputs (desde el 2026-09-17, commit `e6d3b52`),
`rounded-full` solo en badges, navegación en pastilla y círculos, y `rounded-3xl` en
paneles. Sin radio de 8 px (`rounded-lg`). Iconos Lucide React en contenedores
`rounded-xl` con `bg-lavado` y `text-morado`. La web pública (`web/`) define los mismos
tokens, solo en claro, para que las copias compartidas usen las mismas clases. Detalle completo
en `DESIGN.md`.

## Comandos

```bash
cd backend
npm run dev            # backend, tsx watch (:3000)
npm run build          # tsc
npm run test           # vitest run
npm run test:integration # contra Postgres/Redis reales (backend/.env.test)
npm run lint           # eslint src
npm run typecheck      # tsc --noEmit
npm run prisma:migrate # migraciones en dev
npm run prisma:studio  # :5555

cd frontend && npm run dev   # la app, Next.js :3001
cd web && npm run dev        # la web pública, Next.js :3002

docker compose --profile dev up   # backend + postgres + redis + cloudflared (desde la raíz)
scripts/backend-sim.sh            # backend-sim :3010, destino de los webhooks de Telnyx simulados (también desde un worktree)

scripts/dev/instalar.sh           # una vez en el Mac: entorno de desarrollo fijo al iniciar sesión
scripts/dev/entorno.sh estado     # qué enseña el entorno fijo y qué responde
```

## Entorno de desarrollo (desde 2026-10-15)

Hay **un solo** entorno de desarrollo y es fijo: `~/.alhabla-dev` (worktree que ninguna sesión edita)
con el backend de dev en Docker (`:3000`), la app (`:3001`) y la web (`:3002`), por defecto en el
último `main`. Arranca solo al iniciar sesión en el Mac (LaunchAgents `ai.alhabla.dev.*`: Docker
oculto, `main` al día, migraciones y la app en Chrome) y el panel `http://localhost:3005` dice
qué enseña, qué responde, los PR abiertos y producción. La app lleva una pastilla «DEV · rama ·
commit» que solo existe ahí. Reglas para las sesiones:

- **Nunca** levantes `backend-dev` desde tu worktree (`docker compose up` fuera de `~/.alhabla-dev`) ni
  ocupes `:3001`/`:3002`: tus vistas previas (`.claude/launch.json`) van a `:3101`/`:3102` contra el
  backend fijo. Si el panel o `estado_dev` dicen `backendFueraDeSitio`, alguien lo hizo: devuélvelo
  con `ver_en_dev`.
- Para que el usuario vea tu cambio **antes de fusionar**: push de la rama y MCP `ver_en_dev` (o el
  botón «Ver en dev» del panel); dale `http://localhost:3001`. Al acabar, `ver_en_dev main`.
- Las migraciones de esa rama se aplican a la BD de dev (`botbook`), que es compartida.

Detalle en `AGENTS.md` § Entorno de desarrollo fijo.

## Estructura

```
backend/
├── src/
│   ├── server.ts     # entry Fastify: registra rutas + endpoints internos de jobs (Cloud Tasks)
│   ├── plugins/      # auth (JWT), internalAuth (OIDC de Cloud Tasks) y firmaTelnyx
│   │                 #   (Ed25519); CORS y rate-limit se registran en server.ts
│   ├── modules/      # por dominio (agents, auth, billing, bookings, businesses, busqueda, calendar,
│   │                 #   calls, contacto, demo, internal, onboarding, phone, places, recordings,
│   │                 #   webhooksTelnyx, whatsapp) con routes.ts; gestor y voiceTools sin routes.ts
│   │                 #   (los usan los webhooks y los scripts)
│   ├── adapters/     # telnyx (voz y números), whatsapp, calendar (Google, Outlook, CalDAV) y
│   │                 #   retell (solo para limpiar su cuenta)
│   ├── lib/          # prisma, almacenTemporal, cerrojos, limitesDePeticiones, cloudTasks,
│   │                 #   storage, stripe, availability, salud, zohoMail, emailTemplates,
│   │                 #   businessSchedule, agentBootstrap, managedAgentPrompt
│   ├── config/       # voiceAgent.ts (catálogo de voces/LLM/STT)
│   └── jobs/         # lógica de los jobs (sin framework): processRecording, retryFailedBooking,
│                     #   sendEmail, sendSms, sendWhatsapp, cleanupZombieCalls, telnyxReconciler,
│                     #   sendWeeklySummary… — invocados vía Cloud Tasks/Scheduler en producción,
│                     #   en línea en dev (ver AGENTS.md § Background Jobs)
├── prisma/schema.prisma
├── scripts/          # scripts manuales (sincronizar assistants/prompts, demo, simulaciones)
├── tests/            # Vitest (tests/integration/ aparte, contra Postgres/Redis reales)
└── Dockerfile
frontend/src/{app,components,lib,hooks}/   # la app (app.alhabla.ai)
web/src/{app,components,lib,hooks}/        # la web pública (alhabla.ai); artículos en web/content/blog/*.mdx
infra/cloudflare/failover-laliga/          # Worker de Cloudflare de los bloqueos de LaLiga (node --test; se sube a mano)
```

Enlaces entre las dos: la app enlaza a la web con `NEXT_PUBLIC_WEB_URL` (`frontend/src/lib/web-url.ts`)
y la web a la app con `NEXT_PUBLIC_APP_URL` (`web/src/lib/app-url.ts`); el backend con `APP_URL`
y `WEB_URL` (`backend/src/lib/urls.ts`). Nada de rutas de la otra web escritas a mano.

## Documentación

- `AGENTS.md` — referencia técnica completa (~240 KB, en inglés con secciones en español):
  modelos Prisma, flujos de webhooks, WhatsApp, telefonía, facturación Stripe, calendarios,
  el orquestador de voz (Telnyx), despliegue.
  Consúltalo cuando trabajes sobre un subsistema concreto.
- MCP `alhabla-dev` (`.mcp.json`, `backend/mcp/`): SQL de solo lectura y esquema real en dev y en
  producción, JWT de dev, webhooks firmados de Telnyx contra el backend local, logs, peticiones,
  latencias por ruta y estado de producción, salud y traza de las llamadas, resumen de un negocio,
  assistants y conversaciones de Telnyx (solo GET) y los jobs del Scheduler que se pueden repetir. Úsalo antes que `gcloud`/`curl`/`psql` a mano. Ver `AGENTS.md` § MCP de desarrollo.
- `.claude-context.md` — resumen de producto, audiencia, tono de marca y problemas
  UI/UX conocidos.
- `PRODUCT.md` (producto y marca), `DESIGN.md` (sistema de diseño), `CONTRIBUTING.md`
  (flujo de ramas y PR).
- `PLAN-*.md` — planes activos en la raíz; los cerrados viven en `docs/historico/` y el código
  los cita con esa ruta completa. Nunca edites un `migration.sql` ya aplicado para actualizar
  una referencia (Prisma guarda su checksum).
