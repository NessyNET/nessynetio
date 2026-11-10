#!/usr/bin/env bash
# Runs the unchanged deploy/nginx/ config against a dist/ in a container and
# executes check.sh inside it. DIST defaults to the hand-made fixture.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="${DIST:-$ROOT/tests/server/fixture-dist}"
IMAGE="nessynet-nginx-test"

if command -v docker > /dev/null 2>&1; then
  RUNTIME=docker
elif command -v podman > /dev/null 2>&1; then
  RUNTIME=podman
else
  echo "error: no docker or podman found; install one (or run this in CI) to execute the nginx server checks" >&2
  exit 127
fi

DIST="$(cd "$DIST" && pwd)"

"$RUNTIME" build -t "$IMAGE" -f "$ROOT/tests/server/Containerfile" "$ROOT/tests/server"

NAME="nessynet-nginx-test-$$"
trap '"$RUNTIME" rm -f "$NAME" > /dev/null 2>&1 || true' EXIT

# The :z suffix relabels mounts for SELinux hosts (podman); other hosts ignore it.
"$RUNTIME" run -d --name "$NAME" \
  -v "$ROOT/deploy/nginx:/mnt/nginx:ro,z" \
  -v "$ROOT/tests/server/check.sh:/mnt/check.sh:ro,z" \
  -v "$DIST:/srv/nessynet/current:ro,z" \
  "$IMAGE" sleep infinity > /dev/null

"$RUNTIME" exec "$NAME" bash -euc '
  rm -f /etc/nginx/sites-enabled/default
  mkdir -p /etc/nginx/snippets /etc/nginx/sites-enabled
  cp /mnt/nginx/snippets/*.conf /etc/nginx/snippets/
  cp /mnt/nginx/nessynet.io.conf /mnt/nginx/00-default.conf /etc/nginx/sites-enabled/
  nginx -t
  nginx
  for _ in $(seq 1 20); do curl -sk -o /dev/null https://127.0.0.1/ && break; sleep 0.25; done
'

status=0
"$RUNTIME" exec "$NAME" bash /mnt/check.sh || status=$?
exit "$status"
