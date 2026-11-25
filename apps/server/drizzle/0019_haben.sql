CREATE TABLE `haben_uebergaben` (
	`betrieb_id` text NOT NULL,
	`buchung_id` text NOT NULL,
	`inhalt` text,
	`leistung_id` text,
	`gesendet_am` integer,
	`fehler` text,
	`meldung` text,
	`versucht_am` integer,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `buchung_id`)
);
--> statement-breakpoint
CREATE TABLE `haben_zugaenge` (
	`betrieb_id` text PRIMARY KEY NOT NULL,
	`adresse` text NOT NULL,
	`token` text NOT NULL,
	`geaendert_am` integer NOT NULL
);
