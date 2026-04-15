#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="$(cd "${ROOT_DIR}/../.." && pwd)"
SEED_SQL="${ROOT_DIR}/scripts/sql/001_orders_demo.sql"
TMP_DIR="$(mktemp -d)"
ENV_FILE="${WORKSPACE_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

BFF_URL="${BFF_URL:-http://127.0.0.1:3000}"
PORT="${PORT:-3000}"
RUN_ID="${RUN_ID:-$(date +%s)}"
NODE_ENV="${NODE_ENV:-development}"
LC_DB_BOOTSTRAP_MODE="${LC_DB_BOOTSTRAP_MODE:-auto}"

LC_DB_HOST="${LC_DB_HOST:-127.0.0.1}"
LC_DB_PORT="${LC_DB_PORT:-5432}"
LC_DB_USER="${LC_DB_USER:-lowcode}"
LC_DB_PASSWORD="${LC_DB_PASSWORD:-lowcode}"
LC_DB_NAME="${LC_DB_NAME:-business_db}"
LC_DB_META_NAME="${LC_DB_META_NAME:-meta_db}"
LC_DB_BUSINESS_NAME="${LC_DB_BUSINESS_NAME:-${LC_DB_NAME}}"
LC_DB_AUDIT_NAME="${LC_DB_AUDIT_NAME:-audit_db}"
LC_DB_SSL="${LC_DB_SSL:-false}"

BFF_PID=""

cleanup() {
  if [[ -n "${BFF_PID}" ]] && kill -0 "${BFF_PID}" >/dev/null 2>&1; then
    kill "${BFF_PID}" >/dev/null 2>&1 || true
    wait "${BFF_PID}" 2>/dev/null || true
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

  local row_count
  row_count="$(node -e '
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
process.stdout.write(String(data.rows.length));
' "${output_file}" "${expected_prefix}" "${tenant_id}")"

  printf "%s %s\n" "${request_id}" "${row_count}"
}

assert_audit_record() {
  local request_id="$1"
  local status="$2"
  local expected_row_count="$3"

  local count
  count="$(query_audit_count "${request_id}" "${status}" "${expected_row_count}" | tr -d '\r')"

  if [[ "${count}" -lt 1 ]]; then
    log "audit assertion failed for request_id=${request_id}, status=${status}"
    exit 1
  fi
}

require_cmd node
require_cmd curl

if [[ ! -f "${SEED_SQL}" ]]; then
  echo "seed sql not found: ${SEED_SQL}" >&2
  exit 1
fi

if [[ ! -d "${ROOT_DIR}/node_modules" ]]; then
  log "installing dependencies"
  (cd "${WORKSPACE_DIR}" && pnpm install)
fi

if [[ ! -f "${WORKSPACE_DIR}/apps/bff-server/dist/apps/bff-server/src/main.js" ]]; then
  log "building bff-server and dependencies"
  (cd "${WORKSPACE_DIR}" && pnpm --filter @meta-lc/bff-server... build)
fi

