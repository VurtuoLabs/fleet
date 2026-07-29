/**
 * Fleet - tests for the finding facade (CONTRACT §8.2, §7.4).
 *
 * getFindings and close are self-contained; open is exercised with an owner queue
 * so it can grant managed sharing (the sharing reason and FleetSharingService are
 * required package-wide).
 */
@IsTest
private class FleetFindingServiceTest {
    @IsTest
    static void getFindingsFiltersByAgent() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        FleetTestFactory.insertFinding(agent.Id);

        FleetFindingService.FindingQuery q = new FleetFindingService.FindingQuery();
        q.agentId = agent.Id;
        System.assertEquals(1, FleetFindingService.getFindings(q).size(), 'The agent has one finding.');
    }

    @IsTest
    static void closeTransitionsToClosedWithReason() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Deviation_Finding__c f = FleetTestFactory.insertFinding(agent.Id);

        FleetFindingService.FindingView v = FleetFindingService.close(f.Id, 'False positive');
        System.assertEquals('Closed', v.state, 'close moves the finding to Closed.');
        System.assertEquals('False positive', v.closureReason, 'The closure reason is recorded.');
        System.assertNotEquals(null, v.closedAt, 'The closed timestamp is set.');
    }

    @IsTest
    static void openPersistsAFindingAndGrantsOwnerAccess() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Group ownerQueue;
        System.runAs(new User(Id = UserInfo.getUserId())) {
            ownerQueue = new Group(Name = 'Fleet Finding Owners 3', Type = 'Queue');
            insert ownerQueue;
        }
        Fleet_Agent__c agent = FleetTestFactory.newAgent();
        agent.Owner_Queue_Id__c = ownerQueue.Id;
        insert agent;

        FleetFindingService.FindingInput input = new FleetFindingService.FindingInput();
        input.agentId = agent.Id;
        input.severity = 'High';
        input.detector = 'SEMANTIC_DRIFT';
        input.headline = 'Semantic drift detected';
        input.detail = 'Responses have wandered from the blessed baseline.';
        input.casesFailing = 4;
        input.casesTotal = 12;

        Test.startTest();
        Deviation_Finding__c opened = FleetFindingService.open(input);
        Test.stopTest();

        System.assertNotEquals(null, opened.Id, 'open persists the finding.');
        Deviation_Finding__c reloaded = [SELECT State__c, Severity__c FROM Deviation_Finding__c WHERE Id = :opened.Id];
        System.assertEquals('Open', reloaded.State__c, 'A new finding opens in the Open state.');
        System.assertEquals('High', reloaded.Severity__c, 'Severity is carried through.');
    }

    // ---------------------------------------------------------- Agent action
    @IsTest
    static void loadFindingDescribesTheFindingAndItsAttributedChange() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Deviation_Finding__c finding = FleetTestFactory.insertFinding(agent.Id);

        FleetFindingService.LoadFindingRequest req = new FleetFindingService.LoadFindingRequest();
        req.finding_id = finding.Id;

        Test.startTest();
        List<FleetFindingService.LoadFindingResponse> out = FleetFindingService.loadFinding(
            new List<FleetFindingService.LoadFindingRequest>{ req }
        );
        Test.stopTest();

        String detail = out[0].finding_detail;
        System.assert(detail.contains('Severity'.left(3)) || detail.contains('High'), 'Severity is reported: ' + detail);
        System.assert(detail.contains('Cases failing:'), 'The failing-case count is reported: ' + detail);
        System.assert(
            detail.contains('Attributed change: none'),
            'An unattributed finding says so rather than omitting the line: ' + detail
        );
    }

    @IsTest
    static void loadFindingReturnsTheErrorRatherThanFaulting() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        FleetFindingService.LoadFindingRequest req = new FleetFindingService.LoadFindingRequest();
        req.finding_id = null;

        List<FleetFindingService.LoadFindingResponse> out = FleetFindingService.loadFinding(
            new List<FleetFindingService.LoadFindingRequest>{ req }
        );

        System.assert(
            out[0].finding_detail.startsWith('Could not load the finding:'),
            'A bad request is returned as text, not thrown: ' + out[0].finding_detail
        );
    }
}
