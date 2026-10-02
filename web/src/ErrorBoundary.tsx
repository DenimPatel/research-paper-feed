import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

const SUMMARY = "The paper feed could not be displayed";
const EXPLANATION =
  "This page hit a bug while drawing the feed, so it cannot show anything. Reloading is the quickest way back. If it keeps happening, the site’s published paper data may be malformed; the exact cause is in the browser console.";
const RECOVERY = "Your saved collections are still stored in this browser.";

/**
 * React 18 has no function-component equivalent, so this stays a class. It is a
 * safety net for render-time throws, not a recovery path: the whole app is
 * gone for the reader, so recovery is a fresh document, which also discards the
 * payload that caused the throw.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  /**
   * React retries the failed subtree, so a page whose every card throws reaches
   * this hook once per card. Only the first catch is reported: the repeats are
   * the same root cause, and fifty identical lines bury the one that counts.
   */
  private reported = false;

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // React's own report of a caught error ("The above error occurred in…") is a
    // development-build behaviour, verified in Chromium against this repo's
    // production bundle: there the console carries the raw `TypeError` and
    // nothing else that names the component tree. This line is where that stack
    // survives, and the prefix keeps it identifiable as the boundary's own
    // report rather than one of the browser's uncaught-error lines.
    if (this.reported) {
      return;
    }
    this.reported = true;
    console.error(
      `paper feed: a render error escaped the app, so the whole page was replaced. ${
        error.stack ?? error.message
      }`,
      info.componentStack ?? "",
    );
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    const detail = `${error.name}: ${error.message}`;

    return (
      <div className="app">
        <main className="app__main" id="main">
          {/* `alert` is an author-named role, so the accessible name comes from
              `aria-label` — not from the visible text and not from `title`. The
              summary is the alert's own heading, so label-in-name holds. */}
          <div className="panel panel--error" role="alert" aria-label={SUMMARY}>
            <h1>{SUMMARY}</h1>
            {/* The cause is a tooltip and a console line, never the sentence a
                reader has to read — the convention every other failure surface
                in this app follows. */}
            <p title={detail}>{EXPLANATION}</p>
            <p>{RECOVERY}</p>
            <p>
              <button
                type="button"
                className="button"
                onClick={this.handleReload}
              >
                Reload the page
              </button>
            </p>
          </div>
        </main>
      </div>
    );
  }
}