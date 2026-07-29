/**
 * Fleet - the one test data builder for the package (CONTRACT §8.1, §12).
 *
 * @IsTest only: it must never be reachable from production code. Every builder
 * returns an UNSAVED sObject with valid, spec-aligned defaults (required fields,
 * unique external ids, valid picklist values) so a test can tweak a field and
 * insert, or use the *WithInsert / graph helpers when it just needs rows to exist.
 *
 * Master-detail parents are wired explicitly: an Assertion needs a Golden_Case,
 * a Golden_Case needs a Fleet_Agent, a Case_Result needs a Calibration_Run, a
 * Remediation needs a Deviation_Finding. Pass the parent id in.
 */
@IsTest
public class FleetTestFactory {
    // Monotonic counter so external-id / unique fields never collide within a run.
    private static Integer seq = 0;

    private static String uniq(String prefix) {
        seq++;
        return prefix + '-' + String.valueOf(Datetime.now().getTime()) + '-' + String.valueOf(seq);
    }

    // ---------------------------------------------------------------- Fleet_Agent__c
    public static Fleet_Agent__c newAgent() {
        return newAgent('Support Bot ' + seq);
    }

    public static Fleet_Agent__c newAgent(String name) {
        seq++;
        return new Fleet_Agent__c(
            Name = name,
            Agent_API_Name__c = 'support_bot_' + seq,
            Bot_Id__c = '0Xx' + String.valueOf(seq).leftPad(12, '0'),
            Current_Version__c = 'v3',
            Blessed_Version__c = 'v2',
            Trueness_Score__c = 92,
            Status__c = 'Healthy',
            Monitoring_Enabled__c = true,
            Calibration_Schedule__c = '0 0 2 * * ?',
            Consecutive_Failures__c = 0
        );
    }

    public static Fleet_Agent__c insertAgent() {
        Fleet_Agent__c a = newAgent();
        insert a;
        return a;
    }

    // --------------------------------------------------------------- Golden_Case__c
    public static Golden_Case__c newGoldenCase(Id agentId) {
        return new Golden_Case__c(
            Fleet_Agent__c = agentId,
            Case_Key__c = uniq('GC'),
            Utterance__c = 'How do I reset my password?',
            Active__c = true,
            Source__c = 'Curated',
            Baseline_Version__c = 'v2',
            Exemplar_Count__c = 5,
            Weight__c = 1,
            Last_Result__c = 'Not_Run',
            Consecutive_Failures__c = 0
        );
    }

    public static Golden_Case__c insertGoldenCase(Id agentId) {
        Golden_Case__c gc = newGoldenCase(agentId);
        insert gc;
        return gc;
    }

    // ----------------------------------------------------------------- Assertion__c
    public static Assertion__c newAssertion(Id goldenCaseId) {
        return new Assertion__c(
            Golden_Case__c = goldenCaseId,
            Assertion_Type__c = 'MUST_ROUTE_TO',
            Expected_Value__c = 'Password_Reset',
            Comparator__c = 'Equals',
            Tolerance__c = 0,
            Severity_On_Fail__c = 'High',
            Active__c = true
        );
    }

    public static Assertion__c insertAssertion(Id goldenCaseId) {
        Assertion__c a = newAssertion(goldenCaseId);
        insert a;
        return a;
    }

    // ------------------------------------------------------------ Calibration_Run__c
    public static Calibration_Run__c newRun(Id agentId) {
        return new Calibration_Run__c(
            Fleet_Agent__c = agentId,
            Run_Key__c = uniq('RUN'),
            Trigger_Source__c = 'Manual',
            Started_At__c = Datetime.now(),
            Status__c = 'Queued',
            Cases_Total__c = 0,
            Cases_Passed__c = 0,
            Cases_Failed__c = 0,
            Judge_Invocations__c = 0,
            Prefilter_Skips__c = 0,
            Credits_Consumed__c = 0
        );
    }

    public static Calibration_Run__c insertRun(Id agentId) {
        Calibration_Run__c r = newRun(agentId);
        insert r;
        return r;
    }

