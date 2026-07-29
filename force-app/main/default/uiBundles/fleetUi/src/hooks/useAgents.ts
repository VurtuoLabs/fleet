import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";

const repos = () => getRepositories();

/** List monitored agents, optionally scoped to a saved view (Fleet_View__mdt). */
export function useAgents(viewKey?: string) {
  return useQuery({
    queryKey: queryKeys.agents.list(viewKey),
    queryFn: () => repos().agents.list(viewKey),
  });
}

/** One agent's detail. */
export function useAgent(agentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.agents.detail(agentId ?? ""),
    queryFn: () => repos().agents.get(agentId as string),
    enabled: Boolean(agentId),
  });
}

/** Toggle monitoring on an agent (Apex write). */
export function useSetMonitoring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, enabled }: { agentId: string; enabled: boolean }) =>
      repos().agents.setMonitoring(agentId, enabled),
    onSuccess: (agent) => {
      qc.invalidateQueries({ queryKey: queryKeys.agents.root() });
      qc.setQueryData(queryKeys.agents.detail(agent.id), agent);
    },
  });
}

/** Quarantine an agent version (requires Fleet_Quarantine_Agent). */
export function useQuarantineAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, reason }: { agentId: string; reason: string }) =>
      repos().agents.quarantine(agentId, reason),
    onSuccess: (agent) => {
      qc.invalidateQueries({ queryKey: queryKeys.agents.root() });
      qc.setQueryData(queryKeys.agents.detail(agent.id), agent);
    },
  });
}

/** Release a quarantined agent (requires Fleet_Quarantine_Agent). */
export function useReleaseAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => repos().agents.release(agentId),
    onSuccess: (agent) => {
      qc.invalidateQueries({ queryKey: queryKeys.agents.root() });
      qc.setQueryData(queryKeys.agents.detail(agent.id), agent);
    },
  });
}
