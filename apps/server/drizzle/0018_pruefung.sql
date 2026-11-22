CREATE TABLE `personenangaben` (
	`betrieb_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`geburtsdatum` text,
	`wechselschicht` integer DEFAULT false NOT NULL,
	`abruf` integer DEFAULT false NOT NULL,
	`mutterschutz` text DEFAULT '[]' NOT NULL,
	`geaendert_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `nutzer_id`)
);
--> statement-breakpoint
ALTER TABLE `betriebe` ADD `branche` text;--> statement-breakpoint
ALTER TABLE `betriebe` ADD `sonntagsausnahme` integer;--> statement-breakpoint
ALTER TABLE `betriebe` ADD `ausgleichszeitraum` text;--> statement-breakpoint
ALTER TABLE `betriebe` ADD `ausgleich_beginn` text;