DROP INDEX "items_feed_idx";--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "items_archive_idx" ON "items" USING btree ("tenant_id","archived_at" DESC NULLS LAST) WHERE "items"."archived_at" is not null;--> statement-breakpoint
CREATE INDEX "items_feed_idx" ON "items" USING btree ("tenant_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "items"."archived_at" is null;