    // --------------------------------------------------------------- Case_Result__c
    public static Case_Result__c newCaseResult(Id runId, Id goldenCaseId) {
        return new Case_Result__c(
            Calibration_Run__c = runId,
            Golden_Case__c = goldenCaseId,
            Passed__c = true,
            Deviation_Score__c = 0.05,
            Response__c = 'To reset your password, open Settings and choose Reset.',
            Topic_Selected__c = 'Password_Reset',
            Topic_Confidence__c = 0.94,
            Actions_Invoked__c = 'LookupAccount',
            Grounding_Sources__c = 'KB:pw-reset-01',
            Latency_Ms__c = 820,
            Credits__c = 3,
            Judged__c = false,
            Trace_Key__c = uniq('TRC')
        );
    }

    public static Case_Result__c insertCaseResult(Id runId, Id goldenCaseId) {
        Case_Result__c cr = newCaseResult(runId, goldenCaseId);
        insert cr;
        return cr;
    }

    // ---------------------------------------------------------- Deviation_Finding__c
    public static Deviation_Finding__c newFinding(Id agentId) {
        return new Deviation_Finding__c(
            Name = 'Routing drift on password reset',
            Fleet_Agent__c = agentId,
            Severity__c = 'High',
            State__c = 'Open',
            Headline__c = 'Routing drift on password reset',
            Detail__c = 'Cases that previously routed to Password_Reset now route to General.',
            Detector__c = 'STRUCTURAL_DRIFT',
            Attribution_Confidence__c = 0.0,
            Cases_Failing__c = 3,
            Cases_Total__c = 12,
            Opened_At__c = Datetime.now()
        );
    }

    public static Deviation_Finding__c insertFinding(Id agentId) {
        Deviation_Finding__c f = newFinding(agentId);
        insert f;
        return f;
    }

    // --------------------------------------------------------------- Remediation__c
    public static Remediation__c newRemediation(Id findingId) {
        return new Remediation__c(
            Deviation_Finding__c = findingId,
            Action__c = 'Rollback_Version',
            Requested_By__c = UserInfo.getUserId(),
            Approval_State__c = 'Pending',
            Idempotency_Key__c = uniq('REM'),
            Before_State__c = '{"blessedVersion":"v2"}',
            After_State__c = '{"blessedVersion":"v2"}'
        );
    }

    public static Remediation__c insertRemediation(Id findingId) {
        Remediation__c r = newRemediation(findingId);
        insert r;
        return r;
    }

    // --------------------------------------------------------------- Change_Event__c
    public static Change_Event__c newChangeEvent() {
        return new Change_Event__c(
            Change_Key__c = uniq('CHG'),
            Source__c = 'PROMPT',
            Kind__c = 'Prompt_Edit',
            Label__c = 'Edited routing instructions',
            Actor__c = UserInfo.getUserId(),
            Occurred_At__c = Datetime.now(),
            Detail__c = 'Reworded the password topic routing hint.',
            Affected_Artifacts__c = 'Fleet_Judge_v1',
            Correlation_Window_Minutes__c = 120
        );
    }

    public static Change_Event__c insertChangeEvent() {
        Change_Event__c c = newChangeEvent();
        insert c;
        return c;
    }

    // ------------------------------------------------------- Fleet_User_Preference__c
    public static Fleet_User_Preference__c newPreference() {
        return new Fleet_User_Preference__c(
            User__c = UserInfo.getUserId(),
            Default_View__c = 'ALL_AGENTS',
            Density__c = 'Comfortable',
            Theme__c = 'light',
            Notification_Settings__c = '{"email":true}',
            Preferred_Categories__c = 'Critical;High'
        );
    }

    public static Fleet_User_Preference__c insertPreference() {
        Fleet_User_Preference__c p = newPreference();
        insert p;
        return p;
    }

