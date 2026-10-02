import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const W09 = makePaper("2401.00001", "A Paper From The Week That Loaded", "2024-03-01");
const W08 = makePaper("2401.00002", "A Paper From The Week That Failed", "2024-02-20");

const MANIFEST: IndexManifest = {
  generatedAt: "2024-03-01T00:00:00Z",
  retentionDays: 60,
  categories: ["cs.CV"],
  shards: [
    {
      week: "2024-W09",
      from: "2024-02-26",
      to: "2024-03-03",
      count: 1,
      file: "papers-2024-W09.json",
    },
    {
      week: "2024-W08",
      from: "2024-02-19",
      to: "2024-02-25",
      count: 1,
      file: "papers-2024-W08.json",
    },
  ],
  totalPapers: 2,
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function manifestResponse(): Response {
  return jsonResponse(MANIFEST);
}

const SHARD_BODIES: Record<string, unknown> = {
  "papers-2024-W09.json": {
    week: "2024-W09",
    from: "2024-02-26",
    to: "2024-03-03",
    papers: [W09],
  },
  "papers-2024-W08.json": {
    week: "2024-W08",
    from: "2024-02-19",
    to: "2024-02-25",
    papers: [W08],
  },
};

/** Answers every shard 404, so the whole window is unavailable. */
function installFetchWithoutShards(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith("/index.json")
        ? manifestResponse()
        : new Response("not found", { status: 404 }),
    ),
  );
}

/**
 * Answers the shard named by `failing()` with a 404 and every other shard with
 * its paper. A thunk rather than a string so a test can heal a shard between
 * two loads — `loadPapers` never caches a failure, so a recovered shard must
 * make the notice go away without a page reload.
 */
function installFetch(failing: () => string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/index.json")) {
        return manifestResponse();
      }
      const file = url.split("/").pop() ?? "";
      if (file === failing() || !(file in SHARD_BODIES)) {
        return new Response("not found", { status: 404 });
      }
      return jsonResponse(SHARD_BODIES[file]);
    }),
  );
}

/**
 * The manifest answers immediately and every shard waits on a gate the test
 * releases, which is the only way to observe the window *before* the shards
 * resolve — the moment where nothing is known to be missing yet.
 */
function installFetchWithGatedShards(
  failing: () => string,
): { release: () => void } {
  let openGate!: () => void;
  const gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/index.json")) {
        return manifestResponse();
      }
      await gate;
      const file = url.split("/").pop() ?? "";
      if (file === failing() || !(file in SHARD_BODIES)) {
        return new Response("not found", { status: 404 });
      }
      return jsonResponse(SHARD_BODIES[file]);
    }),
  );
  return { release: openGate };
}

/**
 * jsdom 29 hands back a `window.localStorage` whose `setItem` is not a function
 * (`App.storage.test.tsx:42-50` records the same finding), so `detectStorage()`
 * reports "no storage" and the save effect never runs. A real `Storage` is what
 * makes IMP-011's banner reachable here, so both alerts can coexist.
 *
 * Full rather than blocked: `saveState` writes `COLLECTIONS_KEY` before
 * `PAPERS_KEY`, so only the second write has to overflow.
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

/** Makes `saveState` fail from the first render, without leaving the stub. */
function useFullStorage(): void {
  originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: new FullStorage(),
  });
}

