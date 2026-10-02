export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  abstractTruncated: boolean;
  published: string;
  updated: string;
  categories: string[];
  /**
   * The last three read `getattr(result, …, None)` in `record_from_result`
   * (`scripts/build_index.py:118-120`), so arXiv omitting one of them reaches
   * the wire as JSON `null` rather than a missing key. `arxiv` 4.x types
   * `Result.pdf_url` and `Result.entry_id` as `str | None` and
   * `Result.primary_category` as `str | None`, and nothing on the TS side ever
   * normalises them to a string, so `null` is declared here rather than
   * asserted away. A runtime guard and this type are separate tools: the guards
   * in `collections.ts` and `PaperCard`'s `safeHref` still have to do their work
   * because a shard is a bare cast and an import is a file read off disk.
   */
  primaryCategory: string | null;
  absUrl: string | null;
  pdfUrl: string | null;
}

export interface ShardManifestEntry {
  week: string;
  from: string;
  to: string;
  count: number;
  file: string;
}

export interface IndexManifest {
  generatedAt: string;
  retentionDays: number;
  categories: string[];
  shards: ShardManifestEntry[];
  totalPapers: number;
  /**
   * Categories whose query did not complete, so the index has no papers for
   * them at all. They are deliberately *not* in `categories`: that list drives
   * the filter chips, and a chip for an absent category leads the reader to an
   * empty feed that reads as their own filter being wrong. Named here so the
   * site can say what is missing instead.
   */
  failedCategories?: string[];
  /**
   * Categories that used up their per-category result allowance, so older
   * papers inside the retention window may be missing. They *are* in
   * `categories` — they have papers — but they are not complete.
   */
  truncatedCategories?: string[];
}

export interface ShardFile {
  week: string;
  from: string;
  to: string;
  papers: Paper[];
}

export type RecencyDays = 7 | 30 | 60;

export type SortMode = "newest" | "relevance";
