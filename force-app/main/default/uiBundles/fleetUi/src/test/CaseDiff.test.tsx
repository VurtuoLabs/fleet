/**
 * CaseDiff - baseline vs current rendering.
 *
 * Exercises the pure component with a fixed CaseDiffView: the changed spans are
 * highlighted inline on both sides, the grounding delta marks kept vs dropped
 * sources, and the assertion list and failing-count chip reflect the pass/fail
 * verdicts. No hooks or router - the presentational component takes its data as
 * a prop (@/hooks is mocked only because the module's route wrapper imports it).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CaseDiff } from "@/features/cases/CaseDiff";

vi.mock("@/hooks", () => ({ useCaseDiff: vi.fn() }));

const DIFF = {
  caseId: "c1",
  caseKey: "renewal_past_cancellation_window",
  agentName: "Renewal Outreach",
  utterance: "I want to cancel my renewal, it auto-charged me yesterday",
  baselineVersion: "v3.0",
  currentVersion: "v3.1",
  calibratedAt: new Date().toISOString(),
  baseline: [
    { text: "Your renewal processed on July 24. Because that is within the " },
    { text: "30 day cancellation window described in your agreement", changed: true },
    { text: ", I can process a full reversal right now. Shall I go ahead?" },
  ],
  current: [
    { text: "Your renewal processed on July 24. Because that is within the " },
    { text: "standard review period", changed: true },
    { text: ", I can process a full reversal right now. Shall I go ahead?" },
  ],
  grounding: { baseline: ["KB-1102", "KB-4471"], current: ["KB-1102"] },
  assertions: [
    { label: "must_route_to: Renewal_Policy", passed: true },
    { label: "must_ground_in: KB-1102", passed: true },
    { label: "must_ground_in: KB-4471", passed: false },
    { label: "must_convey: specific cancellation window", passed: false },
    { label: "must_not_invoke: Issue_Refund", passed: true },
  ],
};

// The pure component types its prop as CaseDiffView; the fixture matches that shape.
const props = { diff: DIFF } as unknown as Parameters<typeof CaseDiff>[0];

describe("CaseDiff", () => {
  it("renders the case key and utterance", () => {
    render(<CaseDiff {...props} />);
    expect(screen.getByText("renewal_past_cancellation_window")).toBeInTheDocument();
    expect(
      screen.getByText("I want to cancel my renewal, it auto-charged me yesterday"),
    ).toBeInTheDocument();
  });

  it("highlights the differing span on each side", () => {
    render(<CaseDiff {...props} />);
    const baseline = screen.getByTestId("response-baseline");
    const current = screen.getByTestId("response-current");

    const baselineChanged = baseline.querySelector('[data-changed="true"]');
    const currentChanged = current.querySelector('[data-changed="true"]');

    expect(baselineChanged?.textContent).toContain("30 day cancellation window");
    expect(currentChanged?.textContent).toBe("standard review period");
  });

  it("marks the grounding delta: kept sources vs dropped sources", () => {
    render(<CaseDiff {...props} />);
    expect(screen.getByTestId("grounding-KB-1102")).toHaveAttribute("data-kept", "true");
    expect(screen.getByTestId("grounding-KB-4471")).toHaveAttribute("data-kept", "false");
    expect(screen.getByText(/KB-4471 is no longer retrieved/i)).toBeInTheDocument();
  });

  it("lists assertions with the right pass/fail split and failing count", () => {
    render(<CaseDiff {...props} />);
    expect(screen.getAllByTestId("assertion-pass")).toHaveLength(3);
    expect(screen.getAllByTestId("assertion-fail")).toHaveLength(2);
    expect(screen.getByText("2 assertions failing")).toBeInTheDocument();
  });
});
