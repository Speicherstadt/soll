CREATE TABLE `einsaetze` (
	`betrieb_id` text NOT NULL,
	`einsatz_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`rufdienst_id` text NOT NULL,
	`beginn` integer NOT NULL,
	`ende` integer,
	`grund` text,
	`entfernt` integer DEFAULT false NOT NULL,
	`entfernt_grund` text,
	`erstellt_von` text NOT NULL,
	`erstellt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `einsatz_id`)
);
--> statement-breakpoint
CREATE INDEX `einsaetze_person` ON `einsaetze` (`betrieb_id`,`nutzer_id`,`beginn`);--> statement-breakpoint
CREATE TABLE `rufdienste` (
	`betrieb_id` text NOT NULL,
	`rufdienst_id` text NOT NULL,
	`standort_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`tag` text NOT NULL,
	`beginn` integer NOT NULL,
	`ende` integer NOT NULL,
	`reaktion_minuten` integer,
	`veroeffentlicht_am` integer,
	`angelegt_von` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `rufdienst_id`)
);
--> statement-breakpoint
CREATE INDEX `rufdienste_woche` ON `rufdienste` (`betrieb_id`,`standort_id`,`tag`);--> statement-breakpoint
CREATE INDEX `rufdienste_person` ON `rufdienste` (`betrieb_id`,`nutzer_id`,`tag`);--> statement-breakpoint
CREATE TABLE `sollquellen` (
	`betrieb_id` text NOT NULL,
	`ab` text NOT NULL,
	`quelle` text NOT NULL,
	`angelegt_von` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `ab`)
);
