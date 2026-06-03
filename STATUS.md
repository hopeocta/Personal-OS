Zuletzt abgeschlossen: Phase 4 — Telegram-Frage-Logik (?→RAG) + Button-Umbau (Pläne/Essen)
Datum: 2026-06-03

== AKTUELLE SESSION (2026-06-03) ==

>>> IM NÄCHSTEN CHAT HIER STARTEN <<<
  Plan-Datei (komplett, abgenommen):
    C:\Users\Administrator\.claude\plans\lass-uns-erstmal-nochmal-synthetic-raven.md
  ARBEITSWEISE (VERBINDLICH): Nach JEDER Phase STOPPEN → testen → committen →
  Nutzer fragen ob mit nächster Phase weiter. Nie mehrere Phasen ohne Rückfrage.

PHASE 1 STATUS: ✅ KOMPLETT (verifiziert 2026-06-03)
  ✅ Migration: vector-Extension + embedding-Spalte + HNSW-Index (knowledge_entries)
  ✅ Migration: match_knowledge RPC (Vektor-Suche via pgvector)
  ✅ lib/embeddings.ts (embedText / embedBatch / buildEmbedInput)
  ✅ scripts/embed-backfill.mjs (idempotent, Rate-Limit-Backoff, Batch 20, max 6k Zeichen/Input)
  ✅ Backfill: 1105 von 1105 embedded (DB verifiziert)

PHASE 2 STATUS: ✅ KOMPLETT (verifiziert 2026-06-03, deployed)
  ✅ embedAndStore-Hook in saveKnowledgeEntry + saveNoteEntry (lib/knowledge.ts)
  ✅ WICHTIG: await statt void — Vercel friert Serverless-Function nach Response ein,
     "fire-and-forget" (void) läuft dort NICHT zu Ende. Bei künftigen Hintergrund-Tasks beachten.
  ✅ Verifiziert: Telegram-Notiz 16:14 → has_embedding=true. Frühere Notizen ohne Embedding
     heilt der idempotente Backfill (node scripts/embed-backfill.mjs).

PHASE 3 STATUS: ✅ GEBAUT, Datenschicht verifiziert (2026-06-03) — volle Engine noch nicht live-getestet
  ✅ lib/metrics.ts — typisierter SQL-Dispatcher (Metrik-Enum, KEIN freies SQL),
     parametrisierte PostgREST-Queries, JS-Aggregate (sum/avg/min/max/count/latest/list),
     Filter activity_type + test_name. Tabellen: garmin_sleep/activities/body_battery/training,
     nutrition_logs, strength_sessions, health_labs.
  ✅ lib/answer.ts — answerQuestion(): Sonnet-Orchestrator, 2 Tools (search_knowledge Vektor +
     query_metrics SQL), Tool-Loop max 3 Runden, max_tokens 1024, statischer System-Block cachebar,
     Berlin-Datum im Prompt (löst "diesen Monat" selbst auf).
  ✅ scripts/test-rag.mjs — verifiziert OHNE Anthropic-Key: Vektor-Suche (Frage "Zahnarzt empfohlen?"
     → korrekte Zahnmedizin-Treffer 52-55%) + SQL-Pfad (Schlaf-Score Ø 78/30 Tage). Beide OK.
  ✅ VOLLSTÄNDIG VERIFIZIERT (lokal, 2026-06-03):
     - Vektor-Pfad: "Was weiß ich über Endodontie?" → search_knowledge → strukturierte Antwort
       mit Quellenangaben (MKG-PDFs) — 2 Runden.
     - SQL-Pfad: "Wie war mein Schlaf-Score diesen Monat?" → query_metrics(sleep_score,avg)
       → Ø 66 (2 Nächte) — Claude löste "diesen Monat" selbst auf. 2 Runden.
     Hinweis: ANTHROPIC_API_KEY ist in .env.local, aber Claude Code überschreibt ihn in seiner
     Prozess-Umgebung → dotenv.config({override:true}) nötig für lokale node-Tests.

