/**
 * Severity policy - read-only view of Fleet_Severity_Policy__mdt.
 * The autonomy dial: each severity maps to Notify / Request_Approval / Quarantine.
 */
import { useSeverityPolicies } from "@/hooks";
import type { SeverityPolicyView } from "@/domain/types";
import { severityMeta } from "@/features/shared/meta";
import { SeverityTag } from "@/features/shared/ui";
import { SettingsSection, ConfigTable, ActiveTag, Mono, type Column } from "../ConfigTable";

const ACTION_LABEL: Record<string, string> = {
  Notify: "Notify",
  Request_Approval: "Request approval",
  Quarantine: "Quarantine",
};

const columns: Column<SeverityPolicyView>[] = [
  { key: "sev", header: "Severity", render: (p) => <SeverityTag meta={severityMeta(p.severity)} /> },
  { key: "action", header: "Auto action", render: (p) => ACTION_LABEL[p.autoAction] ?? p.autoAction },
  {
    key: "perm",
    header: "Requires permission",
    render: (p) => (p.requiresCustomPermission ? <Mono>{p.requiresCustomPermission}</Mono> : "-"),
  },
  {
    key: "autoclose",
    header: "Auto-close (days)",
    align: "right",
    render: (p) => <Mono>{p.autoCloseAfterDays ?? "-"}</Mono>,
  },
  { key: "active", header: "State", render: (p) => <ActiveTag active={p.active} /> },
];

export default function SeverityView() {
  const { data, isLoading, isError } = useSeverityPolicies();
  return (
    <SettingsSection
      title="Severity policy"
      metadataType="Fleet_Severity_Policy__mdt"
      setupPath="CustomMetadata/home"
    >
      <ConfigTable
        columns={columns}
        rows={data ?? []}
        rowKey={(p) => p.severity}
        isLoading={isLoading}
        isError={isError}
        emptyLabel="No severity policies are configured."
      />
    </SettingsSection>
  );
}
