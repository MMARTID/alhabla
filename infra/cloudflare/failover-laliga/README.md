# alhabla-failover-laliga

Worker de Cloudflare que mantiene las webs accesibles desde España durante los
bloqueos de LaLiga.

## El problema

Mientras hay partido, las operadoras españolas bloquean IPs concretas de
Cloudflare (el 10-10-2026: `188.114.96.5`, `188.114.97.5`, `2a06:98c1:3120::5`
y `2a06:98c1:3121::5`). Los tres CNAME de las webs están en proxy (nube naranja)
hacia Vercel:

| Registro         | Destino                                | Normal  |
|------------------|----------------------------------------|---------|
| `alhabla.ai`     | `11d10c4786ee7e11.vercel-dns-017.com`  | proxied |
| `www.alhabla.ai` | `11d10c4786ee7e11.vercel-dns-017.com`  | proxied |
| `app.alhabla.ai` | `11d10c4786ee7e11.vercel-dns-017.com`  | proxied |

Cloudflare da IPs distintas según el resolver: 1.1.1.1 (`one.one.one.one`) y el
DNS del router de Orange reciben `104.21.57.158` / `172.67.191.30` y
`2606:4700:3032::6815:399e` / `2606:4700:3036::ac43:bf1e` (no bloqueadas);
Google, Quad9, `cloudflare-dns.com` y el DNS de Movistar reciben las
`188.114.96.x` / `188.114.97.x` y `2a06:98c1:312x::5` (bloqueadas). Con el
proxy apagado (DNS-only), Vercel sirve las tres webs directamente con su propio
certificado (`64.29.17.x` / `216.198.79.x`), y esas IPs no están bloqueadas.

**No se tocan nunca**: `api.alhabla.ai` (DNS-only a Cloud Run) y
`dev-api.alhabla.ai` (túnel de Cloudflare, tiene que seguir proxied). Están
vetados en el código: si alguien los pone en `HOSTNAMES`, el Worker se niega a
arrancar.

## Qué hace

Cada 2 minutos (cron):

1. Lee `https://hayahora.futbol/estado/blocked-any.txt` (una IP o rango por
   línea, IPv4 e IPv6, CIDR incluidos) con plazo de 8 s y sin caché.
2. Lee los tres CNAME por la API de Cloudflare (nombre exacto y tipo CNAME;
   nada más puede acabar en un PATCH).
3. Averigua qué IPs de Cloudflare reciben nuestros usuarios: con el proxy
   encendido, pregunta por DoH a `dns.google` con `edns_client_subnet` de
   Movistar (`83.32.0.0/24`), Orange (`90.165.0.0/24`), Vodafone
   (`77.208.0.0/24`) y DIGI (`79.116.0.0/24`), a `cloudflare-dns.com` y a
   `one.one.one.one`, A y AAAA. Las dos caras salen de aquí: Google (con
   cualquier ECS) y `cloudflare-dns.com` dan las `188.114.x`, y
   `one.one.one.one` las `104.21/172.67` (comprobado el 10-10-2026: el ECS no
   cambia la cara, solo rota entre `.5`, `.2` y `.1`, y `::5`, `::2` y `::1`).
   Solo guarda las que caen en los rangos publicados de Cloudflare. Con el
   proxy apagado usa las guardadas en KV, más las que dejó en la marca al
   apagar.
4. Resuelve igual el destino de los CNAME (las IPs de Vercel) cuando podría
   tener que apagar, y si no cada 6 horas. Los tres CNAME tienen que ir al
   mismo destino: si no, no hace nada (`destinos_distintos`, error), porque
   con tres destinos las 12 consultas DoH de cada uno no dejarían sitio a los
   PATCH dentro de las 50 subpeticiones.
