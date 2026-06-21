-- Athleten-Profil pro Person: damit die Trainingssteuerung (HF-Zonen, Alter,
-- Pensum, Analyse-Erkenntnisse) strukturiert hinterlegt ist und der Plan daraus
-- gebaut wird — statt nur als Fließtext im Session-Log zu existieren.
--   age           — Alter (Regeneration/Volumen)
--   hf_max        — gemessene maximale Herzfrequenz (schlägt Altersformel)
--   hf_rest       — Ruhepuls (aus garmin_sleep gemittelt)
--   hr_zones      — Zonengrenzen als jsonb { "Z1":[u,o], ... } + Notizen
--   profile_notes — Kern-Erkenntnisse der Leistungsanalyse

alter table persons
  add column if not exists age           int,
  add column if not exists hf_max        int,
  add column if not exists hf_rest        int,
  add column if not exists hr_zones       jsonb,
  add column if not exists profile_notes  text;
