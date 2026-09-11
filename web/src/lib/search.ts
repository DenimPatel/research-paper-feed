import type { Paper } from "./types";

export interface SearchToken {
  text: string;
  phrase: boolean;
}

export interface RankedPaper {
  paper: Paper;
  score: number;
}

const TITLE_WEIGHT = 5;
const AUTHOR_WEIGHT = 2;
const ABSTRACT_WEIGHT = 1;
const PHRASE_BONUS = 2;

/**
 * Tokenize a query into implicit-AND terms. Double quotes group a phrase.
 * An unterminated quote is treated as a plain term rather than an error.
 */
export function tokenize(query: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  const pattern = /"([^"]*)"|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(query)) !== null) {
    const phrase = match[1];
    if (phrase !== undefined) {
      const text = phrase.trim().toLowerCase();
      if (text) {
        tokens.push({ text, phrase: true });
      }
      continue;
    }
    const text = (match[2] ?? "").replace(/^"/, "").toLowerCase();
    if (text) {
      tokens.push({ text, phrase: false });
    }
  }

  return tokens;
}

/**
 * Score a paper against pre-tokenized terms. Returns 0 when any term is
 * missing (implicit AND). Title matches score above author and abstract
 * matches so relevance ranking favors on-topic titles.
 */
export function scorePaper(paper: Paper, tokens: SearchToken[]): number {
  if (tokens.length === 0) {
    return 1;
  }

  const title = paper.title.toLowerCase();
  const authors = paper.authors.join(" ").toLowerCase();
  const abstract = paper.abstract.toLowerCase();
  const combined = `${title} ${authors} ${abstract}`;

  let score = 0;
  for (const token of tokens) {
    if (!combined.includes(token.text)) {
      return 0;
    }
    if (token.phrase) {
      score += PHRASE_BONUS;
    }
    if (title.includes(token.text)) {
      score += TITLE_WEIGHT;
    } else if (authors.includes(token.text)) {
      score += AUTHOR_WEIGHT;
    } else {
      score += ABSTRACT_WEIGHT;
    }
  }
  return score;
}

/** Rank papers by relevance, newest first to break ties. */
export function rankPapers(papers: Paper[], query: string): RankedPaper[] {
  const tokens = tokenize(query);
  return papers
    .map((paper) => ({ paper, score: scorePaper(paper, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.paper.published < b.paper.published ? 1 : -1;
    });
}
