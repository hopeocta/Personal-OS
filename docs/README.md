# Personal OS — Projekt-Dokumentation

Dein persönliches Lebens-Betriebssystem: **ein Dashboard, eine URL, alles an einem Ort.**
Ersetzt einzelne Tracking-Apps für Training, Schlaf, Ernährung, Wissen, Musik und Studium.

Diese Doku ist dein Nachschlagewerk: **was gebaut wurde, welche Funktionen es gibt, wie alles
zusammenhängt.** Sie wird gepflegt, wenn sich am Projekt etwas ändert.

---

## Die Bausteine im Überblick

| Baustein | Was es ist | Doku |
|---|---|---|
| 🖥️ **Dashboard** (Web-App) | Next.js-App auf Vercel — alle Seiten & Karten | [dashboard.md](dashboard.md) |
| 📱 **Telegram-Bot** | Erfassung per Handy (Text/Sprache/Foto/PDF) + Fragen stellen | [telegram-bot.md](telegram-bot.md) |
| 🧠 **RAG / Wissens-Suche** | Semantische Suche + Zahlen-Abfragen über deine Daten | [rag-system.md](rag-system.md) |
| ⌚ **Garmin-Sync** | Garmin → Supabase (Cloud) + Garmin → Obsidian (lokal) | [garmin-sync.md](garmin-sync.md) |
| 📥 **Dokument-Ingestion** | `_Eingang/`-Ordner + Telegram-Uploads → Obsidian + RAG | [ingestion.md](ingestion.md) |
| 📓 **Obsidian-Anbindung** | Vault-Struktur, wie Daten dort landen | [obsidian.md](obsidian.md) |
| 🛠️ **Scripts** | Wartungs- & Backfill-Werkzeuge | [scripts.md](scripts.md) |
| 🗂️ **Funktionsregister** | **Vollständiger Index** aller Routen/Module/Crons/Tabellen + Doku-Lücken | [funktionsregister.md](funktionsregister.md) |
| 💶 **Finanzen / Revolut** | Enable-Banking-Import, Ausgaben-Auswertung (`/finanzen`, Python-Ebene) | ⚠️ nur funktionsregister.md |
| ☀️ **Briefing & Aufgaben** | Morgen-Briefing (Telegram/Dashboard) + wiederkehrende Aufgaben | ⚠️ funktionsregister.md |
| 🗣️ **Vokabeln · Newsletter · Health-Review** | Telegram-Lernkarten, Zahnmed-Newsletter, Gesundheits-Reviews | ⚠️ funktionsregister.md |

> **Vollständige, nachverfolgbare Liste aller Funktionen** (inkl. der noch nicht eigenständig
> dokumentierten Subsysteme) → [funktionsregister.md](funktionsregister.md).
>
> **Schneller Einstieg „Wie entferne ich den Garmin-Scheduler?"** → [garmin-sync.md](garmin-sync.md#scheduler-entfernen)

---

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript strict, Tailwind, Dark Mode |
| Datenbank | Supabase (Postgres) — Service-Role-Key nur server-seitig, Anon-Key im Client |
| Vektor-Suche | pgvector + HNSW-Index, OpenAI `text-embedding-3-small` (1536d) |
| Hosting | Vercel (Free Tier) + GitHub (`hopeocta/Personal-OS`, Branch `master`) |
| KI | Anthropic Claude (Haiku = günstig/schnell, Sonnet = Reasoning/RAG/Analyse) |
| Transkription | OpenAI Whisper (`whisper-1`) — nur Telegram-Sprachnotizen |
| Kalender | Google Calendar via iCal-URL — **nur `ical.js`**, nie `node-ical` |
| Erfassung | Telegram-Bot (Handy) + Dashboard (PC) |
| Notizen-Export | Obsidian Vault via Local REST API (lokal, `localhost`) |

---

## Architektur in einem Satz

Die **Cloud** (Vercel) erfasst & speichert alles in **Supabase** (immer sichere Quelle der Wahrheit);
**Obsidian** liegt lokal auf dem PC und wird von lokalen Agenten/Scripts gespiegelt, weil die
Cloud `localhost` nicht erreichen kann.

```
   Handy (Telegram) ─┐
                     ├─► Vercel (Cloud) ─► Supabase (Postgres + Storage)  ◄── Quelle der Wahrheit
   PC (Dashboard) ───┘                          │
                                                ▼
                              Lokaler Agent auf dem PC (Scheduler)
                                                │
                                                ▼
                                       Obsidian Vault (localhost)
```

**Wichtige Konsequenz:** Obsidian-Schreibvorgänge funktionieren nur, wenn der PC läuft und
Obsidian (mit Local-REST-API-Plugin) offen ist. Daten gehen nie verloren — sie sind immer
in Supabase. Siehe [garmin-sync.md](garmin-sync.md) und [obsidian.md](obsidian.md).

---

## Eiserne Architektur-Regeln (nie brechen)

* **Seitenaufrufe lösen NIE einen Claude-API-Call aus.** Seiten lesen nur aus Supabase.
  Claude läuft ausschließlich auf explizite Nutzer-Aktion (Speichern-/Analyse-Button).
