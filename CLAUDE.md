# CLAUDE.md
# Personal Dashboard — Complete Build Blueprint

## About me
- Dental student, future dentist (Zahnarzt)
- Based in Germany / German-speaking
- Training: triathlon (swim/bike/run) + strength training
- Garmin watch user — syncs daily with Garmin Connect
- iPhone user, Telegram for voice capture on the go
- Music producer and rapper (hobby) — works in FL Studio

## The project
One personal dashboard that replaces all other tracking apps.
One URL. Everything in one place. No separate apps.

Goals:
1. Auto-sync training data from Garmin (triathlon + sleep + recovery)
2. Log habits, nutrition, strength sessions manually in seconds
3. Find correlations between sleep, nutrition, and performance after 8+ weeks
4. Dump research and knowledge — Claude auto-categorizes, stored forever
5. Track FL Studio projects and manage sound library metadata
6. Dental study: learning progress, clinical skills, upcoming exams from calendar

## Tech stack
- Frontend: Next.js 15, App Router, TypeScript strict, Tailwind CSS, dark mode
- Database: Supabase (Postgres) — service role key server-only, anon key client
- Hosting: Vercel free tier + GitHub
- AI: Anthropic Claude Haiku (cheap, fast — categorization + analysis on demand)
- Transcription: OpenAI Whisper (Telegram voice notes only)
- Calendar: Google Calendar via iCal URL — ical.js ONLY, never node-ical
- Training sync: Garmin Connect via daily Vercel cron
- Voice capture: Telegram bot — simple, no classifier
- Knowledge export: async write to Obsidian vault via Local REST API

## Database schema
```sql
-- Auto-populated by Garmin cron
garmin_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'me',
  activity_id bigint UNIQUE,
  date date NOT NULL,
  type text,  -- 'running', 'cycling', 'swimming', 'strength_training', etc.
  duration_min int,
  distance_km numeric,
  avg_hr int,
  max_hr int,
  calories int,
  elevation_m int,
  avg_pace text,
  name text,
  created_at timestamptz DEFAULT now()
)

garmin_sleep (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'me',
  date date UNIQUE NOT NULL,
  sleep_score int,
  hrv_nightly int,
  total_sleep_min int,
  deep_sleep_min int,
  rem_sleep_min int,
  light_sleep_min int,
  awake_min int,
  created_at timestamptz DEFAULT now()
)

garmin_body_battery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'me',
  date date UNIQUE NOT NULL,
  morning_score int,
  evening_score int,
  stress_avg int,
  created_at timestamptz DEFAULT now()
)

-- Manual entries via dashboard
strength_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'me',
  date date NOT NULL,
  intensity int NOT NULL CHECK (intensity IN (1,2,3)),  -- 1=light, 2=moderate, 3=heavy
  session_type text,  -- 'upper', 'lower', 'full', 'cardio_strength'
  notes text,
  created_at timestamptz DEFAULT now()
)

daily_habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'me',
  date date NOT NULL,
  habit_name text NOT NULL,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(date, habit_name)
)

nutrition_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'me',
  date date UNIQUE NOT NULL,
  calories int,
  protein_g int,
  carbs_g int,
  fat_g int,
  notes text,
  created_at timestamptz DEFAULT now()
)

-- Knowledge and research
knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'me',
  raw_text text NOT NULL,
  category text,
  summary text,
  tags text[],
  source text DEFAULT 'dashboard',
  created_at timestamptz DEFAULT now()
)

-- Music production
music_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'me',
  title text NOT NULL,
  bpm int,
  musical_key text,
  scale text,  -- 'minor', 'major', 'dorian', etc.
  genre text,
  mood text,
  status text DEFAULT 'idea' CHECK (status IN ('idea','wip','mixing','done','released')),
  collab text,
  notes text,
  date_started date DEFAULT CURRENT_DATE,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
)

sound_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'me',
  name text NOT NULL,
  category text NOT NULL,  -- 'drums','bass','synth','vocals','fx','loop','oneshot','sample'
  subcategory text,
  tags text[],
  bpm int,
  musical_key text,
  file_path text,
  notes text,
  created_at timestamptz DEFAULT now()
)
```

## Architecture rules — never break these
- Page loads NEVER trigger Claude API calls. Pages read from Supabase only.
- Claude runs only on explicit user action (save button, analysis button).
- Always use localDateKey() for date logic — user local clock, never server UTC.
- Use ical.js for calendar — node-ical has a BigInt bug on Vercel, never use it.
- Garmin sync is a daily Vercel cron at 5am UTC — never on page load.
- Obsidian write is async and non-blocking — dashboard never waits for it.
- Sound library stores metadata only — no audio files in Supabase, file_path reference only.
- Always surface API errors to console — never silent .catch(() => {}).
- Never use ! non-null assertion across async boundaries — fix the type.
- Analyse API: pre-aggregate all data to weekly summaries in SQL before sending to Claude. Never send raw rows. Weekly averages are sufficient for correlation analysis and reduce input tokens by ~85%.

