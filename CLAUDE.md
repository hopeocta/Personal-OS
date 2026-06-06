# CLAUDE.md ÔÇö Personal OS

> Lies diese Datei am Anfang jeder Session. Dann STATUS.md. Dann frag bevor du baust.

---

## Wer ich bin

Ich bin Zahnarzt-Student (MKG-Schwerpunkt) in Deutschland, arbeite auf Deutsch.
Triathlon (Schwimmen/Radfahren/Laufen) + Krafttraining als Ausgleich, Garmin-Uhr t├ñglich.
Musikproduktion und Rappen als Kreativprojekt (FL Studio, Trap/Drill/Hip-Hop).
iPhone-Nutzer, Telegram f├╝r schnelle Erfassung unterwegs.

Aktuelle Priorit├ñten: MKG-Studium (Pr├╝fungsvorbereitung), Triathlon-Training,
Dashboard als zentrales pers├Ânliches Betriebssystem ausbauen.

---

## Das Projekt

Ein pers├Ânliches Dashboard das alle anderen Tracking-Apps ersetzt.
Eine URL. Alles an einem Ort. Keine separaten Apps.

Kernziele:
1. Garmin-Daten automatisch synchronisieren (Triathlon + Schlaf + Erholung)
2. Habits, Nutrition, Krafteinheiten in Sekunden loggen
3. Korrelationen zwischen Schlaf, Ern├ñhrung und Leistung finden
4. Wissen dumpen ÔÇö Claude kategorisiert automatisch, bleibt f├╝r immer durchsuchbar
5. FL Studio Projekte und Sound-Library verwalten
6. Zahnmedizin-Studium: Lernfortschritt, klinische Skills, Pr├╝fungstermine

---

## Wie ich mit dir arbeiten will

**Kommunikation:**
- Antworte auf Deutsch, direkt und ohne Hedging
- Keine Annahmen ÔÇö bei Unklarheit immer erst fragen
- Sag mir explizit wenn etwas in Vercel-Produktion anders l├ñuft als lokal

**Beim Bauen:**
- Baue exakt was ich beschreibe. Nichts mehr, nichts weniger.
- Pr├╝fe die Architektur-Regeln bevor du eine Route oder Komponente schreibst
- Einfach und funktionierend > clever und fragil
- Alle Supabase-Typen zuerst in `lib/types.ts` definieren, dann verwenden
- Jede API-Route braucht einen expliziten Loading- und Error-State im Frontend
- Manuelle Schritte IMMER ausführbar erklären: exakter Befehl, voller Pfad und was der Schritt bewirkt — nie nur ein Stichwort wie „ngrok starten". Vorher prüfen, ob das Tool installiert und auf dem PATH ist; wenn nicht, den vollständigen Aufruf (z.B. absoluter .exe-Pfad) angeben.

**Phasen und Sessions:**
- Nach JEDER abgeschlossenen Phase: STOPPEN ÔåÆ testen ÔåÆ committen ÔåÆ fragen ob weiter
- Nie mehrere Phasen ohne R├╝ckfrage durchziehen
- Am Ende jeder Session: Session-Ritual ausf├╝hren (siehe unten)

---

## Session-Ritual

**Session-Start (immer, vor dem ersten Code):**
1. `STATUS.md` lesen
2. Einen Satz Zusammenfassung: *ÔÇ×Zuletzt wurde X gebaut. Heute: Y."*
3. Auf meine Best├ñtigung warten

**Session-Ende (immer, in dieser Reihenfolge):**
1. Alle betroffenen `docs/`-Dateien aktualisieren:
   - `docs/STATUS.md` — JEDE neue/fertige Funktion unter „Was funktioniert“, offene manuelle Schritte als Checkliste
   - `docs/roadmap.md` — Geplantes/Verschobenes eintragen, Erledigtes archivieren
   - Funktionsspezifische Doku (`docs/<feature>.md`) — bei Struktur- oder API-Änderungen sofort anpassen
   - `CLAUDE.md` — bei Architekturänderungen, neuen Pfaden oder geänderten Konventionen
   - Ziel: `/docs` zeigt immer lückenlos, was implementiert ist und was in Planung
2. `git add -A && git commit -m "[kurze Beschreibung]" && git push` — **immer pushen**, nicht nur committen
3. Bestätigen dass `git push` erfolgreich war (Remote-URL und Branch nennen)
4. Mir sagen was ich manuell tun muss bevor die nächste Session beginnt
---

## Architektur-Regeln ÔÇö nie brechen

### Allgemein
- Page loads l├Âsen **nie** Claude-API-Calls aus ÔÇö Seiten lesen nur aus Supabase
- Claude l├ñuft nur bei expliziter User-Aktion (Speichern-Button, Analyse-Button)
- `localDateKey()` f├╝r alle Datumslogik ÔÇö immer lokale Uhrzeit, nie Server-UTC
- `ical.js` f├╝r Kalender ÔÇö `node-ical` hat einen BigInt-Bug auf Vercel, nie verwenden
- Garmin-Sync ist ein t├ñglicher Vercel-Cron um 5:00 UTC ÔÇö nie beim Page-Load
- Obsidian-Write ist async und non-blocking ÔÇö Dashboard wartet nie darauf
- API-Fehler immer loggen ÔÇö nie `.catch(() => {})`
- Nie `!` Non-null Assertion ├╝ber async-Grenzen ÔÇö Typ korrekt l├Âsen

