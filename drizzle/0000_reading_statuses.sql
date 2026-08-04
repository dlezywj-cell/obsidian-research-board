CREATE TABLE `reading_statuses` (
  `reader_key` text NOT NULL,
  `note_id` text NOT NULL,
  `read_at` text NOT NULL,
  PRIMARY KEY(`reader_key`, `note_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_reading_statuses_reader_key` ON `reading_statuses` (`reader_key`);
