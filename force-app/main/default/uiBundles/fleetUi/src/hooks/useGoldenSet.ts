import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";
import type { GoldenCaseInput } from "@/domain/types";

const repos = () => getRepositories();

/** Golden cases, optionally scoped to one agent (all agents when omitted). */
export function useGoldenCases(agentId?: string) {
  return useQuery({
    queryKey: queryKeys.goldenSet.cases(agentId),
    queryFn: () => repos().goldenSet.getCases(agentId),
  });
}

/** The baseline-vs-current diff for a golden case. */
export function useCaseDiff(caseId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.goldenSet.diff(caseId ?? ""),
    queryFn: () => repos().goldenSet.getDiff(caseId as string),
    enabled: Boolean(caseId),
  });
}

/** Create or update a golden case (requires Fleet_Curate_Golden_Set). */
export function useUpsertCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GoldenCaseInput) => repos().goldenSet.upsertCase(input),
    onSuccess: (gc) =>
      qc.invalidateQueries({ queryKey: queryKeys.goldenSet.cases(gc.agentId) }),
  });
}

/** Approve an auto-proposed case. */
export function useApproveProposed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) => repos().goldenSet.approveProposed(caseId),
    onSuccess: (gc) =>
      qc.invalidateQueries({ queryKey: queryKeys.goldenSet.cases(gc.agentId) }),
  });
}

/** Deactivate a golden case. */
export function useDeactivateCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caseId: string) => repos().goldenSet.deactivate(caseId),
    onSuccess: (gc) =>
      qc.invalidateQueries({ queryKey: queryKeys.goldenSet.cases(gc.agentId) }),
  });
}
