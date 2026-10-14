#!/bin/sh
# Levanta o para backend-sim (perfil sim de docker-compose, localhost:3010),
# el destino de los webhooks de Telnyx simulados por el MCP de desarrollo.
# Funciona igual desde el checkout principal que desde un worktree:
#
#   scripts/backend-sim.sh          # levantar
#   scripts/backend-sim.sh parar    # parar y borrar el contenedor
#
# Usa el Postgres y el Redis que ya corren con el perfil dev (proyecto
# `asistai`, BD botbook) sin recrearlos, y el .env del checkout principal.
# Monta el backend/ del checkout desde el que se lanza: si ese worktree se
# borra, hay que volver a lanzarlo desde otro.
set -e
raiz=$(git rev-parse --show-toplevel)
principal=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
cd "$raiz"

# Compose necesita el .env junto al docker-compose.yml (está en .gitignore).
[ -e .env ] || ln -s "$principal/.env" .env

set -- "${1:-levantar}"
if [ -f "$principal/docker-compose.override.yml" ]; then
  set -- "$1" -f "$principal/docker-compose.override.yml"
fi
accion=$1
shift

case "$accion" in
  levantar)
    if [ "$(docker inspect -f '{{.State.Running}}' alhabla_postgres 2>/dev/null)" != "true" ]; then
      echo "Postgres de dev no está en marcha: levanta antes el perfil dev (docker compose --profile dev up -d)." >&2
      exit 1
    fi
    docker compose -p asistai -f docker-compose.yml "$@" --profile sim \
      up -d --no-deps backend-sim 2>&1 | grep -v "variable is not set" >&2 || true
    printf "Esperando a backend-sim" >&2
    for _ in $(seq 1 40); do
      if curl -sf http://localhost:3010/health >/dev/null 2>&1; then
        echo " listo en http://localhost:3010" >&2
        exit 0
      fi
      printf "." >&2
      sleep 3
    done
    echo " no responde; mira: docker logs alhabla_backend_sim" >&2
    exit 1
    ;;
  parar)
    docker compose -p asistai -f docker-compose.yml "$@" --profile sim \
      rm -sf backend-sim 2>&1 | grep -v "variable is not set" >&2 || true
    ;;
  *)
    echo "Uso: scripts/backend-sim.sh [levantar|parar]" >&2
    exit 1
    ;;
esac
