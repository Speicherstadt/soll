CREATE TABLE `kalender_abos` (
	`betrieb_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`sprache` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `nutzer_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kalender_abos_token_hash_unique` ON `kalender_abos` (`token_hash`);