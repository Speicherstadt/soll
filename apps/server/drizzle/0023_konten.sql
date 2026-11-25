CREATE TABLE `konto_anpassungen` (
	`betrieb_id` text NOT NULL,
	`anpassung_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`art` text NOT NULL,
	`monat` text,
	`jahr` integer,
	`minuten` integer,
	`halbtage` integer,
	`grund` text NOT NULL,
	`erstellt_von` text NOT NULL,
	`erstellt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `anpassung_id`)
);
--> statement-breakpoint
CREATE INDEX `konto_anpassungen_person` ON `konto_anpassungen` (`betrieb_id`,`nutzer_id`);--> statement-breakpoint
CREATE TABLE `urlaubshinweise` (
	`betrieb_id` text NOT NULL,
	`hinweis_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`tag` text NOT NULL,
	`inhalt` text NOT NULL,
	`erstellt_von` text NOT NULL,
	`erstellt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `hinweis_id`)
);
--> statement-breakpoint
CREATE INDEX `urlaubshinweise_person` ON `urlaubshinweise` (`betrieb_id`,`nutzer_id`,`tag`);