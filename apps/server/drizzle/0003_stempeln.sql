CREATE TABLE `modellzuordnungen` (
	`betrieb_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`gueltig_ab` text NOT NULL,
	`modell_id` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `nutzer_id`, `gueltig_ab`)
);
--> statement-breakpoint
CREATE TABLE `stempelungen` (
	`betrieb_id` text NOT NULL,
	`stempel_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`art` text NOT NULL,
	`zeitpunkt` integer NOT NULL,
	`geraet_zeitpunkt` integer,
	`quelle` text NOT NULL,
	`ersetzt` text,
	`entfernt` integer DEFAULT false NOT NULL,
	`grund` text,
	`erstellt_von` text NOT NULL,
	`erstellt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `stempel_id`)
);
--> statement-breakpoint
CREATE INDEX `stempelungen_person` ON `stempelungen` (`betrieb_id`,`nutzer_id`,`zeitpunkt`);--> statement-breakpoint
CREATE UNIQUE INDEX `stempelungen_ersetzt` ON `stempelungen` (`betrieb_id`,`ersetzt`);