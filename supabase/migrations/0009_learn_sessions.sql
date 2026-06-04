-- Persistente Lernsessions — überlebt Vercel Cold Starts
CREATE TABLE learn_sessions (
  chat_id   BIGINT PRIMARY KEY,
  card_id   UUID NOT NULL,
  front     TEXT NOT NULL,
  back      TEXT NOT NULL,
  example_sentence TEXT,
  direction TEXT NOT NULL DEFAULT 'it-de', -- 'it-de' oder 'de-it'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
