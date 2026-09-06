import type { ImagePick, ImageRef, ItemStatus, JobKind, SourceType } from "@reader/shared";
import { itemStatuses, jobKinds, sourceTypes } from "@reader/shared";
import { sql } from "drizzle-orm";
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const itemStatusEnum = pgEnum("item_status", itemStatuses);
export const sourceTypeEnum = pgEnum("source_type", sourceTypes);
export const jobKindEnum = pgEnum("job_kind", jobKinds);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull().unique(),
    sourceType: sourceTypeEnum("source_type").notNull().$type<SourceType>(),
    title: text("title"),
    status: itemStatusEnum("status").notNull().default("queued").$type<ItemStatus>(),
    error: text("error"),
    savedFrom: text("saved_from"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("items_feed_idx").on(t.createdAt.desc(), t.id.desc()),
    index("items_status_idx").on(t.status),
  ],
);

export const contents = pgTable("contents", {
  itemId: uuid("item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  html: text("html"),
  images: jsonb("images").$type<ImageRef[]>().notNull().default([]),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const summaries = pgTable("summaries", {
  itemId: uuid("item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  summaryMd: text("summary_md").notNull(),
  keyPoints: jsonb("key_points").$type<string[]>().notNull(),
  imagePicks: jsonb("image_picks").$type<ImagePick[]>().notNull(),
  readTimeMin: integer("read_time_min"),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    kind: jobKindEnum("kind").notNull().$type<JobKind>(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("jobs_ready_idx")
      .on(t.runAfter)
      .where(sql`${t.lockedAt} is null`),
    index("jobs_locked_idx")
      .on(t.lockedAt)
      .where(sql`${t.lockedAt} is not null`),
  ],
);

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsed: timestamp("last_used", { withTimezone: true }),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Content = typeof contents.$inferSelect;
export type Summary = typeof summaries.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
