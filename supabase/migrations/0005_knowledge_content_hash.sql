-- Duplikat-Schutz für hochgeladene Dokumente.
-- content_hash = SHA-256 des Original-Datei-Inhalts. Beim Ingest (Telegram/Eingang/
-- Backfill) wird vor der Verarbeitung geprüft, ob bereits eine Dokumentzeile mit
-- diesem Hash existiert → identische Datei wird nicht doppelt verarbeitet/gespeichert.
-- Nullable: bestehende Einträge und reine Text-Notizen haben keinen Hash.

ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_content_hash
  ON knowledge_entries (content_hash)
  WHERE content_hash IS NOT NULL;
