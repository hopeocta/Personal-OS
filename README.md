# Personal OS

Ein persönliches Betriebssystem — gebaut mit Next.js, Supabase und Obsidian als Knowledge-Backend, verbunden über einen Telegram-Bot.

Deployed auf Vercel. Alle Daten landen in Supabase (PostgreSQL + pgvector). Obsidian dient als lesbarer, offline-fähiger Wissensspeicher.

---

## Features

### 📊 Dashboard & Analyse
- Garmin-Integration: Schlaf, HRV, Body Battery, Training Load, VO2max, Stress
- Garmin-Analyse nach eigenem Leitfaden (HRV-Baseline, 10%-Regel, ACWR, Wochen-Ampel)
- Nutrition Logging, Kraft-Sessions, Habits

### 🤖 Telegram Bot
- Sprachnotizen (Whisper-Transkription) und Text-Erfassung
- Foto/PDF-Upload → automatische Klassifizierung via Claude
- Tastatur-Shortcuts: Training, Musik, Lernen, Pläne, Einkauf, Kalender
- `/hol <stichwort>` — schickt Original-Dokument aus dem Tresor per signierter URL
- Frage-Button (`❓`) → RAG-Antwort mit Quellenangaben

### 🧠 RAG-System (Knowledge Engine)
- Vektorsuche via pgvector (OpenAI `text-embedding-3-small`, 1536d)
- SQL-Pfad für Metriken (Garmin, Nutrition, Labs)
- Claude Sonnet Orchestrator mit Tool-Loop (max. 3 Runden)
- Duplikat-Schutz via SHA-256 Content Hash

### 📁 Dokument-Pipeline
- Telegram-Upload → Claude Vision/PDF-Parse → health_labs + RAG-Index
- `_Eingang/` Ordner → Claude Haiku klassifiziert → Obsidian-Unterordner
- `scripts/eingang-ingest.mjs`, `scripts/health-backfill.mjs`
- Gesundheit (Blutbilder, Leistungsdiagnostik, EKG) + Verwaltung (Rechnungen, Steuern)

### 💻 Terminal (`/terminal`)
- Claude Sonnet Streaming Chat — von jedem Gerät erreichbar
- Modi: Chat, Suchen (Vektorsuche mit Filter), Erfassen
- Skill-Selector: MKG-Lernpartner, Tagesabschluss
- Lernfach-Selector (lädt `knowledge_entries` einer Kategorie als Prompt-Cache)
- Audio-Recorder → Whisper-Transkription

### 🎵 Musik
- Projekte + Sound Library

### 📅 Google Calendar
- Kalender-Integration über API-Route

---

## Tech Stack

| Schicht | Tool |
|---|---|
| Frontend | Next.js (App Router), TypeScript, React |
| Backend | Next.js API Routes (Vercel Serverless) |
| Datenbank | Supabase (PostgreSQL + pgvector) |
| AI | Anthropic Claude Sonnet/Haiku, OpenAI Whisper + Embeddings |
| Knowledge | Obsidian (via Local REST API, lokal) |
| Bot | Telegram Webhook |
| Gesundheit | Garmin Connect API |
| Deploy | Vercel |

---

## Architektur

```
Telegram Bot ──────────────────────────────────────────────┐
                                                           ▼
Garmin API ──► app/api/garmin/  ──► Supabase (garmin_*)    │
                                                           │
Obsidian ◄──── scripts/ (lokal, Windows-Scheduler)         │
  └── _Eingang/  ──► eingang-ingest.mjs ──► knowledge_entries
                                                           │
                          app/api/telegram/webhook/ ◄──────┘
                                    │
                          lib/answer.ts (RAG-Engine)
                          ├── search_knowledge (pgvector)
                          └── query_metrics (SQL)
```

---

## Lokale Entwicklung

```bash
npm install
cp .env.example .env.local   # Env Vars eintragen (siehe unten)
npm run dev
```

