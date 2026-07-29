import { Navigate, Route, Routes, Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

import DashboardPage from "@/features/dashboard/DashboardPage";
import AgentsPage from "@/features/agents/AgentsPage";
import AgentDetail from "@/features/agents/AgentDetail";
import DriftPage from "@/features/drift/DriftPage";
import CasesPage from "@/features/cases/CasesPage";
import CaseDiffRoute from "@/features/cases/CaseDiff";
import FindingsPage from "@/features/findings/FindingsPage";
import AttributionPage from "@/features/attribution/AttributionPage";
import SettingsPage from "@/features/settings/SettingsPage";
import RunDetail from "./RunDetail";

function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="font-head text-xl font-semibold text-foreground">
        Nothing here
      </h1>
      <p className="text-sm text-muted-foreground">
        That route is not part of the Fleet console.
      </p>
      <Button asChild variant="neutral">
        <Link to="/dashboard">Back to the dashboard</Link>
      </Button>
    </div>
  );
}

/**
 * Route table (CONTRACT.md §11.4), using /agents instead of /fleet so the
 * internal route never collides with the product name. Everything renders
 * inside the AppShell layout route. /settings/* is handled by SettingsPage's
 * own nested <Routes>.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/agents/:agentId" element={<AgentDetail />} />
        <Route path="/drift" element={<DriftPage />} />
        <Route path="/cases" element={<CasesPage />} />
        <Route path="/cases/:caseId" element={<CaseDiffRoute />} />
        <Route path="/findings" element={<FindingsPage />} />
        <Route path="/findings/:findingId" element={<FindingsPage />} />
        <Route path="/attribution" element={<AttributionPage />} />
        <Route path="/runs/:runId" element={<RunDetail />} />
        <Route path="/settings/*" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
