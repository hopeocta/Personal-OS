# Personal OS — Projektstatus

> Format: Letzter Session-Log oben → vollständige Feature-Liste → offene Roadmap → manuelle Schritte

---

## 🔄 Letzter Session-Log

| Datum | Was gemacht | Ergebnis |
|---|---|---|
| 04.06.2026 | Perplexity: robustes JSON-Parsing in seed-italian-vocab.ts | ✅ gemergt |
| 04.06.2026 | Audit aller Cron/Telegram Routen | 3 Bugs gefunden & gefixt |
| 04.06.2026 | Bug: health-review Cron Auth (Query-Param → Authorization-Header) | ✅ gefixt |
| 04.06.2026 | Bug: flashcard/newsletter Cron TELEGRAM_USER_CHAT_ID → TELEGRAM_USER_ID | ✅ gefixt |
| 04.06.2026 | Bug: writeObsidianFile gibt jetzt boolean zurück (TS-Fehler behoben) | ✅ gefixt |

---

## ❗ Manuelle Schritte ausstehend

- [ ] **Vokabel-Seed testen**: erst mit `count: 20` pro Thema laufen lassen, dann auf volle Zahlen (1000+) hochdrehen
- [ ] **Vercel Env prüfen**: `TELEGRAM_USER_ID` muss als Chat-ID gesetzt sein (gleicher Wert wie bisher — Telegram User-ID = Chat-ID bei Direktnachrichten)
- [ ] **Vokabeln Duplikat-Check**: prüfen ob `flashcards`-Tabelle eine Unique-Constraint auf `(deck_id, front)` braucht, wenn Seed mehrfach läuft

---

## 📱 Telegram Bot — alle Funktionen

### Texteingabe → Speichern-Kategorie wählen
Du schickst einen Text → Bot fragt: *Wohin soll ich das speichern?*

| Taste | Ziel | Was passiert |
|---|---|---|
| 🏋️ Training | `strength_sessions` | Krafteinheit geloggt + Obsidian Daily Log |
| 🎵 Musik | `music_projects` | Musikidee gespeichert + Obsidian Daily Log |
| 📚 Lernen | `flashcards` oder `knowledge_entries` | Format `Wort = Übersetzung` → direkte Vokabelkarte; sonst Lernnotiz |
| 📁 Plan | `knowledge_entries` (Pläne) | Subfolder-Auswahl: Reisen / Projekte |
| 🗒️ Notiz | `knowledge_entries` | Claude kategorisiert automatisch |
| 🛒 Einkauf | `knowledge_entries` (Einkauf) | Einkaufsliste + Obsidian-Update |
| 📅 Kalender | Google Calendar | Claude parst Datum/Zeit, erstellt Event mit Reminder |
| ❓ Fragen | RAG-Suche | Claude sucht in knowledge_entries und antwortet |

### Dokument-Upload (Foto / PDF / Word / Excel / TXT / CSV)
1. Datei schicken → Bot fragt nach Datum (falls nicht erkennbar)
2. Dann: Zielordner wählen

| Taste | Ziel | Was passiert |
|---|---|---|
| 🏥 Gesundheit | `health_labs` + Obsidian `Gesundheit/Dokumente/` | Claude extrahiert Laborwerte, strukturiert sie, legt Markdown ab |
| 🗂 Verwaltung | Obsidian `Verwaltung/...` | Grobe Kategorie, ablegen ohne tiefe Analyse |

### Sprachnotiz
Whisper transkribiert → selbe Pipeline wie Texteingabe

### Befehle

| Befehl | Funktion |
|---|---|
| `/lernen` | Lernmodus starten — nächste fällige Vokabel-Karte zeigen |
| `/antwort` | Lösung während aktiver Lernsession anzeigen |
| `/hol [Begriff]` | RAG-Suche in knowledge_entries |
| `/liste` | Aktuelle Einkaufsliste anzeigen (mit ✅-Buttons) |
| Text im Lernmodus | Antwort bewerten (richtig/falsch) → SM-2 Algorithmus |

### Automatische Nachrichten (Cron)