5. Decide (lógica pura en `src/conmutador.js`). Si toca encender, antes
   pregunta a `blocked.dns.hayahora.futbol` (A y AAAA, por `dns.google` y
   `cloudflare-dns.com`): sus registros son las IPs bloqueadas en algún operador
   y los sirve DigitalOcean, no el servidor web de la lista, así que es un
   segundo canal. Si ahí siguen nuestras IPs, no enciende (y lo vuelve a
   preguntar en la siguiente ejecución). Y la respuesta tiene que estar al día
   (ver «La confirmación con el DNS de hayahora»).
6. Aplica los PATCH y escribe una línea JSON con la decisión y el motivo.

### Cómo decide

Por cada uno de los tres registros:

| Situación del registro | Condición | Acción |
|---|---|---|
| Proxied y sin marca | Alguna IP nuestra de Cloudflare en la lista, ninguna de Vercel en la lista, y ningún cambio en los últimos 10 min (nuestro o hecho a mano, según `modified_on`) | **Apagar**: `{"proxied":false,"ttl":60}`. La marca se guarda en KV *pendiente* antes del PATCH y, si sale bien, se confirma con el `modified_on` que devuelve la API |
| Proxied y sin marca | Vercel también bloqueado, sin IPs de Vercel, antirrebote o sin bloqueo | Nada |
| DNS-only y sin marca | — | **Nada, nunca**: lo apagó un humano |
| DNS-only y con marca | Nuestras IPs fuera de la lista **2 observaciones seguidas**, esa racha limpia dura **10 min**, han pasado **15 min** desde que lo apagó y **el DNS de hayahora, al día, tampoco las ve** | **Encender**: `{"proxied":true,"ttl":1}` (1 = automático) y se quita de la marca |
| DNS-only y con marca | Sigue el bloqueo, falta alguna condición o el DNS de hayahora no responde, no está al día o sí ve nuestras IPs | Esperar (si lo que falta es el DNS, la racha limpia sigue y se le vuelve a preguntar en la siguiente ejecución) |
| DNS-only y con marca, sin `modified_on` legible | — | Esperar: no se suelta la marca ni se enciende (no se sabe si lo tocó un humano); si dura, error |
| DNS-only y con marca, pero modificado después de nuestro cambio | — | Lo tocó un humano (p. ej. lo encendió y lo volvió a apagar): **se suelta la marca** y ya no se enciende nunca solo |
| DNS-only y con marca sin confirmar (PATCH sin respuesta, o semilla) | — | Se **adopta**: su `modified_on` pasa a ser el de nuestro cambio |
| Proxied y con marca pendiente, sin modificar desde la marca | Sigue el bloqueo y Vercel está sano | El PATCH no llegó a aplicarse: se **reintenta** (sin antirrebote) |
| Proxied y con marca pendiente, sin modificar desde la marca | Ya no hay bloqueo, o Vercel bloqueado o desconocido | Se retira la marca |
| Proxied y con marca, en cualquier otro caso | — | Lo encendió un humano (o la semilla no valía): **se suelta la marca** y no se toca; después rigen las reglas de «sin marca», antirrebote incluido |

Y antes de nada, **no se cambia nada** si:

- la lista no es fiable: error de red o plazo agotado, HTTP distinto de 200,
  HTML o JSON en lugar de texto, sin una sola IP, más del 10 % de líneas que no
  son IPs, menos bytes de los que anuncia `Content-Length` (si no viene
  comprimida), sin salto de línea al final (el fichero real siempre lo lleva:
  una IP cortada como `188.114.96.12` → `188.114.96.1` sigue pareciendo una IP),
  sin `Last-Modified`, con uno de más de 2 minutos en el futuro o con uno de
  hace más de 15 minutos (hayahora lo reescribe cada ~30 s aunque no cambie,
  con 1-2 minutos de retraso: uno viejo es una lista congelada, y sin fecha o
  con una del futuro no se puede saber). Una lista inválida no cuenta como
  limpia, pero sola tampoco rompe la racha (ver abajo);
