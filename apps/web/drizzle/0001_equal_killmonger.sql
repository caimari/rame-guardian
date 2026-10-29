CREATE TABLE `action_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`allowed` integer NOT NULL,
	`code` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `authority_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`decision_key` text NOT NULL,
	`kind` text NOT NULL,
	`value_json` text NOT NULL,
	`statement` text NOT NULL,
	`version` integer NOT NULL,
	`previous_decision_id` text,
	`authorized_by` text NOT NULL,
	`authorized_at` integer NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `authority_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`decision_key` text NOT NULL,
	`kind` text NOT NULL,
	`value_json` text NOT NULL,
	`statement` text NOT NULL,
	`based_on_version` integer,
	`status` text NOT NULL,
	`source_ref` text NOT NULL,
	`source_excerpt` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `authorization_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`decision_id` text NOT NULL,
	`user_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`signature` text NOT NULL,
	`key_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action_id` text NOT NULL,
	`title` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signing_keys` (
	`key_id` text PRIMARY KEY NOT NULL,
	`private_jwk` text NOT NULL,
	`public_jwk` text NOT NULL,
	`created_at` integer NOT NULL
);
