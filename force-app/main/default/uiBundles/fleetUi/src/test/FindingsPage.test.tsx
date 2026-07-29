/**
 * FindingsPage - the approval flow.
 *
 * A finding whose remediation is Pending_Approval exposes Approve / Hold /
 * View-trace controls. Approving must call the Apex-backed mutation with the
 * remediation id (the permission-gated state transition), Hold must call reject
 * with a reason, a succeeded approval must swap the controls for a confirmation,
 * and a finding with no pending remediation must show no approve control. We
 * also assert findings render most-severe first.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FindingsPage from "@/features/findings/FindingsPage";
import { useFindings, useApproveRemediation, useRejectRemediation } from "@/hooks";

vi.mock("@/hooks", () => ({
  useFindings: vi.fn(),
  useApproveRemediation: vi.fn(),
  useRejectRemediation: vi.fn(),
}));

const CRITICAL = {
  id: "crit",
  findingNumber: "F-2291",
  agentId: "onboard",
  agentName: "Onboarding Guide",
  severity: "Critical",
  state: "Approval",
  headline: "Stopped invoking Verify_Entitlement",
  detail: "9 of 14 golden cases fail the must_invoke assertion.",
  detector: "STRUCTURAL_DRIFT",
  openedAt: new Date(Date.now() - 4 * 3600e3).toISOString(),
  attributedChange: { changeEventId: "c4", label: "Onboarding_Greeting v6", kind: "Prompt", actor: "A. Imperiale" },
  attributionConfidence: 0.82,
  casesFailing: 9,
  casesTotal: 14,
  agentAction: "Version quarantined. Rollback to v5.4 awaiting approval.",
  remediation: { id: "r1", actionLabel: "rollback to v5.4", approvalState: "Pending_Approval" },
};

const ADVISORY = {
  id: "adv",
  findingNumber: "F-2284",
  agentId: "billing",
  agentName: "Billing Inquiry",
  severity: "Advisory",
  state: "Monitoring",
  headline: "Credit burn per resolution up 31 percent",
  detail: "Cost drift without accuracy drift.",
  detector: "ECONOMIC_DRIFT",
  openedAt: new Date(Date.now() - 2 * 86400e3).toISOString(),
  attributedChange: { changeEventId: "c3", label: "Atlas rollforward", kind: "Model", actor: "Salesforce" },
  attributionConfidence: 0.4,
  casesFailing: 0,
  casesTotal: 17,
  agentAction: "Monitoring.",
  remediation: null,
};

let approveMutate: ReturnType<typeof vi.fn>;
let rejectMutate: ReturnType<typeof vi.fn>;

function mockApprove(over: Record<string, unknown> = {}) {
  vi.mocked(useApproveRemediation).mockReturnValue({
    mutate: approveMutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    ...over,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  approveMutate = vi.fn();
  rejectMutate = vi.fn();
  mockApprove();
  vi.mocked(useRejectRemediation).mockReturnValue({ mutate: rejectMutate, isPending: false } as never);
  vi.mocked(useFindings).mockReturnValue({ data: [ADVISORY, CRITICAL], isLoading: false, isError: false } as never);
});

function renderPage() {
  return render(
    <MemoryRouter>
      <FindingsPage />
    </MemoryRouter>,
  );
}

describe("FindingsPage", () => {
  it("renders findings most-severe first", () => {
    renderPage();
    const cards = screen.getAllByTestId(/^finding-/);
    expect(cards[0]).toHaveAttribute("data-testid", "finding-crit");
    expect(cards[1]).toHaveAttribute("data-testid", "finding-adv");
  });

  it("shows the headline, attributed cause and agent action", () => {
    renderPage();
    expect(screen.getByText("Stopped invoking Verify_Entitlement")).toBeInTheDocument();
    expect(screen.getByText("Onboarding_Greeting v6")).toBeInTheDocument();
    expect(screen.getByText(/Rollback to v5\.4 awaiting approval/)).toBeInTheDocument();
  });

  it("approves the pending remediation through Apex with its id", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /approve rollback to v5\.4/i }));
    expect(approveMutate).toHaveBeenCalledTimes(1);
    expect(approveMutate).toHaveBeenCalledWith({ remediationId: "r1" });
  });

  it("holds (rejects) the pending remediation with a reason", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /^hold$/i }));
    expect(rejectMutate).toHaveBeenCalledTimes(1);
    expect(rejectMutate).toHaveBeenCalledWith(
      expect.objectContaining({ remediationId: "r1", reason: expect.any(String) }),
    );
  });

  it("swaps the controls for a confirmation once the approval succeeds", () => {
    mockApprove({ isSuccess: true });
    renderPage();
    expect(screen.getByText(/rollback approved/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve rollback/i })).not.toBeInTheDocument();
  });

  it("shows no approve control for a finding with no pending remediation", () => {
    vi.mocked(useFindings).mockReturnValue({ data: [ADVISORY], isLoading: false, isError: false } as never);
    renderPage();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });
});
