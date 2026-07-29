/**
 * Fleet - tests for the capture tap (CONTRACT §5).
 *
 * The tap is the entry point a live agent calls, so the cases that matter are:
 * it publishes, it generates a trace key that fits the Big Object index column,
 * and a malformed call is reported rather than thrown into the conversation.
 */
@IsTest
private class FleetTapTest {
    private static FleetTap.TurnRequest turnFor(String agentApiName) {
        FleetTap.TurnRequest req = new FleetTap.TurnRequest();
        req.agent_api_name = agentApiName;
        req.session_key = 'SES-1';
        req.utterance = 'What should Alex work on first?';
        req.response = 'Here are the records most at risk for Alex.';
        req.topic_selected = 'record_health';
        req.topic_confidence = 0.93;
        req.topics_considered = 'record_health;general';
        req.actions_invoked = 'Check_All';
        req.grounding_sources = 'KB:agent-ops-01';
        req.model_version = 'atlas-2026-06';
        req.latency_ms = 1450;
        req.credits = 3;
        return req;
    }

    @IsTest
    static void capturePublishesATurnAndReturnsItsTraceKey() {
        FleetTap.TurnRequest req = turnFor('support_bot_a');

        Test.startTest();
        List<FleetTap.TurnResponse> out = FleetTap.capture(new List<FleetTap.TurnRequest>{ req });
        Test.stopTest();

        System.assertEquals(1, out.size(), 'One response per request.');
        System.assertEquals(true, out[0].captured, 'A well-formed turn is captured.');
        System.assertNotEquals(null, out[0].trace_key, 'The caller is told the key its turn was filed under.');
    }

    @IsTest
    static void generatedTraceKeyFitsTheBigObjectIndexColumn() {
        List<FleetTap.TurnResponse> out = FleetTap.capture(
            new List<FleetTap.TurnRequest>{ turnFor('support_bot_a') }
        );
        // Fleet_Trace__b.Trace_Key__c is Text(35); a longer key silently truncates
        // or fails on write, and the index cannot be changed after first deploy.
        System.assert(
            out[0].trace_key.length() <= 35,
            'Generated trace key must fit Text(35), was ' + out[0].trace_key.length()
        );
    }

    @IsTest
    static void aSuppliedTraceKeyIsHonoured() {
        FleetTap.TurnRequest req = turnFor('support_bot_a');
        req.trace_key = 'TRC-CALLER-SUPPLIED-1';

        List<FleetTap.TurnResponse> out = FleetTap.capture(new List<FleetTap.TurnRequest>{ req });

        System.assertEquals('TRC-CALLER-SUPPLIED-1', out[0].trace_key, 'A caller-supplied key is not replaced.');
    }

    @IsTest
    static void aTurnWithoutAnAgentIsReportedNotThrown() {
        FleetTap.TurnRequest req = turnFor(null);

        List<FleetTap.TurnResponse> out = FleetTap.capture(new List<FleetTap.TurnRequest>{ req });

        System.assertEquals(false, out[0].captured, 'A turn with no agent cannot be filed.');
        System.assertEquals(null, out[0].trace_key, 'No key is issued for an uncapturable turn.');
    }

    @IsTest
    static void aBatchCapturesEveryValidTurnAndSkipsTheInvalidOne() {
        List<FleetTap.TurnRequest> reqs = new List<FleetTap.TurnRequest>{
            turnFor('support_bot_a'),
            turnFor(null),
            turnFor('support_bot_b')
        };

        Test.startTest();
        List<FleetTap.TurnResponse> out = FleetTap.capture(reqs);
        Test.stopTest();

        System.assertEquals(3, out.size(), 'Every request gets a response, in order.');
        System.assertEquals(true, out[0].captured, 'The first valid turn is captured.');
        System.assertEquals(false, out[1].captured, 'One bad turn does not stop the batch.');
        System.assertEquals(true, out[2].captured, 'The turn after the bad one is still captured.');
    }
}
