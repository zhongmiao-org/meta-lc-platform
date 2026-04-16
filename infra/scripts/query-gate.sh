#!/usr/bin/env bash
set -euo pipefail
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"${WORKSPACE_DIR}/infra/scripts/up.sh"
cd "${WORKSPACE_DIR}"
pnpm query-gate
