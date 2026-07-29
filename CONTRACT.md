# Fleet - Build Spec

**Continuous agent QA and behavioral drift detection for Agentforce.**
Salesforce-native. React UI Bundle on Multi-Framework. No external services.

This file is the single source of truth for every name and shape shared between `force-app` and `uiBundles/fleetUi`. Both halves MUST use these exact identifiers.

- **API version:** `sourceApiVersion` **67.0** (required by `UIBundle`). Apex classes declare 64.0+ (Agent Script needs v65+).
- **Namespace:** none in the base repo. Add the ISV namespace at packaging time.
- **Security posture:** all service classes `public with sharing`. SOQL uses `WITH USER_MODE`, DML uses `AccessLevel.USER_MODE`. The two documented exceptions are in §9.
- **Deploy as one unit:** Apex tests read seeded Custom Metadata, so `customMetadata/` must deploy with `classes/`.

---

## 1. Scope

| | |
|---|---|
| **Question** | Is this agent still behaving the way we approved? |
| **Core artifact** | The golden set and its blessed baseline |
| **Loop** | Capture → Calibrate → Judge → Attribute → Remediate |
| **Buyer** | AI Ops lead, platform owner |
| **Sibling product** | None. Fleet is a standalone product with its own capture layer. |

---

## 2. Project scaffold

### 2.1 Prerequisites

- Node.js **v22+**
- Salesforce CLI **v2.130.7+** (this is the version that ships the UI Bundle plugin). Check `sf --version`, update with `sf update`.
- Target org on **Summer '26 or later**. Multi-Framework is GA and enabled by default, no opt-in. Confirm under Setup → *React Development with Salesforce Multi-Framework*.

### 2.2 Generate

```bash
sf project generate --name fleet --template standard
cd fleet
sf template generate ui-bundle          # scaffolds into force-app/main/default/uiBundles
```

Rename the generated bundle folder to `fleetUi`. The CLI template ships React + TypeScript + Vite + Tailwind + shadcn/ui with the SDK preconfigured.

### 2.3 Tree

```
fleet/
├── sfdx-project.json                  # sourceApiVersion 67.0, packageDirectories: force-app
├── package.json                       # root scripts delegate via npm --prefix
├── CONTRACT.md                        # this file, checked in
├── scripts/
│   ├── auth.sh
│   ├── deploy.sh                      # build UI → deploy force-app → assign permset
│   └── seed.sh                        # optional demo data
└── force-app/main/default/
    ├── objects/
    │   ├── Fleet_Agent__c/
    │   ├── Golden_Case__c/
    │   ├── Assertion__c/
    │   ├── Calibration_Run__c/
    │   ├── Case_Result__c/
    │   ├── Deviation_Finding__c/
    │   ├── Remediation__c/
    │   ├── Change_Event__c/
    │   ├── Fleet_User_Preference__c/
    │   ├── Fleet_Trace__b/            # Big Object
    │   ├── Fleet_Turn__e/             # Platform Event
    │   ├── Fleet_Setting__mdt/
    │   ├── Fleet_Assertion_Type__mdt/
    │   ├── Fleet_Drift_Detector__mdt/
    │   ├── Fleet_Severity_Policy__mdt/
    │   ├── Fleet_Change_Source__mdt/
    │   └── Fleet_View__mdt/
    ├── customMetadata/                # seeded records, deploy with classes
    ├── classes/
    ├── triggers/
    ├── flows/
    ├── permissionsets/
    ├── customPermissions/
    ├── tabs/
    ├── applications/
    │   └── Fleet.app-meta.xml
    ├── aiAuthoringBundles/
    │   └── Fleet_Curator/
    ├── genAiPlannerBundles/
    │   └── Fleet_Engine/
    ├── genAiPromptTemplates/
    │   └── Fleet_Judge_v1/
    └── uiBundles/fleetUi/
        ├── fleetUi.uibundle-meta.xml
        ├── ui-bundle.json
        ├── package.json
        ├── vite.config.ts
        ├── tsconfig.json
        ├── tailwind.config.ts
        ├── index.html
        └── src/
            ├── main.tsx
            ├── app/                   # providers.tsx, routes.tsx, shell
            ├── domain/                # types.ts, schemas.ts, labels.ts, drift.ts
            ├── salesforce/
            │   ├── repositories.ts    # interfaces only
            │   ├── factory.ts         # getRepositories() switches on VITE_DATA_MODE
            │   ├── mock/
            │   └── salesforce/        # SDK adapter
            ├── hooks/                 # TanStack Query hooks + queryKeys.ts
            ├── components/{ui,layout,navigation,common}
            ├── features/{agents,drift,cases,findings,attribution,settings}
            ├── lib/
            └── test/
```

### 2.4 `fleetUi.uibundle-meta.xml`

GA requires the `target` element. `AppLauncher` is deprecated.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<UIBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>Fleet</masterLabel>
    <description>Continuous agent QA and behavioral drift detection.</description>
    <isActive>true</isActive>
    <version>1</version>
    <target>CustomApplication</target>
