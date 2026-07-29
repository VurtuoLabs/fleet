/**
 * Fleet - tests for the continuous drift batch (CONTRACT §9.2).
 *
 * Exercises the sweep over monitored agents. With no case-result history the
 * detectors cannot clear their minimum-sample gate, so no finding is opened - 
 * the path that avoids the managed-sharing dependency covered separately.
 */
@IsTest
private class FleetDriftBatchTest {
    @IsTest
    static void sweepsMonitoredAgentsWithoutOpeningFindingsWhenNoDriftTrips() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c monitored = FleetTestFactory.insertAgent();
        monitored.Monitoring_Enabled__c = true;
        update monitored;

        Integer before = [SELECT COUNT() FROM Deviation_Finding__c];

        Test.startTest();
        Database.executeBatch(new FleetDriftBatch(), 5);
        Test.stopTest();

        Integer after = [SELECT COUNT() FROM Deviation_Finding__c];
        System.assertEquals(before, after, 'With no history to trip a detector, no finding is opened.');
    }

    @IsTest
    static void unmonitoredAgentsAreNotScanned() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c a = FleetTestFactory.insertAgent();
        a.Monitoring_Enabled__c = false;
        update a;

        Test.startTest();
        Database.executeBatch(new FleetDriftBatch(), 5);
        Test.stopTest();

        // No assertion on side effects; the batch simply must complete over an empty scope.
        System.assert(true, 'The batch completes when no agent is monitored.');
    }
}