* **Immer `localDateKey()`** für Datums-Logik (lokale Uhr, nie Server-UTC).
* **Nur `ical.js`** für Kalender — `node-ical` hat einen BigInt-Bug auf Vercel.
* **Garmin-Sync ist ein täglicher Vercel-Cron (6 Uhr UTC = 8:00 Berlin Sommer)** — nie beim Seitenaufruf.
* **Obsidian-Writes sind asynchron & nicht-blockierend** — das Dashboard wartet nie darauf.
* **Sound-Library speichert nur Metadaten** — keine Audiodateien in Supabase, nur `file_path`.
* **API-Fehler immer in die Konsole loggen** — nie stilles `.catch(() => {})`.
* **RAG:** Claude bekommt **nie freies SQL** — nur die typisierte Metrik-Enum (`query_metrics`).
* **Embedding-Modell** ist hart an `vector(1536)` gekoppelt — nie ohne kompletten Re-Embed wechseln.

---

## Datenbank-Tabellen (Supabase)

| Tabelle | Inhalt | Befüllt durch |
|---|---|---|
| `garmin_activities` | Einzelne Aktivitäten (Lauf, Rad, Schwimmen, Kraft) | Garmin-Cron |
| `garmin_sleep` | Schlaf-Score, Phasen, HRV (nächtlich + Baseline/Status), Ruhepuls | Garmin-Cron |
| `garmin_body_battery` | Body Battery morgens/abends, Stress, Stressminuten | Garmin-Cron |
| `garmin_training` | VO2max, ATL/CTL/ACWR, Training-Status | Garmin-Cron |
| `strength_sessions` | Krafttraining (Intensität 1–3, Typ, Notizen) | Dashboard / Telegram |
| `daily_habits` | Tages-Gewohnheiten + Lernfächer (`ZM_`-Präfix) | Dashboard |
| `nutrition_logs` | Kalorien, Makros, Notizen | Dashboard |
| `knowledge_entries` | Wissen/Notizen/Pläne/Einkauf + **Embedding** (RAG) | überall |
| `music_projects` | FL-Studio-Projekte (BPM, Tonart, Status) | Dashboard / Telegram |
| `sound_library` | Sample-Metadaten (nur Pfade, keine Audiodateien) | Dashboard-Scan |
| `health_labs` | Ausgelesene Laborwerte (Blutbild/Laktat/Befund) | Telegram-Doc-Upload |
| `recurring_tasks` | Wiederkehrende Aufgaben (fälligkeits-basiert) | Dashboard (TasksCard) |
| `flashcards` / `flashcard_decks` | Vokabeln (SM-2 Spaced Repetition, IT↔DE) | Seed / Telegram |
| `learn_sessions` | Persistente Lern-Session (Cold-Start-fest) | Telegram `/lernen` |
| `revolut_transactions` / `expense_summaries` | Finanzen (Revolut-Import + Monats-Aggregate) | Python-Ebene |
| `health_analysis_results` | scipy-Korrelationen/Trends | Python-Ebene |
| `telegram_pending_docs` | State für mehrstufige Telegram-Uploads | Telegram |

Zusätzlich: **Storage-Bucket `documents`** (privat) = Tresor für Original-Uploads.
**RPC `match_knowledge`** = Vektor-Suche über `knowledge_entries`.

> Vollständige Routen/Module/Crons → [funktionsregister.md](funktionsregister.md).

---

## Aktueller Ausbau-Stand (RAG-Roadmap)

Der ursprüngliche „Nightly Build" (Abend 1–10) ist komplett. Danach kam der große RAG-Ausbau
(8 Phasen). Tagesaktueller Stand steht immer in **`STATUS.md`** (Projekt-Wurzel).

| Phase | Inhalt | Status |
|---|---|---|
| 1 | RAG-Fundament (pgvector, HNSW, `match_knowledge`, Embeddings) | ✅ |
| 2 | Write-Hook (neue Einträge auto-embedden) | ✅ |
| 3 | Hybrid-Antwort-Engine (`lib/answer.ts`, Tool-Use) | ✅ |
| 4 | Telegram-Frage-Logik (Frage-Button → RAG) + Button-Umbau | ✅ |
| 5 | Garmin → Obsidian (lokaler Sync-Agent + Scheduler) | ✅ |
| 6 | Sync-System Obsidian↔Supabase + Dokument-Originale | 🟡 `_Eingang/` ✅, Storage-Spiegelung ✅, Notiz-Watcher offen |
| 7 | Tägliches Live-Logbuch | ✅ (lokaler Agent `logbuch-sync.mjs`, 05.06.2026) |
| 8 | Dashboard: MD-Rendering + RAG-Suche | ✅ (BriefingCard/MarkdownText, Terminal-Suche) |

> **Seit dem Nightly-Build dazugekommen** (in `STATUS.md` + [funktionsregister.md](funktionsregister.md)):
> Finanzen/Revolut, Vokabeln, Newsletter, Health-Reviews, Morgen-Briefing, Aufgaben-Tracker.

Vollständiger Plan: `C:\Users\Administrator\.claude\plans\lass-uns-erstmal-nochmal-synthetic-raven.md`