- no se puede leer KV o la API de Cloudflare;
- falta alguno de los tres registros, está duplicado, su destino no es Vercel
  o no van los tres al mismo destino;
- no hay ninguna IP de Cloudflare conocida (con el proxy apagado y KV vacío).

La marca es **por registro** (`marca.registros["www.alhabla.ai"].apagadoEn`): si
un humano había apagado uno a mano, el conmutador apaga los otros dos y, al
acabar el bloqueo, solo enciende esos dos. La marca guarda también las IPs
nuestras que estaban bloqueadas al apagar (`ipsBloqueadas`), y cuentan como
nuestras mientras dure: así una lectura atrasada de `observacion` no puede
hacer que se olvide una IP vista por primera vez justo antes de apagar.

**La racha limpia** son las observaciones con la lista válida y sin nuestras
IPs (`limpiasSeguidas`, de `limpioDesde` a `limpioHasta`). La rompe que la
lista vuelva a traer alguna IP nuestra, o que entre dos observaciones limpias
pasen **más de 5 minutos**: es decir, que falte más de una ejecución seguida
(lista inválida, API o KV ilegibles, error, CPU agotada o un cron que no
corrió), porque en ese hueco el bloqueo pudo volver sin que lo viéramos. Una
sola ejecución fallida en medio ni cuenta ni rompe nada.

Todo es idempotente: solo se hace PATCH de lo que no está ya en el estado que
toca, así que si un PATCH falla a medias, el siguiente ciclo completa lo que
falte. Al apagar, la marca se guarda en KV **antes** del PATCH: si KV no deja
escribir, no se apaga (un apagado sin marca parecería hecho a mano y nunca se
volvería a encender solo).

### Una lista vacía es «sin bloqueos», no «lista inválida»

Entre partidos `blocked-any.txt` está **vacío**: en el historial de hayahora
(`data.json`) el número de IPs bloqueadas vuelve a 0 todos los días de
septiembre y octubre, y hay días enteros con 0 o 1. Si una lista vacía contara
como inválida, el conmutador no podría volver a encender el proxy nunca. Por eso
una respuesta HTTP 200 sin IPs (o solo con comentarios) es válida y cuenta como
ejecución limpia. Tampoco hay un mínimo de líneas: con bloqueos reales ha
habido días de 1 sola IP, y el final de un bloqueo puede pasar de 140 IPs a 0
de golpe (05-10-2026), así que «encoger de repente» tampoco es una señal.

Lo que protege de una lista vacía *falsa* (hayahora roto en pleno partido) es:
la racha limpia de 10 minutos (un fallo corto no basta), el `Last-Modified`
(una lista congelada deja de valer) y, sobre todo, la confirmación con
`blocked.dns.hayahora.futbol` justo antes de encender. Si hayahora publicara
una lista falsa *y* el mismo dato falso en su DNS durante más de 10 minutos, el
conmutador lo creería: no hay forma de medir los bloqueos de las operadoras
desde un Worker.

### La confirmación con el DNS de hayahora

El DNS de hayahora publica una A por cada IPv4 bloqueada y una AAAA por cada
IPv6, con TTL de 30 s. Cuando una familia no tiene ninguna, la respuesta es
negativa (NXDOMAIN, o NOERROR sin registros) y **los resolvedores la guardan
30 minutos** (el mínimo del SOA de `dns.hayahora.futbol` es 1800 s), los dos a
la vez: el 10-10-2026 a las 18:07Z `dns.google` y `cloudflare-dns.com` daban el
AAAA vacío desde una caché de las 17:47Z mientras la lista traía 10 IPv6
bloqueadas, entre ellas las dos nuestras. Así que, por familia:

- con IPs en la respuesta (frescas: TTL de 30 s), ninguna puede ser nuestra
  (si no, `bloqueo_en_dns`) y, si la lista trae IPs de esa familia, alguna
  tiene que estar también en el DNS;
