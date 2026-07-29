/**
 * Fleet - change ledger facade (CONTRACT §8.2, §9.1).
 *
 * The change ledger is the correlation source the attribution engine reads.
 * ingest() upserts Change_Event__c on the Change_Key__c external id so a source
 * that re-reports the same change is naturally deduplicated. pollSetupAuditTrail()
 * turns admin activity into change events for the SetupAuditTrail ingestion
 * strategy (§6 Fleet_Change_Source__mdt).
 */
public with sharing class FleetChangeLedgerService {
    /** Normalized change to record, from any ingestion strategy. */
    public class ChangeInput {
        @AuraEnabled
        public String changeKey;
        @AuraEnabled
        public String source;
        @AuraEnabled
        public String kind;
        @AuraEnabled
        public String label;
        @AuraEnabled
        public String actor;
        @AuraEnabled
        public Datetime occurredAt;
        @AuraEnabled
        public String detail;
        @AuraEnabled
        public String affectedArtifacts;
        @AuraEnabled
        public Integer correlationWindowMinutes;
    }

    /**
     * Upsert change events on Change_Key__c. Idempotent by construction: the same
     * key re-ingested updates the existing row rather than creating a duplicate.
     *
     * @param inputs normalized changes
     * @return number of rows upserted
     */
    public static Integer ingest(List<ChangeInput> inputs) {
        if (inputs == null || inputs.isEmpty()) {
            return 0;
        }
        Map<String, Change_Event__c> byKey = new Map<String, Change_Event__c>();
        for (ChangeInput ci : inputs) {
            if (String.isBlank(ci.changeKey)) {
                continue;
            }
            Change_Event__c ev = new Change_Event__c();
            ev.Change_Key__c = ci.changeKey;
            ev.Source__c = ci.source;
            ev.Kind__c = ci.kind;
            ev.Label__c = ci.label;
            ev.Actor__c = ci.actor;
            ev.Occurred_At__c = ci.occurredAt != null ? ci.occurredAt : Datetime.now();
            ev.Detail__c = ci.detail;
            ev.Affected_Artifacts__c = ci.affectedArtifacts;
            ev.Correlation_Window_Minutes__c = ci.correlationWindowMinutes;
            // Last write per key wins within the batch, then one upsert.
            byKey.put(ci.changeKey, ev);
        }
        if (byKey.isEmpty()) {
            return 0;
        }
        List<Change_Event__c> toUpsert = byKey.values();
        Database.upsert(toUpsert, Change_Event__c.Change_Key__c, AccessLevel.USER_MODE);
        return toUpsert.size();
    }

    /**
     * Poll the Setup Audit Trail and fold new admin activity into the ledger.
     *
     * DOCUMENTED SYSTEM-MODE EXCEPTION #2 (CONTRACT §9.1): SetupAuditTrail is an
     * admin-only object and this method runs from a scheduled context with no
     * interactive user, so the read is performed in system mode. The subsequent
     * write goes back through ingest() in USER_MODE. This is the only other
     * system-mode access in the codebase besides the trace write.
     *
     * @return number of change events upserted from the audit trail
     */
    public static Integer pollSetupAuditTrail() {
        Map<String, Fleet_Change_Source__mdt> sourcesByKey = new Map<String, Fleet_Change_Source__mdt>();
        for (Fleet_Change_Source__mdt src : FleetConfigurationService.getChangeSources()) {
            if (src.Ingestion_Strategy__c == 'SetupAuditTrail') {
                sourcesByKey.put(src.Source_Key__c, src);
            }
        }
        if (sourcesByKey.isEmpty()) {
            return 0;
        }

        // System-mode read (exception #2): SetupAuditTrail is admin-only and there
        // is no running user in the scheduled context. WITH USER_MODE would throw.
        Datetime since = Datetime.now().addHours(-24);
        List<SetupAuditTrail> entries = [
            SELECT Id, Action, Section, CreatedDate, Display, DelegateUser, CreatedBy.Username
            FROM SetupAuditTrail
            WHERE CreatedDate >= :since
            ORDER BY CreatedDate DESC
            LIMIT 500
        ];

        List<ChangeInput> changes = new List<ChangeInput>();
        for (SetupAuditTrail e : entries) {
            String sourceKey = classifySection(e.Section);
            if (sourceKey == null || !sourcesByKey.containsKey(sourceKey)) {
                continue; // Only fold in sections an admin has enabled as a source.
            }
            Fleet_Change_Source__mdt src = sourcesByKey.get(sourceKey);
            ChangeInput ci = new ChangeInput();
            ci.changeKey = 'SAT-' + e.Id;
            ci.source = sourceKey;
            ci.kind = e.Action;
            ci.label = String.isBlank(e.Display) ? e.Section : e.Display;
            ci.actor = e.CreatedBy != null ? e.CreatedBy.Username : null;
            ci.occurredAt = e.CreatedDate;
            ci.detail = e.Section + ' / ' + e.Action;
            ci.correlationWindowMinutes = src.Correlation_Window_Minutes__c != null
                ? Integer.valueOf(src.Correlation_Window_Minutes__c)
                : null;
            changes.add(ci);
        }
        return ingest(changes);
    }

    /** Map a Setup Audit Trail section to a Fleet change source key. */
    private static String classifySection(String section) {
        if (String.isBlank(section)) {
            return null;
        }
        String s = section.toLowerCase();
        if (s.contains('deploy') || s.contains('apex') || s.contains('flow')) {
            return 'DEPLOY';
        }
        if (s.contains('knowledge') || s.contains('article')) {
            return 'KNOWLEDGE';
        }
        if (s.contains('prompt') || s.contains('einstein') || s.contains('genai')) {
            return 'PROMPT';
        }
        if (s.contains('model')) {
            return 'MODEL';
        }
        return null;
    }
}
