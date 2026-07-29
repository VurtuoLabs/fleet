/**
 * Fleet - deviation finding facade (CONTRACT §8.2).
 *
 * Deviation_Finding__c is Private (§7.4): it may contain customer utterances.
 * Opening a finding writes the record and immediately hands it to
 * FleetSharingService to grant the owning queue access via Apex managed sharing,
 * because criteria-based sharing recalculates asynchronously and would leave a
 * fresh critical finding invisible during the window that matters most.
 */
public with sharing class FleetFindingService {
    // ---------------------------------------------------------------- Agent action
    //
    // Fleet_Curator's Load_Finding action targets apex://FleetFindingService
    // (CONTRACT §10.2). Agentforce resolves an Apex action to an @InvocableMethod,
    // and the @InvocableVariable names must match the .agent input/output names:
    // finding_id in, finding_detail out.

    public class LoadFindingRequest {
        @InvocableVariable(label='finding_id' description='Deviation_Finding__c record id' required=true)
        public String finding_id;
    }

    public class LoadFindingResponse {
        @InvocableVariable(
            label='finding_detail'
            description='Headline, detail, attributed change, and failing cases'
        )
        public String finding_detail;
    }

    @InvocableMethod(
        label='Load Finding'
        description='Load a deviation finding with its attributed change and failing cases.'
        category='Fleet'
    )
    public static List<LoadFindingResponse> loadFinding(List<LoadFindingRequest> requests) {
        List<LoadFindingResponse> out = new List<LoadFindingResponse>();
        for (LoadFindingRequest req : requests) {
            LoadFindingResponse res = new LoadFindingResponse();
            try {
                res.finding_detail = describeFinding(req.finding_id);
            } catch (Exception e) {
                res.finding_detail = 'Could not load the finding: ' + e.getMessage();
            }
            out.add(res);
        }
        return out;
    }

    private static String describeFinding(String findingId) {
        if (String.isBlank(findingId)) {
            throw new FleetException('A Deviation_Finding__c id is required.');
        }
        List<Deviation_Finding__c> found = [
            SELECT
                Finding_Number__c,
                Severity__c,
                State__c,
                Headline__c,
                Detail__c,
                Detector__c,
                Cases_Failing__c,
                Cases_Total__c,
                Attribution_Confidence__c,
                Opened_At__c,
                Attributed_Change__r.Label__c,
                Attributed_Change__r.Kind__c,
                Attributed_Change__r.Occurred_At__c,
                Fleet_Agent__r.Agent_API_Name__c
            FROM Deviation_Finding__c
            WHERE Id = :(Id) findingId
            WITH USER_MODE
            LIMIT 1
        ];
        // Private OWD: a user without a sharing grant sees no rows rather than an error.
        if (found.isEmpty()) {
            throw new FleetException('No finding is visible to you for id ' + findingId);
        }
        Deviation_Finding__c f = found[0];

        List<String> parts = new List<String>();
        parts.add('Finding ' + f.Finding_Number__c + ' (' + f.Severity__c + ', ' + f.State__c + ')');
        parts.add('Agent: ' + (f.Fleet_Agent__r == null ? 'unknown' : f.Fleet_Agent__r.Agent_API_Name__c));
        parts.add('Headline: ' + f.Headline__c);
        if (String.isNotBlank(f.Detail__c)) {
            parts.add('Detail: ' + f.Detail__c);
        }
        parts.add('Detector: ' + f.Detector__c);
        parts.add('Cases failing: ' + f.Cases_Failing__c + ' of ' + f.Cases_Total__c);
        if (f.Attributed_Change__c != null) {
            parts.add(
                'Attributed change: ' +
                f.Attributed_Change__r.Label__c +
                ' (' +
                f.Attributed_Change__r.Kind__c +
                ') at ' +
                f.Attributed_Change__r.Occurred_At__c +
                ', confidence ' +
                f.Attribution_Confidence__c
            );
        } else {
            parts.add('Attributed change: none correlated within the detector window.');
        }
        return String.join(parts, '\n');
    }

    /** Console filter for the findings list. */
    public class FindingQuery {
        @AuraEnabled
        public Id agentId;
        @AuraEnabled
        public String state;
        @AuraEnabled
        public String severity;
        @AuraEnabled
        public Integer limitN;
    }

    /** Input to open a finding, typically from the calibration chain. */
    public class FindingInput {
        @AuraEnabled
        public Id agentId;
        @AuraEnabled
        public String severity;
        @AuraEnabled
        public String headline;
        @AuraEnabled
        public String detail;
        @AuraEnabled
        public String detector;
        @AuraEnabled
        public Id attributedChangeId;
        @AuraEnabled
        public Decimal attributionConfidence;
        @AuraEnabled
        public Integer casesFailing;
        @AuraEnabled
        public Integer casesTotal;
    }

    /** Read-model for the findings grid and detail. */
    public class FindingView {
        @AuraEnabled
        public Id id;
        @AuraEnabled
        public Id agentId;
        @AuraEnabled
        public String findingNumber;
        @AuraEnabled
        public String severity;
        @AuraEnabled
        public String state;
        @AuraEnabled
        public String headline;
        @AuraEnabled
        public String detail;
        @AuraEnabled
        public String detector;
        @AuraEnabled
        public Id attributedChangeId;
        @AuraEnabled
        public Decimal attributionConfidence;
        @AuraEnabled
        public Decimal casesFailing;
        @AuraEnabled
        public Decimal casesTotal;
        @AuraEnabled
        public Datetime openedAt;
        @AuraEnabled
        public Datetime closedAt;
        @AuraEnabled
        public String closedBy;
        @AuraEnabled
        public String closureReason;
    }

    private static final List<String> FINDING_FIELDS = new List<String>{
        'Id',
        'Fleet_Agent__c',
        'Finding_Number__c',
        'Severity__c',
        'State__c',
        'Headline__c',
        'Detail__c',
        'Detector__c',
        'Attributed_Change__c',
        'Attribution_Confidence__c',
        'Cases_Failing__c',
        'Cases_Total__c',
        'Opened_At__c',
        'Closed_At__c',
        'Closed_By__c',
        'Closure_Reason__c'
    };

    public static List<FindingView> getFindings(FindingQuery q) {
        FindingQuery query = (q == null) ? new FindingQuery() : q;
        List<String> clauses = new List<String>();
        Map<String, Object> binds = new Map<String, Object>();
        if (query.agentId != null) {
            clauses.add('Fleet_Agent__c = :agentId');
            binds.put('agentId', query.agentId);
        }
        if (String.isNotBlank(query.state)) {
            clauses.add('State__c = :stateVal');
            binds.put('stateVal', query.state);
        }
        if (String.isNotBlank(query.severity)) {
            clauses.add('Severity__c = :sevVal');
            binds.put('sevVal', query.severity);
        }
        String soql = 'SELECT ' + String.join(FINDING_FIELDS, ', ') + ' FROM Deviation_Finding__c';
        if (!clauses.isEmpty()) {
            soql += ' WHERE ' + String.join(clauses, ' AND ');
        }
        soql += ' ORDER BY Opened_At__c DESC';
        Integer cap = (query.limitN == null || query.limitN <= 0) ? 200 : query.limitN;
        soql += ' LIMIT ' + cap;

        List<Deviation_Finding__c> rows = Database.queryWithBinds(soql, binds, AccessLevel.USER_MODE);
        List<FindingView> views = new List<FindingView>();
        for (Deviation_Finding__c f : rows) {
            views.add(toView(f));
        }
        return views;
    }

    /**
     * Open a finding and grant the owning queue access in the same transaction.
     *
     * @param input the detected drift, severity, and attribution
     * @return the persisted finding
     */
    public static Deviation_Finding__c open(FindingInput input) {
        if (input == null || input.agentId == null) {
            throw new FleetException('A finding requires an agent id.');
        }
        Deviation_Finding__c f = new Deviation_Finding__c();
        f.Fleet_Agent__c = input.agentId;
        f.Severity__c = String.isBlank(input.severity) ? 'Medium' : input.severity;
        f.State__c = 'Open';
        f.Headline__c = input.headline;
        f.Detail__c = input.detail;
        f.Detector__c = input.detector;
        f.Attributed_Change__c = input.attributedChangeId;
        f.Attribution_Confidence__c = input.attributionConfidence;
        f.Cases_Failing__c = input.casesFailing;
        f.Cases_Total__c = input.casesTotal;
        f.Opened_At__c = Datetime.now();
        insert as user f;

        // Managed sharing with a custom row cause survives owner changes and cannot
        // be deleted by users - the right posture for an audit-adjacent record (§7.4).
        FleetSharingService.grantFindingAccess(new List<Deviation_Finding__c>{ f });
        return f;
    }

    public static FindingView close(Id findingId, String reason) {
        Deviation_Finding__c f = load(findingId);
        f.State__c = 'Closed';
        f.Closed_At__c = Datetime.now();
        f.Closed_By__c = UserInfo.getUserId();
        f.Closure_Reason__c = reason;
        update as user f;
        return toView(load(findingId));
    }

    private static Deviation_Finding__c load(Id findingId) {
        if (findingId == null) {
            throw new FleetException('A finding id is required.');
        }
        String soql =
            'SELECT ' +
            String.join(FINDING_FIELDS, ', ') +
            ' FROM Deviation_Finding__c WHERE Id = :findingId LIMIT 1';
        List<Deviation_Finding__c> rows = Database.queryWithBinds(
            soql,
            new Map<String, Object>{ 'findingId' => findingId },
            AccessLevel.USER_MODE
        );
        if (rows.isEmpty()) {
            throw new FleetException('Finding not found or not accessible: ' + findingId);
        }
        return rows[0];
    }

    private static FindingView toView(Deviation_Finding__c f) {
        FindingView v = new FindingView();
        v.id = f.Id;
        v.agentId = f.Fleet_Agent__c;
        v.findingNumber = f.Finding_Number__c;
        v.severity = f.Severity__c;
        v.state = f.State__c;
        v.headline = f.Headline__c;
        v.detail = f.Detail__c;
        v.detector = f.Detector__c;
        v.attributedChangeId = f.Attributed_Change__c;
        v.attributionConfidence = f.Attribution_Confidence__c;
        v.casesFailing = f.Cases_Failing__c;
        v.casesTotal = f.Cases_Total__c;
        v.openedAt = f.Opened_At__c;
        v.closedAt = f.Closed_At__c;
        v.closedBy = f.Closed_By__c;
        v.closureReason = f.Closure_Reason__c;
        return v;
    }
}
