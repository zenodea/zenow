CREATE TYPE "public"."theme" AS ENUM('base', 'catppuccin', 'gruvbox', 'everforest');--> statement-breakpoint
CREATE TYPE "public"."theme_mode" AS ENUM('system', 'light', 'dark');--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "theme" "theme" DEFAULT 'base' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant_settings" ADD COLUMN "theme_mode" "theme_mode" DEFAULT 'system' NOT NULL;