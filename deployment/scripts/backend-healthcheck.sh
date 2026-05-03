#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"

echo "Checking live endpoint"
curl --fail --silent --show-error "${BASE_URL}/live" >/dev/null

echo "Checking health endpoint"
curl --fail --silent --show-error "${BASE_URL}/health" >/dev/null

echo "MAET backend healthcheck passed"
