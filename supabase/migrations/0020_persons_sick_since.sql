-- Krank-Knopf: Datum, ab dem der/die Athlet:in nach einer Krankheit wieder
-- einsteigt. Solange gesetzt, fährt der Plan die nächsten 3 Trainingstage
-- reduziert hoch (3-Tage-Ramp 60/75/90%) statt sofort 100%. null = gesund.
alter table persons add column if not exists sick_since date;
