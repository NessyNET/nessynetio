#!/usr/bin/env bash
# Server contract assertions (design 3.6.2 step 11, 3.6.3, 5.2; CI-only checks 1-6 of 10.1).
# Runs inside the harness container, or anywhere nginx answers on 127.0.0.1.
# Override the variables below to point it at another dist (task 036: site-e2e).
set -euo pipefail

HOST="${HOST:-nessynet.io}"
WWW_HOST="${WWW_HOST:-www.nessynet.io}"
ADDR="${ADDR:-127.0.0.1}"
UNKNOWN_PATH="${UNKNOWN_PATH:-/__nope__/}"
DIR_PATH="${DIR_PATH:-/ffxiv}"                              # directory in dist, requested without slash
HIDDEN_CATEGORY_PATH="${HIDDEN_CATEGORY_PATH:-/terraria/}"  # absent from dist
ASTRO_PATH="${ASTRO_PATH:-/_astro/x.js}"
OG_PATH="${OG_PATH:-/og/x.png}"
MAP_PATH="${MAP_PATH:-/_astro/x.js.map}"
NOT_FOUND_MARKER="${NOT_FOUND_MARKER:-fixture-404}"         # text in 404.html; empty skips the body check

CSP="default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
IMMUTABLE="public, max-age=31536000, immutable"

CURL=(curl -sk --max-time 10
  --resolve "$HOST:443:$ADDR" --resolve "$WWW_HOST:443:$ADDR"
  --resolve "$HOST:80:$ADDR" --resolve "$WWW_HOST:80:$ADDR")

WORK="$(mktemp -d)"
trap 'rm -r -f "$WORK"' EXIT
HDR="$WORK/headers"
BODY="$WORK/body"
STATUS=""
FAILS=0

pass() { echo "ok   $*"; }
fail() {
  echo "FAIL $*"
  FAILS=$((FAILS + 1))
}

# fetch URL [curl args]: sets STATUS, fills $HDR and $BODY. Redirects are not followed.
fetch() {
  local url=$1
  shift
  : > "$HDR"
  STATUS="$("${CURL[@]}" -D "$HDR" -o "$BODY" -w '%{http_code}' "$@" "$url")" || STATUS=000
  tr -d '\r' < "$HDR" > "$HDR.clean"
  mv "$HDR.clean" "$HDR"
}

header_value() {
  awk -v name="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" '
    { key = tolower(substr($0, 1, index($0, ":") - 1)) }
    key == name { sub(/^[^:]*:[ \t]*/, ""); print; exit }' "$HDR"
}

expect_status() { # label expected
  if [[ "$STATUS" == "$2" ]]; then pass "$1 -> $2"; else fail "$1 -> expected $2, got $STATUS"; fi
}

expect_header() { # label header expected
  local got
  got="$(header_value "$2")"
  if [[ "$got" == "$3" ]]; then pass "$1 $2: $3"; else fail "$1 $2: expected '$3', got '$got'"; fi
}

expect_security_headers() { # label (uses the last fetch)
  expect_header "$1" Content-Security-Policy "$CSP"
  expect_header "$1" X-Content-Type-Options "nosniff"
  expect_header "$1" Referrer-Policy "strict-origin-when-cross-origin"
  expect_header "$1" Permissions-Policy "camera=(), microphone=(), geolocation=()"
  expect_header "$1" Strict-Transport-Security "max-age=31536000"
}

# Redirects (3.6.3 port 80 and www rows)
fetch "http://$HOST/"
expect_status "http://$HOST/" 301
expect_header "http://$HOST/" Location "https://$HOST/"

fetch "http://$WWW_HOST/x"
expect_status "http://$WWW_HOST/x" 301
expect_header "http://$WWW_HOST/x" Location "https://$HOST/x"

fetch "https://$WWW_HOST/x"
expect_status "https://$WWW_HOST/x" 301
expect_header "https://$WWW_HOST/x" Location "https://$HOST/x"

# Status codes, 404 page, caching, headers on 200
fetch "https://$HOST/"
expect_status "/" 200
expect_header "/" Cache-Control "no-cache"
expect_security_headers "/"

fetch "https://$HOST$UNKNOWN_PATH"
expect_status "$UNKNOWN_PATH" 404
if [[ -z "$NOT_FOUND_MARKER" ]] || grep -q -- "$NOT_FOUND_MARKER" "$BODY"; then
  pass "$UNKNOWN_PATH body is the 404 page"
