#!/bin/sh
# Arranque de los MCP del repo (lo lanza Claude Code desde .mcp.json).
#
# Sin argumentos arranca alhabla-dev (mcp/servidorDev.ts). Con un argumento,
# el servidor de esa ruta bajo mcp/ sin extensión: `arrancar.sh
# growth/servidorGrowth` lanza alhabla-growth. Solo se admiten letras, números
# y barras (nada de `..` ni de rutas fuera de mcp/).
#
# Cada sesión nueva del escritorio es un worktree sin node_modules: sin
# esto el MCP no arranca. La primera vez se instalan las dependencias del
# backend (con la caché de npm, unos segundos). `npm install` y no `npm ci`:
# si ya hay un node_modules (el del checkout principal), solo añade lo que
# falta y no borra el cliente de Prisma generado.
#
# stdout es el canal del protocolo MCP: cualquier otra salida va a stderr.
cd "$(dirname "$0")/.." || exit 1
if [ ! -d node_modules/@modelcontextprotocol/sdk ]; then
  echo "[MCP] Instalando las dependencias del backend en este checkout..." >&2
  npm install --no-audit --no-fund --no-save >&2 || exit 1
fi
servidor="${1:-servidorDev}"
case "$servidor" in
  "" | /* | */ | *//* | *[!A-Za-z0-9/]*)
    echo "[MCP] Servidor no válido: $servidor" >&2
    exit 1
    ;;
esac
if [ ! -f "mcp/$servidor.ts" ]; then
  echo "[MCP] No existe mcp/$servidor.ts" >&2
  exit 1
fi
exec node_modules/.bin/tsx "mcp/$servidor.ts"
