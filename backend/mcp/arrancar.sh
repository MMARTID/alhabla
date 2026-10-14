#!/bin/sh
# Arranque del MCP de desarrollo (lo lanza Claude Code desde .mcp.json).
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
exec node_modules/.bin/tsx mcp/servidorDev.ts
