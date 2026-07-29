/**
 * Fleet - golden set curation facade (CONTRACT §8.2).
 *
 * The golden set and its blessed baseline are the core artifact of the product.
 * Every mutating entry point here is gated on Fleet_Curate_Golden_Set (§7.1);
 * reads are open to any console user.
 */
public with sharing class FleetGoldenSetService {
    // ---------------------------------------------------------------- Agent action
    //
    // Fleet_Curator's Propose_From_Traffic action targets apex://FleetGoldenSetService
    // (CONTRACT §10.2). An Agentforce Apex action resolves to an @InvocableMethod, so
    // the facade needs this entry point - without it the bundle fails to publish with
    // "We couldn't find the flow, prompt, or apex class".
    //
    // The @InvocableVariable names must match the input/output names declared in the
    // .agent file exactly: target_agent_id in, proposed_summary out.

    public class ProposeRequest {
        @InvocableVariable(label='target_agent_id' description='Fleet_Agent__c record id' required=true)
        public String target_agent_id;
    }

    public class ProposeResponse {
        @InvocableVariable(label='proposed_summary' description='Summary of the cases proposed for approval')
        public String proposed_summary;
    }

    /** How many production turns one invocation will promote at most. */
    private static final Integer PROPOSE_LIMIT = 5;

    @InvocableMethod(
        label='Propose Golden Cases'
        description='Promote representative production turns into proposed golden cases for admin approval.'
        category='Fleet'
    )
    public static List<ProposeResponse> proposeFromTraffic(List<ProposeRequest> requests) {
        List<ProposeResponse> out = new List<ProposeResponse>();
        for (ProposeRequest req : requests) {
            ProposeResponse res = new ProposeResponse();
            try {
                res.proposed_summary = proposeForAgent(req.target_agent_id);
            } catch (Exception e) {
                // The agent should report the problem conversationally, not fault.
                res.proposed_summary = 'Could not propose cases: ' + e.getMessage();
            }
            out.add(res);
        }
        return out;
    }

    private static String proposeForAgent(String agentId) {
        if (String.isBlank(agentId)) {
            throw new FleetException('A Fleet_Agent__c id is required.');
        }
        Fleet_Agent__c agent = [
            SELECT Id, Agent_API_Name__c
            FROM Fleet_Agent__c
            WHERE Id = :(Id) agentId
            WITH USER_MODE
            LIMIT 1
        ];

        // Utterances already curated for this agent, so the same turn is not
        // proposed twice on repeated invocations.
        Set<String> existing = new Set<String>();
        for (Golden_Case__c c : [
            SELECT Utterance__c
            FROM Golden_Case__c
            WHERE Fleet_Agent__c = :agent.Id
            WITH USER_MODE
        ]) {
            if (String.isNotBlank(c.Utterance__c)) {
                existing.add(c.Utterance__c);
            }
        }

        List<FleetTraceService.TraceView> traces = FleetTraceService.read(
            agent.Agent_API_Name__c,
            null,
            null,
            50
        );

        List<String> promoted = new List<String>();
        for (FleetTraceService.TraceView t : traces) {
            if (promoted.size() >= PROPOSE_LIMIT) {
                break;
            }
            if (String.isBlank(t.utterance) || existing.contains(t.utterance)) {
                continue;
            }
            promoteFromTrace(t.traceKey);
            existing.add(t.utterance);
            promoted.add(t.utterance);
        }

        if (promoted.isEmpty()) {
            return 'No new production turns were available to propose for ' +
                agent.Agent_API_Name__c +
                '. Every recent turn is already represented in the golden set.';
        }
        return 'Proposed ' +
            promoted.size() +
            ' golden case(s) for ' +
            agent.Agent_API_Name__c +
            ', each inactive until approved: ' +
            String.join(promoted, ' | ');
    }

    /** Input shape for creating or editing a golden case (React SDK / LWC). */
    public class GoldenCaseInput {
        @AuraEnabled
        public Id id;
        @AuraEnabled
        public Id agentId;
        @AuraEnabled
        public String caseKey;
        @AuraEnabled
        public String utterance;
        @AuraEnabled
        public Boolean active;
        @AuraEnabled
        public String source;
        @AuraEnabled
        public Decimal weight;
    }

    /** Read-model for the golden-set grid and case detail. */
    public class GoldenCaseView {
        @AuraEnabled
        public Id id;
        @AuraEnabled
        public Id agentId;
        @AuraEnabled
        public String caseKey;
        @AuraEnabled
        public String utterance;
        @AuraEnabled
        public Boolean active;
        @AuraEnabled
        public String source;
        @AuraEnabled
        public Datetime proposedAt;
        @AuraEnabled
        public String approvedBy;
        @AuraEnabled
        public String baselineVersion;
        @AuraEnabled
        public Decimal weight;
        @AuraEnabled
        public String lastResult;
        @AuraEnabled
        public Decimal consecutiveFailures;
        @AuraEnabled
        public Integer assertionCount;
    }

    private static final String CURATE_PERM = 'Fleet_Curate_Golden_Set';

    public static List<GoldenCaseView> getCases(Id agentId) {
        if (agentId == null) {
            throw new FleetException('An agent id is required to list golden cases.');
        }
        List<Golden_Case__c> rows = [
            SELECT
                Id,
                Fleet_Agent__c,
                Case_Key__c,
                Utterance__c,
                Active__c,
                Source__c,
                Proposed_At__c,
                Approved_By__c,
                Baseline_Version__c,
                Weight__c,
                Last_Result__c,
                Consecutive_Failures__c,
                (SELECT Id FROM Assertions__r)
            FROM Golden_Case__c
            WHERE Fleet_Agent__c = :agentId
            WITH USER_MODE
            ORDER BY Active__c DESC, Case_Key__c ASC
        ];
        List<GoldenCaseView> views = new List<GoldenCaseView>();
        for (Golden_Case__c c : rows) {
            views.add(toView(c));
        }
        return views;
    }

    /** Create or update a golden case. Requires Fleet_Curate_Golden_Set. */
    public static GoldenCaseView upsertCase(GoldenCaseInput input) {
        requireCurate();
        if (input == null) {
            throw new FleetException('A case payload is required.');
        }
        Golden_Case__c c;
        if (input.id != null) {
            c = loadCase(input.id);
        } else {
            c = new Golden_Case__c();
            c.Fleet_Agent__c = input.agentId;
            c.Case_Key__c = String.isNotBlank(input.caseKey) ? input.caseKey : newCaseKey(input.agentId);
            c.Source__c = String.isNotBlank(input.source) ? input.source : 'Curated';
        }
        if (input.utterance != null) {
            c.Utterance__c = input.utterance;
        }
        if (input.active != null) {
            c.Active__c = input.active;
        }
        if (input.weight != null) {
            c.Weight__c = input.weight;
        }
        upsert as user c;
        return toView(loadCase(c.Id));
    }

    /**
     * Approve an auto-proposed case, promoting it into the active set. Records the
     * approver for the audit trail. Requires Fleet_Curate_Golden_Set.
     */
    public static GoldenCaseView approveProposed(Id caseId) {
        requireCurate();
        Golden_Case__c c = loadCase(caseId);
        c.Active__c = true;
        c.Approved_By__c = UserInfo.getUserId();
        update as user c;
        return toView(loadCase(caseId));
    }

    /**
     * Turn a production turn into a golden case (§8.2). Reads the turn through
     * FleetTraceService so the same transcript enforcement applies, then seeds a
     * case sourced as Promoted_From_Production for the same agent.
     */
    public static GoldenCaseView promoteFromTrace(String traceKey) {
        requireCurate();
        if (String.isBlank(traceKey)) {
            throw new FleetException('A trace key is required to promote a case.');
        }
        FleetTraceService.TraceView trace = findTrace(traceKey);
        if (trace == null) {
            throw new FleetException('No trace found for key ' + traceKey);
        }
        Fleet_Agent__c agent = resolveAgent(trace.agentKey);
        Golden_Case__c c = new Golden_Case__c();
        c.Fleet_Agent__c = agent.Id;
        c.Case_Key__c = newCaseKey(agent.Id);
        c.Utterance__c = trace.utterance;
        c.Source__c = 'Promoted_From_Production';
        c.Active__c = false;
        c.Proposed_At__c = Datetime.now();
        insert as user c;
        return toView(loadCase(c.Id));
    }

    /** Deactivate a case without deleting it, preserving history. */
    public static GoldenCaseView deactivate(Id caseId) {
        requireCurate();
        Golden_Case__c c = loadCase(caseId);
        c.Active__c = false;
        update as user c;
        return toView(loadCase(caseId));
    }

    private static FleetTraceService.TraceView findTrace(String traceKey) {
        // The trace key encodes the agent key as a prefix "<agentKey>:<id>" when
        // promoted from the console; fall back to a broad-window read otherwise.
        String agentKey = traceKey.contains(':') ? traceKey.substringBefore(':') : null;
        if (agentKey != null) {
            return FleetTraceService.readByKey(agentKey, traceKey);
        }
        return null;
    }

    private static Fleet_Agent__c resolveAgent(String agentKey) {
        List<Fleet_Agent__c> agents = [
            SELECT Id, Agent_API_Name__c
            FROM Fleet_Agent__c
            WHERE Agent_API_Name__c = :agentKey
            WITH USER_MODE
            LIMIT 1
        ];
        if (agents.isEmpty()) {
            throw new FleetException('No Fleet_Agent__c matches agent key ' + agentKey);
        }
        return agents[0];
    }

    private static Golden_Case__c loadCase(Id caseId) {
        if (caseId == null) {
            throw new FleetException('A case id is required.');
        }
        List<Golden_Case__c> rows = [
            SELECT
                Id,
                Fleet_Agent__c,
                Case_Key__c,
                Utterance__c,
                Active__c,
                Source__c,
                Proposed_At__c,
                Approved_By__c,
                Baseline_Version__c,
                Weight__c,
                Last_Result__c,
                Consecutive_Failures__c,
                (SELECT Id FROM Assertions__r)
            FROM Golden_Case__c
            WHERE Id = :caseId
            WITH USER_MODE
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw new FleetException('Golden case not found or not accessible: ' + caseId);
        }
        return rows[0];
    }

    private static String newCaseKey(Id agentId) {
        String seed = (agentId == null ? 'GC' : String.valueOf(agentId).substring(0, 6));
        return 'GC-' + seed + '-' + Datetime.now().getTime();
    }

    private static void requireCurate() {
        if (!FeatureManagement.checkPermission(CURATE_PERM)) {
            throw new FleetException(
                'You do not have permission to curate the golden set. Requires ' + CURATE_PERM + '.'
            );
        }
    }

    private static GoldenCaseView toView(Golden_Case__c c) {
        GoldenCaseView v = new GoldenCaseView();
        v.id = c.Id;
        v.agentId = c.Fleet_Agent__c;
        v.caseKey = c.Case_Key__c;
        v.utterance = c.Utterance__c;
        v.active = c.Active__c;
        v.source = c.Source__c;
        v.proposedAt = c.Proposed_At__c;
        v.approvedBy = c.Approved_By__c;
        v.baselineVersion = c.Baseline_Version__c;
        v.weight = c.Weight__c;
        v.lastResult = c.Last_Result__c;
        v.consecutiveFailures = c.Consecutive_Failures__c;
        v.assertionCount = c.Assertions__r == null ? 0 : c.Assertions__r.size();
        return v;
    }
}
