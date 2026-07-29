/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Selects the repository adapter: "mock" (default) or "salesforce". */
  readonly VITE_DATA_MODE?: "mock" | "salesforce";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Injected by the UI Bundle host at runtime. Absent under `npm run dev`,
 * so `basePath` is undefined and the router serves from "/".
 */
declare const SFDC_ENV:
  | {
      basePath?: string;
    }
  | undefined;