</UIBundle>
```

### 2.5 `ui-bundle.json`

```json
{
  "outputDir": "dist",
  "routing": { "trailingSlash": "never", "fallback": "index.html" }
}
```

The `fallback` is what makes client-side routing survive a hard refresh. Without it, `/findings` returns a 404 from the bundle host.

### 2.6 `vite.config.ts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import salesforce from "@salesforce/vite-plugin-ui-bundle";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // Relative asset URLs. The bundle is served from /app/c__fleetUi, not the domain root.
  base: "./",
  // The salesforce() plugin is REQUIRED. It consumes ui-bundle.json and emits the
  // artifacts the UI Bundle host expects. Without it the metadata deploys cleanly
  // and the app renders an empty shell. It also pins the project to Vite 7.
  plugins: [react(), salesforce()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    // Sourcemaps ship inside the UIBundle and count toward its 2,500-file limit.
    sourcemap: false,
  },
  test: { globals: true, environment: "jsdom", setupFiles: ["./src/test/setup.ts"], css: true },
});
```

### 2.7 `Fleet.app-meta.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomApplication xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Fleet</label>
    <description>Continuous agent QA and behavioral drift detection.</description>
    <brand>
        <headerColor>#0F766E</headerColor>
        <shouldOverrideOrgTheme>false</shouldOverrideOrgTheme>
    </brand>
    <formFactors>Large</formFactors>
    <navType>Standard</navType>
    <uiBundle>c__fleetUi</uiBundle>
    <uiType>Lightning</uiType>
</CustomApplication>
```

### 2.8 Root `package.json` scripts

```json
{
  "scripts": {
    "auth": "bash scripts/auth.sh",
    "deploy": "bash scripts/deploy.sh",
    "ui:install": "npm --prefix force-app/main/default/uiBundles/fleetUi install",
    "ui:dev": "npm --prefix force-app/main/default/uiBundles/fleetUi run dev",
    "ui:build": "npm --prefix force-app/main/default/uiBundles/fleetUi run build",
    "graphql:schema": "npm --prefix force-app/main/default/uiBundles/fleetUi run graphql:schema",
    "graphql:codegen": "npm --prefix force-app/main/default/uiBundles/fleetUi run graphql:codegen",
    "apex:test": "sf apex run test --result-format human --code-coverage --wait 20"
  },
  "engines": { "node": ">=22" }
}
```

`graphql:schema` pulls the org's UIAPI schema and `graphql:codegen` generates typed operations. Run both after any object or field change, and commit the output so CI type-checks against the real schema.

---

## 3. Custom objects

| Object | Purpose | OWD | Notes |
|---|---|---|---|
| `Fleet_Agent__c` | Registry of monitored agents | Public Read Only | Reference data |
| `Golden_Case__c` | A curated test case | Controlled by Parent | Master-detail to Agent |
| `Assertion__c` | One assertion on a case | Controlled by Parent | Master-detail to Case |
| `Calibration_Run__c` | One execution of a golden set | Public Read Only | Operational |
| `Case_Result__c` | Per-case outcome of a run | Controlled by Parent | Master-detail to Run. 90-day purge. |
| `Deviation_Finding__c` | Detected drift with attribution | **Private** | May contain customer utterances. See §7. |
| `Remediation__c` | Action taken plus approval trail | Controlled by Parent | Master-detail to Finding |
| `Change_Event__c` | Deploy, KB publish, model, prompt edit | Public Read Only | Correlation source |
| `Fleet_User_Preference__c` | Per-user console preferences | Private | Owner-only |

### Key fields

**`Fleet_Agent__c`**: `Agent_API_Name__c`, `Bot_Id__c`, `Current_Version__c`, `Blessed_Version__c`, `Trueness_Score__c` (0-100, roll-up-ish, maintained by Apex), `Status__c`, `Monitoring_Enabled__c`, `Calibration_Schedule__c`, `Owner_Queue_Id__c`, `Last_Calibrated_At__c`, `Consecutive_Failures__c`, `Quarantined_At__c`, `Quarantined_By__c`.

**`Golden_Case__c`**: `Fleet_Agent__c` (MD), `Case_Key__c` (External Id, unique), `Utterance__c` (Long Text), `Active__c`, `Source__c` (`Curated` | `Auto_Proposed` | `Promoted_From_Production`), `Proposed_At__c`, `Approved_By__c`, `Baseline_Version__c`, `Baseline_Centroid_Ref__c`, `Exemplar_Count__c`, `Weight__c`, `Last_Result__c`, `Consecutive_Failures__c`.

**`Assertion__c`**: `Golden_Case__c` (MD), `Assertion_Type__c` (matches `Fleet_Assertion_Type__mdt.Type_Key__c`), `Expected_Value__c`, `Comparator__c`, `Tolerance__c`, `Severity_On_Fail__c`, `Active__c`.

**`Calibration_Run__c`**: `Fleet_Agent__c` (Lookup), `Run_Key__c` (External Id), `Trigger_Source__c` (`Scheduled` | `Change_Event` | `Manual` | `CI_Gate`), `Trigger_Change_Event__c` (Lookup), `Started_At__c`, `Completed_At__c`, `Status__c`, `Cases_Total__c`, `Cases_Passed__c`, `Cases_Failed__c`, `Trueness_Score__c`, `Credits_Consumed__c`, `Judge_Invocations__c`, `Prefilter_Skips__c`, `Error__c`.

**`Case_Result__c`**: `Calibration_Run__c` (MD), `Golden_Case__c` (Lookup), `Passed__c`, `Deviation_Score__c` (0-1), `Failed_Assertions__c` (Long Text, JSON), `Response__c` (Long Text), `Topic_Selected__c`, `Topic_Confidence__c`, `Actions_Invoked__c`, `Grounding_Sources__c`, `Latency_Ms__c`, `Credits__c`, `Judged__c` (Boolean: false when the prefilter resolved it), `Trace_Key__c` (pointer into `Fleet_Trace__b`).

**`Deviation_Finding__c`**: `Fleet_Agent__c` (Lookup), `Finding_Number__c` (Auto Number `F-{00000}`), `Severity__c`, `State__c`, `Headline__c`, `Detail__c` (Long Text), `Detector__c`, `Attributed_Change__c` (Lookup to `Change_Event__c`), `Attribution_Confidence__c`, `Cases_Failing__c`, `Cases_Total__c`, `Opened_At__c`, `Closed_At__c`, `Closed_By__c`, `Closure_Reason__c`.

**`Remediation__c`**: `Deviation_Finding__c` (MD), `Action__c`, `Requested_By__c`, `Approval_State__c`, `Approver__c`, `Approved_At__c`, `Before_State__c` (Long Text, JSON), `After_State__c` (Long Text, JSON), `Idempotency_Key__c` (External Id), `Result__c`, `Error__c`.

**`Change_Event__c`**: `Change_Key__c` (External Id), `Source__c`, `Kind__c`, `Label__c`, `Actor__c`, `Occurred_At__c`, `Detail__c`, `Affected_Artifacts__c` (Long Text), `Correlation_Window_Minutes__c`.

---

## 4. Big Object: `Fleet_Trace__b`

Full turn archive.

**Index (immutable after first deploy: get this right the first time):**

```
1. Org_Agent_Key__c   (Text 60)      // <agentApiName>
2. Occurred_At__c     (DateTime)     // descending reads
3. Trace_Key__c       (Text 35)      // uniqueness tiebreak
```

**The text budget is 100 characters, total, across every text field in the index.**
60 + 35 = 95 fits. A 60/40 split summing to exactly 100 is REJECTED - the budget
has per-field overhead, so treat 100 as unreachable (`The total length for all text
fields in an index can't exceed 100 characters`). The semantic key gets the room;
the synthetic tiebreak - `TRC-` plus an epoch and a sequence, ~20 characters in practice - does not.

