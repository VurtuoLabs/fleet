/**
 * CommandPalette - the ⌘K destination search opened from the Topbar.
 *
 * A search affordance that opens a palette with nothing in it is worse than no
 * affordance at all, so this renders the actual list: every primary route plus
 * a jump to each monitored agent, filtered by cmdk's built-in fuzzy match.
 *
 * `useAgents()` is the same query the Agents list page already uses, so
 * TanStack Query serves it from cache on every open after the first - this
 * never adds a second, palette-only fetch of the agent registry.
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  Bot,
  LineChart,
  ClipboardCheck,
  TriangleAlert,
  Waypoints,
  Settings,
} from "lucide-react";
import { UI, FONT, HEAD, RADIUS, SHADOW } from "@/features/shared/tokens";
import { useFleetStore } from "@/design-system/store";
import { useAgents } from "@/hooks";

const DESTINATIONS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: "overview home" },
  { to: "/agents", label: "Agents", icon: Bot, keywords: "monitored fleet" },
  { to: "/drift", label: "Drift", icon: LineChart, keywords: "trueness deviation" },
  { to: "/cases", label: "Golden set", icon: ClipboardCheck, keywords: "cases assertions" },
  { to: "/findings", label: "Findings", icon: TriangleAlert, keywords: "deviation alerts" },
  { to: "/attribution", label: "Attribution", icon: Waypoints, keywords: "change events cause" },
  { to: "/settings", label: "Settings", icon: Settings, keywords: "configuration admin" },
];

export function CommandPalette() {
  const open = useFleetStore((s) => s.commandOpen);
  const setOpen = useFleetStore((s) => s.setCommandOpen);
  const navigate = useNavigate();

  const agentsQ = useAgents();

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Jump to"
      shouldFilter
      style={dialogStyle}
      overlayClassName="fleet-cmdk-overlay"
    >
      <div style={{ borderBottom: `1px solid ${UI.border}`, padding: "4px 4px 0" }}>
        <Command.Input autoFocus placeholder="Jump to a page or agent…" style={inputStyle} />
      </div>
      <Command.List style={{ maxHeight: 360, overflowY: "auto", padding: 6 }}>
        <Command.Empty style={emptyStyle}>Nothing matches.</Command.Empty>

        <Command.Group heading="Pages" style={groupHeadingStyle}>
          {DESTINATIONS.map((d) => (
            <Command.Item
              key={d.to}
              value={`${d.label} ${d.keywords}`}
              onSelect={() => go(d.to)}
              style={itemStyle}
            >
              <d.icon size={15} strokeWidth={2} color={UI.weak} />
              {d.label}
            </Command.Item>
          ))}
        </Command.Group>

        {agentsQ.data && agentsQ.data.length > 0 && (
          <Command.Group heading="Agents" style={groupHeadingStyle}>
            {agentsQ.data.map((a) => (
              <Command.Item
                key={a.id}
                value={`${a.name} ${a.agentApiName}`}
                onSelect={() => go(`/agents/${a.id}`)}
                style={itemStyle}
              >
                <Bot size={15} strokeWidth={2} color={UI.weak} />
                {a.name}
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}

const emptyStyle: React.CSSProperties = {
  padding: "24px 10px",
  textAlign: "center",
  fontFamily: FONT,
  fontSize: 13,
  color: UI.weakest,
};

const dialogStyle: React.CSSProperties = {
  position: "fixed",
  top: "18%",
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(560px, calc(100vw - 32px))",
  background: UI.surface,
  border: `1px solid ${UI.border}`,
  borderRadius: RADIUS.card,
  boxShadow: SHADOW.float,
  overflow: "hidden",
  zIndex: 91,
  fontFamily: FONT,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  padding: "12px 10px",
  fontFamily: HEAD,
  fontSize: 14.5,
  color: UI.text,
  background: "transparent",
};

const groupHeadingStyle: React.CSSProperties = {
  fontFamily: FONT,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: UI.weakest,
  padding: "8px 10px 4px",
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: RADIUS.chip,
  fontFamily: FONT,
  fontSize: 13.5,
  color: UI.text,
  cursor: "pointer",
};
