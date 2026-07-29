/**
 * Fleet - tests for the CMDT configuration caches (CONTRACT §6, §8.1).
 */
@IsTest
private class FleetConfigurationServiceTest {
    @IsTest
    static void primedSettingIsReturnedAndCached() {
        Fleet_Setting__mdt primed = FleetTestFactory.buildSetting();
        FleetConfigurationService.primeSetting(primed);

        Fleet_Setting__mdt s = FleetConfigurationService.getSetting();
        System.assertEquals(0.15, s.Prefilter_Lower_Bound__c, 'Primed lower bound is served.');
        System.assertEquals(0.45, s.Prefilter_Upper_Bound__c, 'Primed upper bound is served.');
        System.assertEquals(80, s.Trueness_Threshold__c, 'Primed threshold is served.');

        // A second read returns the same cached instance, not a fresh query.
        System.assert(s === FleetConfigurationService.getSetting(), 'The setting is memoized within the transaction.');
    }

    @IsTest
    static void listGettersAreNonNullAndDoNotThrow() {
        Test.startTest();
        System.assertNotEquals(
            null,
            FleetConfigurationService.getAssertionTypes(),
            'Assertion types list is never null.'
        );
        System.assertNotEquals(null, FleetConfigurationService.getDetectors(), 'Detectors list is never null.');
        System.assertNotEquals(
            null,
            FleetConfigurationService.getSeverityPolicies(),
            'Severity policies list is never null.'
        );
        System.assertNotEquals(
            null,
            FleetConfigurationService.getChangeSources(),
            'Change sources list is never null.'
        );
        System.assertNotEquals(null, FleetConfigurationService.getViews(), 'Views list is never null.');
        System.assertNotEquals(
            null,
            FleetConfigurationService.getAssertionTypesByKey(),
            'Assertion-type index is never null.'
        );
        System.assertNotEquals(
            null,
            FleetConfigurationService.getSeverityPoliciesBySeverity(),
            'Severity index is never null.'
        );
        Test.stopTest();
    }
}
