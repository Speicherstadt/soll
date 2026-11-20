CREATE TABLE `kunden` (
	`betrieb_id` text NOT NULL,
	`kunde_id` text NOT NULL,
	`name` text NOT NULL,
	`nummer` text DEFAULT '' NOT NULL,
	`extern_quelle` text,
	`extern_id` text,
	`archiviert_am` integer,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `kunde_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kunden_extern` ON `kunden` (`betrieb_id`,`extern_quelle`,`extern_id`);--> statement-breakpoint
CREATE TABLE `projekte` (
	`betrieb_id` text NOT NULL,
	`projekt_id` text NOT NULL,
	`kunde_id` text NOT NULL,
	`name` text NOT NULL,
	`nummer` text DEFAULT '' NOT NULL,
	`budget_minuten` integer,
	`budget_cent` integer,
	`warnung_prozent` integer DEFAULT 80 NOT NULL,
	`extern_quelle` text,
	`extern_id` text,
	`archiviert_am` integer,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `projekt_id`)
);
--> statement-breakpoint
CREATE INDEX `projekte_kunde` ON `projekte` (`betrieb_id`,`kunde_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `projekte_extern` ON `projekte` (`betrieb_id`,`extern_quelle`,`extern_id`);--> statement-breakpoint
CREATE TABLE `stundensaetze` (
	`betrieb_id` text NOT NULL,
	`satz_id` text NOT NULL,
	`kunde_id` text,
	`projekt_id` text,
	`taetigkeit_id` text,
	`nutzer_id` text,
	`gueltig_ab` text NOT NULL,
	`cent_pro_stunde` integer NOT NULL,
	`schluessel` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `satz_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stundensaetze_schluessel` ON `stundensaetze` (`betrieb_id`,`schluessel`);--> statement-breakpoint
CREATE TABLE `taetigkeiten` (
	`betrieb_id` text NOT NULL,
	`taetigkeit_id` text NOT NULL,
	`name` text NOT NULL,
	`abrechenbar` integer NOT NULL,
	`extern_quelle` text,
	`extern_id` text,
	`archiviert_am` integer,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `taetigkeit_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `taetigkeiten_extern` ON `taetigkeiten` (`betrieb_id`,`extern_quelle`,`extern_id`);