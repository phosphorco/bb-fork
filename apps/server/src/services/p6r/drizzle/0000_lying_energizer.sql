CREATE TABLE `p6r_attempt_inputs` (
	`attempt_id` text NOT NULL,
	`group_index` integer NOT NULL,
	`source_index` integer NOT NULL,
	`source_kind` text NOT NULL,
	`contribution_id` text,
	`snapshot` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `p6r_attempt_inputs_attempt_group_source_idx` ON `p6r_attempt_inputs` (`attempt_id`,`group_index`,`source_index`);--> statement-breakpoint
CREATE INDEX `p6r_attempt_inputs_contribution_idx` ON `p6r_attempt_inputs` (`contribution_id`);--> statement-breakpoint
CREATE TABLE `p6r_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`native_request_id` text,
	`native_turn_id` text,
	`retry_of_attempt_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `p6r_attempts_thread_created_idx` ON `p6r_attempts` (`thread_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `p6r_attempts_native_request_idx` ON `p6r_attempts` (`native_request_id`);--> statement-breakpoint
CREATE TABLE `p6r_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`accepted_at` integer NOT NULL,
	`accepted_authorship` text NOT NULL,
	`initial_input` text NOT NULL,
	`current_projection` text NOT NULL,
	`latest_editor` text NOT NULL,
	`copied_from_contribution_id` text,
	`replaces_contribution_id` text,
	`native_request_id` text
);
--> statement-breakpoint
CREATE INDEX `p6r_contributions_thread_accepted_idx` ON `p6r_contributions` (`thread_id`,`accepted_at`,`id`);--> statement-breakpoint
CREATE INDEX `p6r_contributions_native_request_idx` ON `p6r_contributions` (`native_request_id`);--> statement-breakpoint
CREATE TABLE `p6r_operation_receipts` (
	`operation_id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`contribution_id` text,
	`native_request_id` text,
	`accepted_request_sequence` integer,
	`payload_hash` text NOT NULL,
	`status` text NOT NULL,
	`accepted_at` integer NOT NULL,
	`retention_deadline` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `p6r_operation_receipts_operation_hash_idx` ON `p6r_operation_receipts` (`operation_id`,`payload_hash`);--> statement-breakpoint
CREATE INDEX `p6r_operation_receipts_thread_accepted_idx` ON `p6r_operation_receipts` (`thread_id`,`accepted_at`);