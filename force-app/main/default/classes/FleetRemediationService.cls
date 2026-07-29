/**
 * Fleet - remediation lifecycle facade (CONTRACT §8.2, §9.3, §10).
 *
 * propose → approve → execute. Approval is gated on Fleet_Approve_Remediation.
 * Execution is idempotent on Idempotency_Key__c so a retried job never fires the
 * same rollback twice, and dispatches either an Apex side effect or one of the
 * autolaunched Flows, which all take scalar inputs and return a single
 * resultMessage string (§9.3 flow contract).
 */
public with sharing class FleetRemediationService {
    /** Outcome of an approve or execute call. */
    public class RemediationResult {
        @AuraEnabled
        public Id remediationId;
        @AuraEnabled
        public Boolean success;
        @AuraEnabled
        public String approvalState;
        @AuraEnabled
        public String result;
        @AuraEnabled
        public String error;
        @AuraEnabled
        public String message;
        /** True when execute short-circuited because the action already ran. */
        @AuraEnabled
        public Boolean alreadyExecuted;
    }

    private static final List<String> REMEDIATION_FIELDS = new List<String>{
        'Id',
        'Deviation_Finding__c',
        'Action__c',
        'Requested_By__c',
        'Approval_State__c',
        'Approver__c',
        'Approved_At__c',
        'Before_State__c',
        'After_State__c',
        'Idempotency_Key__c',
        'Result__c',
        'Error__c'
    };

    /**
     * Propose a remediation for a finding. The default action is read from the
     * severity policy's Auto_Action__c so an admin controls the autonomy dial (§6).
     */
    public static Remediation__c propose(Id findingId) {
        if (findingId == null) {
            throw new FleetException('A finding id is required to propose a remediation.');
        }
        Deviation_Finding__c finding = [
            SELECT Id, Severity__c, Fleet_Agent__c, Headline__c
            FROM Deviation_Finding__c
            WHERE Id = :findingId
            WITH USER_MODE
            LIMIT 1
        ];
        Map<String, Fleet_Severity_Policy__mdt> policies = FleetConfigurationService.getSeverityPoliciesBySeverity();
        Fleet_Severity_Policy__mdt policy = policies.get(finding.Severity__c);
        String action = (policy != null && policy.Auto_Action__c != null) ? policy.Auto_Action__c : 'Notify';

        Remediation__c rem = new Remediation__c();
        rem.Deviation_Finding__c = findingId;
        rem.Action__c = action;
        rem.Requested_By__c = UserInfo.getUserId();
        // 'Notify' needs no approval; anything with a side effect starts Pending.
        rem.Approval_State__c = (action == 'Notify') ? 'Approved' : 'Pending';
        rem.Idempotency_Key__c = 'REM-' + findingId + '-' + action + '-' + Datetime.now().getTime();
        insert as user rem;
        return load(rem.Id);
    }

    /** Approve a remediation. Requires Fleet_Approve_Remediation (§7.1). */
    public static RemediationResult approve(Id remediationId) {
        if (!FeatureManagement.checkPermission('Fleet_Approve_Remediation')) {
            throw new FleetException(
                'You do not have permission to approve remediation. Requires Fleet_Approve_Remediation.'
            );
        }
        Remediation__c rem = load(remediationId);
        if (rem.Approval_State__c == 'Rejected') {
            throw new FleetException('A rejected remediation cannot be approved.');
        }
        rem.Approval_State__c = 'Approved';
        rem.Approver__c = UserInfo.getUserId();
        rem.Approved_At__c = Datetime.now();
        update as user rem;

        RemediationResult res = new RemediationResult();
        res.remediationId = rem.Id;
        res.success = true;
        res.approvalState = rem.Approval_State__c;
        res.message = 'Approved. Ready to execute.';
        return res;
    }

    public static Remediation__c reject(Id remediationId, String reason) {
        if (!FeatureManagement.checkPermission('Fleet_Approve_Remediation')) {
            throw new FleetException(
                'You do not have permission to reject remediation. Requires Fleet_Approve_Remediation.'
            );
        }
        Remediation__c rem = load(remediationId);
        rem.Approval_State__c = 'Rejected';
        rem.Approver__c = UserInfo.getUserId();
        rem.Approved_At__c = Datetime.now();
        rem.Error__c = reason;
        update as user rem;
        return load(remediationId);
    }

    /**
     * Execute an approved remediation. Idempotent on Idempotency_Key__c: if this
     * record already carries a Result__c the action has run, so we return the
     * prior outcome rather than firing the side effect again.
     */
    /** Terminal Result__c values. 'Pending' is the picklist default and is not one. */
    private static Boolean isTerminalResult(String result) {
        return result == 'Success' || result == 'Failed' || result == 'Skipped';
    }

    public static RemediationResult execute(Id remediationId) {
        Remediation__c rem = load(remediationId);
        RemediationResult res = new RemediationResult();
        res.remediationId = rem.Id;

        // Idempotency guard - the single most important property of this method.
        //
        // Result__c is a picklist whose default value is 'Pending', so a freshly
        // inserted remediation already carries a non-blank Result__c. Testing for
        // "not blank" here treated every new remediation as already executed, which
        // silently skipped the approval check below and meant no remediation ever
        // ran. Only a terminal result means the side effect actually fired.
        if (isTerminalResult(rem.Result__c)) {
            res.success = rem.Result__c == 'Success';
            res.result = rem.Result__c;
            res.error = rem.Error__c;
            res.alreadyExecuted = true;
            res.message = 'Already executed; returning prior result.';
            return res;
        }
        if (rem.Approval_State__c != 'Approved') {
            throw new FleetException('Remediation must be approved before execution. State: ' + rem.Approval_State__c);
        }

        try {
            String outcome = dispatch(rem);
            rem.Result__c = 'Success';
            rem.After_State__c = outcome;
            update as user rem;
            res.success = true;
            res.result = 'Success';
            res.message = outcome;
        } catch (Exception e) {
            rem.Result__c = 'Failed';
            rem.Error__c = e.getMessage();
            update as user rem;
            res.success = false;
            res.result = 'Failed';
            res.error = e.getMessage();
            res.message = 'Execution failed: ' + e.getMessage();
        }
        return res;
    }

    /** Route an action to its Apex or Flow handler (§10). */
    private static String dispatch(Remediation__c rem) {
        Deviation_Finding__c finding = [
            SELECT Id, Fleet_Agent__c, Severity__c, Headline__c
            FROM Deviation_Finding__c
            WHERE Id = :rem.Deviation_Finding__c
            WITH USER_MODE
            LIMIT 1
        ];
        switch on rem.Action__c {
            when 'Quarantine' {
                // Declarative Bot deactivation + fallback routing lives in the Flow so
                // an admin can edit who/how without a deploy (§9.3).
                return dispatchFlow(
                    'Fleet_Quarantine_Agent_Flow',
                    new Map<String, Object>{ 'agentId' => finding.Fleet_Agent__c, 'reason' => finding.Headline__c }
                );
            }
            when 'Rollback' {
                return dispatchFlow(
                    'Fleet_Rollback_Version_Flow',
                    new Map<String, Object>{
                        'agentId' => finding.Fleet_Agent__c,
                        'targetVersion' => rem.Before_State__c
                    }
                );
            }
            when 'Notify', 'Request_Approval' {
                return dispatchFlow(
                    'Fleet_Notify_Finding_Flow',
                    new Map<String, Object>{ 'findingId' => finding.Id, 'severity' => finding.Severity__c }
                );
            }
            when else {
                throw new FleetException('Unknown remediation action: ' + rem.Action__c);
            }
        }
    }

    /**
     * Invoke an autolaunched Flow by name and read its resultMessage output.
     * Every Fleet autolaunched flow honors this contract (§9.3): scalar inputs by
     * the exact names passed here, one resultMessage string out.
     */
    private static String dispatchFlow(String flowName, Map<String, Object> inputs) {
        Flow.Interview interview = Flow.Interview.createInterview(flowName, inputs);
        interview.start();
        Object msg = interview.getVariableValue('resultMessage');
        return msg == null ? ('Flow ' + flowName + ' completed.') : String.valueOf(msg);
    }

    private static Remediation__c load(Id remediationId) {
        if (remediationId == null) {
            throw new FleetException('A remediation id is required.');
        }
        String soql =
            'SELECT ' +
            String.join(REMEDIATION_FIELDS, ', ') +
            ' FROM Remediation__c WHERE Id = :remediationId LIMIT 1';
        List<Remediation__c> rows = Database.queryWithBinds(
            soql,
            new Map<String, Object>{ 'remediationId' => remediationId },
            AccessLevel.USER_MODE
        );
        if (rows.isEmpty()) {
            throw new FleetException('Remediation not found or not accessible: ' + remediationId);
        }
        return rows[0];
    }
}
