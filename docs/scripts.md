# Scripts (Wartung & Werkzeuge)

Lokale Node-Scripts im Ordner `scripts/`. Alle laden `.env.local`. Manche laufen self-contained
(direkt gegen Supabase/OpenAI/Obsidian), manche treiben eine lokale API-Route.

> Aus dem Projekt-Ordner ausführen: `C:\Users\Administrator\Documents\Claude\Personal OS`

---

## Garmin → Obsidian (Sync-Agent)

```
node scripts/garmin-obsidian-sync.mjs            # letzte 30 Tage
node scripts/garmin-obsidian-sync.mjs --all      # gesamte Historie
node scripts/garmin-obsidian-sync.mjs --dry-run  # nur anzeigen
```
Spiegelt Garmin-Tagesdaten als MD nach `Gesundheit/Training/JJJJ/MM/`. Idempotent.
Läuft automatisch über den Scheduler → [garmin-sync.md](garmin-sync.md).

---

## Garmin-Historie nachladen (Supabase)

```
npm run dev                                   # in eigenem Terminal (Dev-Server)
node scripts/garmin-backfill-sleep.mjs --days 30
```
Paginiert `/api/garmin/backfill-sleep` lokal (umgeht das Vercel-300s-Limit). Holt Schlaf/Stress/
Body-Battery/Training für vergangene Tage. `--offset N` = Start N Tage zurück.

---

## Embeddings nachtragen (RAG-Backfill)

```
node scripts/embed-backfill.mjs
node scripts/embed-backfill.mjs --batch 20 --delay 300
```
Bettet alle `knowledge_entries` **ohne** Embedding ein (idempotent: `WHERE embedding IS NULL`).
Heilt Einträge, die beim Schreiben kein Embedding bekommen haben.

> **Wichtig:** Input wird auf 6.000 Zeichen gekappt (OpenAI-Limit 8192 Tokens; medizinischer
> PDF-Text ist token-dicht). Batch-Default 20.

---

## PDF-Bücher importieren

```
node scripts/pdf-to-knowledge.mjs --input "C:/Pfad/zu/pdfs" --url https://DEINE-VERCEL-URL --dry-run
node scripts/pdf-to-knowledge.mjs --input "C:/Pfad/zu/pdfs" --url https://DEINE-VERCEL-URL
```
Liest PDFs (`pdf-parse` v2), teilt in ~2000-Wort-Kapitel, POSTet an `/api/knowledge`
(Kategorie vorbelegt → kein Claude-Call, nur Embedding). Optionen: `--words`, `--delay`,
`--category`, `--secret`.

> **Kosten-Bremse:** Bei vorgegebener Kategorie ruft `saveKnowledgeEntry` **kein** Claude auf.

---

## RAG testen

```
npx tsx scripts/test-answer.mjs    # voller answerQuestion-Loop (braucht ANTHROPIC_API_KEY)
node scripts/test-rag.mjs          # nur Datenschicht (Vektor + SQL), ohne Anthropic-Key
```

---

## Datenbank-Überblick

```
node scripts/db-overview.mjs
```
Zeigt Tabellen-Counts / Stichproben — nützlich zum schnellen Prüfen des DB-Stands.

---

## Übersicht aller Scripts

| Script | Zweck | Self-contained? |
|---|---|---|
| `garmin-obsidian-sync.mjs` | Garmin → Obsidian MD | ✅ (Supabase + Obsidian) |
| `garmin-backfill-sleep.mjs` | Garmin-Historie → Supabase | treibt API-Route |
| `embed-backfill.mjs` | fehlende Embeddings nachtragen | ✅ (Supabase + OpenAI) |
| `pdf-to-knowledge.mjs` | PDF-Bücher → knowledge_entries | treibt API-Route |
| `test-answer.mjs` | RAG-Engine-Test (voll) | ✅ (Anthropic + OpenAI + Supabase) |
| `test-rag.mjs` | RAG-Datenschicht-Test | ✅ (ohne Anthropic) |
| `db-overview.mjs` | DB-Counts/Stichproben | ✅ (Supabase) |

---

## Wiederkehrende Stolperfalle: `.env.local` Override

Claude Code überschreibt manche Env-Vars (z.B. `ANTHROPIC_API_KEY`) in seiner Prozess-Umgebung.
Für lokale Node-Tests deshalb `dotenv.config({ override: true })` nutzen (so machen es die
test-Scripts), sonst greift der falsche Key.