- sin IPs, la lista tampoco puede traer ninguna de esa familia, y la respuesta
  negativa tiene que haber entrado en la caché **después** de que nuestras IPs
  de esa familia salieran de la lista (menos un ciclo). Cuándo entró se saca
  del SOA que la acompaña: hace como mucho (1800 − TTL que le queda) segundos.
  Nuestras IPv6 suelen salir de la lista unos minutos antes que las IPv4, por
  eso se apunta por familia (`familiaLimpiaDesde`).

Si no se cumple, `confirmacion_dns_desfasada`: no enciende y vuelve a
preguntar en la siguiente ejecución. Repitiendo los 60 días del historial con
la caché negativa más desfavorable (alguien más consulta sin parar), enciende
igual que sin esta comprobación (mediana 12 min tras el fin del bloqueo).

**Si el DNS de hayahora deja de publicar las AAAA** mientras la lista trae
IPv6 (lo de las 18:07Z del 10-10-2026; a las 19:55Z ya las publicaba), el IPv6
no se puede confirmar y no enciende: sigue en `confirmacion_dns_desfasada`
hasta que el DNS vuelve a publicarlas o hasta que salen de la lista todas las
IPv6, y aun entonces la respuesta negativa tiene que haber entrado en la caché
después de que salieran las nuestras (depende de cuándo la renueve). En la
simulación del final del bloqueo del 10-10, enciende hasta 42 minutos después
del fin en vez de 12 (entre 12 y 28 si las IPv6 salen todas a la vez, según la
fase de la caché), y a los 10 minutos sale como error aunque la web siga
servida por Vercel. Se deja así a propósito: encender con solo la lista
para el IPv6 quitaría la segunda opinión justo en la familia que no se puede
comprobar, y esperar solo cuesta más rato sin la caché ni el WAF de
Cloudflare.

### Cuándo un aviso pasa a error

Cuando el conmutador no puede decidir (lista inválida, sin IPs de Cloudflare
conocidas, sin IPs de Vercel en pleno bloqueo, DNS de hayahora sin responder,
desfasado o viendo nuestras IPs justo cuando tocaría encender, un registro sin
`modified_on`, o un registro que falta o no va a Vercel), apunta desde cuándo
en KV (`observacion.inoperativoDesde`). Las primeras ejecuciones salen como
`aviso`; a los **10 minutos** pasan a `error`: la línea va por `console.error`
y la invocación falla en las métricas del Worker. La cuenta solo se borra con
**dos ejecuciones buenas seguidas** (`observacion.operativoDesde`): una lista
que falla una vez de cada dos acaba en error igual. **Sin IPs
conocidas con una marca activa es error desde la primera ejecución**: sin ellas
el conmutador no volvería a encender nunca (pasa si falta la semilla de
`observacion`). Un resolvedor DoH que falla (también con HTTP 200 y `Status`
de error, como SERVFAIL) deja un aviso `sonda_doh_degradado:<resolvedor>` (o
`vercel_…`, `confirmacion_…`).

## Lo que conviene saber

- **hayahora solo vigila una lista fija de IPs** (4.252 en su `data.json` del
  10-10-2026, 64 de ellas IPv6). De las nuestras vigila `188.114.96.5`,
  `188.114.96.2`, `188.114.96.1`, sus tres `188.114.97.x`, `2a06:98c1:3120::5`
  y `2a06:98c1:3121::5`, que son las que importan (las que dan Google y
  Movistar). No vigila `2a06:98c1:312x::1` ni `::2`, que Google también da.
  **No** vigila la otra cara (`104.21.57.158`, `172.67.191.30`,
  `2606:4700:3032::6815:399e`, `2606:4700:3036::ac43:bf1e`) ni nuestras IPs de
  Vercel
  (`64.29.17.1`, `64.29.17.65`, `216.198.79.1`, `216.198.79.65`; de Vercel solo
  vigila `66.33.60.34`, `66.33.60.67`, `216.150.1.1` y `216.150.16.1`). Que no
  aparezcan en la lista no prueba que no estén bloqueadas. Conviene dar de alta
  `alhabla.ai` en el comprobador de dominios de hayahora para que las vigile.
