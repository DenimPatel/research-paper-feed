import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { PAPERS_KEY } from "../lib/collections";
import type { IndexManifest, Paper } from "../lib/types";

function makePaper(id: string, title: string, published: string): Paper {
  return {
    id,
    title,
    authors: ["Ada Lovelace"],
    abstract: "An abstract long enough to preview.",
    abstractTruncated: false,
    published,
    updated: published,
    categories: ["cs.CV"],
    primaryCategory: "cs.CV",
    absUrl: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
  };
}

const W10_PAPER = makePaper("2401.00003", "A Paper From The Newest Week", "2024-03-05");
const W09_PAPER = makePaper("2401.00001", "A Paper From The Middle Week", "2024-03-01");
const W08_PAPER = makePaper("2401.00002", "A Paper From The Oldest Week", "2024-02-20");

const W10 = {
  week: "2024-W10",
  from: "2024-03-04",
  to: "2024-03-10",
  count: 1,
  file: "papers-2024-W10.json",
};
const W09 = {
  week: "2024-W09",
  from: "2024-02-26",
  to: "2024-03-03",
  count: 1,
  file: "papers-2024-W09.json",
};
const W08 = {
  week: "2024-W08",
  from: "2024-02-19",
  to: "2024-02-25",
  count: 1,
  file: "papers-2024-W08.json",
};

const MANIFEST: IndexManifest = {
  generatedAt: "2024-03-10T00:00:00Z",
  retentionDays: 60,
  categories: ["cs.CV"],
  shards: [W10, W09, W08],
  totalPapers: 3,
};

const SHARD_BODIES: Record<string, unknown> = {
  "papers-2024-W10.json": {
    week: "2024-W10",
    from: "2024-03-04",
    to: "2024-03-10",
    papers: [W10_PAPER],
  },
  "papers-2024-W09.json": {
    week: "2024-W09",
    from: "2024-02-26",
    to: "2024-03-03",
    papers: [W09_PAPER],
  },
  "papers-2024-W08.json": {
    week: "2024-W08",
    from: "2024-02-19",
    to: "2024-02-25",
    papers: [W08_PAPER],
  },
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function notFound(): Response {
  return new Response("not found", { status: 404 });
}

/** The SPA fallback a static host serves for a missing index file. */
function htmlFallback(): Response {
  return new Response("<!doctype html><title>fallback</title>", {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

interface FetchLog {
  indexRequests: number;
  shardRequests: string[];
}

/**
 * Answers `index.json` with the manifest, 404s every shard named by `failing()`,
 * and serves the rest. `failing` is a thunk so a test can heal the window between
 * two loads: `loadPapers` caches nothing for a shard that failed, so a recovered
 * week has to show up without a page reload.
 */
function installFetch(
  failing: () => string[],
  manifest: IndexManifest = MANIFEST,
  bodies: Record<string, unknown> = SHARD_BODIES,
): FetchLog {
  const log: FetchLog = { indexRequests: 0, shardRequests: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/index.json")) {
        log.indexRequests += 1;
        return jsonResponse(manifest);
      }
      const file = url.split("/").pop() ?? "";
      log.shardRequests.push(file);
      if (failing().includes(file) || !(file in bodies)) {
        return notFound();
      }
      return jsonResponse(bodies[file]);
    }),
  );
  return log;
}

/** The index itself is unreachable, which is the state IMP-007 owns. */
function installFetchWithoutIndex(): FetchLog {
  const log: FetchLog = { indexRequests: 0, shardRequests: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/index.json")) {
        log.indexRequests += 1;
        return htmlFallback();
      }
      log.shardRequests.push(url.split("/").pop() ?? "");
      return notFound();
    }),
  );
  return log;
}

/**
 * jsdom 29 hands back a `window.localStorage` whose `setItem` is not a function
 * (`App.storage.test.tsx:42-50` records the same finding), so `detectStorage()`
 * reports "no storage" and the save effect never runs. A real `Storage` that
 * refuses the papers key is what makes IMP-011's banner reachable here, so both
 * alerts can be on screen at once.
 */
class FullStorage implements Storage {
  readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    if (key === PAPERS_KEY) {
      throw new DOMException("quota", "QuotaExceededError");
    }
    this.store.set(key, value);
  }
}

