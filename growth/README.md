# growth — el dashboard de Alhabla Growth (growth.alhabla.ai)

Panel interno, solo para el administrador: revisar las oportunidades que encuentra el agente, aprobar
o devolver los borradores, registrar lo que se ha hecho a mano y ver qué sabe el sistema. Sin registro
ni sesión propia: se entra con una cuenta de Google que esté en `GROWTH_ADMIN_EMAILS` del backend.
El diseño de las vistas está en `../PLAN-GROWTH.md` § 8; la API que consume (`/growth/admin/*`) en
`../backend/src/modules/growth/`. Es un proyecto aparte de la app (`../frontend`) y de la web (`../web`).

```bash
npm install     # (o `npm ci`) en cada worktree nuevo; nunca enlaces el node_modules de otro checkout
npm run dev       # http://localhost:3003 contra el backend real (necesita el login: ver más abajo)
npm run dev:demo  # http://localhost:3003 con datos de prueba, sin backend ni Google
npm run test      # vitest
npm run lint
npm run build     # no lo lances con `dev` arriba: comparten .next
```

La vista previa de las sesiones (`.claude/launch.json` › `growth-dev`) arranca la demostración en
`http://localhost:3103`. Este proyecto NO se sirve en el entorno de desarrollo fijo (`~/.alhabla-dev`).

## Variables

`.env.local` en dev (está en `.gitignore`), proyecto `alhabla-growth` en Vercel. Next solo sustituye las
`NEXT_PUBLIC_*` escritas de forma literal en el código: no se leen con un nombre calculado.

| Variable | Qué es | En producción |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | El backend (`https://api.alhabla.ai`; en las vistas previas de Vercel, `https://dev-api.alhabla.ai`). Sin ella, en desarrollo el cliente usa el proxy `/api/backend` de `next.config.mjs` hacia `localhost:3000`. | **Obligatoria**: sin ella el build falla. |
| `NEXT_PUBLIC_GROWTH_GOOGLE_CLIENT_ID` | ID de cliente OAuth (tipo «Aplicación web») de Google. Es público: el mismo valor que el backend recibe como `GROWTH_GOOGLE_CLIENT_ID`. | **Obligatoria**: sin ella el build falla. |
| `NEXT_PUBLIC_GROWTH_DEMO` | `1` activa el modo demostración (`npm run dev:demo`). **Solo desarrollo.** | **No puede existir**, ni vacía: con ella el build de producción falla a propósito. |

El nombre de la primera es el que ya usan `web/` y `frontend/` (no hay `NEXT_PUBLIC_API_URL`). Las
comprobaciones viven en `src/lib/config.ts`.

## Cómo se entra

Google Identity Services entrega un ID token (dura una hora) y el panel lo manda tal cual como
`Authorization: Bearer`. No hay sesión propia en el backend, ni cookie, ni ruta `/login`: la pantalla de
acceso es la propia puerta (`src/components/puerta-de-sesion.tsx`) que envuelve el panel.

- Al entrar se llama a `GET /growth/admin/yo` **antes** de enseñar nada: `401` ⇒ sesión caducada,
  `403` ⇒ «Esta cuenta no tiene acceso a Growth» (con «Usar otra cuenta»), `503` ⇒ «Growth no está
  configurado.».
- El token vive en `sessionStorage` (muere con la pestaña; nunca `localStorage`, cookies ni URL) con una
  copia en memoria si el almacenamiento falla.
- Se renueva cinco minutos antes de caducar y al volver a la pestaña; es de **mejor esfuerzo** (con FedCM
  hay un silencio de 10 minutos entre inicios automáticos). Si no llega, la sesión pasa a «caducada» y sale un
  diálogo para volver a entrar. **No redirige ni desmonta nada**: el borrador que estabas editando se
  queda; lo último que no llegó a guardarse hay que repetirlo (el panel no reintenta decisiones solo).
- La renovación silenciosa en Safari de iOS no está verificada: pruébala en el móvil antes de fiarte de ella.

## Modo demostración

