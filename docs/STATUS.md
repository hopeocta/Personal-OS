# Personal OS — Status

> Hier steht: was funktioniert, was geplant ist, was manuell zu tun ist.
> Details zu jedem Feature → `docs/` Ordner. Gesamtübersicht → [README.md](README.md)

---

## 🔄 Letzter Session-Log

| Datum | Was |
|---|---|
| 04.06.2026 | Perplexity: robustes JSON-Parsing in `seed-italian-vocab.ts` |
| 04.06.2026 | Audit aller Workflows — 3 Bugs gefixt: Cron-Auth (health-review), TELEGRAM_USER_ID, writeObsidianFile return type |
| 04.06.2026 | Phase 1+2+4: Laktattest, SER/Ernährung/Habits, Prüfungswochen in healthReview.ts |
| 04.06.2026 | Phase 3: Letzte Reviews auf /analyse, health-review/run API, Run-Button |
| 04.06.2026 | Phase 5: Unique-Constraint (deck_id, front) auf flashcards, seed-script fix |

---

## ❗ Manuelle Schritte ausstehend

- [ ] **Supabase Migration ausführen**: `supabase/migrations/0008_flashcards_unique_front.sql` im Supabase SQL-Editor laufen lassen
- [ ] Vokabel-Seed abschließen: `npx tsx scripts/seed-italian-vocab.ts` — 4 Topics schon drin, 6 fehlgeschlagene werden neu generiert
- [ ] Prüfen ob `TELEGRAM_USER_ID` in Vercel korrekt gesetzt (= Telegram Chat-ID)

---

## ✅ Was funktioniert (muss immer laufen)

### 📱 Telegram Bot → [telegram-bot.md](telegram-bot.md)
- Text schicken → Kategorie wählen (Training, Musik, Lernen, Plan, Notiz, Einkauf, Kalender, Frage)
- Foto / PDF / Word / Excel / TXT hochladen → Gesundheit oder Verwaltung
- Sprachnotiz → Whisper → selbe Pipeline
- `/lernen` → Vokabel-Session (SM-2), `/antwort`, `/liste`, `/hol`
- Automatische Nachrichten: Briefing 06:00, Digest 21:50, Vokabel-Reminder 07:00, Newsletter Mo, Gesundheitsanalysen

### ⌚ Garmin → [garmin-sync.md](garmin-sync.md)
- Täglicher Cron 05:00 UTC → `garmin_activities`, `garmin_sleep`, `garmin_body_battery`, `garmin_training`
- Backfill-Scripts für Lücken (lokal)

### 📊 Analyse → [dashboard.md](dashboard.md)
- `/analyse`: Ad-hoc 4/8/12/52 Wochen, Streaming, Wochenampel, Kalender-Korrelation
- Automatische Periodenberichte: monatlich, halbjährlich, jährlich → Obsidian + Supabase + Telegram
- Parameter editierbar in Obsidian: `Gesundheit & Training/analyse-parameter.md`

### 🧠 RAG / Wissen → [rag-system.md](rag-system.md)
- Semantische Suche (Embeddings) + SQL-Abfragen (Garmin/Ernährung)
- Via Telegram Frage-Button oder `/terminal` im Dashboard

### 📥 Dokument-Ingest → [ingestion.md](ingestion.md)
- `_Eingang/` Ordner (PC) + Telegram-Upload → Obsidian + Supabase (RAG)

### 📚 Vokabeltrainer (Italienisch)
- SM-2 Spaced Repetition in Supabase (`flashcards`, `flashcard_decks`)
- Lernen via Telegram `/lernen`, manuell Karten hinzufügen
- Seed-Script: `scripts/seed-italian-vocab.ts` (1000+ Karten, 10 Themen) — noch nicht vollständig getestet

### 📰 Newsletter / Literatur
- Wöchentlich Mo 07:00: PubMed-Zahnmedizin → Telegram
- Monatlich 1.: Literatur-Rückblick → Telegram

---

## 🗺️ Geplant

### Phase 1 — Laktattest in healthReview ⭐
Laktattest/Leistungsdiagnostik aus `health_labs` automatisch in Perioden-Berichte einlesen.
LT1, LT2, FTP explizit ausgeben + Training relativ zu Schwellen auswerten.
**Datei:** `lib/healthReview.ts`

### Phase 2 — SER, Ernährung & Habits in healthReview
SER-Ampel, Kalorien/Protein-Schnitt, Habit-Erfüllungsquoten in Monats-/Jahresbericht.
**Datei:** `lib/healthReview.ts`

### Phase 3 — Letzte Reviews auf `/analyse` anzeigen
Block „Letzte Berichte" mit Link zu Obsidian + optionaler Button „Jetzt neu erstellen".
**Dateien:** `app/analyse/page.tsx`, neue API-Route

### Phase 4 — Korrelationen verfeinern
ACWR + HRV-Trend als Überlastungs-Cluster, Kalender-Logik in `lib/calendar.ts` abstrahieren.
**Dateien:** `lib/healthReview.ts`, `lib/calendar.ts`
