CREATE TABLE IF NOT EXISTS `gamezy_contests` (
	`contest_id` text PRIMARY KEY NOT NULL,
	`match_id` text,
	`contest_name` text NOT NULL,
	`total_spots` integer NOT NULL,
	`filled_spots` integer DEFAULT 0,
	`entry_fee` text NOT NULL,
	`total_prize_pool` text NOT NULL,
	`contest_type` text NOT NULL,
	`start_time` text NOT NULL,
	`status` text DEFAULT 'CREATED' NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `gamezy_matches`(`match_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `gamezy_matches` (
	`match_id` text PRIMARY KEY NOT NULL,
	`home_team_id` text,
	`away_team_id` text,
	`match_date` text NOT NULL,
	`match_type` text NOT NULL,
	`venue` text,
	`match_status` text NOT NULL,
	`toss_winner_team_id` text,
	`winning_team_id` text,
	FOREIGN KEY (`home_team_id`) REFERENCES `gamezy_teams`(`team_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`away_team_id`) REFERENCES `gamezy_teams`(`team_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`toss_winner_team_id`) REFERENCES `gamezy_teams`(`team_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winning_team_id`) REFERENCES `gamezy_teams`(`team_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `gamezy_player_performances` (
	`performance_id` text PRIMARY KEY NOT NULL,
	`match_id` text,
	`player_id` text,
	`runs_scored` integer DEFAULT 0,
	`balls_faced` integer DEFAULT 0,
	`wickets_taken` integer DEFAULT 0,
	`overs_bowled` text DEFAULT '0',
	`catches` integer DEFAULT 0,
	`stumpings` integer DEFAULT 0,
	`run_outs` integer DEFAULT 0,
	`strike_rate` text,
	`economy_rate` text,
	`total_fantasy_points` text DEFAULT '0',
	FOREIGN KEY (`match_id`) REFERENCES `gamezy_matches`(`match_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `gamezy_players`(`player_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `gamezy_players` (
	`player_id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`country` text NOT NULL,
	`player_type` text NOT NULL,
	`date_of_birth` text,
	`batting_style` text,
	`bowling_style` text,
	`player_role` text,
	`base_credit_value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `gamezy_squad` (
	`player_id` text,
	`team_id` text,
	`is_active` integer DEFAULT true,
	`joined_date` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `gamezy_players`(`player_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `gamezy_teams`(`team_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `gamezy_teams` (
	`team_id` text PRIMARY KEY NOT NULL,
	`team_name` text NOT NULL,
	`country` text NOT NULL,
	`logo_url` text,
	`team_type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `gamezy_user_team_players` (
	`user_team_id` text,
	`player_id` text,
	`is_captain` integer DEFAULT false,
	`is_vice_captain` integer DEFAULT false,
	FOREIGN KEY (`user_team_id`) REFERENCES `gamezy_user_teams`(`team_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `gamezy_players`(`player_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_team_player_pk` ON `gamezy_user_team_players` (`user_team_id`,`player_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `gamezy_user_teams` (
	`team_id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`match_id` text,
	`team_name` text(50),
	`total_points` text DEFAULT '0',
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `gamezy_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`match_id`) REFERENCES `gamezy_matches`(`match_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `gamezy_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`handle` text NOT NULL,
	`email` text NOT NULL,
	`total_balance` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `email_idx` ON `gamezy_users` (`email`);