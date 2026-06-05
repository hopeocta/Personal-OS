# Vokabeln (Flashcards)

Italienisch-Lernsystem über Telegram mit **SM-2 Spaced Repetition**. Bidirektional (IT→DE & DE→IT).

---

## Kern: `lib/flashcards.ts`

- **SM-2-Algorithmus** (`sm2(ease, interval, reps, quality)`), `quality` 0–3:
  - `< 2` (falsch/sehr schwer) → zurück auf Anfang (ease −0.2, Intervall 1 Tag, reps 0).
  - sonst: neuer ease-Faktor, Intervall 1 → 3 → `round(interval × ease)` Tage.
- **Tages-Limit** `DAILY_LIMIT = 30` Karten/Tag (`getDoneToday` zählt `last_reviewed_at` ≥ heute).
- **`getDueCards`**: zuerst fällige **Wiederholungen** (`repetitions > 0`, `due_date ≤ heute`),
  dann **neue Karten** — mit **50/50-Richtungsmix** (`it-de` / `de-it` über Tags, mit Fallback).
- **`getDueCount`**: wie viele Karten heute noch offen sind.

---

## Telegram-Ablauf

| Befehl | Wirkung |
|---|---|
| `/lernen` | Nächste fällige Karte zeigen (Frage), Session in `learn_sessions` ablegen |
| `/antwort` | Lösung aufdecken + Bewertungs-Buttons (falsch/schwer/gut/perfekt → `quality`) |
| `/stopp` | Lernsession beenden |
| `/liste` | Übersicht |

Die aktive Karte liegt in **`learn_sessions`** (pro `chat_id`) — überlebt Vercel-Cold-Starts
(In-Memory ginge verloren). Bewertung → `sm2()` aktualisiert `ease_factor`, `interval_days`,
`repetitions`, `due_date`, `last_reviewed_at` der Karte.

**Reminder-Cron:** `GET /api/cron/flashcards` (Cron **7:00 UTC**) → `getDueCount` →
„📚 Heute fällig: N Vokabeln, tippe /lernen". Kein Versand bei 0 fälligen.

---

## Tabellen & Seed

| Tabelle | Inhalt | Migration |
|---|---|---|
| `flashcards` | Karten (front/back, example, tags, ease, interval, reps, due_date, last_reviewed_at) | 0007 |
| `flashcard_decks` | Decks (Name, Sprache) | 0007 |
| `learn_sessions` | Aktive Telegram-Lernsession je `chat_id` (Richtung it-de/de-it) | 0009 |

Unique-Constraint auf `front` (Migration `0008`) verhindert Doppel-Karten.

**Seed:** `scripts/seed-italian-vocab.ts` (`npx tsx ...`) — legt je Topic IT→DE **und** DE→IT
Karten an, vorhandene werden übersprungen (kein Claude-Call).

---

## Dateien

`lib/flashcards.ts`, `app/api/cron/flashcards/route.ts`, `app/api/telegram/webhook/route.ts`
(Befehle `/lernen` `/antwort` `/stopp` `/liste`), `scripts/seed-italian-vocab.ts`.
