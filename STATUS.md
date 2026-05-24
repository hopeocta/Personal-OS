Zuletzt abgeschlossen: Abend 8 — Zahnmedizin Section
Nächster Schritt: Abend 9 — Telegram Bot (Voice Capture)
Datum: 2026-05-24
Offene Punkte: Webhook bei Telegram registrieren (curl-Befehl) — Token/User-ID/Secret sind bereits in Vercel eingetragen und deployed
Vercel URL: personal-os-ten-iota.vercel.app (Abend 8 deployed)

Was gebaut wurde (Abend 8):
- lib/config/dentalSkills.ts: 14 klinische Skills (Vorklinik/Klinik)
- app/zahnmedizin/page.tsx: vollständige Zahnmedizin-Seite mit 4 Sektionen:
  1. Lernfortschritt: 8 Fächer (ZM_Anatomie bis ZM_Radiologie)
     - Toggle "heute gelernt" mit optimistischem UI
     - Streak-Anzeige (konsekutive Lerntage)
     - Mini-Heatmap (30 Tage, 6×6px Dots)
     - Daten aus /api/habits?from=...&to=... (neue Range-Query)
  2. Klinische Skills: localStorage-basierte Checkliste
     - 5 Vorklinik-Skills + 9 Klinik-Skills
     - Fortschrittsbalken und % pro Gruppe
     - Persistiert via localStorage ('zm_skills_completed')
  3. Prüfungen: Calendar-Events gefiltert nach Prüfungs-Keywords
     - 90-Tage-Fenster (neue ?days=90 param in /api/calendar)
     - Farb-Kodierung: <7 Tage=rot, 7-30=amber, >30=grün
     - "Xd" Countdown prominent angezeigt
     - Click-to-expand für Beschreibung
  4. Recherche: knowledge_entries gefiltert auf category='Zahnmedizin'
     - Quick-Capture textarea (Kategorie vorausgefüllt)
     - Suche client-side
     - Gleiche Card-UI wie Wissen-Seite
- app/api/habits/route.ts: erweitert um ?from=&to= Range-Query
- app/api/calendar/route.ts: erweitert um ?days=N param (Standard 14, max 365)
  Cache pro window-Größe in Map statt single variable

Diskutiert (noch nicht gebaut):
- Abend 11 (revidiert): MCP-Setup statt Chat-Interface
  - Supabase MCP + Obsidian MCP für Claude Desktop App
  - Zugriff auf alle Daten per natürlicher Sprache
  - Korrelationsanalysen (Schlaf/Training, Ernährung/Leistung, Lerngewohnheiten)
