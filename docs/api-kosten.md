# API-Kosten & System-Rollen — Personal OS

> Stand: Juni 2026

Dieses Dokument beschreibt **alle Stellen wo API-Kosten entstehen**, strukturiert nach Rolle, Modell, Datenquellen, Output und Ausführungsfrequenz.

---

## 🗺️ Systemüberblick: Datenfluss

```
Datenquellen                  Sammeln/Strukturieren          Analysieren/Zusammenfassen
─────────────────             ──────────────────────         ──────────────────────────
Garmin Connect API    ──────▶ garmin_activities              Briefing (kein AI)
                              garmin_sleep                   Newsletter (Claude Haiku)
                              garmin_body_battery            Monatsbericht (Claude Sonnet)
                              garmin_training (ACWR)

Telegram Voice        ──────▶ Transkription (Whisper)  ────▶ Routing (kein AI)
Telegram Docs         ──────▶ Claude Haiku analysiert  ────▶ health_labs / knowledge_entries
Telegram Text         ──────▶ Embeddings (OpenAI)      ────▶ knowledge_entries

PubMed API (kostenlos)──────▶ literatur_entries        ────▶ Zusammenfassung (Claude Haiku)

Google Calendar API   ──────▶ Kalender-Termine         ────▶ Briefing (kein AI)

Manuelle Eingaben     ──────▶ Vokabeln (Claude Opus)   ────▶ Flashcard-System
```

---

## 🔵 Regelmäßige Tasks (Cron & täglich)

### 1. Morgen-Briefing — täglich ~06:00
**Datei:** `lib/briefing.ts` → `app/api/briefing/route.ts`  
**AI-Kosten:** ❌ Kein API-Call — rein datengetrieben

Sammelt aus Supabase und stellt zusammen:
| Datenquelle | Inhalt |
|---|---|
| `garmin_sleep` | Schlaf-Score, HRV (mit 7-Tage-Vergleich), Schlafdauer |
| `garmin_body_battery` | Morgendliche Energie |
| `garmin_training` | ACWR (Trainingsbelastungs-Verhältnis, errechnet aus ATL/CTL) |
| `garmin_activities` | Aktivitäten der letzten 7 Tage (Swim/Bike/Run km, Stunden) |
| `health_labs` | Letzter Laborwert + Hinweis wenn >6 Monate her |
| `daily_habits` | Habit-Tracking (x/y erledigt) |
| Google Calendar API | Heutige Termine |

**Output:** Markdown + Telegram-Nachricht → Obsidian Daily Log  
**Kosten:** $0 (nur Datenbankabfragen)

---

### 2. Garmin-Sync — täglich ~05:00 UTC
**Datei:** `lib/garminClient.ts`, `lib/garminWellness.ts`  
**AI-Kosten:** ❌ Kein API-Call — Garmin Connect API ist kostenlos

Pullt automatisch von Garmin Connect und schreibt in Supabase:
| Tabelle | Inhalt |
|---|---|
| `garmin_activities` | Alle Trainingseinheiten (Typ, Dauer, Distanz, HR, Pace) |
| `garmin_sleep` | Schlaf-Score, HRV-Nacht, Schlafdauer, Schlafphasen |
| `garmin_body_battery` | Morgendlicher Erholungswert |
| `garmin_training` | ACWR, ATL (acute load), CTL (chronic load), Status-Phrase |

**Output:** Rohdaten in Supabase — keine Analyse hier  
**Kosten:** $0 (Garmin API ist kostenlos)

---

### 3. Zahnmedizin-Newsletter — jeden Montag ~07:00
**Datei:** `lib/newsletter.ts` → `app/api/cron/newsletter/route.ts`  
**AI-Kosten:** ✅ Claude Haiku

Ablauf:
1. **PubMed API** (kostenlos): 5 Suchanfragen → bis zu 20 neue Publikationen der letzten 7 Tage
2. **Claude Haiku** fasst die Abstracts in 3-5 Bullet Points zusammen (klinisch relevante Erkenntnisse, auf Deutsch)
3. Artikel werden in `literatur_entries` gespeichert
4. Ergebnis per Telegram + Obsidian Daily Log

**Warum Haiku?** Klar definierte Zusammenfassungsaufgabe, Input ist strukturiert (Abstracts), Output kurz.  
**Kosten:** ~$0.05/Woche → ~$0.20/Monat

