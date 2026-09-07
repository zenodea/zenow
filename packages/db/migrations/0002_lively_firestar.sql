ALTER TABLE "items" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "items_tags_idx" ON "items" USING gin ("tags");