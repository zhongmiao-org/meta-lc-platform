#!/usr/bin/env bash

set -euo pipefail

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEED_SQL="${WORKSPACE_DIR}/examples/orders-demo/infra/sql/001_orders_demo.sql"
TMP_DIR="$(mktemp -d)"
ENV_FILE="${WORKSPACE_DIR}/.env"
EXPLICIT_PORT="${PORT:-}"
EXPLICIT_BFF_URL="${BFF_URL:-}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

RUN_ID="${RUN_ID:-$(date +%s)}"
PORT="${EXPLICIT_PORT:-$((16000 + RUN_ID % 1000))}"
BFF_URL="${EXPLICIT_BFF_URL:-http://127.0.0.1:${PORT}}"
NODE_ENV="${NODE_ENV:-development}"
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
  printf "[view-gate] %s\n" "$1"
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

run_sql_file() {
  local database="$1"
  local sql_file="$2"

  (
    cd "${WORKSPACE_DIR}"
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

create_database() {
  local database="$1"

  (
    cd "${WORKSPACE_DIR}"
    node - "${LC_DB_HOST}" "${LC_DB_PORT}" "${LC_DB_USER}" "${LC_DB_PASSWORD}" "postgres" "${LC_DB_SSL}" "${database}" <<'NODE'
const { Client } = require("pg");

const [host, port, user, password, database, sslRaw, targetDatabase] = process.argv.slice(2);
const client = new Client({
  host,
  port: Number(port),
  user,
  password,
  database,
  ssl: sslRaw === "true" ? { rejectUnauthorized: false } : false
});

function quoteIdentifier(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }
  return `"${value}"`;
}

(async () => {
  await client.connect();
  try {
    await client.query(`CREATE DATABASE ${quoteIdentifier(targetDatabase)}`);
  } catch (error) {
    if (!String(error.message || error).toLowerCase().includes("already exists")) {
      throw error;
    }
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

run_view_request() {
  local request_id="$1"
  local tenant_id="$2"
  local user_id="$3"
  local owner="$4"
  local output_file="$5"

  curl -fsS -X POST "${BFF_URL}/view/orders-workbench" \
    -H "content-type: application/json" \
    -H "x-request-id: ${request_id}" \
    -d "$(cat <<JSON
{
  "tenantId": "${tenant_id}",
  "userId": "${user_id}",
  "roles": ["USER"],
  "input": {
    "owner": "${owner}",
    "limit": 20
  }
}
JSON
)" > "${output_file}"
}

assert_view_rows() {
  local output_file="$1"
  local request_id="$2"
  local tenant_id="$3"
  local expected_id="$4"
  local expected_owner="$5"

  node - "${output_file}" "${request_id}" "${tenant_id}" "${expected_id}" "${expected_owner}" <<'NODE'
const fs = require("node:fs");

const [file, requestId, tenantId, expectedId, expectedOwner] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const viewModel = data.viewModel;

if (data.requestId !== requestId) {
  console.error("requestId mismatch", data);
  process.exit(1);
}
if (!viewModel || viewModel.requestId !== requestId || viewModel.tenantId !== tenantId) {
  console.error("unexpected view model metadata", data);
  process.exit(1);
}
if (viewModel.owner !== expectedOwner) {
  console.error("unexpected owner echo", data);
  process.exit(1);
}
if (!Array.isArray(viewModel.rows)) {
  console.error("viewModel.rows is not an array", data);
  process.exit(1);
}
if (viewModel.rows.length !== 1) {
  console.error("unexpected row count", viewModel.rows.length, data);
  process.exit(1);
}

const [row] = viewModel.rows;
if (row.id !== expectedId || row.owner !== expectedOwner) {
  console.error("unexpected row payload", row);
  process.exit(1);
}
if ("tenant_id" in row || "created_by" in row || "org_id" in row) {
  console.error("view leaked internal datasource fields", row);
  process.exit(1);
}
NODE
}

assert_missing_view() {
  local request_id="$1"
  local output_file="${TMP_DIR}/missing-view.json"
  local status_code

  status_code="$(curl -sS -o "${output_file}" -w "%{http_code}" -X POST "${BFF_URL}/view/not-found" \
    -H "content-type: application/json" \
    -H "x-request-id: ${request_id}" \
    -d '{"tenantId":"tenant-a","userId":"demo-tenant-a-user","roles":["USER"],"input":{"owner":"Alice","limit":20}}')"

  if [[ "${status_code}" != "404" ]]; then
    cat "${output_file}"
    exit 1
  fi
}

require_cmd node
require_cmd curl

if [[ ! -f "${SEED_SQL}" ]]; then
  echo "seed sql not found: ${SEED_SQL}" >&2
  exit 1
fi

if [[ ! -d "${WORKSPACE_DIR}/node_modules" ]]; then
  log "installing dependencies"
  (cd "${WORKSPACE_DIR}" && pnpm install)
fi

log "building demo server dependencies"
(cd "${WORKSPACE_DIR}" && pnpm --filter @zhongmiao/meta-lc-bff... build)

log "bootstrapping databases through infra SQL"
create_database "${LC_DB_META_NAME}"
create_database "${LC_DB_BUSINESS_NAME}"
create_database "${LC_DB_AUDIT_NAME}"
run_sql_file "${LC_DB_META_NAME}" "${WORKSPACE_DIR}/infra/sql/bootstrap/100_meta_baseline.sql"
run_sql_file "${LC_DB_BUSINESS_NAME}" "${WORKSPACE_DIR}/infra/sql/bootstrap/200_business_baseline.sql"
run_sql_file "${LC_DB_AUDIT_NAME}" "${WORKSPACE_DIR}/infra/sql/bootstrap/300_audit_baseline.sql"

log "starting orders demo bff"
(
  cd "${WORKSPACE_DIR}"
  NODE_ENV="${NODE_ENV}" \
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
  node --experimental-strip-types examples/orders-demo/server.ts > "${TMP_DIR}/bff.log" 2>&1
) &
BFF_PID="$!"

log "waiting for health"
if ! wait_for_health; then
  cat "${TMP_DIR}/bff.log"
  exit 1
fi

log "seeding demo data"
run_sql_file "${LC_DB_BUSINESS_NAME}" "${SEED_SQL}"

log "validating tenant-a view gateway"
tenant_a_request_id="e2e-view-tenant-a-${RUN_ID}"
tenant_a_output="${TMP_DIR}/tenant-a-view.json"
run_view_request "${tenant_a_request_id}" "tenant-a" "demo-tenant-a-user" "Alice" "${tenant_a_output}"
assert_view_rows "${tenant_a_output}" "${tenant_a_request_id}" "tenant-a" "SO-A1001" "Alice"

log "validating tenant-b view gateway"
tenant_b_request_id="e2e-view-tenant-b-${RUN_ID}"
tenant_b_output="${TMP_DIR}/tenant-b-view.json"
run_view_request "${tenant_b_request_id}" "tenant-b" "demo-tenant-b-user" "Brenda" "${tenant_b_output}"
assert_view_rows "${tenant_b_output}" "${tenant_b_request_id}" "tenant-b" "SO-B1001" "Brenda"

log "validating view lookup failure"
assert_missing_view "e2e-view-missing-${RUN_ID}"

log "runtime view gate passed"
