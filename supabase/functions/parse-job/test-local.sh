#!/usr/bin/env bash
# End-to-end smoke test for the parse-job function against the LOCAL stack.
#   1. supabase start && supabase db reset
#   2. supabase functions serve parse-job --env-file supabase/functions/.env
#   3. ./supabase/functions/parse-job/test-local.sh
#
# Without a GEMINI_API_KEY set, the parse falls back to a needs_review row —
# which still verifies auth + validation + upsert + RLS. With a key, it verifies
# the full Gemini extraction path.
set -euo pipefail

API="${SUPABASE_URL:-http://127.0.0.1:54321}"
# Local default anon key (shared demo key; never used in production).
ANON="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0}"
EMAIL="tester+$(date +%s)@example.com"
PASSWORD="password123"

echo "→ Signing up throwaway user $EMAIL"
TOKEN=$(curl -s -X POST "$API/auth/v1/signup" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.access_token')

if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "✗ Failed to obtain access token — is the stack up?" >&2
  exit 1
fi
echo "  got JWT (${#TOKEN} chars)"

read -r -d '' JOB <<'EOF' || true
Senior Backend Engineer at Stripe. San Francisco, CA (Hybrid).
We're looking for an engineer with 5+ years of experience building
distributed systems. Required: Python, Go, PostgreSQL, Kafka, Kubernetes, AWS.
You'll design payment infrastructure serving millions of businesses.
EOF
URL="https://example.com/jobs/stripe-backend-$(date +%s)"

echo "→ POST /functions/v1/parse-job"
curl -s -X POST "$API/functions/v1/parse-job" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$JOB" --arg u "$URL" '{rawText:$t, sourceUrl:$u}')" | jq

echo
echo "→ Re-POST same URL (should UPSERT, not duplicate)"
curl -s -X POST "$API/functions/v1/parse-job" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$JOB" --arg u "$URL" '{rawText:$t, sourceUrl:$u}')" \
  | jq '{parseStatus, job_id: .job.id, company: .job.company_name}'
