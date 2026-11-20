CREATE TABLE `api_zugaenge` (
	`betrieb_id` text NOT NULL,
	`zugang_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`name` text NOT NULL,
	`praefix` text NOT NULL,
	`token_hash` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	`gueltig_bis` integer,
	`zuletzt_genutzt` text,
	PRIMARY KEY(`betrieb_id`, `zugang_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_zugaenge_token_hash_unique` ON `api_zugaenge` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_zugaenge_person` ON `api_zugaenge` (`betrieb_id`,`nutzer_id`);