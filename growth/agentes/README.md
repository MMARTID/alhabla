# Agentes de Alhabla Growth

Los prompts de los agentes de Growth, versionados. El diseño completo está en
`../../PLAN-GROWTH.md` (§ 3 módulos, § 4 flujo del run, § 9 fases). Aquí:
cómo preparar y lanzar un **run manual** (Fase 2b), qué mirar al terminar,
cómo medir lo que cuesta y lo que el sistema **no** hace.

| Qué | Dónde |
|---|---|
| El guion del run, con presupuestos duros y condiciones de parada | `orquestador.md` |
| Seis subagentes (herramientas restringidas, sin `Write`/`Edit`/`Bash`) | `../../.claude/agents/growth-*.md` |
| Reglas compartidas (contenido externo = dato, calidad, vocabulario, citable, sin envío, prohibidas) | `reglas/*.md` |
| El comando que lanza un run | `../../.claude/commands/growth-run.md` (`/growth-run`) |
| El hook que deniega reddit.com y redd.it | `../../.claude/settings.json` → `hooks/denegar-reddit.sh` |
| Comprobaciones sin red | `comprobar-agentes.sh`, `hooks/probar-denegar-reddit.sh` |

Los seis subagentes: `growth-descubrimiento`, `growth-calificacion`,
`growth-investigacion`, `growth-redaccion`, `growth-cumplimiento` y
`growth-enlaces-y-competencia`. «Knowledge» no es un subagente (lo hace el
sincronizador determinista) y «SEO & GEO» llega con la Fase 4.

## Antes del primer run

1. **Backend de destino.** Para el primer run, el de desarrollo: el backend de
   dev (`~/.alhabla-dev`, `:3000`) con la migración `20261030150000_growth_competencia`
   aplicada y las rutas de Competencia (`ver_en_dev` con la rama o `main`). Para
   producción hacen falta la migración y el código ya desplegados (`estado_prod`).
2. **Un token de agente** (se imprime una sola vez, por la salida estándar):

   ```bash
   cd backend
   npm run growth:token -- crear --nombre agente-manual --alcances leer,escribir
   # solo si vas a sincronizar tú el conocimiento desde el MCP (no es lo recomendado):
   # npm run growth:token -- crear --nombre conocimiento --alcances conocimiento
   ```

   Contra producción: `--entorno prod` con `DATABASE_URL` del proxy de Cloud SQL
   (ver `AGENTS.md` § Alhabla Growth). No pegues el token en el chat ni en un fichero.
3. **Guárdalo en el llavero de macOS**, sin el valor en la línea de órdenes (la
   cuenta del llavero es el host al que habla el MCP):

   ```bash
   security add-generic-password -s alhabla-growth -a localhost -U -w        # backend de dev
   security add-generic-password -s alhabla-growth -a api.alhabla.ai -U -w   # producción
   ```

   Pide el valor por el terminal. Para el backend de dev, abre Claude Code con
   `GROWTH_API_URL=http://localhost:3000` en el entorno; sin esa variable el MCP
   habla con `https://api.alhabla.ai` (el MCP solo admite esos dos destinos).
4. **El conocimiento al día.** El token del run no lleva el alcance
   `conocimiento`. Antes del primer run, sincroniza con la orden de administrador:
   `cd backend && npm run growth:conocimiento -- --dry-run` y después
   `--aplicar [--entorno dev|prod]`. (Los prompts de `reglas/` entran en esa
   sincronización: commitéalos antes.)
5. **Comprueba el sistema** abriendo Claude Code en la raíz del repo (rama `main`
   al día) y lanzando `/growth-run comprobar`: llama a `estado_growth` y a
   `leer_contexto` sin abrir ejecución ni leer la web. Debe decir
   `listoParaTrabajar: true`. Si no, trae el problema y su arreglo.
6. **Anota la línea base de uso** (ver «Cuánto cuesta» más abajo).

## Lanzar un run

En una sesión nueva de Claude Code en la raíz del repo:

```
/growth-run                 # run completo
/growth-run ligero          # la mitad de todos los topes
/growth-run competencia     # solo analizar los competidores pendientes
/growth-run comprobar       # solo comprobar que todo está listo
```

Para el primer run, la secuencia prudente es: `comprobar` → `competencia ligero`
(es lo más barato y lo que has pedido) → `ligero` → run completo, midiendo el
consumo en cada uno. La primera vez Claude Code te pedirá permiso para
`WebSearch`/`WebFetch` (por dominio): es el «Run now» del plan para fijar permisos.
Si un subagente pide permiso para una herramienta de `alhabla-growth`, elige
«siempre permitir» solo para esas.

