#!/bin/bash
# Lo lanza launchd (KeepAlive), desde ~/.alhabla-mcp, para cada pieza del
# entorno de desarrollo fijo (scripts/dev/entorno.sh):
#
#   scripts/dev/servir.sh app     # la app, next dev en :3001
#   scripts/dev/servir.sh web     # la web pública, next dev en :3002
#   scripts/dev/servir.sh panel   # el panel de desarrollo en :3005
#
# La app y la web esperan mientras entorno.sh pone la carpeta en otra rama
# (cerrojo) o el entorno está parado, y la app arranca con la rama que se
# enseña (franja DEV). El panel no espera: sale de las herramientas, no de la
# carpeta que se enseña, y desde él se vuelve a arrancar lo demás. Si un
# proceso cae, launchd lo vuelve a lanzar.
set -u

DIR="${ALHABLA_DEV_DIR:-$HOME/.alhabla-dev}"
HERRAMIENTAS="${ALHABLA_HERRAMIENTAS_DIR:-$HOME/.alhabla-mcp}"
ESTADO="$HOME/Library/Caches/alhabla-dev"
pieza=${1:-}

if [ "$pieza" = "panel" ]; then
  cd "$HERRAMIENTAS/backend" || exit 1
  export ALHABLA_DEV_DIR="$DIR"
  exec node_modules/.bin/tsx mcp/panel/servidorPanel.ts
fi

while [ -e "$ESTADO/actualizando" ] || [ -e "$ESTADO/parado" ]; do
  sleep 5
done

case "$pieza" in
  app)
    cd "$DIR/frontend" || exit 1
    export NEXT_PUBLIC_DEV_RAMA
    NEXT_PUBLIC_DEV_RAMA=$(cat "$ESTADO/rama" 2>/dev/null || echo main)
    export NEXT_PUBLIC_DEV_COMMIT
    NEXT_PUBLIC_DEV_COMMIT=$(git -C "$DIR" rev-parse --short HEAD 2>/dev/null || echo "?")
    export NEXT_PUBLIC_DEV_PANEL_URL="http://localhost:3005"
    exec npx next dev -p 3001
    ;;
  web)
    cd "$DIR/web" || exit 1
    exec npx next dev -p 3002
    ;;
  *)
    echo "Uso: $0 app|web|panel" >&2
    exit 1
    ;;
esac
