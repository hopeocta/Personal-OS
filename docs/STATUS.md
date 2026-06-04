# Personal OS — Status

> Hier steht: was funktioniert, was geplant ist, was manuell zu tun ist.
> Details zu jedem Feature → `docs/` Ordner. Gesamtübersicht → [README.md](README.md)

---

## 🔄 Letzter Session-Log

| Datum | Was |
|---|---|
| 04.06.2026 | Audit: 3 Bugs gefixt (Cron-Auth, TELEGRAM_USER_ID, writeObsidianFile) |
| 04.06.2026 | healthReview Phase 1+2+4: Laktattest, SER/Ernährung/Habits, Prüfungswochen |
| 04.06.2026 | healthReview Phase 3: Reviews auf /analyse, Run-Button |
| 04.06.2026 | Vokabeln Phase 5: Unique-Constraint, bidirektional (IT↔DE), /stopp-Befehl |
| 04.06.2026 | Vokabeln: Lernsession in Supabase (überlebt Cold Starts), Tages-Limit 30 |
| 04.06.2026 | Python-Ebene + Revolut + Zahnarzt-Bürokratie geplant → docs/roadmap.md |

---

## ❗ Manuelle Schritte ausstehend

- [ ] **Vokabel-Seed neu laufen lassen**: `npx tsx scripts/seed-italian-vocab.ts` — erstellt jetzt IT→DE + DE→IT Karten für alle Topics (bereits vorhandene werden übersprungen)
- [ ] **Nächste Session: Python-Ebene starten** — mit Revolut CSV-Import + Supabase-Migrationen (Schritt 1 aus `docs/roadmap.md`)

---

## ✅ Was funktioniert (muss immer laufen)

### 📱 Telegram Bot → [telegram-bot.md](telegram-bot.md)
- Text schicken → Kategorie wählen (Training, Musik, Lernen, Plan, Notiz, Einkauf, Kalender, Frage)
- Foto / PDF / Word / Excel / TXT hochladen → Gesundheit oder Verwaltung
- Sprachnotiz → Whisper → selbe Pipeline
- `/lernen` → max. 30 Karten/Tag (Wiederholungen zuerst, dann neue), `/antwort`, `/stopp`, `/liste`, `/hol`
- Session überlebt Vercel Cold Starts (in Supabase gespeichert)
- Bidirektional: 🇮🇹→🇩🇪 und 🇩🇪→🇮🇹 je nach Karte
- Automatische Nachrichten: Briefing 06:00, Digest 21:50, Vokabel-Reminder 07:00, Newsletter Mo, Gesundheitsanalysen

### ⌚ Garmin → [garmin-sync.md](garmin-sync.md)
- Täglicher Cron 05:00 UTC → `garmin_activities`, `garmin_sleep`, `garmin_body_battery`, `garmin_training`
- Backfill-Scripts für Lücken (lokal)

### 📊 Analyse → [dashboard.md](dashboard.md)
- `/analyse`: Ad-hoc 4/8/12/52 Wochen, Streaming, Wochenampel, Kalender-Korrelation
- Block „Letzte Reviews" mit Obsidian-Pfad + Button „Monatsbericht jetzt"
- Automatische Periodenberichte: monatlich (1.), halbjährlich (1.Jan/Jul), jährlich (1.Jan)
  → Laktattest, SER, Ernährung, Habits, Prüfungswochen, ACWR+HRV-Cluster im Report
- Parameter editierbar in Obsidian: `Gesundheit & Training/analyse-parameter.md`

### 🧠 RAG / Wissen → [rag-system.md](rag-system.md)
- Semantische Suche (Embeddings) + SQL-Abfragen (Garmin/Ernährung)
- Via Telegram Frage-Button oder `/terminal` im Dashboard

### 📥 Dokument-Ingest → [ingestion.md](ingestion.md)
- `_Eingang/` Ordner (PC) + Telegram-Upload → Obsidian + Supabase (RAG)

### 📚 Vokabeltrainer (Italienisch)
- SM-2 Spaced Repetition, max. 30 Karten/Tag, Wiederholungen vor neuen Karten
- Bidirektional IT↔DE, Session in Supabase, `/lernen` `/antwort` `/stopp`
- Seed: `scripts/seed-italian-vocab.ts` (IT→DE + DE→IT, Skip wenn schon vorhanden)

### 📰 Newsletter / Literatur
- Wöchentlich Mo 07:00: PubMed-Zahnmedizin → Telegram
- Monatlich 1.: Literatur-Rückblick → Telegram

---

## 🗺️ Geplant → [roadmap.md](roadmap.md)

### Nächste Priorität: Python-Ebene (Schritt 1–2)
1. Supabase-Migrationen: `revolut_transactions`, `expense_summaries`, `health_analysis_results`
2. `analysis/revolut/sync.py` — Revolut CSV-Import + Claude-Kategorisierung → Supabase
3. Dashboard `/finanzen` — monatliche Ausgaben nach Kategorie
4. `analysis/health/correlations.py` — scipy Korrelationen → healthReview ergänzen
5. Zahnarzt-Module — GOZ/BEMA, Recall, Compliance (ab Assistenzzeit)

Vollständiger Plan: [roadmap.md](roadmap.md)