| Zeitpunkt | Nachricht |
|---|---|
| tägl. 07:00 | Vokabel-Reminder: „Heute X Karten fällig → /lernen" |
| tägl. 06:00 | Morgen-Briefing mit Kalender + Training + Wetter |
| Mo 06:05 | Wochen-Trainingsbriefing |
| tägl. 21:50 | Tages-Digest (Zusammenfassung) |
| So 21:55 | Wochen-Digest |
| Mo 07:00 | Zahnmedizin-Newsletter (PubMed) |
| 1. des Monats 08:00 | Monatlicher Literatur-Rückblick |
| 1. des Monats 08:30 | Monats-Gesundheitsanalyse → Obsidian + Telegram |
| 1. Jan + 1. Jul 09:00 | Halbjahres-Gesundheitsanalyse |
| 1. Jan 09:30 | Jahres-Gesundheitsanalyse |

---

## 🌐 Dashboard-Seiten

| URL | Seite | Funktion |
|---|---|---|
| `/` | Hauptseite | Übersicht / Hub |
| `/terminal` | Terminal | Chat + RAG-Suche + Erfassen (einzige UI für Wissensinteraktion) |
| `/analyse` | Analyse | Ad-hoc Gesundheits- & Trainingsanalyse (4/8/12/52 Wochen, Streaming) |
| `/training` | Training | Garmin-Daten, Aktivitäten, Schlaf, Body Battery |
| `/kalender` | Kalender | Google Calendar Events |
| `/musik` | Musik | FL Studio Projekte + Sound Library |
| `/wissen` | Wissen | Knowledge Base Browser |
| `/zahnmedizin` | Zahnmedizin | Lernfortschritt, Flashcards, Prüfungstermine |
| `/login` | Login | Passwortschutz |

---

## 🏃 Garmin-Integration

| Feature | Route/Datei | Beschreibung |
|---|---|---|
| Tägl. Sync | `app/api/garmin/sync` + Cron 05:00 UTC | Schlaf, Aktivitäten, Body Battery, Training automatisch |
| Manuelle Eingabe | `app/api/garmin/manual` | Einzelwerte nachtragen |
| Backfill Aktivitäten | `app/api/garmin/backfill` + `scripts/garmin-backfill.mjs` | Lücken in garmin_activities nachfüllen |
| Backfill Schlaf | `app/api/garmin/backfill-sleep` + `scripts/garmin-backfill-sleep.mjs` | Lücken in garmin_sleep nachfüllen |
| Status | `app/api/garmin/status` | Letztes Sync-Datum prüfen |

**Tabellen:** `garmin_activities`, `garmin_sleep`, `garmin_body_battery`, `garmin_training`

---

## 📊 Analyse-System

### Ad-hoc Analyse (`/analyse`)
- Zeitraum wählen: 4 / 8 / 12 / 52 Wochen
- Streaming (Claude antwortet sofort, nicht nach 30s)
- **Wochenampel 🟢🟡🔴** mit 6 Warnsignalen: HRV, RHR, Body Battery, Schlafdauer, SER, Volumensprung
- Consecutive-Run-Warnung: 3+ Tage HRV unter Baseline oder RHR +5 bpm
- Kalender-Korrelation: Prüfungswochen mit Schlaf/Stress/Volumen
- SER (Stress:Erholungs-Minuten), Ernährung, Gewohnheiten

### Automatische Periodenberichte (Cron → `lib/healthReview.ts`)
- Monatlich / Halbjährlich / Jährlich
- Wissenschaftliche Kennzahlen: Karvonen-Zonen, Polarisierungsindex (80/20), ACWR, Lauf-Effizienz, HRV-Trend, Schlafphasen
- Ergebnis: Markdown in Obsidian (`Gesundheit & Training/Monatsberichte|Halbjährig|Jahresberichte/`)
- Ergebnis auch in `knowledge_entries` (source: `health_review_*`) für RAG
- Kurzfassung per Telegram

### Analyse-Parameter (editierbar ohne Code)
- Datei: `Gesundheit & Training/analyse-parameter.md` im Obsidian-Vault
- Enthält: HFmax, Karvonen-Zonen, VO2max-Normen, ACWR-Grenzen, Schlafnormen, Empfehlungsformat
- Wird automatisch erstellt wenn fehlend

