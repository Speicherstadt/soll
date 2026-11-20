CREATE TABLE `arbeitszeitmodelle` (
	`betrieb_id` text NOT NULL,
	`modell_id` text NOT NULL,
	`name` text NOT NULL,
	`soll_minuten` text NOT NULL,
	`lohn_art` text NOT NULL,
	`lohn_cent` integer,
	`minijob` integer DEFAULT false NOT NULL,
	`gueltig_ab` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `modell_id`)
);
--> statement-breakpoint
CREATE TABLE `standorte` (
	`betrieb_id` text NOT NULL,
	`standort_id` text NOT NULL,
	`name` text NOT NULL,
	`adresse` text DEFAULT '' NOT NULL,
	`land` text NOT NULL,
	`regionen` text DEFAULT '[]' NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `standort_id`)
);
--> statement-breakpoint
ALTER TABLE `betriebe` ADD `land` text;--> statement-breakpoint
ALTER TABLE `betriebe` ADD `eingerichtet_am` integer;