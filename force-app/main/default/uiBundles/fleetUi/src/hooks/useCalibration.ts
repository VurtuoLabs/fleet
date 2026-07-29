import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";
import type { RunRequest } from "@/domain/types";

const repos = () => getRepositories();

/** Recent calibration runs for an agent. */
export function useAgentRuns(agentId: string | undefined, limitN = 20) {
  return useQuery({
    queryKey: queryKeys.calibration.runs(agentId ?? ""),
    queryFn: () => repos().calibration.getRuns(agentId as string, limitN),
    enabled: Boolean(agentId),
  });
}

/** A single calibration run. */
export function useRun(runId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.calibration.run(runId ?? ""),
    queryFn: () => repos().calibration.getRun(runId as string),
    enabled: Boolean(runId),
  });
}

/** Trigger a calibration run (requires Fleet_Run_Calibration). */
export function useRunCalibration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: RunRequest) => repos().calibration.run(request),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: queryKeys.calibration.runs(run.agentId) });
      qc.invalidateQueries({ queryKey: queryKeys.agents.root() });
    },
  });
}

/** Bless a run as the new baseline (requires Fleet_Bless_Baseline). */
export function useBlessBaseline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => repos().calibration.bless(runId),
    onSuccess: (agent) => {
      qc.invalidateQueries({ queryKey: queryKeys.agents.root() });
      qc.setQueryData(queryKeys.agents.detail(agent.id), agent);
    },
  });
}
