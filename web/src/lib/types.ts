export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  abstractTruncated: boolean;
  published: string;
  updated: string;
  categories: string[];
  primaryCategory: string;
  absUrl: string;
  pdfUrl: string;
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
}

export interface ShardFile {
  week: string;
  from: string;
  to: string;
  papers: Paper[];
}

export type RecencyDays = 7 | 30 | 60;

export type SortMode = "newest" | "relevance";