    // ------------------------------------------------------ Big Object write stub
    /**
     * Stand-in for the Fleet_Trace__b write. Apex test context cannot write to Big
     * Object storage, so tests install this to exercise FleetTraceService.write's
     * field mapping and return count without the DML. Rows are kept so a test can
     * assert on what would have been persisted.
     */
    public class StubTraceWriter implements FleetTraceService.TraceWriter {
        public List<Fleet_Trace__b> captured = new List<Fleet_Trace__b>();
        public Integer persist(List<Fleet_Trace__b> rows) {
            captured.addAll(rows);
            return rows.size();
        }
    }

    /** Install the stub writer and hand it back for assertions. */
    public static StubTraceWriter stubTraceWriter() {
        StubTraceWriter stub = new StubTraceWriter();
        FleetTraceService.writer = stub;
        return stub;
    }

    // --------------------------------------------------------------- Fleet_Turn__e
    // Platform event: built in memory and published with EventBus.publish, never DML-inserted.
    public static Fleet_Turn__e newTurn(String agentApiName) {
        return new Fleet_Turn__e(
            Agent_API_Name__c = agentApiName,
            Session_Key__c = uniq('SES'),
            Trace_Key__c = uniq('TRC'),
            Occurred_At__c = Datetime.now(),
            Utterance__c = 'How do I reset my password?',
            Response__c = 'Open Settings and choose Reset.',
            Topic_Selected__c = 'Password_Reset',
            Topic_Confidence__c = 0.94,
            Topics_Considered__c = 'Password_Reset;General',
            Actions_Invoked__c = 'LookupAccount',
            Grounding_Sources__c = 'KB:pw-reset-01',
            Prompt_Versions__c = 'sys:v4',
            Model_Version__c = 'gpt-x-2026',
            Latency_Ms__c = 820,
            Credits__c = 3,
            Trust_Flags__c = '',
            Variables_Set__c = '{"authenticated":true}',
            Run_Key__c = ''
        );
    }

    // --------------------------------------------------------------- Fleet_Trace__b
    // Big Object: built in memory, persisted only through FleetTraceService (§4).
    public static Fleet_Trace__b newTrace(String agentApiName) {
        return new Fleet_Trace__b(
            Org_Agent_Key__c = agentApiName,
            Occurred_At__c = Datetime.now(),
            Trace_Key__c = uniq('TRC'),
            Utterance__c = 'How do I reset my password?',
            Response__c = 'Open Settings and choose Reset.',
            Topic_Selected__c = 'Password_Reset',
            Topic_Confidence__c = 0.94,
            Topics_Considered__c = 'Password_Reset;General',
            Actions_Invoked__c = 'LookupAccount',
            Grounding_Sources__c = 'KB:pw-reset-01',
            Prompt_Versions__c = 'sys:v4',
            Model_Version__c = 'gpt-x-2026',
            Latency_Ms__c = 820,
            Credits__c = 3,
            Trust_Flags__c = '',
            Session_Key__c = uniq('SES'),
            Run_Key__c = ''
        );
    }

    // ------------------------------------------------------------------- Config seed
    /**
     * A fully-populated in-memory Fleet_Setting__mdt for priming
     * FleetConfigurationService in tests that must not depend on deployed CMDT.
     */
    public static Fleet_Setting__mdt buildSetting() {
        return new Fleet_Setting__mdt(
            DeveloperName = 'Default',
            Monitoring_Enabled__c = true,
            Default_Schedule_Cron__c = '0 0 2 * * ?',
            Judge_Template_Name__c = 'Fleet_Judge_v1',
            Prefilter_Lower_Bound__c = 0.15,
            Prefilter_Upper_Bound__c = 0.45,
            Max_Cases_Per_Run__c = 20,
            Trueness_Threshold__c = 80,
            Retention_Days_Case_Result__c = 90,
            Retention_Days_Trace__c = 395,
            Auto_Curation_Enabled__c = false,
            Auto_Curation_Cron__c = '0 0 3 * * ?',
            CI_Gate_Enabled__c = false
        );
    }

