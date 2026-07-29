/**
 * Fleet demo seed, step 1 - register the org's real Agentforce agents and give
 * each one a golden set with assertions.
 *
 * The agents are read from BotDefinition, so this monitors what is actually in
 * the org rather than inventing fictional bots. Owner of the demo data is Alex.
 *
 * Idempotent: re-running upserts on Agent_API_Name__c / Case_Key__c.
 */
final String OWNER = 'Alex';
// Lookup(User) fields need a real User Id; the running user is Alex.
final Id OWNER_ID = UserInfo.getUserId();

// The agents Fleet will monitor, in the order they should appear in the console.
Map<String, String> monitored = new Map<String, String>{
    'Sentinel' => 'Sentinel',
    'Scribe_Agent' => 'Scribe',
    'Codify_Agent' => 'Codify',
    'Huddle_Agent' => 'Huddle',
    'Coral_Cloud_Agent' => 'Coral Cloud Agent'
};

Map<String, Id> botIdByName = new Map<String, Id>();
for (BotDefinition b : [SELECT Id, DeveloperName FROM BotDefinition WHERE DeveloperName IN :monitored.keySet()]) {
    botIdByName.put(b.DeveloperName, b.Id);
}

// A queue that owns findings, so managed sharing has somewhere to grant to.
List<Group> queues = [SELECT Id FROM Group WHERE DeveloperName = 'Fleet_Finding_Owners' AND Type = 'Queue' LIMIT 1];
Id ownerQueueId = queues.isEmpty() ? null : queues[0].Id;

List<Fleet_Agent__c> agents = new List<Fleet_Agent__c>();
for (String apiName : monitored.keySet()) {
    Fleet_Agent__c a = new Fleet_Agent__c();
    a.Name = monitored.get(apiName);
    a.Agent_API_Name__c = apiName;
    a.Bot_Id__c = botIdByName.get(apiName);
    a.Current_Version__c = 'v1';
    a.Blessed_Version__c = 'v1';
    a.Monitoring_Enabled__c = true;
    a.Status__c = 'Active';
    a.Calibration_Schedule__c = '0 0 2 * * ?';
    a.Owner_Queue_Id__c = ownerQueueId;
    a.Last_Calibrated_At__c = System.now().addHours(-6);
    a.Consecutive_Failures__c = 0;

    // Sentinel is the agent that has drifted; everything else is in true. This is
    // what makes the console show a mixed fleet rather than a wall of green.
    if (apiName == 'Sentinel') {
        a.Trueness_Score__c = 61;
        a.Consecutive_Failures__c = 3;
    } else if (apiName == 'Coral_Cloud_Agent') {
        a.Trueness_Score__c = 78;
    } else {
        a.Trueness_Score__c = 94;
    }
    agents.add(a);
}
upsert agents Agent_API_Name__c;
System.debug('Seeded agents: ' + agents.size());

Map<String, Id> agentIdByApiName = new Map<String, Id>();
for (Fleet_Agent__c a : [SELECT Id, Agent_API_Name__c FROM Fleet_Agent__c]) {
    agentIdByApiName.put(a.Agent_API_Name__c, a.Id);
}

// ---- Golden cases -----------------------------------------------------------
// Utterances a real user of each agent would send. Alex is the person in them.
Map<String, List<String>> utterancesByAgent = new Map<String, List<String>>{
    'Sentinel' => new List<String>{
        'What should Alex work on first today?',
        'Show me the stale opportunities on Alex\'s team',
        'Which cases has Alex not touched in two weeks?',
        'Reassign Alex\'s aging leads to someone else'
    },
    'Scribe_Agent' => new List<String>{
        'Log Alex\'s call with Acme: they want pricing by Friday',
        'Alex spoke to the CFO, update the opportunity close date'
    },
    'Codify_Agent' => new List<String>{
        'Alex fixed this case by replacing the pump seal, write it up',
        'Draft a knowledge article from how Alex resolved this'
    },
    'Huddle_Agent' => new List<String>{
        'Log the deal review Alex ran on the Northwind renewal',
        'Alex agreed to bring in a sales engineer, capture the actions'
    },
    'Coral_Cloud_Agent' => new List<String>{ 'Book Alex a room for the Coral Cloud resort in June' }
};

List<Golden_Case__c> cases = new List<Golden_Case__c>();
for (String apiName : utterancesByAgent.keySet()) {
    Id agentId = agentIdByApiName.get(apiName);
    if (agentId == null) {
        continue;
    }
    Integer i = 0;
    for (String utterance : utterancesByAgent.get(apiName)) {
        Golden_Case__c c = new Golden_Case__c();
        c.Fleet_Agent__c = agentId;
        c.Case_Key__c = apiName + '-GC-' + i;
        c.Utterance__c = utterance;
        c.Active__c = true;
        c.Source__c = 'Curated';
        c.Approved_By__c = OWNER_ID;
        c.Baseline_Version__c = 'v1';
        c.Weight__c = 1;
        c.Exemplar_Count__c = 3;
        // The drifting agent's first two cases are the ones failing.
        Boolean failing = (apiName == 'Sentinel' && i < 2);
        c.Last_Result__c = failing ? 'Fail' : 'Pass';
        c.Consecutive_Failures__c = failing ? 3 : 0;
        cases.add(c);
        i++;
    }
}
upsert cases Case_Key__c;
System.debug('Seeded golden cases: ' + cases.size());

// ---- Assertions -------------------------------------------------------------
Map<String, Id> caseIdByKey = new Map<String, Id>();
for (Golden_Case__c c : [SELECT Id, Case_Key__c FROM Golden_Case__c]) {
    caseIdByKey.put(c.Case_Key__c, c.Id);
}

delete [SELECT Id FROM Assertion__c];

List<Assertion__c> assertions = new List<Assertion__c>();
for (String key : caseIdByKey.keySet()) {
    Id caseId = caseIdByKey.get(key);
    assertions.add(
        new Assertion__c(
            Golden_Case__c = caseId,
            Assertion_Type__c = 'MUST_ROUTE_TO',
            Expected_Value__c = key.startsWith('Sentinel') ? 'record_health' : 'primary',
            Comparator__c = 'equals',
            Severity_On_Fail__c = 'High',
            Active__c = true
        )
    );
    assertions.add(
        new Assertion__c(
            Golden_Case__c = caseId,
            Assertion_Type__c = 'LATENCY_P95_MS',
            Expected_Value__c = '4000',
            Comparator__c = 'lte',
            Tolerance__c = 500,
            Severity_On_Fail__c = 'Medium',
            Active__c = true
        )
    );
    assertions.add(
        new Assertion__c(
            Golden_Case__c = caseId,
            Assertion_Type__c = 'MUST_NOT_CONVEY',
            Expected_Value__c = 'I am unable to help with that',
            Comparator__c = 'contains',
            Severity_On_Fail__c = 'High',
            Active__c = true
        )
    );
}
insert assertions;
System.debug('Seeded assertions: ' + assertions.size());