Fields: `Utterance__c`, `Response__c`, `Topic_Selected__c`, `Topic_Confidence__c`, `Topics_Considered__c`, `Actions_Invoked__c`, `Grounding_Sources__c`, `Prompt_Versions__c`, `Model_Version__c`, `Latency_Ms__c`, `Credits__c`, `Trust_Flags__c`, `Session_Key__c`, `Run_Key__c`.

**Constraints that drive the design, not footnotes:**

- **No record-level sharing.** Big Objects are object-permission only. All read access goes through `FleetTraceService`, which enforces its own checks. Never grant Read on `Fleet_Trace__b` in a user-facing permission set.
- **Query only on the index, in index order**, with equality on all but the last filter. These fail at *runtime*, not at compile or deploy time, so they stay invisible until real data exists:
  - **A filter may not skip an index column.** `WHERE Org_Agent_Key__c = :a AND Trace_Key__c = :k` jumps over `Occurred_At__c` and throws `Filters may not have any gaps within the composite key`. `FleetTraceService.readByKey` therefore filters on the agent and matches the trace key in memory.
  - **`ORDER BY` must start at the leading index field**, and **`DESC` is not supported** on an index column (`Unsupported order direction on filter column`).
- **No triggers, no workflow, no process.** Writes come from Apex only.
- **Insert and upsert only.** Deletion is `Database.deleteImmediate`, used solely by the retention job.

---

## 5. Platform Event: `Fleet_Turn__e`

Published `PublishAfterCommit`. One per agent turn.

Fields: `Agent_API_Name__c`, `Session_Key__c`, `Trace_Key__c`, `Occurred_At__c`, `Utterance__c`, `Response__c`, `Topic_Selected__c`, `Topic_Confidence__c`, `Topics_Considered__c`, `Actions_Invoked__c`, `Grounding_Sources__c`, `Prompt_Versions__c`, `Model_Version__c`, `Latency_Ms__c`, `Credits__c`, `Trust_Flags__c`, `Variables_Set__c`, `Run_Key__c`.

