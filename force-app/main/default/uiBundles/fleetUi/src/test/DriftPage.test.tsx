/**
 * DriftPage - change-marker alignment.
 *
 * The contract's headline frontend test: a change that happened `t` hours into
 * the 72h window must render its rail marker at exactly the x the trueness line
 * is sampled at hour `t`. We assert the rendered marker's x against the shared
 * geometry (makeScales), and that the marker's connecting tick uses the same x,
 * so the rail can never drift away from the plot. We also cover the threshold,
 * the ghost lines, and the deep link into Attribution.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import DriftPage from "@/features/drift/DriftPage";
import { makeScales } from "@/features/drift/driftGeometry";

const { BOARD, MARKERS } = vi.hoisted(() => {
  const line = (from: number, to: number) =>
    [0, 12, 24, 36, 48, 60, 72].map((t) => ({ t, v: from + ((to - from) * t) / 72 }));

  const markers = [
    { id: "m1", changeEventId: "c2", kind: "Knowledge", label: "KB-4471 republished", t: 26 },
    { id: "m2", changeEventId: "c1", kind: "Deploy", label: "Refund v2.4", t: 9 },
    { id: "m3", changeEventId: "c4", kind: "Prompt", label: "Greeting v6", t: 58 },
  ];

  const board = {
    windowHours: 72,
    threshold: 80,
    series: [
      {
        agentId: "renewal",
        agentName: "Renewal Outreach",
        status: "drift",
        currentScore: 71, // lowest → auto-selected
        points: line(94, 71),
        changes: markers,
      },
      {
        agentId: "refund",
        agentName: "Refund Concierge",
        status: "true",
        currentScore: 98,
        points: line(97, 98),
        changes: [],
      },
      {
        agentId: "claims",
        agentName: "Claims Triage",
        status: "true",
        currentScore: 94,
        points: line(94, 94),
        changes: [],
      },
    ],
  };
  return { BOARD: board, MARKERS: markers };
});

vi.mock("@/hooks", () => ({
  useDriftBoard: () => ({ data: BOARD, isLoading: false, isError: false }),
}));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/drift"]}>
      <Routes>
        <Route path="/drift" element={<DriftPage />} />
        <Route path="/attribution" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DriftPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the chart, threshold and below-threshold zone", () => {
    renderPage();
    expect(screen.getByTestId("drift-chart")).toBeInTheDocument();
    expect(screen.getByTestId("threshold-line")).toBeInTheDocument();
    expect(screen.getByTestId("below-threshold-zone")).toBeInTheDocument();
    expect(screen.getByText("Tolerance 80")).toBeInTheDocument();
  });

  it("draws a ghost line for every non-selected agent and one selected line", () => {
    renderPage();
    // renewal is selected (lowest score); refund + claims are ghosts.
    expect(screen.getByTestId("ghost-line-refund")).toBeInTheDocument();
    expect(screen.getByTestId("ghost-line-claims")).toBeInTheDocument();
    expect(screen.queryByTestId("ghost-line-renewal")).not.toBeInTheDocument();
    expect(screen.getByTestId("selected-line")).toBeInTheDocument();
  });

  it("aligns each change marker with the shared geometry for its hour", () => {
    renderPage();
    const scales = makeScales(72);

    for (const m of MARKERS) {
      const marker = screen.getByTestId(`change-marker-${m.id}`);
      const expectedX = scales.xForHour(m.t);

      const renderedX = Number(marker.getAttribute("data-x"));
      expect(renderedX).toBeCloseTo(expectedX, 1);

      // the connecting tick that drops from the plot into the rail uses the same x
      const tick = within(marker).getByTestId(`change-tick-${m.id}`);
      expect(Number(tick.getAttribute("x1"))).toBeCloseTo(expectedX, 1);
      expect(Number(tick.getAttribute("x2"))).toBeCloseTo(expectedX, 1);
    }
  });

  it("orders markers left-to-right by the hour they occurred", () => {
    renderPage();
    const xForHour9 = Number(screen.getByTestId("change-marker-m2").getAttribute("data-x"));
    const xForHour26 = Number(screen.getByTestId("change-marker-m1").getAttribute("data-x"));
    const xForHour58 = Number(screen.getByTestId("change-marker-m3").getAttribute("data-x"));
    expect(xForHour9).toBeLessThan(xForHour26);
    expect(xForHour26).toBeLessThan(xForHour58);
  });

  it("deep-links to Attribution for the marker's change event when clicked", () => {
    renderPage();
    fireEvent.click(screen.getByTestId("change-marker-m1"));
    expect(screen.getByTestId("location")).toHaveTextContent("/attribution?change=c2");
  });
});
