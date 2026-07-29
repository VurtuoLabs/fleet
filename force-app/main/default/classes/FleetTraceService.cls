/**
 * Fleet - the only sanctioned read/write path for the Fleet_Trace__b turn archive.
 *
 * Big Objects are object-permission only: they cannot participate in record-level
 * sharing (CONTRACT §4). Therefore no user-facing permission set grants Read on
 * Fleet_Trace__b, and every access is funneled through this facade, which enforces
 * its own checks - most importantly Fleet_View_Transcripts before it will surface
 * raw Utterance__c / Response__c text (§7.4).
 */
public with sharing class FleetTraceService {
    /** Serves both the React SDK and any future LWC. */
    public class TraceView {
        @AuraEnabled
        public String traceKey;
        @AuraEnabled
        public String agentKey;
        @AuraEnabled
        public Datetime occurredAt;
        @AuraEnabled
        public String utterance;
        @AuraEnabled
        public String response;
        @AuraEnabled
        public String topicSelected;
        @AuraEnabled
        public Decimal topicConfidence;
        @AuraEnabled
        public String topicsConsidered;
        @AuraEnabled
        public String actionsInvoked;
        @AuraEnabled
        public String groundingSources;
        @AuraEnabled
        public String promptVersions;
        @AuraEnabled
        public String modelVersion;
        @AuraEnabled
        public Decimal latencyMs;
        @AuraEnabled
        public Decimal credits;
        @AuraEnabled
        public String trustFlags;
        @AuraEnabled
        public String sessionKey;
        @AuraEnabled
        public String runKey;
        /** True when the caller holds Fleet_View_Transcripts and the text was returned. */
        @AuraEnabled
        public Boolean transcriptVisible;
    }

    /**
     * Persist captured turns to the Big Object archive.
     *
     * DOCUMENTED SYSTEM-MODE EXCEPTION #1 (CONTRACT §9.1): this write runs in
     * system mode. A user whose profile lacks Fleet access must never cause an
     * agent conversation to fail. Big Objects use insertImmediate, which does not
     * honor sharing by design; `with sharing` still governs the rest of the
     * transaction. This is the only trace-write path.
     *
     * @param turns platform events captured from the agent tap
     * @return number of Big Object rows written
     */
    public static Integer write(List<Fleet_Turn__e> turns) {
        if (turns == null || turns.isEmpty()) {
            return 0;
        }
        List<Fleet_Trace__b> rows = new List<Fleet_Trace__b>();
        for (Fleet_Turn__e t : turns) {
            Fleet_Trace__b row = new Fleet_Trace__b();
            // Index part 1: <agentApiName>. Required on the composite index.
            row.Org_Agent_Key__c = t.Agent_API_Name__c;
            // Index part 2: descending reads. Index part 3: uniqueness tiebreak.
            row.Occurred_At__c = t.Occurred_At__c != null ? t.Occurred_At__c : Datetime.now();
            row.Trace_Key__c = t.Trace_Key__c;
            row.Utterance__c = t.Utterance__c;
            row.Response__c = t.Response__c;
            row.Topic_Selected__c = t.Topic_Selected__c;
            row.Topic_Confidence__c = t.Topic_Confidence__c;
            row.Topics_Considered__c = t.Topics_Considered__c;
            row.Actions_Invoked__c = t.Actions_Invoked__c;
            row.Grounding_Sources__c = t.Grounding_Sources__c;
            row.Prompt_Versions__c = t.Prompt_Versions__c;
            row.Model_Version__c = t.Model_Version__c;
            row.Latency_Ms__c = t.Latency_Ms__c;
            row.Credits__c = t.Credits__c;
            row.Trust_Flags__c = t.Trust_Flags__c;
            row.Session_Key__c = t.Session_Key__c;
            row.Run_Key__c = t.Run_Key__c;
            rows.add(row);
        }
        return writer.persist(rows);
    }

    /**
     * Seam over the Big Object write.
     *
     * Apex test context cannot write to Big Object storage - `Database.insertImmediate`
     * throws "Internal Salesforce.com Query Error" there, and `Database.SaveResult`
     * cannot be constructed in Apex, so the seam returns a count rather than results.
     * Production always uses ImmediateWriter; tests swap in a stub so the field
     * mapping above and the returned count stay covered.
     */
    public interface TraceWriter {
        Integer persist(List<Fleet_Trace__b> rows);
    }

    private class ImmediateWriter implements TraceWriter {
        public Integer persist(List<Fleet_Trace__b> rows) {
            Integer written = 0;
            for (Database.SaveResult sr : Database.insertImmediate(rows)) {
                if (sr.isSuccess()) {
                    written++;
                }
            }
            return written;
        }
    }

    @TestVisible
    private static TraceWriter writer = new ImmediateWriter();

    /**
     * Read the turn archive for one agent inside a time window, newest first.
     *
     * Queries strictly on the composite index in index order (equality on
     * Org_Agent_Key__c, range on Occurred_At__c) per the Big Object contract.
     * The query runs in system mode because Big Objects are object-permission
     * only and no user-facing permission set grants Read (§4) - access is instead
     * gated here: Utterance__c and Response__c are nulled unless the caller holds
     * Fleet_View_Transcripts (§7.4). FLS on DTO fields does not protect them, so
     * this re-check in the facade is the real enforcement point.
     */
    public static List<TraceView> read(String agentKey, Datetime fromDt, Datetime toDt, Integer limitN) {
        if (String.isBlank(agentKey)) {
            throw new FleetException('agentKey is required to read the trace archive.');
        }
        Boolean canViewTranscripts = FeatureManagement.checkPermission('Fleet_View_Transcripts');
        Integer cap = (limitN == null || limitN <= 0) ? 50 : limitN;
        Datetime lowerBound = (fromDt == null) ? Datetime.newInstance(1970, 1, 1) : fromDt;
        Datetime upperBound = (toDt == null) ? Datetime.now() : toDt;

        List<Fleet_Trace__b> rows = [
            SELECT
                Org_Agent_Key__c,
                Occurred_At__c,
                Trace_Key__c,
                Utterance__c,
                Response__c,
                Topic_Selected__c,
                Topic_Confidence__c,
                Topics_Considered__c,
                Actions_Invoked__c,
                Grounding_Sources__c,
                Prompt_Versions__c,
                Model_Version__c,
                Latency_Ms__c,
                Credits__c,
                Trust_Flags__c,
                Session_Key__c,
                Run_Key__c
            FROM Fleet_Trace__b
            WHERE Org_Agent_Key__c = :agentKey AND Occurred_At__c >= :lowerBound AND Occurred_At__c <= :upperBound
            LIMIT :cap
        ];

        List<TraceView> views = new List<TraceView>();
        for (Fleet_Trace__b row : rows) {
            views.add(toView(row, canViewTranscripts));
        }
        return views;
    }

    /**
     * Retention deletion for the archive. Big Objects support only
     * Database.deleteImmediate; this is the sole deletion path and is called by
     * the nightly FleetRetentionBatch honoring Retention_Days_Trace__c (§9.2).
     *
     * @param olderThanDays rows with Occurred_At__c older than this are removed
     * @return number of rows deleted
     */
    public static Integer purge(Integer olderThanDays) {
        if (olderThanDays == null || olderThanDays <= 0) {
            throw new FleetException('purge requires a positive olderThanDays.');
        }
        Datetime cutoff = Datetime.now().addDays(-olderThanDays);
        List<Fleet_Trace__b> stale = [
            SELECT Org_Agent_Key__c, Occurred_At__c, Trace_Key__c
            FROM Fleet_Trace__b
            WHERE Occurred_At__c < :cutoff
        ];
        if (stale.isEmpty()) {
            return 0;
        }
        Database.DeleteResult[] results = Database.deleteImmediate(stale);
        Integer deleted = 0;
        for (Database.DeleteResult dr : results) {
            if (dr.isSuccess()) {
                deleted++;
            }
        }
        return deleted;
    }

    /** Single-turn lookup by trace key, used by golden-case promotion. */
    public static TraceView readByKey(String agentKey, String traceKey) {
        if (String.isBlank(traceKey)) {
            throw new FleetException('traceKey is required.');
        }
        Boolean canViewTranscripts = FeatureManagement.checkPermission('Fleet_View_Transcripts');
        List<Fleet_Trace__b> rows = [
            SELECT
                Org_Agent_Key__c,
                Occurred_At__c,
                Trace_Key__c,
                Utterance__c,
                Response__c,
                Topic_Selected__c,
                Topic_Confidence__c,
                Topics_Considered__c,
                Actions_Invoked__c,
                Grounding_Sources__c,
                Prompt_Versions__c,
                Model_Version__c,
                Latency_Ms__c,
                Credits__c,
                Trust_Flags__c,
                Session_Key__c,
                Run_Key__c
            FROM Fleet_Trace__b
            WHERE Org_Agent_Key__c = :agentKey
        ];
        // The index is Org_Agent_Key__c -> Occurred_At__c -> Trace_Key__c, and a Big
        // Object filter may not skip a column: adding "AND Trace_Key__c = :traceKey"
        // here throws "Filters may not have any gaps within the composite key" at
        // runtime, because it jumps over Occurred_At__c. The caller knows the trace
        // key but not the timestamp, so the only index-legal query is on the agent,
        // and the key is matched in memory.
        for (Fleet_Trace__b row : rows) {
            if (row.Trace_Key__c == traceKey) {
                return toView(row, canViewTranscripts);
            }
        }
        return null;
    }

    private static TraceView toView(Fleet_Trace__b row, Boolean canViewTranscripts) {
        TraceView v = new TraceView();
        v.traceKey = row.Trace_Key__c;
        v.agentKey = row.Org_Agent_Key__c;
        v.occurredAt = row.Occurred_At__c;
        v.topicSelected = row.Topic_Selected__c;
        v.topicConfidence = row.Topic_Confidence__c;
        v.topicsConsidered = row.Topics_Considered__c;
        v.actionsInvoked = row.Actions_Invoked__c;
        v.groundingSources = row.Grounding_Sources__c;
        v.promptVersions = row.Prompt_Versions__c;
        v.modelVersion = row.Model_Version__c;
        v.latencyMs = row.Latency_Ms__c;
        v.credits = row.Credits__c;
        v.trustFlags = row.Trust_Flags__c;
        v.sessionKey = row.Session_Key__c;
        v.runKey = row.Run_Key__c;
        v.transcriptVisible = canViewTranscripts;
        // Least-privilege: the score is the default, the transcript is the exception.
        if (canViewTranscripts) {
            v.utterance = row.Utterance__c;
            v.response = row.Response__c;
        } else {
            v.utterance = null;
            v.response = null;
        }
        return v;
    }
}
