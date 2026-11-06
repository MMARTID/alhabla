#!/usr/bin/env bash
# Lo que CI (.github/workflows/ci.yml) va a comprobar de esta rama, en local y
# solo en lo que toca: el diff con origin/main (desde donde se separó la rama)
# más lo que aún no está commiteado. Para no enterarse en el PR: el 06-11, CI
# falló dos veces por cosas que se veían en local (el conocimiento de Growth
# con dos viñetas nuevas de PRODUCT.md y 52 tests del comportamiento viejo).
#
#   scripts/comprobar-rama.sh                 # lo que toca el diff
#   scripts/comprobar-rama.sh --rapido        # sin builds ni integración
#   scripts/comprobar-rama.sh --todo          # todo, toque lo que toque
#   scripts/comprobar-rama.sh --solo backend,web
#
# Comprobaciones (nombre para --solo): backend (typecheck, lint, test),
# conocimiento (Growth, siempre: tarda un segundo), integracion (alhabla_test
# del Postgres de docker-compose, :5433, que comparten todas las sesiones: con
# cerrojo), migraciones (destructivas sin confirmar), copias (app/web),
# frontend, web y growth (lint, test, build) y laliga (Worker). Cada una deja
# su log en una carpeta temporal; al final, una tabla y el final del log de lo
# que falló. Sale con 1 si algo falla. Si un PR ya está en rojo, fallos_ci (MCP
# alhabla-dev) dice por qué.
#
# Desde cualquier carpeta del worktree. Bash 3.2 (el del Mac): sin arrays
# asociativos.
set -uo pipefail

RAIZ="$(git rev-parse --show-toplevel)"
cd "$RAIZ" || exit 2
BASE="${BASE:-origin/main}"
RAPIDO=0
TODO=0
SOLO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --rapido) RAPIDO=1 ;;
    --todo) TODO=1 ;;
    --solo) SOLO=",${2:-},"; shift ;;
    -h | --help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Opción desconocida: $1 (mira --help)" >&2; exit 2 ;;
  esac
  shift
done

git fetch -q origin main 2>/dev/null || echo "(sin red: comparo con el $BASE que hay)" >&2
CAMBIOS="$({
  git diff --name-only "$BASE"...HEAD
  git diff --name-only HEAD
  git ls-files --others --exclude-standard
} 2>/dev/null | sort -u)"

LOGS="$(mktemp -d "${TMPDIR:-/tmp}/comprobar-rama.XXXXXX")"
RESUMEN=""
FALLOS=""
AVISOS=""

toca() { [ "$TODO" = 1 ] || printf '%s\n' "$CAMBIOS" | grep -qE "$1"; }
quiere() { [ -z "$SOLO" ] || case "$SOLO" in *",$1,"*) return 0 ;; *) return 1 ;; esac; }
anotar() { RESUMEN="${RESUMEN}$1"$'\n'; }

# correr <log> <carpeta> <comando...>: con su log y su tiempo.
correr() {
  local nombre="$1" carpeta="$2"
  shift 2
  local log="$LOGS/$(printf '%s' "$nombre" | tr ' ·/' '___').log"
  local inicio=$SECONDS
  printf '→ %s…\n' "$nombre" >&2
  if (cd "$RAIZ/$carpeta" && "$@") >"$log" 2>&1; then
    anotar "✔ $nombre ($((SECONDS - inicio)) s)"
  else
    anotar "✘ $nombre ($((SECONDS - inicio)) s) — $log"
    FALLOS="${FALLOS}${nombre}|${log}"$'\n'
    return 1
  fi
}

# npm ci si faltan las dependencias o el lock es más nuevo que lo instalado.
dependencias() {
  local carpeta="$1"
  if [ ! -d "$RAIZ/$carpeta/node_modules" ] ||
    [ "$RAIZ/$carpeta/package-lock.json" -nt "$RAIZ/$carpeta/node_modules/.package-lock.json" ]; then
    correr "$carpeta · npm ci" "$carpeta" npm ci --no-audit --no-fund --loglevel=error
  fi
}

# --- Backend ---------------------------------------------------------------
if quiere backend || quiere conocimiento || quiere integracion; then
  dependencias backend
fi
if quiere backend && toca '^backend/'; then
  correr "backend · typecheck" backend npm run typecheck
  correr "backend · lint" backend npm run lint
  correr "backend · test" backend npm run test
fi
if quiere conocimiento; then
  correr "conocimiento de Growth" backend npm run growth:conocimiento -- --comprobar
fi