run_sql_file() {
  local database="$1"
  local sql_file="$2"

  (
    cd "${ROOT_DIR}"
    node - "${LC_DB_HOST}" "${LC_DB_PORT}" "${LC_DB_USER}" "${LC_DB_PASSWORD}" "${database}" "${LC_DB_SSL}" "${sql_file}" <<'NODE'
const { Client } = require("pg");
const fs = require("node:fs");

const [host, port, user, password, database, sslRaw, sqlFile] = process.argv.slice(2);
const client = new Client({
  host,
  port: Number(port),
  user,
  password,
  database,
  ssl: sslRaw === "true" ? { rejectUnauthorized: false } : false
});

(async () => {
  await client.connect();
  try {
    await client.query(fs.readFileSync(sqlFile, "utf8"));
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
  )
}

query_audit_count() {
  local request_id="$1"
  local status="$2"
  local expected_row_count="$3"

  (
    cd "${ROOT_DIR}"
    node - "${LC_DB_HOST}" "${LC_DB_PORT}" "${LC_DB_USER}" "${LC_DB_PASSWORD}" "${LC_DB_AUDIT_NAME}" "${LC_DB_SSL}" "${request_id}" "${status}" "${expected_row_count}" <<'NODE'
const { Client } = require("pg");

const [host, port, user, password, database, sslRaw, requestId, status, expectedRowCount] = process.argv.slice(2);
const client = new Client({
  host,
  port: Number(port),
  user,
  password,
  database,
  ssl: sslRaw === "true" ? { rejectUnauthorized: false } : false
});

(async () => {
  await client.connect();
  try {
    const rowCountCondition =
      expectedRowCount === "NULL"
        ? "row_count IS NULL"
        : "row_count = $3::INT";
    const params = expectedRowCount === "NULL"
      ? [requestId, status]
      : [requestId, status, Number(expectedRowCount)];
    const result = await client.query(
      `SELECT COUNT(*)::INT AS count
       FROM bff_query_audit_logs
       WHERE request_id = $1
         AND status = $2
         AND ${rowCountCondition};`,
      params
    );
    process.stdout.write(String(result.rows[0]?.count ?? 0));
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
  )
}

print_audit_snapshot() {
  (
    cd "${ROOT_DIR}"
    node - "${LC_DB_HOST}" "${LC_DB_PORT}" "${LC_DB_USER}" "${LC_DB_PASSWORD}" "${LC_DB_AUDIT_NAME}" "${LC_DB_SSL}" <<'NODE'
const { Client } = require("pg");

const [host, port, user, password, database, sslRaw] = process.argv.slice(2);
const client = new Client({
  host,
  port: Number(port),
  user,
  password,
  database,
  ssl: sslRaw === "true" ? { rejectUnauthorized: false } : false
});

(async () => {
  await client.connect();
  try {
    const result = await client.query(
      `SELECT request_id, tenant_id, status, row_count, created_at
       FROM bff_query_audit_logs
       ORDER BY id DESC
       LIMIT 6;`
    );
    console.table(result.rows);
  } finally {
    await client.end();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
  )
}

log "starting bff"
(
  cd "${WORKSPACE_DIR}"
  NODE_ENV="${NODE_ENV}" \
  LC_DB_BOOTSTRAP_MODE="${LC_DB_BOOTSTRAP_MODE}" \
  LC_DB_HOST="${LC_DB_HOST}" \
  LC_DB_PORT="${LC_DB_PORT}" \
  LC_DB_USER="${LC_DB_USER}" \
  LC_DB_PASSWORD="${LC_DB_PASSWORD}" \
  LC_DB_NAME="${LC_DB_NAME}" \
  LC_DB_META_NAME="${LC_DB_META_NAME}" \
  LC_DB_BUSINESS_NAME="${LC_DB_BUSINESS_NAME}" \
  LC_DB_AUDIT_NAME="${LC_DB_AUDIT_NAME}" \
  LC_DB_SSL="${LC_DB_SSL}" \
  PORT="${PORT}" \
  pnpm --filter @meta-lc/bff-server run start > "${TMP_DIR}/bff.log" 2>&1
) &
BFF_PID="$!"

log "waiting for health"
if ! wait_for_health; then
  cat "${TMP_DIR}/bff.log"
  exit 1
fi

log "seeding demo data"
run_sql_file "${LC_DB_BUSINESS_NAME}" "${SEED_SQL}"

log "validating tenant-a"
read -r tenant_a_request_id tenant_a_row_count <<< "$(run_query_and_assert "tenant-a" "demo-tenant-a-user" "SO-A")"
assert_audit_record "${tenant_a_request_id}" "success" "${tenant_a_row_count}"

log "validating tenant-b"
read -r tenant_b_request_id tenant_b_row_count <<< "$(run_query_and_assert "tenant-b" "demo-tenant-b-user" "SO-B")"
assert_audit_record "${tenant_b_request_id}" "success" "${tenant_b_row_count}"

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
print_audit_snapshot

log "query gate passed"
