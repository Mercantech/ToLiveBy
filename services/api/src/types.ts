import type { QuoteRow } from "./db/schema.js";

export type QuoteCategory = QuoteRow["category"];

export type QuotePublic = {
  id: string;
  body: string;
  author: string | null;
  category: QuoteCategory;
  tags: string[];
  createdAt: string;
};

export function toQuotePublic(row: QuoteRow): QuotePublic {
  return {
    id: row.id,
    body: row.body,
    author: row.author ?? null,
    category: row.category,
    tags: row.tags ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}
