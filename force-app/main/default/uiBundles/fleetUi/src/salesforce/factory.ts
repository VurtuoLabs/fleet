import type { Repositories } from "./repositories";
import { MockRepositories } from "./mock/MockRepositories";
import { SalesforceRepositories } from "./salesforce/SalesforceRepositories";

/**
 * getRepositories() - the single place the adapter is chosen.
 *
 * VITE_DATA_MODE selects the implementation:
 *   "mock"        (default) → in-memory fixtures, no org required
 *   "salesforce"            → the platform-SDK adapter (GraphQL + Apex)
 *
 * The instance is memoized so in-session writes on the mock adapter persist
 * across hooks and re-renders. createDataSDK() is only invoked lazily inside
 * the Salesforce adapter's methods, so constructing it here is side-effect free.
 */

let instance: Repositories | null = null;

export function getRepositories(): Repositories {
  if (instance) return instance;

  const mode = import.meta.env?.VITE_DATA_MODE ?? "mock";
  instance =
    mode === "salesforce"
      ? new SalesforceRepositories()
      : new MockRepositories();
  return instance;
}

/** Reset the memoized instance. Test-only. */
export function __resetRepositories(): void {
  instance = null;
}
