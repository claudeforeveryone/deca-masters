import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../ui/Button";

type Props = { children: ReactNode; resetKey?: string };
type State = { error: Error | null };

/**
 * Catches a page that throws while rendering, most often a code chunk that no longer exists after a new deploy.
 * Moving to another route (a new resetKey) clears it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[page error]", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey)
      this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const stale =
      /dynamically imported module|importing a module script|failed to fetch/i.test(
        this.state.error.message,
      );
    return (
      <div role="alert" className="max-w-xl py-12">
        <h1 className="text-display">This page did not load</h1>
        <p className="mt-4 text-lg text-ink-2">
          {stale
            ? "The site was updated while this tab was open. Reload to get the new version."
            : "Something broke while showing this page. Reloading usually fixes it."}
        </p>
        <Button className="mt-8" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </div>
    );
  }
}
