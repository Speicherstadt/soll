CREATE TABLE `stundennachweis_buchungen` (
	`betrieb_id` text NOT NULL,
	`buchung_id` text NOT NULL,
	`nachweis_id` text NOT NULL,
	PRIMARY KEY(`betrieb_id`, `buchung_id`)
);
--> statement-breakpoint
CREATE INDEX `stundennachweis_buchungen_nachweis` ON `stundennachweis_buchungen` (`betrieb_id`,`nachweis_id`);--> statement-breakpoint
CREATE TABLE `stundennachweise` (
	`betrieb_id` text NOT NULL,
	`nachweis_id` text NOT NULL,
	`nummer` integer NOT NULL,
	`projekt_id` text NOT NULL,
	`nutzer_id` text,
	`von` text NOT NULL,
	`bis` text NOT NULL,
	`inhalt` text NOT NULL,
	`inhalt_hash` text NOT NULL,
	`unterschrieben_am` integer NOT NULL,
	`erstellt_von` text NOT NULL,
	PRIMARY KEY(`betrieb_id`, `nachweis_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stundennachweise_nummer` ON `stundennachweise` (`betrieb_id`,`nummer`);--> statement-breakpoint
CREATE INDEX `stundennachweise_projekt` ON `stundennachweise` (`betrieb_id`,`projekt_id`);