---

### 4. Zahnmedizin-Monatsbericht — 1. des Monats ~08:00
**Datei:** `lib/newsletter.ts` → `app/api/cron/newsletter/route.ts`  
**AI-Kosten:** ✅ Claude Sonnet

Ablauf:
1. Liest alle `literatur_entries` des vergangenen Monats aus Supabase
2. **Claude Sonnet** erstellt strukturierten Rückblick nach Themengebieten (Implantologie, Parodontologie, Endodontie…) mit 3 hervorgehobenen Erkenntnissen
3. Wird als `knowledge_entry` (Kategorie: Literatur) gespeichert → via RAG abrufbar

**Warum Sonnet statt Haiku?** Monatliche Muster über mehrere Wochen erkennen, Themen clustern und Relevanz gewichten — Haiku verliert dabei den roten Faden.  
**Warum nicht Opus?** Läuft auf bereits zusammengefassten Daten (nicht Rohdaten) — Sonnet reicht.  
**Kosten:** ~$0.30/Monat

---

### 5. Flashcard-Erinnerung — täglich ~07:00
**Datei:** `app/api/cron/flashcards/route.ts`  
**AI-Kosten:** ❌ Kein API-Call

Prüft wie viele Karten heute fällig sind (via SM-2 Algorithmus in `lib/flashcards.ts`) und schickt eine Telegram-Nachricht wenn >0 fällig.  
**Kosten:** $0

---

## 🟡 Event-getriggert (bei Eingang)

### 6. Dokument-Analyse: Gesundheit
**Datei:** `lib/documents.ts` → `processGesundheitDoc()`  
**Trigger:** Foto/PDF per Telegram → User wählt "🩺 Gesundheit"  
**AI-Kosten:** ✅ Claude Haiku

Ablauf:
1. Duplikat-Check via SHA256-Hash (kein API-Call)
2. **Claude Haiku** liest das Dokument (Bild oder PDF) und extrahiert:
   - `doc_type`: blutbild / laktattest / befund
   - Titel, Zusammenfassung
   - Alle messbaren Werte mit Referenzbereich und Status (normal/low/high)
3. Werte in `health_labs` (strukturiert für Trend-Abfragen)
4. Volltext in `knowledge_entries` (für RAG-Suche)
5. Original + Markdown-Notiz in Obsidian
6. Original in Supabase Storage (Tresor)

**Warum Haiku?** Dokument-Parsing ist regelbasiert — klar definiertes JSON-Schema, kein freies Reasoning nötig. `max_tokens: 8192` wegen großer Laborbefunde.  
**Kosten:** ~$0.005/Dokument → bei 10 Docs/Monat ~$0.05

---

### 7. Dokument-Analyse: Verwaltung
**Datei:** `lib/documents.ts` → `processVerwaltungDoc()`  
**Trigger:** Foto/PDF per Telegram → User wählt "📋 Verwaltung"  
**AI-Kosten:** ✅ Claude Haiku

Ablauf:
1. Duplikat-Check
2. **Claude Haiku** klassifiziert Dokument in Kategorie (Versicherung / Arbeit / Amt / Finanzen / Wohnen / Datenbank / Sonstiges) + Unterkategorie bei Finanzen
3. Ablage in Supabase Storage + Obsidian + `knowledge_entries` (RAG)

**Kosten:** ~$0.002/Dokument → bei 10 Docs/Monat ~$0.02

---

### 8. Kalender-Intent-Parsing
**Datei:** `app/api/telegram/webhook/route.ts` → `parseCalendarIntent()`  
**Trigger:** User schickt Text → wählt "📅 Kalender"  
**AI-Kosten:** ✅ Claude Haiku

Wandelt natürlichsprachlichen Text in strukturiertes JSON um: Titel, Startzeit, Endzeit, Erinnerung. Schreibt direkt in Google Calendar API.  
**Warum Haiku?** Kurzer Input, klar definiertes Ausgabe-Schema, kein komplexes Reasoning.  
**Kosten:** ~$0.001/Eintrag → bei 30/Monat ~$0.03

---

### 9. RAG-Fragen beantworten
**Datei:** `lib/answer.ts` → `answerQuestion()`  
**Trigger:** User wählt "❓ Frage beantworten" in Telegram  
**AI-Kosten:** ✅ Claude Sonnet