if quiere integracion && toca '^backend/(src|prisma|mcp|tests/integration)/'; then
  if [ "$RAPIDO" = 1 ]; then
    anotar "– integración: saltada (--rapido)"
  elif ! (exec 3<>/dev/tcp/127.0.0.1/5433) 2>/dev/null; then
    anotar "– integración: no hay Postgres en :5433 (docker compose --profile dev up postgres)"
  else
    # .env.test está en .gitignore: un worktree no lo trae; el del checkout
    # principal apunta a alhabla_test.
    PRINCIPAL="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
    if [ ! -f backend/.env.test ] && [ -f "$PRINCIPAL/backend/.env.test" ] &&
      git check-ignore -q backend/.env.test; then
      cp "$PRINCIPAL/backend/.env.test" backend/.env.test
    fi
    CERROJO="${TMPDIR:-/tmp}/alhabla-tests-integracion.lock"
    if [ ! -f backend/.env.test ]; then
      anotar "✘ integración: falta backend/.env.test (copia el del checkout principal)"
      FALLOS="${FALLOS}integración|(sin .env.test)"$'\n'
    elif ! mkdir "$CERROJO" 2>/dev/null &&
      kill -0 "$(cat "$CERROJO/pid" 2>/dev/null || echo 0)" 2>/dev/null; then
      anotar "– integración: otra sesión los está pasando ahora (alhabla_test es compartida); repite luego"
    else
      mkdir -p "$CERROJO" && echo $$ >"$CERROJO/pid"
      trap 'rm -rf "$CERROJO"' EXIT
      correr "integración · migraciones" backend sh -c 'set -a; . ./.env.test; set +a; npx prisma migrate deploy' &&
        correr "integración · tests" backend npm run test:integration
      rm -rf "$CERROJO"
      trap - EXIT
    fi
  fi
fi

# --- Migraciones destructivas (job «diff») ---------------------------------
if quiere migraciones; then
  NUEVAS="$(git diff --name-only --diff-filter=AM "$BASE"...HEAD -- 'backend/prisma/migrations/**/migration.sql' 2>/dev/null)"
  PELIGROSAS=""
  for f in $NUEVAS; do
    PELIGROSAS="${PELIGROSAS}$(grep -niE 'DROP[[:space:]]+(COLUMN|TABLE)|RENAME[[:space:]]+(COLUMN|TO)|SET[[:space:]]+NOT[[:space:]]+NULL' "$f" | sed "s|^|$f:|")"
  done
  if [ -n "$PELIGROSAS" ]; then
    if git log --format=%B "$BASE"..HEAD | grep -qiF 'contract-migration: ok'; then
      anotar "✔ migraciones destructivas confirmadas con «contract-migration: ok»"
    else
      AVISOS="${AVISOS}⚠ Migración destructiva sin confirmar (CI falla salvo con la etiqueta migracion-contract o «contract-migration: ok» en un commit):"$'\n'"${PELIGROSAS}"$'\n'
    fi
  fi
fi

# --- Copias compartidas app/web ---------------------------------------------
if quiere copias; then
  correr "copias compartidas app/web" . bash scripts/comprobar-copias-compartidas.sh
fi

# --- La app, la web y Growth ------------------------------------------------
web_o_app() {
  local carpeta="$1"
  shift
  dependencias "$carpeta"
  correr "$carpeta · lint" "$carpeta" npm run lint
  correr "$carpeta · test" "$carpeta" npm run test
  if [ "$RAPIDO" = 1 ]; then
    anotar "– $carpeta · build: saltado (--rapido)"
  else
    correr "$carpeta · build" "$carpeta" env "$@" npm run build
  fi
}
if quiere frontend && toca '^frontend/'; then
  web_o_app frontend NEXT_PUBLIC_API_BASE_URL=https://api.alhabla.ai NEXT_PUBLIC_WEB_URL=https://alhabla.ai
fi
if quiere web && toca '^web/'; then
  web_o_app web NEXT_PUBLIC_API_BASE_URL=https://api.alhabla.ai NEXT_PUBLIC_SITE_URL=https://alhabla.ai NEXT_PUBLIC_APP_URL=https://app.alhabla.ai &&
    [ "$RAPIDO" = 0 ] && correr "web · seo:similitud" web npm run seo:similitud
fi
if quiere growth && toca '^growth/'; then
  web_o_app growth NEXT_PUBLIC_API_BASE_URL=https://api.alhabla.ai NEXT_PUBLIC_GROWTH_GOOGLE_CLIENT_ID=ci-sin-valor-real.apps.googleusercontent.com &&
    [ "$RAPIDO" = 0 ] && correr "growth · sin la demostración en el build" growth sh -c '! grep -rl DEMO_ALHABLA_GROWTH_SENTINELA .next/static .next/server'
fi
if quiere laliga && toca '^infra/cloudflare/failover-laliga/'; then
  correr "Worker de LaLiga" infra/cloudflare/failover-laliga node --test
fi

# --- Aviso de orden de despliegue -------------------------------------------
if printf '%s\n' "$CAMBIOS" | grep -qE '^(frontend|web|growth)/' &&
  printf '%s\n' "$CAMBIOS" | grep -q '^backend/'; then
  AVISOS="${AVISOS}⚠ Toca frontend/web/growth y backend: Vercel publica en cuanto se fusiona y el backend tarda; si el front depende de algo nuevo del backend, fusiona antes el backend."$'\n'
fi

# --- Resumen ------------------------------------------------------------------
echo
echo "Rama $(git rev-parse --abbrev-ref HEAD) frente a $BASE ($(printf '%s\n' "$CAMBIOS" | grep -c . ) ficheros tocados)"
printf '%s' "$RESUMEN"
[ -n "$AVISOS" ] && printf '\n%s' "$AVISOS"
if [ -n "$FALLOS" ]; then
  printf '%s' "$FALLOS" | while IFS='|' read -r nombre log; do
    [ -f "$log" ] || continue
    printf '\n── %s (final de %s) ──\n' "$nombre" "$log"
    tail -n 25 "$log"
  done
  exit 1
fi
[ -z "$RESUMEN" ] && echo "Nada que comprobar en lo que toca el diff."
exit 0