This event is owned by Fleet alone. Nothing subscribes to it but Fleet's own trigger, and Fleet ships and instruments its own tap independently of any other product.

**The tap is `FleetTap`**, an Apex invocable that publishes one `Fleet_Turn__e` per agent turn. A monitored agent calls it through an action targeting `apex://FleetTap`. Its `@InvocableVariable` names are the agent-facing contract; renaming one breaks every bundle mapped to it. When `trace_key` is blank the tap generates one that fits `Trace_Key__c`'s Text(35) - see §4 for why that width is fixed.

**Attaching the tap is a per-agent change to that agent's own bundle.** Deploying Fleet gives the org the capability and registers the agents; each monitored agent still has to add the action before any turn is captured.

---

## 6. Custom Metadata Types: admin configuration

Everything an admin should be able to change without a deploy lives here. No hardcoded thresholds anywhere in Apex.

### `Fleet_Setting__mdt` (single record `Default`)
`Monitoring_Enabled__c`, `Default_Schedule_Cron__c`, `Judge_Template_Name__c`, `Prefilter_Lower_Bound__c` (default 0.15), `Prefilter_Upper_Bound__c` (default 0.45), `Max_Cases_Per_Run__c`, `Trueness_Threshold__c` (default 80), `Retention_Days_Case_Result__c` (default 90), `Retention_Days_Trace__c` (default 395), `Auto_Curation_Enabled__c`, `Auto_Curation_Cron__c`, `CI_Gate_Enabled__c`.

**Why the prefilter bounds matter:** anything below the lower bound passes without a judge call, anything above the upper bound fails without one. Only the ambiguous band costs a judge invocation. These two numbers are the single biggest lever on run cost, so they belong in the hands of the admin.

### `Fleet_Assertion_Type__mdt`
`Type_Key__c`, `Label__c`, `Evaluation_Strategy__c` (`Deterministic` | `Semantic` | `Numeric`), `Requires_Judge__c`, `Default_Severity__c`, `Active__c`.

Seeded: `MUST_ROUTE_TO`, `MUST_GROUND_IN`, `MUST_INVOKE`, `MUST_NOT_INVOKE`, `MUST_CONVEY`, `MUST_NOT_CONVEY`, `LATENCY_P95_MS`, `CREDIT_CEILING`, `MUST_ESCALATE`.

Adding a tenth assertion type is a CMDT record plus a strategy class, not a schema change.

### `Fleet_Drift_Detector__mdt`
`Detector_Key__c`, `Label__c`, `Strategy__c`, `Threshold__c`, `Window_Hours__c`, `Minimum_Sample__c`, `Weight__c`, `Active__c`.

Seeded: `SEMANTIC_DRIFT`, `STRUCTURAL_DRIFT`, `ECONOMIC_DRIFT`, `TRUST_DRIFT`.

### `Fleet_Severity_Policy__mdt`
`Severity__c`, `Auto_Action__c` (`Notify` | `Request_Approval` | `Quarantine`), `Notify_Queue_Id__c`, `Approval_Queue_Id__c`, `Requires_Custom_Permission__c`, `Auto_Close_After_Days__c`, `Active__c`.

This is the autonomy dial. An admin who wants nothing automatic sets every severity to `Notify`.

### `Fleet_Change_Source__mdt`
`Source_Key__c`, `Label__c`, `Ingestion_Strategy__c` (`SetupAuditTrail` | `Platform_Event` | `Scheduled_Poll`), `Correlation_Window_Minutes__c`, `Active__c`.

Seeded: `DEPLOY`, `KNOWLEDGE`, `PROMPT`, `MODEL`.

### `Fleet_View__mdt`
`View_Key__c`, `Label__c`, `Filter_JSON__c`, `Sort_Field__c`, `Sort_Direction__c`, `Display_Order__c`, `Active__c`.

Seeded: `ALL_AGENTS`, `OUT_OF_TRUE`, `QUARANTINED`, `MY_AGENTS`.

---

## 7. Permission and sharing model

### 7.1 Custom permissions

| Custom permission | Gates |
|---|---|
| `Fleet_Run_Calibration` | Trigger a manual or CI calibration run |
| `Fleet_Bless_Baseline` | Promote a run to the blessed baseline |
| `Fleet_Curate_Golden_Set` | Create, edit, approve golden cases |
| `Fleet_Approve_Remediation` | Approve a rollback or quarantine reversal |
| `Fleet_Quarantine_Agent` | Quarantine or release an agent version |
| `Fleet_View_Transcripts` | See raw utterances and responses |

`Fleet_View_Transcripts` is deliberately separate. Most operators need trueness scores and assertion verdicts, not customer text. Least privilege means the score is the default and the transcript is the exception.

