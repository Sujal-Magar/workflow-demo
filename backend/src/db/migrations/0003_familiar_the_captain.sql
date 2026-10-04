CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT `transactions_amount_check` CHECK (amount > 0)
);
--> statement-breakpoint
INSERT INTO `__new_transactions` (`id`, `user_id`, `title`, `date`, `description`, `category`, `type`, `amount`, `created_at`, `updated_at`) SELECT `id`, `user_id`, SUBSTR(`description`, 1, 100), `date`, `description`, `category`, `type`, `amount`, `created_at`, `updated_at` FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `transactions_user_id_idx` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `transactions_user_id_date_idx` ON `transactions` (`user_id`,`date`);
