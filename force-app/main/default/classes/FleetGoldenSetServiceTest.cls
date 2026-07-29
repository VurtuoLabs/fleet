/**
 * Fleet - tests for golden-set curation (CONTRACT §8.2, §7.3).
 *
 * Curation is gated on Fleet_Curate_Golden_Set; reads are open. Covers the
 * permission gate and a create round trip.
 */
@IsTest
private class FleetGoldenSetServiceTest {
    @IsTest
    static void getCasesReturnsCasesForAnAgent() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        FleetTestFactory.insertGoldenCase(agent.Id);
        System.assertEquals(1, FleetGoldenSetService.getCases(agent.Id).size(), 'The agent has one golden case.');
    }

    @IsTest
    static void curationRequiresPermission() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        User viewer = FleetTestFactory.insertStandardUser();

        FleetGoldenSetService.GoldenCaseInput input = new FleetGoldenSetService.GoldenCaseInput();
        input.agentId = agent.Id;
        input.utterance = 'How do I cancel?';
        input.active = true;
        input.source = 'Curated';

        Boolean threw = false;
        System.runAs(viewer) {
            try {
                FleetGoldenSetService.upsertCase(input);
            } catch (FleetException e) {
                threw = true;
            }
        }
        System.assert(threw, 'upsertCase is gated on Fleet_Curate_Golden_Set (§7.3).');
    }

    @IsTest
    static void permittedUserCreatesACase() {
        User admin = FleetTestFactory.insertAdminUser();
        System.runAs(new User(Id = UserInfo.getUserId())) {
            FleetTestFactory.grantCustomPermissions(admin.Id, new Set<String>{ 'Fleet_Curate_Golden_Set' });
        }
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();

        System.runAs(admin) {
            FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
            FleetGoldenSetService.GoldenCaseInput input = new FleetGoldenSetService.GoldenCaseInput();
            input.agentId = agent.Id;
            input.caseKey = 'GC-CREATE-1';
            input.utterance = 'How do I cancel my subscription?';
            input.active = true;
            input.source = 'Curated';
            input.weight = 2;
            FleetGoldenSetService.GoldenCaseView view = FleetGoldenSetService.upsertCase(input);
            System.assertNotEquals(null, view.id, 'A permitted user creates a golden case.');
            System.assertEquals('GC-CREATE-1', view.caseKey, 'The external key round-trips.');
        }
    }

    // ---------------------------------------------------------- Agent action
    // Fleet_Curator reaches this class through an @InvocableMethod (CONTRACT §10.2).
    // These cover the invocable wrapper itself, which is the surface the agent sees.

    @IsTest
    static void proposeFromTrafficReportsWhenThereIsNothingToPropose() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();

        FleetGoldenSetService.ProposeRequest req = new FleetGoldenSetService.ProposeRequest();
        req.target_agent_id = agent.Id;

        Test.startTest();
        List<FleetGoldenSetService.ProposeResponse> out = FleetGoldenSetService.proposeFromTraffic(
            new List<FleetGoldenSetService.ProposeRequest>{ req }
        );
        Test.stopTest();

        System.assertEquals(1, out.size(), 'One response per request.');
        // Big Object reads return nothing in test context, so there is no traffic
        // to promote and the agent must be told that in plain language.
        System.assert(
            out[0].proposed_summary.contains('No new production turns'),
            'With no traffic the action reports it proposed nothing: ' + out[0].proposed_summary
        );
    }

    @IsTest
    static void proposeFromTrafficReturnsTheErrorRatherThanFaulting() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        FleetGoldenSetService.ProposeRequest req = new FleetGoldenSetService.ProposeRequest();
        req.target_agent_id = null;

        List<FleetGoldenSetService.ProposeResponse> out = FleetGoldenSetService.proposeFromTraffic(
            new List<FleetGoldenSetService.ProposeRequest>{ req }
        );

        // An agent action must not throw mid-conversation; it reports the problem.
        System.assert(
            out[0].proposed_summary.startsWith('Could not propose cases:'),
            'A bad request is returned as text, not thrown: ' + out[0].proposed_summary
        );
    }
}