El run **no toca nada fuera de Growth**: cada subagente solo escribe con
`mcp__alhabla-growth__*`, sin `Write`/`Edit`/`Bash`, sin navegadores y sin
herramientas de envío. Si ves que un subagente dice que le falta `WebFetch`, es
que corrió en segundo plano o falta un permiso: el orquestador cierra el run como
`parcial`.

## Qué mirar al terminar

El orquestador te deja un informe de 15 líneas. Después, en el panel
(`growth.alhabla.ai`, o `localhost:3003` contra dev):

| Dónde | Qué decides |
|---|---|
| **Bandeja** | Las oportunidades calificadas por puntuación; la insignia «Menciona a X» y el filtro por competidor mencionado |
| **Revisión** (una oportunidad) | Investigación, borrador, reglas duras y avisos del backend, y la revisión del modelo (`growth-cumplimiento`): aprobar, aprobar con ediciones, devolver con nota o descartar. **Enviar lo haces tú a mano** |
| **Borradores** | Los `bloqueados` y por qué (una regla dura falló) |
| **Competencia** | `propuestos` por el agente: **Aceptar** o **Rechazar**. `analizados`: lee el resumen y los datos con su fuente y fecha, y **Marcar como revisado** o **Volver a analizar**. El análisis es información interna: no entra en ningún borrador |
| **Ejecuciones** | Cómo fue cada módulo, los descartes por motivo (para calibrar los umbrales dos semanas), la versión de los prompts y lo que declaró el agente frente a lo que midió el servidor |

Qué es normal: cero oportunidades en una semana flojo; descartes por `bajo_umbral`
(el servidor los aplica); algún borrador bloqueado por una regla dura (es
información, no un fallo). Qué no lo es: un borrador que nombra a un competidor,
un dato de competidor sin fuente, un correo o un teléfono en una ficha. Si lo
ves, es un fallo de prompt: abre un PR.

## Cuánto cuesta (medir antes y después)

El presupuesto provisional es **no más del 10 % del límite semanal** de Claude
Max, compartido con tu uso interactivo. Es una propuesta sin medir.

1. Antes del run, con la sesión cerrada y sin hacer nada más en Claude, apunta en
   `claude.ai/settings/usage` el % de la sesión de 5 horas y el % semanal.
2. Lanza el run. No uses Claude para otra cosa mientras dure.
3. Al terminar, vuelve a mirar los dos porcentajes. La diferencia es el coste de
   ese run. Apunta: argumentos (`ligero`, completo…), % semanal antes y después,
   número de subagentes y de páginas leídas (están en el informe).
4. Si el run completo pasa del 10 %: baja los topes de la tabla de
   `orquestador.md` (o usa `ligero`), o el `maxTurns`/`model` de los subagentes
   (`.claude/agents/growth-*.md`), con un PR. Registra el cambio en
   `docs/growth/registro-de-decisiones.md`.
5. No actives los créditos de uso de Claude para esto, o ponles tope.

El % semanal tiene poca resolución para un run pequeño (repite `ligero` varias
veces si no se mueve): el primer run real (`competencia ligero`, 2 competidores)
no movió el semanal del 42 %.

### Modelo de cada agente

Todos los subagentes fijan su modelo y su esfuerzo en el `.claude/agents/growth-*.md`
(ninguno hereda el de tu sesión, para que el gasto no dependa de cómo abras Claude):

| Subagente | Modelo | Esfuerzo | Por qué |
|---|---|---|---|
| `growth-descubrimiento` | `sonnet` | medio | Lee mucha web ajena y decide qué es relevante; un modelo más flojo aumenta el riesgo de inyección |
| `growth-calificacion` | `sonnet` | medio | El de más volumen (una llamada por oportunidad). Candidato a `haiku` cuando los umbrales estén calibrados y se puedan comparar descartes |
| `growth-investigacion` | `sonnet` | medio | Extrae hechos verificables y no debe capturar correos ni teléfonos |
| `growth-redaccion` | `opus` | alto | Es el texto que apruebas; pocas llamadas por run, así que el coste es bajo |
| `growth-cumplimiento` | `sonnet` | medio | Segunda opinión independiente del redactor; no necesita el modelo más caro |
| `growth-enlaces-y-competencia` | `sonnet` | medio | Precisión de cada dato con su fuente; subir a esfuerzo alto si el análisis sale flojo |