## Key env vars
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
OPENAI_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_USER_ID
GOOGLE_CALENDAR_ICAL_URL
GARMIN_EMAIL
GARMIN_PASSWORD
OBSIDIAN_API_URL
OBSIDIAN_API_KEY
CRON_SECRET
AUTH_SECRET
DASHBOARD_PASSWORD
USER_TIMEZONE
```

## How I want you to work with me
- Build exactly what the current evening's prompt says. Nothing more.
- Always check Architecture rules before writing any route or component.
- Prefer simple and working over clever and fragile.
- Flag anything that could break in Vercel production but not locally.
- File naming: app/api/[resource]/route.ts, components/[Section][Card].tsx
- All Supabase row types go in lib/types.ts — define before using.
- Every API route needs explicit loading and error state on the frontend.

## Session start ritual
At the beginning of every session, before writing any code:
1. Read STATUS.md to know which evening was last completed
2. Give me a one-sentence summary: "Abend X ist abgeschlossen. Heute bauen wir Abend Y: [was kommt]."
3. Wait for my confirmation before starting

## Session end ritual
At the end of every session, always do these three things in order:
1. Run `git add -A && git commit -m "Abend X: [short description of what was built]"`
2. Update STATUS.md with the following format:
   ```
   Zuletzt abgeschlossen: Abend X — [what was built]
   Nächster Schritt: Abend Y — [what comes next]
   Datum: YYYY-MM-DD
   Offene Punkte: [anything that needs manual action before next session, or "keine"]
   ```
3. Tell me exactly what manual steps (if any) I need to do before the next session

## Pet peeves
- Never use node-ical
- Never trigger Claude API on page load
- Never use ! to silence TypeScript errors
- Never store audio files in Supabase — file_path references only
- Never add features outside the current evening's scope without asking
- Never make assumptions — ask clarifying questions before doing any work

## Coding Behavior

**Think before coding — surface tradeoffs, don't hide confusion.**
- State assumptions explicitly before implementing. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If something is unclear, stop. Name what's confusing. Ask first.
- If a simpler approach exists, say so. Push back when warranted.

**Surgical changes — touch only what you must.**
- Don't "improve" adjacent code, comments, or formatting that wasn't part of the request.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code or issues, mention them — don't fix them.
- Remove only imports/variables/functions that YOUR changes made unused.

**Goal-driven execution — define success, verify it.**
For multi-step tasks, state a brief plan before starting:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
```
For bug fixes: write a reproduction first, then fix it.
For features: define what "done" looks like before writing any code.

*(Simplicity rules are already in "How I want you to work with me" and "Pet peeves" above.)*

---

# NIGHTLY BUILD PLAN
# Jeden Abend einen Abschnitt. Prompt kopieren → in Claude Code einfügen → fertig.
# Manuelle Schritte sind mit ⚙️ markiert.

================================================================================
## ABEND 1 — Foundation: Scaffold + Schema + Auth + Deploy
================================================================================

⚙️ Vorher manuell:
1. Supabase Projekt anlegen auf supabase.com
2. Unter Database → Extensions: pgvector aktivieren
3. Drei Werte aus dem Supabase Dashboard notieren:
   - Project URL → NEXT_PUBLIC_SUPABASE_URL
   - Anon key → NEXT_PUBLIC_SUPABASE_ANON_KEY
   - Service role key → SUPABASE_SERVICE_ROLE_KEY
4. GitHub: neues leeres Repository erstellen
5. Vercel Account bereit haben

---

PROMPT 1A — Projekt erstellen:
```
Create a new Next.js 15 project in the current directory with:
- App Router and TypeScript strict mode
- Tailwind CSS configured with dark mode as default (class strategy)
- A globals.css with oklch colour tokens:
  --ink-0: oklch(0.98 0 0);
  --ink-1: oklch(0.85 0 0);
  --ink-2: oklch(0.65 0 0);
  --ink-3: oklch(0.40 0 0);
  --ink-4: oklch(0.15 0 0);
  --accent: oklch(0.72 0.18 250);
  --ok: oklch(0.72 0.18 145);
  --warn: oklch(0.75 0.18 80);
  --danger: oklch(0.65 0.22 25);
- Install @supabase/supabase-js
- Create lib/supabase.ts with browser client using NEXT_PUBLIC_ env vars
- Create lib/supabaseAdmin.ts with service role client for server-only use
- Create lib/types.ts with TypeScript types for all 9 database tables from CLAUDE.md
- Create a localDateKey() helper in lib/dateUtils.ts that returns today's date
  string (YYYY-MM-DD) using the user's local clock, never server UTC
- Initialise git and make first commit
```

