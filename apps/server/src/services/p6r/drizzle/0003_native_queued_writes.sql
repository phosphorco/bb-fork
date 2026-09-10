CREATE TABLE `p6r_pending_native_writes` (
	`queued_message_id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`accepted_at` integer NOT NULL,
	`accepted_authorship` text NOT NULL,
	`latest_editor` text NOT NULL,
	`input` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `p6r_pending_native_writes_thread_idx` ON `p6r_pending_native_writes` (`thread_id`);
