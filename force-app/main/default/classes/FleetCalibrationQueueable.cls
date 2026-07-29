/**
 * Fleet - the calibration chain (CONTRACT §8.3).
 *
 * One case per Queueable job, chained rather than fanned out:
 *   - predictable credit burn (the customer pays per action),
 *   - stays inside concurrent-Apex limits with a large golden set,
 *   - each link writes its Case_Result__c BEFORE enqueuing the next, so a
 *     mid-run failure leaves a partial result you can read rather than nothing.
 *
 * The chain carries the run id, the run key, and a cursor into the ordered active
 * golden set. Each link scores case[cursor], persists its Case_Result__c, rolls
 * the tally onto the run, then enqueues cursor+1. The terminal link (cursor past
 * the end) computes the run rollup, updates the agent's trueness, then calls
 * drift -> attribution -> opens findings.
 *
 * Guarded by FleetCalibrationService.bypass for test isolation. The scoring and
 * the terminal drift step reach the §8.2 sibling facades through injectable seams
 * so this class can be unit-tested without exercising the judge or the detectors.
 */
public with sharing class FleetCalibrationQueueable implements Queueable {
    private final Id runId;
    private final String runKey;
    private final Integer cursor;

    /**
     * @param runId the Calibration_Run__c header this chain writes into
     * @param runKey the run's external key, carried for trace correlation
     * @param cursor index into the ordered active golden set for this link
     */
    public FleetCalibrationQueueable(Id runId, String runKey, Integer cursor) {
        this.runId = runId;
        this.runKey = runKey;
        this.cursor = (cursor == null || cursor < 0) ? 0 : cursor;
    }

    // ----------------------------------------------------------------- Seams
    /** Scores one captured case result against its assertions. */
    public interface Scorer {
        ScoreOutcome score(Case_Result__c result, List<Assertion__c> assertions);
    }

    /** Result of scoring a single case; mirrors the fields read off JudgeResult. */
    public class ScoreOutcome {
        public Boolean passed;
        public Decimal deviationScore;
        public Boolean judged;

        public ScoreOutcome(Boolean passed, Decimal deviationScore, Boolean judged) {
            this.passed = passed;
            this.deviationScore = deviationScore;
            this.judged = judged;
        }
    }

    /** The terminal drift -> attribution -> findings step of the chain. */
    public interface FinalStep {
        void run(Id agentId, Id runId, Integer windowHours);
    }

    @TestVisible
    private static Scorer scorer = new JudgeScorer();
    @TestVisible
    private static FinalStep finalStep = new DriftFinalStep();
    /** Findings opened by the last terminal step; asserted by tests. */
    @TestVisible
    private static Integer lastFindingsOpened = 0;

    // ---------------------------------------------------------------- Execute
    public void execute(QueueableContext ctx) {
        // Test-isolation guard (§8.3); the sibling facade owns the flag.
        if (FleetCalibrationService.bypass) {
            return;
        }
        Calibration_Run__c run = loadRun();
        List<Id> caseIds = loadCaseIds(run.Fleet_Agent__c);

        if (caseIds.isEmpty() || cursor >= caseIds.size()) {
            finalize(run);
            return;
        }

        if (run.Status__c == 'Queued') {
            run.Status__c = 'Running';
            update as user run;
        }

        try {
            scoreAndPersist(run, caseIds[cursor]);
        } catch (Exception e) {
            // Earlier links' Case_Result__c rows are already committed; record why
            // the chain stopped and leave the partial run readable (§8.3).
            markPartial(run, e.getMessage());
            return;
        }

        // Chain forward. The link that lands past the end runs finalize().
        if (!Test.isRunningTest()) {
            System.enqueueJob(new FleetCalibrationQueueable(runId, runKey, cursor + 1));
        }
    }

    // --------------------------------------------------------------- Internals
    private void scoreAndPersist(Calibration_Run__c run, Id caseId) {
        Golden_Case__c gc = loadCase(caseId);
        List<Assertion__c> assertions = loadAssertions(caseId);

        // The captured turn. In production the Fleet_Engine planner invokes the
        // target agent and the tap streams the turn; the row the scorer grades is
        // materialized and persisted before anything that can fail.
        Case_Result__c result = new Case_Result__c(
            Calibration_Run__c = runId,
            Golden_Case__c = caseId,
            Trace_Key__c = gc.Case_Key__c
        );

        ScoreOutcome outcome = scorer.score(result, assertions);
        // Mirror the verdict so the persisted record is consistent regardless of
        // whether the real judge or an injected scorer produced it.
        result.Passed__c = outcome.passed;
        result.Deviation_Score__c = outcome.deviationScore;
        result.Judged__c = outcome.judged;
        result.Credits__c = (outcome.judged == true) ? 3 : 1;
        insert as user result;

        // Roll the per-case outcome into the run tallies as we go.
        run.Cases_Total__c = nz(run.Cases_Total__c) + 1;
        if (outcome.passed == true) {
            run.Cases_Passed__c = nz(run.Cases_Passed__c) + 1;
        } else {
            run.Cases_Failed__c = nz(run.Cases_Failed__c) + 1;
        }
        if (outcome.judged == true) {
            run.Judge_Invocations__c = nz(run.Judge_Invocations__c) + 1;
        } else {
            run.Prefilter_Skips__c = nz(run.Prefilter_Skips__c) + 1;
        }
        run.Credits_Consumed__c = nz(run.Credits_Consumed__c) + nz(result.Credits__c);
        update as user run;

        // Keep the golden case's last-result marker in step with the console.
        gc.Last_Result__c = (outcome.passed == true) ? 'Pass' : 'Fail';
        gc.Consecutive_Failures__c = (outcome.passed == true) ? 0 : nz(gc.Consecutive_Failures__c) + 1;
        update as user gc;
    }

    private void finalize(Calibration_Run__c run) {
        Decimal total = nz(run.Cases_Total__c);
        Decimal passed = nz(run.Cases_Passed__c);
        Decimal trueness = (total == 0) ? 100 : (passed / total * 100).setScale(2);

        run.Trueness_Score__c = trueness;
        run.Status__c = 'Completed';
        run.Completed_At__c = Datetime.now();
        update as user run;

        // Roll trueness up onto the agent and reset the failure streak per outcome.
        Fleet_Agent__c agent = loadAgent(run.Fleet_Agent__c);
        agent.Trueness_Score__c = trueness;
        agent.Last_Calibrated_At__c = Datetime.now();
        Decimal threshold = FleetConfigurationService.getSetting().Trueness_Threshold__c;
        if (threshold != null && trueness < threshold) {
            agent.Consecutive_Failures__c = nz(agent.Consecutive_Failures__c) + 1;
            if (agent.Status__c != 'Quarantined') {
                agent.Status__c = 'Out_Of_True';
            }
        } else {
            agent.Consecutive_Failures__c = 0;
            if (agent.Status__c != 'Quarantined') {
                agent.Status__c = 'Healthy';
            }
        }
        update as user agent;

        // Drift -> attribution -> open findings. Widest detector window bounds it.
        Integer windowHours = 24;
        for (Fleet_Drift_Detector__mdt d : FleetConfigurationService.getDetectors()) {
            if (d.Window_Hours__c != null && d.Window_Hours__c > windowHours) {
                windowHours = Integer.valueOf(d.Window_Hours__c);
            }
        }
        finalStep.run(run.Fleet_Agent__c, runId, windowHours);
    }

    private void markPartial(Calibration_Run__c run, String message) {
        run.Status__c = 'Partial';
        run.Error__c = (message == null) ? 'Calibration link failed.' : message.abbreviate(255);
        run.Completed_At__c = Datetime.now();
        update as user run;
    }

    private static Decimal nz(Decimal v) {
        return v == null ? 0 : v;
    }

    private Calibration_Run__c loadRun() {
        return [
            SELECT
                Id,
                Fleet_Agent__c,
                Status__c,
                Cases_Total__c,
                Cases_Passed__c,
                Cases_Failed__c,
                Judge_Invocations__c,
                Prefilter_Skips__c,
                Credits_Consumed__c,
                Trueness_Score__c
            FROM Calibration_Run__c
            WHERE Id = :runId
            WITH USER_MODE
            LIMIT 1
        ];
    }

    /** Ordered active golden cases for the agent, capped at Max_Cases_Per_Run__c. */
    private List<Id> loadCaseIds(Id agentId) {
        Decimal maxCases = FleetConfigurationService.getSetting().Max_Cases_Per_Run__c;
        Integer cap = (maxCases == null || maxCases <= 0) ? 200 : Integer.valueOf(maxCases);
        List<Id> ids = new List<Id>();
        for (Golden_Case__c gc : [
            SELECT Id
            FROM Golden_Case__c
            WHERE Fleet_Agent__c = :agentId AND Active__c = TRUE
            WITH USER_MODE
            ORDER BY Weight__c DESC NULLS LAST, Case_Key__c ASC
            LIMIT :cap
        ]) {
            ids.add(gc.Id);
        }
        return ids;
    }

    private Golden_Case__c loadCase(Id caseId) {
        return [
            SELECT Id, Case_Key__c, Last_Result__c, Consecutive_Failures__c
            FROM Golden_Case__c
            WHERE Id = :caseId
            WITH USER_MODE
            LIMIT 1
        ];
    }

    private List<Assertion__c> loadAssertions(Id caseId) {
        return [
            SELECT Id, Assertion_Type__c, Expected_Value__c, Comparator__c, Tolerance__c, Severity_On_Fail__c, Active__c
            FROM Assertion__c
            WHERE Golden_Case__c = :caseId AND Active__c = TRUE
            WITH USER_MODE
        ];
    }

    private Fleet_Agent__c loadAgent(Id agentId) {
        return [
            SELECT Id, Status__c, Trueness_Score__c, Consecutive_Failures__c, Last_Calibrated_At__c
            FROM Fleet_Agent__c
            WHERE Id = :agentId
            WITH USER_MODE
            LIMIT 1
        ];
    }

    // -------------------------------------------------- Production seam defaults
    /** Delegates scoring to the §8.2 judge facade, which also mutates the result. */
    private class JudgeScorer implements Scorer {
        public ScoreOutcome score(Case_Result__c result, List<Assertion__c> assertions) {
            FleetJudgeService.JudgeResult jr = FleetJudgeService.score(result, assertions);
            return new ScoreOutcome(jr.passed, jr.deviationScore, jr.judged);
        }
    }

    /** Runs drift detection, attributes each changepoint, and opens findings (§8.2). */
    private class DriftFinalStep implements FinalStep {
        public void run(Id agentId, Id runId, Integer windowHours) {
            Integer opened = 0;
            FleetDriftService.DriftSignal worst;
            for (FleetDriftService.DriftSignal s : FleetDriftService.detect(agentId, windowHours)) {
                if (s.tripped == true && (worst == null || nz(s.observedValue) > nz(worst.observedValue))) {
                    worst = s;
                }
            }
            if (worst == null) {
                lastFindingsOpened = 0;
                return;
            }

            String severity = severityFor(worst);
            Integer casesTotal = [
                SELECT COUNT()
                FROM Case_Result__c
                WHERE Calibration_Run__c = :runId
                WITH USER_MODE
            ];
            Integer casesFailing = [
                SELECT COUNT()
                FROM Case_Result__c
                WHERE Calibration_Run__c = :runId AND Passed__c = FALSE
                WITH USER_MODE
            ];

            for (FleetDriftService.Changepoint cp : FleetDriftService.changepoints(agentId)) {
                FleetAttributionService.AttributionResult attribution = FleetAttributionService.attribute(cp);
                FleetFindingService.FindingInput input = new FleetFindingService.FindingInput();
                input.agentId = agentId;
                input.severity = severity;
                input.detector = worst.detectorKey;
                input.headline = (worst.label == null ? worst.detectorKey : worst.label) + ' drift detected';
                input.detail = worst.detail;
                input.casesFailing = casesFailing;
                input.casesTotal = casesTotal;
                if (attribution != null && attribution.attributed == true) {
                    input.attributedChangeId = attribution.attributedChangeId;
                    input.attributionConfidence = attribution.confidence;
                }
                FleetFindingService.open(input);
                opened++;
            }
            lastFindingsOpened = opened;
        }

        private String severityFor(FleetDriftService.DriftSignal s) {
            if (s.threshold == null || s.threshold <= 0 || s.observedValue == null) {
                return 'High';
            }
            Decimal ratio = s.observedValue / s.threshold;
            if (ratio >= 2) {
                return 'Critical';
            }
            if (ratio >= 1.5) {
                return 'High';
            }
            return 'Medium';
        }
    }
}