/** The IMP-015 notice, identified by its copy rather than by position. */
function partialNotice(): HTMLElement {
  const matches = screen
    .getAllByRole("alert")
    .filter((node) =>
      /could not be loaded/i.test(node.textContent ?? ""),
    );
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one partial-shard notice, found ${matches.length}`,
    );
  }
  return matches[0];
}

/**
 * One save the reader caused, which is the only thing that arms IMP-011's
 * notice — the mount run has nothing to write, so a failure has to be provoked
 * by an action. Without it this file would be asserting a first-visit scare
 * rather than the two notices coexisting, which is what it is here to check.
 * Returns to the feed so the caller can count the notices in the view the
 * shard failure is rendered in.
 */
async function saveSomething(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: /^Collections/ }));
  fireEvent.change(await screen.findByLabelText("New collection name"), {
    target: { value: "Vision" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create collection" }));
  await screen.findByRole("heading", { name: /^Vision/ });
  fireEvent.click(screen.getByRole("button", { name: "Feed" }));
  await screen.findByText(W09.title);
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
 * The cards are filled by the load effect, which flips `loading` off only once
 * `loadPapers` resolves — so anything gated on `papers` has to be awaited. See
 * `App.relevance.test.tsx` for the same split.
 */
describe("App with one unreachable shard", () => {
  it("renders the surviving week and says the feed is incomplete", async () => {
    installFetch(() => "papers-2024-W08.json");

    render(<App />);

    expect(await screen.findByText(W09.title)).toBeTruthy();
    expect(screen.queryByText(W08.title)).toBeNull();

    // A hard failure is gone — the load resolved — but the week is still
    // missing, so a feed that is silently short is the one thing this must not
    // be. No error panel and no retry button either: nothing failed outright.
    const notice = partialNotice();
    expect(notice.textContent).toMatch(/incomplete/i);
    expect(
      screen.queryByRole("button", { name: /try again/i }),
    ).toBeNull();
    expect(screen.queryByText(/no paper index yet/i)).toBeNull();
  });

  it("holds the notice back until the shards have actually answered", async () => {
    const { release } = installFetchWithGatedShards(
      () => "papers-2024-W08.json",
    );

    render(<App />);

    // The manifest is in and both shards are still outstanding, so no failure
    // has been observed yet. Announcing one here would be a guess.
    await screen.findByText(/Loading papers from 2 weeks/);
    expect(screen.queryByRole("alert")).toBeNull();

    release();

    expect(await screen.findByText(W09.title)).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("names the missing shard without leaking the raw failure into the text", async () => {
    installFetch(() => "papers-2024-W08.json");

    render(<App />);
    await screen.findByText(W09.title);

    const notice = partialNotice();
    // IMP-015 AC2 wants the missing week reportable; IMP-017 AC2 bars a file
    // name or an HTTP status from the visible copy. `title` is where both hold.
    expect(notice.getAttribute("title")).toContain("papers-2024-W08.json");
    expect(notice.getAttribute("title")).toContain("HTTP 404");
    expect(notice.textContent).not.toMatch(/papers-2024-W08\.json/);
    expect(notice.textContent).not.toMatch(/404/);
    expect(notice.textContent).not.toMatch(/Failed to load/);
    // The established notice treatment from IMP-011, so the two read as one
    // kind of thing and no new styling was needed.
    expect(notice.className).toContain("banner");
    expect(notice.className).toContain("banner--error");
  });

  it("keeps one notice node across re-renders so it is announced once", async () => {
    installFetch(() => "papers-2024-W08.json");

    render(<App />);
    await screen.findByText(W09.title);
    const first = partialNotice();

    // Typing re-renders the whole app without re-running the load. A remount
    // here would re-fire the assertive announcement on every keystroke.
    const search = screen.getByLabelText("Search papers");
    fireEvent.change(search, { target: { value: "abstract" } });
    expect(partialNotice()).toBe(first);
    fireEvent.change(search, { target: { value: "" } });
    expect(partialNotice()).toBe(first);

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(partialNotice().textContent).toContain("incomplete");
  });

  it("clears the notice when a later window loads completely", async () => {
    let healthy = false;
    installFetch(() => (healthy ? "" : "papers-2024-W08.json"));

    render(<App />);
    await screen.findByText(W09.title);
    expect(screen.queryByText(W08.title)).toBeNull();
    expect(partialNotice()).toBeTruthy();

    // W08 was never cached, so changing the window re-asks for it. 30 days is
    // the widest option that still covers W08's paper (2024-02-20) — 7 days
    // would filter it out and prove nothing about the shard.
    healthy = true;
    fireEvent.click(screen.getByRole("button", { name: "30 days" }));

    expect(await screen.findByText(W08.title)).toBeTruthy();
    await waitFor(() =>
      expect(screen.queryByRole("alert")).toBeNull(),
    );
  });

  it("stays silent when every shard loads", async () => {
    installFetch(() => "");

    render(<App />);

    expect(await screen.findByText(W09.title)).toBeTruthy();
    expect(screen.getByText(W08.title)).toBeTruthy();
    // The whole point of the notice is that it means something: on a clean load
    // there is nothing to warn about, so the feed must look complete.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("still surfaces an error when every shard in the window fails", async () => {
    installFetchWithoutShards();

    render(<App />);

    // Rejection is unchanged, and the notice must not double-report it: one
    // alert, carrying the hard failure — not the hard failure *and* a stale
    // "some weeks are missing" banner describing a load that never resolved.
    const alert = await screen.findByRole("alert");
    // Reader-facing copy, not the shard's own `Error.message`: a file name and
    // an HTTP status belong in the tooltip, which is where IMP-017 kept them.
    expect(alert.textContent).toMatch(/Papers could not be loaded/);
    expect(alert.textContent).toMatch(/paper data could not be fetched/i);
    expect(alert.textContent).not.toMatch(/papers-2024-W09\.json/);
    expect(alert.textContent).not.toMatch(/HTTP/);
    expect(within(alert).getByTitle(/Failed to load papers-2024-W09\.json/)).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText(W09.title)).toBeNull();
  });

  /**
   * `role="alert"` takes its accessible name from the author and not from its
   * contents, so a notice whose only author-supplied string was a `title` had
   * the raw HTTP failure as its name — reproduced in Chromium's tree as
   * `alert "papers-2024-W08.json: Failed to load … (HTTP 404)."` The name has to
   * be a sentence a reader can hear.
   */
  it("names the notice for a reader, so the tooltip is not its accessible name", async () => {
    installFetch(() => "papers-2024-W08.json");

    render(<App />);
    await screen.findByText(W09.title);

    const notice = partialNotice();
    expect(notice.getAttribute("aria-label")).toBe(
      "Some papers could not be loaded",
    );
    // Label in name: the accessible name contains the notice's own visible
    // label, so speech input and the rendered text agree.
    expect(notice.textContent).toMatch(/Some papers could not be loaded\./);
    // The tooltip is untouched — the detail is hidden from the announcement,
    // not deleted.
    expect(notice.getAttribute("title")).toContain("papers-2024-W08.json");
    expect(notice.getAttribute("title")).toContain("HTTP 404");
  });
});

/**
 * IMP-011's save-failure notice and this one are independent, so both can be on
 * screen at once. Two live regions is correct — but each must still announce
 * exactly once, and neither may be mistaken for the other's message.
 */
describe("the shard notice alongside the storage notice", () => {
  it("shows both as separate alerts and announces neither twice", async () => {
    useFullStorage();
    installFetch(() => "papers-2024-W08.json");

    render(<App />);
    await screen.findByText(W09.title);
    // A save the reader made, not a save the mount made: the notice has to be
    // earned before the two can be compared side by side.
    await saveSomething();

    // Two alerts is the settled state, but not one `await` away: the shard
    // notice rides the load effect's single `setPapers`/`setFailedShards` commit
    // while the storage notice is a separate `saveFailed` state set by the save
    // effect, so the two live regions mount on independent ticks. `saveSomething`
    // ends on the paper title, which says nothing about either notice.
    await waitFor(() =>
      expect(screen.getAllByRole("alert")).toHaveLength(2),
    );
    const alerts = screen.getAllByRole("alert");

    const shardNotice = partialNotice();
    const storageNotice = alerts.find((node) => node !== shardNotice);
    expect(storageNotice).toBeDefined();
    expect(storageNotice?.textContent).toContain(
      "Collections could not be saved",
    );
    expect(storageNotice?.className).toContain("banner--error");
    // Distinct nodes with distinct copy: a shared node would make one of the
    // two messages unrenderable and merge two failures into one announcement.
    expect(shardNotice.textContent).not.toContain("Collections could not be saved");

    const search = screen.getByLabelText("Search papers");
    fireEvent.change(search, { target: { value: "abstract" } });

    await waitFor(() =>
      expect(screen.getAllByRole("alert")).toHaveLength(2),
    );
    expect(partialNotice()).toBe(shardNotice);
    expect(screen.getAllByRole("alert")).toContain(storageNotice as HTMLElement);
  });
});