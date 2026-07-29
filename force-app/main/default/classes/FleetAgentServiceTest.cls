/**
 * Fleet - tests for the agent registry facade (CONTRACT §8.2, §7.3, §12).
 *
 * Includes the permission-matrix case: a user without Fleet_Quarantine_Agent
 * cannot quarantine, and a user granted it can.
 */
@IsTest
private class FleetAgentServiceTest {
    @IsTest
    static void getAgentsAppliesThresholdAndFlagsOutOfTrue() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting()); // threshold 80
        Fleet_Agent__c healthy = FleetTestFactory.newAgent('Healthy Bot');
        healthy.Trueness_Score__c = 95;
        Fleet_Agent__c drifting = FleetTestFactory.newAgent('Drifting Bot');
        drifting.Trueness_Score__c = 60;
        insert new List<Fleet_Agent__c>{ healthy, drifting };

        Map<Id, FleetAgentService.AgentView> byId = new Map<Id, FleetAgentService.AgentView>();
        for (FleetAgentService.AgentView v : FleetAgentService.getAgents(null)) {
            byId.put(v.id, v);
        }
        System.assertEquals(false, byId.get(healthy.Id).outOfTrue, 'A 95 trueness agent is in true.');
        System.assertEquals(
            true,
            byId.get(drifting.Id).outOfTrue,
            'A 60 trueness agent is out of true against an 80 threshold.'
        );
    }

    @IsTest
    static void setMonitoringTogglesTheFlag() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        FleetAgentService.AgentView v = FleetAgentService.setMonitoring(agent.Id, false);
        System.assertEquals(false, v.monitoringEnabled, 'Monitoring is turned off.');
    }

    @IsTest
    static void viewerWithoutQuarantinePermissionCannotQuarantine() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        User viewer = FleetTestFactory.insertStandardUser();

        Boolean threw = false;
        System.runAs(viewer) {
            try {
                FleetAgentService.quarantine(agent.Id, 'unauthorized attempt');
            } catch (FleetException e) {
                threw = true;
            }
        }
        System.assert(threw, 'A user lacking Fleet_Quarantine_Agent must not be able to quarantine (§7.3).');
    }

    @IsTest
    static void operatorWithPermissionCanQuarantineAndRelease() {
        User admin = FleetTestFactory.insertAdminUser();
        System.runAs(new User(Id = UserInfo.getUserId())) {
            FleetTestFactory.grantCustomPermissions(admin.Id, new Set<String>{ 'Fleet_Quarantine_Agent' });
        }
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();

        System.runAs(admin) {
            FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
            FleetAgentService.AgentView q = FleetAgentService.quarantine(agent.Id, 'drift');
            System.assertEquals('Quarantined', q.status, 'A permitted user can quarantine.');
            System.assertEquals(false, q.monitoringEnabled, 'Quarantine pauses monitoring.');
            System.assertNotEquals(null, q.quarantinedAt, 'Quarantine stamps the time.');

            FleetAgentService.AgentView r = FleetAgentService.release(agent.Id);
            System.assertEquals('Active', r.status, 'The same permission releases the agent.');
        }
    }
}
