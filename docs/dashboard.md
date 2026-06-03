# Dashboard (Web-App)

Die Next.js-App auf Vercel. **Eine URL, alles drin.** Passwort-geschützt (eine Person).
Dark Mode, Glassmorphism-Karten, monospace-Zahlen.

> **Architektur-Regel:** Seiten lesen nur aus Supabase. Kein Claude-Call beim Laden.
> Claude läuft nur auf Knopfdruck (Analyse, Terminal-Chat, Wissen speichern).

---

## Zugang / Auth

- **Passwort-Gate** mit HMAC-signierten Cookies (`AUTH_SECRET`), Passwort in `DASHBOARD_PASSWORD`.
- `middleware.ts` schützt alle Routen außer `/login` und `/api/auth/*`.
- API-Routen akzeptieren zusätzlich den Header `x-api-secret` (`API_SECRET`) für Scripts.
- Logik: `lib/auth.ts`, Seiten: `app/login/page.tsx`, Routen: `app/api/auth/login|logout`.

---

## Seiten (Navigation oben im TopRail)

| Route | Seite | Inhalt |
|---|---|---|
| `/` | **Home** | Schlaf, Habits, Ernährung, Training-Woche, Kraft-Logger, Quick Capture, Musik-Snapshot, Kalender |
| `/training` | **Training** | Wochen-Übersicht (Plan vs. Garmin), Kraft-Logger, Triathlon-Historie |
| `/musik` | **Musik** | Projekt-Tracker + Sound-Library |
| `/zahnmedizin` | **Zahnmedizin** | Lernfortschritt, klinische Skills, Prüfungen, Recherche |
| `/kalender` | **Kalender** | Google-Calendar-Wochenansicht |
| `/wissen` | **Wissen** | Wissens-Erfassung & -Browse (⚠️ laut Roadmap später durch `/terminal` ersetzt) |
| `/terminal` | **Terminal** | Claude-Sonnet-Chat mit Skill- & Lernfach-Selektor |
| `/analyse` | **Analyse** | Korrelations-Analyse (Sonnet) + Einkaufsliste |

---

## Home-Karten (`components/dashboard/`)

| Karte | Datei | Funktion |
|---|---|---|
| **SleepCard** | `SleepCard.tsx` | Schlaf-Score (farbcodiert), HRV, Schlafstunden, Body Battery. Zeigt Vortag, falls heute noch nicht gesynct. |
| **HabitsCard** | `HabitsCard.tsx` | 6 Standard-Habits (`lib/config/habits.ts`), Tages-Score X/6, localStorage-Cache für sofortiges Feedback, Reset um lokale Mitternacht. |
| **NutritionCard** | `NutritionCard.tsx` | Kalorien + Makro-Balken (Protein/Carbs/Fett), Inline-Bearbeitung, Notizfeld. |
| **TrainingWeekLive** | `TrainingWeekLive.tsx` | Wochenplan (Kalender) vs. Realität (Garmin). |
| **StrengthLogger** | `StrengthLogger.tsx` | LEICHT/MITTEL/SCHWER (1–3), Typ, Notizen → `strength_sessions`. |
| **QuickCapture** | `QuickCapture.tsx` | Textfeld + Typ-Buttons → Wissens-Erfassung. |
| **MusikSnapshot** | `MusikSnapshot.tsx` | 3 neueste FL-Studio-Projekte mit Status-Badge. |
| **CalendarCard / CalendarView** | `CalendarCard.tsx` | Wochenansicht, heutige Events, NOW-Marker. |
| **TriathlonHistory** | `TriathlonHistory.tsx` | Letzte 30 Tage Aktivitäten, Filter Schwimmen/Rad/Lauf. |
| **TopRail / Shell / Panel** | — | Navigation, 3-Spalten-Layout, Glassmorphism-Wrapper. |

---

## Terminal (`/terminal`) — der KI-Chat

Vollwertiger Chat, von **jedem Gerät** nutzbar (kein PC nötig):

- **Claude Sonnet Streaming** (`/api/chat`).
- **Skill-Selektor** — lädt komplette Skill-Inhalte als System-Prompt:
  - „Lernpartner (MKG)" — Prof.-Otto-LMU-Prüfungskontext, Arbeitsmethodik.
  - „Tagesabschluss" — Lernprotokoll mit Fragen + Bewertungstabelle.
- **Lernfach-Selektor** — lädt alle `knowledge_entries` einer Kategorie als Kontext
  (wie Claude Projects: 1× Cache-Write, Folgefragen ~90 % günstiger).