### 7.2 Permission sets

| Permission set | Intent |
|---|---|
| `Fleet_Viewer` | Read the console, see scores and findings. No transcripts. |
| `Fleet_Operator` | Viewer plus run calibration, curate the golden set, view transcripts |
| `Fleet_Approver` | Operator plus approve remediation |
| `Fleet_Administrator` | Everything, plus Modify All on Fleet objects and CMDT management |
| `Fleet_Integration` | Headless. Object permissions on `Fleet_Trace__b`, publish on `Fleet_Turn__e`. Assigned to the integration user only, never to a human. |

### 7.3 Matrix

| Custom permission | Viewer | Operator | Approver | Administrator |
|---|:---:|:---:|:---:|:---:|
| `Fleet_Run_Calibration` | | ✅ | ✅ | ✅ |
| `Fleet_Bless_Baseline` | | | ✅ | ✅ |
| `Fleet_Curate_Golden_Set` | | ✅ | ✅ | ✅ |
| `Fleet_Approve_Remediation` | | | ✅ | ✅ |
| `Fleet_Quarantine_Agent` | | | ✅ | ✅ |
| `Fleet_View_Transcripts` | | ✅ | ✅ | ✅ |

### 7.4 Record-level sharing

`Deviation_Finding__c` is **Private**. Access is granted two ways:

1. **Apex managed sharing.** `FleetSharingService.grantFindingAccess()` writes `Deviation_Finding__Share` rows with `RowCause = 'Fleet_Agent_Owner__c'` (an Apex sharing reason) to the queue named in `Fleet_Agent__c.Owner_Queue_Id__c`. Managed sharing with a custom row cause survives owner changes and cannot be deleted by users, which is what you want for an audit-adjacent record.
2. **View All** on the object, granted only in `Fleet_Administrator`.

Do not use criteria-based sharing rules here. They are limited to 50 per object and they recalculate asynchronously, which produces a window where a fresh critical finding is invisible to the team that needs it.

**Field-level security:** `Utterance__c`, `Response__c`, and `Case_Result__c.Response__c` are readable only where `Fleet_View_Transcripts` is present. Enforce in FLS on the permission sets *and* re-check in the Apex facade. FLS alone is not enough because the facade returns DTOs, and DTO fields are not FLS-protected.

---

## 8. Apex

### 8.1 Conventions

- `public with sharing` on every service class.
- All SOQL `WITH USER_MODE`. All DML `AccessLevel.USER_MODE`.
- CMDT read through `FleetConfigurationService` static caches. One SOQL per type per transaction.
- DTOs are inner classes with `@AuraEnabled` fields, so the same shape serves the React SDK and any future LWC.
- Every class has a `<Class>Test`. Target 90% on service classes, not the 75% floor.
- `FleetTestFactory` is `@IsTest` only.
- No SOQL or DML inside loops. Ever.
- Custom permission checks via `FeatureManagement.checkPermission('Fleet_X')`.

### 8.2 Facades (public entry points for the UI)

**`FleetAgentService`**
- `getAgents(AgentQuery q) → List<AgentView>`
- `getAgent(Id) → AgentView`
- `setMonitoring(Id, Boolean) → AgentView`
- `quarantine(Id, String reason) → AgentView`: requires `Fleet_Quarantine_Agent`
- `release(Id) → AgentView`: same permission

**`FleetCalibrationService`**
- `run(RunRequest r) → Calibration_Run__c`: requires `Fleet_Run_Calibration`. Enqueues `FleetCalibrationQueueable`.
- `getRun(Id) → RunView`
- `getRuns(Id agentId, Integer limitN) → List<RunView>`
- `bless(Id runId) → Fleet_Agent__c`: requires `Fleet_Bless_Baseline`. Snapshots centroids and sets `Blessed_Version__c`.

**`FleetGoldenSetService`**
- `getCases(Id agentId) → List<GoldenCaseView>`
- `upsertCase(GoldenCaseInput) → GoldenCaseView`: requires `Fleet_Curate_Golden_Set`
- `approveProposed(Id caseId) → GoldenCaseView`
- `promoteFromTrace(String traceKey) → GoldenCaseView`: turns a production turn into a case
- `deactivate(Id caseId) → GoldenCaseView`

**`FleetJudgeService`**
- `score(Case_Result__c r, List<Assertion__c> a) → JudgeResult`: deterministic assertions first, embedding prefilter second, prompt template last. Only reaches the template for the ambiguous band.

**`FleetDriftService`**
- `detect(Id agentId, Integer windowHours) → List<DriftSignal>`: runs every active `Fleet_Drift_Detector__mdt`
- `changepoints(Id agentId) → List<Changepoint>`

**`FleetAttributionService`**
- `attribute(Changepoint c) → AttributionResult`: correlates against `Change_Event__c` inside each source's window, returns the cause and a confidence

