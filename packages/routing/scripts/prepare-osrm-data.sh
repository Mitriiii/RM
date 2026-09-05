#!/usr/bin/env bash
# Downloads a Spain OSM extract and runs OSRM's extract/partition/customize pipeline against
# it, producing the .osrm files docker-compose.yml serves. This is a one-time (or
# occasional, when you want fresher map data) data-preparation step — it is not itself a
# long-running service, which is why it's a script rather than another docker-compose
# service.
#
# See ../README.md for:
#   - why this is Spain only, not "Iberia" (Geofabrik has no single combined Iberia extract)
#   - why it uses OSRM's bundled car profile, not a real truck profile (none ships with
#     osrm-backend) — read that before treating any distance from this setup as
#     truck-accurate
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../docker/data"
OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend:v5.27.1"
EXTRACT_URL="https://download.geofabrik.de/europe/spain-latest.osm.pbf"
EXTRACT_FILE="spain-latest.osm.pbf"
OSRM_BASE="spain-latest"
PROFILE="/opt/car.lua"

mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/$EXTRACT_FILE" ]; then
  echo "Downloading $EXTRACT_URL (multiple GB — this takes a while)..."
  curl -L -o "$DATA_DIR/$EXTRACT_FILE" "$EXTRACT_URL"
fi

echo "==> osrm-extract"
docker run --rm -v "$DATA_DIR:/data" "$OSRM_IMAGE" \
  osrm-extract -p "$PROFILE" "/data/$EXTRACT_FILE"

echo "==> osrm-partition"
docker run --rm -v "$DATA_DIR:/data" "$OSRM_IMAGE" \
  osrm-partition "/data/$OSRM_BASE.osrm"

echo "==> osrm-customize"
docker run --rm -v "$DATA_DIR:/data" "$OSRM_IMAGE" \
  osrm-customize "/data/$OSRM_BASE.osrm"

echo "Done. Run 'docker compose up' from packages/routing/docker to serve it on :5000."
