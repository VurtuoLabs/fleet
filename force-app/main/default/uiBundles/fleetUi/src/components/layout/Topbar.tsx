/**
 * Topbar - collapse toggle, command search, theme, findings bell, account.
 *
 * The search field is a button, not an input: it opens the cmdk palette, and a
 * real input here would capture focus and typing that the palette should own.
 * It is rendered as a button so screen readers announce it as one and the ⌘K
 * hint is not mistaken for placeholder text.
 */
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Moon, Sun, PanelLeft, Search, Bell, ChevronDown, Play } from "lucide-react";
import { UI, FONT, HEAD, MONO, RADIUS, SHADOW } from "@/features/shared/tokens";
import { useTheme } from "@/design-system/theme";
import { useFleetStore } from "@/design-system/store";
import { useFindings } from "@/hooks";
import { CommandPalette } from "./CommandPalette";

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const toggleSidebar = useFleetStore((s) => s.toggleSidebar);
  const toggleCommand = useFleetStore((s) => s.toggleCommand);
  const { data: findings } = useFindings({ openOnly: true });
  const openCount = findings?.length ?? 0;

  // ⌘K / Ctrl-K opens the palette from anywhere in the console.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleCommand();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCommand]);

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "0 20px",
          background: UI.surface,
          borderBottom: `1px solid ${UI.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          <IconButton label="Toggle navigation" onClick={toggleSidebar}>
            <PanelLeft size={17} strokeWidth={2} />
          </IconButton>

          <button
            type="button"
            onClick={toggleCommand}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: "min(420px, 100%)",
              padding: "8px 12px",
              background: UI.page,
              border: `1px solid ${UI.border}`,
              borderRadius: RADIUS.chip + 2,
              cursor: "pointer",
              color: UI.weakest,
              textAlign: "left",
            }}
          >
            <Search size={15} strokeWidth={2} />
            <span style={{ flex: 1, fontFamily: FONT, fontSize: 13 }}>
              Search agents, cases, findings…
            </span>
            <kbd
              style={{
                fontFamily: MONO,
                fontSize: 10.5,
                color: UI.weak,
                background: UI.surface,
                border: `1px solid ${UI.border}`,
                borderRadius: 5,
                padding: "2px 6px",
                lineHeight: 1.4,
              }}
            >
              ⌘K
            </kbd>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconButton label={theme === "dark" ? "Light mode" : "Dark mode"} onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun size={17} strokeWidth={2} />
            ) : (
              <Moon size={17} strokeWidth={2} />
            )}
          </IconButton>

          <Link to="/findings" style={{ textDecoration: "none" }}>
            <IconButton label={`${openCount} open findings`} as="span">
              <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
                <Bell size={17} strokeWidth={2} />
                {openCount > 0 && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: -3,
                      right: -3,
                      minWidth: 8,
                      height: 8,
                      borderRadius: 99,
                      background: UI.error,
                      border: `1.5px solid ${UI.surface}`,
                    }}
                  />
                )}
              </span>
            </IconButton>
          </Link>

          <RunButton />
          <AccountMenu />
        </div>
      </header>
      <CommandPalette />
    </>
  );
}

function RunButton() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/agents")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "8px 14px",
        background: UI.brand,
        color: "#fff",
        border: "none",
        borderRadius: RADIUS.chip + 2,
        fontFamily: HEAD,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        boxShadow: SHADOW.card,
      }}
    >
      <Play size={14} strokeWidth={2.4} />
      Run calibration
    </button>
  );
}

/** Account chip. The menu is a disclosure, not a link list, so Escape closes it. */
function AccountMenu() {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 8px 5px 5px",
          background: "transparent",
          border: `1px solid ${UI.border}`,
          borderRadius: RADIUS.pill,
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: 99,
            background: `linear-gradient(135deg, ${UI.brand}, ${UI.accent})`,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontFamily: HEAD,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          A
        </span>
        <span style={{ fontFamily: HEAD, fontSize: 13, fontWeight: 500, color: UI.text }}>
          Alex
        </span>
        <ChevronDown size={14} strokeWidth={2.2} color={UI.weakest} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            minWidth: 190,
            background: UI.surface,
            border: `1px solid ${UI.border}`,
            borderRadius: RADIUS.chip + 2,
            boxShadow: SHADOW.float,
            padding: 6,
            zIndex: 30,
          }}
        >
          <div
            style={{ padding: "8px 10px", borderBottom: `1px solid ${UI.border}`, marginBottom: 4 }}
          >
            <div style={{ fontFamily: HEAD, fontSize: 13, fontWeight: 600, color: UI.text }}>
              Alex
            </div>
            <div style={{ fontFamily: FONT, fontSize: 11.5, color: UI.weakest }}>
              Fleet Administrator
            </div>
          </div>
          <MenuLink to="/settings/permissions" onNavigate={() => setOpen(false)}>
            Permissions
          </MenuLink>
          <MenuLink to="/settings" onNavigate={() => setOpen(false)}>
            Settings
          </MenuLink>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  to,
  children,
  onNavigate,
}: {
  to: string;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onNavigate}
      style={{
        display: "block",
        padding: "8px 10px",
        borderRadius: RADIUS.chip,
        textDecoration: "none",
        fontFamily: FONT,
        fontSize: 13,
        color: UI.weak,
      }}
      onPointerEnter={(e) => (e.currentTarget.style.background = UI.page)}
      onPointerLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </Link>
  );
}

/** Square ghost button used for the icon affordances in the bar. */
function IconButton({
  children,
  label,
  onClick,
  as = "button",
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  as?: "button" | "span";
}) {
  const style: React.CSSProperties = {
    width: 36,
    height: 36,
    display: "grid",
    placeItems: "center",
    borderRadius: RADIUS.chip + 2,
    border: `1px solid ${UI.border}`,
    background: UI.surface,
    color: UI.weak,
    cursor: "pointer",
  };
  if (as === "span") {
    return (
      <span aria-label={label} role="img" style={style}>
        {children}
      </span>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} style={style}>
      {children}
    </button>
  );
}
