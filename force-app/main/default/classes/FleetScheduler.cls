/**
 * Fleet - the single scheduled entry point (CONTRACT §9.2).
 *
 * Reads Fleet_Setting__mdt.Default_Schedule_Cron__c and, on each fire:
 *   - sweeps a calibration run for every monitored agent,
 *   - kicks FleetDriftBatch for continuous detection between runs,
 *   - kicks FleetRetentionBatch to honor the two retention dials,
 *   - polls the change ledger for new admin activity.
 *
 * Each step is a separate method so a test can exercise it in isolation, and the
 * whole thing degrades gracefully: a failure in one step is logged and the rest
 * still run, because a stuck retention job must not silence drift detection.
 */
public with sharing class FleetScheduler implements Schedulable {
    /** Batch scope kept small: each agent costs a detection read (§9.2). */
    @TestVisible
    private static Integer driftScope = 5;
    @TestVisible
    private static Integer retentionScope = 200;

    public void execute(SchedulableContext sc) {
        Fleet_Setting__mdt setting = FleetConfigurationService.getSetting();
        if (setting.Monitoring_Enabled__c == true) {
            sweepCalibrations();
        }
        runDriftDetection();
        runRetention();
        pollChangeLedger();
    }

    /**
     * Register this job on the org's default cron. Convenience for setup and the
     * onboarding wizard; returns the scheduled job id.
     */
    public static Id scheduleDefault() {
        String cron = FleetConfigurationService.getSetting().Default_Schedule_Cron__c;
        if (String.isBlank(cron)) {
            throw new FleetException('Fleet_Setting__mdt.Default_Schedule_Cron__c is not configured.');
        }
        return System.schedule('Fleet Calibration Sweep', cron, new FleetScheduler());
    }

    /** Enqueue a calibration run for every monitored agent (§9.2). */
    @TestVisible
    private static void sweepCalibrations() {
        List<Fleet_Agent__c> agents = [
            SELECT Id
            FROM Fleet_Agent__c
            WHERE Monitoring_Enabled__c = TRUE AND Status__c != 'Quarantined'
            WITH USER_MODE
        ];
        for (Fleet_Agent__c agent : agents) {
            try {
                FleetCalibrationService.RunRequest req = new FleetCalibrationService.RunRequest();
                req.agentId = agent.Id;
                req.triggerSource = 'Scheduled';
                FleetCalibrationService.run(req);
            } catch (Exception e) {
                // One agent's failure (e.g. missing permission) must not abort the sweep.
                System.debug(LoggingLevel.WARN, 'Calibration sweep skipped agent ' + agent.Id + ': ' + e.getMessage());
            }
        }
    }

    @TestVisible
    private static void runDriftDetection() {
        try {
            Database.executeBatch(new FleetDriftBatch(), driftScope);
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'FleetDriftBatch not started: ' + e.getMessage());
        }
    }

    @TestVisible
    private static void runRetention() {
        try {
            Database.executeBatch(new FleetRetentionBatch(), retentionScope);
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'FleetRetentionBatch not started: ' + e.getMessage());
        }
    }

    @TestVisible
    private static void pollChangeLedger() {
        try {
            FleetChangeLedgerService.pollSetupAuditTrail();
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Change ledger poll failed: ' + e.getMessage());
        }
    }
}
