/**
 * Fleet - tests for the remediation lifecycle (CONTRACT §8.2, §7.3, §12).
 *
 * The mandatory idempotency case: a remediation that already carries a result
 * short-circuits on re-execution rather than firing its side effect twice. Also
 * covers the approval permission gate.
 */
@IsTest
private class FleetRemediationServiceTest {
    @IsTest
    static void executeIsIdempotentOnAlreadyRunRemediation() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Deviation_Finding__c finding = FleetTestFactory.insertFinding(agent.Id);
        Remediation__c rem = FleetTestFactory.newRemediation(finding.Id);
        rem.Approval_State__c = 'Approved';
        rem.Result__c = 'Success'; // simulate a prior successful execution
        insert rem;

        Test.startTest();
        FleetRemediationService.RemediationResult first = FleetRemediationService.execute(rem.Id);
        FleetRemediationService.RemediationResult second = FleetRemediationService.execute(rem.Id);
        Test.stopTest();

        System.assertEquals(true, first.alreadyExecuted, 'A remediation with a prior result does not run again.');
        System.assertEquals('Success', first.result, 'The prior outcome is returned verbatim.');
        System.assertEquals(true, second.alreadyExecuted, 'Re-execution stays idempotent on the idempotency key.');
    }

    @IsTest
    static void executeRefusesUnapprovedRemediation() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Deviation_Finding__c finding = FleetTestFactory.insertFinding(agent.Id);
        Remediation__c rem = FleetTestFactory.newRemediation(finding.Id); // Pending, no result
        insert rem;

        Boolean threw = false;
        try {
            FleetRemediationService.execute(rem.Id);
        } catch (FleetException e) {
            threw = true;
        }
        System.assert(threw, 'An unapproved remediation cannot execute.');
    }

    @IsTest
    static void approveRequiresApprovalPermission() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Deviation_Finding__c finding = FleetTestFactory.insertFinding(agent.Id);
        Remediation__c rem = FleetTestFactory.insertRemediation(finding.Id);
        User viewer = FleetTestFactory.insertStandardUser();

        Boolean threw = false;
        System.runAs(viewer) {
            try {
                FleetRemediationService.approve(rem.Id);
            } catch (FleetException e) {
                threw = true;
            }
        }
        System.assert(threw, 'Approval is gated on Fleet_Approve_Remediation (§7.3).');
    }

    @IsTest
    static void proposeCreatesARemediationFromSeverityPolicy() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Deviation_Finding__c finding = FleetTestFactory.insertFinding(agent.Id);

        Remediation__c rem = FleetRemediationService.propose(finding.Id);
        System.assertNotEquals(null, rem.Id, 'propose persists a remediation.');
        System.assertNotEquals(null, rem.Action__c, 'The action is resolved from the severity policy.');
    }
}