- **Sin el proxy** se pierde lo que hace Cloudflare delante de las webs (WAF,
  caché, analítica). Las redirecciones 301 de `alhabla.ai` a `app.alhabla.ai`
  están en `web/next.config.mjs` (Vercel), así que siguen funcionando.
- **Propagación**: un registro proxied tiene TTL de 300 s, así que tras apagar
  los resolvedores tardan hasta 5 minutos en dar las IPs de Vercel. Apagado va
  con TTL 60 para que la vuelta sea rápida.
- **Si un humano lo enciende durante un bloqueo**, el conmutador limpia la marca
  y, pasados los 10 minutos de antirrebote, si el bloqueo sigue lo vuelve a
  apagar. Para que no lo haga, pon `MODO = "observar"` (ver «Desactivarlo»).
- **KV es eventualmente consistente** (hasta ~60 s entre ubicaciones) y el cron
  va cada 120 s. Por eso hay dos claves: `control` (la marca, con las IPs por
  las que se apagó, y la racha limpia; se escribe al apagar, encender, limpiar,
  cuando nuestras IPs de una familia entran o salen de la lista con la marca
  puesta o mientras avanza la racha) y `observacion` (IPs,
  `inoperativoDesde`/`operativoDesde` e informe para `/estado`; se escribe si
  algo cambia o cada 10 minutos; mientras sigue la misma cuenta de inoperativo
  y no se hace nada, el informe solo va con el latido, así que `/estado` puede
  ir hasta 10 minutos por detrás en el motivo y la lista). Una lectura atrasada
  solo retrasa una decisión, nunca borra la marca ni sus IPs.
- **Límites del plan gratuito**: una ejecución hace como mucho ~35
  subpeticiones (1 a hayahora, 1-3 páginas de la API, 12 DoH de sonda, 12 DoH
  de Vercel cuando hace falta, de un solo destino, 4 al DNS de hayahora antes
  de encender, hasta 3 PATCH; el límite es 50) y KV recibe del orden de
  150-200 escrituras al día (límite 1.000; en la repetición de 60 días, como
  mucho 164). En un estado de error que dure, como el DNS de hayahora viendo
  nuestras IPs sin parar, se escribe `control` en cada ejecución: unas 880 al
  día; si además la lista falla una ejecución de cada dos, unas 510 (`control`
  solo avanza en las válidas y la observación va con el latido). Lo que sí
  pasaría de 1.000 es una lista que metiera y sacara nuestras IPs en cada
  ejecución durante todo el día (unas 1.440: cada vez se rompe la racha y
  vuelve a empezar); en los 60 días del historial no se acerca. Al agotar la
  cuota fallan los `put` (`kv_guardar_*`) y, sin poder escribir la marca, no
  apaga. La sonda DoH va rotando entre los registros proxied (uno por
  ejecución). De CPU (10 ms por cron en el plan gratuito), lo más caro es
  encender con la confirmación, que lee la lista y las respuestas del DNS de
  hayahora: ~2,5 ms en frío con 886 IPs bloqueadas (el máximo a la vez del
  historial) y ~7 ms con las 4.248 que vigila hayahora, todas bloqueadas
  menos las nuestras. Las IPv4 ya canónicas se guardan tal cual con una regex
  (también las del DNS, sin ordenar), y solo los CIDR y rangos se analizan con
  BigInt.
- **`/estado` es público** en workers.dev salvo que pongas el secreto
  `ESTADO_TOKEN` (entonces exige `Authorization: Bearer <token>` y sin él
  responde 401 sin leer KV). En cualquier caso cada isolate guarda la respuesta
  60 s, para que una avalancha de visitas no se coma las 100.000 lecturas
  diarias de KV que necesita el cron. Para cerrarlo del todo, `workers_dev =
  false` en `wrangler.toml` y consulta el estado con `wrangler kv key get` y
  `wrangler tail`.

