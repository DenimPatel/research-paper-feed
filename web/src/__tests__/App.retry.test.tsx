import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import type { IndexManifest, Paper } from "../lib/types";

const PAPER: Paper = {
  id: "2401.00001",
  title: "A Retry Test Paper",
  authors: ["Ada Lovelace"],
  abstract: "An abstract long enough to preview.",
  abstractTruncated: false,
  published: "2024-03-01",
  updated: "2024-03-01",
  categories: ["cs.CV"],
  primaryCategory: "cs.CV",
  absUrl: "https://arxiv.org/abs/2401.00001",
  pdfUrl: "https://arxiv.org/pdf/2401.00001",
};

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
  ],
  totalPapers: 1,
};

const SHARD = {
  week: "2024-W09",
  from: "2024-02-26",
  to: "2024-03-03",
  papers: [PAPER],
};

/** The SPA fallback a static host serves for a missing index file. */
function htmlFallback(): Response {
  return new Response("<!doctype html><title>fallback</title>", {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function defer<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/**
 * Answers the first `index.json` request with the unavailable fallback and
 * holds every later one open until the test releases it, so the loading state
 * between the click and the recovery is observable.
 */
function installGatedFetch() {
  const gate = defer<Response>();
  let indexRequests = 0;
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/index.json")) {
      indexRequests += 1;
      return indexRequests === 1 ? htmlFallback() : gate.promise;
    }
    return jsonResponse(SHARD);
  });
  vi.stubGlobal("fetch", mock);
  return {
    mock,
    indexRequests: () => indexRequests,
    releaseIndex: () => gate.resolve(jsonResponse(MANIFEST)),
  };
}

async function renderUnavailableFeed() {
  render(<App />);
  const alert = await screen.findByRole("alert");
  return within(alert).getByRole("button", { name: /try again/i });
}

/**
 * Answers each successive `index.json` request from `modes`, so a test can walk
 * the panel through several failed retries before the index appears. The last
 * mode repeats once the list runs out.
 */
function installScriptedFetch(modes: Array<"fallback" | "json">) {
  let indexRequests = 0;
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/index.json")) {
      const mode = modes[Math.min(indexRequests, modes.length - 1)];
      indexRequests += 1;
      return mode === "json" ? jsonResponse(MANIFEST) : htmlFallback();
    }
    return jsonResponse(SHARD);
  });
  vi.stubGlobal("fetch", mock);
  return { mock, indexRequests: () => indexRequests };
}

/**
 * Clicks the panel's button and resolves once the panel is back on screen,
 * which is how a failed retry announces itself.
 */
async function clickRetryExpectingAnotherFailure() {
  const button = await screen.findByRole("button", { name: /try again/i });
  fireEvent.click(button);
  return screen.findByRole("button", { name: /try again/i });
}

beforeEach(() => {
  window.location.hash = "";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("index-unavailable panel retry", () => {
  it("renders a focusable native button labelled Try again inside the error panel", async () => {
    installGatedFetch();
    const button = await renderUnavailableFeed();

    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.textContent).toBe("Try again");
    expect(button.closest("[role='alert']")).toBeTruthy();

    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("clears the error panel, shows the loading status, and refetches the index", async () => {
    const feed = installGatedFetch();
    const button = await renderUnavailableFeed();
    expect(feed.indexRequests()).toBe(1);

    fireEvent.click(button);

    expect(screen.queryByRole("alert")).toBeNull();
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Loading the paper index");
    expect(feed.indexRequests()).toBe(2);
  });

  it("recovers into the feed on retry without a reload and moves focus to it", async () => {
    const feed = installGatedFetch();
    const button = await renderUnavailableFeed();

    fireEvent.click(button);
    await act(async () => {
      feed.releaseIndex();
    });

    const heading = await screen.findByRole("heading", {
      name: /Recent arXiv papers/,
    });
    expect(await screen.findByText(PAPER.title)).toBeTruthy();
    expect(heading.tagName).toBe("H1");
    expect(document.activeElement).toBe(heading);
  });

  it("issues a single retry when the button is clicked twice in one tick", async () => {
    const feed = installGatedFetch();
    const button = await renderUnavailableFeed();

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(feed.indexRequests()).toBe(2);
    await act(async () => {
      feed.releaseIndex();
    });
    expect(await screen.findByText(PAPER.title)).toBeTruthy();
  });

  it("restores the Try again button when the retry fails too", async () => {
    installScriptedFetch(["fallback"]);
    render(<App />);
    const button = await screen.findByRole("button", { name: /try again/i });

    fireEvent.click(button);

    const restored = await screen.findByRole("button", { name: /try again/i });
    expect(restored.hasAttribute("disabled")).toBe(false);
    expect(restored.textContent).toBe("Try again");
    expect(button).not.toBe(restored);
  });

  // Regression test for the latch bug: the first attempt used to leave a
  // `retryingRef` set with no reset path, so every later click was a silent
  // no-op while the button still looked enabled.
  it("refetches on a second click after a failed retry, then recovers", async () => {
    const feed = installScriptedFetch(["fallback", "fallback", "json"]);
    const first = await renderUnavailableFeed();

    fireEvent.click(first);
    const second = await screen.findByRole("button", { name: /try again/i });
    fireEvent.click(second);

    expect(feed.indexRequests()).toBe(3);
    expect(await screen.findByText(PAPER.title)).toBeTruthy();
  });

  it("keeps accepting retries across three consecutive failures", async () => {
    const feed = installScriptedFetch([
      "fallback",
      "fallback",
      "fallback",
      "fallback",
      "json",
    ]);
    await renderUnavailableFeed();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await clickRetryExpectingAnotherFailure();
    }
    expect(feed.indexRequests()).toBe(4);

    const fourth = await screen.findByRole("button", { name: /try again/i });
    fireEvent.click(fourth);

    expect(feed.indexRequests()).toBe(5);
    expect(await screen.findByText(PAPER.title)).toBeTruthy();
  });
});