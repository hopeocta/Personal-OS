Zuletzt abgeschlossen: Analyse nach Garmin-Leitfaden (HRV-Baseline, Stress-Minuten, Training Load, VO2max) + BB-Fix
Datum: 2026-05-29

Analyse-Route (app/api/analyse/route.ts) erfüllt jetzt den Garmin-Analyse-Leitfaden
(Creative work/Garmin_Analyse_Leitfaden.docx):
  - HRV-Baseline & -Status: Garmin-nativ (balanced-Korridor), nicht selbst gerechnet
  - Neue Garmin-Daten pro Tag (Sync + Backfill, je 1 Request/Endpoint):
    hrv-service (Baseline/Status), usersummary (Stress-Minuten + 7-Tage-RHR),
    trainingstatus (ATL/CTL/ACWR + Status + VO2max → neue Tabelle garmin_training)
  - Analyse: Baseline-Entwicklung (1. vs letzte 4 Wo.), 10%-Regel, Schlafkonsistenz-SD,
    SER, Trainings-Erholungs-Ratio, Warnsignal-Scan (3+-Tage-Runs), Wochen-Ampel,
    12-Wochen-Tabelle, Effizienz nach Aktivitätslänge.
  - Migrationen 0003 (resting_hr) + 0004 (recovery/load) — bereits in Supabase ausgeführt.
  - BUGFIX: Body-Battery morgens/abends waren vertauscht (jetzt korrekt: [last]=Aufwachen).
  - Backfill ganzes Jahr neu eingespielt, 0 Fehler. Coverage: vo2max 363, acwr 358,
    hrv_status 312, stress_min 352, rhr_7day 313.
  - HINWEIS: ANTHROPIC_API_KEY fehlt lokal in .env.local → /analyse lokal nicht testbar
    (nur in Vercel-Produktion). Aggregation wurde via Debug-Dump verifiziert.

Davor abgeschlossen: Garmin Schlaf/Stress/Body-Battery Backfill ganzes Jahr (2026-05-29)

Backfill-Ergebnis: garmin_sleep 8 -> 316, garmin_body_battery 4 -> 354,
garmin_activities 364 (war schon komplett). 0 Fehler.
Treiber: scripts/garmin-backfill-sleep.mjs (paginiert /api/garmin/backfill-sleep
lokal gegen den Dev-Server, kein Vercel-300s-Limit). Erneut ausführbar für Lücken:
  npm run dev   (in eigenem Terminal)
  node scripts/garmin-backfill-sleep.mjs --days 30

Davor abgeschlossen: PDF-Pipeline — scripts/pdf-to-knowledge.mjs gebaut und getestet (2026-05-24)

=============================================================
## WAS VOLLSTÄNDIG FERTIG IST
=============================================================

### Nightly Build Plan (Abend 1–10) ✅ KOMPLETT
- Abend 1: Foundation, Schema, Auth, Deploy
- Abend 2: UI Mockup + Next.js Components
- Abend 3: Garmin Sync + Google Calendar
- Abend 4: Sleep + Habits + Nutrition Cards
- Abend 5: Training Section
- Abend 6: Wissen / Knowledge + Obsidian Export
- Abend 7: Musik Section (Projects + Sound Library)
- Abend 8: Zahnmedizin Section
- Abend 9: Telegram Bot mit Voice Capture + Calendar Intent
- Abend 10: Analyse-Seite (Claude Sonnet Streaming) + Einkaufsliste

### Terminal-Feature ✅ DEPLOYED
Route: /terminal (sichtbar im TopRail)
- Claude Sonnet Streaming Chat (ohne PC-Abhängigkeit, von jedem Gerät)
- Skill-Selector mit vollem Inhalt aus den Skill-Dateien:
  - "Lernpartner (MKG)" — Prof. Otto LMU, Prüfungskontext, Arbeitsmethodik
  - "Tagesabschluss" — Lernprotokoll mit Fragen + Bewertungstabelle
- Lernfach-Selector — lädt alle knowledge_entries der Kategorie als Kontext
  (wie Claude Projects: 1x cache-write, alle Folgefragen 90% günstiger)
- 🎤 Audio-Recorder → Whisper-Transkription (Spracheingabe auf Deutsch)
- Token-Counter: cache-read / cache-write / output nach jeder Antwort
- Sitzung speichern → POST /api/knowledge → erscheint in /wissen
- Deployed auf Vercel (GitHub: hopeocta/Personal-OS, master branch)

