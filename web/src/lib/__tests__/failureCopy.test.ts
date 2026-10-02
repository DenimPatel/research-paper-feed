import { describe, expect, it } from "vitest";
import { describeLoadFailure } from "../failureCopy";
import { IndexUnavailableError, ShardLoadError } from "../paperIndex";

/** Every technical token IMP-017 AC2 bars from a rendered user-facing string. */
const TECHNICAL = [/\.json/, /HTTP/, /\b\d{3}\b/, /Failed to load/, /IndexUnavailableError/];

function expectNoTechnicalDetail(message: string): void {
  for (const pattern of TECHNICAL) {
    expect(message, `visible copy must not match ${pattern}`).not.toMatch(pattern);
  }
}

describe("describeLoadFailure", () => {
  it("describes an index that is not there in plain words", () => {
    const notice = describeLoadFailure(
      new IndexUnavailableError(
        "No paper index was found. Run `python scripts/build_index.py` locally. (HTTP 404)",
        "unavailable",
      ),
    );

    expect(notice.message).toMatch(/paper index could not be loaded/i);
    expect(notice.message).toMatch(/usually temporary/i);
    expectNoTechnicalDetail(notice.message);
    // The build instructions and the status are still available to whoever needs
    // them, which is the whole contract: dropped from the screen, not dropped.
    expect(notice.detail).toMatch(/build_index\.py/);
    expect(notice.detail).toMatch(/HTTP 404/);
  });

  it("describes an index that arrived unreadable, and says retrying will not help", () => {
    const notice = describeLoadFailure(
      new IndexUnavailableError(
        "The paper index is malformed and could not be parsed.",
        "malformed",
      ),
    );

    // A 404 and a corrupt body are different problems with different advice, so
    // they cannot be the same sentence.
    expect(notice.message).toMatch(/could not be read/i);
    expect(notice.message).toMatch(/will not help/i);
    expectNoTechnicalDetail(notice.message);
    expect(notice.detail).toBe(
      "The paper index is malformed and could not be parsed.",
    );
  });

  it("defaults an unlabelled index error to the unavailable wording", () => {
    const notice = describeLoadFailure(new IndexUnavailableError("whatever"));

    expect(notice.message).toMatch(/could not be loaded/i);
    expect(notice.message).not.toMatch(/could not be read/i);
  });

  it("describes a failed shard without naming a file or a status", () => {
    const notice = describeLoadFailure(
      new ShardLoadError(
        "Failed to load papers-2024-W14.json (HTTP 404).",
        "papers-2024-W14.json",
      ),
    );

    expect(notice.message).toMatch(/paper data could not be fetched/i);
    expect(notice.message).toMatch(/does not mean the papers are missing/i);
    expectNoTechnicalDetail(notice.message);
    expect(notice.detail).toBe("Failed to load papers-2024-W14.json (HTTP 404).");
  });

  it("describes an unreadable shard body as the same class of failure", () => {
    const notice = describeLoadFailure(
      new ShardLoadError(
        "Shard papers-2024-W14.json is missing or malformed. Try regenerating the index.",
        "papers-2024-W14.json",
      ),
    );

    // Whether the request was refused or the body was junk, a reader gets the
    // same sentence: the difference is a deployment detail, not a reader's
    // problem to solve.
    expect(notice.message).toMatch(/paper data could not be fetched/i);
    expectNoTechnicalDetail(notice.message);
    expect(notice.detail).toMatch(/regenerating the index/);
  });

  it("falls back to honest copy for something it does not recognize", () => {
    const notice = describeLoadFailure(new Error("kaboom"));

    expect(notice.message).toMatch(/something went wrong/i);
    expectNoTechnicalDetail(notice.message);
    expect(notice.detail).toBe("kaboom");
  });

  it("survives a thrown value that is not an Error", () => {
    const notice = describeLoadFailure("just a string");

    expect(notice.message).toMatch(/something went wrong/i);
    expect(notice.detail).toBe("just a string");
  });

  it("never leaks the technical detail into the reader-facing copy, for any cause", () => {
    const causes: unknown[] = [
      new IndexUnavailableError("No paper index was found. (HTTP 503)"),
      new IndexUnavailableError(
        "The paper index is malformed and could not be parsed.",
        "malformed",
      ),
      new ShardLoadError("Failed to load papers-2026-W39.json (HTTP 500).", "papers-2026-W39.json"),
      new Error("Failed to load papers-2026-W39.json (HTTP 404)."),
    ];

    for (const cause of causes) {
      const { message, detail } = describeLoadFailure(cause);
      expect(message.length, `${detail} produced copy`).toBeGreaterThan(0);
      expectNoTechnicalDetail(message);
    }
  });
});
