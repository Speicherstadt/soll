CREATE TABLE `terminal_eintraege` (
	`betrieb_id` text NOT NULL,
	`terminal_id` text NOT NULL,
	`nummer` integer NOT NULL,
	`inhalt_hash` text NOT NULL,
	`art` text NOT NULL,
	`geraet_zeitpunkt` integer NOT NULL,
	`stempel_id` text,
	`grund` text,
	`empfangen_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `terminal_id`, `nummer`)
);
--> statement-breakpoint
ALTER TABLE `terminals` ADD `schluessel` text;