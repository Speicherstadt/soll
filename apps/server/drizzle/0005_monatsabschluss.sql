CREATE TABLE `korrekturen` (
	`betrieb_id` text NOT NULL,
	`korrektur_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`tag` text NOT NULL,
	`minuten` integer NOT NULL,
	`grund` text NOT NULL,
	`gebucht_in` text NOT NULL,
	`erstellt_von` text NOT NULL,
	`erstellt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `korrektur_id`)
);
--> statement-breakpoint
CREATE INDEX `korrekturen_person` ON `korrekturen` (`betrieb_id`,`nutzer_id`,`tag`);--> statement-breakpoint
CREATE TABLE `monatsabschluesse` (
	`betrieb_id` text NOT NULL,
	`abschluss_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`monat` text NOT NULL,
	`schritt` text NOT NULL,
	`inhalt` text NOT NULL,
	`inhalt_hash` text NOT NULL,
	`grund` text,
	`sperrt` text,
	`erstellt_von` text NOT NULL,
	`erstellt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `abschluss_id`)
);
--> statement-breakpoint
CREATE INDEX `monatsabschluesse_person` ON `monatsabschluesse` (`betrieb_id`,`nutzer_id`,`monat`);--> statement-breakpoint
CREATE UNIQUE INDEX `monatsabschluesse_einmal` ON `monatsabschluesse` (`betrieb_id`,`nutzer_id`,`sperrt`);