else
  fail "$UNKNOWN_PATH body does not contain '$NOT_FOUND_MARKER'"
fi
expect_security_headers "$UNKNOWN_PATH (404)"

fetch "https://$HOST$HIDDEN_CATEGORY_PATH"
expect_status "$HIDDEN_CATEGORY_PATH (hidden category)" 404

fetch "https://$HOST/404.html"
expect_status "/404.html (internal)" 404

# Directory redirect: relative Location, headers still present
fetch "https://$HOST$DIR_PATH"
expect_status "$DIR_PATH" 301
expect_header "$DIR_PATH" Location "$DIR_PATH/"
expect_security_headers "$DIR_PATH (301)"

# Immutable assets
fetch "https://$HOST$ASTRO_PATH"
expect_status "$ASTRO_PATH" 200
expect_header "$ASTRO_PATH" Cache-Control "$IMMUTABLE"
expect_security_headers "$ASTRO_PATH"

fetch "https://$HOST$OG_PATH"
expect_status "$OG_PATH" 200
expect_header "$OG_PATH" Cache-Control "$IMMUTABLE"
expect_security_headers "$OG_PATH"

# gzip_static (no --compressed: we want to see the header, not decode)
fetch "https://$HOST/" -H 'Accept-Encoding: gzip'
expect_status "/ (gzip)" 200
expect_header "/ (gzip)" Content-Encoding "gzip"

# Hidden files under the nested `^~` locations (error_page applies there too, with the headers)
for nested in /_astro/.hidden /og/.hidden; do
  fetch "https://$HOST$nested"
  expect_status "$nested" 404
  expect_security_headers "$nested (404)"
  if [[ -z "$NOT_FOUND_MARKER" ]] || grep -q -- "$NOT_FOUND_MARKER" "$BODY"; then
    pass "$nested body is the 404 page"
  else
    fail "$nested body does not contain '$NOT_FOUND_MARKER'"
  fi
done

# Hidden files
fetch "https://$HOST/.build-meta.json"
expect_status "/.build-meta.json" 404
fetch "https://$HOST$MAP_PATH"
expect_status "$MAP_PATH" 404
fetch "https://$HOST/.hidden"
expect_status "/.hidden" 404

# TLS (S21): TLS 1.2 and 1.3 handshakes succeed; the config offers nothing older (a modern client cannot try 1.1)
tls_handshake() { # protocol-flag -> output of s_client, empty on failure
  openssl s_client -connect "$ADDR:443" -servername "$HOST" "$1" < /dev/null 2> /dev/null || true
}
tls1_2="$(tls_handshake -tls1_2)"
if grep -q "New, TLSv1\.2, Cipher is" <<< "$tls1_2"; then pass "TLS 1.2 handshake"; else fail "TLS 1.2 handshake"; fi
tls1_3="$(tls_handshake -tls1_3)"
if grep -q "New, TLSv1\.3, Cipher is" <<< "$tls1_3"; then pass "TLS 1.3 handshake"; else fail "TLS 1.3 handshake"; fi
if command -v nginx > /dev/null 2>&1; then
  if nginx -T 2> /dev/null | grep -Eq "ssl_protocols +TLSv1\.2 +TLSv1\.3;"; then pass "ssl_protocols is TLSv1.2 TLSv1.3"; else fail "ssl_protocols is not TLSv1.2 TLSv1.3"; fi
fi

# Catch-all (S22): an unknown Host on 80 gets no response; an unknown SNI on 443 is rejected; the real name is served
unknown_status="$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H 'Host: unknown.example' "http://$ADDR/" || true)"
if [[ "$unknown_status" == "000" ]]; then pass "unknown Host on port 80: connection closed (444)"; else fail "unknown Host on port 80 returned $unknown_status"; fi

if openssl s_client -connect "$ADDR:443" -servername unknown.example < /dev/null 2> /dev/null | grep -q "BEGIN CERTIFICATE"; then
  fail "unknown SNI on 443 was given a certificate"
else
  pass "unknown SNI on 443: handshake rejected"
fi
if openssl s_client -connect "$ADDR:443" -servername "$HOST" < /dev/null 2> /dev/null | grep -q "subject=.*CN *= *$HOST"; then
  pass "SNI $HOST is served with its certificate"
else
  fail "SNI $HOST did not get the $HOST certificate"
fi

if ((FAILS > 0)); then
  echo "$FAILS assertion(s) failed"
  exit 1
fi
echo "all assertions passed"
