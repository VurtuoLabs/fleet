/**
 * Fleet - tests for nightly retention (CONTRACT §9.2, §4).
 *
 * CreatedDate is not writable, so the test forces the cutoff into the future by
 * priming a negative Case_Result__c retention window; every fresh row then falls
 * past the cutoff and is purged, exercising start/execute/finish.
 */
@IsTest
private class FleetRetentionBatchTest {
    @IsTest
    static void purgesCaseResultsPastTheRetentionWindow() {
        Fleet_Setting__mdt setting = FleetTestFactory.buildSetting();
        setting.Retention_Days_Case_Result__c = -1; // cutoff = now + 1 day → matches all fresh rows
        FleetConfigurationService.primeSetting(setting);

        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Golden_Case__c gc = FleetTestFactory.insertGoldenCase(agent.Id);
        Calibration_Run__c run = FleetTestFactory.insertRun(agent.Id);
        FleetTestFactory.insertCaseResult(run.Id, gc.Id);
        FleetTestFactory.insertCaseResult(run.Id, gc.Id);

        Test.startTest();
        Database.executeBatch(new FleetRetentionBatch(), 200);
        Test.stopTest();

        Integer remaining = [SELECT COUNT() FROM Case_Result__c WHERE Calibration_Run__c = :run.Id];
        System.assertEquals(0, remaining, 'Case results past the retention window are purged.');
    }

    @IsTest
    static void keepsCaseResultsInsideTheRetentionWindow() {
        Fleet_Setting__mdt setting = FleetTestFactory.buildSetting(); // 90-day window
        FleetConfigurationService.primeSetting(setting);

        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Golden_Case__c gc = FleetTestFactory.insertGoldenCase(agent.Id);
        Calibration_Run__c run = FleetTestFactory.insertRun(agent.Id);
        FleetTestFactory.insertCaseResult(run.Id, gc.Id);

        Test.startTest();
        Database.executeBatch(new FleetRetentionBatch(), 200);
        Test.stopTest();

        Integer remaining = [SELECT COUNT() FROM Case_Result__c WHERE Calibration_Run__c = :run.Id];
        System.assertEquals(1, remaining, 'A fresh case result inside the window is retained.');
    }
}
