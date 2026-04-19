CREATE TYPE "public"."quote_category" AS ENUM('general', 'stoicism', 'motivation', 'discipline');--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"body" text NOT NULL,
	"author" text,
	"category" "quote_category" DEFAULT 'general' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
