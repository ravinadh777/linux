#!/usr/bin/env bash
# Fires every test body in this folder against POST /agent with a valid Bearer token.
# Prints a compact summary: the ordered list of AG-UI event types + any CUSTOM names.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
# Derived from this script's own location — it used to be a hardcoded absolute path on one
# developer's machine, so the script only ran there.
SVC="$(cd "$DIR/../.." && pwd)"
URL="${AGENT_URL:-http://127.0.0.1:4100/agent}"

# Pick the venv interpreter for this platform.
PY="$SVC/.venv/bin/python"
[ -x "$PY" ] || PY="$SVC/.venv/Scripts/python.exe"
if [ ! -x "$PY" ]; then
  echo "No virtualenv at $SVC/.venv — run 'npm run bootstrap' first." >&2
  exit 1
fi

# Must match the service's JWT_SECRET or every request comes back 401.
# Exported so the python child below can read it, rather than interpolating a secret
# straight into the script it runs.
export SECRET="${JWT_SECRET:-change-me-dev-only-not-for-production}"

TOKEN=$("$PY" -c "
import datetime, os, jwt
c={'sub':'idn_citizen_1','name':'Jane Persaud','iat':datetime.datetime.now(datetime.timezone.utc),'exp':datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=2)}
print(jwt.encode(c, os.environ['SECRET'], algorithm='HS256'))
")

for f in "$DIR"/*.json; do
  name=$(basename "$f")
  echo "════════════════════════════════════════════════════════════"
  echo "▶ $name"
  resp=$(curl -N -s -m 60 -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    --data-binary @"$f")
  # ordered event types, collapsed runs of TEXT_MESSAGE_CONTENT
  echo "$resp" | grep -o '"type":"[A-Z_]*"' | sed 's/"type":"//;s/"//' \
    | awk '{ if($0=="TEXT_MESSAGE_CONTENT"){c++} else { if(c){printf "TEXT_MESSAGE_CONTENT(x%d) ",c; c=0} printf "%s ",$0 } } END{ if(c)printf "TEXT_MESSAGE_CONTENT(x%d)",c; print "" }'
  # tool names + custom event names, if any
  echo "$resp" | grep -o '"toolCallName":"[^"]*"' | sed 's/.*"toolCallName":"/  tool: /;s/"$//' | sort -u
  echo "$resp" | grep -o '"name":"[A-Za-z]*","value"' | sed 's/"name":"/  custom: /;s/","value"//' | sort -u
done
echo "════════════════════════════════════════════════════════════"
