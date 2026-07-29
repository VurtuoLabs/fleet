/**
 * Assertion types - read-only view of Fleet_Assertion_Type__mdt.
 * Seeded: MUST_ROUTE_TO, MUST_GROUND_IN, MUST_INVOKE, MUST_NOT_INVOKE,
 * MUST_CONVEY, MUST_NOT_CONVEY, LATENCY_P95_MS, CREDIT_CEILING, MUST_ESCALATE.
 */
import { useAssertionTypes } from "@/hooks";
import type { AssertionTypeView } from "@/domain/types";
import { severityMeta } from "@/features/shared/meta";
import { SeverityTag } from "@/features/shared/ui";
import { SettingsSection, ConfigTable, ActiveTag, Mono, type Column } from "../ConfigTable";

const columns: Column<AssertionTypeView>[] = [
  { key: "key", header: "Type", render: (a) => <Mono>{a.typeKey}</Mono> },
  { key: "label", header: "Label", render: (a) => a.label },
  { key: "strategy", header: "Evaluation", render: (a) => a.evaluationStrategy },
  { key: "judge", header: "Judge", render: (a) => (a.requiresJudge ? "Required" : "-") },
  {
    key: "sev",
    header: "Default severity",
    render: (a) => <SeverityTag meta={severityMeta(a.defaultSeverity)} />,
  },
  { key: "active", header: "State", render: (a) => <ActiveTag active={a.active} /> },
];

export default function AssertionsView() {
  const { data, isLoading, isError } = useAssertionTypes();
  return (
    <SettingsSection
      title="Assertion types"
      metadataType="Fleet_Assertion_Type__mdt"
      setupPath="CustomMetadata/home"
    >
      <ConfigTable
        columns={columns}
        rows={data ?? []}
        rowKey={(a) => a.typeKey}
        isLoading={isLoading}
        isError={isError}
        emptyLabel="No assertion types are configured."
      />
    </SettingsSection>
  );
}
