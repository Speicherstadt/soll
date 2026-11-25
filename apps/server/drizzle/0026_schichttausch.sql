CREATE TABLE `schichttausche` (
	`betrieb_id` text NOT NULL,
	`tausch_id` text NOT NULL,
	`schicht_id` text NOT NULL,
	`anbieter_id` text NOT NULL,
	`an_nutzer_id` text,
	`uebernehmer_id` text,
	`status` text NOT NULL,
	`grund` text,
	`angeboten_am` integer NOT NULL,
	`uebernommen_am` integer,
	`entschieden_von` text,
	`entschieden_am` integer,
	PRIMARY KEY(`betrieb_id`, `tausch_id`)
);
--> statement-breakpoint
CREATE INDEX `schichttausche_schicht` ON `schichttausche` (`betrieb_id`,`schicht_id`);--> statement-breakpoint
CREATE TABLE `tauschregeln` (
	`betrieb_id` text PRIMARY KEY NOT NULL,
	`ohne_freigabe` integer NOT NULL
);
