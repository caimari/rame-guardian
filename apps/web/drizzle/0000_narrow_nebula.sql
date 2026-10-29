CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`subject_id` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `memory_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`statement` text NOT NULL,
	`scope` text NOT NULL,
	`confidence` real NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`digest` text NOT NULL,
	`source` text DEFAULT 'conversation' NOT NULL,
	`status` text DEFAULT 'authorized' NOT NULL,
	`created_at` integer NOT NULL
);
