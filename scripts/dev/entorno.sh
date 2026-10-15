#!/bin/bash
# Entorno de desarrollo FIJO de Alhabla. Dos carpetas aparte, worktrees que
# ninguna sesión edita:
#
# - ~/.alhabla-dev: el código que se ENSEÑA. De ella salen el backend de dev
#   (Docker, :3000), la app (:3001) y la web (:3002). Por defecto el último
#   main; para ver una rama antes de fusionarla se pone en ella y se vuelve.
# - ~/.alhabla-mcp: las HERRAMIENTAS, siempre en main: el MCP alhabla-dev,
#   este script y el panel de desarrollo (:3005). Así funcionan aunque la
#   rama que se enseña sea anterior a ellos.
#
#   scripts/dev/entorno.sh arrancar      # al iniciar sesión (LaunchAgent)
#   scripts/dev/entorno.sh ver <rama>    # rama de origin, «main» o nº de PR
#   scripts/dev/entorno.sh estado
#   scripts/dev/entorno.sh parar
#
# Lo instala scripts/dev/instalar.sh. Todo va al log
# ~/Library/Logs/alhabla-dev/entorno.log.
#
# El cuerpo va dentro de main() y se llama al final: al arrancar se actualiza
# la carpeta de la que se lee este fichero, y bash lee los scripts sobre la
# marcha; así ya está entero en memoria antes de tocar nada.

