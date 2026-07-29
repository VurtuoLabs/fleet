import { create } from "zustand";

/**
 * Ephemeral UI state (zustand). This is deliberately NOT server state - that
 * lives in TanStack Query. Here we keep only cross-component view state: the
 * selected agent, the active change marker on the rail, the console tab, the
 * command palette, and sidebar collapse.
 */

export type ConsoleTab = "diff" | "findings" | "attribution";

interface FleetUiState {
  /** Currently focused agent on the console (drives the drift chart line). */
  selectedAgentId: string | null;
  setSelectedAgentId: (agentId: string | null) => void;

  /** Active change marker on the timeline rail. */
  activeChangeId: string | null;
  setActiveChangeId: (changeId: string | null) => void;

  /** Console tab under the drift chart. */
  consoleTab: ConsoleTab;
  setConsoleTab: (tab: ConsoleTab) => void;

  /**
   * Pick a change marker: selects it AND switches to the attribution tab, the
   * exact interaction from the console mockup's `pick()`.
   */
  pickChange: (changeId: string) => void;

  /** cmdk command palette. */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;

  /** Sidebar collapse on narrow layouts. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useFleetStore = create<FleetUiState>((set) => ({
  selectedAgentId: null,
  setSelectedAgentId: (agentId) => set({ selectedAgentId: agentId }),

  activeChangeId: null,
  setActiveChangeId: (changeId) => set({ activeChangeId: changeId }),

  consoleTab: "diff",
  setConsoleTab: (tab) => set({ consoleTab: tab }),

  pickChange: (changeId) =>
    set({ activeChangeId: changeId, consoleTab: "attribution" }),

  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
