#!/bin/bash
# Apply supabase/migrations/*.sql to a live project via the Supabase
# Management API. Avoids the DB-password dance of `supabase db push`.
#
# Usage: SUPABASE_ACCESS_TOKEN=sbp_... PROJECT_REF=xxx scripts/apply-migrations.sh
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN must be set}"
: "${PROJECT_REF:?PROJECT_REF must be set}"

API="https://api.supabase.com/v1/projects/$PROJECT_REF/database/query"

for f in supabase/migrations/*.sql; do
  echo "→ Applying $f ..."
  # Read the whole file; jq-encode as JSON to handle any special chars.
  body=$(jq -Rs '{query: .}' < "$f")
  http=$(curl -s -o /tmp/sb-apply.out -w "%{http_code}" \
    -X POST "$API" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$body")
  if [ "$http" != "200" ] && [ "$http" != "201" ]; then
    echo "  ✖ HTTP $http"
    cat /tmp/sb-apply.out
    exit 1
  fi
  # Management API returns "[]" on success for DDL. Anything else worth showing.
  out=$(cat /tmp/sb-apply.out)
  if [ "$out" != "[]" ] && [ -n "$out" ]; then
    echo "  $out"
  else
    echo "  ✓ applied"
  fi
done

echo
echo "All migrations applied. Verifying …"
curl -s -X POST "$API" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "select table_name from information_schema.tables where table_schema = '\''public'\'' order by table_name;"}' \
  | jq -r '.[] | .table_name'