main() {
set -uo pipefail

DIR="${ALHABLA_DEV_DIR:-$HOME/.alhabla-dev}"
HERRAMIENTAS="${ALHABLA_HERRAMIENTAS_DIR:-$HOME/.alhabla-mcp}"
ESTADO="$HOME/Library/Caches/alhabla-dev"
CERROJO="$ESTADO/actualizando"
PARADO="$ESTADO/parado"
LOGS="$HOME/Library/Logs/alhabla-dev"
URL_APP="http://localhost:3001"
mkdir -p "$ESTADO" "$LOGS"

registro() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOGS/entorno.log" >&2; }

if [ ! -e "$DIR/.git" ]; then
  registro "No existe $DIR: instala antes con scripts/dev/instalar.sh"
  exit 1
fi
PRINCIPAL=$(dirname "$(git -C "$DIR" rev-parse --path-format=absolute --git-common-dir)")

compose() {
  local extra=()
  [ -f "$PRINCIPAL/docker-compose.override.yml" ] && extra=(-f "$PRINCIPAL/docker-compose.override.yml")
  # ${a[@]+...}: el bash 3.2 de macOS da «unbound variable» con una lista vacía.
  (cd "$DIR" && docker compose -p asistai -f docker-compose.yml ${extra[@]+"${extra[@]}"} "$@") 2>&1 \
    | grep -v "variable is not set" | tee -a "$LOGS/entorno.log" >&2
  return "${PIPESTATUS[0]}"
}

# Los ficheros con secretos viven solo en el checkout principal (.gitignore).
enlazar_secretos() {
  local f
  for f in .env frontend/.env.local web/.env.local; do
    if [ -e "$PRINCIPAL/$f" ] && [ ! -e "$DIR/$f" ]; then
      ln -s "$PRINCIPAL/$f" "$DIR/$f"
    fi
  done
}

esperar_docker() {
  if docker info >/dev/null 2>&1; then return 0; fi
  registro "Abriendo Docker Desktop (oculto)..."
  # -g: sin traerlo al frente; -j: oculto, sin ventana.
  open -g -j -a Docker
  local i
  for i in $(seq 1 90); do
    docker info >/dev/null 2>&1 && return 0
    sleep 2
  done
  registro "Docker no responde tras 3 minutos"
  return 1
}

# En Chrome (preferencia del dueño, 15-10); ALHABLA_DEV_NAVEGADOR lo cambia.
# Si ese navegador no está, el del sistema.
abrir_en_navegador() {
  open -a "${ALHABLA_DEV_NAVEGADOR:-Google Chrome}" "$1" 2>/dev/null || open "$1"
}

esperar_url() {
  local url=$1 intentos=${2:-60} i
  for i in $(seq 1 "$intentos"); do
    curl -sf -o /dev/null --max-time 3 "$url" && return 0
    sleep 3
  done
  return 1
}

hash_de() { git -C "$DIR" rev-parse "HEAD:$1" 2>/dev/null || echo "-"; }

# Pone la carpeta en `ref` (origin/main, origin/<rama>) y deja todo al día:
# dependencias de la app y la web si cambió su lock, el backend recreado si
# hace falta y las migraciones en la BD de dev. Mientras dura, el cerrojo
# hace esperar a la app, la web y el panel.
poner_en() {
  local ref=$1 rama=$2
  touch "$CERROJO"
  local antes_front antes_web antes_back antes_schema
  antes_front=$(hash_de frontend/package-lock.json)
  antes_web=$(hash_de web/package-lock.json)
  antes_back=$(hash_de backend/package-lock.json)
  antes_schema=$(hash_de backend/prisma/schema.prisma)

  if ! git -C "$DIR" checkout -q --detach "$ref"; then
    registro "No se pudo poner $DIR en $ref (¿cambios a mano en la carpeta fija?)"
    rm -f "$CERROJO"
    return 1
  fi
  echo "$rama" > "$ESTADO/rama"
  registro "Entorno de dev en $rama ($(git -C "$DIR" log -1 --format='%h %s'))"
  enlazar_secretos

  if [ "$antes_front" != "$(hash_de frontend/package-lock.json)" ] || [ ! -d "$DIR/frontend/node_modules" ]; then
    registro "Instalando dependencias de la app..."
    (cd "$DIR/frontend" && npm ci --no-audit --no-fund >>"$LOGS/entorno.log" 2>&1)
  fi
  if [ "$antes_web" != "$(hash_de web/package-lock.json)" ] || [ ! -d "$DIR/web/node_modules" ]; then
    registro "Instalando dependencias de la web..."
    (cd "$DIR/web" && npm ci --no-audit --no-fund >>"$LOGS/entorno.log" 2>&1)
  fi

  # El backend corre en Docker con las dependencias de su imagen: si cambia
  # su lock, se reconstruye la imagen y se renueva el volumen anónimo de
  # node_modules (si no, se reutilizaría el viejo). Si cambia el schema, se
  # recrea el contenedor, que hace prisma generate al arrancar. El resto del
  # código lo recoge solo tsx watch.
  local recrear=()
  if [ "$antes_back" != "$(hash_de backend/package-lock.json)" ]; then
    recrear=(--build --renew-anon-volumes)
  elif [ "$antes_schema" != "$(hash_de backend/prisma/schema.prisma)" ]; then
    recrear=(--force-recreate)
  fi
  compose --profile dev up -d ${recrear[@]+"${recrear[@]}"} postgres redis backend-dev cloudflared
  registro "Aplicando migraciones a la BD de dev..."
  docker exec alhabla_backend_dev npx prisma migrate deploy >>"$LOGS/entorno.log" 2>&1 \
    || registro "Las migraciones fallaron: mira $LOGS/entorno.log"

  rm -f "$CERROJO" "$PARADO"
  # La app lee la rama al arrancar (franja DEV): se reinician las tres.
  local servicio
  for servicio in app web panel; do
    launchctl kickstart -k "gui/$(id -u)/ai.alhabla.dev.$servicio" >/dev/null 2>&1 || true
  done
}

# Las herramientas (MCP, este script, el panel) siempre en el último main.
# ALHABLA_HERRAMIENTAS_FIJAS=1 las deja como están: para probar una rama de
# las herramientas antes de fusionarla (instalar.sh lo pasa a los agentes).
actualizar_herramientas() {
  [ -e "$HERRAMIENTAS/.git" ] || return 0
  [ "${ALHABLA_HERRAMIENTAS_FIJAS:-}" = "1" ] && return 0
  local antes
  antes=$(git -C "$HERRAMIENTAS" rev-parse HEAD:backend/package-lock.json 2>/dev/null)
  git -C "$HERRAMIENTAS" fetch -q origin 2>>"$LOGS/entorno.log" || return 0
  if ! git -C "$HERRAMIENTAS" checkout -q --detach origin/main 2>>"$LOGS/entorno.log"; then
    registro "No se pudo poner $HERRAMIENTAS en main"
    return 0
  fi
  if [ "$antes" != "$(git -C "$HERRAMIENTAS" rev-parse HEAD:backend/package-lock.json 2>/dev/null)" ]; then
    registro "Instalando dependencias de las herramientas..."
    (cd "$HERRAMIENTAS/backend" && npm ci --no-audit --no-fund >>"$LOGS/entorno.log" 2>&1)
  fi
}

resolver_rama() {
  local pedida=${1#\#}
  if [[ "$pedida" =~ ^[0-9]+$ ]]; then
    gh pr view "$pedida" --repo MMARTID/botbook --json headRefName -q .headRefName
  else
    echo "$pedida"
  fi
}

accion=${1:-estado}
case "$accion" in
  arrancar)
    registro "--- Arranque del entorno de desarrollo ---"
    esperar_docker || exit 1
    actualizar_herramientas
    if git -C "$DIR" fetch -q origin 2>>"$LOGS/entorno.log"; then
      poner_en origin/main main || exit 1
    else
      registro "Sin red para actualizar: se arranca lo que ya había"
      rm -f "$PARADO"
      enlazar_secretos
      compose --profile dev up -d postgres redis backend-dev cloudflared
    fi
    if esperar_url "$URL_APP" 80; then
      registro "Listo: $URL_APP"
      [ "${ALHABLA_DEV_SIN_NAVEGADOR:-}" = "1" ] || abrir_en_navegador "$URL_APP"
    else
      registro "La app no respondió; mira $LOGS/app.log"
    fi
    ;;
  ver)
    pedida=${2:-}
    [ -n "$pedida" ] || { echo "Uso: $0 ver <rama|main|nº de PR>" >&2; exit 1; }
    rama=$(resolver_rama "$pedida") || { registro "No encuentro el PR $pedida"; exit 1; }
    git -C "$DIR" fetch -q origin || { registro "No se pudo hacer fetch"; exit 1; }
    if ! git -C "$DIR" rev-parse -q --verify "origin/$rama" >/dev/null; then
      registro "La rama $rama no está en origin (¿falta el push?)"
      exit 1
    fi
    esperar_docker || exit 1
    poner_en "origin/$rama" "$rama" || exit 1
    esperar_url "$URL_APP" 80 && registro "Listo: $URL_APP enseña $rama"
    ;;
  estado)
    echo "Enseña:       $(cat "$ESTADO/rama" 2>/dev/null || echo '?') ($(git -C "$DIR" log -1 --format='%h %s'))"
    echo "Herramientas: $(git -C "$HERRAMIENTAS" log -1 --format='%h %s' 2>/dev/null || echo 'sin instalar')"
    for par in "backend|http://localhost:3000/health" "app|$URL_APP" "web|http://localhost:3002" "panel|http://localhost:3005/api/estado"; do
      nombre=${par%%|*}; url=${par#*|}
      if curl -sf -o /dev/null --max-time 3 "$url"; then echo "  $nombre: en marcha ($url)"; else echo "  $nombre: parado"; fi
    done
    ;;
  parar)
    # launchd los relanzaría: con esta marca, servir.sh se queda esperando.
    # El panel sigue: desde él se vuelve a arrancar.
    touch "$PARADO"
    for servicio in app web; do
      launchctl kill SIGTERM "gui/$(id -u)/ai.alhabla.dev.$servicio" >/dev/null 2>&1 || true
    done
    compose --profile dev stop backend-dev cloudflared
    registro "Entorno de desarrollo parado (Postgres y Redis siguen)"
    ;;
  *)
    echo "Uso: $0 [arrancar|ver <rama>|estado|parar]" >&2
    exit 1
    ;;
esac
}

main "$@"
exit $?
