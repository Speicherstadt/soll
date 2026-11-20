CREATE TABLE `abwesenheiten` (
	`betrieb_id` text NOT NULL,
	`abwesenheit_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`art` text NOT NULL,
	`von` text NOT NULL,
	`bis` text,
	`erster_halb` integer DEFAULT false NOT NULL,
	`letzter_halb` integer DEFAULT false NOT NULL,
	`status` text NOT NULL,
	`kind` text,
	`bescheinigung` text,
	`grund` text,
	`entschieden_von` text,
	`entschieden_am` integer,
	`erstellt_von` text NOT NULL,
	`erstellt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `abwesenheit_id`)
);
--> statement-breakpoint
CREATE INDEX `abwesenheiten_person` ON `abwesenheiten` (`betrieb_id`,`nutzer_id`,`von`);--> statement-breakpoint
ALTER TABLE `betriebe` ADD `bescheinigung_ab_tag` integer DEFAULT 4 NOT NULL;