Ablauf:
1. Frage wird in Vektor umgewandelt (OpenAI Embeddings)
2. Semantische Suche in `knowledge_entries` (Supabase pgvector)
3. **Claude Sonnet** beantwortet die Frage auf Basis der gefundenen Kontext-Einträge

**Warum Sonnet?** Freie Antworten müssen kontextuell korrekt und verständlich formuliert sein — Haiku macht bei komplexen Zusammenhängen häufiger Fehler.  
**Kosten:** ~$0.006/Frage → bei 50/Monat ~$0.30

---

### 10. Sprachnachrichten transkribieren
**Datei:** `app/api/telegram/webhook/route.ts` → `transcribeVoice()`  
**Trigger:** Voice-Message per Telegram  
**AI-Kosten:** ✅ OpenAI Whisper-1

Lädt die OGG-Audiodatei von Telegram herunter und schickt sie an Whisper zur Transkription. Kein Anthropic-Äquivalent verfügbar.  
**Kosten:** $0.006/Minute → bei 20 Memos à ~30s ~$0.01/Monat

---

### 11. Embeddings (RAG-Index)
**Datei:** `lib/embeddings.ts`  
**Trigger:** Jeder neue Eintrag in `knowledge_entries`  
**AI-Kosten:** ✅ OpenAI `text-embedding-3-small`

Jeder gespeicherte Eintrag (Notiz, Dokument, Lerninhalt) wird in einen 1536-dimensionalen Vektor umgewandelt und in `knowledge_entries.embedding` gespeichert. Ermöglicht semantische Suche für RAG.  
**Kosten:** $0.02/1M Tokens → bei 100 Einträgen à ~200 Tokens ~$0.0004/Monat (praktisch kostenlos)

---

## 🟢 Einmalig

### 12. Italienisch-Vokabeln generieren
**Datei:** `scripts/seed-italian-vocab.ts`  
**AI-Kosten:** ✅ Claude Opus 4.8

~1000 Vokabeln in 10 Themenblöcken mit Beispielsätzen auf B1-C1-Niveau. Einmalig ausgeführt — danach nie wieder außer bei Erweiterung.  
**Warum Opus?** Qualität der Vokabeln und Beispielsätze bestimmt direkt die Lernqualität für Monate. Haiku/Sonnet produzieren unnatürlichere Sätze und ungenauere Niveau-Einschätzungen.  
**Kosten:** ~$0.80 einmalig

---

## 📊 Monatliche Gesamtkosten (Normalbetrieb)

| # | Task | Modell | Frequenz | Kosten/Monat |
|---|---|---|---|---|
| 3 | Zahnmedizin Newsletter | Claude Haiku | 4×/Monat | ~$0.20 |
| 4 | Zahnmedizin Monatsbericht | Claude Sonnet | 1×/Monat | ~$0.30 |
| 6 | Gesundheits-Dokumente | Claude Haiku | ~10 Docs | ~$0.05 |
| 7 | Verwaltungs-Dokumente | Claude Haiku | ~10 Docs | ~$0.02 |
| 8 | Kalender-Parsing | Claude Haiku | ~30× | ~$0.03 |
| 9 | RAG-Antworten | Claude Sonnet | ~50× | ~$0.30 |
| 10 | Whisper Transkription | OpenAI Whisper | ~20 Memos | ~$0.01 |
| 11 | Embeddings | OpenAI text-embedding-3-small | ~100 Einträge | ~$0.00 |
| | **Gesamt** | | | **~$0.91/Monat** |

> Einmalig: ~$0.80 für Seed-Vokabeln (Opus)

---

## 💡 Prinzip der Modellwahl

| Modell | Einsatzregel |
|---|---|
| **Haiku** | Parsing, Klassifikation, kurze strukturierte Intents — Input und Output klar definiert |
| **Sonnet** | Zusammenfassungen, freie Antworten, mittlere Kontextlänge — wo Haiku Fehler macht |
| **Opus** | Nur seltene/einmalige Tasks wo Qualität wichtiger ist als Kosten |
| **Whisper** | Audio-Transkription — kein Anthropic-Äquivalent |
| **Embeddings** | Semantische Suche — läuft bei jedem Eintrag, aber pro-Token-Preis minimal |
