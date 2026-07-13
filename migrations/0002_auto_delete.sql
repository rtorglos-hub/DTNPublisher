-- Migration: Add auto_delete_days column to config
ALTER TABLE config ADD COLUMN auto_delete_days INTEGER DEFAULT 10;
