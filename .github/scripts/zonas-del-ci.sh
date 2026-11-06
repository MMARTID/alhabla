#!/usr/bin/env bash
# Qué zonas del repo toca un cambio, para que el CI (.github/workflows/ci.yml)
# corra solo lo que le hace falta y scripts/comprobar-rama.sh haga lo mismo en
# local: una sola definición de las zonas para los dos.
#
#   .github/scripts/zonas-del-ci.sh <base> <head>   # git diff base...head
#   git diff --name-only … | .github/scripts/zonas-del-ci.sh -
#
# Escribe «zona=true|false», una por línea (el formato de $GITHUB_OUTPUT), y
# un resumen por stderr. Ante la duda, todo a true: sin base (rama nueva o
# primer push), si git diff falla, o si cambia el propio CI, uno de estos
# scripts o .nvmrc.
#
# Zonas:
#   backend       backend/**
#   conocimiento  lo que lee la base de conocimiento de Growth fuera de
#                 backend/ (mcp/growth/conocimiento): PRODUCT.md, el blog,
#                 los planes, páginas, comparativas y sectores de la web y las
#                 reglas de growth/agentes. Un artículo nuevo puede romperla.
#   growth        growth/** y backend/src/modules/growth/** (sus tests de paridad
#                 leen el backend)
#   frontend, web, laliga (infra/cloudflare/failover-laliga)
#   copias        los src de la app y la web (scripts/comprobar-copias-compartidas.sh)
set -uo pipefail

ZONAS="backend conocimiento frontend web growth laliga copias"

todo() {
  echo "[zonas] $1: se comprueba todo" >&2
  for zona in $ZONAS; do echo "$zona=true"; done
  exit 0
}

patron() {
  case "$1" in
    backend) echo '^backend/' ;;
    conocimiento) echo '^(PRODUCT\.md$|web/content/blog/|web/src/lib/(plans|paginas|comparativas)\.ts$|web/src/lib/sectores/|growth/agentes/reglas/)' ;;
    frontend) echo '^frontend/' ;;
    web) echo '^web/' ;;
    growth) echo '^(growth/|backend/src/modules/growth/)' ;;
    laliga) echo '^infra/cloudflare/failover-laliga/' ;;
    copias) echo '^(frontend/src/|web/src/|scripts/comprobar-copias-compartidas\.sh$)' ;;
  esac
}

if [ "${1:-}" = "-" ]; then
  FICHEROS="$(cat)"
else
  BASE="${1:-}"
  HEAD="${2:-HEAD}"
  case "$BASE" in
    "" | 0000000000000000000000000000000000000000) todo "sin commit base" ;;
  esac
  FICHEROS="$(git diff --name-only "$BASE...$HEAD" 2>/dev/null)" || todo "git diff $BASE...$HEAD falló"
fi

if printf '%s\n' "$FICHEROS" | grep -qE '^(\.github/workflows/ci\.yml$|\.github/scripts/|\.nvmrc$)'; then
  todo "cambia el propio CI o la versión de Node"
fi

TOCADAS=""
for zona in $ZONAS; do
  if printf '%s\n' "$FICHEROS" | grep -qE "$(patron "$zona")"; then
    echo "$zona=true"
    TOCADAS="$TOCADAS $zona"
  else
    echo "$zona=false"
  fi
done
echo "[zonas] $(printf '%s\n' "$FICHEROS" | grep -c .) ficheros; tocan:${TOCADAS:- ninguna}" >&2
