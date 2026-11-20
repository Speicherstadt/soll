CREATE TABLE `geraete` (
	`betrieb_id` text NOT NULL,
	`geraet_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`schluessel` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `geraet_id`)
);
--> statement-breakpoint
ALTER TABLE `stempelungen` ADD `geraet_id` text;--> statement-breakpoint
ALTER TABLE `stempelungen` ADD `nummer` integer;--> statement-breakpoint
ALTER TABLE `stempelungen` ADD `signatur` text;--> statement-breakpoint
ALTER TABLE `stempelungen` ADD `offline` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `stempelungen_geraet_nummer` ON `stempelungen` (`betrieb_id`,`geraet_id`,`nummer`);