let originalLocalStorage: PropertyDescriptor | undefined;

function useFullStorage(): void {
  originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: new FullStorage(),
  });
}

/** The hard paper-load failure, identified by its copy rather than by position. */
function failurePanel(): HTMLElement {
  const matches = screen
    .getAllByRole("alert")
    .filter((node) => /Papers could not be loaded/.test(node.textContent ?? ""));
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one load-failure panel, found ${matches.length}`,
    );
  }
  return matches[0];
}

function tryAgain(): HTMLElement {
  return within(failurePanel()).getByRole("button", { name: /try again/i });
}

/**
 * One save the reader caused, which is the only thing that arms IMP-011's
 * notice — the mount run has nothing to write, so a failure has to be provoked
 * by an action. Without it this file would be asserting a first-visit scare
 * rather than the two notices coexisting. Returns to the feed, so the caller
 * counts them in the view the load failure is rendered in.
 */
async function saveSomething(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: /^Collections/ }));
  fireEvent.change(await screen.findByLabelText("New collection name"), {
    target: { value: "Vision" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create collection" }));
  await screen.findByRole("heading", { name: /^Vision/ });
  fireEvent.click(screen.getByRole("button", { name: "Feed" }));
  await screen.findByText(/Papers could not be loaded/);
}

beforeEach(() => {
  window.location.hash = "";
});

afterEach(() => {
  if (originalLocalStorage) {
    Object.defineProperty(window, "localStorage", originalLocalStorage);
    originalLocalStorage = undefined;
  }
  vi.unstubAllGlobals();
});

/**
 * Every shard in the window is unreachable. The load rejects (IMP-015 AC3), so
 * `papers` is `[]` and `error` is set — the state that used to fall through to
 * the "no papers are available" empty message.
 */
describe("a window where no shard could be loaded", () => {
  it("never claims the window is empty", async () => {
    installFetch(() => ["papers-2024-W10.json", "papers-2024-W09.json", "papers-2024-W08.json"]);

    const { container } = render(<App />);
    await screen.findByRole("alert");

    // The false claim, verbatim from the pre-fix copy. This is the defect: the
    // feed was telling the reader the index had nothing for the window when the
    // request is what had nothing.
    expect(
      screen.queryByText("No papers are available in this window yet."),
    ).toBeNull();
    expect(container.querySelector(".empty")).toBeNull();
    expect(container.querySelector(".paper-list")).toBeNull();
    expect(container.querySelectorAll("article.paper")).toHaveLength(0);
  });

  it("names the failure and says it is not an empty window", async () => {
    installFetch(() => ["papers-2024-W10.json", "papers-2024-W09.json", "papers-2024-W08.json"]);

    render(<App />);
    await screen.findByText(/Papers could not be loaded/);
    const panel = failurePanel();

    expect(panel.textContent).toMatch(/not an empty window/i);
    // The raw `Error.message` this used to render — IMP-017 replaced it with a
    // sentence a reader can act on. A file name, an HTTP status and the loader's
    // own "Failed to load" phrasing are all barred from the visible text.
    expect(panel.textContent).toMatch(/paper data could not be fetched/i);
    expect(panel.textContent).not.toMatch(/papers-2024-W10\.json/);
    expect(panel.textContent).not.toMatch(/HTTP/);
    expect(panel.textContent).not.toMatch(/Failed to load/);
    // Nothing here may suggest the papers are absent rather than unfetched.
    expect(panel.textContent).not.toMatch(/no papers are available/i);
  });

  it("keeps the technical cause on the element that carries the sentence", async () => {
    const logged: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      logged.push(args.map(String).join(" "));
    });

    try {
      installFetch(() => [
        "papers-2024-W10.json",
        "papers-2024-W09.json",
        "papers-2024-W08.json",
      ]);

      render(<App />);
      await screen.findByText(/Papers could not be loaded/);

      // The file name and the status are not shown, but they are not lost: the
      // element carrying the reader-facing sentence says what it was, and the
      // console keeps the thrown cause for whoever is debugging a deploy with no
      // mouse to hover with.
      const titled = within(failurePanel()).getByTitle(
        "Failed to load papers-2024-W10.json (HTTP 404).",
      );
      expect(titled.tagName).toBe("P");
      expect(titled.textContent).toMatch(/paper data could not be fetched/i);
      expect(logged.join("\n")).toMatch(/Failed to load papers-2024-W10\.json/);
      expect(logged.join("\n")).toMatch(/HTTP 404/);
    } finally {
      spy.mockRestore();
    }
  });

  it("offers a discoverable Try again, reusing the established panel and button", async () => {
    installFetch(() => ["papers-2024-W10.json", "papers-2024-W09.json", "papers-2024-W08.json"]);

    render(<App />);
    await screen.findByRole("alert");

    const button = tryAgain();
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.textContent).toBe("Try again");
    // The same treatment IMP-007's index-unavailable panel established, so the
    // two failure states look like one feature and no `styles.css` rule was
    // needed for either.
    const panel = failurePanel();
    expect(panel.className).toContain("panel");
    expect(panel.className).toContain("panel--error");
    expect(button.className).toContain("button");
    // A bare warning banner was all this state had before, and it is what made
    // the state look like a notice rather than a dead end.
    expect(panel.className).not.toContain("banner");
  });

  it("recovers into the feed when Try again is clicked, with no reload", async () => {
    let healthy = false;
    installFetch(() =>
      healthy ? [] : ["papers-2024-W10.json", "papers-2024-W09.json", "papers-2024-W08.json"],
    );

    render(<App />);
    await screen.findByRole("alert");
    expect(screen.queryByText(W09_PAPER.title)).toBeNull();

    healthy = true;
    fireEvent.click(tryAgain());

    expect(await screen.findByText(W09_PAPER.title)).toBeTruthy();
    expect(screen.getByText(W10_PAPER.title)).toBeTruthy();
    expect(screen.getByText(W08_PAPER.title)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("shows the loading status while the retry is in flight", async () => {
    let healthy = false;
    installFetch(() =>
      healthy ? [] : ["papers-2024-W10.json", "papers-2024-W09.json", "papers-2024-W08.json"],
    );

    render(<App />);
    await screen.findByRole("alert");

    healthy = true;
    fireEvent.click(tryAgain());

    // A retry the user cannot see happening is a retry they will click twice.
    // `getByRole("status")` is ambiguous here — the result count in the toolbar
    // is one too — so the loading line is matched by its own copy.
    expect(screen.getByText(/Loading papers from/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findByText(W09_PAPER.title)).toBeTruthy();
  });

  it("retries the shards without re-requesting the index", async () => {
    let healthy = false;
    const log = installFetch(() =>
      healthy ? [] : ["papers-2024-W10.json", "papers-2024-W09.json", "papers-2024-W08.json"],
    );

    render(<App />);
    await screen.findByRole("alert");
    expect(log.indexRequests).toBe(1);
    expect(log.shardRequests).toHaveLength(3);

    healthy = true;
    fireEvent.click(tryAgain());
    await screen.findByText(W09_PAPER.title);

    // The index is already in hand and the failed shards were never cached, so
    // a second mechanism that re-fetched the manifest would be a second network
    // round trip for nothing.
    expect(log.indexRequests).toBe(1);
    expect(log.shardRequests).toHaveLength(6);
  });

  it("issues a single retry when the button is activated twice in one tick", async () => {
    let healthy = false;
    const log = installFetch(() =>
      healthy ? [] : ["papers-2024-W10.json", "papers-2024-W09.json", "papers-2024-W08.json"],
    );

    render(<App />);
    await screen.findByText(/Papers could not be loaded/);
    const button = tryAgain();

    healthy = true;
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(await screen.findByText(W09_PAPER.title)).toBeTruthy();
    // Three shards twice, not three shards three times: the two activations
    // batch into one `papersAttempts` change, hence one effect run.
    expect(log.shardRequests).toHaveLength(6);
  });

  it("restores the Try again button when the retry fails too", async () => {
    installFetch(() => ["papers-2024-W10.json", "papers-2024-W09.json", "papers-2024-W08.json"]);

    render(<App />);
    await screen.findByText(/Papers could not be loaded/);
    const first = tryAgain();

    fireEvent.click(first);

    const second = await screen.findByRole("button", { name: /try again/i });
    expect(second.hasAttribute("disabled")).toBe(false);
    expect(second.textContent).toBe("Try again");
    // Still one failure, so still one announcement: a restored panel that also
    // left the warning banner up would announce the same failure twice.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("keeps one panel node across re-renders so it is announced once", async () => {
    installFetch(() => ["papers-2024-W10.json", "papers-2024-W09.json", "papers-2024-W08.json"]);

    render(<App />);
    const first = await screen.findByRole("alert").then(failurePanel);

    // Typing re-renders the whole app without re-running the load. A remount here
    // would re-fire the assertive announcement on every keystroke.
    const search = screen.getByLabelText("Search papers");
    fireEvent.change(search, { target: { value: "abstract" } });
    expect(failurePanel()).toBe(first);
    fireEvent.change(search, { target: { value: "" } });

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(failurePanel()).toBe(first);
  });

  it("leaves the index-unavailable panel to IMP-007 and does not shadow it", async () => {
    installFetchWithoutIndex();

    render(<App />);

    // No manifest means no hero, no controls and no paper list, so the
    // load-failure state is not reachable and must not be rendered: the index
    // failure has its own panel, and its own Try again, one level up.
    expect(await screen.findByText("No paper index yet")).toBeTruthy();
    expect(screen.queryByText(/Papers could not be loaded/)).toBeNull();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(
      within(screen.getByRole("alert")).getByRole("button", { name: /try again/i }),
    ).toBeTruthy();
  });
});

/**
 * IMP-017: every failure the loader can produce reaches the screen as a plain
 * sentence, with the file name and the HTTP status kept in a `title` and in the
 * console. This block is the guard for the index-side half — the shard side is
 * the "no shard could be loaded" block above.
 */
describe("the copy for an index that could not be loaded", () => {
  /** The index file exists but its body is not the manifest. */
  function installFetchWithUnreadableIndex(): void {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/index.json")) {
          return new Response("<html>not json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return notFound();
      }),
    );
  }

  function indexPanel(): HTMLElement {
    return screen.getByRole("alert");
  }

  it("explains an absent index without showing the request that failed", async () => {
    installFetchWithoutIndex();

    render(<App />);
    await screen.findByText("No paper index yet");

    // Scoped to the message paragraph, not the whole panel: IMP-007's panel keeps
    // its "Build the index locally" block, and those commands are meant to be
    // read. What must not be in the prose is the loader's own diagnostic.
    const message = within(indexPanel()).getByTitle(/No paper index was found/);
    expect(message.tagName).toBe("P");
    expect(message.textContent).toMatch(/paper index could not be loaded/i);
    expect(message.textContent).toMatch(/usually temporary/i);
    expect(message.textContent).not.toMatch(/HTTP/);
    expect(message.textContent).not.toMatch(/\.json/);
    expect(message.textContent).not.toMatch(/build_index/);
    expect(message.textContent).not.toMatch(/GitHub Action/);
  });

  it("tells an unreadable index apart from an absent one", async () => {
    installFetchWithUnreadableIndex();

    render(<App />);
    await screen.findByText("No paper index yet");

    // "Not there yet" and "there but broken" want opposite advice, so they cannot
    // share a sentence — and this one has to admit that retrying is pointless,
    // because a body that will not parse will not parse on the second try.
    const message = within(indexPanel()).getByTitle(/malformed/);
    expect(message.textContent).toMatch(/could not be read/i);
    expect(message.textContent).toMatch(/will not help/i);
    expect(message.textContent).not.toMatch(/usually temporary/i);
  });

  it("keeps the index detail in the tooltip and the console for both failures", async () => {
    const logged: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      logged.push(args.map(String).join(" "));
    });

    try {
      installFetchWithoutIndex();
      const { unmount } = render(<App />);
      await screen.findByText("No paper index yet");
      expect(
        within(indexPanel()).getByTitle(/No paper index was found/),
      ).toBeTruthy();
      expect(logged.join("\n")).toMatch(/No paper index was found/);
      unmount();

      logged.length = 0;
      installFetchWithUnreadableIndex();
      render(<App />);
      await screen.findByText("No paper index yet");
      expect(
        within(indexPanel()).getByTitle(
          "The paper index is malformed and could not be parsed.",
        ),
      ).toBeTruthy();
      expect(logged.join("\n")).toMatch(/malformed and could not be parsed/);
    } finally {
      spy.mockRestore();
    }
  });
});

/**
 * `index.json` answered with HTTP 200, `content-type: application/json`, and a
 * body of JSON `null`.
 *
 * `response.json()` resolves for that body — it is valid JSON — so before the
 * fix the manifest promise resolved with `null`, `setManifest(null)` was not a
 * state change, and nothing else moved either: the app rendered
 * "Loading the paper index…" on a condition that consults neither `loading` nor
 * any promise. No error, no `role="alert"`, and no "Try again", because every
 * way out of that screen hangs off `error`. Only a reload recovered.
 */
describe("an index file whose body is JSON null", () => {
  function installFetchWithNullIndex(): FetchLog {
    const log: FetchLog = { indexRequests: 0, shardRequests: [] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/index.json")) {
          log.indexRequests += 1;
          // 200 and a JSON content type, so only the body is wrong: this is not
          // the "not built yet" state IMP-007 already serves.
          return jsonResponse(null);
        }
        log.shardRequests.push(url.split("/").pop() ?? "");
        return notFound();
      }),
    );
    return log;
  }

  it("replaces the indefinite loading line with the index-unavailable panel", async () => {
    installFetchWithNullIndex();

    render(<App />);

    // Waiting for the panel is the wait: while this line is still up the app is
    // in the state that used to be permanent.
    expect(await screen.findByText("No paper index yet")).toBeTruthy();
    expect(screen.queryByText(/Loading the paper index/)).toBeNull();
    // Settled, not merely momentarily absent — the claim is that no frame ever
    // goes back to it.
    await waitFor(() =>
      expect(screen.queryByText(/Loading the paper index/)).toBeNull(),
    );
    // A real paper list is not an option either: there is no index, so there is
    // nothing to list and nothing to filter.
    expect(screen.queryByRole("heading", { name: /Recent arXiv papers/ })).toBeNull();
    expect(screen.queryByLabelText("Search papers")).toBeNull();
  });

  it("shows IMP-007's panel and a Try again that re-requests index.json", async () => {
    const log = installFetchWithNullIndex();

    render(<App />);
    await screen.findByText("No paper index yet");

    // The same panel IMP-007 established for an absent index, reached by the
    // same route — so this is not a second, quieter failure state.
    const panel = screen.getByRole("alert");
    expect(panel.className).toContain("panel");
    expect(panel.className).toContain("panel--error");
    expect(within(panel).getByRole("heading", { name: "No paper index yet" })).toBeTruthy();
    const button = within(panel).getByRole("button", { name: /try again/i });
    expect(button.tagName).toBe("BUTTON");
    expect(button.textContent).toBe("Try again");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(log.indexRequests).toBe(1);

    fireEvent.click(button);

    // IMP-003: the rejection was not memoized, so the retry really re-asks the
    // network. A dead button here would leave the reader with the reload this
    // whole item exists to remove.
    await waitFor(() => expect(log.indexRequests).toBe(2));
    expect(screen.queryByText(/Loading the paper index/)).toBeNull();
    // Still unreadable, so the panel comes back rather than the app hanging a
    // second time.
    await waitFor(() =>
      expect(screen.getAllByRole("alert")).toHaveLength(1),
    );
    expect(screen.getByText("No paper index yet")).toBeTruthy();
    // The shard fetch is never reached: without a manifest there is no window to
    // ask for.
    expect(log.shardRequests).toEqual([]);
  });

  it("keeps the reader-facing malformed sentence, not the raw loader text", async () => {
    installFetchWithNullIndex();

    render(<App />);
    await screen.findByText("No paper index yet");

    // `null` is "there but broken", so it must not be dressed as the transient
    // "usually temporary" case the absent index gets — telling this reader to
    // wait is the wrong advice for a file that will not parse on a second read.
    const message = within(screen.getByRole("alert")).getByTitle(
      "The paper index is malformed and could not be parsed.",
    );
    expect(message.tagName).toBe("P");
    expect(message.textContent).toMatch(/could not be read/i);
    expect(message.textContent).toMatch(/will not help/i);
    expect(message.textContent).not.toMatch(/usually temporary/i);
  });
});

/**
 * A window that loaded, then a window that could not. The papers from the first
 * are still on screen, so this is the one failure state that renders as a banner
 * beside a working feed rather than as a panel — which means it is a separate
 * piece of copy that can drift on its own.
 */
describe("a window that fails while papers are already on screen", () => {
  it("warns beside the feed in plain words, keeping the cause in the title", async () => {
    // The only route to this state, and it is a real one. `loadShard` never
    // re-requests a shard it already holds, so a window can only fail outright
    // if every shard it needs is uncached — and papers are on screen only if
    // some *other* shard loaded. Here W10 and W09 never arrive, so the 60-day
    // window degrades to W08 alone; the 7-day window needs W10 and W09 and
    // nothing else, so it has no cached shard to fall back on.
    installFetch(() => ["papers-2024-W10.json", "papers-2024-W09.json"]);

    render(<App />);
    await screen.findByText(W08_PAPER.title);

    fireEvent.click(screen.getByRole("button", { name: "7 days" }));
    await screen.findByText(/paper data could not be fetched/i);

    const banner = screen
      .getAllByRole("alert")
      .find((node) =>
        /paper data could not be fetched/i.test(node.textContent ?? ""),
      );
    expect(banner).toBeDefined();
    // Still a feed, not a dead end: the papers that did load are untouched, and
    // the earlier "two weeks are missing" notice has stood down rather than
    // leaving a second alert describing a window that no longer exists.
    expect(screen.getByText(W08_PAPER.title)).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText(/Papers could not be loaded/)).toBeNull();
    expect(screen.queryByText(/failed to load \(/)).toBeNull();
    expect(banner?.textContent).not.toMatch(/papers-2024-W10\.json/);
    expect(banner?.textContent).not.toMatch(/HTTP/);
    expect(banner?.getAttribute("title")).toContain(
      "Failed to load papers-2024-W10.json (HTTP 404).",
    );
    // `alert` is an author-named role, so with only the tooltip above it the
    // HTTP status would be announced instead of the sentence.
    expect(banner?.getAttribute("aria-label")).toBe(
      banner?.textContent?.trim(),
    );
  });
});

/**
 * A window that loaded and genuinely contains nothing must keep saying so. The
 * load-failure state is only honest if the empty state is still reachable.
 */
describe("a window that loaded and is genuinely empty", () => {
  /**
   * Every shard loads and none holds a paper inside the 60-day window, so
   * `loadPapers` resolves with an empty list and no failures — the real
   * "nothing in this window" case, and the one the false claim was standing in
   * for.
   */
  const STALE_ONLY: Record<string, unknown> = Object.fromEntries(
    [W10, W09, W08].map((shard) => [
      shard.file,
      {
        week: shard.week,
        from: shard.from,
        to: shard.to,
        papers: [
          makePaper("2306.00001", `A Stale Paper For ${shard.week}`, "2023-06-01"),
        ],
      },
    ]),
  );

  it("still shows the empty-window copy, with no error and no retry", async () => {
    installFetch(() => [], MANIFEST, STALE_ONLY);

    render(<App />);

    expect(
      await screen.findByText("No papers are available in this window yet."),
    ).toBeTruthy();
    // A load that succeeded has nothing to apologize for: turning this into an
    // error would be as dishonest as the claim it replaced.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
    expect(screen.queryByText(/Papers could not be loaded/)).toBeNull();
  });

  it("still shows the empty-search copy when only the filters exclude everything", async () => {
    installFetch(() => []);

    render(<App />);
    await screen.findByText(W09_PAPER.title);

    fireEvent.change(screen.getByLabelText("Search papers"), {
      target: { value: "zzzzznomatch" },
    });

    expect(
      await screen.findByText("No papers match the current filters."),
    ).toBeTruthy();
    expect(screen.queryByText("No papers are available in this window yet.")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });
});

/**
 * A shard that failed while others loaded is IMP-015's partial-failure notice,
 * which named the missing week only in `title`. `title` renders no tooltip on
 * touch, so at the project's 390px viewport nothing on screen named the week.
 */
describe("the notice for a week that could not be loaded", () => {
  function partialNotice(): HTMLElement {
    const matches = screen
      .getAllByRole("alert")
      .filter((node) =>
        /in this window failed to load/i.test(node.textContent ?? ""),
      );
    if (matches.length !== 1) {
      throw new Error(
        `expected exactly one partial-shard notice, found ${matches.length}`,
      );
    }
    return matches[0];
  }

  it("names the missing week in the visible prose, not only in title", async () => {
    installFetch(() => ["papers-2024-W08.json"]);

    render(<App />);
    await screen.findByText(W09_PAPER.title);

    const notice = partialNotice();
    // The pre-fix copy said only "One week" — a count, not a name. At 390px the
    // reader had no way to learn which week was gone. The asserted text includes
    // the open parenthesis, so the count-only copy cannot satisfy it.
    expect(notice.textContent).toMatch(/One week in this window failed to load \(/);
    expect(notice.textContent).toMatch(/Feb 19\b/);
    expect(notice.textContent).toContain("Feb 25, 2024");
    expect(notice.textContent).toContain("incomplete");
  });

  it("keeps the file name and the raw cause in title for the detail", async () => {
    installFetch(() => ["papers-2024-W08.json"]);

    render(<App />);
    await screen.findByText(W09_PAPER.title);

    const notice = partialNotice();
    // IMP-017 AC2 bars a file name or an HTTP status from the visible text, so
    // the detail has to live somewhere — `title` is where it already did.
    expect(notice.getAttribute("title")).toContain("papers-2024-W08.json");
    expect(notice.getAttribute("title")).toContain("HTTP 404");
    expect(notice.textContent).not.toMatch(/papers-2024-W08\.json/);
    expect(notice.textContent).not.toMatch(/404/);
    expect(notice.textContent).not.toMatch(/Failed to load/);
  });

  it("names every missing week when more than one failed", async () => {
    // Two of three shards fail, so the load still resolves and the notice is the
    // partial-failure one rather than the hard panel.
    installFetch(() => ["papers-2024-W08.json", "papers-2024-W10.json"]);

    render(<App />);
    await screen.findByText(W09_PAPER.title);

    const notice = partialNotice();
    expect(notice.textContent).toMatch(/2 weeks in this window failed to load \(/);
    expect(notice.textContent).toMatch(/Feb 19\b/);
    expect(notice.textContent).toContain("Feb 25, 2024");
    expect(notice.textContent).toMatch(/\band\b/);
    expect(notice.textContent).toMatch(/Mar 4\b/);
    expect(notice.textContent).toContain("Mar 10, 2024");
    expect(notice.textContent).toContain("incomplete");
  });

  it("stays silent about weeks when every shard loaded", async () => {
    installFetch(() => []);

    render(<App />);
    await screen.findByText(W09_PAPER.title);

    // The naming is only worth its bytes if it means something: a clean load has
    // no notice at all.
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

/**
 * Several live regions can be true at once — a save that failed, a link naming a
 * category this index lacks, a load that failed. They are separate problems, so
 * they have to be separate nodes: one shared node would merge three failures into
 * a single announcement and make one of them unrenderable.
 */
describe("the load failure alongside the other notices", () => {
  it("coexists with the save-failure banner as two distinct alerts", async () => {
    useFullStorage();
    installFetch(() => ["papers-2024-W10.json", "papers-2024-W09.json", "papers-2024-W08.json"]);

    render(<App />);
    await screen.findByRole("alert");
    // A save the reader made, not a save the mount made: the storage notice has
    // to be earned before the two can be compared side by side.
    await saveSomething();

    expect(screen.getAllByRole("alert")).toHaveLength(2);
    const panel = failurePanel();
    const storage = screen
      .getAllByRole("alert")
      .find((node) => node !== panel);
    expect(storage).toBeDefined();
    expect(storage?.textContent).toContain("Collections could not be saved");
    expect(panel.textContent).not.toContain("Collections could not be saved");

    const search = screen.getByLabelText("Search papers");
    fireEvent.change(search, { target: { value: "abstract" } });

    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(failurePanel()).toBe(panel);
    expect(screen.getAllByRole("alert")).toContain(storage as HTMLElement);
  });

  it("coexists with the unknown-category banner as two distinct alerts", async () => {
    installFetch(() => ["papers-2024-W10.json", "papers-2024-W09.json", "papers-2024-W08.json"]);
    window.location.hash = "#cat=cs.BI";

    render(<App />);
    await screen.findByRole("alert");

    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(failurePanel().textContent).toMatch(/not an empty window/i);
    const unknown = screen
      .getAllByRole("alert")
      .find((node) => node !== failurePanel());
    expect(unknown?.textContent).toContain("cs.BI");
  });
});