PROMPT 1B — Schema:
```
Create the Supabase migration file at supabase/migrations/0001_init.sql
using the exact schema from CLAUDE.md (all 9 tables with all columns).
Enable Row Level Security on all tables with deny-all policies.
The service role key bypasses RLS — all server routes use the admin client.
Add a comment at the top of the file explaining each table's purpose.
After creating the file, print the SQL so I can run it in the Supabase SQL editor.
```

PROMPT 1C — Auth gate:
```
Add a single-password auth gate to the Next.js app:
- Use HMAC-signed cookies (AUTH_SECRET env var, random 32-byte hex)
- DASHBOARD_PASSWORD env var for the password
- Create middleware.ts that protects all routes except /login and /api/auth/*
- Create app/login/page.tsx — minimal dark-mode login form, single password field
- Create app/api/auth/login/route.ts — verifies password, sets signed cookie (7 day expiry)
- Create app/api/auth/logout/route.ts — clears the cookie
- API routes also accept x-api-secret header for programmatic access (API_SECRET env var)
```

⚙️ Nach den Prompts:
- Code auf GitHub pushen
- Auf Vercel deployen
- Alle Env Vars aus CLAUDE.md in Vercel eintragen
- Login testen

================================================================================
## ABEND 2 — Design: HTML Mockup + Next.js Components
================================================================================

PROMPT 2A — HTML Mockup generieren:
```
Generate a single-page HTML mockup for my personal dashboard with this layout:

Top rail: "PERSONAL OS // V1" on the left, tabs in the centre 
(Home, Training, Musik, Zahnmedizin, Wissen, Kalender), date/time on the right.

Below the rail: 3-column grid (left narrow ~280px, centre wide, right narrow ~280px).

Left column (stacked cards):
- Sleep & Recovery: sleep score (big number), HRV, body battery bar
- Habits: 6 toggleable checkboxes with labels, daily score percentage
- Nutrition: calories progress bar, protein/carbs/fat macros

Centre column (stacked cards):
- Today's Training: plan from calendar vs actual from Garmin, week at a glance
- Strength Logger: date + 3 intensity buttons (LEICHT / MITTEL / SCHWER) + notes field

Right column (stacked cards):
- Quick Capture: textarea + send button, 5 type-select buttons below
  (🏃 Training / 🎵 Musik / 📚 Lernen / 💡 Idee / 🍎 Essen)
- Musik Snapshot: 3 most recent FL Studio projects with status badge

Style: dark mode, glassmorphism cards with backdrop-blur, oklch colour tokens,
monospace numbers, thin borders (1px, low opacity), subtle card differentiation.
Use realistic placeholder data throughout.
```

PROMPT 2B — Nach dem Mockup in Next.js portieren:
```
Port the HTML mockup into Next.js components under components/dashboard/:
- One component per card (SleepCard, HabitsCard, NutritionCard, TrainingCard,
  StrengthLogger, QuickCapture, MusikSnapshot)
- A shared Panel component for the glassmorphism card wrapper
- A TopRail component for the navigation header with tab routing
- A Shell component for the 3-column page layout
Wire everything in app/page.tsx with placeholder data and empty handlers.
No API connections yet — just the visual structure.
After porting: run the dev server and confirm layout matches the mockup.
```

================================================================================
## ABEND 3 — Daten: Garmin Sync + Google Calendar
================================================================================

⚙️ Vorher manuell:
1. Google Calendar: Einstellungen → Kalender → "Kalender integrieren"
   → Geheime Adresse im iCal-Format kopieren → GOOGLE_CALENDAR_ICAL_URL in Vercel
2. Garmin Zugangsdaten bereit halten (GARMIN_EMAIL, GARMIN_PASSWORD)

PROMPT 3A — Garmin Sync:
```
Build the Garmin Connect sync system:

1. Install the garmin-connect npm package (or implement direct fetch auth if unavailable).
   If neither works, implement a Python script approach:
   - Create scripts/garmin_sync.py using the garminconnect pip package
   - The script fetches yesterday's activities, sleep, and body battery
   - Posts the data to /api/garmin/ingest via HTTP with CRON_SECRET auth

2. Create app/api/garmin/sync/route.ts that:
   - Authenticates with Garmin Connect using GARMIN_EMAIL and GARMIN_PASSWORD
   - Fetches activities from the last 2 days (to handle timezone edge cases)
   - Upserts into garmin_activities table (conflict on activity_id)
   - Fetches sleep data and upserts into garmin_sleep (conflict on date)
   - Fetches body battery / stress and upserts into garmin_body_battery (conflict on date)
   - Verifies Authorization: Bearer ${CRON_SECRET} header
   - Returns { synced_activities, synced_sleep, synced_body_battery, errors[] }

3. Add to vercel.json:
{
  "crons": [{ "path": "/api/garmin/sync", "schedule": "0 5 * * *" }]
}

4. Create app/api/garmin/status/route.ts — returns the most recent sync timestamp
   and count of records per table for the dashboard status indicator.

Important: Never store Garmin credentials in code — env vars only.
Log sync errors to console with enough detail to debug.
```

