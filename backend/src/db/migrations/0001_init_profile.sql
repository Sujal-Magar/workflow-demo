CREATE TABLE `password_change_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`attempted_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`avatar_url` text,
	`preferred_currency` text DEFAULT 'NPR' NOT NULL,
	`language` text DEFAULT 'en_US' NOT NULL,
	`monthly_start_date` integer DEFAULT 1 NOT NULL,
	`notification_budget_limit_alerts` integer DEFAULT true NOT NULL,
	`notification_goal_reminders` integer DEFAULT true NOT NULL,
	`notification_weekly_summary_emails` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `user_profiles_monthly_start_date_check` CHECK (monthly_start_date >= 1 AND monthly_start_date <= 28)
);
--> statement-breakpoint
CREATE INDEX `password_change_attempts_user_id_idx` ON `password_change_attempts` (`user_id`,`attempted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_user_id_unique` ON `user_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_profiles_user_id_idx` ON `user_profiles` (`user_id`);