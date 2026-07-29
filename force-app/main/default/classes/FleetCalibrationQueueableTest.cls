/**
 * Fleet - tests for the calibration chain (CONTRACT §8.3, §12).
 *
 * Covers the mandatory cases: the full chain walking one case per link, the
 * mid-chain failure that must leave a readable partial result, and the bypass
 * guard. Scoring and the terminal drift step are injected through the class's
 * seams so these tests exercise the chain's own orchestration without depending
 * on the judge or the detector implementations.
 */
@IsTest
private class FleetCalibrationQueueableTest {
    // ---- injected doubles -------------------------------------------------
    private static Integer finalStepCalls = 0;
    private static Id finalStepAgentId;

    private class PassingScorer implements FleetCalibrationQueueable.Scorer {
        public FleetCalibrationQueueable.ScoreOutcome score(Case_Result__c r, List<Assertion__c> a) {
            return new FleetCalibrationQueueable.ScoreOutcome(true, 0.02, false);
        }
    }

    private class FailingSecondScorer implements FleetCalibrationQueueable.Scorer {
        private Integer calls = 0;
        public FleetCalibrationQueueable.ScoreOutcome score(Case_Result__c r, List<Assertion__c> a) {
            calls++;
            if (calls == 2) {
                throw new FleetException('Synthetic judge failure on the second case.');
            }
            return new FleetCalibrationQueueable.ScoreOutcome(true, 0.02, false);
        }
    }

    private class RecordingFinalStep implements FleetCalibrationQueueable.FinalStep {
        public void run(Id agentId, Id runId, Integer windowHours) {
            finalStepCalls++;
            finalStepAgentId = agentId;
        }
    }

    // ---- helpers ----------------------------------------------------------
    private static Calibration_Run__c setUpRun(Integer caseCount) {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        for (Integer i = 0; i < caseCount; i++) {
            FleetTestFactory.insertGoldenCase(agent.Id);
        }
        return FleetTestFactory.insertRun(agent.Id);
    }

    private static void drive(Id runId, String runKey, Integer links) {
        // The chain enqueues in production; in a test we drive each cursor by hand,
        // including the terminal link past the end that runs finalize().
        for (Integer c = 0; c <= links; c++) {
            new FleetCalibrationQueueable(runId, runKey, c).execute(null);
        }
    }

    @IsTest
    static void fullChainScoresEveryCaseAndFinalizes() {
        Calibration_Run__c run = setUpRun(3);
        FleetCalibrationQueueable.scorer = new PassingScorer();
        FleetCalibrationQueueable.finalStep = new RecordingFinalStep();
        finalStepCalls = 0;

        Test.startTest();
        drive(run.Id, run.Run_Key__c, 3);
        Test.stopTest();

        Integer results = [SELECT COUNT() FROM Case_Result__c WHERE Calibration_Run__c = :run.Id];
        System.assertEquals(3, results, 'One Case_Result__c per golden case should be written.');

        Calibration_Run__c after = [
            SELECT Status__c, Cases_Total__c, Cases_Passed__c, Cases_Failed__c, Trueness_Score__c
            FROM Calibration_Run__c
            WHERE Id = :run.Id
        ];
        System.assertEquals('Completed', after.Status__c, 'The terminal link should complete the run.');
        System.assertEquals(3, after.Cases_Total__c, 'All three cases counted.');
        System.assertEquals(3, after.Cases_Passed__c, 'All passed.');
        System.assertEquals(100, after.Trueness_Score__c, 'Trueness is 100 when every case passes.');

        Fleet_Agent__c agent = [
            SELECT Trueness_Score__c, Status__c, Last_Calibrated_At__c
            FROM Fleet_Agent__c
            WHERE Id = :run.Fleet_Agent__c
        ];
        System.assertEquals(100, agent.Trueness_Score__c, 'Trueness rolls up onto the agent.');
        System.assertEquals('Healthy', agent.Status__c, 'A perfect run leaves the agent healthy.');
        System.assertNotEquals(null, agent.Last_Calibrated_At__c, 'Last calibrated stamp is set.');
        System.assertEquals(1, finalStepCalls, 'The terminal drift step runs exactly once.');
        System.assertEquals(run.Fleet_Agent__c, finalStepAgentId, 'Terminal step receives the agent id.');
    }

    @IsTest
    static void midChainFailureLeavesReadablePartialResult() {
        Calibration_Run__c run = setUpRun(3);
        FleetCalibrationQueueable.scorer = new FailingSecondScorer();
        FleetCalibrationQueueable.finalStep = new RecordingFinalStep();
        finalStepCalls = 0;

        Test.startTest();
        // Cursor 0 succeeds and commits its result; cursor 1 throws inside scoring.
        new FleetCalibrationQueueable(run.Id, run.Run_Key__c, 0).execute(null);
        new FleetCalibrationQueueable(run.Id, run.Run_Key__c, 1).execute(null);
        Test.stopTest();

        Integer results = [SELECT COUNT() FROM Case_Result__c WHERE Calibration_Run__c = :run.Id];
        System.assertEquals(1, results, 'The first case result survives the mid-chain failure.');

        Calibration_Run__c after = [SELECT Status__c, Error__c FROM Calibration_Run__c WHERE Id = :run.Id];
        System.assertEquals('Partial', after.Status__c, 'A failed link marks the run Partial, not Completed.');
        System.assertNotEquals(null, after.Error__c, 'The failure reason is recorded on the run.');
        System.assertEquals(0, finalStepCalls, 'The terminal step never runs after a failure.');
    }

    @IsTest
    static void bypassGuardShortCircuitsTheChain() {
        Calibration_Run__c run = setUpRun(2);
        FleetCalibrationQueueable.scorer = new PassingScorer();
        FleetCalibrationService.bypass = true;

        Test.startTest();
        new FleetCalibrationQueueable(run.Id, run.Run_Key__c, 0).execute(null);
        Test.stopTest();
        FleetCalibrationService.bypass = false;

        Integer results = [SELECT COUNT() FROM Case_Result__c WHERE Calibration_Run__c = :run.Id];
        System.assertEquals(0, results, 'Bypass must short-circuit before any work.');
    }

    @IsTest
    static void failingCaseDropsTruenessAndFlagsAgentOutOfTrue() {
        Calibration_Run__c run = setUpRun(2);
        FleetCalibrationQueueable.scorer = new AllFailScorer();
        FleetCalibrationQueueable.finalStep = new RecordingFinalStep();

        Test.startTest();
        drive(run.Id, run.Run_Key__c, 2);
        Test.stopTest();

        Calibration_Run__c after = [
            SELECT Status__c, Cases_Failed__c, Trueness_Score__c
            FROM Calibration_Run__c
            WHERE Id = :run.Id
        ];
        System.assertEquals(2, after.Cases_Failed__c, 'Both cases failed.');
        System.assertEquals(0, after.Trueness_Score__c, 'Trueness is 0 when every case fails.');

        Fleet_Agent__c agent = [
            SELECT Status__c, Consecutive_Failures__c
            FROM Fleet_Agent__c
            WHERE Id = :run.Fleet_Agent__c
        ];
        System.assertEquals('Out_Of_True', agent.Status__c, 'Sub-threshold trueness flags the agent Out_Of_True.');
        System.assert(agent.Consecutive_Failures__c >= 1, 'The failure streak increments.');
    }

    private class AllFailScorer implements FleetCalibrationQueueable.Scorer {
        public FleetCalibrationQueueable.ScoreOutcome score(Case_Result__c r, List<Assertion__c> a) {
            return new FleetCalibrationQueueable.ScoreOutcome(false, 0.9, true);
        }
    }
}
