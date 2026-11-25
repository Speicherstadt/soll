CREATE TABLE `karten_lesungen` (
	`betrieb_id` text NOT NULL,
	`karte_id` text NOT NULL,
	`zaehler` integer NOT NULL,
	`gelesen_am` integer NOT NULL,
	PRIMARY KEY(`betrieb_id`, `karte_id`, `zaehler`)
);
