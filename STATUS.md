Zuletzt abgeschlossen: Abend 4 — Sleep, Habits & Nutrition live verbunden
Nächster Schritt: Abend 5 — Training Section (TrainingWeekCard live, StrengthLogger live, TriathlonHistory)
Datum: 2026-05-23
Offene Punkte: keine

Was gebaut wurde (Abend 4):
- SleepCard: server-seitig aus garmin_sleep + garmin_body_battery geladen (null-safe)
- HabitsCard: client-seitig, 6 Default-Habits aus lib/config/habits.ts, Toggle speichert in Supabase
- NutritionCard: client-seitig, Inline-Edit (Klick auf Wert → Eingabe → Blur → Supabase), 600ms debounce
- /api/habits (GET + POST): liest/schreibt daily_habits, upsert auf date+habit_name
- /api/nutrition (GET + POST): liest/schreibt nutrition_logs, upsert auf date
- page.tsx: async Server Component, Sleep server-seitig geladen, keine Hardcoded-Daten mehr

Bekanntes Pre-Existing Issue:
- CalendarCard → HTTP 500 (separates Problem, nicht Abend 4)
