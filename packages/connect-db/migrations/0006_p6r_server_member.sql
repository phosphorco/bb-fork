CREATE TABLE `p6r_server_member` (
	`p6r_server_id` text NOT NULL,
	`p6r_user_id` text NOT NULL,
	`p6r_added_by_user_id` text NOT NULL,
	`p6r_created_at` integer NOT NULL,
	PRIMARY KEY(`p6r_server_id`, `p6r_user_id`),
	FOREIGN KEY (`p6r_server_id`) REFERENCES `server`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`p6r_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`p6r_added_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `p6r_server_member_user_id_idx` ON `p6r_server_member` (`p6r_user_id`);
