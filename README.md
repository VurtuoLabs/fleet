# Fleet

**Continuous agent QA and behavioral drift detection for Agentforce.**

Fleet answers one question on a loop: *is this agent still behaving the way we approved?*
It captures every agent turn, replays a curated **golden set** against each monitored agent,
scores the deviation from a blessed **baseline**, attributes any drift to the change that
caused it (a deploy, a KB edit, a model rollforward, a prompt edit), and drives remediation
with an approval trail. It is Salesforce-native - a React UI Bundle running on Multi-Framework,
with all logic in Apex. No external services.

The loop: **Capture → Calibrate → Judge → Attribute → Remediate.**

## Architecture at a glance

- **Objects** - `Fleet_Agent__c`, `Golden_Case__c`, `Assertion__c`, `Calibration_Run__c`,
  `Case_Result__c`, `Deviation_Finding__c`, `Remediation__c`, `Change_Event__c`,
  `Fleet_User_Preference__c`.
- **Capture layer** - the `Fleet_Turn__e` platform event taps every agent turn; a trigger
  archives it into the `Fleet_Trace__b` big object.
- **Admin config** - thresholds, detectors, severity policy, assertion types, and console
  views live in Custom Metadata (`Fleet_*__mdt`), changeable without a deploy.
- **UI** - the `fleetUi` UI Bundle (React 18 + Vite + Tailwind), surfaced as the **Fleet**
  Lightning app (`uiBundle` ref `c__fleetUi`). Internal route/feature namespace is `agents`
  to avoid colliding with the product name.
- **Identity** - teal `#0F766E` primary, sky `#0EA5E9` accent, rose severity; Space Grotesk
  headings, Inter body, JetBrains Mono metrics.

## Prerequisites

- Node.js **v22+**
- Salesforce CLI **v2.130.7+** (ships the UI Bundle plugin) - check `sf --version`, update with `sf update`.
- Target org on **Summer '26 or later** (Multi-Framework is GA and on by default).

## Deploy (per CONTRACT §13)

```bash
bash scripts/auth.sh                 # authorize a target org, alias "fleet"
bash scripts/deploy.sh               # build the UI, deploy force-app, assign Fleet_Administrator
bash scripts/deploy.sh --check       # validate-only (dry run)
bash scripts/deploy.sh --no-ui       # deploy metadata only, skip the Vite build
sf agent validate authoring-bundle --api-name Fleet_Curator
sf org open --path lightning/app/Fleet
```

Deployment order matters: **objects → Apex → Flows → agent bundles**. The agents reference
Apex and Flows by name, so they publish last.

The root `package.json` also exposes helpers that delegate into the bundle:

```bash
npm run ui:install     # install UI Bundle dependencies
npm run ui:dev         # run the console standalone with the mock data adapter
npm run ui:build       # produce the dist/ the UI Bundle host serves
npm run apex:test      # sf apex run test with coverage
```

## Standalone UI development

The UI Bundle runs without an org. `getRepositories()` switches on `VITE_DATA_MODE`
(default `mock`), so the whole console can be built and demoed against seeded mock data
before any Apex exists. `npm run ui:dev` serves it from `/` (no `SFDC_ENV`, so the router
`basename` is `undefined`); inside the org it is served from `/app/c__fleetUi`.

## Packaging note

Multi-Framework apps cannot ship in a managed package yet. Ship the agents, objects, Apex,
Flows, and CMDT as the managed package, and the UI Bundle as an unlocked package installed
alongside. Collapse them when managed-package support lands.

## Testing

The Apex suite and the UI suite run independently.

```bash
npm run apex:test                              # Apex, with coverage
cd force-app/main/default/uiBundles/fleetUi
npm test                                       # Vitest, jsdom
npm run lint                                   # ESLint, zero-warning policy
npm run build                                  # tsc -b && vite build
```

Coverage targets are set in `CONTRACT.md` §13. The scoring and drift services carry the
highest bar because a wrong score silently mis-grades an agent, which is worse than a
crash: a crash gets noticed.

### Testing note on big objects

`Fleet_Trace__b` cannot be written in an Apex test context at all, and
`Database.insertImmediate` behaves like a callout, so it fails after ordinary DML in the
same transaction. `FleetTraceService` therefore writes through a `TraceWriter` seam with an
in-memory implementation under test. Do not collapse that indirection; the tests cannot run
without it.

## Repository layout

```
fleet/
  CONTRACT.md                     single source of truth for shared names and shapes
  force-app/main/default/
    classes/                      Apex services, invocable actions, tests
    objects/                      custom objects, big object, platform event, CMDT
    permissionsets/               Fleet_Administrator, Operator, Approver, Viewer, Integration
    genAiPlannerBundles/          Agentforce agent definitions
    uiBundles/fleetUi/            React console (source, tests, Vite config)
  scripts/                        auth, deploy, seed
  docs/                           design notes
```

## License

MIT. Copyright (c) 2026 VurtuoLabs
