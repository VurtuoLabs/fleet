import { Providers } from "./providers";
import { AppRoutes } from "./routes";
import { ErrorBoundary } from "./error-boundary";

/**
 * The Fleet console root. Providers (TanStack Query + theme + router) wrap the
 * route table; the error boundary keeps a render failure from blanking the
 * whole Lightning region.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <AppRoutes />
      </Providers>
    </ErrorBoundary>
  );
}