PHASE 4 STATUS: ✅ GEBAUT (2026-06-03) — live getestet, funktioniert
  ✅ Frage-Erkennung NICHT mehr per "?"-Heuristik (verworfen: kollidierte mit Erfassung).
     Stattdessen "❓ Frage beantworten"-Button am Capture-Keyboard (callback t:FR) →
     routeByType('FR') → answerQuestion() → Antwort (Markdown). "?" im Text ist jetzt egal.
     Gilt auch für Sprachnotizen (Voice → Keyboard mit Frage-Button).
  ✅ export const maxDuration = 30 (Embedding + bis 3 Sonnet-Runden; Default 10s reicht nicht).
  ✅ Button-Umbau: "💡 Idee" → "🗓️ Pläne" (callback t:PL), "🍎 Essen" entfernt.
     Keyboard jetzt: [Training,Musik,Lernen] / [Pläne,Notiz] / [Einkauf,Kalender].
     (Notiz/Einkauf/Kalender bewusst behalten — nur Idee→Pläne + Essen weg, wie gewünscht.)
  ✅ lib/knowledge.ts: neue savePlanEntry() — feste category 'Projekte', source 'telegram',
     KEIN Claude-Call (cheapSummary), Obsidian-Ziel "Logbuch/Pläne und Ideen/JJJJ-MM-TT-slug.md",
     + Embedding (RAG-suchbar). 'ES'/'ID'-Routing + nutrition_logs-Pfad entfernt.
  ✅ tsc --noEmit grün. RAG-Engine (test-answer.mjs) erneut OK: Vektor (Endodontie m. Quellen)
     + SQL (Schlaf-Score Ø 66). Webhook ruft exakt diese answerQuestion auf.

NÄCHSTER SCHRITT (nächste Session): Phase 5 — Garmin → Obsidian (MD unter Gesundheit/Training)
  Plan-Datei Abschnitt "Phase 5". ERST FRAGEN ob mit Phase 5 weiter.

MANUELL VOR/NACH DEPLOY (Phase 4):
  1. Deploy auf Vercel (git push → auto-deploy).
  2. Telegram-Live-Test: eine Frage mit "?" senden (z.B. "Wann war ich zuletzt beim Zahnarzt?"
     oder "Wie war mein Schlaf diesen Monat?") → Antwort mit Quellen erwarten.
  3. Obsidian-Ordner "Logbuch/Pläne und Ideen/" — wird von der Local REST API beim ersten
     PUT automatisch angelegt; nur prüfen falls der erste Plan-Eintrag nicht erscheint.

BUGFIX embed-backfill.mjs (diese Session):
  Batch-Default 100 → 20, Input-Kappung 6.000 Zeichen/Eintrag.
  OpenAI-Limit: 8192 Tokens pro Input. Medizinischer PDF-Text token-dicht (~2 Zeichen/Token)
  → 15k Zeichen-Kappung reichte nicht. 6k Zeichen ≈ max 3000 Tokens — sicher.

GEBAUT & GETESTET:
  - Tabelle health_labs (Migration via Supabase MCP angewandt)
  - Supabase Storage Bucket 'documents' (privat, Tresor) — Upload getestet OK
  - lib/healthDocs.ts (processGesundheitDoc / processVerwaltungDoc, Claude Vision/PDF)
  - app/api/telegram/webhook/route.ts: Foto/PDF, Datum aus Caption/Nachfrage, doc-Callbacks
  - KOSTEN-BREMSE in lib/knowledge.ts: saveKnowledgeEntry ruft Claude nur noch wenn KEINE
    Kategorie vorgegeben (sonst cheapSummary). Auto-Kat. nur über 4000-Zeichen-Auszug.

ENTSCHEIDUNGEN (alle im Plan + CLAUDE.md):
  - Embeddings: OpenAI text-embedding-3-small (1536d). Garmin-Zahlen NUR via SQL (query_metrics).
  - Frage-Erkennung: Nachricht enthält "?" → RAG-Antwort.
  - Obsidian-Struktur final: Logbuch/, Gesundheit/{Training,Dokumente,Werte,Recherche}/,
    Zahnmedizin/, Musik/, Recherche/, Literatur/{Medizin,Allgemein}/, Verwaltung/, Einkauf/.
  - Notizen leben NUR im Tages-Logbuch (+ Supabase für RAG), kein Kategorie-File.
  - INGESTION-REWORK: /wissen-Seite + PdfImporter ENTFERNEN. /terminal wird einzige UI.
    Neuer Eingangs-Ordner _Eingang/ (lokaler Watcher) → Claude sortiert auto in Obsidian-Subordner.
    Kosten pro Dokument: ~0,2 Cent Klassifizierung + ~0 Embedding, kanal-unabhängig.
  - TODO bei Phase-1-Bau: Embed-Kappung 8000 → ~30000 Zeichen (Ø Eintrag 10.735, sonst
    werden Buchkapitel abgeschnitten).
  - OFFEN: Storage-Modell dauerhaft (empfohlen) vs. temporär-löschen — erst vor Phase 6 nötig.

MANUELL VOR DEPLOY des heutigen Stands:
  Obsidian-Ordner Gesundheit/ + Verwaltung/ anlegen (sonst nur Tresor in Supabase).

== VORHERIGE SESSIONS ==

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
