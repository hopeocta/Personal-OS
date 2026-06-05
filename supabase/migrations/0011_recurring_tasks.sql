-- Wiederkehrende Aufgaben (fälligkeits-basierter Tracker statt täglicher Checkliste).
-- Eine Aufgabe ist "fällig", wenn last_done NULL ist oder last_done + interval_days <= heute.
-- Tägliche Aufgaben: interval_days = 1. Wöchentlich = 7. Alle 4 Wochen = 28.

create table if not exists recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  interval_days int not null check (interval_days > 0),
  last_done date,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Startaufgaben
insert into recurring_tasks (name, interval_days, sort_order) values
  ('Kleidung aufräumen', 1, 1),
  ('Geschirr aufräumen', 1, 2),
  ('Putzen', 7, 3),
  ('Bettwäsche wechseln', 28, 4)
on conflict do nothing;
