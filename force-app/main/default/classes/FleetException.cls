/**
 * Fleet - the single custom exception type for the package (CONTRACT §8.1).
 *
 * Every service, batch, queueable, and trigger handler throws FleetException for
 * a domain-level failure (missing config, absent permission, bad input) so the
 * React facade can distinguish an expected Fleet error from an unexpected system
 * fault. Never throw a bare Exception or DmlException past a service boundary.
 */
public class FleetException extends Exception {
}
