/**
 * Fleet demo seed, step 0 - the queue that owns deviation findings.
 *
 * Deviation_Finding__c is Private (CONTRACT §7.4) and access is granted by Apex
 * managed sharing to the queue named in Fleet_Agent__c.Owner_Queue_Id__c. Without
 * a queue there is nothing to share to, so FleetSharingService grants zero rows
 * and the demo silently shows an unshared finding.
 *
 * Group and QueueSobject are setup objects, so this runs alone in its own
 * transaction to avoid MIXED_DML_OPERATION.
 */
List<Group> existing = [
    SELECT Id
    FROM Group
    WHERE DeveloperName = 'Fleet_Finding_Owners' AND Type = 'Queue'
    LIMIT 1
];

Id queueId;
if (existing.isEmpty()) {
    Group q = new Group(Name = 'Fleet Finding Owners', DeveloperName = 'Fleet_Finding_Owners', Type = 'Queue');
    insert q;
    queueId = q.Id;
    System.debug('Created queue: ' + queueId);
} else {
    queueId = existing[0].Id;
    System.debug('Queue already present: ' + queueId);
}

// A queue can only hold shares for objects it is enabled for.
List<QueueSobject> supported = [
    SELECT Id
    FROM QueueSobject
    WHERE QueueId = :queueId AND SobjectType = 'Deviation_Finding__c'
];
if (supported.isEmpty()) {
    insert new QueueSobject(QueueId = queueId, SobjectType = 'Deviation_Finding__c');
    System.debug('Queue enabled for Deviation_Finding__c.');
}

// Alex is the member who will receive the shared findings.
List<GroupMember> member = [SELECT Id FROM GroupMember WHERE GroupId = :queueId AND UserOrGroupId = :UserInfo.getUserId()];
if (member.isEmpty()) {
    insert new GroupMember(GroupId = queueId, UserOrGroupId = UserInfo.getUserId());
    System.debug('Added Alex to the finding owners queue.');
}