`npm run dev:demo` (o la vista previa `growth-dev`) pone un cliente de datos de prueba
(`src/lib/demo/`) en lugar del HTTP y se salta Google: sesión simulada `demo@alhabla.ai`, ~16
oportunidades que cubren los 13 estados, borradores con dos versiones, una bloqueada por reglas duras, un
aviso de «apenas ha cambiado» respecto a la versión anterior, una caducada (con su borrador en «Caducados») y
otra a punto de caducar, afirmaciones con fuente y commit falsos, decisiones, gestiones y ejecuciones. Las
mutaciones aplican la misma tabla de estados que el backend (copiada en `src/lib/demo/estados-demo.ts`; un test
la compara con `backend/src/modules/growth/estados.ts`) y las mismas reglas de cumplimiento (copiadas en
`src/lib/demo/reglas-demo.ts`: 12 duras y 5 blandas, con sus mensajes; `tests/lib/paridad-de-reglas.test.ts`
compara nombres y orden con `backend/src/modules/growth/cumplimiento.ts`), también las de agenda (tope
semanal, un contacto por dominio): fallan con un `409` que no cambia nada. Dejan rastro, así que se puede
recorrer Bandeja → Revisión → Aprobar → Historial. `?vacio=1` enseña la Bandeja vacía con los descartes de la
semana. Una pastilla fija dice «DEMOSTRACIÓN · datos de prueba». Recargar la página reinicia los datos.

La **Competencia** (`/competencia`, `/competencia/[id]`) tiene cuatro competidores de ejemplo, uno por estado
(un propuesto por el agente, uno por analizar, uno analizado con precios y dos versiones, uno revisado con el
análisis caducado) y las mismas transiciones y errores que el backend (`src/lib/demo/competencia-demo.ts`:
`409 competidor_existente`, `competidor_del_repositorio`, `estado_incorrecto`, `analisis_antiguo`,
`ya_revisado` y los `400 dominio_propio` / `url_de_otro_dominio`). `tests/lib/paridad-de-competencia.test.ts` lee
`backend/src/modules/growth/` y falla si se separan las constantes, los campos de las respuestas, las rutas, los
códigos o las transiciones. El agente no existe en la demostración: nadie escribe un análisis nuevo, así que un
competidor recién añadido se queda «por analizar».

Si cambias el contrato con el backend (`types.ts`), cambia también la demostración y las fixtures de
`tests/fixtures/` (respuestas reales del servidor): `tests/components/acciones-contrato.test.tsx` ejecuta el
mismo caso del contrato de `acciones` contra la demostración y contra una respuesta con la forma real.

Tres seguros para que nunca llegue a producción:

1. **La condición va escrita a mano** en los dos únicos puntos que la usan
   (`src/lib/crear-cliente.ts` y `src/components/puerta-de-sesion.tsx`): el compilador la sustituye por
   `false` en producción y elimina el bloque entero, importación incluida. Un test comprueba que está
   así y que nadie más importa `lib/demo/`.
2. **`src/lib/config.ts` lanza** si `NODE_ENV` es `production` y existe `NEXT_PUBLIC_GROWTH_DEMO`.
3. **El job `growth` de CI busca la sentinela** de `src/lib/demo/datos.ts` en `.next/static` y
   `.next/server` tras el build y falla si aparece.

## Para quien haga las vistas

- Los datos se piden con los hooks de `src/lib/consultas.ts` (`useOportunidades`, `useDetalleDeOportunidad`,
  `useDecidir`, …) y estos con `useCliente()`: **las vistas no importan axios**. Los tests inyectan un cliente
  falso (`tests/helpers/cliente-falso.ts`, `render.tsx`) o el de demostración (`clienteDemo({ retardoMs: 0 })`).
- Todo texto de terceros (título, extracto, resumen, borradores, `datos`) es DATO: se pinta como texto, nunca
  con `dangerouslySetInnerHTML`, y un `href` solo sale de `esUrlWeb` / `EnlaceExterno` (solo http y https).
  En la Competencia (nombre, notas de un propuesto, resumen y datos de un análisis) el dominio es siempre
  texto y solo se enlazan las URL **https** (`urlHttpsSegura`: la URL de partida y la fuente de cada dato), con
  `rel="nofollow noopener noreferrer"` y `target="_blank"`.
