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

BFF_URL="${BFF_URL:-http://127.0.0.1:6000}"
PORT="${PORT:-6000}"
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

run_mutation_request() {
  local request_id="$1"
  local payload="$2"
  local output_file="$3"

  curl -sS -o "${output_file}" -w "%{http_code}" -X POST "${BFF_URL}/mutation" \
    -H "content-type: application/json" \
    -H "x-request-id: ${request_id}" \
    -d "${payload}"
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

query_order_and_assert() {
  local tenant_id="$1"
  local user_id="$2"
  local order_id="$3"
  local expected_owner="$4"
  local expected_channel="$5"
  local expected_priority="$6"
  local expected_status="$7"
  local output_file="${TMP_DIR}/query-${order_id}.json"
  local request_id="e2e-order-${order_id}-${RUN_ID}"

  curl -fsS -X POST "${BFF_URL}/query" \
    -H "content-type: application/json" \
    -H "x-request-id: ${request_id}" \
    -d "$(cat <<JSON
{
  "table": "orders",
  "fields": ["id", "owner", "channel", "priority", "status", "tenant_id", "created_by"],
  "filters": {
    "keyword": "${order_id}"
  },
  "tenantId": "${tenant_id}",
  "userId": "${user_id}",
  "roles": ["USER"],
  "limit": 20
}
JSON
)" > "${output_file}"

  local row_count
  row_count="$(node -e '
const fs = require("node:fs");
const [file, orderId, tenantId, owner, channel, priority, status] = process.argv.slice(1);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Array.isArray(data.rows)) {
  console.error("rows is not an array");
  process.exit(1);
}
if (data.rows.length !== 1) {
  console.error("unexpected row count", data.rows.length);
  process.exit(1);
}
const [row] = data.rows;
if (
  row.id !== orderId ||
  row.tenant_id !== tenantId ||
  row.owner !== owner ||
  row.channel !== channel ||
  row.priority !== priority ||
  row.status !== status
) {
  console.error("unexpected row payload", row);
  process.exit(1);
}
process.stdout.write(String(data.rows.length));
' "${output_file}" "${order_id}" "${tenant_id}" "${expected_owner}" "${expected_channel}" "${expected_priority}" "${expected_status}")"

  printf "%s %s\n" "${request_id}" "${row_count}"
}

query_order_and_assert_missing() {
  local tenant_id="$1"
  local user_id="$2"
  local order_id="$3"
  local output_file="${TMP_DIR}/query-missing-${order_id}.json"
  local request_id="e2e-order-missing-${order_id}-${RUN_ID}"

  curl -fsS -X POST "${BFF_URL}/query" \
    -H "content-type: application/json" \
    -H "x-request-id: ${request_id}" \
    -d "$(cat <<JSON
{
  "table": "orders",
  "fields": ["id", "owner", "channel", "priority", "status", "tenant_id", "created_by"],
  "filters": {
    "keyword": "${order_id}"
  },
  "tenantId": "${tenant_id}",
  "userId": "${user_id}",
  "roles": ["USER"],
  "limit": 20
}
JSON
)" > "${output_file}"

  local row_count
  row_count="$(node -e '
const fs = require("node:fs");
const file = process.argv[1];
const data = JSON.parse(fs.readFileSync(file, "utf8"));
if (!Array.isArray(data.rows)) {
  console.error("rows is not an array");
  process.exit(1);
}
if (data.rows.length !== 0) {
  console.error("expected no rows", data.rows);
  process.exit(1);
}
process.stdout.write("0");
' "${output_file}")"

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

assert_mutation_audit_record() {
  local request_id="$1"
  local operation="$2"
  local status="$3"
  local tenant_id="$4"
  local user_id="$5"

  local count
  count="$(query_mutation_audit_count "${request_id}" "${operation}" "${status}" "${tenant_id}" "${user_id}" | tr -d '\r')"

  if [[ "${count}" -lt 1 ]]; then
    log "mutation audit assertion failed for request_id=${request_id}, operation=${operation}, status=${status}"
    exit 1
  fi
}

assert_query_permission_details() {
  local request_id="$1"
  local status="$2"
  local tenant_id="$3"
  local user_id="$4"

  local count
  count="$(query_query_permission_details_count "${request_id}" "${status}" "${tenant_id}" "${user_id}" | tr -d '\r')"

  if [[ "${count}" -lt 1 ]]; then
    log "query permission detail assertion failed for request_id=${request_id}, status=${status}"
    exit 1
  fi
}

