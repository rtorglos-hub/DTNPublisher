-- Migration: Add scheduling columns to config and create scheduled_posts table

ALTER TABLE config ADD COLUMN schedule_days TEXT;
ALTER TABLE config ADD COLUMN schedule_start TEXT;
ALTER TABLE config ADD COLUMN schedule_end TEXT;
ALTER TABLE config ADD COLUMN schedule_timezone TEXT DEFAULT 'Europe/Madrid';

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  summary TEXT,
  link TEXT,
  category TEXT,
  template TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME,
  error_message TEXT
);
