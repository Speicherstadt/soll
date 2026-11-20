CREATE TABLE `erinnerungen` (
	`betrieb_id` text NOT NULL,
	`erinnerung_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`art` text NOT NULL,
	`bezug` text NOT NULL,
	`erstellt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `erinnerung_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `erinnerungen_einmal` ON `erinnerungen` (`betrieb_id`,`nutzer_id`,`art`,`bezug`);--> statement-breakpoint
CREATE TABLE `erinnerungseinstellungen` (
	`betrieb_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`ausstempeln` integer NOT NULL,
	`pause` integer NOT NULL,
	`monat` integer NOT NULL,
	`mail` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `nutzer_id`)
);
--> statement-breakpoint
CREATE TABLE `erinnerungsregeln` (
	`betrieb_id` text PRIMARY KEY NOT NULL,
	`gehen_minuten` integer NOT NULL,
	`pause_vorlauf` integer NOT NULL,
	`monat_tag` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `instanzschluessel` (
	`betrieb_id` text NOT NULL,
	`name` text NOT NULL,
	`oeffentlich` text NOT NULL,
	`privat` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `name`)
);
--> statement-breakpoint
CREATE TABLE `push_abos` (
	`betrieb_id` text NOT NULL,
	`abo_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`endpunkt_hash` text NOT NULL,
	`abo` text NOT NULL,
	`sprache` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `abo_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_abos_endpunkt` ON `push_abos` (`betrieb_id`,`endpunkt_hash`);--> statement-breakpoint
CREATE INDEX `push_abos_person` ON `push_abos` (`betrieb_id`,`nutzer_id`);