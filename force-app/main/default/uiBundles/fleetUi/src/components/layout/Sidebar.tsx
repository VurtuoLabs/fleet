/**
 * Sidebar - grouped primary navigation.
 *
 * Sections are labelled and collapsible; the section holding the current route
 * opens itself, so a deep link never lands the user on a page whose nav parent
 * is shut. Collapsed mode keeps the icons and drops the labels, and the whole
 * rail is a single <nav> landmark with the sections as nested lists.
 */
import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Bot,
  LineChart,
  ClipboardCheck,
  TriangleAlert,
  Waypoints,
  SlidersHorizontal,
  ShieldCheck,
  Gauge,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { UI, FONT, HEAD, RADIUS } from "@/features/shared/tokens";
import { useFleetStore } from "@/design-system/store";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Renders the small accent chip beside the label. */
  badge?: string;
  /** Match child routes too (e.g. /settings/detectors under /settings). */
  deep?: boolean;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/** Routes use /agents rather than /fleet so the path never collides with the
 *  product name (CONTRACT.md §11.4). */
const SECTIONS: NavSection[] = [
  {
    id: "monitor",
    label: "Monitor",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/agents", label: "Agents", icon: Bot, deep: true },
      { to: "/drift", label: "Drift", icon: LineChart },
    ],
  },
  {
    id: "calibrate",
    label: "Calibrate",
    items: [
      { to: "/cases", label: "Golden set", icon: ClipboardCheck, deep: true },
      { to: "/findings", label: "Findings", icon: TriangleAlert, deep: true },
      { to: "/attribution", label: "Attribution", icon: Waypoints, badge: "NEW" },
    ],
  },
  {
    id: "configure",
    label: "Configure",
    items: [
      { to: "/settings/detectors", label: "Detectors", icon: Gauge },
      { to: "/settings/severity", label: "Severity policy", icon: ShieldCheck },
      { to: "/settings", label: "Settings", icon: SlidersHorizontal, deep: true },
    ],
  },
];

/** The Fleet wordmark: teal target glyph + Space Grotesk lockup. */
function Wordmark({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: collapsed ? "18px 0" : "18px 20px",
        justifyContent: collapsed ? "center" : "flex-start",
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: UI.brand,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <svg width="17" height="17" viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="6" fill="none" stroke="#fff" strokeWidth="1.6" />
          <circle cx="8" cy="8" r="2" fill="#fff" />
        </svg>
      </span>
      {!collapsed && (
        <span style={{ lineHeight: 1.15 }}>
          <span
            style={{
              display: "block",
              fontFamily: HEAD,
              fontSize: 17,
              fontWeight: 600,
              color: UI.text,
              letterSpacing: "-0.02em",
            }}
          >
            Fleet
          </span>
          <span style={{ display: "block", fontFamily: FONT, fontSize: 11, color: UI.weakest }}>
            Agent calibration
          </span>
        </span>
      )}
    </div>
  );
}

export function Sidebar() {
  const collapsed = useFleetStore((s) => s.sidebarCollapsed);
  const { pathname } = useLocation();

  const sectionOwning = React.useCallback(
    (section: NavSection) =>
      section.items.some((i) => pathname === i.to || (i.deep && pathname.startsWith(`${i.to}/`))),
    [pathname],
  );

  // Sections start open; navigating into a closed one reopens it.
  const [open, setOpen] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.id, true])),
  );

  React.useEffect(() => {
    const owner = SECTIONS.find(sectionOwning);
    if (owner) setOpen((prev) => (prev[owner.id] ? prev : { ...prev, [owner.id]: true }));
  }, [sectionOwning]);

  return (
    <aside
      style={{
        width: collapsed ? 76 : 248,
        flexShrink: 0,
        background: UI.surface,
        borderRight: `1px solid ${UI.border}`,
        transition: "width 200ms ease",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Wordmark collapsed={collapsed} />

      <nav aria-label="Primary" className="fleet-scroll" style={{ flex: 1, overflowY: "auto", padding: "4px 12px 16px" }}>
        {SECTIONS.map((section) => {
          const isOpen = open[section.id];
          return (
            <section key={section.id} style={{ marginBottom: 14 }}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setOpen((p) => ({ ...p, [section.id]: !p[section.id] }))}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 6,
                    padding: "6px 8px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: FONT,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: UI.weakest,
                  }}
                >
                  {section.label}
                  <ChevronDown
                    size={13}
                    strokeWidth={2.4}
                    style={{
                      transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                      transition: "transform 180ms ease",
                    }}
                  />
                </button>
              )}

              {(isOpen || collapsed) && (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  {section.items.map((item) => (
                    <li key={item.to}>
                      <NavItemLink item={item} collapsed={collapsed} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </nav>

      {!collapsed && (
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${UI.border}` }}>
          <div style={{ fontFamily: FONT, fontSize: 11, color: UI.weakest, lineHeight: 1.5 }}>
            Capture → Calibrate → Judge →<br />
            Attribute → Remediate
          </div>
        </div>
      )}
    </aside>
  );
}

function NavItemLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { icon: Icon } = item;
  return (
    <NavLink
      to={item.to}
      end={!item.deep}
      title={collapsed ? item.label : undefined}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 11,
        padding: collapsed ? "10px 0" : "9px 10px",
        justifyContent: collapsed ? "center" : "flex-start",
        borderRadius: RADIUS.chip + 1,
        textDecoration: "none",
        fontFamily: HEAD,
        fontSize: 13.5,
        fontWeight: 500,
        color: isActive ? UI.brand : UI.weak,
        background: isActive ? `${UI.brand}14` : "transparent",
        transition: "background 140ms ease, color 140ms ease",
      })}
      onPointerEnter={(e) => {
        const el = e.currentTarget;
        if (!el.getAttribute("aria-current")) el.style.background = UI.page;
      }}
      onPointerLeave={(e) => {
        const el = e.currentTarget;
        if (!el.getAttribute("aria-current")) el.style.background = "transparent";
      }}
    >
      <Icon size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
      {!collapsed && (
        <>
          <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
          {item.badge && (
            <span
              style={{
                fontFamily: FONT,
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: UI.accent,
                background: `${UI.accent}1A`,
                border: `1px solid ${UI.accent}33`,
                borderRadius: RADIUS.pill,
                padding: "2px 6px",
                lineHeight: 1,
              }}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