### Env Vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
GARMIN_EMAIL=
GARMIN_PASSWORD=
OBSIDIAN_API_URL=          # http://localhost:27123
OBSIDIAN_API_KEY=
GOOGLE_CALENDAR_ICAL_URL=  # iCal-Feed (ical.js)
API_SECRET=                # Für lokale Scripts → /api/knowledge
```

> Vollständige, aktuelle Env-Var-Liste (inkl. `CRON_SECRET`, `AUTH_SECRET`, `DASHBOARD_PASSWORD`,
> `USER_TIMEZONE`, `TELEGRAM_USER_ID`, Enable-Banking-Keys) → `.claude/CLAUDE.md`.

---

## Scripts (lokal, Node.js)

| Script | Zweck |
|---|---|
| `scripts/garmin-backfill-sleep.mjs` | Garmin Schlaf/Stress/BB für ganzes Jahr nachladen |
| `scripts/eingang-ingest.mjs` | `_Eingang/` Ordner verarbeiten → Obsidian + RAG |
| `scripts/storage-obsidian-sync.mjs` | Telegram-Uploads aus Supabase Storage → Obsidian |
| `scripts/garmin-obsidian-sync.mjs` | Garmin-Daten als Tages-MD nach Obsidian schreiben |
| `scripts/embed-backfill.mjs` | Fehlende Embeddings für `knowledge_entries` nachholen |
| `scripts/health-backfill.mjs` | Tresor-Dokumente neu indexieren (RAG + health_labs) |
| `scripts/pdf-to-knowledge.mjs` | PDFs chunken und in `knowledge_entries` importieren |
| `scripts/sync-all.mjs` | Orchestrator: Garmin + _Eingang + Storage-Sync |

Windows-Scheduler läuft `sync-all.mjs` täglich bei Anmeldung + alle 2 Tage 9:00 Uhr.
Dokumentation: [`docs/garmin-sync.md`](docs/garmin-sync.md)

---

## Datenbankmigrationen

Migrationen liegen unter `supabase/migrations/`. Werden via Supabase MCP direkt angewandt (eine DB für lokal + Vercel).

| Migration | Inhalt |
|---|---|
| `0001` | Basis-Schema (knowledge_entries, health_labs, garmin_*) |
| `0002` | Garmin-Aktivitäten erweitert |
| `0003` | `resting_hr` Spalte |
| `0004` | `recovery`, `training_load` (garmin_training) |
| `0005` | `content_hash` (SHA-256 Duplikat-Schutz) |
| `0006` | `telegram_pending_docs`, `storage_path` in knowledge_entries |
| `0007` | pgvector Extension + `embedding` Spalte + HNSW-Index + `match_knowledge` RPC; Flashcards + Literatur |
| `0008` | Flashcards: Unique-Constraint auf `front` |
| `0009` | `learn_sessions` (persistente Lernsession) |
| `0010` | Finanzen (`revolut_transactions`, `expense_summaries`) + `health_analysis_results` |
| `0011` | `recurring_tasks` (wiederkehrende Aufgaben) |

---

## Wichtige Regeln (für Claude / AI-Assistenten)

- **Client Components nie aus SDK-ziehenden Modulen importieren** (z.B. `lib/knowledge.ts`). Konstanten in `lib/categories.ts`.
- **`supabaseAdmin.ts` nur in Server-only Code** (API Routes, Scripts) verwenden.
- **`await` statt `void`** für async Calls in Vercel Serverless Functions — fire-and-forget läuft nach Response-Ende nicht weiter.
- **Embeddings nur für Text** — Garmin-Zahlen ausschließlich via `query_metrics` (SQL).
- Vollständige Entscheidungshistorie und Session-Log: [`STATUS.md`](STATUS.md)
- Kontext für AI-Assistenten: [`.claude/`](.claude/)

---

## Dokumentation

Unter [`docs/`](docs/) liegt ein vollständiges Nachschlagewerk:

- [`docs/funktionsregister.md`](docs/funktionsregister.md) — **vollständiger Index** aller Routen/Module/Crons/Tabellen + Doku-Lücken
- [`docs/README.md`](docs/README.md) — Übersicht
- [`docs/rag-system.md`](docs/rag-system.md) — RAG-Engine, Embeddings, Tool-Loop
- [`docs/telegram-bot.md`](docs/telegram-bot.md) — Bot-Commands, Tastatur, Upload-Flow
- [`docs/obsidian.md`](docs/obsidian.md) — Vault-Struktur, Sync-Logik
- [`docs/garmin-sync.md`](docs/garmin-sync.md) — Sync-Scripts, Windows-Scheduler
- [`docs/dashboard.md`](docs/dashboard.md) — Dashboard-Komponenten
- [`docs/ingestion.md`](docs/ingestion.md) — Dokument-Pipeline, _Eingang, Backfill

---

## Obsidian Vault-Struktur

```
Vault/
├── Logbuch/JJJJ/MM/JJJJ-MM-TT.md    ← Tages-Log (Notizen, Training, Dokumente)
├── Gesundheit/
│   ├── Training/                      ← Garmin-Sync (automatisch, scripts/garmin-obsidian-sync.mjs)
│   ├── Dokumente/                     ← Telegram Gesundheits-Uploads (Blutbilder, Befunde, EKG)
│   └── Recherche/                     ← Wissenseinträge (Triathlon, Krafttraining, Ernährung)
├── Verwaltung/
│   ├── Versicherung/
│   ├── Arbeit/
│   ├── Amt/
│   ├── Finanzen/
│   │   ├── Rechnungen privat/         ← Telegram Verwaltungs-Uploads
│   │   ├── Rechnungen Arbeit/         ← Telegram Verwaltungs-Uploads
│   │   └── Steuern/                   ← Telegram Verwaltungs-Uploads
│   ├── Wohnen/
│   ├── Datenbank/                     ← persönliche Ausweise (Pass, Visum, Impfung)
│   ├── Universität/                   ← Uni-/Studiendokumente (Kursscheine, Erasmus)
│   └── Sonstiges/
├── Reisen/                            ← Reisen/Urlaub
│   ├── Dokumente/                     ← Flug/Hotel/Mietwagen/Ticket/Buchungen
│   └── Pläne/                         ← Reise-Pläne (Telegram „Pläne" → reisen)
├── Literatur/
│   ├── Medizin/Zahnmedizin/           ← PDF-Pipeline + Telegram Lerninhalte
│   └── Allgemein/
├── Musik/                             ← Musikproduktion, FL Studio, Sampling
├── Einkauf/
│   └── Aktuelle-Liste.md
├── Logbuch/Pläne und Ideen/Projekte/  ← Projekt-Pläne (Telegram); Reise-Pläne → Reisen/Pläne
└── _Eingang/                          ← Drop-Ordner → eingang-ingest.mjs verarbeitet automatisch
```

> ⚙️ **Manuell in Obsidian löschen:** `Gesundheit/Werte/` — dieser Ordner wird von keinem Script beschrieben und kann entfernt werden.
