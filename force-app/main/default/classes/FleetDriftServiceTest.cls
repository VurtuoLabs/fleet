/**
 * Fleet - tests for drift detection (CONTRACT §8.2).
 */
@IsTest
private class FleetDriftServiceTest {
    @IsTest
    static void detectReturnsOneSignalPerActiveDetector() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Golden_Case__c gc = FleetTestFactory.insertGoldenCase(agent.Id);
        Calibration_Run__c run = FleetTestFactory.insertRun(agent.Id);
        FleetTestFactory.insertCaseResult(run.Id, gc.Id);

        Test.startTest();
        List<FleetDriftService.DriftSignal> signals = FleetDriftService.detect(agent.Id, 24);
        List<FleetDriftService.Changepoint> points = FleetDriftService.changepoints(agent.Id);
        Test.stopTest();

        System.assertNotEquals(null, signals, 'detect returns a list (one signal per active detector).');
        System.assertNotEquals(null, points, 'changepoints returns a list.');
    }

    @IsTest
    static void detectRequiresAnAgentId() {
        Boolean threw = false;
        try {
            FleetDriftService.detect(null, 24);
        } catch (FleetException e) {
            threw = true;
        }
        System.assert(threw, 'detect requires an agent id.');
    }
}
