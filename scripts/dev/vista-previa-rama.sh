#!/usr/bin/env bash
# La vista previa de un worktree elegido (app-rama :3111, web-rama :3112 en
# .claude/launch.json), sin editar launch.json. El worktree lo elige la
# herramienta vista_previa_rama del MCP alhabla-dev (backend/mcp/vistaPreviaRama.ts),
# que lo guarda en ~/Library/Caches/alhabla-dev/vista-previa-rama.
#
#   scripts/dev/vista-previa-rama.sh app   # frontend/ del worktree en :3111
#   scripts/dev/vista-previa-rama.sh web   # web/ del worktree en :3112
#
# Las dos van contra el backend fijo (:3000) y la BD de dev. Los .env.local
# no se copian al worktree (el de la app lleva claves): si el worktree no
# tiene el suyo, se cargan en el entorno del proceso desde el checkout
# principal, que es lo mismo que lee next dev.
set -euo pipefail

FICHERO="${ALHABLA_VISTA_PREVIA_RAMA:-$HOME/Library/Caches/alhabla-dev/vista-previa-rama}"

case "${1:-}" in
  app) CARPETA=frontend; PUERTO=3111 ;;
  web) CARPETA=web; PUERTO=3112 ;;
  *)
    echo "Uso: $0 app|web" >&2
    exit 2
    ;;
esac

if [ ! -s "$FICHERO" ]; then
  echo "[vista-previa-rama] No hay worktree elegido: usa vista_previa_rama del MCP alhabla-dev." >&2
  exit 1
fi
WORKTREE="$(head -n 1 "$FICHERO")"
DIR="$WORKTREE/$CARPETA"
if [ ! -f "$DIR/package.json" ]; then
  echo "[vista-previa-rama] $DIR no existe (¿se borró el worktree?): elige otro con vista_previa_rama." >&2
  exit 1
fi

PRINCIPAL="$(dirname "$(git -C "$WORKTREE" rev-parse --path-format=absolute --git-common-dir)")"
if [ ! -f "$DIR/.env.local" ] && [ -f "$PRINCIPAL/$CARPETA/.env.local" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$PRINCIPAL/$CARPETA/.env.local"
  set +a
fi

cd "$DIR"
if [ ! -d node_modules/next ]; then
  echo "[vista-previa-rama] Instalando las dependencias de $CARPETA en $WORKTREE..." >&2
  npm ci --no-audit --no-fund --loglevel=error >&2
fi
echo "[vista-previa-rama] $CARPETA de $WORKTREE ($(git rev-parse --abbrev-ref HEAD)) en :$PUERTO" >&2
exec npx next dev -p "$PUERTO"
