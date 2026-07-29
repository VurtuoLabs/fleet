import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/design-system/theme";
import { QUERY_GC_TIME_MS, QUERY_STALE_TIME_MS } from "@/lib/constants";

/**
 * Reads the base path the UI Bundle host serves from. Inside the org the bundle
 * lives at /app/c__fleetUi, injected via globalThis.SFDC_ENV.basePath; standalone
 * `npm run dev` has no SFDC_ENV, so basename is undefined and the app serves
 * from "/" (CONTRACT.md §11.1). Never hardcode a domain-root path.
 */
function resolveBasename(): string | undefined {
  const env = (globalThis as { SFDC_ENV?: { basePath?: string } }).SFDC_ENV;
  return env?.basePath || undefined;
}

export function Providers({ children }: { children: ReactNode }) {
  // One client per app instance; created lazily so it survives re-renders.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: QUERY_STALE_TIME_MS,
            gcTime: QUERY_GC_TIME_MS,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter basename={resolveBasename()}>{children}</BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
