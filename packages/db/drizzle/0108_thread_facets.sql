CREATE TABLE `thread_facet_cursor_keys` (
	`key_id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `thread_facet_declarations` (
	`type_scope` text NOT NULL,
	`type_owner` text NOT NULL,
	`local_name` text NOT NULL,
	`member_kind` text NOT NULL,
	`cardinality` text NOT NULL,
	`assignment_scope` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`type_scope`, `type_owner`, `local_name`)
);
--> statement-breakpoint
CREATE TABLE `thread_facet_members` (
	`type_scope` text NOT NULL,
	`type_owner` text NOT NULL,
	`local_name` text NOT NULL,
	`member_id` text NOT NULL,
	`member_rank` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`type_scope`, `type_owner`, `local_name`, `member_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `thread_facet_members_rank_idx` ON `thread_facet_members` (`type_scope`,`type_owner`,`local_name`,`member_rank`);--> statement-breakpoint
CREATE TABLE `thread_facet_owners` (
	`type_scope` text NOT NULL,
	`type_owner` text NOT NULL,
	`local_name` text NOT NULL,
	`assignment_scope` text NOT NULL,
	`generation` integer NOT NULL,
	`state` text NOT NULL,
	`census_exhausted` integer DEFAULT false NOT NULL,
	`census_terminal_delivered` integer DEFAULT false NOT NULL,
	`projection_revision` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`type_scope`, `type_owner`, `local_name`, `assignment_scope`)
);
--> statement-breakpoint
CREATE TABLE `thread_facet_principal_profiles` (
	`type_scope` text NOT NULL,
	`type_owner` text NOT NULL,
	`local_name` text NOT NULL,
	`assignment_scope` text NOT NULL,
	`thread_id` text NOT NULL,
	`principal_key` text NOT NULL,
	`member_position` integer NOT NULL,
	`display_name` text NOT NULL,
	`image_url` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`type_scope`, `type_owner`, `local_name`, `assignment_scope`, `thread_id`, `principal_key`),
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `thread_facet_principal_profiles_position_idx` ON `thread_facet_principal_profiles` (`type_scope`,`type_owner`,`local_name`,`assignment_scope`,`thread_id`,`member_position`);--> statement-breakpoint
CREATE TABLE `thread_facet_reconciliation_targets` (
	`type_scope` text NOT NULL,
	`type_owner` text NOT NULL,
	`local_name` text NOT NULL,
	`assignment_scope` text NOT NULL,
	`owner_generation` integer NOT NULL,
	`thread_id` text NOT NULL,
	`discharged` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`type_scope`, `type_owner`, `local_name`, `assignment_scope`, `owner_generation`, `thread_id`),
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `thread_facet_reconciliation_targets_pending_idx` ON `thread_facet_reconciliation_targets` (`type_scope`,`type_owner`,`local_name`,`assignment_scope`,`owner_generation`,`discharged`,`thread_id`);--> statement-breakpoint
CREATE TABLE `thread_facet_relations` (
	`type_scope` text NOT NULL,
	`type_owner` text NOT NULL,
	`local_name` text NOT NULL,
	`assignment_scope` text NOT NULL,
	`thread_id` text NOT NULL,
	`member_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`type_scope`, `type_owner`, `local_name`, `assignment_scope`, `thread_id`, `member_id`),
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `thread_facet_relations_member_thread_idx` ON `thread_facet_relations` (`type_scope`,`type_owner`,`local_name`,`assignment_scope`,`member_id`,`thread_id`);--> statement-breakpoint
CREATE TABLE `thread_facet_snapshots` (
	`type_scope` text NOT NULL,
	`type_owner` text NOT NULL,
	`local_name` text NOT NULL,
	`assignment_scope` text NOT NULL,
	`thread_id` text NOT NULL,
	`owner_generation` integer NOT NULL,
	`source_version` integer,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`type_scope`, `type_owner`, `local_name`, `assignment_scope`, `thread_id`),
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `thread_facet_snapshots_generation_thread_idx` ON `thread_facet_snapshots` (`type_scope`,`type_owner`,`local_name`,`assignment_scope`,`owner_generation`,`thread_id`);