## Ficheros

```
wrangler.toml          # nombre, cron */2, KV ESTADO, vars, observability
package.json           # "type": "module" y `npm test` = `node --test`
src/conmutador.js      # lógica pura: IPs/CIDR, lista, decisión (sin fetch)
src/index.js           # E/S: scheduled + fetch (/estado), API, DoH, KV
pruebas/*.test.js      # node:test (lógica pura e index.js con fetch/KV falsos)
semillas/*.json        # estado inicial de KV para hoy
.dev.vars.example      # variables para `wrangler dev` (en modo observar)
```

Se sube tal cual (`no_bundle = true`): sin dependencias ni paso de build.

## Despliegue

**Desplegado el 11-10-2026** (por la API, con el conector de Cloudflare): namespace KV
`alhabla-failover-laliga-estado` (`a570046b50c6497280e6b53dde6a5dce`, ya en
`wrangler.toml`) sembrado con `semillas/`, cron cada 2 minutos, `/estado` en
`https://alhabla-failover-laliga.flat-flower-78e7.workers.dev/estado`, secreto
`CF_API_TOKEN` puesto desde el panel y `MODO = "activo"` desde las 09:20 UTC. Los pasos
de abajo sirven para rehacerlo desde cero.

Todo desde esta carpeta (`infra/cloudflare/failover-laliga`).

### 1. Namespace KV

```bash
npx wrangler kv namespace create alhabla-failover-laliga-estado
```

Copia el `id` que devuelve en `wrangler.toml` (`[[kv_namespaces]]`, en lugar del
que hay ahora).

### 2. Token de la API (solo DNS de alhabla.ai)

En el panel de Cloudflare: **Manage Account → Account API Tokens** (mejor que
uno personal, así no depende de un usuario) o **My Profile → API Tokens** →
**Create Token** → **Create Custom Token**:

- Nombre: `alhabla-failover-laliga`.
- Permissions: **Zone → DNS → Edit** (incluye leer). Nada más.
- Zone Resources: **Include → Specific zone → alhabla.ai**.
- Client IP Address Filtering: vacío (los Workers salen por IPs variables).
- TTL: sin caducidad, o con recordatorio para rotarlo.

Compruébalo (solo lectura). La ruta de verificación depende del tipo de token:

```bash
# Account API Token (Manage Account → Account API Tokens):
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/2c31c9f09f67b64273a1b41fa1765e42/tokens/verify
# Token personal (My Profile → API Tokens):
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.cloudflare.com/client/v4/user/tokens/verify
# Los dos: tiene que listar el CNAME.
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/252ecca77f844b46263852c7699a9421/dns_records?type=CNAME&name.exact=app.alhabla.ai"
```

### 3. Secreto

```bash
npx wrangler secret put CF_API_TOKEN
```

(pega el token cuando lo pida; nunca va en `wrangler.toml` ni en git).

Opcional, para que `/estado` no sea público:

```bash
npx wrangler secret put ESTADO_TOKEN   # una cadena larga aleatoria
```

### 4. Estado inicial de hoy (10-10-2026)

Hoy el proxy de los tres registros **se apagó a mano** por el bloqueo en curso.
Sin semilla, el conmutador lo vería como «apagado por un humano» y no lo
volvería a encender nunca. Hay que sembrar dos claves para que lo trate como
suyo y lo encienda él al acabar el bloqueo:

- `control` (`semillas/control.json`): la marca de los tres registros con
  `apagadoEn = 2026-10-10T17:00:00.000Z`, sin confirmar. La primera ejecución
  que los vea en DNS-only la confirma con su `modified_on`. `apagadoEn` solo
  cuenta para los 15 minutos de espera: pon la hora real (UTC) del apagado si
  la sabes; una anterior también vale, y una posterior solo retrasa el
  encendido.
