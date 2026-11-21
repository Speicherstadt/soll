CREATE TABLE `karten` (
	`betrieb_id` text NOT NULL,
	`karte_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`art` text NOT NULL,
	`uid_kennung` text NOT NULL,
	`schluessel` text,
	`zaehler` integer,
	`widerrufen_am` integer,
	`angelegt_von` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `karte_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `karten_uid` ON `karten` (`betrieb_id`,`uid_kennung`);