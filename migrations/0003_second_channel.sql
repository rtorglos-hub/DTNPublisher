-- Migration: Add a second Telegram channel and persist channel per scheduled post

ALTER TABLE config ADD COLUMN channel_id_2 TEXT;
ALTER TABLE config ADD COLUMN selected_channel TEXT DEFAULT 'primary';

ALTER TABLE scheduled_posts ADD COLUMN channel_id TEXT;
ALTER TABLE scheduled_posts ADD COLUMN channel_label TEXT;

UPDATE scheduled_posts
SET
  channel_id = (SELECT channel_id FROM config WHERE id = 1),
  channel_label = 'Canal 1'
WHERE channel_id IS NULL OR channel_id = '';