---

## 📚 Vokabel-System (Italienisch)

| Feature | Datei | Beschreibung |
|---|---|---|
| Flashcard-Tabellen | Supabase: `flashcards`, `flashcard_decks` | SM-2 Algorithmus (Spaced Repetition) |
| Lernen via Telegram | `/lernen` Befehl | Nächste fällige Karte, Antwort bewerten |
| Vokabel manuell hinzufügen | Telegram → Lernen-Button | Format: `Wort = Übersetzung` |
| Tages-Reminder | Cron 07:00 | Anzahl fälliger Karten per Telegram |
| Seed-Script | `scripts/seed-italian-vocab.ts` | 1000+ Karten via Claude generieren (10 Themen) |
| Robustes Parsing | `scripts/seed-italian-vocab.ts` | JSON-Fehler überspringen statt Crash, Thema einzeln |

**10 Themen:** Alltag & Haushalt, Essen & Trinken, Reisen & Transport, Körper & Gesundheit, Zahnarzt & Medizin, Arbeit & Studium, Sport & Fitness, Natur & Umwelt, Emotionen & Beziehungen, Technik & Digitales

---

## 🧠 Wissen & RAG

| Feature | Datei | Beschreibung |
|---|---|---|
| Knowledge-Eintrag speichern | `lib/knowledge.ts` | Embedding (OpenAI text-embedding-3-small, 1536d) + Supabase |
| Duplikat-Check | `lib/knowledge.ts` | `content_hash` verhindert doppelte Einträge |
| RAG-Suche | `lib/answer.ts` | Semantische Suche in `knowledge_entries` |
| Kategorisierung | Claude Haiku | Automatisch bei Telegram-Eingabe ohne vorgegebene Kategorie |
| Obsidian-Sync | `lib/obsidian.ts` | Texte landen in Obsidian + Supabase |
| Daily Log | `lib/obsidian.ts` | Jede Aktion wird ins Logbuch-Tagesfile geschrieben |
| Dokument-Ingest | `lib/documents.ts` | PDF/Bild/Word → Claude extrahiert → Obsidian + Supabase |

**Tabelle:** `knowledge_entries` (raw_text, summary, embedding, category, source, tags, content_hash)

---

## 📰 Newsletter & Literatur (Zahnmedizin)

| Feature | Datei | Beschreibung |
|---|---|---|
| Wöchentlicher Newsletter | `lib/newsletter.ts` | PubMed-Suche nach Zahnmedizin-Themen, Claude-Zusammenfassung → Telegram |
| Monatlicher Rückblick | `lib/newsletter.ts` | Monatlicher Literatur-Review → Telegram |

---

## 🎵 Musik (FL Studio)

| Feature | Route | Beschreibung |
|---|---|---|
| Projekte verwalten | `app/api/musik/projects` | CRUD für music_projects |
| Sound Library | `app/api/musik/sounds` | Metadaten, Scan, Bulk-Import, Cleanup |
| Sound abspielen | `app/api/musik/sounds/play` | Playback-Referenz (kein Audio in Supabase) |

---

## 📅 Kalender

| Feature | Datei | Beschreibung |
|---|---|---|
| Google Calendar lesen | `lib/calendar.ts` / `lib/googleCalendar.ts` | Events via iCal URL (`ical.js` — nie `node-ical`) |
| Termin erstellen | `lib/googleCalendar.ts` | Via Telegram oder Dashboard |
| Prüfungswochen erkennen | `lib/calendar.ts` → `isExamEvent()` | Für Korrelationen in Analysen |

---

## 🏥 Gesundheitsdokumente

| Feature | Route | Beschreibung |
|---|---|---|
| Dokument hochladen | `app/api/health-docs` | Blutbild, Laktattest, Leistungsdiagnostik |
| Werte extrahieren | `lib/documents.ts` → `processGesundheitDoc()` | Claude liest Werte → `health_labs` Tabelle |
| Obsidian-Ablage | `lib/documents.ts` | Strukturiertes Markdown in `Gesundheit/Dokumente/` |

---

## 🗃️ Obsidian-Integration

