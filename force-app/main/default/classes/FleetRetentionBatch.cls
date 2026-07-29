/**
 * Fleet - nightly retention (CONTRACT §9.2, §4).
 *
 * Honors the two retention dials on Fleet_Setting__mdt:
 *   - Retention_Days_Case_Result__c (default 90): Case_Result__c rows are the
 *     bulk of the operational data and carry customer response text, so they
 *     purge first and soonest. Deleted through normal DML in user mode.
 *   - Retention_Days_Trace__c (default 395): the Fleet_Trace__b archive is purged
 *     in finish() via FleetTraceService.purge, the only sanctioned deletion path
 *     for a Big Object (Database.deleteImmediate).
 */
public with sharing class FleetRetentionBatch implements Database.Batchable<SObject>, Database.Stateful {
    private Integer caseResultsDeleted = 0;

    public Database.QueryLocator start(Database.BatchableContext bc) {
        Fleet_Setting__mdt setting = FleetConfigurationService.getSetting();
        Integer days = setting.Retention_Days_Case_Result__c != null
            ? Integer.valueOf(setting.Retention_Days_Case_Result__c)
            : 90;
        Datetime cutoff = Datetime.now().addDays(-days);
        return Database.getQueryLocator(
            [
                SELECT Id
                FROM Case_Result__c
                WHERE CreatedDate < :cutoff
                WITH USER_MODE
            ]
        );
    }

    public void execute(Database.BatchableContext bc, List<Case_Result__c> scope) {
        if (scope == null || scope.isEmpty()) {
            return;
        }
        // User-mode delete: retention is not one of the two documented system-mode
        // exceptions (§9.1), so it runs with the scheduling admin's access.
        List<Database.DeleteResult> results = Database.delete(scope, false, AccessLevel.USER_MODE);
        for (Database.DeleteResult r : results) {
            if (r.isSuccess()) {
                caseResultsDeleted++;
            }
        }
    }

    public void finish(Database.BatchableContext bc) {
        // Big Object archive purge - the sole deletion path for Fleet_Trace__b (§4).
        Fleet_Setting__mdt setting = FleetConfigurationService.getSetting();
        Integer traceDays = setting.Retention_Days_Trace__c != null
            ? Integer.valueOf(setting.Retention_Days_Trace__c)
            : 395;
        Integer tracesDeleted = FleetTraceService.purge(traceDays);
        System.debug(
            LoggingLevel.INFO,
            'FleetRetentionBatch deleted ' + caseResultsDeleted + ' case result(s) and ' + tracesDeleted + ' trace(s).'
        );
    }
}
