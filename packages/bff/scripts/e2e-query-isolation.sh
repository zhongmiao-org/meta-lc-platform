#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="$(cd "${ROOT_DIR}/../.." && pwd)"
SEED_SQL="${ROOT_DIR}/scripts/sql/001_orders_demo.sql"
TMP_DIR="$(mktemp -d)"

BFF_URL="${BFF_URL:-http://127.0.0.1:3000}"
PORT="${PORT:-3000}"
RUN_ID="${RUN_ID:-$(date +%s)}"

LC_DB_HOST="${LC_DB_HOST:-127.0.0.1}"
LC_DB_PORT="${LC_DB_PORT:-5432}"
LC_DB_USER="${LC_DB_USER:-lowcode}"
LC_DB_PASSWORD="${LC_DB_PASSWORD:-lowcode}"
LC_DB_NAME="${LC_DB_NAME:-meta_lc}"
LC_DB_BUSINESS_NAME="${LC_DB_BUSINESS_NAME:-${LC_DB_NAME}}"
LC_DB_AUDIT_NAME="${LC_DB_AUDIT_NAME:-${LC_DB_NAME}}"
LC_DB_SSL="${LC_DB_SSL:-false}"

BFF_PID=""

cleanup() {
  if [[ -n "${BFF_PID}" ]] && kill -0 "${BFF_PID}" >/dev/null 2>&1; then
    kill "${BFF_PID}" >/dev/null 2>&1 || true
  fi
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

log() {
  printf "[query-gate] %s\n" "$1"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "missing required command: ${cmd}" >&2
    exit 1
  fi
}

wait_for_health() {
  local retries=40
  local delay=1
  for ((i=1; i<=retries; i++)); do
    if curl -fsS "${BFF_URL}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep "${delay}"
  done
  return 1
}

run_query_and_assert() {
  local tenant_id="$1"
  local user_id="$2"
  local expected_prefix="$3"
  local output_file="${TMP_DIR}/query-${tenant_id}.json"
  local request_id="e2e-${tenant_id}-${RUN_ID}"

  curl -fsS -X POST "${BFF_URL}/query" \
    -H "content-type: application/json" \
    -H "x-request-id: ${request_id}" \
    -d "$(cat <<JSON
{
  "table": "orders",
  "fields": ["id", "owner", "status", "tenant_id", "created_by"],
  "filters": {
    "keyword": "SO-",
    "status": "active"
  },
  "tenantId": "${tenant_id}",
  "userId": "${user_id}",
  "roles": ["USER"],
  "limit": 100
}
JSON
)" > "${output_file}"

  node -e '
const fs = require("node:fs");
const file = process.argv[1];
const expectedPrefix = process.argv[2];
const tenant = process.argv[3];
const data = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Array.isArray(data.rows)) {
  console.error("rows is not an array");
  process.exit(1);
}
if (data.rows.length === 0) {
  console.error("rows is empty");
  process.exit(1);
}
for (const row of data.rows) {
  if (typeof row.id !== "string" || !row.id.startsWith(expectedPrefix)) {
    console.error("unexpected row id", row.id);
    process.exit(1);
  }
  if (row.tenant_id !== tenant) {
    console.error("tenant leakage", row);
    process.exit(1);
  }
}
' "${output_file}" "${expected_prefix}" "${tenant_id}"

  printf "%s\n" "${request_id}"
}

assert_audit_record() {
  local request_id="$1"
  local status="$2"
  local expected_row_count="$3"
  local row_count_clause

  if [[ "${expected_row_count}" == "NULL" ]]; then
    row_count_clause="row_count IS NULL"
  else
    row_count_clause="row_count = ${expected_row_count}::INT"
  fi

  local count
  count="$(PGPASSWORD="${LC_DB_PASSWORD}" psql \
    -h "${LC_DB_HOST}" \
    -p "${LC_DB_PORT}" \
    -U "${LC_DB_USER}" \
    -d "${LC_DB_AUDIT_NAME}" \
    -t -A \
    -c "SELECT COUNT(*)::INT FROM bff_query_audit_logs WHERE request_id='${request_id}' AND status='${status}' AND ${row_count_clause};" | tr -d '\r')"

  if [[ "${count}" -lt 1 ]]; then
    log "audit assertion failed for request_id=${request_id}, status=${status}"
    exit 1
  fi
}

