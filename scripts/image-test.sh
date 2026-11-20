#!/usr/bin/env bash
# Checks a built image the way an operator uses it (BAULISTE.md S-905; CI job "image"):
#   bash scripts/image-test.sh soll:ci
# Empty volume and a key made for this run only; never a volume with real data (CLAUDE.md).
set -euo pipefail

IMAGE="${1:?usage: scripts/image-test.sh <image>}"
PORT="${SOLL_IMAGE_TEST_PORT:-28290}"
LAUF="soll-image-test-$$"
KEY="$(openssl rand -base64 32)"
FEHLER="$(mktemp)"

aufraeumen() {
  docker rm -f "$LAUF" "$LAUF-neu" >/dev/null 2>&1 || true
  docker volume rm -f "$LAUF" "$LAUF-neu" >/dev/null 2>&1 || true
  rm -f "$FEHLER"
}
trap aufraeumen EXIT

# Waits until the container answers /health on PORT, or fails after 30 s with its log
warten() {
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then return 0; fi
    sleep 0.5
  done
  docker logs "$1" || true
  echo "no answer on /health" >&2
  return 1
}

echo "== runs as an unprivileged user"
[[ "$(docker image inspect --format '{{.Config.User}}' "$IMAGE")" == "nonroot" ]]

echo "== refuses to start without SOLL_SECRET_KEY"
if docker run --rm "$IMAGE" 2>"$FEHLER"; then
  echo "started without SOLL_SECRET_KEY" >&2
  exit 1
fi
grep -q SOLL_SECRET_KEY "$FEHLER"

echo "== starts with an empty data directory and answers /health"
docker volume create "$LAUF" >/dev/null
docker run -d --name "$LAUF" -e SOLL_SECRET_KEY="$KEY" -p "127.0.0.1:$PORT:8200" \
  -v "$LAUF:/data" "$IMAGE" >/dev/null
warten "$LAUF"
curl -fsS "http://127.0.0.1:$PORT/health" | grep -q '"status":"ok"'

echo "== serves the web app next to the API"
curl -fsS "http://127.0.0.1:$PORT/heute" | grep -qi '<!doctype html>'
curl -fsSI "http://127.0.0.1:$PORT/sw.js" | grep -qi '^cache-control: no-cache'

echo "== the container's own health check turns healthy"
for _ in $(seq 1 45); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$LAUF")"
  [[ "$status" == healthy ]] && break
  sleep 2
done
[[ "$status" == healthy ]]

echo "== backup while the server runs"
docker exec "$LAUF" soll backup /data/backups/ci.db | grep -q '"backup written"'

echo "== restore into a fresh volume; the server starts on it with the same key"
docker stop "$LAUF" >/dev/null
docker volume create "$LAUF-neu" >/dev/null
docker run --rm -v "$LAUF:/alt:ro" -v "$LAUF-neu:/data" "$IMAGE" restore /alt/backups/ci.db \
  | grep -q '"restored"'
docker run -d --name "$LAUF-neu" -e SOLL_SECRET_KEY="$KEY" -p "127.0.0.1:$PORT:8200" \
  -v "$LAUF-neu:/data" "$IMAGE" >/dev/null
warten "$LAUF-neu"

echo "image ok: $IMAGE"
