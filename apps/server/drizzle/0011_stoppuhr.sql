CREATE TABLE `projektzeiten` (
	`betrieb_id` text NOT NULL,
	`buchung_id` text NOT NULL,
	`nutzer_id` text NOT NULL,
	`projekt_id` text,
	`taetigkeit_id` text NOT NULL,
	`beginn` integer NOT NULL,
	`ende` integer,
	`tag` text NOT NULL,
	`notiz` text DEFAULT '' NOT NULL,
	`abgerechnet_am` integer,
	`cent_pro_stunde` integer,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `buchung_id`)
);
--> statement-breakpoint
CREATE INDEX `projektzeiten_person` ON `projektzeiten` (`betrieb_id`,`nutzer_id`,`beginn`);--> statement-breakpoint
CREATE INDEX `projektzeiten_projekt` ON `projektzeiten` (`betrieb_id`,`projekt_id`);--> statement-breakpoint
CREATE INDEX `projektzeiten_taetigkeit` ON `projektzeiten` (`betrieb_id`,`taetigkeit_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `projektzeiten_laeuft` ON `projektzeiten` (`betrieb_id`,`nutzer_id`) WHERE "projektzeiten"."ende" is null;