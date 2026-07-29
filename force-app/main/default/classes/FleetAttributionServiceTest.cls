/**
 * Fleet - tests for change attribution (CONTRACT §8.2).
 */
@IsTest
private class FleetAttributionServiceTest {
    @IsTest
    static void attributeCorrelatesAPrecedingChangeInsideItsWindow() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();

        Datetime shiftAt = Datetime.now();
        Change_Event__c change = FleetTestFactory.newChangeEvent();
        change.Occurred_At__c = shiftAt.addMinutes(-10); // precedes the shift, inside the 120-min window
        change.Correlation_Window_Minutes__c = 120;
        insert change;

        FleetDriftService.Changepoint cp = new FleetDriftService.Changepoint();
        cp.agentId = agent.Id;
        cp.occurredAt = shiftAt;
        cp.magnitude = 12;
        cp.direction = 'Regression';

        Test.startTest();
        FleetAttributionService.AttributionResult result = FleetAttributionService.attribute(cp);
        Test.stopTest();

        System.assertEquals(true, result.attributed, 'A change 10 minutes before the shift is attributable.');
        System.assertEquals(change.Id, result.attributedChangeId, 'The nearest preceding change is the cause.');
        System.assert(result.confidence > 0, 'A correlated cause has non-zero confidence.');
    }

    @IsTest
    static void attributeRejectsANullChangepoint() {
        Boolean threw = false;
        try {
            FleetAttributionService.attribute(null);
        } catch (FleetException e) {
            threw = true;
        }
        System.assert(threw, 'attribute requires a changepoint with a timestamp.');
    }

    @IsTest
    static void attributeReturnsUnattributedWhenNothingIsInWindow() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        FleetDriftService.Changepoint cp = new FleetDriftService.Changepoint();
        cp.agentId = agent.Id;
        cp.occurredAt = Datetime.now();
        cp.magnitude = 8;
        cp.direction = 'Regression';

        FleetAttributionService.AttributionResult result = FleetAttributionService.attribute(cp);
        System.assertEquals(false, result.attributed, 'With no change in any window the shift is unattributed.');
        System.assertEquals(0, result.confidence, 'Unattributed means zero confidence.');
    }
}
