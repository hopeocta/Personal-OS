Zuletzt abgeschlossen: Terminal-Feature — Dashboard-native Claude Chat mit Skills + Lernfach-Kontext
Datum: 2026-05-24

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

### 1. PDF-Pipeline — NICHT gebaut (wichtigste fehlende Sache)
Das Terminal-Lernfach "Zahnmedizin" zeigt aktuell "Keine Dokumente",
weil noch keine Inhalte in knowledge_entries unter dieser Kategorie sind.

Was gebaut werden muss:
  scripts/pdf-to-knowledge.mjs — lokales Node.js-Script
  
  Ablauf:
  1. Liest PDFs aus einem Ordner (z.B. ./zahnmedizin-pdfs/)
  2. Extrahiert Text mit pdf-parse (npm install pdf-parse)
  3. Teilt in Kapitel (~2000 Wörter je Block)
  4. POST jedes Kapitel → /api/knowledge (Header: x-api-secret)
  5. Claude Haiku kategorisiert automatisch → landet in Zahnmedizin
  6. Obsidian-Write passiert automatisch (Abend-6-Logik)
  
  Nach der Pipeline: Lernfach "Zahnmedizin" im Terminal hat echte Buchkapitel
  als Kontext → funktioniert wie Claude Projects mit deinen MKG-Büchern.
  
  Aufruf:
  node scripts/pdf-to-knowledge.mjs --input ./pdfs --url https://deine-vercel-url.vercel.app

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

Prompt für neuen Chat:
"Lies STATUS.md. Wir bauen heute die PDF-Pipeline:
scripts/pdf-to-knowledge.mjs — ein lokales Node.js-Script das meine
Zahnmedizin-PDFs liest, in Kapitel teilt und per POST an /api/knowledge
schickt. Danach soll Lernfach 'Zahnmedizin' im Terminal echte
Buchkapitel als Kontext laden."

=============================================================
## OFFENE MANUELLE SCHRITTE
=============================================================

1. Vercel Deploy abwarten (1-2 Min nach dem heutigen git push)
2. /terminal auf der Vercel-URL testen:
   - Lernpartner-Skill auswählen → Frage stellen → Antwort prüfen
   - 🎤 Button testen
3. PDF-Bücher in einen lokalen Ordner legen (vorbereiten für die Pipeline)
   Empfohlen: C:/Users/Administrator/Creative work/MKG-PDFs/
