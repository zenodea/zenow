CREATE TYPE "public"."reading_view" AS ENUM('summary', 'original');--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "reading_view" "reading_view" DEFAULT 'summary' NOT NULL;