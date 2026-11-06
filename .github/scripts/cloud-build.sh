#!/usr/bin/env bash
# Lanza un build de Cloud Build y espera a que acabe (lo usa deploy-backend.yml
# para la imagen y para las migraciones).
#
#   .github/scripts/cloud-build.sh <carpeta> <config> [sustituciones]
#   .github/scripts/cloud-build.sh backend backend/cloudbuild.yaml "_TAG=abc123"
#
# `gcloud builds submit` (sin --async) intenta hacer streaming del log del
# build, y ese streaming exige el rol primitivo Viewer/Owner del proyecto (no
# basta con permisos granulares de Cloud Build o Cloud Logging: se probó
# roles/logging.viewer y el fallo persistió, exactamente igual con
# --suppress-logs). github-actions-ci no tiene ese rol a propósito (mínimo
# privilegio), así que el build terminaba bien en GCP pero el comando salía con
# exit 1 igualmente. Por eso --async (solo crea el build y devuelve su ID) y se
# sondea con `gcloud builds describe`, que solo necesita cloudbuild.builds.get
# (ya cubierto por cloudbuild.builds.editor).
set -euo pipefail

CARPETA="$1"
CONFIG="$2"
SUSTITUCIONES="${3:-}"
PROYECTO="${GCP_PROJECT_ID:?Falta GCP_PROJECT_ID}"

BUILD_ID=$(gcloud builds submit "$CARPETA" \
  --project="$PROYECTO" \
  --config="$CONFIG" \
  ${SUSTITUCIONES:+--substitutions="$SUSTITUCIONES"} \
  --async \
  --format='value(id)')
echo "Build $CONFIG: $BUILD_ID (https://console.cloud.google.com/cloud-build/builds/$BUILD_ID?project=$PROYECTO)"

while true; do
  ESTADO=$(gcloud builds describe "$BUILD_ID" --project="$PROYECTO" --format='value(status)')
  case "$ESTADO" in
    SUCCESS)
      echo "Build $BUILD_ID: SUCCESS"
      exit 0
      ;;
    FAILURE | INTERNAL_ERROR | TIMEOUT | CANCELLED | EXPIRED)
      echo "::error::Build $BUILD_ID ($CONFIG) terminó en $ESTADO — ver https://console.cloud.google.com/cloud-build/builds/$BUILD_ID?project=$PROYECTO"
      exit 1
      ;;
    *)
      echo "Estado del build: $ESTADO"
      sleep 10
      ;;
  esac
done