    // ------------------------------------------------------------- Graph convenience
    /** One agent with an active golden case carrying a single assertion. Returns the case. */
    public static Golden_Case__c insertAgentWithCase() {
        Fleet_Agent__c a = insertAgent();
        Golden_Case__c gc = insertGoldenCase(a.Id);
        insert newAssertion(gc.Id);
        return gc;
    }

    // ---------------------------------------------------- Permission grant utilities
    /**
     * Create a minimal user for permission-matrix tests (§12). No Fleet custom
     * permissions are granted; assign them explicitly with grantCustomPermissions.
     */
    public static User newStandardUser() {
        Profile p = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        String nonce = String.valueOf(Datetime.now().getTime()) + String.valueOf(seq++);
        return new User(
            ProfileId = p.Id,
            LastName = 'Fleet',
            Email = 'fleet.tester@example.com',
            Username = 'fleet.tester.' + nonce + '@fleet.test',
            Alias = 'flt' + Math.mod(seq, 1000),
            TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US'
        );
    }

    public static User insertStandardUser() {
        User u = newStandardUser();
        insert u;
        return u;
    }

    /**
     * A System Administrator user for positive permission-gated tests: it already
     * has object CRUD/FLS, so granting a Fleet custom permission on top lets the
     * gated service call run under System.runAs without depending on the product's
     * own permission sets. Custom permissions still are NOT auto-granted, so pair
     * with grantCustomPermissions.
     */
    public static User newAdminUser() {
        Profile p = [SELECT Id FROM Profile WHERE Name = 'System Administrator' LIMIT 1];
        String nonce = String.valueOf(Datetime.now().getTime()) + String.valueOf(seq++);
        return new User(
            ProfileId = p.Id,
            LastName = 'FleetAdmin',
            Email = 'fleet.admin@example.com',
            Username = 'fleet.admin.' + nonce + '@fleet.test',
            Alias = 'fadm' + Math.mod(seq, 100),
            TimeZoneSidKey = 'America/Los_Angeles',
            LocaleSidKey = 'en_US',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US'
        );
    }

    public static User insertAdminUser() {
        User u = newAdminUser();
        insert u;
        return u;
    }

    /**
     * Assign one of the product's own permission sets by API name. Used where a
     * test needs a realistic seat (object access and FLS) but specifically NOT the
     * custom permissions a higher seat would carry. Call inside System.runAs(admin).
     */
    public static void assignPermissionSet(Id userId, String permSetName) {
        PermissionSet ps = [SELECT Id FROM PermissionSet WHERE Name = :permSetName LIMIT 1];
        insert new PermissionSetAssignment(AssigneeId = userId, PermissionSetId = ps.Id);
    }

    /**
     * Grant a set of Fleet custom permissions to a user by creating a throwaway
     * permission set, linking each CustomPermission through SetupEntityAccess, and
     * assigning it. This depends only on the CustomPermission metadata (§7.1)
     * existing in the org, never on the product's own permission sets, so it works
     * in isolation. Call inside System.runAs(adminUser) and before startTest.
     */
    public static void grantCustomPermissions(Id userId, Set<String> permApiNames) {
        if (permApiNames == null || permApiNames.isEmpty()) {
            return;
        }
        PermissionSet ps = new PermissionSet(
            Name = 'Fleet_Test_Grant_' + String.valueOf(Datetime.now().getTime()) + String.valueOf(seq++),
            Label = 'Fleet Test Grant'
        );
        insert ps;

        List<CustomPermission> perms = [
            SELECT Id, DeveloperName
            FROM CustomPermission
            WHERE DeveloperName IN :permApiNames
        ];
        List<SetupEntityAccess> access = new List<SetupEntityAccess>();
        for (CustomPermission cp : perms) {
            access.add(new SetupEntityAccess(ParentId = ps.Id, SetupEntityId = cp.Id));
        }
        if (!access.isEmpty()) {
            insert access;
        }
        insert new PermissionSetAssignment(AssigneeId = userId, PermissionSetId = ps.Id);
    }
}