PROMPT 3B — Calendar card:
```
Build the Calendar card and its API route.

API route at app/api/calendar/route.ts:
- Read GOOGLE_CALENDAR_ICAL_URL from env
- Use ical.js (NOT node-ical — it has a BigInt bug on Vercel)
- Expand recurring events using event.iterator() within a 14-day window
- Cache the parsed feed in module-level memory for 5 minutes
- Return events as { id, title, start, end, allDay, description, location }[]
- Response header: Cache-Control: no-store

Calendar card component (components/dashboard/CalendarCard.tsx):
- Show the current week as 7 column headers (Mon–Sun)
- Highlight today's column
- List today's events below with time and title
- Click any day header to see that day's events
- Show a "SYNC" badge if there are Garmin activities that match today's calendar events
- Auto-scroll to current time with a NOW marker line
```

================================================================================
## ABEND 4 — Home Dashboard: Sleep + Habits + Nutrition
================================================================================

PROMPT 4 — Home dashboard cards verbinden:
```
Connect the three left-column cards to real data.

1. Sleep & Recovery card (SleepCard):
   - API: GET /api/sleep/today → reads latest row from garmin_sleep
   - Also reads latest garmin_body_battery row
   - Display: sleep_score as large number with colour coding
     (>80 green, 60-80 amber, <60 red using oklch tokens)
   - Show HRV, total sleep hours, deep sleep %, body battery morning score
   - Show yesterday's data if today's not synced yet

2. Habits card (HabitsCard):
   Configure 6 default habits in lib/config/habits.ts:
   ['Wasser 2.5L', 'Protein Ziel', 'Kein Alkohol', 'Schlafen 22:30', 
    'Meditation', 'Kein Social Media vor 9']
   
   - API: GET /api/habits?date=YYYY-MM-DD → reads daily_habits for that date
   - API: POST /api/habits → upserts { date, habit_name, completed } into daily_habits
   - Use localDateKey() for "today" — never server UTC
   - localStorage cache for instant toggle feedback, sync to Supabase on every click
   - Show daily score as X/6 and percentage
   - Reset visually at local midnight (localDateKey changes)

3. Nutrition card (NutritionCard):
   - API: GET /api/nutrition?date=YYYY-MM-DD → reads nutrition_logs for that date
   - API: POST /api/nutrition → upserts { date, calories, protein_g, carbs_g, fat_g, notes }
   - Display: calories as large number with target (default 2500 kcal)
   - Macro bars: protein (target 160g), carbs (target 280g), fat (target 80g)
   - Inline edit: click any value to edit, blur to save
   - Notes field below macros
   - Use localDateKey() for today
```

================================================================================
## ABEND 5 — Training Section
================================================================================

PROMPT 5 — Training Section aufbauen:
```
Build the Training section at app/training/page.tsx.

1. Week overview (TrainingWeekCard):
   - Fetch this week's calendar events (via /api/calendar) — show as "planned"
   - Fetch this week's garmin_activities — show as "completed"
   - For each day: planned session title (from calendar) and actual session
     (type + duration from Garmin) side by side
   - If Garmin has an activity matching a calendar day → show as "DONE ✓" in green
   - If calendar has a session but no Garmin activity → "AUSSTEHEND" in amber
   - Show weekly totals: km swum, km biked, km run, total training hours

2. Strength Logger (StrengthLogger):
   - Three large buttons: LEICHT (1) / MITTEL (2) / SCHWER (3)
   - Date picker (defaults to today via localDateKey)
   - Optional session type selector: Oberkörper / Unterkörper / Ganzkörper / Ausdauer+Kraft
   - Notes textarea
   - Save → POST /api/strength → inserts into strength_sessions
   - Show last 5 strength sessions below the form as a simple list

3. Triathlon detail view (TriathlonHistory):
   - Fetch last 30 days from garmin_activities
   - Filter buttons: Alle / Schwimmen / Radfahren / Laufen
   - Each activity card: type icon, date, duration, distance, avg HR
   - Click to expand: all available metrics for that activity

API routes needed:
- GET /api/strength?days=30 → last N strength sessions
- POST /api/strength → insert new strength session
- GET /api/training/summary?days=30 → aggregated weekly totals
```

