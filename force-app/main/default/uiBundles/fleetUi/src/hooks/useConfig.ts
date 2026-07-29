import { useQuery } from "@tanstack/react-query";
import { getRepositories } from "@/salesforce/factory";
import { queryKeys } from "./queryKeys";

const repos = () => getRepositories();

/** Fleet_Setting__mdt Default record (read-only). */
export function useSetting() {
  return useQuery({
    queryKey: queryKeys.config.setting(),
    queryFn: () => repos().config.getSetting(),
  });
}

/** Saved views (Fleet_View__mdt) - powers the agents view selector + settings. */
export function useViews() {
  return useQuery({
    queryKey: queryKeys.config.views(),
    queryFn: () => repos().config.getViews(),
  });
}

/** Drift detectors (Fleet_Drift_Detector__mdt). */
export function useDetectors() {
  return useQuery({
    queryKey: queryKeys.config.detectors(),
    queryFn: () => repos().config.getDetectors(),
  });
}

/** Severity policy (Fleet_Severity_Policy__mdt) - the autonomy dial. */
export function useSeverityPolicies() {
  return useQuery({
    queryKey: queryKeys.config.severityPolicies(),
    queryFn: () => repos().config.getSeverityPolicies(),
  });
}

/** Assertion types (Fleet_Assertion_Type__mdt). */
export function useAssertionTypes() {
  return useQuery({
    queryKey: queryKeys.config.assertionTypes(),
    queryFn: () => repos().config.getAssertionTypes(),
  });
}

/** Change sources (Fleet_Change_Source__mdt). */
export function useChangeSources() {
  return useQuery({
    queryKey: queryKeys.config.changeSources(),
    queryFn: () => repos().config.getChangeSources(),
  });
}
