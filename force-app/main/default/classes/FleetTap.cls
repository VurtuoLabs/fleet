/**
 * Fleet - the capture tap (CONTRACT §5).
 *
 * This is the half of the capture layer that was missing: the subscriber side
 * (FleetTurnTrigger → FleetTurnTriggerHandler → FleetTraceService) was complete,
 * but nothing published a Fleet_Turn__e in the first place, so a live agent
 * conversation produced no trace.
 *
 * A monitored agent invokes this as an Apex action once per turn. It publishes
 * PublishAfterCommit, so a failure to record can never roll back the agent's own
 * work - capture is an observer, never a participant.
 *
 * Attaching it to an agent is a per-agent change to that agent's own bundle: add
 * an action targeting apex://FleetTap and map the turn fields to these inputs.
 */
public with sharing class FleetTap {
    public class TurnRequest {
        @InvocableVariable(label='agent_api_name' description='API name of the monitored agent' required=true)
        public String agent_api_name;

        @InvocableVariable(label='session_key' description='Conversation/session identifier')
        public String session_key;

        @InvocableVariable(label='trace_key' description='Unique key for this turn; generated when blank')
        public String trace_key;

        @InvocableVariable(label='utterance' description='What the user said')
        public String utterance;

        @InvocableVariable(label='response' description='What the agent replied')
        public String response;

        @InvocableVariable(label='topic_selected' description='Topic the planner routed to')
        public String topic_selected;

        @InvocableVariable(label='topic_confidence' description='Confidence in the selected topic, 0-1')
        public Decimal topic_confidence;

        @InvocableVariable(label='topics_considered' description='Semicolon-separated topics weighed')
        public String topics_considered;

        @InvocableVariable(label='actions_invoked' description='Actions the agent invoked this turn')
        public String actions_invoked;

        @InvocableVariable(label='grounding_sources' description='Sources the answer was grounded in')
        public String grounding_sources;

        @InvocableVariable(label='model_version' description='Model version that served the turn')
        public String model_version;

        @InvocableVariable(label='latency_ms' description='End-to-end turn latency in milliseconds')
        public Decimal latency_ms;

        @InvocableVariable(label='credits' description='Credits consumed by the turn')
        public Decimal credits;
    }

    public class TurnResponse {
        @InvocableVariable(label='trace_key' description='The key this turn was archived under')
        public String trace_key;

        @InvocableVariable(label='captured' description='True when the turn was published for archiving')
        public Boolean captured;
    }

    @InvocableMethod(
        label='Fleet Capture Turn'
        description='Publish one agent turn to Fleet for archiving and calibration.'
        category='Fleet'
    )
    public static List<TurnResponse> capture(List<TurnRequest> requests) {
        List<TurnResponse> responses = new List<TurnResponse>();
        List<Fleet_Turn__e> events = new List<Fleet_Turn__e>();

        for (TurnRequest req : requests) {
            TurnResponse res = new TurnResponse();
            res.captured = false;

            if (String.isBlank(req.agent_api_name)) {
                // No agent means no chain to file the turn under. Report and move on
                // rather than throwing: capture must never break a conversation.
                res.trace_key = null;
                responses.add(res);
                continue;
            }

            String traceKey = String.isNotBlank(req.trace_key) ? req.trace_key : newTraceKey();
            Fleet_Turn__e e = new Fleet_Turn__e();
            e.Agent_API_Name__c = req.agent_api_name;
            e.Session_Key__c = req.session_key;
            e.Trace_Key__c = traceKey;
            e.Occurred_At__c = System.now();
            e.Utterance__c = req.utterance;
            e.Response__c = req.response;
            e.Topic_Selected__c = req.topic_selected;
            e.Topic_Confidence__c = req.topic_confidence;
            e.Topics_Considered__c = req.topics_considered;
            e.Actions_Invoked__c = req.actions_invoked;
            e.Grounding_Sources__c = req.grounding_sources;
            e.Model_Version__c = req.model_version;
            e.Latency_Ms__c = req.latency_ms;
            e.Credits__c = req.credits;
            events.add(e);

            res.trace_key = traceKey;
            res.captured = true;
            responses.add(res);
        }

        if (!events.isEmpty()) {
            EventBus.publish(events);
        }
        return responses;
    }

    /**
     * Trace keys must fit Fleet_Trace__b.Trace_Key__c, which is Text(35) because the
     * Big Object index has a 100-character text budget (CONTRACT §4). 'TRC-' plus an
     * epoch and a random suffix stays well inside it.
     */
    private static String newTraceKey() {
        return 'TRC-' +
            String.valueOf(System.now().getTime()) +
            '-' +
            String.valueOf(Math.abs(Crypto.getRandomInteger())).left(6);
    }
}
