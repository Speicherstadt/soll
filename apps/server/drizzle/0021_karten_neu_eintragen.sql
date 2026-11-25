DROP INDEX `karten_uid`;--> statement-breakpoint
CREATE UNIQUE INDEX `karten_uid_aktiv` ON `karten` (`betrieb_id`,`uid_kennung`) WHERE "karten"."widerrufen_am" is null;