/**
 * Fleet - continuous drift detection between calibration runs (CONTRACT §9.2).
 *
 * Sweeps every monitored agent, runs the active detectors over its recent
 * Case_Result__c window, and - when a detector trips and the trueness series has
 * a changepoint the ledger can explain - opens a finding attributed to the most
 * likely cause. Calibration is the deep, per-case pass; this batch is the cheap,
 * always-on watch that catches drift while the golden set is idle.
 *
 * Bulkification is by scope size, kept small by the scheduler because each agent
 * costs a detection read; the drift/attribution/finding services are the §8.2
 * facades, reused rather than reimplemented here.
 */
public with sharing class FleetDriftBatch implements Database.Batchable<SObject>, Database.Stateful {
    private Integer agentsScanned = 0;
    private Integer findingsOpened = 0;

    public Database.QueryLocator start(Database.BatchableContext bc) {
        // Only agents the customer is actively monitoring (§9.2).
        return Database.getQueryLocator(
            [
                SELECT Id, Agent_API_Name__c, Trueness_Score__c
                FROM Fleet_Agent__c
                WHERE Monitoring_Enabled__c = TRUE
                WITH USER_MODE
            ]
        );
    }

    public void execute(Database.BatchableContext bc, List<Fleet_Agent__c> scope) {
        List<FleetFindingService.FindingInput> toOpen = new List<FleetFindingService.FindingInput>();
        for (Fleet_Agent__c agent : scope) {
            agentsScanned++;
            FindingCandidate candidate = evaluate(agent.Id);
            if (candidate != null) {
                toOpen.add(candidate.input);
            }
        }
        // One open per candidate. FleetFindingService.open also grants managed
        // sharing (§7.4); the candidate list is bounded by the scope size.
        for (FleetFindingService.FindingInput input : toOpen) {
            FleetFindingService.open(input);
            findingsOpened++;
        }
    }

    public void finish(Database.BatchableContext bc) {
        System.debug(
            LoggingLevel.INFO,
            'FleetDriftBatch scanned ' + agentsScanned + ' agent(s), opened ' + findingsOpened + ' finding(s).'
        );
    }

    private class FindingCandidate {
        FleetFindingService.FindingInput input;
    }

    /** Evaluate one agent; return a finding candidate when drift is worth opening. */
    private FindingCandidate evaluate(Id agentId) {
        FleetDriftService.DriftSignal worst;
        for (FleetDriftService.DriftSignal s : FleetDriftService.detect(agentId, null)) {
            if (s.tripped == true && (worst == null || nz(s.observedValue) > nz(worst.observedValue))) {
                worst = s;
            }
        }
        if (worst == null) {
            return null;
        }
        List<FleetDriftService.Changepoint> points = FleetDriftService.changepoints(agentId);
        FleetAttributionService.AttributionResult attribution;
        if (!points.isEmpty()) {
            attribution = FleetAttributionService.attribute(points[0]);
        }

        FleetFindingService.FindingInput input = new FleetFindingService.FindingInput();
        input.agentId = agentId;
        input.severity = severityFor(worst);
        input.detector = worst.detectorKey;
        input.headline = (worst.label == null ? worst.detectorKey : worst.label) + ' drift detected';
        input.detail = worst.detail;
        if (attribution != null && attribution.attributed == true) {
            input.attributedChangeId = attribution.attributedChangeId;
            input.attributionConfidence = attribution.confidence;
        }
        FindingCandidate c = new FindingCandidate();
        c.input = input;
        return c;
    }

    private static Decimal nz(Decimal v) {
        return v == null ? 0 : v;
    }

    private static String severityFor(FleetDriftService.DriftSignal s) {
        if (s.threshold == null || s.threshold <= 0 || s.observedValue == null) {
            return 'High';
        }
        Decimal ratio = s.observedValue / s.threshold;
        if (ratio >= 2) {
            return 'Critical';
        }
        if (ratio >= 1.5) {
            return 'High';
        }
        return 'Medium';
    }
}