- `observacion` (`semillas/observacion.json`): las IPs de Cloudflare que daban
  los resolvedores con el proxy encendido (las dos caras: `188.114.96.5`, `.2`
  y `.1`, lo mismo en `188.114.97.x`, `2a06:98c1:3120::5`, `::2` y `::1`, lo
  mismo en `2a06:98c1:3121::`, `104.21.57.158`, `172.67.191.30`,
  `2606:4700:3032::6815:399e`, `2606:4700:3036::ac43:bf1e`) y las de Vercel.
  Con el proxy apagado el Worker no puede verlas por DoH; sin esta semilla
  diría `sin_ips_conocidas` (error, porque hay marca) y no encendería.

**Siembra antes del primer `wrangler deploy`** y comprueba con
`wrangler kv key get` que están: una ejecución que lea `observacion` vacía la
reescribe entera sin IPs y pisaría una semilla puesta a la vez.

**Siembra solo si los tres registros siguen en DNS-only** (míralo en el panel
justo antes). Si alguien ya volvió a encender alguno, no siembres su marca: el
conmutador la soltaría (`encendido_a_mano`) y, con el bloqueo en curso, al
pasar los 10 minutos de antirrebote desde ese encendido lo apagaría como
cualquier otro registro encendido sin marca.

```bash
NS=<id del namespace>
npx wrangler kv key put control --path semillas/control.json --namespace-id "$NS" --remote
npx wrangler kv key put observacion --path semillas/observacion.json --namespace-id "$NS" --remote
npx wrangler kv key get control --namespace-id "$NS" --remote       # comprobar
npx wrangler kv key get observacion --namespace-id "$NS" --remote   # comprobar
```

### 5. Desplegar

```bash
npx wrangler deploy
```

Si prefieres verlo decidir antes de dejarle tocar el DNS, despliega primero en
modo observar sin tocar `wrangler.toml` (decide y lo registra, sin PATCH ni
cambios en la marca) y, cuando las líneas de `wrangler tail` cuadren, despliega
normal:

```bash
npx wrangler deploy --var MODO:observar
npx wrangler tail alhabla-failover-laliga --format pretty   # unas ejecuciones
npx wrangler deploy                                         # ya en activo
```

Mientras esté en observar no encenderá el proxy de hoy al acabar el bloqueo.

## Probarlo

```bash
node --test          # o npm test; sin dependencias
```

En local, contra la API **real** (cuidado: `wrangler dev` usa el token de
`.dev.vars`), siempre en modo observar:

```bash
cp .dev.vars.example .dev.vars    # pon el token y deja MODO=observar
npx wrangler dev --test-scheduled
curl "http://localhost:8787/__scheduled?cron=*/2+*+*+*+*"   # una ejecución
curl http://localhost:8787/estado
```

En producción:

```bash
npx wrangler tail alhabla-failover-laliga --format pretty
curl https://alhabla-failover-laliga.<subdominio>.workers.dev/estado
# con ESTADO_TOKEN:
curl -H "Authorization: Bearer $ESTADO_TOKEN" https://alhabla-failover-laliga.<subdominio>.workers.dev/estado
```

`/estado` solo lee KV (nunca llama a la API ni a hayahora) y devuelve las IPs
conocidas, las bloqueadas que nos afectan, `proxied` de cada registro, la marca
del conmutador, el último cambio, la racha limpia (`ejecucionesLimpiasSeguidas`
y `limpioDesde`) y `inoperativoDesde`. Muestra el último informe guardado, que
como mucho tiene 10 minutos salvo que algo cambie, más hasta 60 s de la caché
del isolate (`generadoEn`). Cualquier otra ruta da 404.

Cada ejecución deja una línea así (con `console.error` si algo falló, y la
invocación sale como error en las métricas):

