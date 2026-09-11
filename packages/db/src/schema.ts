import type { ImagePick, ImageRef, ItemStatus, JobKind, ReadingView, SourceType, Theme, ThemeMode } from "@zenow/shared";
import { itemStatuses, jobKinds, readingViews, sourceTypes, themeModes, themes } from "@zenow/shared";
import { sql } from "drizzle-orm";
import {
  bigserial,
  index,
  unique,
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
export const themeEnum = pgEnum("theme", themes);
export const themeModeEnum = pgEnum("theme_mode", themeModes);
export const readingViewEnum = pgEnum("reading_view", readingViews);
export const workerStatusEnum = pgEnum("worker_status", [
  "none",
  "provisioning",
  "running",
  "stopped",
  "error",
]);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull(),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull().$type<SourceType>(),
    title: text("title"),
    status: itemStatusEnum("status").notNull().default("queued").$type<ItemStatus>(),
    error: text("error"),
    savedFrom: text("saved_from"),
    tags: text("tags").array().notNull().default([]),
    /** Set the first time the reading view is opened. */
    readAt: timestamp("read_at", { withTimezone: true }),
    /** Dealt with, but kept. The feed hides these; the archive shows them. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The same link saved by two tenants is two items, not a conflict.
    unique("items_tenant_canonical_key").on(t.tenantId, t.canonicalUrl),
    index("items_feed_idx")
      .on(t.tenantId, t.createdAt.desc(), t.id.desc())
      .where(sql`${t.archivedAt} is null`),
    index("items_archive_idx")
      .on(t.tenantId, t.archivedAt.desc())
      .where(sql`${t.archivedAt} is not null`),
    index("items_status_idx").on(t.tenantId, t.status),
    index("items_unread_idx")
      .on(t.tenantId, t.createdAt.desc())
      .where(sql`${t.readAt} is null`),
    index("items_tags_idx").using("gin", t.tags),
  ],
);

export const contents = pgTable("contents", {
  itemId: uuid("item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull(),
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
  tenantId: uuid("tenant_id").notNull(),
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
    tenantId: uuid("tenant_id").notNull(),
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
      .on(t.tenantId, t.runAfter)
      .where(sql`${t.lockedAt} is null`),
    index("jobs_locked_idx")
      .on(t.lockedAt)
      .where(sql`${t.lockedAt} is not null`),
  ],
);

export const apiTokens = pgTable("api_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsed: timestamp("last_used", { withTimezone: true }),
});

/**
 * items.search, contents.search and summaries.search are generated tsvector
 * columns created in migration 0001_search. They are left out of this schema
 * on purpose -- they are write-only as far as the app is concerned, and
 * selecting them would drag the whole document into every row.
 */
/**
 * One row per workspace. Holds the tenant's own credentials, which are other
 * people's secrets: encrypted with CREDENTIALS_KEY, which lives in the
 * environment and never in this table. The *_hint columns are the only part
 * the UI is allowed to render back.
 */
export const tenantSettings = pgTable("tenant_settings", {
  tenantId: uuid("tenant_id").primaryKey(),

  llmKeyEncrypted: text("llm_key_encrypted"),
  llmKeyHint: text("llm_key_hint"),
  llmModel: text("llm_model").notNull().default("openai/gpt-5.6-luna"),

  flyTokenEncrypted: text("fly_token_encrypted"),
  flyTokenHint: text("fly_token_hint"),
  flyAppName: text("fly_app_name"),
  flyMachineId: text("fly_machine_id"),

  /** The tenant's worker authenticates to the job api with this, hashed. */
  workerTokenHash: text("worker_token_hash"),
  workerStatus: workerStatusEnum("worker_status").notNull().default("none"),
  workerError: text("worker_error"),

  theme: themeEnum("theme").notNull().default("base").$type<Theme>(),
  themeMode: themeModeEnum("theme_mode").notNull().default("system").$type<ThemeMode>(),
  readingView: readingViewEnum("reading_view").notNull().default("summary").$type<ReadingView>(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Content = typeof contents.$inferSelect;
export type Summary = typeof summaries.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type ApiToken = typeof apiTokens.$inferSelect;
export type TenantSettings = typeof tenantSettings.$inferSelect;