| Funktion | Beschreibung |
|---|---|
| `writeObsidianFile()` | Datei schreiben/überschreiben (gibt boolean zurück: ok/nicht erreichbar) |
| `appendToDailyLog()` | Eintrag ins Tages-Logbuch (Berlin-Zeit, idempotent) |
| `getObsidianFile()` | Datei lesen |
| Pfade zentral | `lib/obsidianPaths.ts` — nie hardcoden |

**Ordnerstruktur:** `Logbuch/JJJJ/MM/`, `Gesundheit & Training/`, `Verwaltung/`, `Musik/`, `_Eingang/`

---

## 🔧 Offene Roadmap (priorisiert)

### Phase 1 — Laktattest in healthReview ⭐ höchste Prio
- Neuesten `health_labs`-Eintrag (Laktattest/Leistungsdiagnostik) unabhängig vom Zeitraum laden
- HFmax, LT1, LT2, FTP aus gespeicherten Werten parsen
- Im Report: „Laktatschwelle Laufen: 4:30 min/km bei 168 bpm (Test vom …)"
- Trainingsdaten relativ zu LT1/LT2/FTP auswerten (nicht nur Karvonen)
- **Datei:** `lib/healthReview.ts`

### Phase 2 — SER, Ernährung & Habits in healthReview
- SER (Stress:Erholungs-Minuten) + Ampel-Logik aus `/api/analyse` übernehmen
- Kalorien/Protein Wochendurchschnitt aus `nutrition_logs`
- `daily_habits`-Erfüllungsquoten pro Woche/Monat
- **Datei:** `lib/healthReview.ts`

### Phase 3 — Dashboard mit Reviews verbinden
- API `app/api/analyse/recent/route.ts` → letzte 3 health-reviews aus Supabase
- Block „Letzte Reviews" auf `/analyse` (Titel, Zeitraum, Obsidian-Link)
- Optional: Button „Monatsanalyse jetzt neu erstellen"
- **Dateien:** `app/analyse/page.tsx`, neue API-Routen

### Phase 4 — Korrelationen verfeinern
- ACWR > 1.4 + negativer HRV-Trend als Überlastungs-Cluster markieren
- `fetchCalendarEvents` aus `/api/analyse` in `lib/calendar.ts` abstrahieren → in healthReview wiederverwenden
- **Dateien:** `lib/healthReview.ts`, `lib/calendar.ts`

---

## 📁 Wichtige Dateien auf einen Blick

```
CLAUDE.md                          ← Arbeitsregeln, Architektur, Env-Vars
docs/STATUS.md                     ← Diese Datei

lib/
  healthReview.ts                  ← Perioden-Analysen (monatlich/halbjährlich/jährlich)
  knowledge.ts                     ← RAG-Ingest, Embeddings, Duplikat-Check
  documents.ts                     ← Dokument-Verarbeitung (Gesundheit/Verwaltung)
  flashcards.ts                    ← SM-2 Vokabeltrainer
  newsletter.ts                    ← PubMed-Newsletter + Literatur-Review
  obsidian.ts                      ← Obsidian REST API (lesen/schreiben)
  obsidianPaths.ts                 ← Alle Vault-Pfade zentral
  calendar.ts                      ← iCal lesen, Prüfungswochen erkennen
  briefing.ts                      ← Tages-/Wochen-Briefing Logik
  garminClient.ts / garminWellness.ts ← Garmin Connect API

app/api/
  telegram/webhook/route.ts        ← Alle Telegram-Befehle + Datei-Upload
  analyse/route.ts                 ← Ad-hoc Analyse (Streaming)
  cron/health-review/route.ts      ← Cron-Trigger für healthReview
  cron/flashcards/route.ts         ← Vokabel-Reminder Cron
  cron/newsletter/route.ts         ← Newsletter Cron
  garmin/sync/route.ts             ← Täglicher Garmin-Sync

scripts/
  seed-italian-vocab.ts            ← 1000+ Vokabeln via Claude generieren
  garmin-backfill.mjs              ← Garmin-Aktivitäten Lücken füllen
  garmin-backfill-sleep.mjs        ← Garmin-Schlaf Lücken füllen

vercel.json                        ← Alle Cron-Schedules
```