================================================================================
## ABEND 6 — Wissen & Recherche: Knowledge Capture + Obsidian
================================================================================

⚙️ Vorher manuell:
1. Obsidian öffnen → Community Plugins → Local REST API installieren und aktivieren
2. API Key aus dem Plugin kopieren → OBSIDIAN_API_URL und OBSIDIAN_API_KEY in .env.local
3. Obsidian Vault Pfad notieren

PROMPT 6 — Knowledge system aufbauen:
```
Build the Wissen section at app/wissen/page.tsx.

1. Knowledge capture API (POST /api/knowledge):
   Input: { raw_text: string, source?: string }
   
   Processing — call Claude Haiku (NOT Sonnet, NOT Opus — Haiku is fast and cheap):
   System prompt: "You are a knowledge categorization assistant. 
   Analyze the text and return ONLY valid JSON, no other text:
   {
     'category': one of [Zahnmedizin, Triathlon, Krafttraining, Ernährung, 
                         Musikproduktion, FL Studio, Sampling, Allgemein],
     'summary': 'one sentence summary in German, max 120 chars',
     'tags': ['tag1', 'tag2', 'tag3'] // max 5, lowercase, German
   }"
   
   After Claude response:
   - Parse JSON (strip any markdown fences first)
   - Insert into knowledge_entries with raw_text + Claude's category/summary/tags
   - ASYNC (non-blocking): write to Obsidian vault as markdown file
   - Return the created entry
   
   The Obsidian write goes to:
   {OBSIDIAN_VAULT_PATH}/Recherche/{category}/{YYYY-MM-DD}-{slug}.md
   Format:
   ---
   date: YYYY-MM-DD
   category: {category}
   tags: [tag1, tag2]
   ---
   # {summary}
   
   {raw_text}
   
   If Obsidian API is unreachable, log the error but DO NOT fail the main request.

2. Knowledge browse (GET /api/knowledge):
   Params: ?category=&search=&limit=50
   Returns entries ordered by created_at desc
   
3. Wissen page UI:
   - Large textarea at the top "Hier dumpen..." with a big SPEICHERN button
   - Loading state while Claude categorizes (show "Claude kategorisiert...")
   - After save: show the auto-detected category and tags as confirmation toast
   - Below: filter tabs for each category (Alle + 8 categories)
   - Each entry card: category badge, summary, tags, date, expand to see raw_text
   - Search input that filters client-side
   - Entry cards are clickable to expand full text
```

================================================================================
## ABEND 7 — Musik Section: Project Tracker + Sound Library
================================================================================

PROMPT 7 — Musik Section aufbauen:
```
Build the Musik section at app/musik/page.tsx with two sub-views.

1. Project Tracker:

API routes:
- GET /api/musik/projects → all music_projects ordered by updated_at desc
- POST /api/musik/projects → create new project
- PATCH /api/musik/projects/[id] → update project (any field)
- DELETE /api/musik/projects/[id] → delete project

UI:
- Filter row: status pills (Alle / Idea / WIP / Mixing / Done / Released)
  and genre filter dropdown
- Project cards in a responsive grid:
  Title (large), BPM + Key badge, Genre, Status badge with colour coding
  (idea=gray, wip=blue, mixing=amber, done=green, released=purple)
  Mood tag, Collab field if set, Last updated date
  Click → open edit drawer with all fields
- "Neues Projekt" button → inline quick-add form:
  Title (required), BPM, Key + Scale, Genre, Mood — all optional
  Pressing Enter on title saves with defaults

Status colour scheme using oklch tokens:
- idea: var(--ink-2) background
- wip: var(--accent) background  
- mixing: var(--warn) background
- done: var(--ok) background
- released: oklch(0.65 0.18 290) background

2. Sound Library:

API routes:
- GET /api/musik/sounds → query params: category, search, bpm_min, bpm_max, key, tag
- POST /api/musik/sounds → add single entry
- POST /api/musik/sounds/bulk → add multiple entries from text list
- DELETE /api/musik/sounds/[id] → remove entry

UI:
- Category sidebar: Drums / Bass / Synth / Vocals / FX / Loop / Oneshot / Sample
  with count badges
- Search bar: filters by name, tags, key simultaneously
- BPM range slider (0-200)
- Sound cards in a dense list view:
  Name, category badge, BPM (if set), Key (if set), tags, file_path (copy button)
- "Sound hinzufügen" form: all fields, tags as comma-separated input
- "Bulk Import" button: paste a list of filenames, one per line →
  POST to /api/musik/sounds/bulk which:
  1. Parses each filename for BPM (looks for numbers 60-200), key patterns
  2. Calls Claude Haiku with: "Given these sample filenames, suggest category 
     and up to 3 tags for each. Return JSON array: [{name, category, tags}].
     Filenames: {list}"
  3. Inserts all results into sound_library
  4. Returns count of imported sounds and any that need manual review
```