assert_mutation_denied_integrity_record() {
  local request_id="$1"
  local operation="$2"
  local tenant_id="$3"
  local user_id="$4"

  local count
  count="$(query_mutation_denied_integrity_count "${request_id}" "${operation}" "${tenant_id}" "${user_id}" | tr -d '\r')"

  if [[ "${count}" -lt 1 ]]; then
    log "mutation denied integrity audit assertion failed for request_id=${request_id}, operation=${operation}"
    exit 1
  fi
}

assert_business_order_unchanged() {
  local order_id="$1"
  local expected_owner="$2"
  local expected_channel="$3"
  local expected_priority="$4"
  local expected_status="$5"
  local expected_org_id="$6"

  local count
  count="$(query_business_order_unchanged_count "${order_id}" "${expected_owner}" "${expected_channel}" "${expected_priority}" "${expected_status}" "${expected_org_id}" | tr -d '\r')"

  if [[ "${count}" -lt 1 ]]; then
    log "business order unchanged assertion failed for order_id=${order_id}"
    exit 1
  fi
}

assert_query_denied() {
  local request_id="$1"
  local tenant_id="$2"
  local user_id="$3"
  local org_id="$4"
  local output_file="$5"

  local status_code
  status_code="$(curl -sS -o "${output_file}" -w "%{http_code}" -X POST "${BFF_URL}/query" \
    -H "content-type: application/json" \
    -H "x-request-id: ${request_id}" \
    -d "$(cat <<JSON
{
  "table": "orders",
  "fields": ["id", "owner", "org_id", "tenant_id", "created_by"],
  "filters": {
    "org_id": "${org_id}"
  },
  "tenantId": "${tenant_id}",
  "userId": "${user_id}",
  "roles": ["USER"],
  "limit": 20
}
JSON
)")"

  if [[ "${status_code}" != "403" ]]; then
    cat "${output_file}"
    exit 1
  fi

  assert_audit_record "${request_id}" "denied" "NULL"
  assert_query_permission_details "${request_id}" "denied" "${tenant_id}" "${user_id}"
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

query_mutation_audit_count() {
  local request_id="$1"
  local operation="$2"
  local status="$3"
  local tenant_id="$4"
  local user_id="$5"

  (
    cd "${ROOT_DIR}"
    node - "${LC_DB_HOST}" "${LC_DB_PORT}" "${LC_DB_USER}" "${LC_DB_PASSWORD}" "${LC_DB_AUDIT_NAME}" "${LC_DB_SSL}" "${request_id}" "${operation}" "${status}" "${tenant_id}" "${user_id}" <<'NODE'
const { Client } = require("pg");

const [host, port, user, password, database, sslRaw, requestId, operation, status, tenantId, userId] = process.argv.slice(2);
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
      `SELECT COUNT(*)::INT AS count
       FROM mutation_logs
       WHERE request_id = $1
         AND operation = $2
         AND status = $3
         AND tenant_id = $4
         AND user_id = $5;`,
      [requestId, operation, status, tenantId, userId]
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

query_query_permission_details_count() {
  local request_id="$1"
  local status="$2"
  local tenant_id="$3"
  local user_id="$4"

  (
    cd "${ROOT_DIR}"
    node - "${LC_DB_HOST}" "${LC_DB_PORT}" "${LC_DB_USER}" "${LC_DB_PASSWORD}" "${LC_DB_AUDIT_NAME}" "${LC_DB_SSL}" "${request_id}" "${status}" "${tenant_id}" "${user_id}" <<'NODE'
const { Client } = require("pg");

const [host, port, user, password, database, sslRaw, requestId, status, tenantId, userId] = process.argv.slice(2);
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
      `SELECT COUNT(*)::INT AS count
       FROM query_logs
       WHERE request_id = $1
         AND status = $2
         AND tenant_id = $3
         AND user_id = $4
         AND permission_scope IS NOT NULL
         AND permission_org_count IS NOT NULL
         AND permission_reason IS NOT NULL;`,
      [requestId, status, tenantId, userId]
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

query_mutation_denied_integrity_count() {
  local request_id="$1"
  local operation="$2"
  local tenant_id="$3"
  local user_id="$4"

  (
    cd "${ROOT_DIR}"
    node - "${LC_DB_HOST}" "${LC_DB_PORT}" "${LC_DB_USER}" "${LC_DB_PASSWORD}" "${LC_DB_AUDIT_NAME}" "${LC_DB_SSL}" "${request_id}" "${operation}" "${tenant_id}" "${user_id}" <<'NODE'
const { Client } = require("pg");

const [host, port, user, password, database, sslRaw, requestId, operation, tenantId, userId] = process.argv.slice(2);
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
      `SELECT COUNT(*)::INT AS count
       FROM mutation_logs
       WHERE request_id = $1
         AND operation = $2
         AND status = 'denied'
         AND tenant_id = $3
         AND user_id = $4
         AND permission_scope IS NOT NULL
         AND permission_org_count IS NOT NULL
         AND permission_reason IS NOT NULL;`,
      [requestId, operation, tenantId, userId]
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

query_business_order_unchanged_count() {
  local order_id="$1"
  local expected_owner="$2"
  local expected_channel="$3"
  local expected_priority="$4"
  local expected_status="$5"
  local expected_org_id="$6"

  (
    cd "${ROOT_DIR}"
    node - "${LC_DB_HOST}" "${LC_DB_PORT}" "${LC_DB_USER}" "${LC_DB_PASSWORD}" "${LC_DB_BUSINESS_NAME}" "${LC_DB_SSL}" "${order_id}" "${expected_owner}" "${expected_channel}" "${expected_priority}" "${expected_status}" "${expected_org_id}" <<'NODE'
const { Client } = require("pg");

const [host, port, user, password, database, sslRaw, orderId, owner, channel, priority, status, orgId] = process.argv.slice(2);
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
      `SELECT COUNT(*)::INT AS count
       FROM orders
       WHERE id = $1
         AND owner = $2
         AND channel = $3
         AND priority = $4
         AND status = $5
         AND org_id = $6;`,
      [orderId, owner, channel, priority, status, orgId]
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
    const queryAudit = await client.query(
      `SELECT request_id, tenant_id, status, row_count, created_at
       FROM bff_query_audit_logs
       ORDER BY id DESC
       LIMIT 6;`
    );
    const mutationAudit = await client.query(
      `SELECT request_id, tenant_id, user_id, operation, status, created_at
       FROM mutation_logs
       ORDER BY id DESC
       LIMIT 6;`
    );
    console.log("query audit");
    console.table(queryAudit.rows);
    console.log("mutation audit");
    console.table(mutationAudit.rows);
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

log "validating query permission denied sample"
query_denied_request_id="e2e-query-denied-${RUN_ID}"
assert_query_denied "${query_denied_request_id}" "tenant-a" "demo-tenant-a-user" "dept-b" "${TMP_DIR}/query-denied.json"

tenant_id="tenant-a"
user_id="demo-tenant-a-user"
test_order_id="SO-AE2E-${RUN_ID}"

log "validating mutation create success"
create_request_id="e2e-mutation-create-${RUN_ID}"
create_status_code="$(run_mutation_request "${create_request_id}" "$(cat <<JSON
{
  "table": "orders",
  "operation": "create",
  "tenantId": "${tenant_id}",
  "userId": "${user_id}",
  "roles": ["USER"],
  "orgId": "dept-a",
  "data": {
    "id": "${test_order_id}",
    "owner": "Gate Create",
    "channel": "web",
    "priority": "medium",
    "status": "active"
  }
}
JSON
)" "${TMP_DIR}/mutation-create.json")"
if [[ "${create_status_code}" != "201" && "${create_status_code}" != "200" ]]; then
  cat "${TMP_DIR}/mutation-create.json"
  exit 1
fi
node -e '
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (data.rowCount !== 1 || data.row?.id !== process.argv[2]) {
  console.error("unexpected create response", data);
  process.exit(1);
}
' "${TMP_DIR}/mutation-create.json" "${test_order_id}"
assert_mutation_audit_record "${create_request_id}" "create" "success" "${tenant_id}" "${user_id}"
read -r create_query_request_id create_query_row_count <<< "$(query_order_and_assert "${tenant_id}" "${user_id}" "${test_order_id}" "Gate Create" "web" "medium" "active")"
assert_audit_record "${create_query_request_id}" "success" "${create_query_row_count}"

log "validating mutation duplicate create failure"
duplicate_request_id="e2e-mutation-duplicate-${RUN_ID}"
duplicate_status_code="$(run_mutation_request "${duplicate_request_id}" "$(cat <<JSON
{
  "table": "orders",
  "operation": "create",
  "tenantId": "${tenant_id}",
  "userId": "${user_id}",
  "roles": ["USER"],
  "orgId": "dept-a",
  "data": {
    "id": "${test_order_id}",
    "owner": "Gate Create",
    "channel": "web",
    "priority": "medium",
    "status": "active"
  }
}
JSON
)" "${TMP_DIR}/mutation-duplicate.json")"
if [[ "${duplicate_status_code}" != "409" ]]; then
  cat "${TMP_DIR}/mutation-duplicate.json"
  exit 1
fi
assert_mutation_audit_record "${duplicate_request_id}" "create" "failure" "${tenant_id}" "${user_id}"

log "validating mutation update success"
update_request_id="e2e-mutation-update-${RUN_ID}"
update_status_code="$(run_mutation_request "${update_request_id}" "$(cat <<JSON
{
  "table": "orders",
  "operation": "update",
  "tenantId": "${tenant_id}",
  "userId": "${user_id}",
  "roles": ["USER"],
  "orgId": "dept-a",
  "key": {
    "id": "${test_order_id}"
  },
  "data": {
    "id": "${test_order_id}",
    "owner": "Gate Update",
    "channel": "partner",
    "priority": "high",
    "status": "paused"
  }
}
JSON
)" "${TMP_DIR}/mutation-update.json")"
if [[ "${update_status_code}" != "200" && "${update_status_code}" != "201" ]]; then
  cat "${TMP_DIR}/mutation-update.json"
  exit 1
fi
node -e '
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (data.rowCount !== 1 || data.row?.owner !== process.argv[2] || data.row?.status !== process.argv[3]) {
  console.error("unexpected update response", data);
  process.exit(1);
}
' "${TMP_DIR}/mutation-update.json" "Gate Update" "paused"
assert_mutation_audit_record "${update_request_id}" "update" "success" "${tenant_id}" "${user_id}"
read -r update_query_request_id update_query_row_count <<< "$(query_order_and_assert "${tenant_id}" "${user_id}" "${test_order_id}" "Gate Update" "partner" "high" "paused")"
assert_audit_record "${update_query_request_id}" "success" "${update_query_row_count}"

log "validating mutation delete success"
delete_request_id="e2e-mutation-delete-${RUN_ID}"
delete_status_code="$(run_mutation_request "${delete_request_id}" "$(cat <<JSON
{
  "table": "orders",
  "operation": "delete",
  "tenantId": "${tenant_id}",
  "userId": "${user_id}",
  "roles": ["USER"],
  "key": {
    "id": "${test_order_id}"
  }
}
JSON
)" "${TMP_DIR}/mutation-delete.json")"
if [[ "${delete_status_code}" != "200" && "${delete_status_code}" != "201" ]]; then
  cat "${TMP_DIR}/mutation-delete.json"
  exit 1
fi
node -e '
const fs = require("node:fs");
const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (data.rowCount !== 1 || data.row?.id !== process.argv[2]) {
  console.error("unexpected delete response", data);
  process.exit(1);
}
' "${TMP_DIR}/mutation-delete.json" "${test_order_id}"
assert_mutation_audit_record "${delete_request_id}" "delete" "success" "${tenant_id}" "${user_id}"
read -r delete_query_request_id delete_query_row_count <<< "$(query_order_and_assert_missing "${tenant_id}" "${user_id}" "${test_order_id}")"
assert_audit_record "${delete_query_request_id}" "success" "${delete_query_row_count}"

log "validating mutation permission denied sample"
mutation_denied_request_id="e2e-mutation-denied-${RUN_ID}"
mutation_denied_status_code="$(run_mutation_request "${mutation_denied_request_id}" "$(cat <<JSON
{
  "table": "orders",
  "operation": "update",
  "tenantId": "tenant-a",
  "userId": "demo-tenant-a-user",
  "roles": ["USER"],
  "orgId": "dept-b",
  "key": {
    "id": "SO-A2001"
  },
  "data": {
    "id": "SO-A2001",
    "owner": "should-fail",
    "channel": "web",
    "priority": "low",
    "status": "active"
  }
}
JSON
)" "${TMP_DIR}/mutation-denied.json")"
if [[ "${mutation_denied_status_code}" != "403" ]]; then
  cat "${TMP_DIR}/mutation-denied.json"
  exit 1
fi
assert_mutation_audit_record "${mutation_denied_request_id}" "update" "denied" "tenant-a" "demo-tenant-a-user"
assert_mutation_denied_integrity_record "${mutation_denied_request_id}" "update" "tenant-a" "demo-tenant-a-user"
assert_business_order_unchanged "SO-A2001" "A-Manager-Only" "partner" "high" "active" "dept-b"

log "audit snapshot"
print_audit_snapshot

log "query and mutation gate passed"
