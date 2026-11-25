CREATE TABLE `aussonderungen` (
	`betrieb_id` text NOT NULL,
	`aussonderung_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`monat` text NOT NULL,
	`abschluss_id` text NOT NULL,
	`jahre` integer NOT NULL,
	`abgeschlossen_am` integer NOT NULL,
	`ausgesondert_am` integer NOT NULL,
	`zeilen` integer NOT NULL,
	`inhalte` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `aussonderung_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aussonderungen_monat` ON `aussonderungen` (`betrieb_id`,`nutzer_id`,`monat`);--> statement-breakpoint
CREATE UNIQUE INDEX `aussonderungen_abschluss` ON `aussonderungen` (`betrieb_id`,`abschluss_id`);