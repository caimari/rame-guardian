CREATE TABLE `repair_applications` (
	`request_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repair_assertions` (
	`id` text PRIMARY KEY NOT NULL,
	`ok` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "repair_assertion_must_hold" CHECK("repair_assertions"."ok" = 1)
);
--> statement-breakpoint
CREATE TABLE `repair_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`change_request` text NOT NULL,
	`target_decision_key` text NOT NULL,
	`target_decision_version` integer NOT NULL,
	`target_hours` integer NOT NULL,
	`base_versions_json` text NOT NULL,
	`operations_json` text NOT NULL,
	`impact_json` text NOT NULL,
	`model_json` text NOT NULL,
	`approval_hash` text,
	`approved_at` integer,
	`applied_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_results` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`content_json` text NOT NULL,
	`dependencies_json` text NOT NULL,
	`human_edited_paths_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
