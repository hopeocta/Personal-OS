Zuletzt abgeschlossen: Abend 10 — Analyse-Seite (Korrelationen via Claude Sonnet + Einkaufsliste via Haiku)
Nächster Schritt: Nightly Build Plan vollständig — Dashboard ist fertig gebaut
Datum: 2026-05-24

Offene Punkte:
- Duplikate in sound_library DB bereinigen — Scan-Modal öffnen → "🗑 DUPLIKATE BEREINIGEN" klicken (falls noch nicht erledigt)
- PROMPT 10B (optional, manuell): 3 Claude.ai Projects einrichten auf claude.ai/projects
  → NICHT Teil des Dashboards — separate Chatbots mit Custom Instructions
  → Weitgehend redundant, da /analyse bereits echte Daten via API analysiert
  → Bei Bedarf: Training Coach / Einkauf / Musik als Projects auf claude.ai anlegen

Was heute gemacht wurde (Abend 10, 2026-05-24):
- Analyse-Seite (app/analyse/page.tsx):
  - Zeitraum-Selector: 4 / 8 / 12 Wochen
  - "ANALYSE STARTEN" Button → Claude Sonnet Streaming
  - Markdown-Renderer (SimpleMarkdown) für strukturierte Analyse-Ausgabe
  - Streaming: Echtzeit-Anzeige der Claude-Antwort via ReadableStream
  - Einkaufsliste-Card: Claude Haiku generiert Wocheneinkaufsliste
  - Kopieren-Button für Einkaufsliste
  - Ernährungs-Durchschnitte der letzten Woche als Kontext angezeigt
- app/api/analyse/route.ts:
  - Wöchentliche Aggregation aller 6 Tabellen in JS (kein raw SQL nötig)
  - Claude Sonnet Streaming mit ReadableStream
  - Analyse-Ergebnis wird background als knowledge_entry gespeichert
- app/api/analyse/einkauf/route.ts:
  - Letzte 7 Tage Ernährung als Kontext
  - Claude Haiku generiert Markdown-Einkaufsliste mit Kategorien
- components/dashboard/TopRail.tsx: ANALYSE Tab hinzugefügt

Nightly Build Plan: ALLE 10 ABENDE ABGESCHLOSSEN ✓
