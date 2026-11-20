CREATE TABLE `ausweise` (
	`betrieb_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`ausgestellt_von` text NOT NULL,
	`ausgestellt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `nutzer_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ausweise_token_hash_unique` ON `ausweise` (`token_hash`);--> statement-breakpoint
CREATE TABLE `terminals` (
	`betrieb_id` text NOT NULL,
	`terminal_id` text NOT NULL,
	`name` text NOT NULL,
	`kopplung_hash` text,
	`kopplung_bis` integer,
	`token_hash` text,
	`gekoppelt_am` integer,
	`widerrufen_am` integer,
	`fehlversuche` integer DEFAULT 0 NOT NULL,
	`sperren` integer DEFAULT 0 NOT NULL,
	`gesperrt_bis` integer,
	`fehler_tag` text,
	`angelegt_von` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `terminal_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `terminals_kopplung_hash_unique` ON `terminals` (`kopplung_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `terminals_token_hash_unique` ON `terminals` (`token_hash`);--> statement-breakpoint
ALTER TABLE `pins` ADD `pin_kennung` text;--> statement-breakpoint
CREATE UNIQUE INDEX `pins_kennung` ON `pins` (`betrieb_id`,`pin_kennung`);--> statement-breakpoint
ALTER TABLE `stempelungen` ADD `terminal_id` text;