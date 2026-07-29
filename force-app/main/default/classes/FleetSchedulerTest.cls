/**
 * Fleet - tests for the scheduled entry point (CONTRACT §9.2).
 */
@IsTest
private class FleetSchedulerTest {
    @IsTest
    static void executeDegradesGracefullyWithoutRunPermission() {
        // Run as an explicit Fleet_Viewer rather than the test-executing user: the
        // user running the suite normally holds Fleet_Administrator (the deploy
        // assigns it), which carries Fleet_Run_Calibration and would make this
        // assertion depend on ambient org state instead of the seat under test.
        User viewer = FleetTestFactory.insertStandardUser();
        System.runAs(new User(Id = UserInfo.getUserId())) {
            FleetTestFactory.assignPermissionSet(viewer.Id, 'Fleet_Viewer');
        }

        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        agent.Monitoring_Enabled__c = true;
        update agent;

        Test.startTest();
        // Fleet_Viewer can read the agent but lacks Fleet_Run_Calibration; the sweep
        // must swallow that per-agent and still fire drift, retention, and the poll.
        System.runAs(viewer) {
            FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
            new FleetScheduler().execute(null);
        }
        Test.stopTest();

        Integer runs = [SELECT COUNT() FROM Calibration_Run__c];
        System.assertEquals(0, runs, 'Without the run permission the sweep opens no runs but does not abort.');
    }

    @IsTest
    static void sweepOpensAScheduledRunPerMonitoredAgentWithPermission() {
        User admin = FleetTestFactory.insertAdminUser();
        System.runAs(new User(Id = UserInfo.getUserId())) {
            FleetTestFactory.grantCustomPermissions(admin.Id, new Set<String>{ 'Fleet_Run_Calibration' });
        }
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        agent.Monitoring_Enabled__c = true;
        update agent;

        // Keep the chain from actually running; we only assert the run header is opened.
        FleetCalibrationService.bypass = true;

        Test.startTest();
        System.runAs(admin) {
            FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
            new FleetScheduler().execute(null);
        }
        Test.stopTest();
        FleetCalibrationService.bypass = false;

        List<Calibration_Run__c> runs = [SELECT Id, Trigger_Source__c FROM Calibration_Run__c];
        System.assertEquals(1, runs.size(), 'One scheduled run per monitored agent.');
        System.assertEquals('Scheduled', runs[0].Trigger_Source__c, 'The sweep tags the run as Scheduled.');
    }

    @IsTest
    static void scheduleDefaultRegistersACronJob() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Test.startTest();
        Id jobId = FleetScheduler.scheduleDefault();
        Test.stopTest();
        System.assertNotEquals(null, jobId, 'scheduleDefault returns the scheduled job id.');
        Integer triggers = [SELECT COUNT() FROM CronTrigger WHERE Id = :jobId];
        System.assertEquals(1, triggers, 'A CronTrigger is registered.');
    }

    @IsTest
    static void scheduleDefaultThrowsWhenCronMissing() {
        Fleet_Setting__mdt setting = FleetTestFactory.buildSetting();
        setting.Default_Schedule_Cron__c = null;
        FleetConfigurationService.primeSetting(setting);
        Boolean threw = false;
        try {
            FleetScheduler.scheduleDefault();
        } catch (FleetException e) {
            threw = true;
        }
        System.assert(threw, 'A missing cron is a configuration error.');
    }
}
