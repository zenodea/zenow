-- Full-text search over the title, the summary and the extracted body.
-- Stored generated column so the index stays correct without triggers.
ALTER TABLE "items" ADD COLUMN "search" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("title", '') || ' ' || coalesce("url", ''))) STORED;
--> statement-breakpoint
CREATE INDEX "items_search_idx" ON "items" USING gin ("search");
--> statement-breakpoint

ALTER TABLE "contents" ADD COLUMN "search" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', left(coalesce("text", ''), 1000000))) STORED;
--> statement-breakpoint
CREATE INDEX "contents_search_idx" ON "contents" USING gin ("search");
--> statement-breakpoint

ALTER TABLE "summaries" ADD COLUMN "search" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("summary_md", ''))) STORED;
--> statement-breakpoint
CREATE INDEX "summaries_search_idx" ON "summaries" USING gin ("search");
