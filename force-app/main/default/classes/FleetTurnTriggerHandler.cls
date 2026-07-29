/**
 * Fleet - handler for the Fleet_Turn__e platform-event trigger (CONTRACT §9.1).
 *
 * The thin trigger delegates here; this class does nothing but forward captured
 * turns to FleetTraceService.write, which persists them to the Fleet_Trace__b
 * archive. Keeping the logic out of the trigger body keeps it unit-testable and
 * lets the whole tap be bypassed for isolation.
 */
public with sharing class FleetTurnTriggerHandler {
    /**
     * Test/administration seam. When true the handler no-ops. Nothing in Fleet
     * flips this in production; it exists so unrelated tests that happen to publish
     * a Fleet_Turn__e do not incur an archive write.
     */
    @TestVisible
    private static Boolean bypass = false;

    /**
     * Forward the captured turns to the archive.
     *
     * The event fires PublishAfterCommit and Fleet is its only subscriber (§5), so
     * this list is exactly the turns Fleet's own tap emitted. FleetTraceService.write
     * runs the Big Object insert in system mode (documented exception #1, §9.1): a
     * user whose profile lacks Fleet access must never make an agent conversation
     * fail. This handler adds no sharing decisions of its own.
     *
     * @param turns Trigger.new from the Fleet_Turn__e after-insert context
     * @return number of archive rows written
     */
    public static Integer handleAfterInsert(List<Fleet_Turn__e> turns) {
        if (bypass || turns == null || turns.isEmpty()) {
            return 0;
        }
        return FleetTraceService.write(turns);
    }
}
