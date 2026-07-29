/**
 * Barrel for the Fleet TanStack Query hooks. Feature pages import exclusively
 * from "@/hooks", so the data seam has a single entry point that tests can mock.
 */
export { queryKeys } from "./queryKeys";

export {
  useAgents,
  useAgent,
  useSetMonitoring,
  useQuarantineAgent,
  useReleaseAgent,
} from "./useAgents";

export {
  useAgentRuns,
  useRun,
  useRunCalibration,
  useBlessBaseline,
} from "./useCalibration";

export {
  useGoldenCases,
  useCaseDiff,
  useUpsertCase,
  useApproveProposed,
  useDeactivateCase,
} from "./useGoldenSet";

export {
  useFindings,
  useFinding,
  useOpenFinding,
  useCloseFinding,
  useProposeRemediation,
  useApproveRemediation,
  useRejectRemediation,
  useExecuteRemediation,
} from "./useFindings";

export {
  useDriftBoard,
  useChangeEvents,
  useChange,
  useAttribution,
} from "./useAttribution";

export {
  useSetting,
  useViews,
  useDetectors,
  useSeverityPolicies,
  useAssertionTypes,
  useChangeSources,
} from "./useConfig";
