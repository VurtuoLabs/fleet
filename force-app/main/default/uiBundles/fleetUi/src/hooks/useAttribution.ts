import { useQuery } from "@tanstack/react-query";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";
import { DRIFT_WINDOW_HOURS } from "@/lib/constants";

const repos = () => getRepositories();

/** The trueness board for the drift chart: series + threshold + change rail. */
export function useDriftBoard(windowHours = DRIFT_WINDOW_HOURS) {
  return useQuery({
    queryKey: queryKeys.drift.board(windowHours),
    queryFn: () => repos().changes.getDriftBoard(windowHours),
  });
}

/** The change ledger - deploys, KB publishes, model rollforwards, prompt edits. */
export function useChangeEvents(windowHours = DRIFT_WINDOW_HOURS) {
  return useQuery({
    queryKey: queryKeys.changes.list(windowHours),
    queryFn: () => repos().changes.getChangeEvents(windowHours),
  });
}

/** A single change event. */
export function useChange(changeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.changes.detail(changeId ?? ""),
    queryFn: () => repos().changes.getChange(changeId as string),
    enabled: Boolean(changeId),
  });
}

/**
 * Attribution for a change event: correlated deviations, blast radius, and a
 * confidence, computed by FleetAttributionService against each source's window.
 */
export function useAttribution(changeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.changes.attribution(changeId ?? ""),
    queryFn: () => repos().changes.attribute(changeId as string),
    enabled: Boolean(changeId),
  });
}
