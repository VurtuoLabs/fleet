/**
 * Fleet - agent registry facade. Reads the monitored-agent list for the console
 * and performs the state transitions (monitoring toggle, quarantine, release)
 * that carry a permission check. Every write goes through here, never GraphQL.
 */
public with sharing class FleetAgentService {
    /** Console filter, mapped from a Fleet_View__mdt saved view or ad-hoc controls. */
    public class AgentQuery {
        @AuraEnabled
        public String viewKey;
        @AuraEnabled
        public String status;
        @AuraEnabled
        public Boolean monitoringOnly;
        @AuraEnabled
        public String search;
        @AuraEnabled
        public Integer limitN;
    }

    /** Read-model for the agents grid and detail header. */
    public class AgentView {
        @AuraEnabled
        public Id id;
        @AuraEnabled
        public String name;
        @AuraEnabled
        public String agentApiName;
        @AuraEnabled
        public String botId;
        @AuraEnabled
        public String currentVersion;
        @AuraEnabled
        public String blessedVersion;
        @AuraEnabled
        public Decimal truenessScore;
        @AuraEnabled
        public String status;
        @AuraEnabled
        public Boolean monitoringEnabled;
        @AuraEnabled
        public String calibrationSchedule;
        @AuraEnabled
        public String ownerQueueId;
        @AuraEnabled
        public Datetime lastCalibratedAt;
        @AuraEnabled
        public Decimal consecutiveFailures;
        @AuraEnabled
        public Datetime quarantinedAt;
        @AuraEnabled
        public String quarantinedBy;
        /** True when trueness has fallen below Fleet_Setting__mdt.Trueness_Threshold__c. */
        @AuraEnabled
        public Boolean outOfTrue;
    }

    private static final List<String> AGENT_FIELDS = new List<String>{
        'Id',
        'Name',
        'Agent_API_Name__c',
        'Bot_Id__c',
        'Current_Version__c',
        'Blessed_Version__c',
        'Trueness_Score__c',
        'Status__c',
        'Monitoring_Enabled__c',
        'Calibration_Schedule__c',
        'Owner_Queue_Id__c',
        'Last_Calibrated_At__c',
        'Consecutive_Failures__c',
        'Quarantined_At__c',
        'Quarantined_By__c'
    };

    public static List<AgentView> getAgents(AgentQuery q) {
        AgentQuery query = (q == null) ? new AgentQuery() : q;
        List<String> clauses = new List<String>();
        Map<String, Object> binds = new Map<String, Object>();

        // A saved view resolves to a canonical filter so the console and the
        // scheduler agree on what "Quarantined" or "Out of True" means.
        String effectiveStatus = query.status;
        Boolean monitoringOnly = query.monitoringOnly == true;
        if (String.isNotBlank(query.viewKey)) {
            String vk = query.viewKey.toUpperCase();
            if (vk == 'QUARANTINED') {
                effectiveStatus = 'Quarantined';
            } else if (vk == 'MY_AGENTS') {
                clauses.add('OwnerId = :ownerId');
                binds.put('ownerId', UserInfo.getUserId());
            }
        }
        if (String.isNotBlank(effectiveStatus)) {
            clauses.add('Status__c = :statusVal');
            binds.put('statusVal', effectiveStatus);
        }
        if (monitoringOnly) {
            clauses.add('Monitoring_Enabled__c = true');
        }
        if (String.isNotBlank(query.search)) {
            clauses.add('(Name LIKE :searchVal OR Agent_API_Name__c LIKE :searchVal)');
            binds.put('searchVal', '%' + String.escapeSingleQuotes(query.search) + '%');
        }

        String soql = 'SELECT ' + String.join(AGENT_FIELDS, ', ') + ' FROM Fleet_Agent__c';
        if (!clauses.isEmpty()) {
            soql += ' WHERE ' + String.join(clauses, ' AND ');
        }
        soql += ' ORDER BY Trueness_Score__c ASC NULLS FIRST, Name ASC';
        Integer cap = (query.limitN == null || query.limitN <= 0) ? 200 : query.limitN;
        soql += ' LIMIT ' + cap;

        List<Fleet_Agent__c> rows = Database.queryWithBinds(soql, binds, AccessLevel.USER_MODE);
        Decimal threshold = FleetConfigurationService.getSetting().Trueness_Threshold__c;
        List<AgentView> views = new List<AgentView>();
        for (Fleet_Agent__c a : rows) {
            views.add(toView(a, threshold));
        }
        return views;
    }

    public static AgentView getAgent(Id agentId) {
        return toView(loadAgent(agentId), FleetConfigurationService.getSetting().Trueness_Threshold__c);
    }

    public static AgentView setMonitoring(Id agentId, Boolean enabled) {
        Fleet_Agent__c a = loadAgent(agentId);
        a.Monitoring_Enabled__c = enabled;
        update as user a;
        return getAgent(agentId);
    }

    /**
     * Quarantine an agent version. Gated on Fleet_Quarantine_Agent (§7.1). Records
     * who and when so the audit trail is intact; the declarative Bot deactivation
     * side effect is handled by Fleet_Quarantine_Agent_Flow at remediation time.
     */
    public static AgentView quarantine(Id agentId, String reason) {
        requirePermission('Fleet_Quarantine_Agent', 'quarantine an agent');
        Fleet_Agent__c a = loadAgent(agentId);
        a.Status__c = 'Quarantined';
        a.Monitoring_Enabled__c = false;
        a.Quarantined_At__c = Datetime.now();
        a.Quarantined_By__c = UserInfo.getUserId();
        update as user a;
        return getAgent(agentId);
    }

    /** Release a quarantined agent back to active monitoring. Same permission. */
    public static AgentView release(Id agentId) {
        requirePermission('Fleet_Quarantine_Agent', 'release an agent');
        Fleet_Agent__c a = loadAgent(agentId);
        a.Status__c = 'Active';
        a.Monitoring_Enabled__c = true;
        a.Quarantined_At__c = null;
        a.Quarantined_By__c = null;
        a.Consecutive_Failures__c = 0;
        update as user a;
        return getAgent(agentId);
    }

    private static Fleet_Agent__c loadAgent(Id agentId) {
        if (agentId == null) {
            throw new FleetException('An agent id is required.');
        }
        List<Fleet_Agent__c> rows = [
            SELECT
                Id,
                Name,
                Agent_API_Name__c,
                Bot_Id__c,
                Current_Version__c,
                Blessed_Version__c,
                Trueness_Score__c,
                Status__c,
                Monitoring_Enabled__c,
                Calibration_Schedule__c,
                Owner_Queue_Id__c,
                Last_Calibrated_At__c,
                Consecutive_Failures__c,
                Quarantined_At__c,
                Quarantined_By__c
            FROM Fleet_Agent__c
            WHERE Id = :agentId
            WITH USER_MODE
            LIMIT 1
        ];
        if (rows.isEmpty()) {
            throw new FleetException('Agent not found or not accessible: ' + agentId);
        }
        return rows[0];
    }

    private static void requirePermission(String perm, String action) {
        if (!FeatureManagement.checkPermission(perm)) {
            throw new FleetException('You do not have permission to ' + action + '. Requires ' + perm + '.');
        }
    }

    private static AgentView toView(Fleet_Agent__c a, Decimal threshold) {
        AgentView v = new AgentView();
        v.id = a.Id;
        v.name = a.Name;
        v.agentApiName = a.Agent_API_Name__c;
        v.botId = a.Bot_Id__c;
        v.currentVersion = a.Current_Version__c;
        v.blessedVersion = a.Blessed_Version__c;
        v.truenessScore = a.Trueness_Score__c;
        v.status = a.Status__c;
        v.monitoringEnabled = a.Monitoring_Enabled__c;
        v.calibrationSchedule = a.Calibration_Schedule__c;
        v.ownerQueueId = a.Owner_Queue_Id__c;
        v.lastCalibratedAt = a.Last_Calibrated_At__c;
        v.consecutiveFailures = a.Consecutive_Failures__c;
        v.quarantinedAt = a.Quarantined_At__c;
        v.quarantinedBy = a.Quarantined_By__c;
        v.outOfTrue = (threshold != null && a.Trueness_Score__c != null && a.Trueness_Score__c < threshold);
        return v;
    }
}
