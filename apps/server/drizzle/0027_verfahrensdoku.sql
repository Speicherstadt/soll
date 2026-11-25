CREATE TABLE `verfahrensdoku_angaben` (
	`betrieb_id` text PRIMARY KEY NOT NULL,
	`rechtsform` text DEFAULT '' NOT NULL,
	`anschrift` text DEFAULT '' NOT NULL,
	`verantwortlich` text DEFAULT '' NOT NULL,
	`aufbewahrungsort` text DEFAULT '' NOT NULL,
	`serverbetrieb` text DEFAULT '' NOT NULL,
	`datensicherung` text DEFAULT '' NOT NULL,
	`schluesselablage` text DEFAULT '' NOT NULL,
	`eigene` text DEFAULT '[]' NOT NULL,
	`geaendert_am` integer NOT NULL
);