```json
{"servicio":"alhabla-failover-laliga","evento":"ciclo","nivel":"info","en":"2026-10-10T18:00:00.000Z","modo":"activo","accion":"apagar","motivo":"bloqueo_detectado","estadoProxy":"encendido","bloqueadasNuestras":["188.114.96.5","188.114.97.5"],"vercelBloqueadas":[],"cambios":[{"nombre":"alhabla.ai","cuerpo":{"proxied":false,"ttl":60},"ok":true}],"limpiasSeguidas":0,"errores":[],"avisos":[]}
```

Motivos posibles: `bloqueo_detectado`, `reintento_de_apagado`,
`fin_del_bloqueo`, `sin_bloqueo`, `sigue_bloqueado`,
`esperando_ejecuciones_limpias`, `esperando_tiempo_limpio`,
`esperando_tiempo_minimo`, `bloqueo_en_dns`, `confirmacion_dns_fallida`,
`confirmacion_dns_desfasada`, `antirrebote`, `vercel_tambien_bloqueado`,
`sin_ips_de_vercel`, `apagado_a_mano`, `encendido_a_mano`,
`modificado_a_mano`, `apagado_no_aplicado`, `sin_fecha_de_modificacion`,
`lista_invalida` (con `lista.motivo`: `error_de_red`, `http_<código>`,
`tipo_de_contenido_inesperado`, `no_parece_una_lista`, `sin_ips`,
`formato_desconocido`, `lista_truncada`, `lista_incompleta`, `lista_sin_fecha`,
`lista_con_fecha_futura`, `lista_antigua`, `demasiado_grande`),
`sin_ips_conocidas`, `registros_incompletos`, `destino_no_vercel`,
`destinos_distintos`, `configuracion_invalida`, `kv_ilegible`, `api_ilegible`
(varios se unen con `+` si cada registro tiene uno distinto).

## Desactivarlo

- **Pausar sin perder nada**: `MODO = "observar"` en `wrangler.toml` y
  `npx wrangler deploy` (o, de un solo despliegue,
  `npx wrangler deploy --var MODO:observar`). Sigue decidiendo y
  registrándolo, sin un solo PATCH.
- **Parar el cron**: `crons = []` en `wrangler.toml` y `npx wrangler deploy`.
- **Ojo con el panel**: cambiar la variable o borrar el trigger desde el panel
  de Cloudflare funciona, pero el siguiente `wrangler deploy` vuelve a poner lo
  que diga `wrangler.toml` (`keep_vars` es `false` por defecto) y el Worker
  vuelve a `MODO = "activo"` sin avisar. El cambio que deba durar, en
  `wrangler.toml`.
- **Quitarlo del todo**: `npx wrangler delete alhabla-failover-laliga`, borrar
  el namespace (`npx wrangler kv namespace delete --namespace-id <id>`) y
  revocar el token.
- **Después de pararlo, mira `/estado` (o el panel de DNS)**: si la marca dice
  que el conmutador dejó registros apagados, enciéndelos a mano (DNS → Records
  → cada uno de los tres → Proxy status: Proxied).
- **Para que no vuelva a encender lo que tiene marcado**, borra la marca:
  `npx wrangler kv key delete control --namespace-id <id> --remote`. Sin marca,
  lo apagado se queda apagado.

## Encender o apagar a mano

- Apagar a mano (sin tocar KV): el conmutador lo respeta y no lo enciende nunca.
  Si quieres que lo encienda él cuando acabe el bloqueo, siembra `control` como
  en el paso 4.
- Encender a mano algo que apagó el conmutador: limpia su marca en la siguiente
  ejecución. Si el bloqueo sigue, a los 10 minutos lo volverá a apagar; para
  evitarlo, modo observar.
- Encenderlo y volver a apagarlo a mano (o tocar el registro de cualquier otra
  forma mientras está apagado): el conmutador ve un `modified_on` distinto del
  de su PATCH, suelta la marca (`modificado_a_mano`) y ya no lo enciende solo.
