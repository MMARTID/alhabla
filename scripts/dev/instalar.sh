#!/bin/bash
# Instala en el Mac el entorno de desarrollo fijo (scripts/dev/entorno.sh):
#
#   scripts/dev/instalar.sh          # instalar (y arrancarlo ya)
#   scripts/dev/instalar.sh quitar   # quitar el arranque automático
#
# 1. Crea las dos carpetas fijas si no existen: ~/.alhabla-dev (lo que se
#    enseña) y ~/.alhabla-mcp (las herramientas), worktrees de este repo.
# 2. Escribe cuatro LaunchAgents en ~/Library/LaunchAgents:
#    - ai.alhabla.dev.arranque: al iniciar sesión, entorno.sh arrancar
#      (Docker oculto, main al día, backend, migraciones y el navegador).
#    - ai.alhabla.dev.app / .web / .panel: next dev :3001, :3002 y el panel
#      :3005, que launchd mantiene vivos.
# 3. Le dice a Docker Desktop que no abra su ventana al arrancar.
# 4. Los carga, así que el entorno arranca en el momento.
#
# Hay que lanzarlo desde un checkout que ya tenga scripts/dev (main). Para
# probar una rama de estos scripts antes de fusionarla: un worktree de esa
# rama como herramientas y ALHABLA_HERRAMIENTAS_FIJAS=1 (no lo pasa a main):
#   ALHABLA_HERRAMIENTAS_DIR=~/.alhabla-herramientas-prueba \
#   ALHABLA_HERRAMIENTAS_FIJAS=1 scripts/dev/instalar.sh
set -euo pipefail

DIR="${ALHABLA_DEV_DIR:-$HOME/.alhabla-dev}"
HERRAMIENTAS="${ALHABLA_HERRAMIENTAS_DIR:-$HOME/.alhabla-mcp}"
AGENTES="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs/alhabla-dev"
ESTADO="$HOME/Library/Caches/alhabla-dev"
PIEZAS="arranque app web panel"
USUARIO="gui/$(id -u)"

quitar_agentes() {
  local pieza
  for pieza in $PIEZAS; do
    launchctl bootout "$USUARIO/ai.alhabla.dev.$pieza" >/dev/null 2>&1 || true
  done
}

if [ "${1:-}" = "quitar" ]; then
  quitar_agentes
  for pieza in $PIEZAS; do rm -f "$AGENTES/ai.alhabla.dev.$pieza.plist"; done
  echo "Quitado el arranque automático. Las carpetas $DIR y $HERRAMIENTAS se quedan."
  exit 0
fi

PRINCIPAL=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
mkdir -p "$AGENTES" "$LOGS" "$ESTADO"

git -C "$PRINCIPAL" fetch -q origin
if [ ! -e "$HERRAMIENTAS/.git" ]; then
  echo "Creando $HERRAMIENTAS (herramientas, siempre en main)..."
  git -C "$PRINCIPAL" worktree add -q --detach "$HERRAMIENTAS" origin/main
  (cd "$HERRAMIENTAS/backend" && npm ci --no-audit --no-fund)
fi
if [ ! -e "$DIR/.git" ]; then
  echo "Creando $DIR (lo que se enseña en dev)..."
  git -C "$PRINCIPAL" worktree add -q --detach "$DIR" "${ALHABLA_DEV_REF:-origin/main}"
  echo main > "$ESTADO/rama"
fi
if [ ! -e "$HERRAMIENTAS/scripts/dev/entorno.sh" ]; then
  echo "$HERRAMIENTAS no tiene scripts/dev todavía: ponlo en un main que los tenga." >&2
  exit 1
fi

# launchd no lee el perfil de la shell: el PATH va en cada agente.
camino="/usr/bin:/bin:/usr/sbin:/sbin"
for herramienta in node npm docker gh gcloud git curl; do
  ruta=$(command -v "$herramienta" || true)
  [ -n "$ruta" ] || { echo "Falta $herramienta en el PATH" >&2; exit 1; }
  carpeta=$(dirname "$ruta")
  case ":$camino:" in *":$carpeta:"*) ;; *) camino="$carpeta:$camino" ;; esac
done

escribir_agente() {
  local pieza=$1 script=$2 argumento=$3 mantener=$4
  cat > "$AGENTES/ai.alhabla.dev.$pieza.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>ai.alhabla.dev.$pieza</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$HERRAMIENTAS/scripts/dev/$script</string>
    <string>$argumento</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$camino</string>
    <key>ALHABLA_DEV_DIR</key><string>$DIR</string>
    <key>ALHABLA_HERRAMIENTAS_DIR</key><string>$HERRAMIENTAS</string>
    <key>ALHABLA_HERRAMIENTAS_FIJAS</key><string>${ALHABLA_HERRAMIENTAS_FIJAS:-}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><$mantener/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOGS/$pieza.log</string>
  <key>StandardErrorPath</key><string>$LOGS/$pieza.log</string>
</dict>
</plist>
PLIST
  plutil -lint -s "$AGENTES/ai.alhabla.dev.$pieza.plist"
}

escribir_agente arranque entorno.sh arrancar false
escribir_agente app servir.sh app true
escribir_agente web servir.sh web true
escribir_agente panel servir.sh panel true

# Docker Desktop: que no abra su ventana al arrancar (el arranque lo abre
# además oculto, con open -j, por si Docker reescribe este ajuste).
AJUSTES_DOCKER="$HOME/Library/Group Containers/group.com.docker/settings-store.json"
if [ -f "$AJUSTES_DOCKER" ]; then
  /usr/bin/python3 - "$AJUSTES_DOCKER" <<'PY'
import json, sys
ruta = sys.argv[1]
ajustes = json.load(open(ruta))
ajustes["OpenUIOnStartupDisabled"] = True
json.dump(ajustes, open(ruta, "w"), indent=2)
PY
fi

quitar_agentes
for pieza in $PIEZAS; do
  launchctl bootstrap "$USUARIO" "$AGENTES/ai.alhabla.dev.$pieza.plist"
done

echo "Instalado. Arrancando el entorno: sigue el log en $LOGS/entorno.log"
echo "  App:   http://localhost:3001"
echo "  Web:   http://localhost:3002"
echo "  Panel: http://localhost:3005"
