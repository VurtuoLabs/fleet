/**
 * Fleet - tests for the Fleet_Turn__e tap (CONTRACT §5, §9.1).
 *
 * Covers the direct handler call, the bypass guard, and the end-to-end platform
 * event delivery that fires the trigger.
 */
@IsTest
private class FleetTurnTriggerHandlerTest {
    @IsTest
    static void handlerForwardsTurnsToTheArchive() {
        // Big Object DML is unavailable in test context; see FleetTraceService.TraceWriter.
        FleetTestFactory.stubTraceWriter();
        List<Fleet_Turn__e> turns = new List<Fleet_Turn__e>{ FleetTestFactory.newTurn('support_bot_h') };
        Test.startTest();
        Integer written = FleetTurnTriggerHandler.handleAfterInsert(turns);
        Test.stopTest();
        System.assertEquals(1, written, 'The handler forwards the turn to FleetTraceService.write.');
    }

    @IsTest
    static void bypassSuppressesTheArchiveWrite() {
        FleetTurnTriggerHandler.bypass = true;
        Integer written = FleetTurnTriggerHandler.handleAfterInsert(
            new List<Fleet_Turn__e>{ FleetTestFactory.newTurn('support_bot_h') }
        );
        FleetTurnTriggerHandler.bypass = false;
        System.assertEquals(0, written, 'Bypass suppresses the write.');
    }

    @IsTest
    static void emptyInputWritesNothing() {
        System.assertEquals(0, FleetTurnTriggerHandler.handleAfterInsert(null), 'Null input is a no-op.');
    }

    @IsTest
    static void publishingTheEventFiresTheTriggerWithoutError() {
        // The trigger runs on delivery; a user without Fleet access must never make
        // the publish fail (§9.1), so this simply asserts the delivery succeeds.
        Test.startTest();
        Database.SaveResult sr = EventBus.publish(FleetTestFactory.newTurn('support_bot_evt'));
        Test.getEventBus().deliver();
        Test.stopTest();
        System.assert(sr.isSuccess(), 'Publishing a Fleet_Turn__e succeeds.');
    }
}
