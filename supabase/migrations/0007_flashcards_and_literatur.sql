-- ── Flashcards (Spaced Repetition SM-2) ──────────────────────────────────────

create table if not exists flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'me',
  name text not null,                          -- z.B. "Italienisch – Reisen"
  language text not null default 'it',         -- ISO 639-1
  description text,
  created_at timestamptz not null default now()
);

create table if not exists flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references flashcard_decks(id) on delete cascade,
  user_id text not null default 'me',
  front text not null,                         -- Italienisch
  back text not null,                          -- Deutsch
  example_sentence text,                       -- Beispielsatz auf Italienisch
  tags text[] default '{}',                    -- z.B. ['reisen','verb']
  -- SM-2 Felder
  ease_factor numeric(4,2) not null default 2.50,
  interval_days integer not null default 1,
  repetitions integer not null default 0,
  due_date date not null default current_date,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists flashcards_due_idx on flashcards(user_id, due_date);
create index if not exists flashcards_deck_idx on flashcards(deck_id);

-- ── Zahnmedizin Literatur / Newsletter ───────────────────────────────────────

create table if not exists literatur_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default 'me',
  kw integer not null,                         -- Kalenderwoche
  jahr integer not null,
  title text not null,
  summary text not null,
  source_url text,
  source_name text,                            -- z.B. "PubMed", "DGZMK"
  category text default 'Zahnmedizin',
  tags text[] default '{}',
  created_at timestamptz not null default now()
);

create index if not exists literatur_kw_idx on literatur_entries(user_id, jahr, kw);

-- Monatliche Rückblick-Dateien werden als knowledge_entries mit source='literatur_monthly' gespeichert
