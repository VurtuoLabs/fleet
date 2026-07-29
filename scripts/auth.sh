#!/usr/bin/env bash
set -euo pipefail

# Fleet - authorize a target org and alias it "fleet".
#
# Usage:
#   bash scripts/auth.sh                 # web login, alias "fleet"
#   bash scripts/auth.sh --scratch       # create a Developer scratch org aliased "fleet"
#   ALIAS=myorg bash scripts/auth.sh     # override the alias

ALIAS="${ALIAS:-fleet}"
SCRATCH_DEF="config/project-scratch-def.json"

if [[ "${1:-}" == "--scratch" ]]; then
  echo "Creating scratch org (alias: ${ALIAS})..."
  sf org create scratch \
    --definition-file "${SCRATCH_DEF}" \
    --alias "${ALIAS}" \
    --set-default \
    --duration-days 30
else
  echo "Authorizing org via web login (alias: ${ALIAS})..."
  sf org login web \
    --alias "${ALIAS}" \
    --set-default \
    --instance-url "https://login.salesforce.com"
fi

echo "Done. Default org is now '${ALIAS}'."
sf org display --target-org "${ALIAS}"
