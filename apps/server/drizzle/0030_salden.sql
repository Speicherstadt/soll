ALTER TABLE `konto_anpassungen` ADD `import_id` text;--> statement-breakpoint
ALTER TABLE `konto_anpassungen` ADD `extern_quelle` text;--> statement-breakpoint
ALTER TABLE `konto_anpassungen` ADD `extern_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `konto_anpassungen_extern` ON `konto_anpassungen` (`betrieb_id`,`extern_quelle`,`extern_id`);