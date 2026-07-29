/**
 * Fleet - tests for the test data factory (CONTRACT §8.1, §12).
 *
 * Asserts the factory builds and persists every object with valid parents and
 * unique keys, so the rest of the suite can rely on it.
 */
@IsTest
private class FleetTestFactoryTest {
    @IsTest
    static void buildsAndInsertsEveryObjectGraph() {
        Test.startTest();
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Golden_Case__c gc = FleetTestFactory.insertGoldenCase(agent.Id);
        Assertion__c assertion = FleetTestFactory.insertAssertion(gc.Id);
        Calibration_Run__c run = FleetTestFactory.insertRun(agent.Id);
        Case_Result__c cr = FleetTestFactory.insertCaseResult(run.Id, gc.Id);
        Deviation_Finding__c finding = FleetTestFactory.insertFinding(agent.Id);
        Remediation__c rem = FleetTestFactory.insertRemediation(finding.Id);
        Change_Event__c change = FleetTestFactory.insertChangeEvent();
        Fleet_User_Preference__c pref = FleetTestFactory.insertPreference();
        Test.stopTest();

        System.assertNotEquals(null, agent.Id, 'Agent inserted.');
        System.assertEquals(agent.Id, gc.Fleet_Agent__c, 'Golden case is master-detailed to the agent.');
        System.assertEquals(gc.Id, assertion.Golden_Case__c, 'Assertion is master-detailed to the case.');
        System.assertEquals(run.Id, cr.Calibration_Run__c, 'Case result is master-detailed to the run.');
        System.assertEquals(finding.Id, rem.Deviation_Finding__c, 'Remediation is master-detailed to the finding.');
        System.assertNotEquals(null, change.Id, 'Change event inserted.');
        System.assertNotEquals(null, pref.Id, 'User preference inserted.');
    }

    @IsTest
    static void buildsPlatformEventAndBigObjectRowsAndSetting() {
        Fleet_Turn__e turn = FleetTestFactory.newTurn('support_bot_x');
        Fleet_Trace__b trace = FleetTestFactory.newTrace('support_bot_x');
        Fleet_Setting__mdt setting = FleetTestFactory.buildSetting();

        System.assertEquals('support_bot_x', turn.Agent_API_Name__c, 'Turn carries the agent api name.');
        System.assertEquals('support_bot_x', trace.Org_Agent_Key__c, 'Trace index part 1 is the agent key.');
        System.assertNotEquals(null, trace.Trace_Key__c, 'Trace has a uniqueness tiebreak key.');
        System.assertEquals(
            0.15,
            setting.Prefilter_Lower_Bound__c,
            'Setting carries the default prefilter lower bound.'
        );
        System.assertEquals(80, setting.Trueness_Threshold__c, 'Setting carries the default trueness threshold.');
    }

    @IsTest
    static void uniqueKeysDoNotCollide() {
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Golden_Case__c a = FleetTestFactory.insertGoldenCase(agent.Id);
        Golden_Case__c b = FleetTestFactory.insertGoldenCase(agent.Id);
        System.assertNotEquals(a.Case_Key__c, b.Case_Key__c, 'External ids must be unique per build.');
    }

    @IsTest
    static void grantCustomPermissionsDoesNotThrow() {
        User u;
        System.runAs(new User(Id = UserInfo.getUserId())) {
            u = FleetTestFactory.insertStandardUser();
            // Custom permissions may or may not be deployed in a bare org; the helper
            // must be safe either way (it grants what it finds).
            FleetTestFactory.grantCustomPermissions(u.Id, new Set<String>{ 'Fleet_View_Transcripts' });
        }
        System.assertNotEquals(null, u.Id, 'A standard user is created for permission-matrix tests.');
    }
}
