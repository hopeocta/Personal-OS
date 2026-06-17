-- Strukturierte deutsche Aufbereitung pro Artikel (4 Abschnitte als JSON)
ALTER TABLE literatur_entries ADD COLUMN IF NOT EXISTS sections_de jsonb;
