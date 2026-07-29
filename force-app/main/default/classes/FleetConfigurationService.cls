/**
 * Fleet - static caches over the admin-configurable Custom Metadata Types.
 *
 * Every threshold, bound, schedule, and policy in Fleet lives in CMDT, never
 * hardcoded in Apex (CONTRACT §6). This service is the single read point: one
 * SOQL per type per transaction, memoized in a static cache so a calibration
 * chain that touches config on every link pays for it exactly once.
 */
public with sharing class FleetConfigurationService {
    private static Fleet_Setting__mdt settingCache;
    private static List<Fleet_Assertion_Type__mdt> assertionTypeCache;
    private static List<Fleet_Drift_Detector__mdt> detectorCache;
    private static List<Fleet_Severity_Policy__mdt> severityPolicyCache;
    private static List<Fleet_Change_Source__mdt> changeSourceCache;
    private static List<Fleet_View__mdt> viewCache;

    /** The single `Default` settings record. */
    public static Fleet_Setting__mdt getSetting() {
        if (settingCache == null) {
            List<Fleet_Setting__mdt> rows = [
                SELECT
                    DeveloperName,
                    Monitoring_Enabled__c,
                    Default_Schedule_Cron__c,
                    Judge_Template_Name__c,
                    Prefilter_Lower_Bound__c,
                    Prefilter_Upper_Bound__c,
                    Max_Cases_Per_Run__c,
                    Trueness_Threshold__c,
                    Retention_Days_Case_Result__c,
                    Retention_Days_Trace__c,
                    Auto_Curation_Enabled__c,
                    Auto_Curation_Cron__c,
                    CI_Gate_Enabled__c
                FROM Fleet_Setting__mdt
                WHERE DeveloperName = 'Default'
                LIMIT 1
            ];
            if (rows.isEmpty()) {
                throw new FleetException('Fleet_Setting__mdt.Default is not deployed.');
            }
            settingCache = rows[0];
        }
        return settingCache;
    }

    public static List<Fleet_Assertion_Type__mdt> getAssertionTypes() {
        if (assertionTypeCache == null) {
            assertionTypeCache = [
                SELECT
                    DeveloperName,
                    Type_Key__c,
                    Label__c,
                    Evaluation_Strategy__c,
                    Requires_Judge__c,
                    Default_Severity__c,
                    Active__c
                FROM Fleet_Assertion_Type__mdt
                WHERE Active__c = TRUE
            ];
        }
        return assertionTypeCache;
    }

    /** Assertion types indexed by their Type_Key__c for O(1) strategy lookup. */
    public static Map<String, Fleet_Assertion_Type__mdt> getAssertionTypesByKey() {
        Map<String, Fleet_Assertion_Type__mdt> byKey = new Map<String, Fleet_Assertion_Type__mdt>();
        for (Fleet_Assertion_Type__mdt t : getAssertionTypes()) {
            byKey.put(t.Type_Key__c, t);
        }
        return byKey;
    }

    public static List<Fleet_Drift_Detector__mdt> getDetectors() {
        if (detectorCache == null) {
            detectorCache = [
                SELECT
                    DeveloperName,
                    Detector_Key__c,
                    Label__c,
                    Strategy__c,
                    Threshold__c,
                    Window_Hours__c,
                    Minimum_Sample__c,
                    Weight__c,
                    Active__c
                FROM Fleet_Drift_Detector__mdt
                WHERE Active__c = TRUE
            ];
        }
        return detectorCache;
    }

    public static List<Fleet_Severity_Policy__mdt> getSeverityPolicies() {
        if (severityPolicyCache == null) {
            severityPolicyCache = [
                SELECT
                    DeveloperName,
                    Severity__c,
                    Auto_Action__c,
                    Notify_Queue_Id__c,
                    Approval_Queue_Id__c,
                    Requires_Custom_Permission__c,
                    Auto_Close_After_Days__c,
                    Active__c
                FROM Fleet_Severity_Policy__mdt
                WHERE Active__c = TRUE
            ];
        }
        return severityPolicyCache;
    }

    /** Severity policies indexed by severity label. */
    public static Map<String, Fleet_Severity_Policy__mdt> getSeverityPoliciesBySeverity() {
        Map<String, Fleet_Severity_Policy__mdt> bySev = new Map<String, Fleet_Severity_Policy__mdt>();
        for (Fleet_Severity_Policy__mdt p : getSeverityPolicies()) {
            bySev.put(p.Severity__c, p);
        }
        return bySev;
    }

    public static List<Fleet_Change_Source__mdt> getChangeSources() {
        if (changeSourceCache == null) {
            changeSourceCache = [
                SELECT
                    DeveloperName,
                    Source_Key__c,
                    Label__c,
                    Ingestion_Strategy__c,
                    Correlation_Window_Minutes__c,
                    Active__c
                FROM Fleet_Change_Source__mdt
                WHERE Active__c = TRUE
            ];
        }
        return changeSourceCache;
    }

    public static List<Fleet_View__mdt> getViews() {
        if (viewCache == null) {
            viewCache = [
                SELECT
                    DeveloperName,
                    View_Key__c,
                    Label__c,
                    Filter_JSON__c,
                    Sort_Field__c,
                    Sort_Direction__c,
                    Display_Order__c,
                    Active__c
                FROM Fleet_View__mdt
                WHERE Active__c = TRUE
                ORDER BY Display_Order__c ASC NULLS LAST
            ];
        }
        return viewCache;
    }

    @TestVisible
    private static void primeSetting(Fleet_Setting__mdt s) {
        settingCache = s;
    }
}
