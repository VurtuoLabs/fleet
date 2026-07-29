/**
 * Fleet - behavioral drift detection (CONTRACT §8.2).
 *
 * detect() runs every active Fleet_Drift_Detector__mdt over a window of
 * Case_Result__c rows for an agent and emits a DriftSignal per detector that
 * clears its threshold and minimum-sample gate. changepoints() finds mean-shift
 * points in the agent's trueness time series for the attribution engine to
 * correlate against Change_Event__c windows.
 */
public with sharing class FleetDriftService {
    /** One detector's verdict over the window. */
    public class DriftSignal {
        @AuraEnabled
        public String detectorKey;
        @AuraEnabled
        public String label;
        @AuraEnabled
        public String strategy;
        @AuraEnabled
        public Boolean tripped;
        @AuraEnabled
        public Decimal observedValue;
        @AuraEnabled
        public Decimal threshold;
        @AuraEnabled
        public Decimal weight;
        @AuraEnabled
        public Integer sampleSize;
        @AuraEnabled
        public Integer windowHours;
        @AuraEnabled
        public String detail;
    }

    /** A detected shift in the trueness series. */
    public class Changepoint {
        @AuraEnabled
        public Id agentId;
        @AuraEnabled
        public Datetime occurredAt;
        @AuraEnabled
        public Decimal beforeMean;
        @AuraEnabled
        public Decimal afterMean;
        @AuraEnabled
        public Decimal magnitude;
        @AuraEnabled
        public String direction;
    }

    /**
     * Run every active detector over the recent window for one agent.
     *
     * @param agentId the monitored agent
     * @param windowHours override for the window; each detector's own
     *        Window_Hours__c is used when this is null
     * @return one signal per detector, tripped flag set when threshold cleared
     */
    public static List<DriftSignal> detect(Id agentId, Integer windowHours) {
        if (agentId == null) {
            throw new FleetException('An agent id is required for drift detection.');
        }
        List<Fleet_Drift_Detector__mdt> detectors = FleetConfigurationService.getDetectors();
        // Widest window any detector needs, so we pull results once, not per detector.
        Integer maxWindow = windowHours != null ? windowHours : 1;
        for (Fleet_Drift_Detector__mdt d : detectors) {
            Integer w = d.Window_Hours__c != null ? Integer.valueOf(d.Window_Hours__c) : 24;
            if (w > maxWindow) {
                maxWindow = w;
            }
        }
        Datetime since = Datetime.now().addHours(-maxWindow);
        List<Case_Result__c> results = [
            SELECT
                Id,
                Deviation_Score__c,
                Passed__c,
                Judged__c,
                Topic_Selected__c,
                Actions_Invoked__c,
                Latency_Ms__c,
                Credits__c,
                Grounding_Sources__c,
                CreatedDate,
                Calibration_Run__r.Fleet_Agent__c
            FROM Case_Result__c
            WHERE Calibration_Run__r.Fleet_Agent__c = :agentId AND CreatedDate >= :since
            WITH USER_MODE
            ORDER BY CreatedDate DESC
        ];

        List<DriftSignal> signals = new List<DriftSignal>();
        for (Fleet_Drift_Detector__mdt d : detectors) {
            Integer w = windowHours != null
                ? windowHours
                : (d.Window_Hours__c != null ? Integer.valueOf(d.Window_Hours__c) : 24);
            Datetime detectorSince = Datetime.now().addHours(-w);
            List<Case_Result__c> scoped = new List<Case_Result__c>();
            for (Case_Result__c r : results) {
                if (r.CreatedDate >= detectorSince) {
                    scoped.add(r);
                }
            }
            signals.add(evaluateDetector(d, scoped, w));
        }
        return signals;
    }

    private static DriftSignal evaluateDetector(Fleet_Drift_Detector__mdt d, List<Case_Result__c> scoped, Integer w) {
        DriftSignal s = new DriftSignal();
        s.detectorKey = d.Detector_Key__c;
        s.label = d.Label__c;
        s.strategy = d.Strategy__c;
        s.threshold = d.Threshold__c;
        s.weight = d.Weight__c;
        s.windowHours = w;
        s.sampleSize = scoped.size();

        Integer minSample = d.Minimum_Sample__c != null ? Integer.valueOf(d.Minimum_Sample__c) : 1;
        if (scoped.size() < minSample) {
            s.tripped = false;
            s.observedValue = null;
            s.detail = 'Insufficient sample: ' + scoped.size() + ' < ' + minSample;
            return s;
        }

        s.observedValue = computeObserved(d.Detector_Key__c, scoped);
        Decimal threshold = d.Threshold__c != null ? d.Threshold__c : 0;
        s.tripped = s.observedValue != null && s.observedValue >= threshold;
        s.detail =
            d.Detector_Key__c +
            ' observed=' +
            (s.observedValue == null ? 'n/a' : String.valueOf(s.observedValue.setScale(3))) +
            ' threshold=' +
            threshold;
        return s;
    }

    /** Each detector strategy reduces the window to a single 0-1 drift magnitude. */
    private static Decimal computeObserved(String detectorKey, List<Case_Result__c> scoped) {
        switch on detectorKey {
            when 'SEMANTIC_DRIFT' {
                // Average deviation score: how far responses have wandered semantically.
                Decimal sum = 0;
                Integer n = 0;
                for (Case_Result__c r : scoped) {
                    if (r.Deviation_Score__c != null) {
                        sum += r.Deviation_Score__c;
                        n++;
                    }
                }
                return n == 0 ? 0 : (sum / n);
            }
            when 'STRUCTURAL_DRIFT' {
                // Share of cases where the response invoked no action or changed topic mix.
                Integer structural = 0;
                for (Case_Result__c r : scoped) {
                    if (String.isBlank(r.Actions_Invoked__c) || String.isBlank(r.Topic_Selected__c)) {
                        structural++;
                    }
                }
                return scoped.isEmpty() ? 0 : (Decimal.valueOf(structural) / scoped.size());
            }
            when 'ECONOMIC_DRIFT' {
                // Fraction of cases whose credits exceed the window's median-ish mean.
                Decimal totalCredits = 0;
                Integer n = 0;
                for (Case_Result__c r : scoped) {
                    if (r.Credits__c != null) {
                        totalCredits += r.Credits__c;
                        n++;
                    }
                }
                if (n == 0) {
                    return 0;
                }
                Decimal mean = totalCredits / n;
                Integer over = 0;
                for (Case_Result__c r : scoped) {
                    if (r.Credits__c != null && r.Credits__c > mean * 1.5) {
                        over++;
                    }
                }
                return Decimal.valueOf(over) / n;
            }
            when 'TRUST_DRIFT' {
                // Share of cases missing grounding sources: ungrounded answers erode trust.
                Integer ungrounded = 0;
                for (Case_Result__c r : scoped) {
                    if (String.isBlank(r.Grounding_Sources__c)) {
                        ungrounded++;
                    }
                }
                return scoped.isEmpty() ? 0 : (Decimal.valueOf(ungrounded) / scoped.size());
            }
            when else {
                // Unknown strategy: fall back to failure rate so a misconfigured
                // detector still surfaces something rather than silently passing.
                Integer failed = 0;
                for (Case_Result__c r : scoped) {
                    if (r.Passed__c == false) {
                        failed++;
                    }
                }
                return scoped.isEmpty() ? 0 : (Decimal.valueOf(failed) / scoped.size());
            }
        }
    }

    /**
     * Detect mean-shift changepoints in the agent's trueness series from its
     * completed runs. A simple two-window sweep: for each interior point, compare
     * the mean before and after; the largest gap above a minimum magnitude is a
     * changepoint the attribution engine can pin to a change event.
     */
    public static List<Changepoint> changepoints(Id agentId) {
        if (agentId == null) {
            throw new FleetException('An agent id is required.');
        }
        List<Calibration_Run__c> runs = [
            SELECT Id, Trueness_Score__c, Completed_At__c
            FROM Calibration_Run__c
            WHERE Fleet_Agent__c = :agentId AND Status__c = 'Completed' AND Trueness_Score__c != NULL
            WITH USER_MODE
            ORDER BY Completed_At__c ASC
        ];
        List<Changepoint> points = new List<Changepoint>();
        if (runs.size() < 4) {
            return points; // Not enough history to separate signal from noise.
        }
        Decimal minMagnitude = 5; // trueness points
        Changepoint best;
        for (Integer i = 2; i <= runs.size() - 2; i++) {
            Decimal beforeMean = meanTrueness(runs, 0, i);
            Decimal afterMean = meanTrueness(runs, i, runs.size());
            Decimal magnitude = Math.abs(afterMean - beforeMean);
            if (magnitude >= minMagnitude && (best == null || magnitude > best.magnitude)) {
                best = new Changepoint();
                best.agentId = agentId;
                best.occurredAt = runs[i].Completed_At__c;
                best.beforeMean = beforeMean.setScale(2);
                best.afterMean = afterMean.setScale(2);
                best.magnitude = magnitude.setScale(2);
                best.direction = afterMean < beforeMean ? 'Regression' : 'Improvement';
            }
        }
        if (best != null) {
            points.add(best);
        }
        return points;
    }

    private static Decimal meanTrueness(List<Calibration_Run__c> runs, Integer fromIdx, Integer toIdx) {
        Decimal sum = 0;
        Integer n = 0;
        for (Integer i = fromIdx; i < toIdx; i++) {
            if (runs[i].Trueness_Score__c != null) {
                sum += runs[i].Trueness_Score__c;
                n++;
            }
        }
        return n == 0 ? 0 : (sum / n);
    }
}
