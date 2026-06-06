-- Watt-Werte für Indoor-Aktivitäten (z.B. Indoor-Cycling mit Smarttrainer/Powermeter).
-- Nur dort sinnvoll — bei Outdoor-Aktivitäten liefert Garmin i.d.R. keine Power-Daten.

alter table garmin_activities
  add column if not exists avg_power int,
  add column if not exists max_power int,
  add column if not exists norm_power int;
