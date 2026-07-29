/**
 * Fleet - calibration run facade (CONTRACT §8.2, §8.3).
 *
 * Starting a run creates the Calibration_Run__c header and enqueues the
 * FleetCalibrationQueueable chain, which walks the golden set one case per job
 * for predictable credit burn. Blessing a run snapshots the current centroids
 * as the new baseline the judge compares against.
 */
public with sharing class FleetCalibrationService {
    /** Test isolation hook for the calibration chain (§8.3). */
    @TestVisible
    public static Boolean bypass = false;

    /** Request to start a run. */
    public class RunRequest {
        @AuraEnabled
        public Id agentId;
        @AuraEnabled
        public String triggerSource;
        @AuraEnabled
        public Id triggerChangeEventId;
    }

    /** Read-model for a run header. */
    public class RunView {
        @AuraEnabled
        public Id id;
        @AuraEnabled
        public Id agentId;
        @AuraEnabled
        public String runKey;
        @AuraEnabled
        public String triggerSource;
        @AuraEnabled
        public Id triggerChangeEventId;
        @AuraEnabled
        public Datetime startedAt;
        @AuraEnabled
        public Datetime completedAt;
        @AuraEnabled
        public String status;
        @AuraEnabled
        public Decimal casesTotal;
        @AuraEnabled
        public Decimal casesPassed;
        @AuraEnabled
        public Decimal casesFailed;
        @AuraEnabled
        public Decimal truenessScore;
        @AuraEnabled
        public Decimal creditsConsumed;
        @AuraEnabled
        public Decimal judgeInvocations;
        @AuraEnabled
        public Decimal prefilterSkips;
        @AuraEnabled
        public String error;
    }

    private static final Set<String> VALID_TRIGGERS = new Set<String>{
        'Scheduled',
        'Change_Event',
        'Manual',
        'CI_Gate'
    };

    /**
     * Start a calibration run. Requires Fleet_Run_Calibration. Persists the run
     * header, then enqueues the chain unless bypassed for a test.
     */
    public static Calibration_Run__c run(RunRequest r) {
        if (!FeatureManagement.checkPermission('Fleet_Run_Calibration')) {
            throw new FleetException(
                'You do not have permission to run a calibration. Requires Fleet_Run_Calibration.'
            );
        }
        if (r == null || r.agentId == null) {
            throw new FleetException('A target agent id is required to run a calibration.');
        }
        String triggerSrc = String.isBlank(r.triggerSource) ? 'Manual' : r.triggerSource;
        if (!VALID_TRIGGERS.contains(triggerSrc)) {
            throw new FleetException('Unknown trigger source: ' + triggerSrc);
        }
        Calibration_Run__c run = new Calibration_Run__c();
        run.Fleet_Agent__c = r.agentId;
        run.Run_Key__c = 'RUN-' + r.agentId + '-' + Datetime.now().getTime();
        run.Trigger_Source__c = triggerSrc;
        run.Trigger_Change_Event__c = r.triggerChangeEventId;
        run.Started_At__c = Datetime.now();
        run.Status__c = 'Queued';
        run.Cases_Total__c = 0;
        run.Cases_Passed__c = 0;
        run.Cases_Failed__c = 0;
        run.Judge_Invocations__c = 0;
        run.Prefilter_Skips__c = 0;
        insert as user run;

        if (!bypass) {
            // The chain reads runKey and a cursor, writing each Case_Result__c
            // before enqueuing the next so a mid-run failure leaves partial state.
            System.enqueueJob(new FleetCalibrationQueueable(run.Id, run.Run_Key__c, 0));
        }
        return run;
    }

    public static RunView getRun(Id runId) {
        if (runId == null) {
            throw new FleetException('A run id is required.');
        }
        List<Calibration_Run__c> rows = queryRuns('Id = :bindId', new Map<String, Object>{ 'bindId' => runId }, 1);
        if (rows.isEmpty()) {
            throw new FleetException('Run not found or not accessible: ' + runId);
        }
        return toView(rows[0]);
    }

    public static List<RunView> getRuns(Id agentId, Integer limitN) {
        if (agentId == null) {
            throw new FleetException('An agent id is required.');
        }
        Integer cap = (limitN == null || limitN <= 0) ? 25 : limitN;
        List<Calibration_Run__c> rows = queryRuns(
            'Fleet_Agent__c = :bindId',
            new Map<String, Object>{ 'bindId' => agentId },
            cap
        );
        List<RunView> views = new List<RunView>();
        for (Calibration_Run__c run : rows) {
            views.add(toView(run));
        }
        return views;
    }

    /**
     * Promote a completed run to the blessed baseline. Requires
     * Fleet_Bless_Baseline. Snapshots each active case's centroid reference and
     * stamps the agent's Blessed_Version__c with the run's current version (§8.2).
     */
    public static Fleet_Agent__c bless(Id runId) {
        if (!FeatureManagement.checkPermission('Fleet_Bless_Baseline')) {
            throw new FleetException('You do not have permission to bless a baseline. Requires Fleet_Bless_Baseline.');
        }
        Calibration_Run__c run = queryRuns('Id = :bindId', new Map<String, Object>{ 'bindId' => runId }, 1)[0];
        if (run.Status__c != 'Completed') {
            throw new FleetException('Only a completed run can be blessed. Current status: ' + run.Status__c);
        }
        List<Fleet_Agent__c> agents = [
            SELECT Id, Current_Version__c, Blessed_Version__c
            FROM Fleet_Agent__c
            WHERE Id = :run.Fleet_Agent__c
            WITH USER_MODE
            LIMIT 1
        ];
        if (agents.isEmpty()) {
            throw new FleetException('Agent for run not accessible.');
        }
        Fleet_Agent__c agent = agents[0];
        agent.Blessed_Version__c = agent.Current_Version__c;

        // Snapshot centroids: the current version becomes the baseline each active
        // case is judged against on subsequent runs.
        List<Golden_Case__c> cases = [
            SELECT Id, Baseline_Version__c, Baseline_Centroid_Ref__c
            FROM Golden_Case__c
            WHERE Fleet_Agent__c = :run.Fleet_Agent__c AND Active__c = TRUE
            WITH USER_MODE
        ];
        for (Golden_Case__c c : cases) {
            c.Baseline_Version__c = agent.Current_Version__c;
            c.Baseline_Centroid_Ref__c = run.Run_Key__c;
        }
        update as user agent;
        if (!cases.isEmpty()) {
            update as user cases;
        }
        return agent;
    }

    private static List<Calibration_Run__c> queryRuns(String whereClause, Map<String, Object> binds, Integer cap) {
        String soql =
            'SELECT Id, Fleet_Agent__c, Run_Key__c, Trigger_Source__c, Trigger_Change_Event__c, ' +
            'Started_At__c, Completed_At__c, Status__c, Cases_Total__c, Cases_Passed__c, Cases_Failed__c, ' +
            'Trueness_Score__c, Credits_Consumed__c, Judge_Invocations__c, Prefilter_Skips__c, Error__c ' +
            'FROM Calibration_Run__c WHERE ' +
            whereClause +
            ' ORDER BY Started_At__c DESC LIMIT ' +
            cap;
        return Database.queryWithBinds(soql, binds, AccessLevel.USER_MODE);
    }

    private static RunView toView(Calibration_Run__c run) {
        RunView v = new RunView();
        v.id = run.Id;
        v.agentId = run.Fleet_Agent__c;
        v.runKey = run.Run_Key__c;
        v.triggerSource = run.Trigger_Source__c;
        v.triggerChangeEventId = run.Trigger_Change_Event__c;
        v.startedAt = run.Started_At__c;
        v.completedAt = run.Completed_At__c;
        v.status = run.Status__c;
        v.casesTotal = run.Cases_Total__c;
        v.casesPassed = run.Cases_Passed__c;
        v.casesFailed = run.Cases_Failed__c;
        v.truenessScore = run.Trueness_Score__c;
        v.creditsConsumed = run.Credits_Consumed__c;
        v.judgeInvocations = run.Judge_Invocations__c;
        v.prefilterSkips = run.Prefilter_Skips__c;
        v.error = run.Error__c;
        return v;
    }
}
