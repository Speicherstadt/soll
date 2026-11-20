CREATE TABLE `audit_glieder` (
	`betrieb_id` text NOT NULL,
	`seq` integer NOT NULL,
	`zeitpunkt` integer NOT NULL,
	`akteur` text NOT NULL,
	`tabelle` text NOT NULL,
	`zeile` text NOT NULL,
	`aktion` text NOT NULL,
	`inhalt_hash` text NOT NULL,
	`vorgaenger_hash` text NOT NULL,
	`hash` text NOT NULL,
	PRIMARY KEY(`betrieb_id`, `seq`)
);
--> statement-breakpoint
CREATE INDEX `audit_glieder_zeile` ON `audit_glieder` (`betrieb_id`,`tabelle`,`zeile`);--> statement-breakpoint
CREATE TABLE `audit_inhalte` (
	`betrieb_id` text NOT NULL,
	`seq` integer NOT NULL,
	`inhalt` text NOT NULL,
	PRIMARY KEY(`betrieb_id`, `seq`)
);
--> statement-breakpoint
CREATE TABLE `audit_koepfe` (
	`betrieb_id` text PRIMARY KEY NOT NULL,
	`seq` integer NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `betriebe` (
	`betrieb_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`angelegt_am` integer NOT NULL
);
