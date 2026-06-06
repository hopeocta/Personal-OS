# Nightly Build Plan (historisch, Abend 1–10)

> Dieser Plan ist **vollständig abgeschlossen** (Stand 2026-05). Er liegt hier als historische Referenz.
> Für den aktuellen Projektstand: `STATUS.md`
> Für aktuelle Architektur-Regeln: `CLAUDE.md`

---

## ABEND 1 — Foundation ✅
Next.js 15 + TypeScript strict + Tailwind dark mode + oklch Tokens.
lib/supabase.ts, lib/supabaseAdmin.ts, lib/types.ts, lib/dateUtils.ts.
supabase/migrations/0001_init.sql (9 Kerntabellen, RLS). Auth-Gate. Deploy auf Vercel.

## ABEND 2 — Design ✅
Single-page HTML Mockup (3-column, glassmorphism). TopRail, Shell, Panel.
SleepCard, HabitsCard, NutritionCard, TrainingCard, StrengthLogger, QuickCapture, MusikSnapshot.

## ABEND 3 — Garmin + Calendar ✅
app/api/garmin/sync/route.ts (Cron 5:00 UTC). app/api/calendar/route.ts (ical.js, 5-Min-Cache).
CalendarCard mit Wochen-Ansicht.

## ABEND 4 — Home Dashboard ✅
SleepCard, HabitsCard (6 Default-Habits, localStorage, localDateKey), NutritionCard (Inline-Edit).

## ABEND 5 — Training Section ✅
TrainingWeekCard (Plan vs. Actual). StrengthLogger. TriathlonHistory (Filter, 30 Tage).

## ABEND 6 — Wissen & Obsidian ✅
POST /api/knowledge (Claude Haiku → knowledge_entries → Obsidian async).
app/wissen/page.tsx (Quick-Capture, Kategorie-Tabs).

## ABEND 7 — Musik Section ✅
Project Tracker (CRUD, Status-Badges). Sound Library (Bulk Import via Claude Haiku).

## ABEND 8 — Zahnmedizin Section ✅
StudyProgress (ZM_* Habits, Streak). ClinicalSkills Checklist. ExamView. ZM-Recherche.

## ABEND 9 — Telegram Bot ✅
Whisper-Transkription. Inline-Keyboard (Training/Musik/Lernen/Idee/Essen).
Routing zu strength_sessions, music_projects, knowledge_entries, nutrition_logs.

## ABEND 10 — Analyse + Skills ✅
POST /api/analyse (Wochen-Aggregate → Claude Sonnet Streaming).
Einkaufsliste-Generator. Claude.ai Projects für Training/Einkauf/Musik.

---

## Bekannte Bugs (beim Bau gefunden und gefixt)

1. **BigInt-Bug auf Vercel**: `node-ical` crasht → Fix: `ical.js`
2. **Habits resetten um 4 Uhr**: Server-UTC statt lokale Zeit → Fix: `localDateKey()`
3. **Silent POST failures**: `.catch(() => {})` → Fix: immer Fehler loggen
4. **Race condition**: GET nach Mount überschreibt User-Input → Fix: `dirtyRef = true`
5. **Client crash**: TypeScript `!` über async-Grenzen → Fix: immer Loading-State
