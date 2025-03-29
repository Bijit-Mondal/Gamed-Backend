CREATE TABLE `gamezy_contest_enrollments` (
	`enrollment_id` text PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`user_team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`enrollment_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`rank` integer,
	`winnings` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	FOREIGN KEY (`contest_id`) REFERENCES `gamezy_contests`(`contest_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_team_id`) REFERENCES `gamezy_user_teams`(`team_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `gamezy_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_enrollment_idx` ON `gamezy_contest_enrollments` (`contest_id`,`user_team_id`);