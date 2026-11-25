ALTER TABLE `schichten` ADD `import_id` text;--> statement-breakpoint
ALTER TABLE `schichten` ADD `extern_quelle` text;--> statement-breakpoint
ALTER TABLE `schichten` ADD `extern_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `schichten_extern` ON `schichten` (`betrieb_id`,`extern_quelle`,`extern_id`);