### Supabase
- `supabaseAdmin.ts` **nur in Server-only Code** (API Routes, Scripts) ÔÇö nie in Client Components
- Service Role Key umgeht RLS ÔÇö mit Bedacht verwenden
- `server-only` Package f├╝r Admin-Client-Importe nutzen

### RAG & Embeddings
- Embedding-Modell: `text-embedding-3-small` (1536d) ÔÇö **nie wechseln** ohne kompletten Re-Embed
- Garmin-Zahlen **immer** ├╝ber `query_metrics` (SQL), nie ├╝ber Embeddings
- `query_metrics` immer mit typisiertem Enum + Datumsbereich ÔÇö Claude bekommt **kein** rohes SQL
- RAG: nur statischen System/Tool-Block cachen, nie die wechselnden Tool-Results

### Kosten
- Claude nur ├╝ber Volltexte wenn zwingend n├Âtig (24.05.2026 = mehrere Dollar Fehler)
- Pro Dokument: nur Auszug/Bild an Claude (~0,2 Cent) ÔÇö Original in Obsidian, Text+Embedding ÔåÆ Supabase
- Kosten-Bremse aktiv in `saveKnowledgeEntry`: kein Claude-Call wenn Kategorie vorgegeben
- Analyse-API: Daten **immer** als Wochen-Aggregate vorverarbeiten ÔÇö nie Roh-Rows an Claude

### Client Components
- Nie aus SDK-ziehenden Modulen importieren (z.B. `lib/knowledge.ts` zieht Anthropic SDK)
- Konstanten geh├Âren in `lib/categories.ts` (SDK-frei) ÔÇö Client Components importieren von dort
- `@anthropic-ai/sdk` in `serverExternalPackages` in `next.config.ts`

### Vercel Serverless
- `await` statt `void` f├╝r async Calls ÔÇö fire-and-forget l├ñuft nach Response-Ende **nicht** weiter
- `export const maxDuration = 30` f├╝r Routes mit Embedding + mehrstufigen Claude-Calls

---

## Tech Stack

| Schicht | Tool |
|---|---|
| Frontend | Next.js (App Router), TypeScript strict, Tailwind CSS, dark mode |
| Datenbank | Supabase (PostgreSQL + pgvector) |
| Hosting | Vercel + GitHub |
| AI | Anthropic Claude Sonnet (RAG, Analyse, `_Eingang`-Dokument-Klassifizierung — liest Scans zuverlässiger als Haiku), Haiku (leichte Telegram-Kategorisierung) |
| Embeddings | OpenAI `text-embedding-3-small` (1536d) |
| Transkription | OpenAI Whisper (nur Telegram-Sprachnotizen) |
| Kalender | Google Calendar via iCal URL ÔÇö `ical.js` only |
| Garmin-Sync | Garmin Connect API via t├ñglichem Vercel-Cron |
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
daily_habits         -- Manuell: Habits (inkl. ZM_* f├╝r Zahnmedizin)
nutrition_logs       -- Manuell: Kalorien + Makros
knowledge_entries    -- Alle Wissenseintr├ñge + Embedding (1536d) + content_hash
music_projects       -- FL Studio Projekte
sound_library        -- Sample-Metadata (kein Audio in Supabase)
telegram_pending_docs -- Durables State f├╝r mehrstufige Telegram-Uploads
```

Vollst├ñndiges Schema: `supabase/migrations/`
Migrationshistorie: `README.md`

---

## Obsidian-Ordnerstruktur (verbindlich)

```
Logbuch/JJJJ/MM/JJJJ-MM-TT.md   <- Notizen leben NUR hier (+ Supabase f├╝r RAG)
Gesundheit/{Training, Dokumente, Werte, Recherche}/
Literatur/Medizin/Zahnmedizin/
Literatur/Allgemein/
Musik/
Verwaltung/{Rechnungen privat, Rechnungen Arbeit, Steuern}/
Einkauf/
Logbuch/Pl├ñne und Ideen/
_Eingang/                         <- Drop-Ordner f├╝r automatischen Ingest
```

Obsidian-Pfade zentral in `lib/obsidianPaths.ts` ÔÇö nie hart coden.

---

## Ingestion-Prinzip (verbindlich)

Dokumente kommen ├╝ber 3 Kan├ñle in **dieselbe** Pipeline:
1. `_Eingang/` (lokaler Drop-Ordner ÔåÆ `scripts/eingang-ingest.mjs`)
2. Telegram (Foto/PDF-Upload ÔåÆ Supabase Storage ÔåÆ Obsidian)
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
API_SECRET                # F├╝r lokale Scripts -> /api/knowledge
```

---

## Pet Peeves

- Nie `node-ical` verwenden
- Nie Claude-API beim Page-Load triggern
- Nie `!` f├╝r TypeScript-Fehler
- Nie Audio-Dateien in Supabase speichern ÔÇö nur `file_path`-Referenz
- Nie Features au├ƒerhalb des aktuellen Scopes bauen ohne zu fragen
- Nie mehrere Phasen ohne R├╝ckfrage durchziehen

---

## Weiterf├╝hrend

- Aktueller Projektstand + Session-Log: [`STATUS.md`](STATUS.md)
- Originaler Nightly Build Plan (Abend 1ÔÇô10, historisch): [`docs/nightly-build-plan.md`](docs/nightly-build-plan.md)
- Vollst├ñndige Dokumentation: [`docs/`](docs/)
