-- Pro-Person Garmin-iCal-Export-URL (Runna → Garmin → iCal).
-- Ermöglicht, die geplanten Runna-Läufe einer Person in ihre Athleten-PWA zu
-- mischen — analog zum eigenen Setup über die Env-Variable GARMIN_ICAL_URL,
-- nur eben pro Person in der DB statt global.
-- Sensibel (enthält ein Kalender-Token): persons hat RLS deny-all, nur der
-- Service-Role-Client liest die Spalte serverseitig.

alter table persons add column if not exists garmin_ical_url text;
