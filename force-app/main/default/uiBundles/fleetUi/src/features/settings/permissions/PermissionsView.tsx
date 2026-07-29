/**
 * Permissions - read-only view of Fleet's permission model (CONTRACT §7).
 *
 * The custom-permission × permission-set matrix is package structure, not org
 * data, so it is rendered from the shipped model. Setup remains where
 * assignments are made; this shows an operator which permission set grants
 * which capability.
 */
import type { CSSProperties } from "react";
import { UI, MONO } from "@/features/shared/tokens";
import { SettingsSection } from "../ConfigTable";

const PERMISSION_SETS = ["Fleet_Viewer", "Fleet_Operator", "Fleet_Approver", "Fleet_Administrator"] as const;

interface Row {
  permission: string;
  gates: string;
  grants: boolean[]; // aligned to PERMISSION_SETS
}

// CONTRACT §7.3 matrix.
const ROWS: Row[] = [
  { permission: "Fleet_Run_Calibration", gates: "Trigger a manual or CI calibration run", grants: [false, true, true, true] },
  { permission: "Fleet_Bless_Baseline", gates: "Promote a run to the blessed baseline", grants: [false, false, true, true] },
  { permission: "Fleet_Curate_Golden_Set", gates: "Create, edit, approve golden cases", grants: [false, true, true, true] },
  { permission: "Fleet_Approve_Remediation", gates: "Approve a rollback or quarantine reversal", grants: [false, false, true, true] },
  { permission: "Fleet_Quarantine_Agent", gates: "Quarantine or release an agent version", grants: [false, false, true, true] },
  { permission: "Fleet_View_Transcripts", gates: "See raw utterances and responses", grants: [false, true, true, true] },
];

export default function PermissionsView() {
  return (
    <SettingsSection title="Permission model" metadataType="PermissionSet · CustomPermission" setupPath="PermSets/home">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th("left")}>Custom permission</th>
            <th style={th("left")}>Gates</th>
            {PERMISSION_SETS.map((ps) => (
              <th key={ps} style={th("center")}>
                {ps.replace("Fleet_", "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.permission}>
              <td style={{ ...td("left"), fontFamily: MONO, fontSize: 12, color: UI.text }}>{r.permission}</td>
              <td style={{ ...td("left"), fontSize: 12.5, color: UI.weak }}>{r.gates}</td>
              {r.grants.map((g, i) => (
                <td key={PERMISSION_SETS[i]} style={{ ...td("center"), fontWeight: 700 }}>
                  {g ? (
                    <span style={{ color: UI.success }} aria-label="granted">
                      ✓
                    </span>
                  ) : (
                    <span style={{ color: UI.border }} aria-label="not granted">
                      ·
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 12, color: UI.weakest, padding: "10px 16px", lineHeight: 1.5 }}>
        Fleet_View_Transcripts is deliberately separate - most operators need scores and verdicts, not customer text.
        Fleet_Integration is a headless set assigned only to the integration user.
      </div>
    </SettingsSection>
  );
}

function th(align: "left" | "center"): CSSProperties {
  return {
    textAlign: align,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: UI.weakest,
    padding: "10px 16px",
    borderBottom: `1px solid ${UI.border}`,
  };
}

function td(align: "left" | "center"): CSSProperties {
  return { textAlign: align, padding: "10px 16px", borderBottom: `1px solid ${UI.border}` };
}
