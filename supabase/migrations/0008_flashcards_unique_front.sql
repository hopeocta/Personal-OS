-- Verhindert doppelte Vokabeln wenn seed-script mehrfach läuft.
-- Unique auf (deck_id, front) — gleiche Vorderseite darf nur einmal pro Deck existieren.
ALTER TABLE flashcards
  ADD CONSTRAINT flashcards_deck_front_unique UNIQUE (deck_id, front);
