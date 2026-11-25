CREATE TABLE `importe` (
	`betrieb_id` text NOT NULL,
	`import_id` text NOT NULL,
	`quelle` text NOT NULL,
	`datei_sha256` text NOT NULL,
	`datei_name` text NOT NULL,
	`datei_bytes` integer NOT NULL,
	`zuordnung` text NOT NULL,
	`abgeschlossen_bis` text,
	`zahlen` text NOT NULL,
	`erstellt_von` text NOT NULL,
	`erstellt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `import_id`)
);
--> statement-breakpoint
ALTER TABLE `monatsabschluesse` ADD `import_id` text;--> statement-breakpoint
ALTER TABLE `stempelungen` ADD `import_id` text;--> statement-breakpoint
ALTER TABLE `stempelungen` ADD `extern_quelle` text;--> statement-breakpoint
ALTER TABLE `stempelungen` ADD `extern_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `stempelungen_extern` ON `stempelungen` (`betrieb_id`,`extern_quelle`,`extern_id`);--> statement-breakpoint
ALTER TABLE `abwesenheiten` ADD `import_id` text;--> statement-breakpoint
ALTER TABLE `abwesenheiten` ADD `extern_quelle` text;--> statement-breakpoint
ALTER TABLE `abwesenheiten` ADD `extern_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `abwesenheiten_extern` ON `abwesenheiten` (`betrieb_id`,`extern_quelle`,`extern_id`);--> statement-breakpoint
ALTER TABLE `kunden` ADD `import_id` text;--> statement-breakpoint
ALTER TABLE `projekte` ADD `import_id` text;