# CLAUDE.md — Personal OS

> Lies diese Datei am Anfang jeder Session. Dann STATUS.md. Dann frag bevor du baust.

---

## Wer ich bin

Ich bin Zahnarzt-Student (MKG-Schwerpunkt) in Deutschland, arbeite auf Deutsch.
Triathlon (Schwimmen/Radfahren/Laufen) + Krafttraining als Ausgleich, Garmin-Uhr täglich.
Musikproduktion und Rappen als Kreativprojekt (FL Studio, Trap/Drill/Hip-Hop).
iPhone-Nutzer, Telegram für schnelle Erfassung unterwegs.

Aktuelle Prioritäten: MKG-Studium (Prüfungsvorbereitung), Triathlon-Training,
Dashboard als zentrales persönliches Betriebssystem ausbauen.

---

## Das Projekt

Ein persönliches Dashboard das alle anderen Tracking-Apps ersetzt.
Eine URL. Alles an einem Ort. Keine separaten Apps.

Kernziele:
1. Garmin-Daten automatisch synchronisieren (Triathlon + Schlaf + Erholung)
2. Habits, Nutrition, Krafteinheiten in Sekunden loggen
3. Korrelationen zwischen Schlaf, Ernährung und Leistung finden
4. Wissen dumpen — Claude kategorisiert automatisch, bleibt für immer durchsuchbar
5. FL Studio Projekte und Sound-Library verwalten
6. Zahnmedizin-Studium: Lernfortschritt, klinische Skills, Prüfungstermine

---

## Wie ich mit dir arbeiten will

**Kommunikation:**
- Antworte auf Deutsch, direkt und ohne Hedging
- Keine Annahmen — bei Unklarheit immer erst fragen
- Sag mir explizit wenn etwas in Vercel-Produktion anders läuft als lokal

**Beim Bauen:**
- Baue exakt was ich beschreibe. Nichts mehr, nichts weniger.
- Prüfe die Architektur-Regeln bevor du eine Route oder Komponente schreibst
- Einfach und funktionierend > clever und fragil
- Alle Supabase-Typen zuerst in `lib/types.ts` definieren, dann verwenden
- Jede API-Route braucht einen expliziten Loading- und Error-State im Frontend

**Phasen und Sessions:**
- Nach JEDER abgeschlossenen Phase: STOPPEN → testen → committen → fragen ob weiter
- Nie mehrere Phasen ohne Rückfrage durchziehen
- Am Ende jeder Session: Session-Ritual ausführen (siehe unten)

---

## Session-Ritual

**Session-Start (immer, vor dem ersten Code):**
1. `STATUS.md` lesen
2. Einen Satz Zusammenfassung: *„Zuletzt wurde X gebaut. Heute: Y."*
3. Auf meine Bestätigung warten

**Session-Ende (immer, in dieser Reihenfolge):**
1. `git add -A && git commit -m "[kurze Beschreibung]"`
2. `STATUS.md` aktualisieren (Format: was fertig, was kommt, offene manuelle Schritte)
3. Mir sagen was ich manuell tun muss bevor die nächste Session beginnt

---

## Architektur-Regeln — nie brechen

### Allgemein
- Page loads lösen **nie** Claude-API-Calls aus — Seiten lesen nur aus Supabase
- Claude läuft nur bei expliziter User-Aktion (Speichern-Button, Analyse-Button)
- `localDateKey()` für alle Datumslogik — immer lokale Uhrzeit, nie Server-UTC
- `ical.js` für Kalender — `node-ical` hat einen BigInt-Bug auf Vercel, nie verwenden
- Garmin-Sync ist ein täglicher Vercel-Cron um 5:00 UTC — nie beim Page-Load
- Obsidian-Write ist async und non-blocking — Dashboard wartet nie darauf
- API-Fehler immer loggen — nie `.catch(() => {})`
- Nie `!` Non-null Assertion über async-Grenzen — Typ korrekt lösen

### Supabase
- `supabaseAdmin.ts` **nur in Server-only Code** (API Routes, Scripts) — nie in Client Components
- Service Role Key umgeht RLS — mit Bedacht verwenden
- `server-only` Package für Admin-Client-Importe nutzen

### RAG & Embeddings
- Embedding-Modell: `text-embedding-3-small` (1536d) — **nie wechseln** ohne kompletten Re-Embed
- Garmin-Zahlen **immer** über `query_metrics` (SQL), nie über Embeddings
- `query_metrics` immer mit typisiertem Enum + Datumsbereich — Claude bekommt **kein** rohes SQL
- RAG: nur statischen System/Tool-Block cachen, nie die wechselnden Tool-Results

### Kosten
- Claude nur über Volltexte wenn zwingend nötig (24.05.2026 = mehrere Dollar Fehler)
- Pro Dokument: nur Auszug/Bild an Claude (~0,2 Cent) — Original in Obsidian, Text+Embedding → Supabase
- Kosten-Bremse aktiv in `saveKnowledgeEntry`: kein Claude-Call wenn Kategorie vorgegeben
- Analyse-API: Daten **immer** als Wochen-Aggregate vorverarbeiten — nie Roh-Rows an Claude