El orquestador es la sesión (o la tarea programada): `sonnet` basta, porque solo
coordina y aplica topes. Cualquier cambio de modelo se mide con el procedimiento de
arriba y se registra en `docs/growth/registro-de-decisiones.md`.

## Qué NO hace el sistema

- **No contacta con nadie**: no envía correos ni mensajes, no rellena
  formularios, no da de alta fichas, no publica, no comenta, no se registra en
  ninguna web, no pide demos. Tú copias el texto aprobado y lo envías.
- **No aprueba nada ni marca nada como gestionado**: ni el MCP ni el token tienen
  ese poder.
- **No acepta competidores**: propone; aceptar o rechazar es tuyo.
- **No cita la competencia**: el análisis de un competidor es información
  interna y la regla dura 3 bloquea cualquier borrador que lo nombre sin una
  comparativa publicada de `comparativas.ts`.
- **No lee ni busca en Reddit** (decisión del 2026-10-30; el hook lo deniega).
- **No llama a ninguna API de modelos desde el backend**: el razonamiento es de tu
  suscripción.
- **No mide la autoridad de un dominio ni el perfil de enlaces completo de un
  competidor**: sin herramienta de pago, «dónde se menciona» es aproximado.
- **No asegura que los precios de un competidor sean los de hoy**: lleva la fecha
  de lectura y caduca a los 90 días.
- **No es una Scheduled Task todavía** (Fase 3): se lanza a mano.

## El hook de Reddit

`.claude/settings.json` tiene un hook `PreToolUse` que ejecuta
`hooks/denegar-reddit.sh` antes de `WebFetch`, `WebSearch` y de cualquier
`web_fetch`/`web_search` de un servidor MCP. Si la llamada nombra `reddit.com` o
`redd.it` (cualquier subdominio, también a través de un proxy o un archivo web) sale
con el código 2 y el mensaje en español. Como está en el `settings.json` del
**proyecto**, vale para **todas** las sesiones de Claude Code en este repo, no solo
para el run. Si necesitas ver un hilo de Reddit, ábrelo tú en el navegador. Los
navegadores (Chrome, Playwright) no pasan por este hook: están fuera del run por
no tener los subagentes esas herramientas.

```bash
growth/agentes/hooks/probar-denegar-reddit.sh   # 22 casos, sin red
growth/agentes/comprobar-agentes.sh             # los subagentes solo citan herramientas que existen
```

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| `estado_growth` dice que el token no vale o falta | Crea el token y guárdalo en el llavero (arriba). Comprueba el host (`localhost` frente a `api.alhabla.ai`) |
| `listoParaTrabajar: false` por «va N commits por detrás de main» | Actualiza la copia (la orden viene en el mensaje) y vuelve a lanzar: los prompts podrían estar atrasados |
| 409 `pausa` | Growth está en pausa (Ajustes). Quítala cuando quieras que escriba |
| 403 en `sincronizar_conocimiento` | El token del run no lleva `conocimiento`: sincroniza tú con `npm run growth:conocimiento -- --aplicar` |
| 400 `competidor_desconocido` al crear una oportunidad | El dominio de `competidoresMencionados` no es un competidor confirmado (o sigue `propuesto`). Acéptalo en Competencia |
| 409 `competidor_propuesto` o `analisis_reciente` al guardar un análisis | Esperado: acepta el propuesto primero, o pulsa «Volver a analizar». No se reintenta |
| En Ejecuciones, los recuentos del servidor salen a 0 aunque hay oportunidades nuevas | Los subagentes no están compartiendo la conexión MCP de la sesión (el MCP enlaza solo la ejecución abierta). Para el run: no es normal y hay que revisar cómo se lanzan los subagentes |
| Un subagente se queda sin una herramienta | Revisa `tools` en su fichero y `comprobar-agentes.sh`; si el MCP cambió, actualiza el fichero |

## Cambiar un prompt

Es un PR. Después de tocar `.claude/agents/growth-*.md`, `.claude/commands/`,
`orquestador.md`, `reglas/*.md` o el MCP: `growth/agentes/comprobar-agentes.sh` y
`growth/agentes/hooks/probar-denegar-reddit.sh`. Si cambias
`reglas/afirmaciones-prohibidas.md`, lee su cabecera: endurecer lo aplica la
siguiente sincronización; debilitar lo hace un administrador. La versión de los
prompts de cada run (el commit) queda en Ejecuciones.
