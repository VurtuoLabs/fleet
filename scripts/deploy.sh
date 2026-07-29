#!/usr/bin/env bash
set -euo pipefail

# Fleet - build the UI Bundle, deploy force-app, and assign the base permission set.
#
# Usage:
#   bash scripts/deploy.sh               # build UI, deploy metadata, assign Fleet_Administrator
#   bash scripts/deploy.sh --check       # validate-only (dry run), no changes committed
#   bash scripts/deploy.sh --no-ui       # skip the Vite build, deploy metadata as-is
#
# Flags may be combined: bash scripts/deploy.sh --no-ui --check

ALIAS="${ALIAS:-fleet}"
UI_DIR="force-app/main/default/uiBundles/fleetUi"
# CONTRACT §13 assigns Fleet_Administrator. It is also the only seat with FLS on
# every field, so a Fleet_Viewer-only admin sees "No such column" errors in the
# console and in Apex tests.
PERMSET="Fleet_Administrator"

BUILD_UI=1
CHECK=0

for arg in "$@"; do
  case "$arg" in
    --no-ui) BUILD_UI=0 ;;
    --check) CHECK=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

if [[ "${BUILD_UI}" -eq 1 ]]; then
  echo "==> Building UI Bundle (fleetUi)..."
  if [[ ! -d "${UI_DIR}/node_modules" ]]; then
    echo "    Installing UI dependencies..."
    npm --prefix "${UI_DIR}" install
  fi
  npm --prefix "${UI_DIR}" run build
else
  echo "==> Skipping UI build (--no-ui)."
fi

DEPLOY_ARGS=(project deploy start --source-dir force-app --target-org "${ALIAS}" --wait 30)
if [[ "${CHECK}" -eq 1 ]]; then
  echo "==> Validating deployment (--check, dry run)..."
  DEPLOY_ARGS+=(--dry-run)
else
  echo "==> Deploying force-app to '${ALIAS}'..."
fi

sf "${DEPLOY_ARGS[@]}"

if [[ "${CHECK}" -eq 1 ]]; then
  echo "==> Validation complete. No changes were committed."
  exit 0
fi

echo "==> Assigning base permission set '${PERMSET}'..."
sf org assign permset --name "${PERMSET}" --target-org "${ALIAS}" || \
  echo "    (permset '${PERMSET}' may already be assigned - continuing)"

echo "==> Deploy complete. Open the app with:"
echo "    sf org open --target-org ${ALIAS} --path lightning/app/Fleet"
