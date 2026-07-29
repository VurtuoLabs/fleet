/**
 * DashboardPage - the overview must agree with the pages it links to.
 *
 * The dashboard derives every number from the same seam the detail pages read,
 * so the risk it carries is a derivation drifting away from its source rather
 * than a rendering bug. These cover the derivations that would be silently wrong
 * if they broke: the KPI roll-ups, the coverage donut's total, and the delta
 * pill's direction on a metric where falling is the good outcome.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "@/features/dashboard/DashboardPage";

const { AGENTS, FINDINGS, BOARD } = vi.hoisted(() => {
  const line = (from: number, to: number) =>
    [0, 24, 48, 72].map((t) => ({ t, v: from + ((to - from) * t) / 72 }));

  return {
    AGENTS: [
      {
        id: "a1",
        name: "Refund Concierge",
        agentApiName: "refund",
        currentVersion: "v2",
        blessedVersion: "v2",
        truenessScore: 94,
        status: "true",
        monitoringEnabled: true,
        lastCalibratedAt: null,
        quarantinedAt: null,
        casesPassing: 18,
        casesTotal: 20,
      },
      {
        id: "a2",
        name: "Billing Inquiry",
        agentApiName: "billing",
        currentVersion: "v1",
        blessedVersion: "v1",
        truenessScore: 62,
        status: "drift",
        monitoringEnabled: true,
        lastCalibratedAt: null,
        quarantinedAt: null,
        casesPassing: 6,
        casesTotal: 10,
      },
    ],
    FINDINGS: [
      {
        id: "f1",
        findingNumber: "F-00001",
        agentId: "a2",
        agentName: "Billing Inquiry",
        severity: "Critical",
        state: "Open",
        headline: "Routing drift on refund questions",
        detail: "",
        detector: "STRUCTURAL_DRIFT",
        openedAt: new Date().toISOString(),
        attributedChange: {
          changeEventId: "c1",
          label: "KB-4471 republished",
          kind: "Knowledge",
          actor: "Alex",
        },
        attributionConfidence: 0.86,
        casesFailing: 4,
        casesTotal: 10,
        agentAction: null,
        remediation: null,
      },
    ],
    BOARD: {
      windowHours: 72,
      threshold: 80,
      changes: [],
      series: [
        { agentId: "a1", agentName: "Refund Concierge", status: "true", currentScore: 94, points: line(96, 94) },
        { agentId: "a2", agentName: "Billing Inquiry", status: "drift", currentScore: 62, points: line(88, 62) },
      ],
    },
  };
});

vi.mock("@/hooks", () => ({
  useAgents: () => ({ data: AGENTS, isLoading: false, isError: false }),
  useFindings: () => ({ data: FINDINGS, isLoading: false, isError: false }),
  useDriftBoard: () => ({ data: BOARD, isLoading: false, isError: false }),
  useChangeEvents: () => ({ data: [{ id: "c1" }], isLoading: false, isError: false }),
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rolls the KPI strip up from the same data the detail pages read", () => {
    renderDashboard();

    expect(within(screen.getByTestId("stat-agents")).getByText("2")).toBeInTheDocument();

    // (94 + 62) / 2 = 78, rounded.
    expect(within(screen.getByTestId("stat-trueness")).getByText("78")).toBeInTheDocument();

    // Golden cases is the sum of every agent's curated total: 20 + 10.
    expect(within(screen.getByTestId("stat-cases")).getByText("30")).toBeInTheDocument();
  });

  it("totals the coverage donut to the curated case count", () => {
    renderDashboard();
    // The donut's centre is the same 30 the KPI reports - if these disagree, one
    // of the two derivations is wrong.
    expect(screen.getByLabelText(/Total curated cases: 30/i)).toBeInTheDocument();
  });

  it("treats a fall in open findings as an improvement, not a regression", () => {
    renderDashboard();
    // One open finding, trending down: the pill must read as good (success), so
    // the arrow points down and the value is negative rather than alarming red.
    expect(within(screen.getByTestId("stat-findings")).getByText(/−1/)).toBeInTheDocument();
  });

  it("shows the agent below threshold in the health panel with its score", () => {
    renderDashboard();
    const health = within(screen.getByTestId("agent-health-panel"));
    expect(health.getByText("Billing Inquiry")).toBeInTheDocument();
    expect(health.getByText("62")).toBeInTheDocument();
  });

  it("surfaces the open finding with the change it was attributed to", () => {
    renderDashboard();
    const panel = within(screen.getByTestId("recent-findings-panel"));
    expect(panel.getByText("Routing drift on refund questions")).toBeInTheDocument();
    expect(panel.getByText("KB-4471 republished")).toBeInTheDocument();
    expect(panel.getByText("86%")).toBeInTheDocument();
  });

  it("switches the trend window through the segmented control", () => {
    renderDashboard();
    const group = screen.getByRole("radiogroup", { name: /trend window/i });
    const options = within(group).getAllByRole("radio");
    expect(options).toHaveLength(3);

    const sevenDays = within(group).getByRole("radio", { name: "7 days" });
    fireEvent.click(sevenDays);
    expect(sevenDays).toHaveAttribute("aria-checked", "true");
  });
});
