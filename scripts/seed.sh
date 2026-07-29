#!/usr/bin/env bash
set -euo pipefail

# Fleet - seed demo data (CONTRACT §12).
#
# Registers the org's real Agentforce agents as monitored agents, gives each a
# golden set, archives captured turns, and produces one drifting agent whose
# failing cases are attributed to the change event that caused them. Demo data is
# owned by "Alex".
#
# Usage:
#   bash scripts/seed.sh                 # seed the org aliased "fleet"
#   ALIAS=my-org bash scripts/seed.sh    # seed a different org
#
# Each step runs as its own anonymous Apex execution, and that is deliberate:
# Fleet_Trace__b is a Big Object, and Database.insertImmediate fails with
# "pending uncommitted work" if ordinary DML has already run in the transaction.
# Splitting the steps keeps the Big Object write first and alone in step 2.

ALIAS="${ALIAS:-fleet}"
SEED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/seed"

STEPS=(
  "00_owner_queue.apex:Creating the finding owner queue"
  "01_agents_and_goldenset.apex:Registering agents and golden sets"
  "02_traces.apex:Archiving captured turns (Big Object)"
  "03_runs_findings_change.apex:Seeding runs, change events, findings, remediation"
)

for step in "${STEPS[@]}"; do
  file="${step%%:*}"
  label="${step#*:}"
  echo "==> ${label}..."
  sf apex run --file "${SEED_DIR}/${file}" --target-org "${ALIAS}"
done

echo
echo "==> Seed complete. Open the console with:"
echo "    sf org open --target-org ${ALIAS} --path lightning/app/Fleet"
