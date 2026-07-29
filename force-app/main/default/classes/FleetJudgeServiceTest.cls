/**
 * Fleet - tests for the scoring ladder (CONTRACT §8.2, §12).
 *
 * The mandatory prefilter band-boundary case: distance below the lower bound
 * passes without a judge call, above the upper bound fails without one, and only
 * the ambiguous middle would escalate. Asserted directly against the deterministic
 * embedding-distance stand-in so it holds without seeded semantic CMDT, plus a
 * deterministic score() round trip.
 */
@IsTest
private class FleetJudgeServiceTest {
    @IsTest
    static void embeddingDistanceRespectsTheBandBoundaries() {
        Fleet_Setting__mdt setting = FleetTestFactory.buildSetting();
        FleetConfigurationService.primeSetting(setting);
        Decimal lower = setting.Prefilter_Lower_Bound__c; // 0.15
        Decimal upper = setting.Prefilter_Upper_Bound__c; // 0.45

        Decimal identical = FleetJudgeService.embeddingDistance('reset your password', 'reset your password');
        System.assert(
            identical < lower,
            'Identical text sits below the lower bound and skips the judge. Was ' + identical
        );

        Decimal disjoint = FleetJudgeService.embeddingDistance('alpha beta', 'gamma delta');
        System.assert(
            disjoint > upper,
            'Disjoint text sits above the upper bound and skips the judge. Was ' + disjoint
        );

        // Two of three terms shared → cosine 2/3 → distance ~0.333, squarely in band.
        Decimal ambiguous = FleetJudgeService.embeddingDistance('alpha beta gamma', 'alpha beta delta');
        System.assert(
            ambiguous >= lower && ambiguous <= upper,
            'Partial overlap lands in the ambiguous band that costs a judge call. Was ' + ambiguous
        );
    }

    @IsTest
    static void deterministicRoutingAssertionPassesAndFailsWithoutJudging() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Golden_Case__c gc = FleetTestFactory.insertGoldenCase(agent.Id);
        Calibration_Run__c run = FleetTestFactory.insertRun(agent.Id);
        Case_Result__c cr = FleetTestFactory.newCaseResult(run.Id, gc.Id);
        cr.Topic_Selected__c = 'Password_Reset';

        Assertion__c pass = FleetTestFactory.newAssertion(gc.Id); // MUST_ROUTE_TO Equals Password_Reset
        FleetJudgeService.JudgeResult ok = FleetJudgeService.score(cr, new List<Assertion__c>{ pass });
        System.assertEquals(true, ok.passed, 'Routing to the expected topic passes.');
        System.assertEquals(false, ok.judged, 'A deterministic assertion never invokes the judge.');

        Assertion__c fail = FleetTestFactory.newAssertion(gc.Id);
        fail.Expected_Value__c = 'Billing';
        FleetJudgeService.JudgeResult bad = FleetJudgeService.score(cr, new List<Assertion__c>{ fail });
        System.assertEquals(false, bad.passed, 'Routing to the wrong topic fails.');
        System.assertNotEquals(null, bad.failedAssertions, 'A failure serializes the offending assertion.');
    }
}
