-- Migration: Add app_settings table for runtime admin-controlled toggles
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT 'true',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for app_settings" ON app_settings;
CREATE POLICY "Public read access for app_settings" ON app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated write access for app_settings" ON app_settings;
CREATE POLICY "Authenticated write access for app_settings" ON app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed the default: show_demo_button is ON
INSERT INTO app_settings (key, value)
VALUES ('show_demo_button', 'true')
ON CONFLICT (key) DO NOTHING;