require_cmd node
require_cmd curl
require_cmd psql

if [[ ! -f "${SEED_SQL}" ]]; then
  echo "seed sql not found: ${SEED_SQL}" >&2
  exit 1
fi

if [[ ! -d "${ROOT_DIR}/node_modules" ]]; then
  log "installing dependencies"
  (cd "${WORKSPACE_DIR}" && pnpm install)
fi

if [[ ! -f "${ROOT_DIR}/dist/bff/src/main.js" ]]; then
  log "building bff"
  (cd "${WORKSPACE_DIR}" && pnpm --filter @meta-lc/bff run build)
fi

log "seeding demo data"
PGPASSWORD="${LC_DB_PASSWORD}" psql \
  -h "${LC_DB_HOST}" \
  -p "${LC_DB_PORT}" \
  -U "${LC_DB_USER}" \
  -d "${LC_DB_BUSINESS_NAME}" \
  -f "${SEED_SQL}" >/dev/null

log "starting bff"
(
  cd "${WORKSPACE_DIR}"
  LC_DB_HOST="${LC_DB_HOST}" \
  LC_DB_PORT="${LC_DB_PORT}" \
  LC_DB_USER="${LC_DB_USER}" \
  LC_DB_PASSWORD="${LC_DB_PASSWORD}" \
  LC_DB_NAME="${LC_DB_NAME}" \
  LC_DB_BUSINESS_NAME="${LC_DB_BUSINESS_NAME}" \
  LC_DB_AUDIT_NAME="${LC_DB_AUDIT_NAME}" \
  LC_DB_SSL="${LC_DB_SSL}" \
  PORT="${PORT}" \
  pnpm --filter @meta-lc/bff run start > "${TMP_DIR}/bff.log" 2>&1
) &
BFF_PID="$!"

log "waiting for health"
if ! wait_for_health; then
  cat "${TMP_DIR}/bff.log"
  exit 1
fi

log "validating tenant-a"
tenant_a_request_id="$(run_query_and_assert "tenant-a" "demo-tenant-a-user" "SO-A")"
assert_audit_record "${tenant_a_request_id}" "success" 1

log "validating tenant-b"
tenant_b_request_id="$(run_query_and_assert "tenant-b" "demo-tenant-b-user" "SO-B")"
assert_audit_record "${tenant_b_request_id}" "success" 1

log "validating failure sample"
failure_request_id="e2e-failure-${RUN_ID}"
status_code="$(curl -s -o "${TMP_DIR}/failure.json" -w "%{http_code}" -X POST "${BFF_URL}/query" \
  -H "content-type: application/json" \
  -H "x-request-id: ${failure_request_id}" \
  -d '{"table":"orders;drop","fields":["id"],"tenantId":"tenant-a","userId":"demo-tenant-a-user","roles":["USER"]}')"

if [[ "${status_code}" == "200" ]]; then
  cat "${TMP_DIR}/failure.json"
  exit 1
fi

assert_audit_record "${failure_request_id}" "failure" "NULL"

log "audit snapshot"
PGPASSWORD="${LC_DB_PASSWORD}" psql \
  -h "${LC_DB_HOST}" \
  -p "${LC_DB_PORT}" \
  -U "${LC_DB_USER}" \
  -d "${LC_DB_AUDIT_NAME}" \
  -c "SELECT request_id, tenant_id, status, row_count, created_at FROM bff_query_audit_logs ORDER BY id DESC LIMIT 6;"

log "query gate passed"
