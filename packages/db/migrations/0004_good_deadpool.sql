CREATE TYPE "public"."worker_status" AS ENUM('none', 'provisioning', 'running', 'stopped', 'error');--> statement-breakpoint
CREATE TABLE "tenant_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"llm_key_encrypted" text,
	"llm_key_hint" text,
	"llm_model" text DEFAULT 'anthropic/claude-haiku-4.5' NOT NULL,
	"fly_token_encrypted" text,
	"fly_token_hint" text,
	"fly_app_name" text,
	"fly_machine_id" text,
	"worker_token_hash" text,
	"worker_status" "worker_status" DEFAULT 'none' NOT NULL,
	"worker_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
