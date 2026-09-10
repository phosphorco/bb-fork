CREATE TABLE `p6r_pending_queued_dispatches` (
	`queued_message_id` text PRIMARY KEY NOT NULL,
	`operation_id` text NOT NULL,
	`contribution_id` text NOT NULL,
	`accepted_authorship` text NOT NULL,
	`input` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `p6r_pending_queued_dispatches_operation_idx` ON `p6r_pending_queued_dispatches` (`operation_id`);