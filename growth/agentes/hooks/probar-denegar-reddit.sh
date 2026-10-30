#!/bin/bash
# Prueba de shell de denegar-reddit.sh: manda entradas JSON por la entrada
# estándar (como hace Claude Code) y comprueba el código de salida y el mensaje.
#
#   growth/agentes/hooks/probar-denegar-reddit.sh
#
# Sin red. Sale con 1 si algún caso falla.

set -u

AQUI="$(cd "$(dirname "$0")" && pwd)"
HOOK="$AQUI/denegar-reddit.sh"
fallos=0
casos=0

# probar <esperado: 0|2> <descripción> <json>
probar() {
  local esperado="$1" descripcion="$2" json="$3"
  local salida codigo error
  casos=$((casos + 1))
  error="$(printf '%s' "$json" | bash "$HOOK" 2>&1 >/dev/null)"
  codigo=$?
  if [ "$codigo" != "$esperado" ]; then
    echo "FALLO  $descripcion: esperaba salida $esperado y fue $codigo"
    fallos=$((fallos + 1))
    return
  fi
  if [ "$esperado" = "2" ] && ! printf '%s' "$error" | grep -q "Reddit"; then
    echo "FALLO  $descripcion: salió 2 pero sin el mensaje de Reddit en stderr"
    fallos=$((fallos + 1))
    return
  fi
  if [ "$esperado" = "0" ] && [ -n "$error" ]; then
    echo "FALLO  $descripcion: salió 0 pero escribió en stderr: $error"
    fallos=$((fallos + 1))
    return
  fi
  echo "ok     $descripcion"
}

# ── Se deniegan (código 2 y mensaje) ─────────────────────────────────────
probar 2 "WebFetch a www.reddit.com" \
  '{"hook_event_name":"PreToolUse","tool_name":"WebFetch","tool_input":{"url":"https://www.reddit.com/r/peluqueria/","prompt":"resume"}}'
probar 2 "WebFetch a old.reddit.com" \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://old.reddit.com/r/emprendedores/comments/x"}}'
probar 2 "WebFetch a redd.it" \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://redd.it/abc123"}}'
probar 2 "WebFetch a i.redd.it" \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://i.redd.it/foto.png"}}'
probar 2 "WebFetch con REDDIT.COM en mayúsculas" \
  '{"tool_name":"WebFetch","tool_input":{"url":"HTTPS://WWW.REDDIT.COM/r/x"}}'
probar 2 "WebFetch con el punto codificado" \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://www.reddit%2Ecom/r/x"}}'
probar 2 "WebFetch a través de un archivo web" \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://web.archive.org/web/2026/https://www.reddit.com/r/x"}}'
probar 2 "WebSearch con site:reddit.com" \
  '{"tool_name":"WebSearch","tool_input":{"query":"recepcionista IA peluquería site:reddit.com"}}'
probar 2 "WebSearch con allowed_domains reddit.com" \
  '{"tool_name":"WebSearch","tool_input":{"query":"citas","allowed_domains":["reddit.com"]}}'
probar 2 "web_fetch de MCP con una URL de Reddit entre varias" \
  '{"tool_name":"mcp__abc-123__web_fetch","tool_input":{"urls":["https://example.com/a","https://www.reddit.com/r/x"],"objective":"leer"}}'
probar 2 "web_search de MCP con site:redd.it" \
  '{"tool_name":"mcp__abc-123__web_search","tool_input":{"search_queries":["site:redd.it citas"],"objective":"x"}}'
probar 2 "JSON ilegible que menciona reddit.com (fail-closed)" \
  '{tool_name: WebFetch, url: https://www.reddit.com/r/x'

# ── Pasan (código 0 y sin mensaje) ───────────────────────────────────────
probar 0 "WebFetch a alhabla.ai" \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://alhabla.ai/planes","prompt":"precios"}}'
probar 0 "WebFetch a redditinc.com (otro dominio)" \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://redditinc.com/policies/data-api-terms"}}'
probar 0 "WebFetch a support.reddithelp.com (otro dominio)" \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://support.reddithelp.com/hc/es"}}'
probar 0 "WebFetch a notreddit.com (otro dominio)" \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://notreddit.com/"}}'
probar 0 "WebFetch a reddit.community (otro dominio)" \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://reddit.community/"}}'
probar 0 "WebFetch con reddit.com solo en el prompt" \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://alhabla.ai/","prompt":"no sigas enlaces a reddit.com"}}'
probar 0 "WebSearch que excluye reddit.com con blocked_domains" \
  '{"tool_name":"WebSearch","tool_input":{"query":"recepcionista de IA para peluquerías","blocked_domains":["reddit.com"]}}'
probar 0 "web_search de MCP que excluye reddit.com" \
  '{"tool_name":"mcp__abc-123__web_search","tool_input":{"search_queries":["recepcionista IA"],"exclude_domains":["reddit.com"]}}'
probar 0 "otra herramienta (Bash) que nombra reddit.com" \
  '{"tool_name":"Bash","tool_input":{"command":"echo reddit.com"}}'
probar 0 "evento sin herramienta" \
  '{"hook_event_name":"PreToolUse"}'

echo
if [ "$fallos" -gt 0 ]; then
  echo "$fallos de $casos casos fallan."
  exit 1
fi
echo "Los $casos casos pasan."
