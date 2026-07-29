/**
 * Fleet — tap on the agent-turn stream (CONTRACT §9.1).
 *
 * after insert on Fleet_Turn__e only. Thin by design: it delegates to
 * FleetTurnTriggerHandler.handleAfterInsert, which forwards to
 * FleetTraceService.write. That write runs in system mode (documented system-mode
 * exception #1, §9.1) because a user whose profile lacks Fleet access must never
 * cause an agent conversation to fail. No other logic belongs in this body.
 */
trigger FleetTurnTrigger on Fleet_Turn__e(after insert) {
    FleetTurnTriggerHandler.handleAfterInsert(Trigger.new);
}
