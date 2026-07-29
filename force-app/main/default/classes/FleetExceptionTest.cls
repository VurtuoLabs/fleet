/**
 * Fleet - tests for the package exception type (CONTRACT §8.1).
 */
@IsTest
private class FleetExceptionTest {
    @IsTest
    static void carriesMessageAndIsCatchableAsFleetException() {
        Boolean caught = false;
        try {
            throw new FleetException('boom');
        } catch (FleetException e) {
            caught = true;
            System.assertEquals('boom', e.getMessage(), 'The message should round-trip.');
        }
        System.assert(caught, 'A FleetException must be catchable as its own type.');
    }

    @IsTest
    static void isCatchableAsGenericException() {
        Boolean caught = false;
        try {
            throw new FleetException('generic');
        } catch (Exception e) {
            caught = true;
            System.assert(e instanceof FleetException, 'It is still a FleetException when caught as Exception.');
        }
        System.assert(caught, 'A FleetException is a subclass of Exception.');
    }
}