================================================================================
## ABEND 8 — Zahnmedizin Section
================================================================================

PROMPT 8 — Zahnmedizin Section aufbauen:
```
Build the Zahnmedizin section at app/zahnmedizin/page.tsx.
All data for this section is stored in the knowledge_entries table 
(filtered by category='Zahnmedizin') and daily_habits table.
No new database tables needed.

1. Lernfortschritt (StudyProgress):
Store study progress as special habits with names prefixed "ZM_":
"ZM_Anatomie", "ZM_Physiologie", "ZM_Zahnerhaltung", "ZM_Prothetik", 
"ZM_Kieferorthopädie", "ZM_Parodontologie", "ZM_Oralchirurgie", "ZM_Radiologie"

API: reuse /api/habits — just filter for habits starting with "ZM_"

UI:
- Grid of subject cards, each with a progress indicator
- Click to toggle "studied today"
- Show streak: how many days in a row this subject was studied
- Small calendar heatmap per subject (last 30 days)

2. Klinische Skills Checklist (ClinicalSkills):
Hard-code a list of clinical milestones in lib/config/dentalSkills.ts:
[
  { id: 'phantom_karies', label: 'Kariesbehandlung am Phantom', level: 'Vorklinik' },
  { id: 'phantom_fuell', label: 'Kompositfüllung am Phantom', level: 'Vorklinik' },
  { id: 'endo_basic', label: 'Endodontische Grundbehandlung', level: 'Klinik' },
  { id: 'paro_basic', label: 'Parodontale Basistherapie', level: 'Klinik' },
  { id: 'extraction', label: 'Einfache Extraktion', level: 'Klinik' },
  { id: 'crown_prep', label: 'Kronenpräparation', level: 'Klinik' },
  // Add more as needed
]

Store completion state in localStorage (not Supabase — this is simple reference data).
Display as grouped checklist by level, with completion percentage per group.

3. Prüfungen (ExamView):
- Fetch calendar events from /api/calendar
- Filter for events containing keywords: "Prüfung", "Klausur", "OSCE", "Testat", "Exam"
- Display as a timeline: upcoming exams sorted by date
- Days until exam shown prominently
- Click exam → show full event description from calendar
- Colour coding: <7 days = danger, 7-30 days = warn, >30 days = ok

4. Zahnmedizin Recherche:
- Show knowledge_entries filtered by category='Zahnmedizin'
- Same card UI as the main Wissen page
- Quick-add field at the top (posts to /api/knowledge with pre-set category)
```

================================================================================
## ABEND 9 — Telegram Bot: Voice Capture
================================================================================

⚙️ Vorher manuell:
1. In Telegram: @BotFather → /newbot → Name und Username wählen → Token speichern
2. @userinfobot anschreiben → deine numerische User-ID notieren
3. Random Webhook Secret generieren: in Terminal: openssl rand -hex 16
4. Alle drei als Env Vars in Vercel eintragen: TELEGRAM_BOT_TOKEN, TELEGRAM_USER_ID, TELEGRAM_WEBHOOK_SECRET
5. Nach dem Deploy diesen curl-Befehl ausführen (mit deinen Werten):
   curl -F "url=https://DEINE-URL.vercel.app/api/telegram/webhook" \
   -F "secret_token=DEIN_WEBHOOK_SECRET" \
   "https://api.telegram.org/botDEIN_TOKEN/setWebhook"

