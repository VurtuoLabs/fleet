/**
 * Saved views - read-only view of Fleet_View__mdt.
 * Seeded: ALL_AGENTS, OUT_OF_TRUE, QUARANTINED, MY_AGENTS.
 */
import { useViews } from "@/hooks";
import type { ViewDefView } from "@/domain/types";
import { SettingsSection, ConfigTable, ActiveTag, Mono, type Column } from "../ConfigTable";

const columns: Column<ViewDefView>[] = [
  { key: "order", header: "#", align: "right", render: (v) => <Mono>{v.displayOrder}</Mono> },
  { key: "key", header: "View", render: (v) => <Mono>{v.viewKey}</Mono> },
  { key: "label", header: "Label", render: (v) => v.label },
  { key: "sort", header: "Sort", render: (v) => (v.sortField ? `${v.sortField} ${v.sortDirection ?? ""}`.trim() : "-") },
  { key: "active", header: "State", render: (v) => <ActiveTag active={v.active} /> },
];

export default function ViewsView() {
  const { data, isLoading, isError } = useViews();
  const rows = [...(data ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <SettingsSection title="Saved views" metadataType="Fleet_View__mdt" setupPath="CustomMetadata/home">
      <ConfigTable
        columns={columns}
        rows={rows}
        rowKey={(v) => v.viewKey}
        isLoading={isLoading}
        isError={isError}
        emptyLabel="No saved views are configured."
      />
    </SettingsSection>
  );
}
