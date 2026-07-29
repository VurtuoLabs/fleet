/**
 * Fleet - change attribution (CONTRACT §8.2).
 *
 * Given a changepoint in an agent's behavior, correlate it against
 * Change_Event__c records that fall inside each change source's correlation
 * window. The nearest qualifying event in time is the attributed cause; the
 * confidence falls off with temporal distance and rises when the change source
 * is one Fleet knows tends to move behavior (deploy, prompt, model, knowledge).
 */
public with sharing class FleetAttributionService {
    /** The correlated cause of a changepoint, with a 0-1 confidence. */
    public class AttributionResult {
        @AuraEnabled
        public Id agentId;
        @AuraEnabled
        public Datetime changepointAt;
        @AuraEnabled
        public Id attributedChangeId;
        @AuraEnabled
        public String changeKey;
        @AuraEnabled
        public String changeSource;
        @AuraEnabled
        public String changeKind;
        @AuraEnabled
        public String changeLabel;
        @AuraEnabled
        public Datetime changeOccurredAt;
        @AuraEnabled
        public Decimal confidence;
        @AuraEnabled
        public Integer minutesApart;
        @AuraEnabled
        public Boolean attributed;
        @AuraEnabled
        public String rationale;
    }

    /**
     * Correlate a changepoint against the change ledger.
     *
     * @param c the changepoint produced by FleetDriftService
     * @return the best-matching change with a confidence, or an unattributed
     *         result when nothing falls inside any source's window
     */
    public static AttributionResult attribute(FleetDriftService.Changepoint c) {
        if (c == null || c.occurredAt == null) {
            throw new FleetException('A changepoint with a timestamp is required.');
        }
        AttributionResult result = new AttributionResult();
        result.agentId = c.agentId;
        result.changepointAt = c.occurredAt;
        result.attributed = false;
        result.confidence = 0;

        // Window sizing per source. The widest window bounds the candidate pull.
        Map<String, Integer> windowBySource = new Map<String, Integer>();
        Integer maxWindow = 60;
        for (Fleet_Change_Source__mdt src : FleetConfigurationService.getChangeSources()) {
            Integer w = src.Correlation_Window_Minutes__c != null
                ? Integer.valueOf(src.Correlation_Window_Minutes__c)
                : 60;
            windowBySource.put(src.Source_Key__c, w);
            if (w > maxWindow) {
                maxWindow = w;
            }
        }

        Datetime windowStart = c.occurredAt.addMinutes(-maxWindow);
        Datetime windowEnd = c.occurredAt.addMinutes(maxWindow);
        List<Change_Event__c> candidates = [
            SELECT
                Id,
                Change_Key__c,
                Source__c,
                Kind__c,
                Label__c,
                Actor__c,
                Occurred_At__c,
                Correlation_Window_Minutes__c
            FROM Change_Event__c
            WHERE Occurred_At__c >= :windowStart AND Occurred_At__c <= :windowEnd
            WITH USER_MODE
            ORDER BY Occurred_At__c DESC
        ];

        Change_Event__c best;
        Decimal bestConfidence = 0;
        Integer bestMinutes;
        for (Change_Event__c ev : candidates) {
            if (ev.Occurred_At__c == null) {
                continue;
            }
            // A change can only cause a shift it precedes (or is near-simultaneous with).
            Long deltaMs = c.occurredAt.getTime() - ev.Occurred_At__c.getTime();
            Integer minutesApart = (Integer) Math.abs(deltaMs / 60000);
            Integer sourceWindow = resolveWindow(ev, windowBySource);
            // Prefer a per-record override, then the source default.
            if (minutesApart > sourceWindow) {
                continue;
            }
            // Changes after the shift are weak evidence; damp them hard.
            Boolean precedes = deltaMs >= 0;
            Decimal proximity = 1 - (Decimal.valueOf(minutesApart) / sourceWindow);
            Decimal sourceWeight = sourceWeight(ev.Source__c);
            Decimal confidence = proximity * sourceWeight * (precedes ? 1 : 0.4);
            confidence = confidence < 0 ? 0 : (confidence > 1 ? 1 : confidence);
            if (confidence > bestConfidence) {
                bestConfidence = confidence;
                best = ev;
                bestMinutes = minutesApart;
            }
        }

        if (best != null) {
            result.attributed = true;
            result.attributedChangeId = best.Id;
            result.changeKey = best.Change_Key__c;
            result.changeSource = best.Source__c;
            result.changeKind = best.Kind__c;
            result.changeLabel = best.Label__c;
            result.changeOccurredAt = best.Occurred_At__c;
            result.confidence = bestConfidence.setScale(3);
            result.minutesApart = bestMinutes;
            result.rationale =
                'Correlated ' +
                c.direction +
                ' of ' +
                c.magnitude +
                ' trueness points to ' +
                best.Source__c +
                '/' +
                best.Kind__c +
                ' "' +
                best.Label__c +
                '" ' +
                bestMinutes +
                ' min prior; confidence ' +
                result.confidence;
        } else {
            result.rationale = 'No change event fell inside any source correlation window around the shift.';
        }
        return result;
    }

    private static Integer resolveWindow(Change_Event__c ev, Map<String, Integer> windowBySource) {
        if (ev.Correlation_Window_Minutes__c != null) {
            return Integer.valueOf(ev.Correlation_Window_Minutes__c);
        }
        if (ev.Source__c != null && windowBySource.containsKey(ev.Source__c)) {
            return windowBySource.get(ev.Source__c);
        }
        return 60;
    }

    /** Source-specific prior: deploys and model swaps move behavior most. */
    private static Decimal sourceWeight(String source) {
        switch on source {
            when 'MODEL' {
                return 1.0;
            }
            when 'PROMPT' {
                return 0.95;
            }
            when 'DEPLOY' {
                return 0.9;
            }
            when 'KNOWLEDGE' {
                return 0.8;
            }
            when else {
                return 0.6;
            }
        }
    }
}
