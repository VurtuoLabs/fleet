/**
 * Fleet demo seed, step 3 - a calibration run with per-case results, the change
 * event that caused the drift, and the finding that attributes one to the other.
 *
 * The point of the demo is this chain: Sentinel's trueness drops, two golden
 * cases start failing, and the console can name the KB edit that did it.
 */
final String OWNER = 'Alex';
// Lookup(User) fields need a real User Id; the running user is Alex.
final Id OWNER_ID = UserInfo.getUserId();

Map<String, Fleet_Agent__c> agentByApiName = new Map<String, Fleet_Agent__c>();
for (Fleet_Agent__c a : [SELECT Id, Agent_API_Name__c, Trueness_Score__c FROM Fleet_Agent__c]) {
    agentByApiName.put(a.Agent_API_Name__c, a);
}
Fleet_Agent__c drifting = agentByApiName.get('Sentinel');

// ---- The change that caused the drift ---------------------------------------
Change_Event__c change = new Change_Event__c();
change.Change_Key__c = 'CHG-KB-SENTINEL-001';
change.Source__c = 'KNOWLEDGE';
change.Kind__c = 'Knowledge_Publish';
change.Label__c = 'Republished "Record health thresholds" KB article';
change.Actor__c = OWNER;
change.Occurred_At__c = System.now().addHours(-8);
change.Detail__c =
    'The 14-day staleness threshold was reworded, which removed the phrasing the ' +
    'record_health topic matched on. Published by ' + OWNER + '.';
change.Affected_Artifacts__c = 'Knowledge:record-health-thresholds;Topic:record_health';
change.Correlation_Window_Minutes__c = 240;
upsert change Change_Key__c;

// A second, innocent change inside the window, so attribution has to choose.
Change_Event__c noise = new Change_Event__c();
noise.Change_Key__c = 'CHG-DEPLOY-UNRELATED-002';
noise.Source__c = 'DEPLOY';
noise.Kind__c = 'Metadata_Deploy';
noise.Label__c = 'Deployed unrelated Flow change';
noise.Actor__c = OWNER;
noise.Occurred_At__c = System.now().addHours(-7);
noise.Detail__c = 'Unrelated to the agent; present so attribution has a decoy to reject.';
noise.Correlation_Window_Minutes__c = 240;
upsert noise Change_Key__c;

// ---- Calibration runs --------------------------------------------------------
List<Calibration_Run__c> runs = new List<Calibration_Run__c>();
for (String apiName : agentByApiName.keySet()) {
    Fleet_Agent__c a = agentByApiName.get(apiName);
    Integer total = [SELECT COUNT() FROM Golden_Case__c WHERE Fleet_Agent__c = :a.Id];
    if (total == 0) {
        continue;
    }
    Integer failed = (apiName == 'Sentinel') ? 2 : 0;

    Calibration_Run__c r = new Calibration_Run__c();
    r.Fleet_Agent__c = a.Id;
    r.Run_Key__c = 'RUN-' + apiName + '-001';
    r.Trigger_Source__c = (apiName == 'Sentinel') ? 'Change_Event' : 'Scheduled';
    r.Trigger_Change_Event__c = (apiName == 'Sentinel') ? change.Id : null;
    r.Started_At__c = System.now().addHours(-5);
    r.Completed_At__c = System.now().addHours(-5).addMinutes(4);
    r.Status__c = 'Completed';
    r.Cases_Total__c = total;
    r.Cases_Passed__c = total - failed;
    r.Cases_Failed__c = failed;
    r.Trueness_Score__c = a.Trueness_Score__c;
    r.Credits_Consumed__c = total * 3;
    r.Judge_Invocations__c = failed;
    r.Prefilter_Skips__c = total - failed;
    runs.add(r);
}
upsert runs Run_Key__c;
System.debug('Seeded runs: ' + runs.size());

