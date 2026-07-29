/**
 * Read-only building blocks for the settings views.
 *
 * The /settings/* routes are windows onto Custom Metadata - the console shows
 * what the configuration currently is; Setup remains where it is changed. So
 * every view is a plain table plus a "View in Setup" deep link, and nothing
 * here writes.
 */
import * as React from "react";
import { UI, HEAD, MONO, R } from "@/features/shared/tokens";
import { Panel, Tag, LoadingBlock, ErrorBlock, EmptyBlock } from "@/features/shared/ui";
import { setupHref } from "@/features/shared/meta";

export function SettingsSection({
  title,
  metadataType,
  setupPath,
  children,
}: {
  title: string;
  metadataType: string;
  setupPath: string;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${UI.border}` }}
      >
        <div>
          <h2 style={{ fontFamily: HEAD, fontSize: 15, fontWeight: 600, color: UI.text, margin: 0 }}>{title}</h2>
          <div style={{ fontFamily: MONO, fontSize: 11.5, color: UI.weakest, marginTop: 2 }}>{metadataType}</div>
        </div>
        <a
          href={setupHref(setupPath)}
          target="_top"
          style={{ fontSize: 12.5, color: UI.brand, textDecoration: "none", fontWeight: 500 }}
        >
          View in Setup ↗
        </a>
      </div>
      {children}
    </Panel>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
}

export function ConfigTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  isError,
  emptyLabel,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  emptyLabel: string;
}) {
  if (isLoading) return <LoadingBlock label="Loading configuration" />;
  if (isError) return <ErrorBlock label="Could not load configuration" />;
  if (rows.length === 0) return <EmptyBlock label={emptyLabel} />;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              style={{
                textAlign: c.align ?? "left",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: UI.weakest,
                padding: "10px 16px",
                borderBottom: `1px solid ${UI.border}`,
              }}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((c) => (
              <td
                key={c.key}
                style={{
                  textAlign: c.align ?? "left",
                  fontSize: 13,
                  color: UI.text,
                  padding: "10px 16px",
                  borderBottom: `1px solid ${UI.border}`,
                }}
              >
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ActiveTag({ active }: { active: boolean }) {
  return <Tag color={active ? UI.success : UI.weakest}>{active ? "Active" : "Inactive"}</Tag>;
}

export function Mono({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: MONO, fontSize: 12.5, color: UI.text }}>{children}</span>;
}

export const CELL_RADIUS = R;
