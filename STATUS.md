Zuletzt abgeschlossen: Abend 9 + Sound Library Refactoring & Bugfixes — 2026-05-24
Nächster Schritt: Abend 10 — Analyse-Seite (Korrelationen + Einkaufsliste via Claude Sonnet)
Datum: 2026-05-24
Offene Punkte: Duplikate in sound_library DB bereinigen — Scan-Modal öffnen → "🗑 DUPLIKATE BEREINIGEN" klicken

Was heute gemacht wurde:
- Sound Library UI-Refactoring (app/musik/page.tsx):
  - Play-Button als Inline-Icon direkt links vom Dateinamen (verschwindet wenn kein Hover)
  - Sample-Counter: "GESAMT X" Infozeile permanent sichtbar, Kategorie-Count dynamisch
  - Interaktive Tags: Klick auf Tag filtert Liste, aktiver Filter in Infozeile mit ✕-Reset
  - displayLimit=200 Paginierung: "MEHR LADEN (X weitere)" Button, kein Browser-Hang mehr
  - React-Key-Bug bei doppelten Tags gefixt (key: t-i statt nur t)
- Bugfixes Supabase 1000-Row-Limit:
  - app/api/musik/sounds/scan/route.ts: fetchAllExistingPaths() paginiert durch alle Seiten
  - app/api/musik/sounds/route.ts: GET-Route paginiert + dedupliziert per file_path
  - app/api/musik/sounds/cleanup/route.ts: NEU — löscht Duplikate aus DB (DELETE-Endpoint)
  - Scan-Modal: "🗑 DUPLIKATE BEREINIGEN" Button hinzugefügt
- Calendar fix (app/api/calendar/route.ts): 
  - Wenn GOOGLE_CALENDAR_ICAL_URL nicht gesetzt → 200+[] statt 500-Fehler
- Next.js Update: 15.5.18 → 16.2.6
  - .next Ordner nach Update gelöscht (fallback-build-manifest Fehler behoben)
  - Set-ExecutionPolicy RemoteSigned für PowerShell npm-Ausführung

Bekannte Duplikate: sound_library hat ~8630 Rows statt 3565 (API dedupliziert bereits im Frontend)
→ Cleanup via Modal-Button entfernt Duplikate dauerhaft aus der DB