- Un `409` de la API trae `codigo` y, en el de cumplimiento, `comprobaciones`: `analizarError()`
  (`src/lib/api-errors.ts`) los devuelve. El texto de un `5xx` nunca se enseña.
- Colores solo con tokens (`bg-lavado`, `text-morado-tinta`, `border-linea`…), nunca hex en las clases. Los
  tokens y las clases base (`.panel`, `.field`, `.btn-primary`…) son los de `frontend/src/app/globals.css`;
  modo claro y oscuro.
- No uses `refetchInterval` por debajo de 60 s: el backend corta a 100 peticiones por minuto e IP.
- `growth/` **no** está en `scripts/comprobar-copias-compartidas.sh`: no copies aquí `brand-mark` ni
  `google-auth-button` (este último es un flujo por redirección que no entrega un ID token de Google).

## Despliegue y pasos manuales (fuera del repo)

Nada de esto lo hace el código; hay que hacerlo a mano antes de que el panel funcione en producción:

1. **Google Cloud**: crear (o reutilizar) un cliente OAuth tipo «Aplicación web» para Growth. En «Orígenes de
   JavaScript autorizados» añadir `https://growth.alhabla.ai`, `http://localhost` y `http://localhost:3003`
   (y `http://localhost:3103` si quieres probar el login real en la vista previa). No hacen falta URIs de
   redirección. Si la pantalla de consentimiento está en «Externo» y «En pruebas», el correo del administrador
   tiene que figurar entre los usuarios de prueba. El ID de cliente es `GROWTH_GOOGLE_CLIENT_ID` (backend) y
   `NEXT_PUBLIC_GROWTH_GOOGLE_CLIENT_ID` (Vercel).
2. **Backend (Cloud Run, `alhabla-api`)**: definir `GROWTH_GOOGLE_CLIENT_ID` y `GROWTH_ADMIN_EMAILS`; sin ellas
   `/growth/admin/*` responde 503. Y `GROWTH_URL=https://growth.alhabla.ai` para CORS (sin él, el login
   funciona pero cada petición de datos falla en el preflight).
3. **Backend de desarrollo**: las mismas dos variables en el `.env` raíz del checkout principal (nunca se
   commitea) y recrear el contenedor `backend-dev`, para probar el login real contra `:3000`.
4. **Vercel**: proyecto nuevo `alhabla-growth` con Root Directory `growth`, framework Next.js, Node 22.x,
   «Ignored Build Step» `git diff --quiet HEAD^ HEAD -- .` (con la misma limitación que la app y la web: una
   rama cuyo último commit no toque `growth/` sale «Canceled»). Variables: `NEXT_PUBLIC_API_BASE_URL`
   (production `https://api.alhabla.ai`, preview `https://dev-api.alhabla.ai`) y
   `NEXT_PUBLIC_GROWTH_GOOGLE_CLIENT_ID`. **`NEXT_PUBLIC_GROWTH_DEMO` no debe existir.** Dominio
   `growth.alhabla.ai` en el proyecto.
5. **Cloudflare**: CNAME `growth` al destino `*.vercel-dns-017.com` que indique Vercel, en modo solo DNS (nube
   gris, sin proxy). El Worker `alhabla-failover-laliga` no toca ese registro. Anótalo en
   `../docs/growth/registro-de-decisiones.md`.
6. **Token del agente**: lo crea el script del servidor (el token en claro no pasa nunca por el navegador) y se
   guarda en el llavero del Mac, no en el repo.
7. Las vistas previas de Vercel de una rama **no pueden iniciar sesión** (Google no admite orígenes
   comodín): solo sirven para comprobar que compila.

Search Console: la propiedad `sc-domain:alhabla.ai` cubre este subdominio. Por eso `robots.txt` NO prohíbe
nada (si no, no se lee el `noindex`) y todas las respuestas llevan `X-Robots-Tag: noindex, nofollow,
noarchive`, `X-Frame-Options: DENY` (clickjacking sobre los botones de aprobar) y `nosniff`. No se fija
`Cross-Origin-Opener-Policy`: `same-origin` a secas rompería la ventana emergente de Google.
