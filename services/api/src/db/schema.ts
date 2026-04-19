import { sql } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const quoteCategoryEnum = pgEnum("quote_category", [
  "general",
  "stoicism",
  "motivation",
  "discipline",
]);

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  body: text("body").notNull(),
  author: text("author"),
  category: quoteCategoryEnum("category").notNull().default("general"),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type QuoteRow = typeof quotes.$inferSelect;
export type NewQuoteRow = typeof quotes.$inferInsert;
