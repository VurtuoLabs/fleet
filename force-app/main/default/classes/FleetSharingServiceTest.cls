/**
 * Fleet - tests for Apex managed sharing on findings (CONTRACT §7.4, §12).
 *
 * Deviation_Finding__c is Private. grantFindingAccess must write a
 * Deviation_Finding__Share row with the Fleet_Agent_Owner__c Apex sharing reason
 * to the agent's owner queue, so the owning team can see a fresh critical finding
 * immediately rather than after an async sharing-rule recalculation.
 *
 * Depends on the FleetSharingService facade (§8.2) and the Fleet_Agent_Owner__c
 * sharing reason declared on Deviation_Finding__c.
 */
@IsTest
private class FleetSharingServiceTest {
    @IsTest
    static void grantInsertsManagedShareToTheOwnerQueue() {
        // Group (queue) is a setup object - isolate its DML to avoid MIXED_DML.
        Group ownerQueue;
        System.runAs(new User(Id = UserInfo.getUserId())) {
            ownerQueue = new Group(Name = 'Fleet Finding Owners', Type = 'Queue');
            insert ownerQueue;
            // A queue can only hold shares for objects it is enabled for.
            insert new QueueSobject(QueueId = ownerQueue.Id, SobjectType = 'Deviation_Finding__c');
        }

        Fleet_Agent__c agent = FleetTestFactory.newAgent();
        agent.Owner_Queue_Id__c = ownerQueue.Id;
        insert agent;
        Deviation_Finding__c finding = FleetTestFactory.insertFinding(agent.Id);

        Test.startTest();
        Integer granted = FleetSharingService.grantFindingAccess(new List<Deviation_Finding__c>{ finding });
        Test.stopTest();

        System.assert(granted > 0, 'grantFindingAccess inserts at least one managed share row.');

        List<Deviation_Finding__Share> shares = [
            SELECT Id, UserOrGroupId, RowCause
            FROM Deviation_Finding__Share
            WHERE ParentId = :finding.Id AND RowCause = 'Fleet_Agent_Owner__c'
        ];
        System.assert(!shares.isEmpty(), 'A share row carries the Fleet_Agent_Owner__c Apex sharing reason.');
        System.assertEquals(ownerQueue.Id, shares[0].UserOrGroupId, 'Access is granted to the agent owner queue.');
    }

    @IsTest
    static void revokeRemovesManagedShare() {
        Group ownerQueue;
        System.runAs(new User(Id = UserInfo.getUserId())) {
            ownerQueue = new Group(Name = 'Fleet Finding Owners 2', Type = 'Queue');
            insert ownerQueue;
        }
        Fleet_Agent__c agent = FleetTestFactory.newAgent();
        agent.Owner_Queue_Id__c = ownerQueue.Id;
        insert agent;
        Deviation_Finding__c finding = FleetTestFactory.insertFinding(agent.Id);
        FleetSharingService.grantFindingAccess(new List<Deviation_Finding__c>{ finding });

        Test.startTest();
        FleetSharingService.revokeFindingAccess(new Set<Id>{ finding.Id });
        Test.stopTest();

        Integer remaining = [
            SELECT COUNT()
            FROM Deviation_Finding__Share
            WHERE ParentId = :finding.Id AND RowCause = 'Fleet_Agent_Owner__c'
        ];
        System.assertEquals(0, remaining, 'revokeFindingAccess removes the managed share.');
    }
}
