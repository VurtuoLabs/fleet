import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";
import type { FindingInput, FindingQuery } from "@/domain/types";

const repos = () => getRepositories();

/** Findings, optionally filtered. Deviation_Finding__c is Private (§7.4). */
export function useFindings(query?: FindingQuery) {
  return useQuery({
    queryKey: queryKeys.findings.list(query),
    queryFn: () => repos().findings.getFindings(query),
  });
}

/** A single finding with its remediation trail. */
export function useFinding(findingId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.findings.detail(findingId ?? ""),
    queryFn: () => repos().findings.getFinding(findingId as string),
    enabled: Boolean(findingId),
  });
}

/** Open a finding (also grants Apex managed sharing). */
export function useOpenFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FindingInput) => repos().findings.open(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.findings.root() }),
  });
}

/** Close a finding with a reason. */
export function useCloseFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ findingId, reason }: { findingId: string; reason: string }) =>
      repos().findings.close(findingId, reason),
    onSuccess: (finding) => {
      qc.invalidateQueries({ queryKey: queryKeys.findings.root() });
      qc.setQueryData(queryKeys.findings.detail(finding.id), finding);
    },
  });
}

/* -------------------------- Remediation mutations ------------------------ */

/** Propose a remediation for a finding. */
export function useProposeRemediation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (findingId: string) => repos().remediation.propose(findingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.findings.root() }),
  });
}

/** Approve a remediation (requires Fleet_Approve_Remediation). */
export function useApproveRemediation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ remediationId }: { remediationId: string }) =>
      repos().remediation.approve(remediationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.findings.root() }),
  });
}

/** Reject (hold) a remediation with a reason. */
export function useRejectRemediation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      remediationId,
      reason,
    }: {
      remediationId: string;
      reason: string;
    }) => repos().remediation.reject(remediationId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.findings.root() }),
  });
}

/** Execute an approved remediation (idempotent on Idempotency_Key__c). */
export function useExecuteRemediation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ remediationId }: { remediationId: string }) =>
      repos().remediation.execute(remediationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.findings.root() }),
  });
}
