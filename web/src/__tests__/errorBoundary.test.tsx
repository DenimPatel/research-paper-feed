import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../ErrorBoundary";
import mainSource from "../main.tsx?raw";
import type { Paper } from "../lib/types";

const SUMMARY = "The paper feed could not be displayed";

function Thrower({ error }: { error: Error }): ReactNode {
  throw error;
}

function BrokenPaperCard(): ReactNode {
  // The crash this boundary exists for: a Paper that reached the renderer
  // without an `abstract`, so the read at PaperCard.tsx:50 throws.
  const paper = {
    id: "2401.00001",
    title: "A Paper Missing Its Abstract",
    authors: ["Ada Lovelace"],
    categories: [],
  } as unknown as Paper;
  return <p>{paper.abstract.length}</p>;
}

const CRASH = new TypeError(
  "Cannot read properties of undefined (reading 'length')",
);

let reload: ReturnType<typeof vi.fn>;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  reload = vi.fn();
  // jsdom's `location` refuses `defineProperty`, so `vi.spyOn` cannot be used
  // here; replacing the global is the only seam `window.location.reload()` has.
  vi.stubGlobal("location", { reload, href: "http://localhost/" });
  consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>the feed rendered fine</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("the feed rendered fine")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("replaces the tree with an alert when a child throws during render", () => {
    render(
      <ErrorBoundary>
        <Thrower error={CRASH} />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(within(alert).getByRole("heading", { name: SUMMARY })).toBeDefined();
  });

  it("catches the crash a Paper missing an abstract would cause", () => {
    render(
      <ErrorBoundary>
        <BrokenPaperCard />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByText("undefined")).toBeNull();
  });

  it("names the alert for a reader instead of naming it after the crash", () => {
    render(
      <ErrorBoundary>
        <Thrower error={CRASH} />
      </ErrorBoundary>,
    );

    // `alert` is an author-named role: with only `title` present its name would
    // be the technical string — the defect IMP-017 found and fixed on the two
    // alert regions that already exist.
    expect(screen.getByRole("alert", { name: SUMMARY })).toBeDefined();
  });

  it("keeps the crash detail out of the visible copy but in the tooltip", () => {
    render(
      <ErrorBoundary>
        <Thrower error={CRASH} />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    const visible = alert.textContent ?? "";
    expect(visible).toContain(SUMMARY);
    expect(visible).toContain("Reloading is the quickest way back.");
    expect(visible).not.toContain("TypeError");
    expect(visible).not.toContain("reading 'length'");
    expect(visible).not.toContain(" at ");

    const titles = Array.from(alert.querySelectorAll("[title]")).map(
      (node) => node.getAttribute("title") ?? "",
    );
    expect(titles).toContain(
      "TypeError: Cannot read properties of undefined (reading 'length')",
    );
  });

  it("logs the crash to the console with the cause and the component stack", () => {
    render(
      <ErrorBoundary>
        <Thrower error={CRASH} />
      </ErrorBoundary>,
    );

    const lines = consoleError.mock.calls.map((call) =>
      call.map((part) => String(part)).join(" "),
    );
    const boundaryLine = lines.find((line) =>
      line.startsWith("paper feed: a render error escaped the app"),
    );
    expect(boundaryLine).toBeDefined();
    expect(boundaryLine).toContain("TypeError");
    expect(boundaryLine).toContain("reading 'length'");
    expect(lines.some((line) => line.includes("Thrower"))).toBe(true);
  });

  it("reports the crash once even when every sibling throws", () => {
    render(
      <ErrorBoundary>
        <Thrower error={CRASH} />
        <Thrower error={CRASH} />
        <Thrower error={CRASH} />
      </ErrorBoundary>,
    );

    const boundaryLines = consoleError.mock.calls
      .map((call) => String(call[0]))
      .filter((line) =>
        line.startsWith("paper feed: a render error escaped the app"),
      );
    // React retries the failed subtree and reaches the hook once per failing
    // sibling. Fifty identical lines would bury the one that counts; React's own
    // development log still reports every occurrence.
    expect(boundaryLines).toHaveLength(1);
  });

  it("offers a labelled reload control that is a real button", () => {
    render(
      <ErrorBoundary>
        <Thrower error={CRASH} />
      </ErrorBoundary>,
    );

    const button = screen.getByRole("button", { name: "Reload the page" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    // A native button is what makes this keyboard reachable; a `tabIndex` of -1
    // would mean it is not, so assert the default is left alone.
    expect(button.tabIndex).toBe(0);
  });

  it("reloads the page when the reload control is activated", () => {
    render(
      <ErrorBoundary>
        <Thrower error={CRASH} />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reload the page" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("leaves exactly one alert behind, so nothing is announced twice", () => {
    render(
      <ErrorBoundary>
        <p className="banner banner--error" role="alert">
          Some papers could not be loaded
        </p>
        <Thrower error={CRASH} />
      </ErrorBoundary>,
    );

    // Every other alert in the app lives inside the subtree the boundary
    // replaces, so the fallback is the only live region a reader hears.
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toContain(SUMMARY);
  });

  it("is mounted as the immediate parent of the app inside StrictMode", () => {
    expect(mainSource).toMatch(/<StrictMode>\s*<ErrorBoundary>/);
    expect(mainSource).toMatch(/<ErrorBoundary>\s*<App \/>\s*<\/ErrorBoundary>/);
  });
});