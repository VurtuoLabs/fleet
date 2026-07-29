/**
 * Fleet demo seed, step 2 - the captured turn archive.
 *
 * Runs in its own transaction on purpose. Fleet_Trace__b is a Big Object and
 * Database.insertImmediate behaves like a callout: it fails with "pending
 * uncommitted work" if any ordinary DML has already run in the transaction.
 * So the trace archive is seeded first and alone.
 */
List<Fleet_Turn__e> turns = new List<Fleet_Turn__e>();

Map<String, List<String>> script = new Map<String, List<String>>{
    'Sentinel' => new List<String>{
        'What should Alex work on first today?|Here are the records most at risk for Alex, ordered by band.|record_health',
        'Show me the stale opportunities on Alex\'s team|I can help with that. Which team member?|general',
        'Which cases has Alex not touched in two weeks?|Three cases are past the 14-day threshold for Alex.|record_health',
        'Reassign Alex\'s aging leads to someone else|Confirm the leads by name and I will reassign them.|triage'
    },
    'Scribe_Agent' => new List<String>{
        'Log Alex\'s call with Acme: they want pricing by Friday|Logged. I updated the opportunity and created a follow-up task for Alex.|log_call'
    },
    'Codify_Agent' => new List<String>{
        'Alex fixed this case by replacing the pump seal, write it up|Resolution captured and a draft article is ready for Alex to review.|capture_resolution'
    },
    'Huddle_Agent' => new List<String>{
        'Log the deal review Alex ran on the Northwind renewal|Strategy logged against the opportunity with three actions for Alex.|log_huddle'
    }
};

Integer n = 0;
for (String agent : script.keySet()) {
    for (String row : script.get(agent)) {
        List<String> parts = row.split('\\|');
        // The second Sentinel turn is the drifted one: it fell through to the
        // general topic and answered with a clarifying question instead of acting.
        Boolean drifted = (agent == 'Sentinel' && parts[2] == 'general');
        Fleet_Turn__e t = new Fleet_Turn__e();
        t.Agent_API_Name__c = agent;
        t.Session_Key__c = 'SES-ALEX-' + agent;
        t.Trace_Key__c = 'TRC-' + agent.left(10) + '-' + n;
        t.Occurred_At__c = System.now().addHours(-n);
        t.Utterance__c = parts[0];
        t.Response__c = parts[1];
        t.Topic_Selected__c = parts[2];
        t.Topic_Confidence__c = drifted ? 0.41 : 0.93;
        t.Topics_Considered__c = parts[2] + ';general';
        t.Actions_Invoked__c = drifted ? '' : 'Check_All';
        t.Grounding_Sources__c = 'KB:agent-ops-01';
        t.Prompt_Versions__c = 'sys:v4';
        t.Model_Version__c = 'atlas-2026-06';
        t.Latency_Ms__c = drifted ? 5200 : 1450;
        t.Credits__c = drifted ? 6 : 3;
        t.Trust_Flags__c = '';
        t.Run_Key__c = '';
        turns.add(t);
        n++;
    }
}

Integer written = FleetTraceService.write(turns);
System.debug('Seeded trace rows: ' + written);
