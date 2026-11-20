CREATE TABLE `datev_einstellungen` (
	`betrieb_id` text PRIMARY KEY NOT NULL,
	`berater_nr` text,
	`mandanten_nr` text,
	`lohnarten` text DEFAULT '{}' NOT NULL,
	`geaendert_am` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `datev_personalnummern` (
	`betrieb_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`personalnummer` text NOT NULL,
	PRIMARY KEY(`betrieb_id`, `nutzer_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `datev_personalnummern_einmal` ON `datev_personalnummern` (`betrieb_id`,`personalnummer`);--> statement-breakpoint
ALTER TABLE `arbeitszeitmodelle` ADD `zuschlagssaetze` text DEFAULT '{}' NOT NULL;