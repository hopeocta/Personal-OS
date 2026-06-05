# Funktionsregister — vollständiger Code-Audit

> **Zweck:** lückenloser, nachverfolgbarer Index *aller* implementierten Funktionen, Wege und
> Use-Cases. Eine Zeile pro Baustein: was es ist, wo es liegt, wodurch es ausgelöst wird, ob es
> dokumentiert ist. Stand: **05.06.2026** (nach Briefing/Aufgaben/Logbuch-Ausbau).
>
> Spalte **Doku**: ✅ in eigenem Doku-Kapitel beschrieben · 🟡 nur teilweise/veraltet · ⚠️ Lücke.
> Die Lücken sind unten unter [Doku-Lücken](#doku-lücken) gesammelt.

---

## 1. Seiten (Next.js App Router, `app/`)

| Route | Datei | Zweck | Doku |
|---|---|---|---|
| `/` | `app/page.tsx` | Home-Dashboard: Briefing, Schlaf, Aufgaben, Ernährung, Training-Woche, Kraft, QuickCapture, Musik, Kalender | ✅ dashboard.md |
| `/login` | `app/login/page.tsx` | Passwort-Gate | ✅ dashboard.md |
| `/training` | `app/training/page.tsx` | Wochenplan vs. Garmin, Kraft-Logger, Triathlon-Historie | ✅ dashboard.md |
| `/musik` | `app/musik/page.tsx` | Projekt-Tracker + Sound-Library | ✅ dashboard.md |
| `/zahnmedizin` | `app/zahnmedizin/page.tsx` | Lernfortschritt (ZM_-Habits), klinische Skills, Prüfungen, Recherche | ✅ dashboard.md |
| `/kalender` | `app/kalender/page.tsx` | Google-Calendar-Wochenansicht | ✅ dashboard.md |
| `/terminal` | `app/terminal/page.tsx` | Chat · RAG-Suche · Erfassen (+ Skills, Lernfach, Audio) | ✅ dashboard.md |
| `/wissen` | `app/wissen/page.tsx` | Redirect → `/terminal?mode=search` | ✅ dashboard.md |
| `/analyse` | `app/analyse/page.tsx` | Korrelations-Analyse, Health-Reviews, Einkaufsliste | 🟡 dashboard.md (Reviews fehlen) |
| `/finanzen` | `app/finanzen/page.tsx` | Revolut-Ausgaben (Monats-Summaries, Kategorien) | ⚠️ keine Doku |
| `/privacy`, `/terms` | `app/privacy|terms/page.tsx` | Rechtstexte für Enable-Banking-OAuth | ⚠️ keine Doku |

---

## 2. API-Routen (`app/api/`)

### Erfassung & Dashboard-Karten
| Route | Methoden | Zweck | Doku |
|---|---|---|---|
| `auth/login`, `auth/logout` | POST | Passwort-Gate (HMAC-Cookie, `lib/auth.ts`) | ✅ |
| `nutrition` | GET/POST | `nutrition_logs` (NutritionCard) | ✅ |
| `strength` | GET/POST | `strength_sessions` (StrengthLogger) | ✅ |
| `habits` | GET/POST | `daily_habits` (zahnmedizin ZM_-Fächer, Historie) | ✅ |
| `tasks` | GET/POST | `recurring_tasks` — wiederkehrende Aufgaben (TasksCard) | 🟡 nur STATUS |
| `knowledge` | GET/POST | Wissen erfassen/browsen (`saveKnowledgeEntry`) | ✅ rag/ingestion |
| `knowledge/sources` | GET | Quellen/Kategorien auflisten | 🟡 |
| `training/summary` | GET | Wochen-Aggregate Training | ✅ |
| `calendar` | GET | Google iCal-Events (`ical.js`, 5-Min-Cache) | ✅ |

### Garmin
| Route | Methoden | Zweck | Doku |
|---|---|---|---|
| `garmin/sync` | GET (Cron) | **Cron 06:00 UTC** — Garmin → Supabase + Logbuch-Garmin-Sektion | ✅ garmin-sync.md |
| `garmin/status` | GET | Letzter Sync-Zeitstempel + Record-Counts | ✅ |
| `garmin/backfill`, `garmin/backfill-sleep` | GET/POST | Historie nachladen (von lokalen Scripts paginiert) | ✅ |

### RAG / Terminal / Wissen
| Route | Methoden | Zweck | Doku |
|---|---|---|---|
| `ask` | POST | RAG-Antwort (`answerQuestion`, Tool-Loop) — Terminal-Suche & Telegram | ✅ rag-system.md |
| `chat` | POST | Terminal-Streaming-Chat (Sonnet, mit Verlauf) | ✅ dashboard.md |
| `transcribe` | POST | Whisper-Transkription (Audio → Text) | ✅ |
| `terminal/save-search` | POST | Suchergebnis ins Logbuch + `knowledge_entries` speichern | 🟡 |

### Musik
| Route | Methoden | Zweck | Doku |
|---|---|---|---|
| `musik/projects`, `musik/projects/[id]` | GET/POST/PATCH/DELETE | FL-Studio-Projekte | ✅ |
| `musik/sounds`, `sounds/[id]` | GET/POST/DELETE | Sound-Library (Metadaten) | ✅ |
| `musik/sounds/bulk`, `/scan` | POST | Dateinamen/Ordner → Claude-Kategorisierung | ✅ |
| `musik/sounds/play`, `/cleanup` | GET/POST | Vorhören / verwaiste Einträge | ✅ |

### Analyse & Gesundheit
| Route | Methoden | Zweck | Doku |
|---|---|---|---|
| `analyse` | POST | Korrelations-Analyse (Sonnet, Wochen-Aggregate) | ✅ |
| `analyse/recent` | GET | Letzte gespeicherte Analyse | 🟡 |
| `analyse/correlations` | GET | scipy-Korrelationen (aus `health_analysis_results`) | ⚠️ |
| `analyse/einkauf` | POST | Einkaufsliste (Haiku) | ✅ |
| `health-review/run` | POST | Health-Review manuell auslösen | ⚠️ |
| `finanzen/summary` | GET | Revolut-Monats-Summaries (/finanzen) | ⚠️ |

### Telegram & Briefings
| Route | Methoden | Zweck | Doku |
|---|---|---|---|
| `telegram/webhook` | POST | Bot-Webhook: Text/Sprache/Foto/PDF, Buttons, /lernen, /hol | ✅ telegram-bot.md |
| `telegram/digest` | GET (Cron) | **Cron 21:50/So 21:55** — Tages-/Wochen-Digest der Notizen | 🟡 telegram-bot.md |
| `telegram/briefing` | GET (Cron) | **Cron 06:10 / Mo 06:20** — Morgen-Briefing + Wochen-Training | ⚠️ keine Doku |
| `briefing/today` | GET | Briefing-Markdown fürs Dashboard (BriefingCard) | ⚠️ |

### Cron-Jobs (eigene Routen)
| Route | Zweck | Doku |
|---|---|---|
| `cron/flashcards` | **07:00 UTC** — fällige Vokabeln per Telegram | ⚠️ |
| `cron/newsletter` | **Mo 07:00 / 1. 08:00** — Zahnmedizin-Newsletter | ⚠️ |
| `cron/health-review` | **1. d. Monats / Halbjahr / Jahr** — Gesundheits-Review | ⚠️ |
| `cron/finanzen` | **2. d. Monats 10:00** — Revolut-Monatszusammenfassung | ⚠️ |

---

## 3. Cron-Jobs (`vercel.json`, Zeiten in UTC)

| Zeit (UTC) | Route | Aktion |
|---|---|---|
| `0 6 * * *` | `garmin/sync` | Garmin → Supabase |
| `10 6 * * *` | `telegram/briefing?type=morning` | Morgen-Briefing |
| `20 6 * * 1` | `telegram/briefing?type=weekly-training` | Wochen-Training (Mo) |
| `0 7 * * *` | `cron/flashcards` | Vokabel-Reminder |
| `0 7 * * 1` | `cron/newsletter?type=weekly` | Newsletter (Mo) |
| `0 8 1 * *` | `cron/newsletter?type=monthly` | Newsletter (Monatsanfang) |
| `30 8 1 * *` | `cron/health-review?type=monthly` | Health-Review monatlich |
| `0 9 1 1,7 *` | `cron/health-review?type=halfyear` | Health-Review halbjährlich |
| `30 9 1 1 *` | `cron/health-review?type=annual` | Health-Review jährlich |
| `0 10 2 * *` | `cron/finanzen` | Revolut-Monatszusammenfassung |
| `50 21 * * *` | `telegram/digest?type=daily` | Tages-Digest |
| `55 21 * * 0` | `telegram/digest?type=weekly` | Wochen-Digest (So) |

> ⚠️ **Zeitzone:** Crons sind UTC-fix. `6 UTC` = 8:00 Berlin im **Sommer**, 7:00 im Winter (DST).

---

## 4. Bibliotheken (`lib/`)

| Modul | Zweck | Doku |
|---|---|---|
| `supabase.ts` / `supabaseAdmin.ts` | Client (Anon) / Server-Admin (Service-Role, `server-only`) | ✅ |
| `auth.ts` | HMAC-Cookie-Signierung, Passwort-Gate | ✅ |
| `dateUtils.ts` / `berlinDate.ts` | `localDateKey()` / Berlin-Datums-Helfer (Wochen, ISO-KW) | ✅ |
| `categories.ts` | SDK-freie Kategorie-Konstanten (für Client Components) | ✅ |
| `answer.ts` | **RAG-Engine** `answerQuestion()` (Sonnet-Tool-Loop) | ✅ rag-system.md |
| `metrics.ts` / `metricDefs.ts` | `query_metrics`-Dispatcher (typisierte Metrik-Enum) | ✅ rag-system.md |
| `embeddings.ts` | OpenAI `text-embedding-3-small` (1536d) | ✅ rag-system.md |
| `knowledge.ts` | `saveKnowledgeEntry/Note/Plan/Document` + Embed-on-Write | ✅ |
| `documents.ts` | Dokument-Pipeline (Telegram-Upload → Claude → Storage + health_labs + RAG) | 🟡 ingestion.md |
| `imageToDocPdf.ts` | Foto → sauberes Dokument-PDF (sharp + pdf-lib) | 🟡 ingestion.md |
| `obsidian.ts` / `obsidianPaths.ts` | Logbuch-Schreiber (`appendToDailyLog`) / zentrale Vault-Pfade | ✅ obsidian.md |
| `calendar.ts` | iCal lesen (`ical.js`) + `isExamEvent`/`isTrainingEvent` | 🟡 |
| `googleCalendar.ts` | Google-Calendar-Event **erstellen** (Service-Account, Telegram „Kalender") | ⚠️ |
| `garminClient.ts` / `garminWellness.ts` | Garmin-Connect-Login + Wellness-Datenabruf | ✅ garmin-sync.md |
| `telegramSend.ts` | Telegram-`sendMessage`-Helfer | 🟡 |
| `briefing.ts` / `briefingStore.ts` | Morgen-Briefing bauen / nach Supabase+Obsidian speichern | ⚠️ |
| `weeklyTraining.ts` | Wochen-Trainings-Zusammenfassung (Briefing/Telegram) | ⚠️ |
| `tasks.ts` | Wiederkehrende Aufgaben (Fälligkeit, erledigt-setzen) | 🟡 nur STATUS |
| `healthReview.ts` | Gesundheits-Reviews (monatlich/halbjährlich/jährlich, Sonnet) | ⚠️ |
| `newsletter.ts` | Zahnmedizin-Newsletter (wöchentlich/monatlich) | ⚠️ |
| `flashcards.ts` | Vokabel-System (SM-2 Spaced Repetition, Decks, IT↔DE) | ⚠️ |
| `config/skills.ts` / `config/dentalSkills.ts` | Terminal-Skills / klinische Skill-Liste | 🟡 dashboard.md |
| `types.ts` | Zentrale Supabase-Typen | ✅ (Regel in CLAUDE.md) |

---

## 5. Dashboard-Komponenten (`components/`)

| Komponente | Zweck | Doku |
|---|---|---|
| `TopRail` / `Shell` / `Panel` | Navigation / 3-Spalten-Layout / Karten-Wrapper | ✅ |
| `BriefingCard` | Morgen-Briefing als gerendertes Markdown | ⚠️ |
| `SleepCard` | Schlaf-Score, HRV, Body Battery | ✅ |
| `TasksCard` | Wiederkehrende Aufgaben (fälligkeits-basiert) | ✅ dashboard.md |
| `NutritionCard` | Kalorien + Makros (Inline-Edit) | ✅ |
| `StrengthLogger` | Krafteinheiten loggen | ✅ |
| `TrainingCard` / `TrainingWeekLive` | Wochenplan vs. Garmin | ✅ |
| `TriathlonHistory` | 30-Tage-Aktivitäten mit Filter | ✅ |
| `QuickCapture` | Schnell-Erfassung → Wissen | ✅ |
| `MusikSnapshot` | 3 neueste Musik-Projekte | ✅ |
| `CalendarCard` / `CalendarView` | Wochenansicht + NOW-Marker | ✅ |
| `PdfImporter` | PDF-Upload-UI | 🟡 |
| `MarkdownText` | Markdown-Renderer (Antworten, Briefing) | 🟡 |

---

## 6. Lokale Scripts (`scripts/`)

| Script | Zweck | Doku |
|---|---|---|
| `sync-all.mjs` | **Orchestrator** (Garmin → Eingang → Storage → **Logbuch**) | 🟡 README (Logbuch-Schritt neu) |
| `garmin-obsidian-sync.mjs` | Garmin → Obsidian-MD | ✅ scripts.md |
| `eingang-ingest.mjs` | `_Eingang/` → Obsidian + RAG (Sonnet-Klassifizierung) | ✅ ingestion.md |
| `storage-obsidian-sync.mjs` | Telegram-Uploads (Storage) → Obsidian | ✅ scripts.md |
| `logbuch-sync.mjs` | **Logbuch aus Supabase nachbauen** (Tageslog/Briefings/Digests) | 🟡 nur STATUS |
| `embed-backfill.mjs` | Fehlende Embeddings nachtragen | ✅ scripts.md |
| `health-backfill.mjs` | Tresor-Dokumente neu indexieren | 🟡 |
| `pdf-to-knowledge.mjs` | PDF-Bücher → `knowledge_entries` | ✅ scripts.md |
| `garmin-backfill-sleep.mjs` | Garmin-Historie → Supabase | ✅ scripts.md |
| `normalize-health-labs.mjs` | Laborwerte normalisieren | ⚠️ |
| `supabase-to-obsidian.mjs` | Supabase → Vault spiegeln | ⚠️ |
| `reorg-verwaltung-uni.mjs` | Einmal-Cleanup (Verwaltung→Universität) | 🟡 STATUS |
| `migrate-zahnmedizin-vault.mjs`, `migrate-einkauf-vault.mjs` | Einmal-Migrationen | ⚠️ |
| `test-answer.mjs`, `test-rag.mjs`, `db-overview.mjs` | Test/Debug | ✅ scripts.md |

**Scheduler (Windows-Logon-Tasks):** `Eingang-Ingest`, `Garmin-Obsidian-Sync`, `Supabase-Obsidian-Sync`, **`Logbuch-Sync`** (neu, 3-Min-Delay). XML-Vorlagen in `scripts/*-task.xml`.

---

## 7. Python-Ebene (`analysis/`) — ⚠️ komplett undokumentiert in `docs/`

| Datei | Zweck |
|---|---|
| `revolut/enable_banking.py` | Enable-Banking-Client (JWT-Auth, Konten/Transaktionen) |
| `revolut/setup_oauth.py` | OAuth-Flow (ngrok-Callback) → `SESSION_ID`/`ACCOUNT_ID` |
| `revolut/auto_sync.py` | Transaktionen abrufen → `revolut_transactions` + Summaries |
| `revolut/sync.py` | CSV-Import (Revolut-Export) |
| `health/correlations.py` | scipy-Korrelationen/Trends → `health_analysis_results` |

> Details zum Revolut-Setup stehen aktuell nur in `STATUS.md` (Session-Log) + Memory, nicht in `docs/`.

---

## 8. Datenbank-Tabellen (Supabase, Migrationen `0001`–`0011`)

| Tabelle | Inhalt | Befüllt durch | Migration |
|---|---|---|---|
| `garmin_activities/sleep/body_battery/training` | Garmin-Daten | Garmin-Cron | 0001–0004 |
| `strength_sessions` | Krafttraining | Dashboard | 0001 |
| `daily_habits` | Habits + ZM_-Lernfächer | Dashboard/Zahnmedizin | 0001 |
| `nutrition_logs` | Kalorien/Makros | Dashboard | 0001 |
| `knowledge_entries` | Wissen + Embedding (1536d) + content_hash | überall | 0001/05/06/07 |
| `health_labs` | Laborwerte | Telegram-Doc-Upload | 0001 |
| `music_projects` / `sound_library` | Musik | Dashboard | 0001 |
| `telegram_pending_docs` | Mehrstufiger Upload-State | Telegram | 0006 |
| `flashcards` / `flashcard_decks` | Vokabeln (SM-2) | Seed/Telegram | 0007/08 |
| `learn_sessions` | Persistente Lern-Session (Cold-Start-fest) | Telegram /lernen | 0009 |
| `revolut_transactions` | Revolut-Transaktionen | Python-Sync | 0010 |
| `expense_summaries` | Monats-Ausgaben pro Kategorie | Python | 0010 |
| `health_analysis_results` | scipy-Korrelationen/Trends | Python | 0010 |
| `recurring_tasks` | Wiederkehrende Aufgaben | Dashboard | 0011 |

**RPC** `match_knowledge` (Vektor-Suche). **Storage-Bucket** `documents` (Tresor).

---

## Doku-Lücken

Ganze Subsysteme **ohne eigenes `docs/`-Kapitel** (nur in STATUS/Memory/Code):

1. **Finanzen / Revolut** — Python-Ebene, Enable-Banking-OAuth, `/finanzen`, `cron/finanzen`. → eigene `docs/finanzen.md` empfohlen.
2. **Briefings** — Morgen-Briefing + Wochen-Training (`lib/briefing.ts`, `weeklyTraining.ts`, `telegram/briefing`, BriefingCard). → `docs/briefing.md`.
3. **Aufgaben-Tracker** — `recurring_tasks`, `/api/tasks`, TasksCard, Logbuch „Heute dran". → in dashboard.md ergänzt, eigenes Kapitel optional.
4. **Vokabeln/Flashcards** — `lib/flashcards.ts`, `cron/flashcards`, `/lernen`, `learn_sessions`. → `docs/vokabeln.md`.
5. **Newsletter** — `lib/newsletter.ts`, `cron/newsletter`. → `docs/newsletter.md`.
6. **Health-Reviews** — `lib/healthReview.ts`, `cron/health-review`. → `docs/health-review.md`.
7. **Logbuch-Agent** — `logbuch-sync.mjs` (neu). → in obsidian.md/scripts.md ergänzen.

**Veraltete Fakten (Stand 05.06.2026 korrigiert bzw. zu korrigieren):**
- Garmin-Cron **6:00 UTC** (war 5:00) — in README/dashboard/garmin-sync teils noch alt.
- `README.md` (Wurzel): Env-Namen veraltet (`OBSIDIAN_REST_URL`→`OBSIDIAN_API_URL`, `GOOGLE_CALENDAR_ID`→`GOOGLE_CALENDAR_ICAL_URL`), Migrations-Tabelle endet bei 0007, Scripts-Tabelle unvollständig.
- `docs/README.md`: RAG-Roadmap Phase 7 (Logbuch) + 8 (MD-Rendering) sind **gebaut**, nicht mehr „geplant".