**`FleetFindingService`**
- `getFindings(FindingQuery q) → List<FindingView>`
- `open(FindingInput) → Deviation_Finding__c`: also calls `FleetSharingService`
- `close(Id, String reason) → FindingView`

**`FleetRemediationService`**
- `propose(Id findingId) → Remediation__c`
- `approve(Id remediationId) → RemediationResult`: requires `Fleet_Approve_Remediation`
- `reject(Id remediationId, String reason) → Remediation__c`
- `execute(Id remediationId) → RemediationResult`: idempotent on `Idempotency_Key__c`, dispatches Apex or Flow per §10

**`FleetTraceService`**
- `write(List<Fleet_Turn__e>) → Integer`
- `read(String agentKey, Datetime from, Datetime to, Integer limitN) → List<TraceView>`: enforces `Fleet_View_Transcripts` before returning `Utterance__c` or `Response__c`, and nulls them otherwise
- `purge(Integer olderThanDays) → Integer`: `Database.deleteImmediate`

**`FleetChangeLedgerService`**
- `ingest(List<ChangeInput>) → Integer`: upsert on `Change_Key__c`
- `pollSetupAuditTrail() → Integer`

**`FleetSharingService`**
- `grantFindingAccess(List<Deviation_Finding__c>) → Integer`
- `revokeFindingAccess(Set<Id>) → Integer`

**`FleetConfigurationService`**
- `getSetting()`, `getAssertionTypes()`, `getDetectors()`, `getSeverityPolicies()`, `getChangeSources()`, `getViews()`

Supporting: `FleetException`, `FleetTestFactory`, `FleetCalibrationQueueable`, `FleetDriftBatch`, `FleetRetentionBatch`, `FleetScheduler`, `FleetTurnTriggerHandler`.

### 8.3 The calibration chain

`FleetCalibrationQueueable` chains one case per job rather than fanning out in parallel.

- Predictable credit burn, which matters when the customer pays per action.
- Stays inside concurrent Apex limits with a large golden set.
- Each link writes its `Case_Result__c` before enqueuing the next, so a mid-run failure leaves a partial result you can read rather than nothing.
- The chain carries `runKey` and a cursor. On the final link it computes the run rollup, calls `FleetDriftService`, then `FleetAttributionService`, then opens findings.

Guard with `FleetCalibrationService.bypass` for test isolation.

---

## 9. Automation

### 9.1 Triggers

**`FleetTurnTrigger`** (`after insert` on `Fleet_Turn__e`) → `FleetTurnTriggerHandler.handleAfterInsert` → `FleetTraceService.write`.

**Documented system-mode exception #1:** the trace write runs in system mode. A user whose profile lacks Fleet access must never cause an agent conversation to fail. `with sharing` still applies to everything else in the transaction.

**Documented system-mode exception #2:** `FleetChangeLedgerService.pollSetupAuditTrail` reads `SetupAuditTrail` in system mode, because that object is admin-only and the scheduled context has no interactive user.

Both are commented in-line with this rationale. No other system-mode DML exists in the codebase.

### 9.2 Scheduled

`FleetScheduler implements Schedulable` reads `Fleet_Setting__mdt.Default_Schedule_Cron__c`.

- Calibration sweep for every agent where `Monitoring_Enabled__c = true`
- `FleetDriftBatch` for continuous detection between runs
- `FleetRetentionBatch` nightly, honoring the two retention settings
- Change ledger poll on the cadence in `Fleet_Change_Source__mdt`

### 9.3 Flows

Keep Flow for what Flow is good at: declarative, admin-visible, org-specific side effects. Keep bulk logic in Apex.

| Flow | Type | Contract |
|---|---|---|
| `Fleet_Notify_Finding_Flow` | Autolaunched | In: `findingId`, `severity`. Out: `notificationMessage`. Admin edits this to change who gets told and how. |
| `Fleet_Quarantine_Agent_Flow` | Autolaunched | In: `agentId`, `reason`. Out: `resultMessage`. Deactivates the Bot version and routes to the fallback queue. |
| `Fleet_Rollback_Version_Flow` | Autolaunched | In: `agentId`, `targetVersion`. Out: `resultMessage`. |
| `Fleet_Bless_Baseline_Screen` | Screen | Guided promotion with a diff preview and a confirmation step. |
| `Fleet_Onboard_Agent_Screen` | Screen | Setup wizard: pick an agent, set schedule and owner queue, seed starter golden cases. |

**Flow contract rules.** Every autolaunched flow takes `recordId`-style scalar inputs and returns a single `resultMessage` string. `FleetRemediationService.dispatchFlow` passes inputs by those exact names and reads `resultMessage`. Keep the names when adding a flow and no Apex change is needed.

One record-triggered flow per object per timing, or none. Right now: none. All record-side logic is in Apex trigger handlers, which is the correct call for an ISV package where the customer will add their own flows.

---

## 10. Agentforce agents

### 10.1 `Fleet_Engine`: `GenAiPlannerBundle`

