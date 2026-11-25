ALTER TABLE `projektzeiten` ADD `import_id` text;--> statement-breakpoint
ALTER TABLE `projektzeiten` ADD `extern_quelle` text;--> statement-breakpoint
ALTER TABLE `projektzeiten` ADD `extern_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `projektzeiten_extern` ON `projektzeiten` (`betrieb_id`,`extern_quelle`,`extern_id`);