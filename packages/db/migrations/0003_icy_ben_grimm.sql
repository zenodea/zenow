-- Tenancy. An organization (managed by Neon Auth) is the tenant.
--
-- Rows that predate this migration have no tenant. Rather than allow a
-- nullable tenant_id -- which is the one thing that could silently leak rows
-- between tenants -- they are parked on a real organization, and
-- scripts/adopt-legacy.mjs moves them into your own once you have signed in.
INSERT INTO neon_auth.organization (id, name, slug, "createdAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'Before tenancy', 'before-tenancy', now())
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

ALTER TABLE "items" DROP CONSTRAINT "items_canonical_url_unique";--> statement-breakpoint
DROP INDEX "items_feed_idx";--> statement-breakpoint
DROP INDEX "items_status_idx";--> statement-breakpoint
DROP INDEX "jobs_ready_idx";--> statement-breakpoint

-- DEFAULT backfills the existing rows; dropping it immediately after means
-- every future insert has to say which tenant it belongs to.
ALTER TABLE "api_tokens" ADD COLUMN "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
ALTER TABLE "contents" ADD COLUMN "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';--> statement-breakpoint
ALTER TABLE "summaries" ADD COLUMN "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';--> statement-breakpoint

ALTER TABLE "api_tokens" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "contents" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "summaries" ALTER COLUMN "tenant_id" DROP DEFAULT;--> statement-breakpoint

CREATE INDEX "items_feed_idx" ON "items" USING btree ("tenant_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "items_status_idx" ON "items" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "jobs_ready_idx" ON "jobs" USING btree ("tenant_id","run_after") WHERE "jobs"."locked_at" is null;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_tenant_canonical_key" UNIQUE("tenant_id","canonical_url");