The calibration and remediation engine. Uses `GenAiPlannerBundle` because it needs the `run` keyword for action chaining and `filter_from_agent` for conditional remediation. Neither is supported in `AiAuthoringBundle`.

Topics: `run_calibration`, `assess_deviation`, `attribute_change`, `remediate`.

```agentscript
topic run_calibration:
	label: "Run Calibration"
	description: "Execute the golden set against a monitored agent and score deviation from the blessed baseline."

	actions:
		Load_Golden_Set:
			description: "Retrieve active golden cases for the target agent"
			inputs:
				target_agent_id: string
					description: "Fleet_Agent__c record id"
					is_required: True
			outputs:
				case_payload: string
					description: "Serialized cases with assertions"
					is_used_by_planner: True
			target: "apex://FleetGoldenSetService"

		Prefilter_By_Embedding:
			description: "Compare the response embedding to the blessed centroid"
			inputs:
				turn_trace: string
					description: "Captured turn"
					is_required: True
			outputs:
				needs_judge: boolean
					description: "True when the case falls in the ambiguous band"
					is_used_by_planner: True
			target: "apex://FleetJudgeService"

		Score_Deviation:
			description: "Judge the captured turn against the case assertions"
			inputs:
				"Input:turn_trace": string
					description: "Captured turn"
					is_required: True
				"Input:assertions": string
					description: "Case assertions"
					is_required: True
			outputs:
				promptResponse: string
					description: "Per-assertion verdict and deviation score"
					is_used_by_planner: True
			target: "generatePromptResponse://Fleet_Judge_v1"

	reasoning:
		instructions: ->
			| Load the golden set for @variables.target_agent_id.
			| For each case, invoke the target agent and capture the turn.
			| Run the embedding prefilter first. Only call the judge when
			| needs_judge is True. This controls cost and is not optional.
			| Do not compare response strings literally. Judge against the
			| assertions only. Different wording that satisfies every
			| assertion is passing.
			| Set @variables.failed_count for each case below threshold.
			| When all cases are scored, transition to attribute_change.
```

### 10.2 `Fleet_Curator`: `AiAuthoringBundle`

The customer-facing conversational agent, visible in Agentforce Studio. Proposes golden cases from production traffic, explains a finding in plain language, and walks an admin through blessing a baseline.

Constraints honored: no `run`, no `filter_from_agent`, no `@utils.escalate with reason`. Uses `go_to_escalate` rather than `escalate` as an action name, since `escalate` is reserved.

### 10.3 Agent Script conventions checklist

Tabs not spaces · `instructions: ->` with the space · `@variables` plural · `True` and `False` capitalized · actions defined inside topics, never top level · both `label` and `description` on every topic · `language:` block present · linked variables `EndUserId`, `RoutableId`, `ContactId` · `.bundle-meta.xml` present · no reserved words as input names (`description` is reserved, use `case_description`) · Flow input and output names match the Flow variable API names exactly · `sf agent validate authoring-bundle` returns zero errors before any deploy.

---

## 11. Frontend contract

### 11.1 Base path

Inside the org the bundle is served from `/app/c__fleetUi`, not `/`. `src/app/providers.tsx` reads `globalThis.SFDC_ENV.basePath` and passes it to `BrowserRouter` as `basename`. Standalone `npm run dev` has no `SFDC_ENV`, so basename is `undefined` and the app serves from `/`. **Never hardcode a route path that assumes the domain root.**

### 11.2 Data seam

Components never touch the SDK. The chain is:

```
feature → TanStack Query hook (src/hooks/) → repository interface (src/salesforce/repositories.ts)
        → adapter chosen by getRepositories() on VITE_DATA_MODE ("mock" default | "salesforce")
```

This is what lets the whole UI be built and demoed before a single Apex class exists, and it is what makes the app testable without an org.

Repository interfaces: `AgentRepository`, `CalibrationRepository`, `GoldenSetRepository`, `FindingRepository`, `RemediationRepository`, `ChangeRepository`, composed as `Repositories`.

### 11.3 SDK usage (GA syntax)

```ts
import { createDataSDK, gql } from "@salesforce/platform-sdk";

const sdk = await createDataSDK();

// Reads use .query()
const result = await sdk.graphql?.query<FindingsResponse>({ query: OPEN_FINDINGS });
const rows = result?.data?.uiapi?.query?.Deviation_Finding__c?.edges ?? [];

// Writes use .mutate()
await sdk.graphql?.mutate<ApproveResponse>({ mutation: APPROVE_REMEDIATION, variables: { input } });
```

`result.data` is typed as possibly undefined. Optional-chain through it rather than assuming presence.

**Rule of thumb:** GraphQL for reads over records the user can already see, Apex facades for anything with a permission check, a state transition, or a rollup. Every write in this app goes through Apex.

### 11.4 Routes

