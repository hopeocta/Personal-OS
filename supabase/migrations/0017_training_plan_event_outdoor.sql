-- Trainingsplan-Erweiterungen für die Athleten-PWA:
--   1) is_event   = Wettkampf/Event (eigenes 🏁 Badge + Styling, z.B. 10-km-Lauf).
--      Bleibt fachlich eine running/cycling-Einheit, das Flag steuert nur die Darstellung.
--   2) outdoor_alt = Freitext-Alternative für Indoor-Einheiten (v.a. Rolle): wird beim
--      Aufklappen der Einheit als "Outdoor-Alternative: …" angezeigt. Kein HF/Watt-Ersatz,
--      nur Zusatzinfo.

alter table training_plan_sessions
  add column if not exists is_event   boolean not null default false,
  add column if not exists outdoor_alt text;
