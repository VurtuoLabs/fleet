/**
 * FleetSharingService (CONTRACT §7.4, §8.2)
 * -----------------------------------------
 * Apex managed sharing for the Private Deviation_Finding__c object.
 *
 * A fresh critical finding must be visible to the owning team the instant it is
 * opened. Criteria-based sharing rules recalculate asynchronously and would leave
 * that finding invisible during exactly the window that matters, so access is
 * granted programmatically with the `Fleet_Agent_Owner__c` Apex sharing reason.
 * Managed shares carrying a custom row cause cannot be deleted by end users, which
 * is what we want for an audit-adjacent record.
 */
public with sharing class FleetSharingService {
    @TestVisible
    private static final String ROW_CAUSE = 'Fleet_Agent_Owner__c';

    /**
     * Grant the owning queue of each finding's agent Edit access to that finding.
     * Returns the number of share rows successfully inserted.
     */
    public static Integer grantFindingAccess(List<Deviation_Finding__c> findings) {
        if (findings == null || findings.isEmpty()) {
            return 0;
        }

        Set<Id> findingIds = new Set<Id>();
        for (Deviation_Finding__c f : findings) {
            if (f.Id != null) {
                findingIds.add(f.Id);
            }
        }
        if (findingIds.isEmpty()) {
            return 0;
        }

        // Reload with the agent's owner queue - the passed records may not carry it.
        Map<Id, Id> findingToQueue = new Map<Id, Id>();
        for (Deviation_Finding__c f : [
            SELECT Id, Fleet_Agent__r.Owner_Queue_Id__c
            FROM Deviation_Finding__c
            WHERE Id IN :findingIds
            WITH USER_MODE
        ]) {
            String queueId = f.Fleet_Agent__r == null ? null : f.Fleet_Agent__r.Owner_Queue_Id__c;
            if (String.isNotBlank(queueId)) {
                findingToQueue.put(f.Id, (Id) queueId);
            }
        }

        List<Deviation_Finding__Share> shares = new List<Deviation_Finding__Share>();
        for (Id findingId : findingToQueue.keySet()) {
            shares.add(
                new Deviation_Finding__Share(
                    ParentId = findingId,
                    UserOrGroupId = findingToQueue.get(findingId),
                    AccessLevel = 'Edit',
                    RowCause = ROW_CAUSE
                )
            );
        }
        if (shares.isEmpty()) {
            return 0;
        }

        // allOrNone=false: a duplicate share row (re-grant) must not abort the batch.
        Integer granted = 0;
        for (Database.SaveResult sr : Database.insert(shares, false)) {
            if (sr.isSuccess()) {
                granted++;
            }
        }
        return granted;
    }

    /**
     * Remove the managed shares carrying the Fleet_Agent_Owner__c reason for the
     * given findings (e.g. when a finding is closed). Returns rows removed.
     */
    public static Integer revokeFindingAccess(Set<Id> findingIds) {
        if (findingIds == null || findingIds.isEmpty()) {
            return 0;
        }
        List<Deviation_Finding__Share> shares = [
            SELECT Id
            FROM Deviation_Finding__Share
            WHERE ParentId IN :findingIds AND RowCause = :ROW_CAUSE
        ];
        Integer removed = shares.size();
        if (!shares.isEmpty()) {
            delete shares;
        }
        return removed;
    }
}