PROMPT 9 — Telegram Bot aufbauen:
```
Build a simple Telegram capture bot at app/api/telegram/webhook/route.ts.
This bot is intentionally simple — no AI classifier, no complex routing.
The user manually selects the type with a button tap.

The webhook flow:
1. Verify x-telegram-bot-api-secret-token header matches TELEGRAM_WEBHOOK_SECRET
2. Verify message.from.id matches TELEGRAM_USER_ID (bot only responds to me)
3. If the update is a callback_query (button tap):
   - Parse the callback data: format is "type:{TYPE}:text:{ORIGINAL_TEXT}"
   - Route to the correct table based on TYPE (see routing below)
   - Answer the callback query to remove the loading state
   - Send confirmation message
4. If the update is a voice message:
   - Download the audio file from Telegram
   - Transcribe with OpenAI Whisper (model: whisper-1)
   - Send the transcribed text back with an inline keyboard asking for type
5. If the update is a text message:
   - Send the text back with an inline keyboard asking for type

Inline keyboard (shown after every capture):
Row 1: [🏃 Training] [🎵 Musik] [📚 Lernen]
Row 2: [💡 Idee] [🍎 Essen]

Callback data format: "type:TRAINING:text:hier ist der transkribierte text"

Routing by type:
- TRAINING → insert into strength_sessions (date=today, intensity=2, notes=text)
  Then reply: "✓ Training geloggt — öffne Dashboard für Intensität"
- MUSIK → insert into music_projects (title=first 50 chars of text, status='idea', notes=text)
  Then reply: "✓ Musikidee gespeichert"
- LERNEN → POST to /api/knowledge internally with category pre-set to 'Zahnmedizin'
  Then reply: "✓ Lernnotiz gespeichert → Zahnmedizin"
- IDEE → POST to /api/knowledge internally with source='telegram'
  Then reply: "✓ Idee gespeichert → wird kategorisiert"
- ESSEN → insert into nutrition_logs (date=today, notes=text, other fields null)
  Then reply: "✓ Mahlzeit notiert — öffne Dashboard für Makros"

All routes use the admin Supabase client.
For the internal /api/knowledge call: call the function directly, not via HTTP.
Error handling: if any step fails, reply to the user with the error message.
Always return 200 to Telegram — never let the webhook time out.
```

================================================================================
## ABEND 10 — Analyse + Skills
================================================================================

PROMPT 10A — Analyse page:
```
Build the Analyse section at app/analyse/page.tsx.

This page has ONE main feature: an on-demand correlation analysis button.
Claude reads all Supabase data for the last N weeks and finds patterns.
This triggers Claude Sonnet (not Haiku — this needs real reasoning).

UI:
- Time range selector: 4 Wochen / 8 Wochen / 12 Wochen
- Large "ANALYSE STARTEN" button
- Loading state: "Claude analysiert [X] Tage Daten..."
- Results rendered as structured markdown sections:
  ## Schlaf & Erholung
  ## Training & Leistung
  ## Ernährung & Korrelationen
  ## Musik & Produktivität
  ## Empfehlungen

API route POST /api/analyse:
- Verify auth (logged in user only)
- CRITICAL: Never send raw rows to Claude. Pre-aggregate everything to weekly
  summaries in SQL first. This reduces input tokens by ~85% with no loss
  of analytical quality (Claude reasons over weekly patterns, not daily rows).

  Use these aggregation queries for the selected time range:

  -- Sleep (weekly averages)
  SELECT date_trunc('week', date) as week,
    round(avg(sleep_score)) as avg_sleep_score,
    round(avg(hrv_nightly)) as avg_hrv,
    round(avg(total_sleep_min) / 60.0, 1) as avg_sleep_h,
    round(avg(deep_sleep_min) / 60.0, 1) as avg_deep_h
  FROM garmin_sleep WHERE date > now() - interval '{N} weeks'
  GROUP BY week ORDER BY week;

  -- Activities (weekly counts and totals per type)
  SELECT date_trunc('week', date) as week, type,
    count(*) as sessions,
    round(sum(duration_min) / 60.0, 1) as total_h,
    round(avg(avg_hr)) as avg_hr
  FROM garmin_activities WHERE date > now() - interval '{N} weeks'
  GROUP BY week, type ORDER BY week, type;

  -- Body battery (weekly averages)
  SELECT date_trunc('week', date) as week,
    round(avg(morning_score)) as avg_morning_battery,
    round(avg(stress_avg)) as avg_stress
  FROM garmin_body_battery WHERE date > now() - interval '{N} weeks'
  GROUP BY week ORDER BY week;

  -- Strength (weekly sessions and average intensity)
  SELECT date_trunc('week', date) as week,
    count(*) as sessions,
    round(avg(intensity), 1) as avg_intensity
  FROM strength_sessions WHERE date > now() - interval '{N} weeks'
  GROUP BY week ORDER BY week;

  -- Habits (weekly completion rate per habit)
  SELECT date_trunc('week', date) as week, habit_name,
    round(100.0 * sum(completed::int) / count(*)) as completion_pct
  FROM daily_habits WHERE date > now() - interval '{N} weeks'
  GROUP BY week, habit_name ORDER BY week, habit_name;

  -- Nutrition (weekly averages)
  SELECT date_trunc('week', date) as week,
    round(avg(calories)) as avg_kcal,
    round(avg(protein_g)) as avg_protein_g,
    count(*) as logged_days
  FROM nutrition_logs WHERE date > now() - interval '{N} weeks'
  GROUP BY week ORDER BY week;

  Format the aggregated results as a compact structured text block before
  passing to Claude — not as raw JSON arrays.

- Call Claude Sonnet with system prompt:
  "Du bist ein persönlicher Performance-Analyst. Analysiere die Daten des Nutzers
  und finde echte Muster und Korrelationen. Sei konkret und datenbasiert.
  Formatiere als Markdown mit klaren Abschnitten. Antworte auf Deutsch."
- Stream the response back to the frontend
- Save the analysis as a knowledge_entry with category='Allgemein' and
  tag 'analyse' for later reference

Also add a smaller "Einkaufsliste" section on the same page:
- Shows current week's average nutrition (calories, protein)
- Button "Einkaufsliste generieren" → Claude Haiku generates a shopping list
  based on nutrition targets and common foods to hit the protein goal
- Output: simple markdown list, copy-to-clipboard button
```