`/agents` · `/agents/:agentId` · `/drift` · `/cases` · `/cases/:caseId` · `/findings` · `/findings/:findingId` · `/attribution` · `/runs/:runId` · `/settings` (`/settings/detectors`, `/settings/severity`, `/settings/assertions`, `/settings/views`, `/settings/permissions`)

The `/settings/*` routes are read-only views onto Custom Metadata with a deep link to Setup. The console shows the admin what the configuration currently is. Setup remains the place it gets changed. That keeps one source of truth and keeps the package out of the business of writing CMDT at runtime.

### 11.5 Stack

React 18 · TanStack Query, Table, Virtual · Radix primitives with shadcn/ui · Tailwind · zustand for ephemeral UI state · react-router-dom · react-hook-form with zod · recharts · lucide-react · date-fns · cmdk for the command palette.

Fleet has its own visual identity - a cool telemetry palette, deliberately off the SLDS blue so the console reads as an operations surface rather than a record. Teal leads, sky differentiates secondary signal (change-marker kinds), rose carries severity.

- **Palette:** primary teal `#0F766E` (`brandDark` `#115E59`), accent sky `#0EA5E9`; semantics success `#15803D`, warning `#B45309`, error/severity rose `#BE123C`; cool slate-teal neutrals - page `#EEF2F2`, surface `#FFFFFF`, border `#DCE3E3`, text `#0F1B1A`; radius 4px.
- **Typography:** `Space Grotesk` for headings, KPI numerals, tab labels, and the wordmark (a technical, operational feel); `Inter` for body; `JetBrains Mono` for metrics, scores, and case ids.

---

## 12. Test strategy

**Apex.** 90% on service classes. `FleetTestFactory` builds every object. Tests seed and read Custom Metadata, so `customMetadata/` deploys with `classes/`. Cover: the permission matrix (assert a `Fleet_Viewer` cannot bless a baseline), idempotency on remediation, the calibration chain including a mid-chain failure, the prefilter band boundaries, and managed sharing insertion.

**Frontend.** Vitest with Testing Library and jsdom. Repository interfaces are mocked at the seam, so feature tests never need the SDK. Cover: the drift chart's change-marker alignment, the findings approval flow, and route-level rendering under `basename`.

**Integration.** A scratch org definition plus `scripts/seed.sh` that creates two agents, one healthy and one drifting, with a seeded change event that the attribution engine should find. This doubles as the demo org.

---

## 13. Deployment

```bash
bash scripts/auth.sh                 # authorize, alias "fleet"
bash scripts/deploy.sh               # build UI, deploy force-app, assign Fleet_Administrator
bash scripts/deploy.sh --check       # validate-only
bash scripts/deploy.sh --no-ui       # metadata only
sf agent validate authoring-bundle --api-name Fleet_Curator
sf org open --path lightning/app/Fleet
```

Order matters: objects → Apex → Flows → agent bundles. The agent references Apex and Flows by name, so it publishes last.

**Packaging note.** Multi-Framework apps cannot ship in a managed package yet. Ship the agent, objects, Apex, Flows, and CMDT as the managed package, and the UI Bundle as an unlocked package installed alongside. Collapse them when managed-package support lands.

---

## 14. Build order

| Phase | Deliverable | Done when |
|---|---|---|
| **1** | Objects, Big Object, Platform Event, CMDT, permission sets, tap, `FleetTraceService` | A live agent conversation produces a `Fleet_Trace__b` row |
| **2** | Golden set, calibration chain, judge, `Case_Result__c` | A manual run produces per-case pass and fail with the prefilter working |
| **3** | UI Bundle with mock adapter: agents, case diff, golden set | Demoable with no org data |
| **4** | Salesforce adapter, drift detectors, change ledger, attribution, findings | The console shows a real finding with a real attributed cause |
| **5** | Remediation, approvals, quarantine, managed sharing | A critical finding quarantines an agent and requests approval |
| **6** | Auto-curation, CI gate, LWC record-page inspector | Golden set grows without manual authoring |

Phases 1 through 4 are the sellable MVP. Phase 5 is the reason it renews.

---

## 15. Open questions to close before Phase 2

- **Do calibration turns consume the customer's Flex Credits?** If yes, pricing has to absorb it or the product creates the cost problem it claims to solve. This determines whether `Max_Cases_Per_Run__c` defaults to 20 or 200.
- **In-org Agent API rate limits.** Caps golden set size and run frequency.
- **Data Cloud entitlement.** Phase 1 through 4 work on Big Object plus Apex alone. Vector search for the semantic prefilter is better with Data 360. Confirm target customers have it before making it a hard dependency, and keep a cosine-on-stored-embedding fallback in `FleetJudgeService` if not.
- ~~**Big Object index.** Confirm the three-part index in §4 before the first deploy. It cannot be changed once data lands.~~ **Closed 2026-07-29.** The original 60/60 split exceeded the 100-character index text budget and failed to deploy. Now 60/40, verified deployed against `imperialealex@gmail.com`.
