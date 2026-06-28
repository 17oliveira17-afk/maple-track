CREATE TYPE "public"."job_application_status" AS ENUM('SAVED', 'PREPARING', 'APPLIED', 'VIEWED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"external_id" text,
	"job_title" text NOT NULL,
	"company" text NOT NULL,
	"location" text,
	"salary" text,
	"job_url" text,
	"job_description" text,
	"is_aip" boolean DEFAULT false NOT NULL,
	"program" text,
	"status" "job_application_status" DEFAULT 'SAVED' NOT NULL,
	"applied_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"interview_at" timestamp with time zone,
	"generated_cover_letter" text,
	"cv_tips" text,
	"compatibility_score" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"job_titles" text[] DEFAULT '{}' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"noc_codes" text[] DEFAULT '{}' NOT NULL,
	"provinces" text[] DEFAULT '{"NB","NS","PE","NL"}' NOT NULL,
	"min_salary" integer,
	"aip_only" boolean DEFAULT true NOT NULL,
	"cv_text" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_preferences_profile_id_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "original_language" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "translation_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "translation_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "used_in_application" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_preferences" ADD CONSTRAINT "job_preferences_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;