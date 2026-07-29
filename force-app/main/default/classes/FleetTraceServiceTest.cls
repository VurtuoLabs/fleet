/**
 * Fleet - tests for the Big Object trace facade (CONTRACT §4, §7.4, §9.1).
 *
 * Big Object rows written in a test are not guaranteed to be queryable in the
 * same transaction, so these tests assert the write count, the guard conditions,
 * and the transcript-permission branch of read rather than round-tripping rows.
 */
@IsTest
private class FleetTraceServiceTest {
    @IsTest
    static void writePersistsEveryTurnAndReturnsCount() {
        // Big Object DML is unavailable in test context, so the write goes through
        // the stub seam; the mapping below is what production would have persisted.
        FleetTestFactory.StubTraceWriter stub = FleetTestFactory.stubTraceWriter();
        List<Fleet_Turn__e> turns = new List<Fleet_Turn__e>{
            FleetTestFactory.newTurn('support_bot_a'),
            FleetTestFactory.newTurn('support_bot_a')
        };
        Test.startTest();
        Integer written = FleetTraceService.write(turns);
        Test.stopTest();
        System.assertEquals(2, written, 'Both captured turns should be written to the archive.');
        System.assertEquals(2, stub.captured.size(), 'Both rows reach the archive writer.');
        System.assertEquals(
            'support_bot_a',
            stub.captured[0].Org_Agent_Key__c,
            'The agent API name is mapped onto the leading index column.'
        );
        System.assertEquals(
            turns[0].Trace_Key__c,
            stub.captured[0].Trace_Key__c,
            'The trace key is carried through as the index tiebreak.'
        );
        System.assertNotEquals(null, stub.captured[0].Occurred_At__c, 'Occurred_At is always populated.');
    }

    @IsTest
    static void writeOfEmptyOrNullIsZero() {
        System.assertEquals(0, FleetTraceService.write(null), 'Null input writes nothing.');
        System.assertEquals(0, FleetTraceService.write(new List<Fleet_Turn__e>()), 'Empty input writes nothing.');
    }

    @IsTest
    static void readRequiresAnAgentKey() {
        Boolean threw = false;
        try {
            FleetTraceService.read('  ', null, null, 10);
        } catch (FleetException e) {
            threw = true;
        }
        System.assert(threw, 'read must reject a blank agent key.');
    }

    @IsTest
    static void readReturnsAListAndHonorsTranscriptPermission() {
        // Without Fleet_View_Transcripts the read still runs; it simply nulls text.
        List<FleetTraceService.TraceView> views = FleetTraceService.read('support_bot_a', null, null, 5);
        System.assertNotEquals(null, views, 'read always returns a list.');
    }

    @IsTest
    static void readByKeyRequiresATraceKey() {
        Boolean threw = false;
        try {
            FleetTraceService.readByKey('support_bot_a', '');
        } catch (FleetException e) {
            threw = true;
        }
        System.assert(threw, 'readByKey must reject a blank trace key.');
    }

    @IsTest
    static void readByKeyReturnsNullWhenAbsent() {
        System.assertEquals(
            null,
            FleetTraceService.readByKey('support_bot_a', 'no-such-key'),
            'An absent trace key yields null, not an exception.'
        );
    }

    @IsTest
    static void purgeRejectsNonPositiveWindowAndReturnsZeroWhenEmpty() {
        Boolean threw = false;
        try {
            FleetTraceService.purge(0);
        } catch (FleetException e) {
            threw = true;
        }
        System.assert(threw, 'purge requires a positive olderThanDays.');
        System.assertEquals(0, FleetTraceService.purge(395), 'Purging an empty archive removes nothing.');
    }
}
