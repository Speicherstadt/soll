CREATE TABLE `sollquellen` (
	`betrieb_id` text NOT NULL,
	`ab` text NOT NULL,
	`quelle` text NOT NULL,
	`angelegt_von` text NOT NULL,
	`angelegt_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `ab`)
);
