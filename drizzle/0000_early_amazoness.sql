CREATE TABLE `ai_usages` (
	`post_id` integer PRIMARY KEY NOT NULL,
	`used` integer DEFAULT false NOT NULL,
	`targets` text,
	`human_review_level` text,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`url` text NOT NULL,
	`label` text,
	`ord` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `links_post_idx` ON `links` (`post_id`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`filename` text NOT NULL,
	`original_ref` text,
	`public_url` text,
	`ord` integer DEFAULT 0 NOT NULL,
	`alt` text,
	`caption` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_post_idx` ON `media` (`post_id`);--> statement-breakpoint
CREATE TABLE `place_tags` (
	`place_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`place_id`, `tag_id`),
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `places` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`display_name` text,
	`lat` real,
	`lng` real,
	`base_location_level` text DEFAULT 'A' NOT NULL,
	`map_display_default` integer DEFAULT true NOT NULL,
	`access_note` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `places_slug_unique` ON `places` (`slug`);--> statement-breakpoint
CREATE INDEX `places_slug_idx` ON `places` (`slug`);--> statement-breakpoint
CREATE TABLE `post_tags` (
	`post_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`post_id`, `tag_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `post_themes` (
	`post_id` integer NOT NULL,
	`theme_slug` text NOT NULL,
	PRIMARY KEY(`post_id`, `theme_slug`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`theme_slug`) REFERENCES `themes`(`slug`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text,
	`body` text,
	`mode` text DEFAULT 'standard' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`shooting_date` text,
	`season_slug` text,
	`time_of_day` text,
	`place_id` integer,
	`map_display` integer,
	`location_level_override` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`season_slug`) REFERENCES `seasons`(`slug`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_slug_idx` ON `posts` (`slug`);--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`);--> statement-breakpoint
CREATE INDEX `posts_place_idx` ON `posts` (`place_id`);--> statement-breakpoint
CREATE TABLE `publish_checklists` (
	`post_id` integer PRIMARY KEY NOT NULL,
	`media_safety_cleared` integer DEFAULT false NOT NULL,
	`map_display_ok` text DEFAULT 'unreviewed' NOT NULL,
	`location_level_ok` text DEFAULT 'unreviewed' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `safety_reviews` (
	`media_id` integer PRIMARY KEY NOT NULL,
	`exif_gps_ok` integer DEFAULT false NOT NULL,
	`face_ok` text DEFAULT 'unreviewed' NOT NULL,
	`child_minor_ok` text DEFAULT 'unreviewed' NOT NULL,
	`nameplate_plate_ok` text DEFAULT 'unreviewed' NOT NULL,
	`private_life_ok` text DEFAULT 'unreviewed' NOT NULL,
	`landmark_level_ok` text DEFAULT 'unreviewed' NOT NULL,
	`ogp_ok` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `static_pages` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`locale_fields` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `themes` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
