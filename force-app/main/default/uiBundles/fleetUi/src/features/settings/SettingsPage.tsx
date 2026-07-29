/**
 * SettingsPage - read-only windows onto Fleet's Custom Metadata configuration.
 *
 * A sub-nav switches between the seeded metadata surfaces (setting defaults,
 * detectors, severity policy, assertion types, saved views, permission model).
 * Nothing here writes: Setup stays the single source of truth, the console just
 * shows what the configuration currently is. Routing is self-contained via a
 * nested <Routes>, so this mounts under /settings/* regardless of the parent
 * route table.
 *
 * Data seam: useSetting() → SettingView (the single Default record).
 */
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { UI, HEAD, MONO, R } from "@/features/shared/tokens";
import { formatScore } from "@/features/shared/meta";
import { PageTitle, Panel, SectionLabel, LoadingBlock, ErrorBlock } from "@/features/shared/ui";
import { useSetting } from "@/hooks";
import { SettingsSection } from "./ConfigTable";
import DetectorsView from "./detectors/DetectorsView";
import SeverityView from "./severity/SeverityView";
import AssertionsView from "./assertions/AssertionsView";
import ViewsView from "./views/ViewsView";
import PermissionsView from "./permissions/PermissionsView";

const NAV = [
  { to: "general", label: "General" },
  { to: "detectors", label: "Detectors" },
  { to: "severity", label: "Severity" },
  { to: "assertions", label: "Assertions" },
  { to: "views", label: "Views" },
  { to: "permissions", label: "Permissions" },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle title="Settings" subtitle="Read-only view of Fleet configuration. Change it in Setup." />

      <div className="flex gap-4 items-start">
        <nav style={{ width: 180, flexShrink: 0 }}>
          <Panel className="py-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                style={({ isActive }) => ({
                  display: "block",
                  padding: "9px 14px",
                  fontFamily: HEAD,
                  fontSize: 13.5,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? UI.brand : UI.weak,
                  borderLeft: `3px solid ${isActive ? UI.brand : "transparent"}`,
                  background: isActive ? "#E8F1F0" : "transparent",
                  textDecoration: "none",
                })}
              >
                {n.label}
              </NavLink>
            ))}
          </Panel>
        </nav>

        <div className="flex-1" style={{ minWidth: 0 }}>
          <Routes>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="general" element={<GeneralView />} />
            <Route path="detectors" element={<DetectorsView />} />
            <Route path="severity" element={<SeverityView />} />
            <Route path="assertions" element={<AssertionsView />} />
            <Route path="views" element={<ViewsView />} />
            <Route path="permissions" element={<PermissionsView />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function GeneralView() {
  const { data, isLoading, isError } = useSetting();

  return (
    <SettingsSection title="Defaults" metadataType="Fleet_Setting__mdt · Default" setupPath="CustomMetadata/home">
      {isLoading ? (
        <LoadingBlock label="Loading settings" />
      ) : isError || !data ? (
        <ErrorBlock label="Could not load settings" />
      ) : (
        <div className="grid grid-cols-3 gap-px" style={{ background: UI.border }}>
          <Cell label="Monitoring" value={data.monitoringEnabled ? "Enabled" : "Disabled"} />
          <Cell label="Trueness threshold" value={formatScore(data.truenessThreshold)} mono />
          <Cell label="Max cases / run" value={String(data.maxCasesPerRun)} mono />
          <Cell label="Prefilter lower bound" value={String(data.prefilterLowerBound)} mono />
          <Cell label="Prefilter upper bound" value={String(data.prefilterUpperBound)} mono />
          <Cell label="Judge template" value={data.judgeTemplateName} mono />
          <Cell label="Default schedule" value={data.defaultScheduleCron} mono />
          <Cell label="Case result retention" value={`${data.retentionDaysCaseResult} days`} />
          <Cell label="Trace retention" value={`${data.retentionDaysTrace} days`} />
          <Cell label="Auto-curation" value={data.autoCurationEnabled ? "Enabled" : "Disabled"} />
          <Cell label="CI gate" value={data.ciGateEnabled ? "Enabled" : "Disabled"} />
        </div>
      )}
    </SettingsSection>
  );
}

function Cell({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ background: UI.surface, padding: "12px 16px", borderRadius: R }}>
      <SectionLabel>{label}</SectionLabel>
      <div
        style={{
          fontSize: 14,
          color: UI.text,
          marginTop: 5,
          fontFamily: mono ? MONO : HEAD,
          fontWeight: mono ? 500 : 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}
