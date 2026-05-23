Zuletzt abgeschlossen: Abend 6 — Wissen & Recherche (Knowledge Capture + Obsidian + Wissen-Seite)
Nächster Schritt: Abend 7 — Musik Section (Project Tracker + Sound Library)
Datum: 2026-05-24
Offene Punkte: keine

Was gebaut wurde (Abend 6):
- @anthropic-ai/sdk installiert
- /api/knowledge GET: Einträge laden, optional gefiltert nach category/search/limit
- /api/knowledge POST: Claude Haiku kategorisiert Text → category, summary, tags[]
  → Eintrag in knowledge_entries → async Obsidian-Write (non-blocking)
- Obsidian-Write: PUT /vault/Recherche/{category}/{date}-{slug}.md via Local REST API
  (schlägt lautlos fehl wenn Obsidian nicht erreichbar — kein Dashboard-Fehler)
- app/wissen/page.tsx: vollständige Wissen-Seite mit:
  - Capture-Textarea + SPEICHERN-Button (Ctrl+Enter Shortcut)
  - Loading-State "CLAUDE KATEGORISIERT..."
  - Toast-Notification nach dem Speichern (Kategorie + Tags)
  - 9 Kategorie-Filter-Tabs (Alle + 8 Kategorien) mit Farbkodierung
  - Client-seitige Suchfunktion (raw_text + summary + tags)
  - Eintrags-Karten: Kategorie-Badge, Summary, Tags, Datum, aufklappbarer Raw-Text
- fix: TypeScript-Fehler in TrainingWeekLive.tsx + ESLint-Fehler in wissen/page.tsx
  (blockierten Vercel Build — beide gefixt, Deploy ist grün)
- PowerShell-Profil eingerichtet: startet automatisch im Personal OS Ordner

Zusätzlich erledigt (außerhalb Abend 5):
- ANTHROPIC_API_KEY eingetragen (neuer Key nach Widerruf des alten)
- OBSIDIAN_API_URL=http://localhost:27123 eingetragen
- OBSIDIAN_API_KEY eingetragen
- Obsidian Vault Struktur angelegt: Recherche/ (8 Unterordner) + Zahnmedizin/ (8 .md Dateien)
- Obsidian Community Plugins installiert: Dataview, Templater, Remotely Save, Omnisearch
