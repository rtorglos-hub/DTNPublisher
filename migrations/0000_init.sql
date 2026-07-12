-- Migration: Initialize config table
CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY,
  bot_token TEXT,
  channel_id TEXT,
  drive_url TEXT,
  updated_at DATETIME
);