// ---- Per-case results --------------------------------------------------------
Map<Id, Id> runIdByAgentId = new Map<Id, Id>();
for (Calibration_Run__c r : runs) {
    runIdByAgentId.put(r.Fleet_Agent__c, r.Id);
}

delete [SELECT Id FROM Case_Result__c];

List<Case_Result__c> results = new List<Case_Result__c>();
for (Golden_Case__c c : [
    SELECT Id, Fleet_Agent__c, Utterance__c, Last_Result__c, Case_Key__c
    FROM Golden_Case__c
]) {
    Id runId = runIdByAgentId.get(c.Fleet_Agent__c);
    if (runId == null) {
        continue;
    }
    Boolean failed = c.Last_Result__c == 'Fail';
    Case_Result__c cr = new Case_Result__c();
    cr.Calibration_Run__c = runId;
    cr.Golden_Case__c = c.Id;
    cr.Passed__c = !failed;
    cr.Deviation_Score__c = failed ? 0.62 : 0.04;
    cr.Response__c = failed
        ? 'I can help with that. Which team member did you mean?'
        : 'Here are the records most at risk for ' + OWNER + ', ordered by band.';
    cr.Topic_Selected__c = failed ? 'general' : 'record_health';
    cr.Topic_Confidence__c = failed ? 0.41 : 0.93;
    cr.Actions_Invoked__c = failed ? '' : 'Check_All';
    cr.Grounding_Sources__c = 'KB:agent-ops-01';
    cr.Latency_Ms__c = failed ? 5200 : 1450;
    cr.Credits__c = 3;
    cr.Judged__c = failed;
    cr.Trace_Key__c = 'TRC-Sentinel-1';
    cr.Failed_Assertions__c = failed
        ? '[{"assertionType":"MUST_ROUTE_TO","expected":"record_health","actual":"general","severity":"High"},' +
          '{"assertionType":"LATENCY_P95_MS","expected":"4000","actual":"5200","severity":"Medium"}]'
        : null;
    results.add(cr);
}
insert results;
System.debug('Seeded case results: ' + results.size());

// ---- The finding, attributed to the KB change --------------------------------
delete [SELECT Id FROM Deviation_Finding__c];

Deviation_Finding__c finding = new Deviation_Finding__c();
finding.Name = 'Routing drift on record health questions';
finding.Fleet_Agent__c = drifting.Id;
finding.Severity__c = 'High';
finding.State__c = 'Open';
finding.Headline__c = 'Sentinel stopped routing record-health questions to record_health';
finding.Detail__c =
    'Two golden cases that previously routed to the record_health topic now fall ' +
    'through to general, and answer with a clarifying question instead of acting. ' +
    'Topic confidence dropped from 0.93 to 0.41 and p95 latency rose past the ' +
    '4000ms ceiling. First observed on the run triggered by the KB republish.';
finding.Detector__c = 'STRUCTURAL_DRIFT';
finding.Attributed_Change__c = change.Id;
finding.Attribution_Confidence__c = 0.86;
finding.Cases_Failing__c = 2;
finding.Cases_Total__c = 4;
finding.Opened_At__c = System.now().addHours(-5);
insert finding;

// Grant the owning queue access through the product's own managed sharing path.
Integer shared = FleetSharingService.grantFindingAccess(new List<Deviation_Finding__c>{ finding });
System.debug('Finding shares granted: ' + shared);

// ---- A remediation awaiting approval ----------------------------------------
Remediation__c rem = new Remediation__c();
rem.Deviation_Finding__c = finding.Id;
rem.Action__c = 'Rollback_Version';
rem.Requested_By__c = OWNER_ID;
rem.Approval_State__c = 'Pending';
rem.Idempotency_Key__c = 'REM-SENTINEL-ROLLBACK-001';
rem.Before_State__c = '{"blessedVersion":"v1","currentVersion":"v1","truenessScore":61}';
insert rem;

System.debug('Fleet seed complete.');
