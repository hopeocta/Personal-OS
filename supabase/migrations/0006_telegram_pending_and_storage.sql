-- (1) storage_path auf knowledge_entries: verknüpft eine Dokument-RAG-Zeile mit dem
--     Original im Storage-Tresor → ermöglicht "/hol" (Original aufs Handy schicken).
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS storage_path text;

-- (2) Durabler Zwischenspeicher für den Telegram-Dokument-Upload-Flow.
--     Ersetzt die bisherigen In-Memory-Maps (überleben auf Vercel nicht zwischen
--     Webhook-Aufrufen). date_iso NULL = wartet auf Datum; gesetzt = wartet auf
--     Kategorie-Button (Zeilen-id ist das Button-Token).
CREATE TABLE IF NOT EXISTS telegram_pending_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  file_id text NOT NULL,
  kind text NOT NULL,
  mime_type text NOT NULL,
  caption text NOT NULL DEFAULT '',
  date_iso text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_pending_docs_chat
  ON telegram_pending_docs (chat_id, date_iso);

ALTER TABLE telegram_pending_docs ENABLE ROW LEVEL SECURITY;
-- Nur der Service-Role-Key (Server) greift zu; keine Policy = deny-all für anon.