- 🎤 **Audio-Recorder** → Whisper-Transkription (`/api/transcribe`).
- **Token-Counter** (cache-read / cache-write / output) nach jeder Antwort.
- **Sitzung speichern** → `/api/knowledge` → erscheint im Wissensspeicher.

> Im Gegensatz zum Telegram-Bot **hat das Terminal echtes Gesprächs-Gedächtnis** (Verlauf + Caching).
> Für dialogfähige Fragen (Rückfragen, „erklär genauer") ist das Terminal der richtige Ort.

---

## Analyse (`/analyse`)

- **Korrelations-Analyse** auf Knopfdruck (4/8/12 Wochen) → **Claude Sonnet** (`/api/analyse`).
- **Wichtig:** Nie Rohdaten an Claude — erst in SQL zu Wochen-Summaries aggregieren (~85 % weniger Tokens).
- Folgt dem **Garmin-Analyse-Leitfaden** (HRV-Baseline Garmin-nativ, 10 %-Regel,
  Schlafkonsistenz-SD, Trainings-Erholungs-Ratio, Wochen-Ampel, 12-Wochen-Tabelle).
- Ergebnis als Markdown-Abschnitte, wird als `knowledge_entry` (Tag `analyse`) gespeichert.
- **Einkaufsliste** (`/api/analyse/einkauf`) → Claude Haiku generiert Liste nach Ernährungszielen.
- ⚠️ `ANTHROPIC_API_KEY` fehlt lokal in `.env.local` → `/analyse` nur in Vercel-Produktion testbar.

---

## Musik (`/musik`)

**Projekt-Tracker:**
- `GET/POST /api/musik/projects`, `PATCH/DELETE /api/musik/projects/[id]`.
- Status-Pills (idea/wip/mixing/done/released) mit Farbcodierung, Genre-Filter, Inline-Quick-Add.

**Sound-Library** (nur Metadaten, keine Audiodateien):
- `GET/POST /api/musik/sounds`, `DELETE /api/musik/sounds/[id]`.
- `POST /api/musik/sounds/bulk` — Dateinamen-Liste → Claude Haiku schlägt Kategorie + Tags vor.
- `POST /api/musik/sounds/scan` — durchsucht einen lokalen Ordner rekursiv nach Audiodateien
  (`.wav/.mp3/.aif/...`), erkennt BPM/Tonart aus dem Namen, kategorisiert per Claude Haiku (Batch 50).
- `/api/musik/sounds/play` — Vorhören, `/api/musik/sounds/cleanup` — verwaiste Einträge entfernen.

---

## Zahnmedizin (`/zahnmedizin`)

Nutzt `knowledge_entries` (Kategorie `Zahnmedizin`) + `daily_habits` — **keine eigenen Tabellen.**
- **Lernfortschritt:** Fächer als Habits mit `ZM_`-Präfix (`ZM_Anatomie` …), Streak + Heatmap.
- **Klinische Skills:** Hard-coded Liste (`lib/config/dentalSkills.ts`), Status in localStorage.
- **Prüfungen:** Kalender-Events mit Keywords (Prüfung/Klausur/OSCE/Testat), Countdown, Ampel.
- **Recherche:** `knowledge_entries` der Kategorie Zahnmedizin + Quick-Add.

---

## Vollständige API-Routen-Liste

| Route | Zweck |
|---|---|
| `auth/login`, `auth/logout` | Passwort-Gate (signierte Cookies) |
| `garmin/sync` | **Cron 5 Uhr UTC** — Garmin → Supabase |
| `garmin/status` | Letzter Sync-Zeitstempel + Record-Counts |
| `garmin/backfill`, `garmin/backfill-sleep` | Historie nachladen (von lokalen Scripts getrieben) |
| `sleep` (in `garmin/status`-Nähe), `nutrition`, `strength`, `habits` | Home-Karten lesen/schreiben |
| `training/summary` | Wochen-Aggregate Training |
| `calendar` | Google iCal (ical.js), 5-Min-Cache |
| `knowledge`, `knowledge/sources` | Wissen erfassen/browsen (Claude Haiku Kategorisierung) |
| `musik/projects[/id]`, `musik/sounds[/id,/bulk,/scan,/play,/cleanup]` | Musik |
| `analyse`, `analyse/einkauf` | Korrelations-Analyse + Einkaufsliste (Sonnet/Haiku) |
| `chat`, `transcribe` | Terminal-Chat + Whisper |
| `telegram/webhook`, `telegram/digest` | Telegram-Bot + Tages-/Wochen-Digest |

Details zum Bot: [telegram-bot.md](telegram-bot.md). Details zu RAG: [rag-system.md](rag-system.md).
