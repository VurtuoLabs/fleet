/**
 * Fleet - tests for the calibration facade (CONTRACT §8.2, §7.3, §12).
 *
 * The mandatory permission-matrix case lives here: a viewer (no
 * Fleet_Bless_Baseline) cannot bless a baseline, and an approver granted it can.
 * Also covers run() enqueue gating and read models.
 */
@IsTest
private class FleetCalibrationServiceTest {
    @IsTest
    static void viewerCannotBlessBaseline() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        Calibration_Run__c run = FleetTestFactory.insertRun(agent.Id);
        run.Status__c = 'Completed';
        update run;
        User viewer = FleetTestFactory.insertStandardUser();

        Boolean threw = false;
        System.runAs(viewer) {
            try {
                FleetCalibrationService.bless(run.Id);
            } catch (FleetException e) {
                threw = true;
            }
        }
        System.assert(threw, 'A viewer without Fleet_Bless_Baseline cannot bless a baseline (§7.3).');
    }

    @IsTest
    static void approverWithPermissionBlessesAndSnapshotsBaseline() {
        User admin = FleetTestFactory.insertAdminUser();
        System.runAs(new User(Id = UserInfo.getUserId())) {
            FleetTestFactory.grantCustomPermissions(admin.Id, new Set<String>{ 'Fleet_Bless_Baseline' });
        }
        Fleet_Agent__c agent = FleetTestFactory.insertAgent(); // Current_Version v3, Blessed v2
        Golden_Case__c gc = FleetTestFactory.insertGoldenCase(agent.Id);
        Calibration_Run__c run = FleetTestFactory.insertRun(agent.Id);
        run.Status__c = 'Completed';
        update run;

        System.runAs(admin) {
            FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
            Fleet_Agent__c blessed = FleetCalibrationService.bless(run.Id);
            System.assertEquals('v3', blessed.Blessed_Version__c, 'Blessing promotes the current version to blessed.');
        }

        Golden_Case__c after = [
            SELECT Baseline_Version__c, Baseline_Centroid_Ref__c
            FROM Golden_Case__c
            WHERE Id = :gc.Id
        ];
        System.assertEquals('v3', after.Baseline_Version__c, 'Active cases snapshot the new baseline version.');
        System.assertEquals(
            run.Run_Key__c,
            after.Baseline_Centroid_Ref__c,
            'The centroid ref points at the blessed run.'
        );
    }

    @IsTest
    static void runRequiresRunPermission() {
        FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        User viewer = FleetTestFactory.insertStandardUser();

        FleetCalibrationService.RunRequest req = new FleetCalibrationService.RunRequest();
        req.agentId = agent.Id;
        Boolean threw = false;
        System.runAs(viewer) {
            try {
                FleetCalibrationService.run(req);
            } catch (FleetException e) {
                threw = true;
            }
        }
        System.assert(threw, 'run() is gated on Fleet_Run_Calibration.');
    }

    @IsTest
    static void runOpensAQueuedHeaderWhenPermittedAndBypassed() {
        User admin = FleetTestFactory.insertAdminUser();
        System.runAs(new User(Id = UserInfo.getUserId())) {
            FleetTestFactory.grantCustomPermissions(admin.Id, new Set<String>{ 'Fleet_Run_Calibration' });
        }
        Fleet_Agent__c agent = FleetTestFactory.insertAgent();
        FleetCalibrationService.bypass = true; // do not actually enqueue the chain

        Calibration_Run__c run;
        System.runAs(admin) {
            FleetConfigurationService.primeSetting(FleetTestFactory.buildSetting());
            FleetCalibrationService.RunRequest req = new FleetCalibrationService.RunRequest();
            req.agentId = agent.Id;
            req.triggerSource = 'Manual';
            run = FleetCalibrationService.run(req);
        }
        FleetCalibrationService.bypass = false;

        System.assertNotEquals(null, run.Id, 'A run header is created.');
        FleetCalibrationService.RunView v = FleetCalibrationService.getRun(run.Id);
        System.assertEquals('Queued', v.status, 'The header starts Queued.');
        System.assertEquals(
            1,
            FleetCalibrationService.getRuns(agent.Id, 10).size(),
            'The run is listed for its agent.'
        );
    }
}
