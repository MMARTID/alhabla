#!/bin/sh
# Levanta o para backend-sim (perfil sim de docker-compose, localhost:3010),
# el destino de los webhooks de Telnyx simulados por el MCP de desarrollo.
# Funciona igual desde el checkout principal que desde un worktree:
#
#   scripts/backend-sim.sh              # levantar
#   scripts/backend-sim.sh reiniciar    # recrear el contenedor (schema nuevo)
#   scripts/backend-sim.sh reconstruir  # imagen y node_modules nuevos
#   scripts/backend-sim.sh parar        # parar y borrar el contenedor
#
# Usa el Postgres que ya corre con el perfil dev (proyecto
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

esperar() {
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
}

# El contenedor hace prisma generate al arrancar: un schema nuevo pide
# recrearlo. Unas dependencias nuevas, además, la imagen y el volumen
# anónimo de node_modules (si no, se reutilizaría el viejo).
case "$accion" in
  levantar|reiniciar|reconstruir)
    if [ "$(docker inspect -f '{{.State.Running}}' alhabla_postgres 2>/dev/null)" != "true" ]; then
      echo "Postgres de dev no está en marcha: levanta antes el perfil dev (docker compose --profile dev up -d)." >&2
      exit 1
    fi
    case "$accion" in
      reiniciar) extra="--force-recreate" ;;
      reconstruir) extra="--build --renew-anon-volumes" ;;
      *) extra="" ;;
    esac
    # shellcheck disable=SC2086
    docker compose -p asistai -f docker-compose.yml "$@" --profile sim \
      up -d --no-deps $extra backend-sim 2>&1 | grep -v "variable is not set" >&2 || true
    esperar
    ;;
  parar)
    docker compose -p asistai -f docker-compose.yml "$@" --profile sim \
      rm -sf backend-sim 2>&1 | grep -v "variable is not set" >&2 || true
    ;;
  *)
    echo "Uso: scripts/backend-sim.sh [levantar|reiniciar|reconstruir|parar]" >&2
    exit 1
    ;;
esac