### Client Components
- Nie aus SDK-ziehenden Modulen importieren (z.B. `lib/knowledge.ts` zieht Anthropic SDK)
- Konstanten gehören in `lib/categories.ts` (SDK-frei) — Client Components importieren von dort
- `@anthropic-ai/sdk` in `serverExternalPackages` in `next.config.ts`

### Vercel Serverless
- `await` statt `void` für async Calls — fire-and-forget läuft nach Response-Ende **nicht** weiter
- `export const maxDuration = 30` für Routes mit Embedding + mehrstufigen Claude-Calls

---

## Tech Stack

| Schicht | Tool |
|---|---|
| Frontend | Next.js (App Router), TypeScript strict, Tailwind CSS, dark mode |
| Datenbank | Supabase (PostgreSQL + pgvector) |
| Hosting | Vercel + GitHub |
| AI | Anthropic Claude Sonnet (RAG, Analyse), Haiku (Klassifizierung) |
| Embeddings | OpenAI `text-embedding-3-small` (1536d) |
| Transkription | OpenAI Whisper (nur Telegram-Sprachnotizen) |
| Kalender | Google Calendar via iCal URL — `ical.js` only |
| Garmin-Sync | Garmin Connect API via täglichem Vercel-Cron |
| Telegram | Bot-Webhook |
| Knowledge | Obsidian via Local REST API (lokal, PC) |

---

## Datenbankschema (Kerntabellen)

```sql
garmin_activities    -- Auto: Garmin-Cron
garmin_sleep         -- Auto: Garmin-Cron
garmin_body_battery  -- Auto: Garmin-Cron
garmin_training      -- Auto: vo2max, atl, ctl, acwr, training_status
health_labs          -- Telegram-Upload: Blutbild, Laktattest, Befund
strength_sessions    -- Manuell: Krafteinheiten
daily_habits         -- Manuell: Habits (inkl. ZM_* für Zahnmedizin)
nutrition_logs       -- Manuell: Kalorien + Makros
knowledge_entries    -- Alle Wissenseinträge + Embedding (1536d) + content_hash
music_projects       -- FL Studio Projekte
sound_library        -- Sample-Metadata (kein Audio in Supabase)
telegram_pending_docs -- Durables State für mehrstufige Telegram-Uploads
```

Vollständiges Schema: `supabase/migrations/`
Migrationshistorie: `README.md`

---

## Obsidian-Ordnerstruktur (verbindlich)

```
Logbuch/JJJJ/MM/JJJJ-MM-TT.md   <- Notizen leben NUR hier (+ Supabase für RAG)
Gesundheit/{Training, Dokumente, Werte, Recherche}/
Literatur/Medizin/Zahnmedizin/
Literatur/Allgemein/
Musik/
Verwaltung/{Rechnungen privat, Rechnungen Arbeit, Steuern}/
Einkauf/
Logbuch/Pläne und Ideen/
_Eingang/                         <- Drop-Ordner für automatischen Ingest
```

Obsidian-Pfade zentral in `lib/obsidianPaths.ts` — nie hart coden.

---

## Ingestion-Prinzip (verbindlich)

Dokumente kommen über 3 Kanäle in **dieselbe** Pipeline:
1. `_Eingang/` (lokaler Drop-Ordner → `scripts/eingang-ingest.mjs`)
2. Telegram (Foto/PDF-Upload → Supabase Storage → Obsidian)
3. Terminal-Upload (optional)

`/terminal` ist die einzige UI (Chat + RAG-Suche + Erfassen).

---

## Env Vars

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
OPENAI_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_USER_ID
GOOGLE_CALENDAR_ICAL_URL
GARMIN_EMAIL
GARMIN_PASSWORD
OBSIDIAN_API_URL          # http://localhost:27123
OBSIDIAN_API_KEY
CRON_SECRET
AUTH_SECRET
DASHBOARD_PASSWORD
USER_TIMEZONE
API_SECRET                # Für lokale Scripts -> /api/knowledge
```

---

## Pet Peeves

- Nie `node-ical` verwenden
- Nie Claude-API beim Page-Load triggern
- Nie `!` für TypeScript-Fehler
- Nie Audio-Dateien in Supabase speichern — nur `file_path`-Referenz
- Nie Features außerhalb des aktuellen Scopes bauen ohne zu fragen
- Nie mehrere Phasen ohne Rückfrage durchziehen

---

## Weiterführend

- Aktueller Projektstand + Session-Log: [`STATUS.md`](STATUS.md)
- Originaler Nightly Build Plan (Abend 1–10, historisch): [`docs/nightly-build-plan.md`](docs/nightly-build-plan.md)
- Vollständige Dokumentation: [`docs/`](docs/)
