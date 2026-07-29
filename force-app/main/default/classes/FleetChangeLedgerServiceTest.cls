/**
 * Fleet - tests for the change ledger (CONTRACT §8.2, §9.1).
 */
@IsTest
private class FleetChangeLedgerServiceTest {
    @IsTest
    static void ingestUpsertsAndDeduplicatesOnChangeKey() {
        FleetChangeLedgerService.ChangeInput a = new FleetChangeLedgerService.ChangeInput();
        a.changeKey = 'CHG-DEDUP-1';
        a.source = 'PROMPT';
        a.kind = 'Prompt_Edit';
        a.label = 'First';
        a.occurredAt = Datetime.now();

        FleetChangeLedgerService.ChangeInput b = new FleetChangeLedgerService.ChangeInput();
        b.changeKey = 'CHG-DEDUP-1'; // same key → last write wins, one row
        b.source = 'PROMPT';
        b.kind = 'Prompt_Edit';
        b.label = 'Second';
        b.occurredAt = Datetime.now();

        Test.startTest();
        Integer first = FleetChangeLedgerService.ingest(new List<FleetChangeLedgerService.ChangeInput>{ a, b });
        Integer second = FleetChangeLedgerService.ingest(new List<FleetChangeLedgerService.ChangeInput>{ a });
        Test.stopTest();

        System.assertEquals(1, first, 'The two inputs share a key and collapse to one upsert.');
        System.assertEquals(1, second, 'Re-ingesting the same key updates rather than duplicates.');
        Integer rows = [SELECT COUNT() FROM Change_Event__c WHERE Change_Key__c = 'CHG-DEDUP-1'];
        System.assertEquals(1, rows, 'Only one change event exists for the key.');
    }

    @IsTest
    static void ingestOfEmptyIsZero() {
        System.assertEquals(0, FleetChangeLedgerService.ingest(null), 'Null input ingests nothing.');
        System.assertEquals(
            0,
            FleetChangeLedgerService.ingest(new List<FleetChangeLedgerService.ChangeInput>()),
            'Empty input ingests nothing.'
        );
    }

    @IsTest
    static void pollSetupAuditTrailRunsInSystemModeWithoutError() {
        // With no SetupAuditTrail-strategy source configured (or no recent audit
        // rows) the poll simply returns 0; the point is it does not throw.
        Test.startTest();
        Integer folded = FleetChangeLedgerService.pollSetupAuditTrail();
        Test.stopTest();
        System.assert(folded >= 0, 'The audit-trail poll returns a non-negative count.');
    }
}
