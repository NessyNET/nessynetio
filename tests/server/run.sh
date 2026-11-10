#!/usr/bin/env bash
# Runs the unchanged deploy/nginx/ config against a dist/ in a container.
#
#   run.sh            build the image, start nginx, run check.sh inside, remove the container (default)
#   run.sh --serve    same, but keep the container running with ports published, and print the environment for
#                     Playwright (E2E_BASE_URL, E2E_RESOLVE); HTTPS_PORT and HTTP_PORT choose the host ports
#                     (default 8443 and 8080; CI uses 443 and 80)
#   run.sh --stop     remove the container started by --serve
#
# DIST defaults to the hand-made fixture. A real build (for example DIST=.e2e-sites/e2e) is detected: the check
# uses one of its hashed asset files and the real 404 wording instead of the fixture's.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="${DIST:-$ROOT/tests/server/fixture-dist}"
IMAGE="nessynet-nginx-test"
SERVE_NAME="nessynet-nginx-serve"
MODE="${1:-check}"

if command -v docker > /dev/null 2>&1; then
  RUNTIME=docker
elif command -v podman > /dev/null 2>&1; then
  RUNTIME=podman
else
  echo "error: no docker or podman found; install one (or run this in CI) to execute the nginx server checks" >&2
  exit 127
fi

case "$MODE" in
  check | --serve | --stop) ;;
  *)
    echo "usage: run.sh [--serve | --stop]" >&2
    exit 2
    ;;
esac

if [[ "$MODE" == "--stop" ]]; then
  "$RUNTIME" rm -f "$SERVE_NAME" > /dev/null 2>&1 || true
  echo "stopped $SERVE_NAME"
  exit 0
fi

DIST="$(cd "$DIST" && pwd)"
HTTPS_PORT="${HTTPS_PORT:-8443}"
HTTP_PORT="${HTTP_PORT:-8080}"

# A real build: point the check at files it actually has.
first_file() { # directory -> first regular file name, or empty
  find "$1" -maxdepth 1 -type f -printf '%f\n' 2> /dev/null | sort | head -n 1
}
CHECK_ENV=()
if [[ -n "$(first_file "$DIST/_astro")" ]] && grep -q "no such file or directory" "$DIST/404.html" 2> /dev/null; then
  CHECK_ENV+=("ASTRO_PATH=/_astro/$(first_file "$DIST/_astro")")
  [[ -n "$(first_file "$DIST/og")" ]] && CHECK_ENV+=("OG_PATH=/og/$(first_file "$DIST/og")")
  CHECK_ENV+=("NOT_FOUND_MARKER=no such file or directory")
fi

"$RUNTIME" build -t "$IMAGE" -f "$ROOT/tests/server/Containerfile" "$ROOT/tests/server"

if [[ "$MODE" == "--serve" ]]; then
  NAME="$SERVE_NAME"
  "$RUNTIME" rm -f "$NAME" > /dev/null 2>&1 || true
  PUBLISH=(-p "$HTTPS_PORT:443" -p "$HTTP_PORT:80")
else
  NAME="nessynet-nginx-test-$$"
  trap '"$RUNTIME" rm -f "$NAME" > /dev/null 2>&1 || true' EXIT
  PUBLISH=()
fi

# The :z suffix relabels mounts for SELinux hosts (podman); other hosts ignore it.
"$RUNTIME" run -d --name "$NAME" "${PUBLISH[@]}" \
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

if [[ "$MODE" == "--serve" ]]; then
  cat <<OUT
nginx is serving $DIST in container $NAME (stop it with: bash tests/server/run.sh --stop)
export E2E_BASE_URL=https://nessynet.io$([[ "$HTTPS_PORT" == 443 ]] || echo ":$HTTPS_PORT")
export E2E_RESOLVE="MAP nessynet.io 127.0.0.1:$HTTPS_PORT, MAP www.nessynet.io 127.0.0.1:$HTTPS_PORT"
OUT
  exit 0
fi

status=0
"$RUNTIME" exec "${CHECK_ENV[@]/#/-e}" "$NAME" bash /mnt/check.sh || status=$?
exit "$status"
