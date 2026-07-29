import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. A thrown render error inside a UI Bundle otherwise
 * blanks the whole Lightning region; here we catch it and offer a reload so the
 * console degrades to a readable panel instead of an empty shell.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("Fleet console error:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground">
          <h1 className="font-head text-lg font-semibold text-foreground">
            Something went out of true
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The console hit an unexpected error and stopped rendering this view.
          </p>
          <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
            {error.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <Button onClick={this.reset}>Try again</Button>
            <Button variant="neutral" onClick={() => window.location.reload()}>
              Reload console
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
