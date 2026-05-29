-- Ruheherzfrequenz (resting heart rate) zur Schlaf-Tabelle hinzufügen.
-- Garmin liefert den Tageswert direkt in der Schlaf-Antwort (SleepData.restingHeartRate),
-- daher wird er im selben getSleepData-Call befüllt (Sync + Backfill).
-- Einheit: Schläge pro Minute (bpm).

ALTER TABLE garmin_sleep ADD COLUMN IF NOT EXISTS resting_hr int;
