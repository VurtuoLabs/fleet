/**
 * Detectors - read-only view of Fleet_Drift_Detector__mdt.
 * Seeded: SEMANTIC_DRIFT, STRUCTURAL_DRIFT, ECONOMIC_DRIFT, TRUST_DRIFT.
 */
import { useDetectors } from "@/hooks";
import type { DetectorView } from "@/domain/types";
import { SettingsSection, ConfigTable, ActiveTag, Mono, type Column } from "../ConfigTable";

const columns: Column<DetectorView>[] = [
  { key: "key", header: "Detector", render: (d) => <Mono>{d.detectorKey}</Mono> },
  { key: "label", header: "Label", render: (d) => d.label },
  { key: "strategy", header: "Strategy", render: (d) => d.strategy },
  { key: "threshold", header: "Threshold", align: "right", render: (d) => <Mono>{d.threshold}</Mono> },
  { key: "window", header: "Window (h)", align: "right", render: (d) => <Mono>{d.windowHours}</Mono> },
  { key: "min", header: "Min sample", align: "right", render: (d) => <Mono>{d.minimumSample}</Mono> },
  { key: "weight", header: "Weight", align: "right", render: (d) => <Mono>{d.weight}</Mono> },
  { key: "active", header: "State", render: (d) => <ActiveTag active={d.active} /> },
];

export default function DetectorsView() {
  const { data, isLoading, isError } = useDetectors();
  return (
    <SettingsSection
      title="Drift detectors"
      metadataType="Fleet_Drift_Detector__mdt"
      setupPath="CustomMetadata/home"
    >
      <ConfigTable
        columns={columns}
        rows={data ?? []}
        rowKey={(d) => d.detectorKey}
        isLoading={isLoading}
        isError={isError}
        emptyLabel="No drift detectors are configured."
      />
    </SettingsSection>
  );
}
