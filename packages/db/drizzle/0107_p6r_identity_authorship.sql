CREATE TABLE `p6r_actors` (
	`p6r_provider_id` text NOT NULL,
	`p6r_subject` text NOT NULL,
	`p6r_handle` text NOT NULL,
	`p6r_display_name` text NOT NULL,
	`p6r_image_url` text,
	`p6r_first_seen_at` integer NOT NULL,
	`p6r_last_seen_at` integer NOT NULL,
	PRIMARY KEY(`p6r_provider_id`, `p6r_subject`)
);
--> statement-breakpoint
CREATE TABLE `p6r_collaborators` (
	`p6r_handle` text PRIMARY KEY NOT NULL,
	`p6r_display_name` text NOT NULL,
	`p6r_image_url` text,
	`p6r_first_seen_at` integer NOT NULL,
	`p6r_last_seen_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `events` ADD `p6r_actor_handle` text;--> statement-breakpoint
ALTER TABLE `events` ADD `p6r_actor_provider_id` text;--> statement-breakpoint
ALTER TABLE `events` ADD `p6r_actor_subject` text;--> statement-breakpoint
ALTER TABLE `events` ADD `p6r_actor_display_name` text;--> statement-breakpoint
ALTER TABLE `events` ADD `p6r_actor_image_url` text;--> statement-breakpoint
ALTER TABLE `pending_interactions` ADD `p6r_resolved_by_handle` text;--> statement-breakpoint
ALTER TABLE `queued_thread_messages` ADD `p6r_actor_handle` text;--> statement-breakpoint
ALTER TABLE `queued_thread_messages` ADD `p6r_actor_provider_id` text;--> statement-breakpoint
ALTER TABLE `queued_thread_messages` ADD `p6r_actor_subject` text;--> statement-breakpoint
ALTER TABLE `queued_thread_messages` ADD `p6r_actor_display_name` text;--> statement-breakpoint
ALTER TABLE `queued_thread_messages` ADD `p6r_actor_image_url` text;--> statement-breakpoint
ALTER TABLE `threads` ADD `p6r_created_by_handle` text;