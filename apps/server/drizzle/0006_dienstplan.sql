CREATE TABLE `bedarfe` (
	`betrieb_id` text NOT NULL,
	`bedarf_id` text NOT NULL,
	`standort_id` text NOT NULL,
	`rolle` text NOT NULL,
	`wochentag` integer NOT NULL,
	`beginn_minute` integer NOT NULL,
	`ende_minute` integer NOT NULL,
	`anzahl` integer NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `bedarf_id`)
);
--> statement-breakpoint
CREATE TABLE `schichten` (
	`betrieb_id` text NOT NULL,
	`schicht_id` text NOT NULL,
	`standort_id` text NOT NULL,
	`tag` text NOT NULL,
	`beginn` integer NOT NULL,
	`ende` integer NOT NULL,
	`pause_minuten` integer DEFAULT 0 NOT NULL,
	`rolle` text DEFAULT '' NOT NULL,
	`nutzer_id` text,
	`vorlage_id` text,
	`veroeffentlicht_am` integer,
	`angelegt_von` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `schicht_id`)
);
--> statement-breakpoint
CREATE INDEX `schichten_woche` ON `schichten` (`betrieb_id`,`standort_id`,`tag`);--> statement-breakpoint
CREATE INDEX `schichten_person` ON `schichten` (`betrieb_id`,`nutzer_id`,`tag`);--> statement-breakpoint
CREATE TABLE `schichtvorlagen` (
	`betrieb_id` text NOT NULL,
	`vorlage_id` text NOT NULL,
	`name` text NOT NULL,
	`beginn_minute` integer NOT NULL,
	`ende_minute` integer NOT NULL,
	`pause_minuten` integer DEFAULT 0 NOT NULL,
	`rolle` text DEFAULT '' NOT NULL,
	`standort_id` text,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `vorlage_id`)
);
