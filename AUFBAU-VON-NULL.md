# Personal OS — Aufbau von Null (Schritt für Schritt)

> **Was diese Datei ist:** Eine vollständige Bauanleitung, mit der ein anderer Mensch
> *sein eigenes* Personal OS von Grund auf nachbauen kann — gemeinsam mit seinem eigenen
> Claude-Code-Agenten (hier „Cosima" genannt). Sie enthält **keine persönlichen Daten**:
> alle Schlüssel, Konten, Namen, Pfade und Werte sind Platzhalter, die jeder selbst befüllt.
>
> **Wie man sie benutzt:** Diese Datei dem Agenten geben und sagen:
> *„Lies `AUFBAU-VON-NULL.md`. Wir bauen das Personal OS Phase für Phase. Starte mit Phase 0
> und stoppe nach jeder Phase, damit ich teste und du committen kannst."*
>
> **Goldene Regel (für den Agenten):** Niemals mehrere Phasen ohne Rückfrage durchziehen.
> Nach jeder Phase: **STOPPEN → testen → committen → fragen ob weiter.** Manuelle Schritte
> (Konten anlegen, Keys erzeugen, Scheduler einrichten) **immer ausführbar** erklären:
> exakter Befehl, voller Pfad, und was der Schritt bewirkt — nie nur ein Stichwort.

---

## Inhalt

- [Was am Ende existiert](#was-am-ende-existiert)
- [Architektur-Regeln — nie brechen](#architektur-regeln--nie-brechen)
- [Phase 0 — Konten, Tools, Keys (manuell)](#phase-0--konten-tools-keys-manuell)
- [Phase 1 — Fundament (Next.js + Supabase + Deploy)](#phase-1--fundament)
- [Phase 2 — Design-System & Layout](#phase-2--design-system--layout)
- [Phase 3 — Garmin-Sync + Kalender](#phase-3--garmin-sync--kalender)
- [Phase 4 — Home-Dashboard](#phase-4--home-dashboard)
- [Phase 5 — Training-Bereich](#phase-5--training-bereich)
- [Phase 6 — Wissen + Obsidian](#phase-6--wissen--obsidian)
- [Phase 7 — Musik-Bereich](#phase-7--musik-bereich)
- [Phase 8 — Studium/Lern-Bereich](#phase-8--studiumlern-bereich)
- [Phase 9 — RAG-Engine (Embeddings + Tool-Loop)](#phase-9--rag-engine)
- [Phase 10 — Telegram-Bot](#phase-10--telegram-bot)
- [Phase 11 — Dokument-Pipeline (Ingest)](#phase-11--dokument-pipeline-ingest)
- [Phase 12 — Terminal (eine UI für alles)](#phase-12--terminal)
- [Phase 13 — Analyse & Korrelationen](#phase-13--analyse--korrelationen)
- [Phase 14 — Briefings & Crons](#phase-14--briefings--crons)
- [Phase 15 — Vokabeltrainer (Spaced Repetition)](#phase-15--vokabeltrainer)
- [Phase 16 — Health-Reviews & Newsletter](#phase-16--health-reviews--newsletter)
- [Phase 17 — Lokale Sync-Scripts + Scheduler](#phase-17--lokale-sync-scripts--scheduler)
- [Phase 18 — Finanzen (Python-Ebene)](#phase-18--finanzen-python-ebene)
- [Phase 19 — Wiederkehrende Aufgaben](#phase-19--wiederkehrende-aufgaben)
- [Phase 20 — Optional: Marktanalyse-System](#phase-20--optional-marktanalyse-system)
- [Anhang A — Env-Variablen (vollständig)](#anhang-a--env-variablen-vollständig)
- [Anhang B — Cron-Tabelle](#anhang-b--cron-tabelle)
- [Anhang C — Obsidian-Vault-Struktur](#anhang-c--obsidian-vault-struktur)
- [Anhang D — Bekannte Bugs (von Anfang an vermeiden)](#anhang-d--bekannte-bugs)

---

## Was am Ende existiert

Ein persönliches Dashboard unter **einer URL**, das andere Tracking-Apps ersetzt:

1. **Garmin** synchronisiert automatisch (Aktivitäten, Schlaf, HRV, Body Battery, Training Load).
2. **Habits / Ernährung / Krafttraining** in Sekunden loggen.
3. **Korrelationen** zwischen Schlaf, Ernährung und Leistung finden.
4. **Wissen dumpen** → Claude kategorisiert automatisch, bleibt durchsuchbar (RAG).
5. **Telegram-Bot** als mobiler Eingang (Text, Sprache, Foto, PDF).
6. **Obsidian** als lesbarer, offline-fähiger Wissensspeicher.
7. Optional: **Musik-Projekte**, **Studium/Lernen**, **Finanzen**, **Marktanalyse**.

### Tech-Stack

| Schicht | Tool |
|---|---|
| Frontend | Next.js (App Router), TypeScript strict, Tailwind, dark mode |
| Datenbank | Supabase (PostgreSQL + pgvector) |
| Hosting | Vercel + GitHub |
| AI | Anthropic Claude (RAG, Analyse, Dokument-Klassifizierung) |
| Embeddings | OpenAI `text-embedding-3-small` (1536d) |
| Transkription | OpenAI Whisper (nur Sprachnotizen) |
| Kalender | iCal-URL — **`ical.js` only** |
| Garmin | Garmin-Connect-API via täglichem Vercel-Cron |
| Telegram | Bot-Webhook |
| Knowledge | Obsidian via Local REST API (lokal, PC) |
| Finanzen | Python (`analysis/`), Bank-API oder CSV |

---

## Architektur-Regeln — nie brechen

> **Der Agent prüft diese Regeln, BEVOR er eine Route oder Komponente schreibt.**
> Sie sind aus echten, teuren Fehlern entstanden.

**Allgemein**
- Page loads lösen **nie** Claude-API-Calls aus — Seiten lesen nur aus Supabase.
- Claude läuft **nur** bei expliziter User-Aktion (Speichern-Button, Analyse-Button).
- `localDateKey()` für **alle** Datumslogik — immer lokale Uhrzeit, nie Server-UTC.
- **`ical.js` für Kalender** — `node-ical` hat einen BigInt-Bug auf Vercel. Nie verwenden.
- Garmin-Sync ist ein **täglicher Cron**, nie beim Page-Load.
- Obsidian-Write ist **async und non-blocking** — das Dashboard wartet nie darauf.
- API-Fehler **immer loggen** — nie `.catch(() => {})`.
- Nie `!` Non-null-Assertion über async-Grenzen — Typ korrekt lösen.

**Supabase**
- `supabaseAdmin.ts` **nur in Server-only Code** (API Routes, Scripts) — nie in Client Components.
- Service-Role-Key umgeht RLS — mit Bedacht verwenden. `server-only`-Package importieren.

**RAG & Embeddings**
- Embedding-Modell `text-embedding-3-small` (1536d) — **nie wechseln** ohne kompletten Re-Embed.
- Zahlen-Metriken (Garmin etc.) **immer** über SQL (`query_metrics`), nie über Embeddings.
- `query_metrics` immer mit typisiertem Enum + Datumsbereich — Claude bekommt **kein** rohes SQL.

**Kosten**
- Claude nur über Volltexte, wenn zwingend nötig (das kann mehrere Dollar pro Lauf kosten).
- Pro Dokument: nur Auszug/Bild an Claude (~0,2 Cent), Original in Obsidian, Text+Embedding → Supabase.
- Analyse-API: Daten **immer** als Wochen-Aggregate vorverarbeiten — nie Roh-Rows an Claude.

**Client Components**
- Nie aus SDK-ziehenden Modulen importieren (z.B. `lib/knowledge.ts` zieht das Anthropic-SDK).
- Konstanten in `lib/categories.ts` (SDK-frei) — Client Components importieren von dort.
- `@anthropic-ai/sdk` in `serverExternalPackages` in `next.config.ts`.

**Vercel Serverless**
- `await` statt `void` für async Calls — fire-and-forget läuft nach Response-Ende **nicht** weiter.
- `export const maxDuration = 30` für Routes mit Embedding + mehrstufigen Claude-Calls.

---

## Phase 0 — Konten, Tools, Keys (manuell)

> **Das macht der Mensch, nicht der Agent.** Der Agent kann nicht für dich Konten anlegen
> oder Zahlungsdaten hinterlegen. Hake jeden Punkt ab, bevor Phase 1 startet.

### 0.1 Tools lokal installieren
- [ ] **Node.js** (LTS, ≥ 20) — prüfen: `node -v`
- [ ] **Git** — prüfen: `git --version`
- [ ] **Claude Code** (dein „Cosima"-Agent) — installiert und im Projektordner gestartet
- [ ] **Obsidian** (Desktop) — für den Wissensspeicher (später, ab Phase 6)
- [ ] **Python 3.x** — nur falls die Finanz-Ebene gebaut wird (Phase 18)

### 0.2 Accounts anlegen (jeweils kostenlos starten)
- [ ] **GitHub** — leeres privates Repo `personal-os` anlegen
- [ ] **Vercel** — mit GitHub verbinden (Hosting + Crons)
- [ ] **Supabase** — neues Projekt anlegen, Region wählen, DB-Passwort sicher notieren
- [ ] **Anthropic Console** — `ANTHROPIC_API_KEY` erzeugen, Billing hinterlegen
- [ ] **OpenAI Platform** — `OPENAI_API_KEY` erzeugen (Whisper + Embeddings), Billing hinterlegen
- [ ] **Telegram** — via `@BotFather` einen Bot erstellen → `TELEGRAM_BOT_TOKEN` notieren
- [ ] **Garmin Connect** — bestehendes Konto (E-Mail + Passwort), Watch synchronisiert
- [ ] **Google Calendar** — geheime **iCal-URL** des Kalenders kopieren (Einstellungen → Integrieren)

### 0.3 Keys sammeln (kommen in `.env.local`)
Lege schon jetzt eine sichere Notiz mit allen Werten an. Die vollständige Liste steht in
[Anhang A](#anhang-a--env-variablen-vollständig). Selbst zu erfindende Geheimnisse:
- `AUTH_SECRET` — langer Zufallsstring (z.B. `openssl rand -hex 32`)
- `DASHBOARD_PASSWORD` — dein Login-Passwort fürs Dashboard
- `CRON_SECRET` — Zufallsstring, schützt die Cron-Routen
- `TELEGRAM_WEBHOOK_SECRET` — Zufallsstring, schützt den Telegram-Webhook
- `API_SECRET` — Zufallsstring, schützt `/api/knowledge` für lokale Scripts

**→ STOPP.** Erst weiter, wenn 0.1–0.3 vollständig sind. Sag dem Agenten, welche Konten stehen.

---

## Phase 1 — Fundament

**Ziel:** Lauffähiges Next.js-Projekt, Supabase-Basis-Schema, Login-Gate, erster Deploy.

### Agent-Auftrag
1. Next.js (App Router) + TypeScript **strict** + Tailwind + dark mode initialisieren.
2. `next.config.ts`: `@anthropic-ai/sdk` in `serverExternalPackages` eintragen.
3. Basis-Bibliotheken:
   - `lib/supabase.ts` — Anon-Client (Client-safe)
   - `lib/supabaseAdmin.ts` — Service-Role-Client, mit `import 'server-only'`
   - `lib/types.ts` — zentrale Supabase-Typen (alle Tabellentypen hier zuerst definieren)
   - `lib/dateUtils.ts` — `localDateKey()` (lokale Zeit, nie UTC)
   - `lib/auth.ts` — HMAC-signiertes Cookie, Passwort-Gate gegen `DASHBOARD_PASSWORD`
4. `middleware.ts` — alle Seiten außer `/login`, `/privacy`, `/terms` hinter das Cookie-Gate.
5. `app/login/page.tsx` + `app/api/auth/login` + `app/api/auth/logout`.
6. **Migration `0001_init.sql`** mit 9 Kerntabellen, jeweils **RLS aktiv + „deny all"-Policy**
   (Zugriff läuft nur über den Service-Role-Key serverseitig):
   `garmin_activities`, `garmin_sleep`, `garmin_body_battery`, `strength_sessions`,
   `daily_habits`, `nutrition_logs`, `knowledge_entries`, `music_projects`, `sound_library`.

### Manuelle Schritte
- [ ] `.env.local` aus [Anhang A](#anhang-a--env-variablen-vollständig) befüllen (mindestens
      Supabase-URL/Keys, `AUTH_SECRET`, `DASHBOARD_PASSWORD`).
- [ ] **Migration anwenden:** in Supabase → SQL-Editor `0001_init.sql` ausführen
      (oder per Supabase-CLI/MCP). Danach prüfen: alle 9 Tabellen sichtbar, RLS „on".
- [ ] **Vercel-Deploy:** Repo in Vercel importieren, alle Env-Vars unter
      *Settings → Environment Variables* hinterlegen (Production + Preview).
- [ ] Lokal testen: `npm install && npm run dev` → `http://localhost:3000` → Login mit Passwort.

**→ STOPP → testen → committen → fragen.**

---

## Phase 2 — Design-System & Layout

**Ziel:** 3-Spalten-Shell, Navigation, Karten-Wrapper, leere Platzhalter-Karten. Noch keine Daten.

### Agent-Auftrag
- `components/dashboard/`: `TopRail` (Navigation), `Shell` (3-Spalten-Layout), `Panel` (Karten-Wrapper).
- Dark-mode-Tokens (Tailwind), konsistente Typografie.
- Leere Karten-Hüllen für: Schlaf, Aufgaben, Ernährung, Training-Woche, Kraft, QuickCapture, Musik, Kalender.
- **Jede** spätere datengetriebene Karte braucht expliziten **Loading-** und **Error-State** — schon jetzt als Muster anlegen.

**→ STOPP → testen → committen → fragen.**

---

## Phase 3 — Garmin-Sync + Kalender

**Ziel:** Garmin-Daten landen automatisch in Supabase. Google-Kalender erscheint im Dashboard.

### Agent-Auftrag
- `lib/garminClient.ts` + `lib/garminWellness.ts` — Login (`garmin-connect`-Package) + Wellness-Abruf.
- `app/api/garmin/sync/route.ts` — schreibt `garmin_activities/sleep/body_battery/training`.
  - Mit `CRON_SECRET` absichern (Header/Query prüfen).
  - `export const maxDuration = 30`.
- `app/api/garmin/status/route.ts` — letzter Sync-Zeitstempel + Record-Counts.
- `app/api/garmin/backfill/route.ts` + `backfill-sleep` — Historie nachladen (paginiert).
- `lib/calendar.ts` — iCal lesen mit **`ical.js`** (5-Min-Cache), Helfer `isExamEvent`/`isTrainingEvent`.
- `app/api/calendar/route.ts` — Google-iCal-Events liefern.
- `components/dashboard/CalendarCard.tsx` + `CalendarView.tsx` — Wochenansicht mit NOW-Marker.
- `app/kalender/page.tsx`.
- **Cron** in `vercel.json`: `garmin/sync` täglich `0 6 * * *` (= 8:00 Berlin Sommer).

### Manuelle Schritte
- [ ] `GARMIN_EMAIL`, `GARMIN_PASSWORD`, `GOOGLE_CALENDAR_ICAL_URL` in `.env.local` **und** Vercel.
- [ ] Garmin erlaubt manchmal Login erst nach Bestätigungs-Mail — einmal manuell einloggen.
- [ ] Nach Deploy: Cron in Vercel → *Settings → Cron Jobs* prüfen (läuft er?).
- [ ] **Backfill einmalig** lokal/per Browser auslösen: `/api/garmin/backfill?months=12`.

> **Hinweis Zeitzone:** Vercel-Crons sind **UTC-fix**. `6 UTC` = 8:00 Berlin im Sommer, 7:00 im
> Winter. Den Garmin-Sync **vor** das Morgen-Briefing legen, damit die letzte Nacht gesynct ist.

**→ STOPP → testen → committen → fragen.**

---

## Phase 4 — Home-Dashboard

**Ziel:** Echte Karten mit echten Daten + Schnell-Logging.

### Agent-Auftrag
- `components/dashboard/SleepCard.tsx` — Schlaf-Score, HRV, Body Battery (liest `garmin_sleep`/`body_battery`).
- `components/dashboard/NutritionCard.tsx` + `app/api/nutrition` (GET/POST, `nutrition_logs`, Inline-Edit).
- `components/dashboard/StrengthLogger.tsx` + `app/api/strength` (GET/POST, `strength_sessions`).
- `components/dashboard/QuickCapture.tsx` — Schnell-Erfassung (vorerst Text → `knowledge_entries`).
- `app/page.tsx` — alles zusammensetzen.
- **Race-Condition-Schutz:** GET nach Mount darf User-Eingaben nicht überschreiben (Dirty-Flag-Pattern).

**→ STOPP → testen → committen → fragen.**

---

## Phase 5 — Training-Bereich

**Ziel:** Eigene `/training`-Seite: Wochenplan vs. Garmin-Ist, Kraft-Logger, Historie.

### Agent-Auftrag
- `app/training/page.tsx`.
- `app/api/training/summary/route.ts` — Wochen-Aggregate (Schwimmen/Rad/Lauf/Kraft).
- `components/dashboard/TrainingCard.tsx` + `TrainingWeekLive.tsx` — Plan vs. Ist.
- `components/dashboard/TriathlonHistory.tsx` — 30-Tage-Aktivitäten mit Filter.

> **Achtung Wochenlogik:** Der Wochenbericht muss die **abgelaufene** Vorwoche meinen, nicht die
> laufende — sonst stehen überall Nullen. Mit Berlin-Datum rechnen (`localDateKey()`).

**→ STOPP → testen → committen → fragen.**

---

## Phase 6 — Wissen + Obsidian

**Ziel:** Wissen erfassen → Claude kategorisiert → Supabase + Obsidian (lesbar, lokal).

### Agent-Auftrag
- `lib/categories.ts` — SDK-freie Kategorie-Konstanten (Client-importierbar).
- `lib/knowledge.ts` — `saveKnowledgeEntry/Note/Plan/Document`. Claude (leichtes Modell)
  kategorisiert nur, wenn keine Kategorie vorgegeben ist (**Kosten-Bremse**).
- `lib/obsidian.ts` + `lib/obsidianPaths.ts` — Vault-Pfade **zentral** (nie hart coden),
  `appendToDailyLog()` schreibt ins Logbuch. Schreiben ist **async + non-blocking**.
- `app/api/knowledge` (GET/POST) + `app/api/knowledge/sources` (Kategorien auflisten).
- Mit `API_SECRET` absichern (für spätere lokale Scripts).

### Manuelle Schritte
- [ ] In Obsidian das **Local REST API**-Plugin installieren und aktivieren.
- [ ] `OBSIDIAN_API_URL` (Standard `http://localhost:27123`) + `OBSIDIAN_API_KEY` in `.env.local`.
- [ ] Vault-Ordnerstruktur anlegen (siehe [Anhang C](#anhang-c--obsidian-vault-struktur)).

> **Wichtig (Cloud vs. lokal):** Vercel kann `localhost:27123` **nicht** erreichen. Vault-Writes
> aus der Cloud (Telegram/Crons) laufen also ins Leere. Lösung: Ein **lokaler Sync-Agent**
> (Phase 17) baut den Vault aus Supabase nach. Supabase ist die Quelle der Wahrheit, Obsidian die
> lesbare Spiegelung.

**→ STOPP → testen → committen → fragen.**

---

## Phase 7 — Musik-Bereich

**Ziel:** Projekt-Tracker + Sound-Library (nur Metadaten, **nie** Audio in Supabase).

### Agent-Auftrag
- `app/musik/page.tsx` + `components/dashboard/MusikSnapshot.tsx` (3 neueste Projekte).
- `app/api/musik/projects` (+ `[id]`) — CRUD, Status-Badges (idea/wip/mixing/done/released).
- `app/api/musik/sounds` (+ `[id]`, `bulk`, `scan`, `play`, `cleanup`) — Library-Metadaten,
  Bulk-Import: Dateinamen/Ordner → Claude kategorisiert.
- **Regel:** `sound_library.file_path` referenziert nur — keine Audiodatei in der DB.

**→ STOPP → testen → committen → fragen.**

---

## Phase 8 — Studium/Lern-Bereich

**Ziel:** `/`-Bereich für Lernfortschritt, klinische/fachliche Skills, Prüfungen.

### Agent-Auftrag
- `app/<lernbereich>/page.tsx` (im Original `/zahnmedizin`, generisch benennen).
- `app/api/habits` (GET/POST) — `daily_habits`, inkl. fachspezifischer Lern-Habits (Präfix-Konvention,
  z.B. `ZM_<fach>`), mit Historie/Streak.
- `lib/config/<fach>Skills.ts` — Skill-Checkliste.
- Prüfungstermine aus dem Kalender (`isExamEvent`).

**→ STOPP → testen → committen → fragen.**

---

## Phase 9 — RAG-Engine

**Ziel:** Semantische Suche (Embeddings) + SQL-Metriken, orchestriert von Claude im Tool-Loop.

### Agent-Auftrag
- **Migration `0005`**: `content_hash` (SHA-256) auf `knowledge_entries` — Duplikat-Schutz.
- **Migration `0007`**: pgvector-Extension, `embedding vector(1536)`-Spalte, **HNSW-Index**,
  RPC `match_knowledge` (Vektorsuche).
- `lib/embeddings.ts` — OpenAI `text-embedding-3-small` (**1536d, nie wechseln**).
- `lib/knowledge.ts` erweitern: Embed-on-Write (Hash prüfen, Duplikate überspringen).
- `lib/metricDefs.ts` + `lib/metrics.ts` — typisiertes Metrik-Enum + `query_metrics`-Dispatcher
  (Garmin/Nutrition/Labs als SQL, **kein rohes SQL an Claude**, immer Datumsbereich).
- `lib/answer.ts` — **`answerQuestion()`**: Claude-Tool-Loop (max. 3 Runden) mit zwei Tools:
  `search_knowledge` (pgvector) und `query_metrics` (SQL).
- `app/api/ask/route.ts` — RAG-Antwort (für Terminal-Suche + Telegram). `maxDuration = 30`.
- **Prompt-Caching:** nur den statischen System/Tool-Block cachen, nie die wechselnden Tool-Results.

### Manuelle Schritte
- [ ] Migrationen `0005`, `0007` anwenden, dann prüfen: `match_knowledge` existiert, HNSW-Index da.
- [ ] **Embeddings-Backfill** für bestehende Einträge (Script kommt in Phase 17).

**→ STOPP → testen → committen → fragen.**

---

## Phase 10 — Telegram-Bot

**Ziel:** Mobiler Eingang: Text, Sprache, Foto/PDF, Inline-Buttons, Fragen (RAG).

### Agent-Auftrag
- **Migration `0006`**: `telegram_pending_docs` (durabler State für mehrstufige Uploads) +
  `storage_path` auf `knowledge_entries`.
- `lib/telegramSend.ts` — `sendMessage`-Helfer.
  - **Bug-Falle:** Telegrams Legacy-Markdown bricht an Unterstrichen (z.B. `STATUS_3`).
    Für Telegram-Text Unterstriche durch Leerzeichen ersetzen.
- `app/api/transcribe/route.ts` — Whisper (Sprachnotiz → Text).
- `app/api/telegram/webhook/route.ts`:
  - Text → Inline-Keyboard (Training, Musik, Lernen, Plan, Notiz, Einkauf, Kalender, Frage).
  - Foto/PDF/Word/Excel/TXT → Gesundheit oder Verwaltung (Pipeline in Phase 11).
  - Sprachnotiz → Whisper → selbe Pipeline.
  - Frage-Button → `answerQuestion()` mit Quellenangaben.
  - **`TELEGRAM_USER_ID` prüfen** — nur der Besitzer darf den Bot bedienen.
- **State niemals in In-Memory-Maps** halten — auf Vercel wechselt das Lambda und der State ist weg.
  Mehrstufige Dialoge laufen über `telegram_pending_docs` bzw. UUID-Callbacks.

### Manuelle Schritte
- [ ] `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_USER_ID` setzen.
      (`TELEGRAM_USER_ID` = deine numerische ID, z.B. via `@userinfobot` herausfinden.)
- [ ] **Webhook registrieren** (nach Deploy), exakter Befehl:
      ```
      curl "https://api.telegram.org/bot<DEIN_BOT_TOKEN>/setWebhook?url=https://<deine-vercel-domain>/api/telegram/webhook&secret_token=<DEIN_WEBHOOK_SECRET>"
      ```
- [ ] Test am Handy: Text schicken → Kategorie tippen → speichert ohne Fehler.

**→ STOPP → testen → committen → fragen.**

---

## Phase 11 — Dokument-Pipeline (Ingest)

**Ziel:** Dokumente kommen über **3 Kanäle in dieselbe Pipeline**: `_Eingang/`-Ordner, Telegram, Terminal.

### Agent-Auftrag
- `lib/imageToDocPdf.ts` — Foto → sauberes Dokument-PDF (`sharp` + `pdf-lib`).
- `lib/documents.ts` — Telegram-Upload → Claude (Vision/PDF-Parse) → Supabase-Storage
  (`documents`-Bucket) + ggf. `health_labs` + RAG-Index. **Pro Dokument nur Auszug/Bild an Claude.**
- Routing: Gesundheit (Blutbild, Befund, EKG) vs. Verwaltung (Rechnung, Steuer, Uni, …).
  Die **Kategorien müssen in allen Kanälen identisch** sein (Telegram **und** `_Eingang`), sonst
  landet dasselbe Dokument je nach Kanal woanders.
- `/api/telegram/webhook` an die Pipeline anschließen.
- `scripts/eingang-ingest.mjs` (Phase 17) nutzt dieselbe Logik für den Drop-Ordner.

### Manuelle Schritte
- [ ] Supabase-Storage-Bucket `documents` anlegen (privat).
- [ ] Klassifizierungs-Modell: ein **stärkeres** Modell nehmen (liest Scans zuverlässiger als ein
      Mini-Modell — ein schwaches Modell hat in der Praxis Dokumente falsch einsortiert).

**→ STOPP → testen → committen → fragen.**

---

## Phase 12 — Terminal

**Ziel:** **Eine** UI für alles: Chat · RAG-Suche · Erfassen. Von jedem Gerät erreichbar.

### Agent-Auftrag
- `app/terminal/page.tsx` — Segmented Control: **CHAT / SUCHEN / ERFASSEN**.
- `app/api/chat/route.ts` — Streaming-Chat (Claude, mit Verlauf).
- `app/api/terminal/save-search/route.ts` — Suchergebnis ins Logbuch + `knowledge_entries`.
- Audio-Recorder → `/api/transcribe`.
- Skill-Selector (`lib/config/skills.ts`) + Lernfach-Selector (lädt eine Kategorie als Prompt-Cache).
- `app/wissen/page.tsx` → Redirect auf `/terminal?mode=search`.

**→ STOPP → testen → committen → fragen.**

---

## Phase 13 — Analyse & Korrelationen

**Ziel:** Ad-hoc-Analyse über 4/8/12/52 Wochen, Wochen-Ampel, Kalender-Korrelation.

### Agent-Auftrag
- `app/analyse/page.tsx`.
- `app/api/analyse/route.ts` — **Wochen-Aggregate** an Claude (Streaming). **Nie Roh-Rows.**
- `app/api/analyse/recent` (letzte Analyse) + `app/api/analyse/einkauf` (Einkaufsliste, leichtes Modell).
- Wochen-Ampel + HRV-Baseline/10%-Regel/ACWR im Bericht.

**→ STOPP → testen → committen → fragen.**

---

## Phase 14 — Briefings & Crons

**Ziel:** Automatische Telegram-Nachrichten: Morgen-Briefing, Tages-/Wochen-Digest.

### Agent-Auftrag
- `lib/briefing.ts` + `lib/briefingStore.ts` — Briefing bauen (Schlaf, nächste Einheit aus Kalender,
  Wochen-Training, „heute dran") und nach Supabase speichern.
- `lib/weeklyTraining.ts` — Wochen-Trainings-Zusammenfassung.
- `app/api/telegram/briefing/route.ts` (morning / weekly-training).
- `app/api/telegram/digest/route.ts` (daily / weekly).
- `app/api/briefing/today/route.ts` + `components/dashboard/BriefingCard.tsx` (gerendertes Markdown).
- Crons in `vercel.json` (siehe [Anhang B](#anhang-b--cron-tabelle)).

### Manuelle Schritte
- [ ] `CRON_SECRET` schützt alle Cron-Routen — in Vercel hinterlegen.
- [ ] Timing prüfen: Briefing **nach** Garmin-Sync (z.B. Sync `0 6`, Briefing `10 6`).

**→ STOPP → testen → committen → fragen.**

---

## Phase 15 — Vokabeltrainer

**Ziel:** Spaced Repetition (SM-2), bidirektional, Lernsession übersteht Cold Starts.

### Agent-Auftrag
- **Migration `0007/0008`**: `flashcards` + `flashcard_decks`, **Unique-Constraint auf `front`**.
- **Migration `0009`**: `learn_sessions` (persistente Session in der DB).
- `lib/flashcards.ts` — SM-2-Algorithmus, max. 30 Karten/Tag (Wiederholungen vor neuen Karten),
  bidirektional (z.B. 🇮🇹↔🇩🇪), Fälligkeit mit **Berlin-Datum** (nicht UTC).
- `app/api/learn/route.ts`.
- Telegram-Befehle: `/lernen`, `/antwort`, `/stopp`.
- `app/api/cron/flashcards/route.ts` — täglicher Reminder.
- `scripts/seed-<sprache>-vocab.ts` — Seed (legt beide Richtungen an, überspringt Vorhandenes).

### Manuelle Schritte
- [ ] Seed laufen lassen: `npx tsx scripts/seed-<sprache>-vocab.ts`.

**→ STOPP → testen → committen → fragen.**

---

## Phase 16 — Health-Reviews & Newsletter

**Ziel:** Periodische Gesundheits-Reviews + Fach-Newsletter automatisch nach Telegram.

### Agent-Auftrag
- `lib/healthReview.ts` — monatlich/halbjährlich/jährlich (Claude, Wochen-Aggregate).
  Mittelwerte **korrekt** rechnen (echtes Mittel, nicht gleitendes `(alt+neu)/2`).
- `app/api/cron/health-review/route.ts` + `app/api/health-review/run` (manuell).
- `lib/newsletter.ts` + `app/api/cron/newsletter/route.ts` — wöchentlich/monatlich (z.B. PubMed-Fach-Feed).
- Berichte landen in Obsidian (`<Bereich>/Reviews/…`) und werden per Telegram gepusht.

**→ STOPP → testen → committen → fragen.**

---

## Phase 17 — Lokale Sync-Scripts + Scheduler

**Ziel:** Der lokale PC spiegelt Supabase → Obsidian und füttert den `_Eingang`-Ordner.
Das schließt die Cloud↔lokal-Lücke aus Phase 6.

### Agent-Auftrag (`scripts/`, Node `.mjs`)
- `eingang-ingest.mjs` — `_Eingang/`-Ordner → Claude klassifiziert → Obsidian-Unterordner + RAG.
  - Dateinamen-Kollision per Hash-Suffix vermeiden.
  - **Verify-before-delete:** Original erst aus `_Eingang` löschen, wenn die Archiv-Kopie nachweislich abrufbar ist.
- `garmin-obsidian-sync.mjs` — Garmin-Tagesdaten als MD in den Vault.
- `storage-obsidian-sync.mjs` — Telegram-Uploads (Supabase-Storage) → Obsidian.
- `logbuch-sync.mjs` — Tageslog/Briefings/Digests/Pläne aus Supabase nachbauen
  (Timeline-Abfrage auf relevante Quellen filtern, sonst sprengen Massen-Importe das Limit).
- `knowledge-obsidian-sync.mjs` — erfasste Notizen → Kategorie-Ordner.
- `wissen-sync.mjs` — **bidirektional**: Supabase ↔ `…/Aktiv/` (aktiv) bzw. `…/Archiv/` (archiviert);
  Datei verschieben ↔ Flag in Supabase.
- `embed-backfill.mjs` — fehlende Embeddings nachtragen.
- `health-backfill.mjs` / `pdf-to-knowledge.mjs` / `garmin-backfill-sleep.mjs` — Backfills.
- `sync-all.mjs` — **Orchestrator**, ruft die obigen in fester Reihenfolge auf.

### Manuelle Schritte
- [ ] `.env.local` muss auch lokal alle Keys haben (die Scripts laufen außerhalb von Vercel).
- [ ] **Windows Task Scheduler:** EINEN Task `Personal-OS-Sync` anlegen, der `scripts\sync-all.bat`
      bei Anmeldung (und optional per Zeit-Trigger) ausführt. XML-Vorlage `scripts\sync-all-task.xml`
      registrieren:
      ```
      schtasks /Create /TN "Personal-OS-Sync" /XML "C:\Pfad\zu\scripts\sync-all-task.xml"
      ```
      (macOS/Linux: stattdessen `cron`/`launchd` mit demselben `node scripts/sync-all.mjs`.)
- [ ] Obsidian + Local-REST-API müssen laufen, wenn der Task läuft → Obsidian in den Autostart legen.

> **Warum lokal:** Nur der lokale Agent erreicht `localhost:27123`. Er ist der einzige Weg,
> wie Briefings/Logbuch/Uploads tatsächlich im Vault landen.

**→ STOPP → testen → committen → fragen.**

---

## Phase 18 — Finanzen (Python-Ebene)

**Ziel:** Bank-Transaktionen → Monats-Ausgaben + Korrelationen. Optional, aber mächtig.

### Agent-Auftrag
- **Migration `0010`**: `revolut_transactions`, `expense_summaries`, `health_analysis_results`.
- `analysis/requirements.txt` (anthropic, supabase, scipy, numpy, …).
- `analysis/<bank>/sync.py` — **CSV-Import** (Kontoauszug-Export) als einfacher Einstieg.
- `analysis/<bank>/enable_banking.py` + `setup_oauth.py` + `auto_sync.py` — optionaler API-Sync
  (Bank-Aggregator mit OAuth; läuft **nur lokal**, da Vercel nicht an Key+Session kommt).
- `analysis/health/correlations.py` — scipy-Korrelationen/Trends → `health_analysis_results`.
- `app/finanzen/page.tsx` + `app/api/finanzen/summary` — Monats-Summaries, Fix- vs. Einmalkosten.
- `app/api/analyse/correlations` — Korrelations-Block auf `/analyse`.
- `app/api/cron/finanzen` — monatliche Telegram-Zusammenfassung.
- `app/privacy` + `app/terms` — nötig, falls ein Bank-Aggregator OAuth-Redirect-Seiten verlangt.

### Manuelle Schritte
- [ ] Python-Deps: `pip install -r analysis/requirements.txt` (oder `py -3.x ...`).
- [ ] **Einfacher Weg:** Kontoauszug als CSV exportieren → `python analysis/<bank>/sync.py pfad.csv`.
- [ ] **API-Weg (optional):** Beim Bank-Aggregator App registrieren, Keys in `.env.local`
      (`*_APP_ID`, `*_PRIVATE_KEY`-Pfad, `*_REDIRECT_URI`). OAuth braucht einen öffentlichen
      Callback — lokal per Tunnel (z.B. ngrok) bereitstellen; **exakter Aufruf** mit vollem Pfad
      zur `ngrok.exe` und fester Subdomain. Session läuft typ. ~90 Tage → Re-Auth einplanen.
- [ ] Korrelationen: `python analysis/health/correlations.py` → erscheint auf `/analyse`.

> **Hinweis:** Bank-Zugänge und OAuth-Sessions sind hochsensibel und persönlich — der
> Private-Key bleibt **gitignored** und lokal. Nichts davon ins Repo committen.

**→ STOPP → testen → committen → fragen.**

---

## Phase 19 — Wiederkehrende Aufgaben

**Ziel:** Fälligkeits-basierte Aufgaben (Wäsche täglich, Putzen wöchentlich, …) auf dem Dashboard.

### Agent-Auftrag
- **Migration `0011`**: `recurring_tasks` (Kadenz in Tagen, `last_done`).
- `lib/tasks.ts` — Fälligkeit berechnen, erledigt-/rückgängig-setzen.
- `app/api/tasks/route.ts` (GET Liste, POST erledigt/rückgängig).
- `components/dashboard/TasksCard.tsx` — ersetzt die alte statische Habits-Karte; „heute dran" auch ins Briefing.

**→ STOPP → testen → committen → fragen.**

---

## Phase 20 — Optional: Marktanalyse-System

**Ziel:** Ein Claude-„Skill", der täglich/tief Märkte analysiert und Ergebnisse in Obsidian + Supabase schreibt.
Rein optional, unabhängig vom Rest.

### Agent-Auftrag
- Supabase-Tabellen: `market_daily_macro`, `market_events`, `market_reactions`,
  `market_investment_signals` (+ optional Snapshot-Tabelle für Zeitverlauf/Outcome-Tracking).
- Ein Skill/Prompt (`daily market` / `deep market`), der nach jedem Run automatisch
  Obsidian-Tageslog **und** Supabase schreibt (Signale mit Outcome-Tracking: delta, status).
- Auswertungs-Views (z.B. Performance je Tier/Faktor).

**→ STOPP → testen → committen → fragen.**

---

## Anhang A — Env-Variablen (vollständig)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# AI
ANTHROPIC_API_KEY
OPENAI_API_KEY

# Telegram
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_USER_ID

# Kalender / Garmin
GOOGLE_CALENDAR_ICAL_URL
GARMIN_ICAL_URL            # optional: Garmin-Connect-Kalender-Export
GARMIN_EMAIL
GARMIN_PASSWORD

# Obsidian (lokal)
OBSIDIAN_API_URL           # http://localhost:27123
OBSIDIAN_API_KEY

# Geheimnisse / Gates (selbst erzeugen)
CRON_SECRET
AUTH_SECRET
DASHBOARD_PASSWORD
API_SECRET                 # schützt /api/knowledge für lokale Scripts
USER_TIMEZONE              # z.B. Europe/Berlin

# Finanzen (optional, Phase 18) — bleiben lokal, NICHT committen
ENABLE_BANKING_APP_ID
ENABLE_BANKING_PRIVATE_KEY # Pfad zur .pem im Root (gitignored)
ENABLE_BANKING_REDIRECT_URI
```

> Was in **Vercel** muss: alles außer den nur-lokalen Werten (`OBSIDIAN_*`, Bank-OAuth).
> Was nur **lokal** (`.env.local`) bleibt: Obsidian-Zugang + Bank-Keys/Session.

---

## Anhang B — Cron-Tabelle

> Alle Zeiten **UTC**. `6 UTC` = 8:00 Berlin (Sommer) / 7:00 (Winter).

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
| `0 10 2 * *` | `cron/finanzen` | Monats-Finanzen |
| `50 21 * * *` | `telegram/digest?type=daily` | Tages-Digest |
| `55 21 * * 0` | `telegram/digest?type=weekly` | Wochen-Digest (So) |

---

## Anhang C — Obsidian-Vault-Struktur

> Pfade zentral in `lib/obsidianPaths.ts` — **nie hart coden**. Generisch halten, an eigenes Leben anpassen.

```
Vault/
├── _Eingang/                         <- Drop-Ordner für automatischen Ingest
├── Einkauf/
├── Gesundheit/{Training, Dokumente, Werte, Recherche}/
├── KI/{Marktanalysen, Skills}/       <- KI-Wissen + Skills
├── Literatur/<Fach>/{Aktiv, Archiv}/ <- bidirektionaler Wissen-Sync
├── Logbuch/JJJJ/MM/JJJJ-MM-TT.md     <- Tagesdateien (Briefing oben eingebettet)
├── Logbuch/Wochen/
├── Musik/
├── Reisen/{Dokumente, Pläne}/
├── Verwaltung/{Amt, Arbeit, Finanzen, Datenbank, Universität, Versicherung, Wohnen, Sonstiges}/
└── Recherche/
```

**Ingestion-Prinzip:** Dokumente kommen über 3 Kanäle in **dieselbe** Pipeline:
`_Eingang/` (lokaler Drop-Ordner), Telegram (Foto/PDF), Terminal-Upload.

---

## Anhang D — Bekannte Bugs (von Anfang an vermeiden)

Diese Fehler sind im Originalbau echt passiert. Wer sie kennt, baut sie nicht nach:

1. **BigInt-Crash auf Vercel** durch `node-ical` → immer **`ical.js`** nutzen.
2. **Habits resetten um 4 Uhr** (Server-UTC) → überall **`localDateKey()`** (lokale Zeit).
3. **Stille POST-Fehler** durch `.catch(() => {})` → Fehler **immer loggen**.
4. **Race Condition:** GET nach Mount überschreibt Tipp-Eingaben → **Dirty-Flag**-Pattern.
5. **Client-Crash** durch TS-`!` über async-Grenzen → immer sauberer Loading-State.
6. **Telegram-State in In-Memory-Maps** verliert sich beim Lambda-Wechsel → State in der DB
   (`telegram_pending_docs` / UUID-Callbacks).
7. **Telegram-Markdown** bricht an Unterstrichen → Unterstriche im Telegram-Text ersetzen.
8. **Wochenbericht meint laufende statt abgelaufene Woche** → überall 0 → mit Berlin-Datum die Vorwoche.
9. **Schwaches Klassifizierungs-Modell** sortiert Scans falsch → stärkeres Modell für Dokumente.
10. **Kategorie nur in einem Kanal** definiert → dasselbe Dokument landet je nach Kanal woanders →
    Kategorien in Telegram **und** `_Eingang` synchron halten.
11. **Vault-Write aus der Cloud** erreicht `localhost` nie → lokaler Sync-Agent baut den Vault nach.
12. **Roh-Rows an Claude** in der Analyse → teuer → immer Wochen-Aggregate vorverarbeiten.

---

> **Reihenfolge-Empfehlung:** Phasen 1–14 sind das Kernsystem und bauen aufeinander auf.
> 15–20 sind unabhängige Erweiterungen — in beliebiger Reihenfolge oder gar nicht.
> Nach **jeder** Phase: STOPP → testen → committen → fragen.
</content>
</invoke>