PROMPT 10B — Skills in Claude.ai einrichten:
```
This step is NOT code — it's setup in the Claude.ai interface.

Create three Claude Projects on claude.ai (one per skill).
Each Project gets custom instructions as its system prompt.
These are standalone AI assistants, separate from the dashboard.

SKILL 1 — Wöchentliche Trainingsanalyse
Create a Project called "Training Coach" with these custom instructions:
"Du bist mein persönlicher Trainingscoach. Ich werde dir wöchentlich 
meine Trainingsdaten schicken: absolvierte Einheiten, Schlafwerte, 
Krafttraining-Intensitäten. Analysiere die Woche, vergleiche Plan vs. 
Realität, und gib mir 3 konkrete Empfehlungen für die nächste Woche.
Sei direkt und datenbasiert. Kein Hedging. Antworte auf Deutsch."

SKILL 2 — Einkaufsplaner  
Create a Project called "Einkauf" with these custom instructions:
"Du hilfst mir wöchentlich beim Einkaufsplanen. Meine Ziele:
~2500 kcal/Tag, ~160g Protein/Tag, clean eating, einfache Zubereitung.
Wenn ich dir sage was ich noch vorrätig habe oder was ich diese Woche
essen will, erstellst du eine strukturierte Einkaufsliste mit Mengenangaben.
Halte es praktisch und kurz. Antworte auf Deutsch."

SKILL 3 — Musikproduktion Advisor
Create a Project called "Musik" with these custom instructions:
"Du bist mein Musikproduktions-Advisor mit Expertise in FL Studio,
Trap, Drill, Hip-Hop und Sample-basierter Musik. Wenn ich dir ein
Beat-Projekt beschreibe (Genre, BPM, Tonart, was nicht klappt),
gibst du mir konkrete technische Tipps: Arrangement, Mixdown, 
Sound Design, Sample Auswahl. Kein Bullshit, direkte Antworten.
Antworte auf Deutsch."

Attach a skill file to each project (upload as a document):
For Training: upload a text file with your habit names, current training plan,
typical week structure
For Einkauf: upload your nutrition targets and foods you like/dislike
For Musik: upload a list of your current projects and your DAW setup
```

================================================================================
## NACH DEM BUILD — Obsidian Struktur einrichten
================================================================================

⚙️ Manuell in Obsidian:
Erstelle diese Ordnerstruktur in deinem Vault:
```
Recherche/
  Zahnmedizin/
  Triathlon/
  Krafttraining/
  Ernährung/
  Musikproduktion/
  FL Studio/
  Sampling/
  Allgemein/
Zahnmedizin/
  Anatomie.md
  Physiologie.md
  Zahnerhaltung.md
  Prothetik.md
  Kieferorthopädie.md
  Parodontologie.md
  Oralchirurgie.md
  Radiologie.md
```

Die Recherche-Ordner werden automatisch vom Dashboard befüllt.
Die Zahnmedizin-Hauptdateien nutzt du für aktives Lernen (manuell).

================================================================================
## BEKANNTE BUGS — VOR DEM BUILD LESEN (aus Community PDF Part 8)
================================================================================

1. BigInt-Bug auf Vercel: node-ical funktioniert lokal aber crasht auf Vercel.
   Fix: ical.js verwenden (bereits in allen Prompts so angegeben).

2. Habits resetten um 4 Uhr morgens: passiert wenn Server-UTC statt lokaler Zeit.
   Fix: localDateKey() helper ist bereits erstellt in Abend 1.

3. Silent POST failures: optimistisches Update erscheint, verschwindet dann.
   Ursache: leeres .catch(() => {}). Fix: immer Fehler loggen.

4. Race condition: GET nach Mount überschreibt frische User-Eingabe.
   Fix: dirtyRef = true beim ersten User-Edit, danach Mount-GET ignorieren.

5. Client crash beim ersten Render: TypeScript ! Assertion über async Grenze.
   Fix: immer loading-State vor data-Render, nie ! verwenden.