=============================================================
## WAS NOCH FEHLT
=============================================================

### 1. PDF-Pipeline ✅ GEBAUT
scripts/pdf-to-knowledge.mjs — lokales Node.js-Script, getestet mit echten PDFs

  Ablauf:
  1. Liest alle PDFs aus einem Ordner
  2. Extrahiert Text mit pdf-parse v2 (PDFParse Klasse)
  3. Teilt in ~2000-Wort-Chunks an Absatzgrenzen
  4. POST jedes Kapitel → /api/knowledge (Header: x-api-secret aus .env.local)
  5. Claude Haiku kategorisiert → landet in Zahnmedizin (category vorbelegt)
  6. Obsidian-Write passiert automatisch (Abend-6-Logik)
  
  Dependencies: pdf-parse@2.4.5, dotenv@17.4.2 (bereits in package.json)

  Aufruf:
  node scripts/pdf-to-knowledge.mjs --input "C:/Pfad/zu/pdfs" --url https://deine-vercel-url.vercel.app
  
  Optionen:
  --dry-run           nur parsen, nichts senden (zum Testen)
  --words 1500        Chunk-Größe anpassen
  --delay 1000        ms zwischen Requests (Standard 800)
  --category "Zahnmedizin"  Ziel-Kategorie
  --secret XYZ        API_SECRET (alternativ aus .env.local)

NÄCHSTER SCHRITT: PDF-Bücher in einen Ordner legen und Pipeline ausführen:
  node scripts/pdf-to-knowledge.mjs --input "C:/Users/Administrator/Creative work/MKG-PDFs" --url https://DEINE-VERCEL-URL.vercel.app --dry-run
  Dann ohne --dry-run wiederholen wenn Chunks passen.

### 2. Lernpartner-Skill (gekürzte Version) — optional zu vervollständigen
Die Datei lib/config/skills.ts enthält eine komprimierte Version des
MKG-Lernpartner-Skills. Die Originalversion (Creative work/MKG_Lernpartner_SKILL_v2.md)
hat zusätzlich:
  - Vollständige Themenblöcke mit allen klinischen Details (PLECA, Blutgerinnung,
    MG-Frakturen, MRONJ etc.)
  - Detaillierte Anatomie-Tabellen (UK, Mittelgesicht, Neck Dissection,
    Speicheldrüsen, Zysten)
  
  Diese Inhalte kommen aber besser über den Lernfach-Selector (Zahnmedizin)
  aus knowledge_entries — daher nur ergänzen wenn der Skill alleine
  (ohne Lernfach) genutzt werden soll.

### 3. Vercel Env Vars prüfen (falls noch nicht erledigt)
Neue Route /api/chat und /api/transcribe brauchen:
  ANTHROPIC_API_KEY → bereits vorhanden (für /analyse genutzt)
  OPENAI_API_KEY → bereits vorhanden (für Telegram-Bot genutzt)
  Keine neuen Env Vars nötig.

### 4. Obsidian-Ordnerstruktur manuell anlegen (aus dem Plan)
Falls noch nicht erledigt:
  Recherche/Zahnmedizin/, Triathlon/, Krafttraining/ etc. anlegen.
  Wird automatisch befüllt sobald die PDF-Pipeline läuft.

=============================================================
## NÄCHSTE SESSION — WAS TUN
=============================================================

Nächste Session: PDFs importieren und Lernfach im Terminal prüfen.
1. MKG-PDFs in Ordner legen (z.B. C:/Users/Administrator/Creative work/MKG-PDFs/)
2. Dry-Run: node scripts/pdf-to-knowledge.mjs --input "C:/Users/Administrator/Creative work/MKG-PDFs" --url https://VERCEL-URL --dry-run
3. Scharf: ohne --dry-run
4. /terminal öffnen → Lernfach "Zahnmedizin" → prüfen ob Kapitel erscheinen

=============================================================
## OFFENE MANUELLE SCHRITTE
=============================================================

1. MKG-PDFs in Ordner legen: C:/Users/Administrator/Creative work/MKG-PDFs/
2. Dry-Run starten (aus dem Projekt-Ordner):
   node scripts/pdf-to-knowledge.mjs --input "C:/Users/Administrator/Creative work/MKG-PDFs" --url https://DEINE-VERCEL-URL.vercel.app --dry-run
3. Chunks prüfen → dann ohne --dry-run scharf schalten
4. /terminal öffnen → Lernfach "Zahnmedizin" wählen → Buchkapitel erscheinen als Kontext
